/* ══════════════════════════════════════════════════════════════════
   SYNC QUEUE — ضمان حفظ 100% للاستفسارات والمنتسيات وشكاوى السيطرة
   ──────────────────────────────────────────────────────────────────
   آلية العمل:
   1) قبل كل _push لـ Shaab_Master_DB، نأخذ snapshot للسجلات
   2) السجلات التي لم تتأكد بعد على السيرفر تُحفظ في localStorage فوراً
   3) عند نجاح _push، نُحدّث "آخر مؤكَّد" ونحذف المكتمل من الطابور
   4) Timer كل 5 ثوانٍ + حدث online + فتح الصفحة → إعادة محاولة تلقائية
   5) زر عائم بشعار محامص الشعب يعرض الحالة ويسمح بإعادة محاولة يدوية
   ══════════════════════════════════════════════════════════════════ */

const SQ_STORAGE_KEY        = '_shaab_sync_pending';
const SQ_LAST_CONFIRMED_KEY = '_shaab_sync_last_confirmed';

const SQ_TYPES = {
    inquiry:   { arrayKey: 'inquiries',  labelAr: 'استفسار',           idField: 'id' },
    montasia:  { arrayKey: 'montasiat',  labelAr: 'منتسية (محامص)',    idField: 'id' },
    complaint: { arrayKey: 'complaints', labelAr: 'شكوى السيطرة',      idField: 'id' }
};

/* الطابور: { "type:id" : { type, id, record, summary, addedTs, attempts, hash } } */
let _sqPending = {};
let _sqLastConfirmed = { records: {} };
let _sqRetryTimer = null;
let _sqUiRenderTimer = null;
let _sqHideTimer = null;
let _sqDropdownOpen = false;

/* ── تحميل الطابور من localStorage ── */
function _sqLoad() {
    try { _sqPending = JSON.parse(localStorage.getItem(SQ_STORAGE_KEY) || '{}'); }
    catch { _sqPending = {}; }
    try { _sqLastConfirmed = JSON.parse(localStorage.getItem(SQ_LAST_CONFIRMED_KEY) || '{"records":{}}'); }
    catch { _sqLastConfirmed = { records: {} }; }
}

function _sqPersist() {
    try { localStorage.setItem(SQ_STORAGE_KEY, JSON.stringify(_sqPending)); }
    catch (e) { console.error('[SQ] persist pending failed:', e); }
}

function _sqPersistLastConfirmed() {
    try { localStorage.setItem(SQ_LAST_CONFIRMED_KEY, JSON.stringify(_sqLastConfirmed)); }
    catch (e) { console.error('[SQ] persist last-confirmed failed:', e); }
}

/* ── hash بسيط للسجل لكشف التغييرات ── */
function _sqHashRecord(rec) {
    try {
        const s = JSON.stringify(rec);
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return h;
    } catch { return 0; }
}

function _sqRecordSummary(type, rec) {
    if (!rec) return '';
    if (type === 'inquiry') {
        const seq = rec.seq || rec.id;
        const cust = rec.customer || rec.notes || '';
        return `استفسار #${seq} — ${String(cust).slice(0, 40)}`;
    }
    if (type === 'montasia') {
        return `منتسية #${rec.id} — ${rec.type || ''} ${rec.branch || ''}`.trim();
    }
    if (type === 'complaint') {
        const txt = rec.notes || rec.branch || '';
        return `شكوى — ${String(txt).slice(0, 40)}`;
    }
    return '';
}

/* ── يأخذ snapshot من db للسجلات الثلاثة ── */
function _sqTakeSnapshot(dbObj) {
    const snap = { ts: Date.now(), records: {} };
    if (!dbObj || typeof dbObj !== 'object') return snap;
    for (const type in SQ_TYPES) {
        const arr = dbObj[SQ_TYPES[type].arrayKey] || [];
        for (const rec of arr) {
            if (!rec) continue;
            const id = rec[SQ_TYPES[type].idField];
            if (id == null) continue;
            const key = `${type}:${id}`;
            snap.records[key] = {
                type,
                id,
                hash: _sqHashRecord(rec),
                summary: _sqRecordSummary(type, rec),
                record: rec
            };
        }
    }
    return snap;
}

/* ── يُستدعى قبل كل _push لـ Master_DB ── */
function __sq_beforePush(dbObj) {
    const snap = _sqTakeSnapshot(dbObj);
    const lastRecs = (_sqLastConfirmed && _sqLastConfirmed.records) || {};

    /* أي سجل بـ hash مختلف عن آخر مؤكد → ضعه في الطابور */
    for (const key in snap.records) {
        const cur = snap.records[key];
        const lst = lastRecs[key];
        if (!lst || lst.hash !== cur.hash) {
            const prev = _sqPending[key];
            _sqPending[key] = {
                type:    cur.type,
                id:      cur.id,
                hash:    cur.hash,
                summary: cur.summary,
                record:  cur.record,
                addedTs: prev ? prev.addedTs : Date.now(),
                attempts:(prev ? prev.attempts : 0) + 1,
                lastTryTs: Date.now()
            };
        }
    }
    _sqPersist();
    _sqRenderUI();
    return snap;
}

/* ── يُستدعى بعد نجاح _push (HTTP 200) ── */
function __sq_markConfirmed(sentSnapshot) {
    if (!sentSnapshot || !sentSnapshot.records) return;
    _sqLastConfirmed = sentSnapshot;
    _sqPersistLastConfirmed();

    /* أزل من الطابور كل ما تأكد بنفس الـ hash */
    let removedAny = false;
    for (const key in sentSnapshot.records) {
        if (_sqPending[key] && _sqPending[key].hash === sentSnapshot.records[key].hash) {
            delete _sqPending[key];
            removedAny = true;
        }
    }
    if (removedAny) _sqPersist();
    _sqRenderUI();
}

/* ── إعادة محاولة فورية ── */
function __sq_retryNow() {
    const count = Object.keys(_sqPending).length;
    if (count === 0) {
        _sqRenderUI();
        return;
    }

    /* قبل كل شيء: إذا أي سجل في الطابور غير موجود في db (مثلاً بعد crash)، أضفه */
    if (typeof db === 'object' && db) {
        let recovered = 0;
        for (const key in _sqPending) {
            const p = _sqPending[key];
            if (!p || !p.record) continue;
            const arrKey = SQ_TYPES[p.type]?.arrayKey;
            if (!arrKey) continue;
            if (!Array.isArray(db[arrKey])) db[arrKey] = [];
            const exists = db[arrKey].some(r => r && r[SQ_TYPES[p.type].idField] === p.id);
            if (!exists) {
                db[arrKey].unshift(p.record);
                recovered++;
            }
        }
        if (recovered > 0) {
            console.log(`[SQ] استعادة ${recovered} سجل من الطابور إلى db`);
        }
    }

    if (typeof save === 'function') {
        try { save(); } catch (e) { console.error('[SQ] save() failed:', e); }
        if (typeof _flushPendingSave === 'function') {
            try { _flushPendingSave(); } catch {}
        }
    }
}

/* ── timer دوري كل 10 ثواني ── */
function _sqStartRetryTimer() {
    if (_sqRetryTimer) clearInterval(_sqRetryTimer);
    _sqRetryTimer = setInterval(() => {
        const count = Object.keys(_sqPending).length;
        if (count > 0) __sq_retryNow();
        else _sqRenderUI();
    }, 10_000);
}

/* ── حدث العودة للأونلاين ── */
window.addEventListener('online',  () => setTimeout(__sq_retryNow, 800));
window.addEventListener('focus',   () => setTimeout(__sq_retryNow, 500));
window.addEventListener('offline', () => _sqRenderUI());

/* ── قبل إغلاق الصفحة: تأكد من دفع أي حفظ معلق ── */
window.addEventListener('beforeunload', () => {
    if (typeof _flushPendingSave === 'function') {
        try { _flushPendingSave(); } catch {}
    }
});

/* ══════════════════════════════════════════════════════════════════
   الواجهة: زر عائم + قائمة منسدلة
   ══════════════════════════════════════════════════════════════════ */

function _sqRenderUI() {
    if (_sqUiRenderTimer) return;
    _sqUiRenderTimer = setTimeout(() => {
        _sqUiRenderTimer = null;
        try { _sqRenderUIImpl(); } catch (e) { console.error('[SQ] render failed:', e); }
    }, 150);
}

function _sqAgo(ts) {
    if (!ts) return '—';
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 5)     return 'الآن';
    if (s < 60)    return `${s} ثانية`;
    if (s < 3600)  return `${Math.floor(s/60)} دقيقة`;
    if (s < 86400) return `${Math.floor(s/3600)} ساعة`;
    return `${Math.floor(s/86400)} يوم`;
}

function _sqRenderUIImpl() {
    if (!document.body) return;

    /* الزر مخصّص لمدير الكول سنتر فقط — الطابور والـ retry يعملان في الخلفية للجميع */
    const _role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : null;
    if (_role !== 'cc_manager') {
        const old = document.getElementById('sqFloater');
        if (old) old.remove();
        return;
    }

    let el = document.getElementById('sqFloater');
    if (!el) {
        el = document.createElement('div');
        el.id = 'sqFloater';
        document.body.appendChild(el);
    }
    _sqEnsureStyles();
    _sqPositionAboveEmergency(el);

    const count = Object.keys(_sqPending).length;
    const isOffline = (typeof navigator !== 'undefined' && navigator && navigator.onLine === false);

    if (count === 0 && !isOffline) {
        el.classList.add('sq-synced');
        el.classList.remove('sq-pending-state', 'sq-offline-state');
        el.innerHTML = `
            <button class="sq-btn sq-ok" onclick="__sq_toggleDropdown()" title="جميع الإدخالات محفوظة على السيرفر">
                <img src="img/logo.png" alt="" onerror="this.style.display='none'">
                <span class="sq-badge sq-check">✓</span>
            </button>
        `;
        clearTimeout(_sqHideTimer);
        if (!_sqDropdownOpen) {
            _sqHideTimer = setTimeout(() => {
                const e = document.getElementById('sqFloater');
                if (e && Object.keys(_sqPending).length === 0) e.classList.add('sq-faded');
            }, 4000);
        }
        const dd = document.getElementById('sqDropdown');
        if (dd && _sqDropdownOpen) {
            dd.querySelector('.sq-dd-list').innerHTML = `<div class="sq-empty">✅ لا توجد إدخالات معلقة — كل شيء محفوظ على السيرفر.</div>`;
            dd.querySelector('.sq-dd-header-title').textContent = 'متزامن بالكامل';
        }
        return;
    }

    el.classList.remove('sq-synced', 'sq-faded');
    el.classList.add(isOffline ? 'sq-offline-state' : 'sq-pending-state');

    const headerLabel = isOffline ? 'لا يوجد اتصال' : `${count} إدخال معلق`;
    el.innerHTML = `
        <button class="sq-btn ${isOffline ? 'sq-offline' : 'sq-pending'}" onclick="__sq_toggleDropdown()" title="${headerLabel}">
            <img src="img/logo.png" alt="" onerror="this.style.display='none'">
            <span class="sq-badge sq-count">${count || '⚠'}</span>
        </button>
        <div id="sqDropdown" class="sq-dd" style="display:${_sqDropdownOpen ? 'flex' : 'none'};">
            <div class="sq-dd-header">
                <span class="sq-dd-header-title">${headerLabel}</span>
                <div class="sq-dd-actions">
                    <button onclick="__sq_retryNow()" class="sq-retry" title="إعادة محاولة فورية">⟳ إعادة محاولة</button>
                    <button onclick="__sq_toggleDropdown()" class="sq-close" title="إغلاق">✕</button>
                </div>
            </div>
            <div class="sq-dd-sub">
                ${isOffline
                    ? '⚠ الجهاز غير متصل بالإنترنت. الإدخالات محفوظة محلياً وسيتم رفعها فور عودة الاتصال.'
                    : 'الإدخالات أدناه محفوظة محلياً ولم تتأكد على السيرفر بعد. تتم إعادة المحاولة تلقائياً.'}
            </div>
            <div class="sq-dd-list">
                ${_sqRenderListItems()}
            </div>
        </div>
    `;
}

function _sqRenderListItems() {
    const entries = Object.entries(_sqPending);
    if (entries.length === 0) {
        return `<div class="sq-empty">✅ لا توجد إدخالات معلقة.</div>`;
    }
    /* ترتيب: الأحدث أولاً */
    entries.sort((a, b) => (b[1].addedTs || 0) - (a[1].addedTs || 0));
    return entries.map(([k, v]) => {
        const typeLabel = SQ_TYPES[v.type]?.labelAr || v.type;
        const summary = (v.summary || '').replace(/[<>]/g, '');
        return `
            <div class="sq-item">
                <div class="sq-row">
                    <span class="sq-type">${typeLabel}</span>
                    <span class="sq-attempts">محاولات: ${v.attempts || 1}</span>
                </div>
                <div class="sq-summary">${summary || '—'}</div>
                <div class="sq-meta">⏱ معلّق منذ ${_sqAgo(v.addedTs)}</div>
            </div>
        `;
    }).join('');
}

function __sq_toggleDropdown() {
    _sqDropdownOpen = !_sqDropdownOpen;
    const fl = document.getElementById('sqFloater');
    if (fl) fl.classList.remove('sq-faded');
    _sqRenderUIImpl();
}

/* ── يتموضع فوق زر التنبيه الطارئ #_emFloatBtn إن وُجد، وإلا في موضع آمن ── */
function _sqPositionAboveEmergency(el) {
    if (!el) return;
    const em = document.getElementById('_emFloatBtn');
    let bottomPx;
    let leftPx = 18;
    if (em) {
        const rect = em.getBoundingClientRect();
        const emBottomFromViewport = window.innerHeight - rect.bottom;
        const emHeight = rect.height || 46;
        const gap = 14;
        bottomPx = emBottomFromViewport + emHeight + gap;
        leftPx = Math.max(8, rect.left - 5);
    } else {
        /* fallback: فوق المساحة المعتادة لزر الطارئ (super admin أعلى) */
        const isSA = (typeof currentUser !== 'undefined' && currentUser && currentUser.isAdmin);
        bottomPx = isSA ? 244 : 132;
    }
    el.style.bottom = bottomPx + 'px';
    el.style.left   = leftPx + 'px';
}

/* أعِد التموضع عند تغيّر حجم النافذة (قد يتغيّر موقع زر الطارئ) */
window.addEventListener('resize', () => {
    const fl = document.getElementById('sqFloater');
    if (fl) _sqPositionAboveEmergency(fl);
});

function _sqEnsureStyles() {
    if (document.getElementById('sqStyles')) return;
    const s = document.createElement('style');
    s.id = 'sqStyles';
    s.textContent = `
        #sqFloater {
            position: fixed; bottom: 132px; left: 18px; z-index: 9999;
            font-family: 'Cairo', sans-serif; direction: rtl;
            transition: opacity 0.5s ease, transform 0.5s ease, bottom 0.3s ease;
        }
        #sqFloater.sq-faded { opacity: 0.25; }
        #sqFloater.sq-faded:hover { opacity: 1; }
        .sq-btn {
            width: 56px; height: 56px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.6); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            position: relative; padding: 0;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            transition: transform 0.2s ease;
        }
        .sq-btn:hover { transform: scale(1.08); }
        .sq-btn img { width: 38px; height: 38px; object-fit: contain; border-radius: 50%; }
        .sq-ok {
            background: radial-gradient(circle at 30% 30%, #4caf50, #1b5e20);
            border-color: #81c784;
        }
        .sq-pending {
            background: radial-gradient(circle at 30% 30%, #e53935, #8e0000);
            border-color: #ef5350;
            animation: sqPulse 1.4s infinite;
        }
        .sq-offline {
            background: radial-gradient(circle at 30% 30%, #fb8c00, #b22a00);
            border-color: #ffb74d;
            animation: sqPulse 1.4s infinite;
        }
        @keyframes sqPulse {
            0%,100% { box-shadow: 0 4px 16px rgba(229,57,53,0.6), 0 0 0 0 rgba(239,83,80,0.7); }
            50%     { box-shadow: 0 4px 16px rgba(229,57,53,0.9), 0 0 0 14px rgba(239,83,80,0); }
        }
        .sq-badge {
            position: absolute; top: -5px; left: -5px;
            min-width: 22px; height: 22px;
            padding: 0 6px; border-radius: 11px;
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 800;
            background: #fff; border: 2px solid;
        }
        .sq-check { color: #2e7d32; border-color: #2e7d32; font-size: 14px; }
        .sq-count { color: #c62828; border-color: #c62828; }
        .sq-offline-state .sq-count { color: #b22a00; border-color: #b22a00; }

        .sq-dd {
            position: absolute; bottom: 70px; left: 0;
            background: #1a1a1a; color: #fff;
            border: 1px solid #444; border-radius: 14px;
            min-width: 340px; max-width: 400px;
            max-height: 460px; overflow: hidden;
            box-shadow: 0 12px 32px rgba(0,0,0,0.6);
            display: flex; flex-direction: column;
            font-family: 'Cairo', sans-serif;
        }
        .sq-dd-header {
            padding: 12px 14px;
            background: linear-gradient(135deg, #c62828, #6e0000);
            font-weight: 800; font-size: 14px;
            display: flex; justify-content: space-between; align-items: center;
            gap: 8px;
        }
        .sq-pending-state ~ .sq-dd .sq-dd-header,
        .sq-pending-state .sq-dd-header,
        #sqFloater.sq-pending-state #sqDropdown .sq-dd-header {
            background: linear-gradient(135deg, #c62828, #6e0000);
        }
        #sqFloater.sq-offline-state #sqDropdown .sq-dd-header {
            background: linear-gradient(135deg, #fb8c00, #6e2a00);
        }
        #sqFloater.sq-synced #sqDropdown .sq-dd-header {
            background: linear-gradient(135deg, #2e7d32, #1b5e20);
        }
        .sq-dd-actions { display: flex; gap: 6px; }
        .sq-retry, .sq-close {
            background: rgba(255,255,255,0.18); color: #fff;
            border: 1px solid rgba(255,255,255,0.4); border-radius: 6px;
            padding: 4px 10px; cursor: pointer;
            font-family: 'Cairo'; font-size: 11px; font-weight: 700;
        }
        .sq-retry:hover, .sq-close:hover { background: rgba(255,255,255,0.32); }
        .sq-close { padding: 4px 8px; }
        .sq-dd-sub {
            padding: 8px 14px; font-size: 11px; color: #ccc;
            background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08);
            line-height: 1.6;
        }
        .sq-dd-list { overflow-y: auto; padding: 6px 8px 10px; flex: 1; }
        .sq-item {
            padding: 9px 11px; margin: 5px 0;
            background: rgba(255,255,255,0.06);
            border-right: 3px solid #ef5350;
            border-radius: 7px;
        }
        .sq-row { display: flex; justify-content: space-between; align-items: center; }
        .sq-type     { font-size: 11px; color: #ef9a9a; font-weight: 800; }
        .sq-attempts { font-size: 10px; color: #999; }
        .sq-summary  { font-size: 13px; margin: 4px 0 3px; color: #fff; }
        .sq-meta     { font-size: 10px; color: #888; }
        .sq-empty {
            padding: 18px; text-align: center;
            color: #aaa; font-size: 13px;
        }
    `;
    document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════════
   التهيئة
   ══════════════════════════════════════════════════════════════════ */

function __sq_init() {
    _sqLoad();

    /* عند فتح الصفحة: لو فيه طابور، حاول استعادتها بعد تحميل البيانات */
    setTimeout(() => {
        const count = Object.keys(_sqPending).length;
        if (count > 0) {
            console.log(`[SQ] ${count} إدخال معلق من جلسة سابقة — جاري إعادة الإرسال`);
            __sq_retryNow();
        }
        _sqRenderUI();
    }, 3000);

    _sqStartRetryTimer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __sq_init);
} else {
    __sq_init();
}
