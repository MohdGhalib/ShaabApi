/* ══════════════════════════════════════════════════════════════════
   CALLER-ID — صندوق منبثق برقم المتصل (Panasonic KX-NS500 CTI)
   ══════════════════════════════════════════════════════════════════
   - برنامج الجسر يستدعي POST /api/cti/incoming-call → يُبَثّ حدث SSE 'incoming-call'
   - data.js يمرّر الحدث إلى window._onIncomingCall (مُسجَّل أدناه)
   - رقم معروف (دفتر الهاتف أو سجلّات الزبون) → يعرض البيانات + زر تعديل
   - رقم جديد → يعرض خانات الحفظ فقط
   - متاح فقط لـ cc_manager / cc_employee / admin
   - زر «📞 محاكاة اتصال» (لنفس الطاقم) لاختبار المسار كاملاً قبل وصل المقسم */

function _cidAuthorized() {
    const role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : null;
    const admin = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.isAdmin : false;
    return admin || role === 'cc_manager' || role === 'cc_employee';
}

function _cidNorm(p) {
    if (typeof _c360NormalizePhone === 'function') return _c360NormalizePhone(p);
    return String(p || '').replace(/[\s\-+()]/g, '').replace(/^0+/, '');
}

function _cidEsc(t) {
    return String(t || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* تحويلة الموظف الحالي (إن خُصِّصت في صفحة الموظفين) */
function _cidMyExtension() {
    try {
        const me = (employees || []).find(e => e.empId === currentUser?.empId);
        return me?.extension ? String(me.extension).trim() : '';
    } catch { return ''; }
}

/* اسم الزبون المستنتَج من السجلّات الموجودة (منتسيات/استفسارات/شكاوى) */
function _cidHistoryName(norm) {
    if (!norm || typeof db !== 'object' || !db) return '';
    const match = (p) => { const np = _cidNorm(p); return np && (np.includes(norm) || norm.includes(np)); };
    const m = (db.montasiat || []).find(x => !x.deleted && match(x.reservedFor?.phone) && x.reservedFor?.name);
    if (m) return m.reservedFor.name;
    const i = (db.inquiries || []).find(x => !x.deleted && match(x.phone) && (x.name || x.customerName));
    if (i) return i.name || i.customerName;
    const c = (db.complaints || []).find(x => !x.deleted && match(x.customer?.phone) && x.customer?.name);
    if (c) return c.customer.name;
    return '';
}

/* جلب جهة الاتصال من السيرفر (أحدث نسخة) — يعيد كائناً أو null */
async function _cidFetchContact(norm) {
    if (!norm || IS_LOCAL || !_token) return null;
    try {
        const r = await fetch('api/contacts/' + encodeURIComponent(norm), {
            headers: { 'Authorization': `Bearer ${_token}` }
        });
        if (!r.ok) return null;
        return await r.json(); // null إن لم تُسجَّل
    } catch { return null; }
}

/* ── الأنماط ── */
function _cidEnsureStyles() {
    if (document.getElementById('cidStyles')) return;
    const s = document.createElement('style');
    s.id = 'cidStyles';
    s.textContent = `
        @keyframes _cidIn { from{opacity:0;transform:translateY(-30px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes _cidRing { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-14deg)} 40%{transform:rotate(14deg)} 60%{transform:rotate(-8deg)} 80%{transform:rotate(8deg)} }
        #_cidOverlay {
            position:fixed; inset:0; z-index:999999;
            background:rgba(8,5,2,.62); backdrop-filter:blur(5px);
            display:flex; align-items:flex-start; justify-content:center;
            padding-top:54px; direction:rtl; font-family:'Cairo','Tajawal',sans-serif;
        }
        #_cidOverlay.hidden { display:none; }
        #_cidBox {
            background:linear-gradient(160deg,#1c1206 0%,#0e0a04 100%);
            border:1px solid rgba(193,124,50,.5); border-radius:22px;
            padding:24px 24px 20px; max-width:440px; width:94%;
            box-shadow:0 12px 50px rgba(0,0,0,.6),0 0 0 1px rgba(193,124,50,.15);
            animation:_cidIn .32s cubic-bezier(.22,1,.36,1); color:#eee;
        }
        #_cidBox .cid-top { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        #_cidBox .cid-ring { font-size:34px; animation:_cidRing 1s ease-in-out infinite; }
        #_cidBox .cid-head { flex:1; }
        #_cidBox .cid-label { font-size:12px; color:#c1843a; font-weight:700; letter-spacing:.5px; }
        #_cidBox .cid-phone { font-size:26px; font-weight:800; color:#fff; direction:ltr; text-align:right; unicode-bidi:plaintext; }
        #_cidBox .cid-x {
            background:rgba(255,255,255,.07); border:none; color:#bbb; cursor:pointer;
            width:34px; height:34px; border-radius:50%; font-size:16px; line-height:1; flex:none;
        }
        #_cidBox .cid-x:hover { background:rgba(255,255,255,.16); color:#fff; }
        #_cidBox .cid-name {
            font-size:20px; font-weight:800; margin:2px 0 6px;
        }
        #_cidBox .cid-name.known { color:#7bd88f; }
        #_cidBox .cid-name.newc  { color:#ffb74d; }
        #_cidBox .cid-pills { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        #_cidBox .cid-pill {
            background:rgba(193,124,50,.13); border:1px solid rgba(193,124,50,.28);
            border-radius:20px; padding:4px 11px; font-size:12px; color:#e8c79a;
        }
        #_cidBox .cid-card {
            background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
            border-radius:14px; padding:14px 16px; margin-bottom:14px; font-size:14px; line-height:1.9;
        }
        #_cidBox .cid-card .row { display:flex; gap:8px; }
        #_cidBox .cid-card .k { color:#999; min-width:64px; }
        #_cidBox .cid-card .v { color:#fff; font-weight:600; flex:1; }
        #_cidBox label { display:block; font-size:12px; color:#bbb; margin:10px 0 4px; }
        #_cidBox input, #_cidBox textarea {
            width:100%; box-sizing:border-box; background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.14); border-radius:10px;
            padding:9px 11px; color:#fff; font-family:inherit; font-size:14px;
        }
        #_cidBox textarea { resize:vertical; min-height:54px; }
        #_cidBox input:focus, #_cidBox textarea:focus { outline:none; border-color:#c17c32; }
        #_cidBox .cid-btns { display:flex; gap:9px; margin-top:16px; flex-wrap:wrap; }
        #_cidBox .cid-btn {
            flex:1; min-width:120px; border:none; border-radius:11px; padding:11px 14px;
            font-family:inherit; font-size:14px; font-weight:700; cursor:pointer;
        }
        #_cidBox .cid-btn.primary { background:linear-gradient(135deg,#1f8b3c,#2e7d32); color:#fff; }
        #_cidBox .cid-btn.amber   { background:linear-gradient(135deg,#c17c32,#a8631d); color:#fff; }
        #_cidBox .cid-btn.ghost   { background:rgba(255,255,255,.07); color:#ddd; flex:none; min-width:0; padding:11px 16px; }
        #_cidBox .cid-btn:active { transform:scale(.97); }
        #_cidSimBtn {
            position:fixed; bottom:18px; inset-inline-start:18px; z-index:99990;
            background:rgba(193,124,50,.92); color:#fff; border:none; cursor:pointer;
            border-radius:30px; padding:9px 15px; font-family:'Cairo',sans-serif;
            font-size:13px; font-weight:700; box-shadow:0 4px 16px rgba(0,0,0,.4);
        }
        #_cidSimBtn:hover { background:#c17c32; }
    `;
    document.head.appendChild(s);
}

/* ── بناء/فتح الصندوق ── */
let _cidLastShown = { norm: '', ts: 0 };

function _cidClose() {
    const el = document.getElementById('_cidOverlay');
    if (el) el.classList.add('hidden');
}

function _cidEnsureOverlay() {
    let el = document.getElementById('_cidOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = '_cidOverlay';
    el.className = 'hidden';
    el.innerHTML = `<div id="_cidBox" onclick="event.stopPropagation()"></div>`;
    el.addEventListener('click', e => { if (e.target === el) _cidClose(); });
    document.body.appendChild(el);
    return el;
}

/* عرض الصندوق لرقم وارد. mode: 'view' (معروف) أو 'edit'/'new' (نموذج) */
function _cidRender(state) {
    const { phone, norm, contact, histName, editing } = state;
    const box = document.getElementById('_cidBox');
    const known = !!(contact && contact.name) || !!histName;
    const displayName = (contact && contact.name) || histName || '';

    const cnt = (typeof _c360ContactCount === 'function') ? _c360ContactCount(phone) : 0;
    const pills = `
        <div class="cid-pills">
            <span class="cid-pill">📇 ${known ? 'زبون معروف' : 'رقم جديد'}</span>
            <span class="cid-pill">🗂️ ${cnt} تعامل سابق</span>
            ${contact && contact.updatedBy ? `<span class="cid-pill">✍️ ${_cidEsc(contact.updatedBy)}</span>` : ''}
        </div>`;

    const head = `
        <div class="cid-top">
            <div class="cid-ring">📞</div>
            <div class="cid-head">
                <div class="cid-label">مكالمة واردة</div>
                <div class="cid-phone">${_cidEsc(phone || norm)}</div>
            </div>
            <button class="cid-x" onclick="closeCallerId()" aria-label="إغلاق">✕</button>
        </div>`;

    let body;
    if (!editing) {
        // عرض: معروف → بيانات + تعديل / جديد → نموذج حفظ مباشر
        if (known) {
            const c = contact || {};
            const line = (k, v) => v ? `<div class="row"><span class="k">${k}</span><span class="v">${_cidEsc(v)}</span></div>` : '';
            body = `
                <div class="cid-name known">👤 ${_cidEsc(displayName)}</div>
                ${pills}
                <div class="cid-card">
                    ${line('الاسم', c.name || displayName)}
                    ${line('المدينة', c.city)}
                    ${line('العنوان', c.address)}
                    ${line('ملاحظات', c.notes)}
                    ${(!c.name && histName) ? `<div class="row"><span class="k">المصدر</span><span class="v">من سجلّات الزبون</span></div>` : ''}
                </div>
                <div class="cid-btns">
                    <button class="cid-btn primary" onclick="_cidEdit()">✏️ تعديل البيانات</button>
                    <button class="cid-btn ghost" onclick="openCustomer360('${_cidEsc(norm)}')">📂 الملف الكامل</button>
                </div>`;
        } else {
            // رقم جديد → نموذج حفظ
            body = _cidFormHtml({ name:'', city:'', address:'', notes:'' }, displayName);
        }
    } else {
        // تعديل: نموذج معبّأ
        const c = contact || {};
        body = _cidFormHtml({
            name: c.name || displayName || '',
            city: c.city || '', address: c.address || '', notes: c.notes || ''
        }, displayName, true);
    }

    box.innerHTML = head + body;
}

function _cidFormHtml(vals, displayName, isEdit) {
    return `
        <div class="cid-name newc">${isEdit ? '✏️ تعديل بيانات الزبون' : '🆕 زبون جديد — احفظ بياناته'}</div>
        <label>اسم الزبون</label>
        <input id="_cidName" type="text" value="${_cidEsc(vals.name)}" placeholder="اكتب اسم الزبون" autocomplete="off" />
        <label>المدينة (اختياري)</label>
        <input id="_cidCity" type="text" value="${_cidEsc(vals.city)}" placeholder="المدينة" autocomplete="off" />
        <label>العنوان (اختياري)</label>
        <input id="_cidAddr" type="text" value="${_cidEsc(vals.address)}" placeholder="العنوان / أقرب نقطة دالة" autocomplete="off" />
        <label>ملاحظات (اختياري)</label>
        <textarea id="_cidNotes" placeholder="أي ملاحظات عن الزبون أو طلباته">${_cidEsc(vals.notes)}</textarea>
        <div class="cid-btns">
            <button class="cid-btn primary" onclick="_cidSave()">💾 حفظ</button>
            <button class="cid-btn ghost" onclick="closeCallerId()">إلغاء</button>
        </div>`;
}

let _cidState = null;

function _cidEdit() { _cidState.editing = true; _cidRender(_cidState); setTimeout(() => document.getElementById('_cidName')?.focus(), 40); }

async function _cidSave() {
    if (!_cidState) return;
    const name = document.getElementById('_cidName')?.value.trim() || '';
    const city = document.getElementById('_cidCity')?.value.trim() || '';
    const address = document.getElementById('_cidAddr')?.value.trim() || '';
    const notes = document.getElementById('_cidNotes')?.value.trim() || '';
    if (!name) { alert('يرجى إدخال اسم الزبون'); return; }

    const btn = document.querySelector('#_cidBox .cid-btn.primary');
    if (btn) { btn.disabled = true; btn.textContent = '... جاري الحفظ'; }

    try {
        const r = await fetch('api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
            body: JSON.stringify({ phone: _cidState.phone || _cidState.norm, name, city, address, notes })
        });
        if (!r.ok) throw new Error('save failed ' + r.status);
        const j = await r.json();
        _cidState.contact = j.contact || { phone:_cidState.norm, name, city, address, notes, updatedBy: currentUser?.name };
        _cidState.editing = false;
        _cidRender(_cidState);
    } catch (e) {
        alert('تعذّر الحفظ. تأكد من الاتصال وحاول مجدداً.');
        if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ'; }
    }
}

/* نقطة الدخول الرئيسية — يستدعيها data.js عند حدث incoming-call */
async function _onIncomingCall(info) {
    if (!_cidAuthorized()) return;
    info = info || {};
    const phone = (info.phone || '').trim();
    const norm  = info.norm || _cidNorm(phone);
    if (!norm) return;

    // ── التوجيه بالتحويلة ──
    const ext   = (info.ext || '').toString().trim();
    const myExt = _cidMyExtension();
    if (ext && myExt && ext !== myExt) return;          // المكالمة لموظف آخر
    // (لو لا تحويلة في الحدث، أو الموظف بلا تحويلة مخصّصة → يُعرض كاحتياط)

    // ── منع التكرار (إعادة بثّ خلال 8 ثوانٍ) ──
    const now = info.ts || Date.now();
    if (_cidLastShown.norm === norm && (now - _cidLastShown.ts) < 8000) return;
    _cidLastShown = { norm, ts: now };

    _cidEnsureStyles();
    _cidEnsureOverlay();

    if (typeof _playSound === 'function') { try { _playSound(); } catch {} }

    const histName = _cidHistoryName(norm);
    _cidState = { phone, norm, contact: null, histName, editing: false };
    // اعرض فوراً (بالسجلّات)، ثم حدّث ببيانات دفتر الهاتف من السيرفر
    _cidRender(_cidState);
    document.getElementById('_cidOverlay').classList.remove('hidden');

    const contact = await _cidFetchContact(norm);
    if (contact && document.getElementById('_cidOverlay') && !document.getElementById('_cidOverlay').classList.contains('hidden')) {
        if (!_cidState.editing) { _cidState.contact = contact; _cidRender(_cidState); }
        else { _cidState.contact = contact; }
    }
}

function closeCallerId() { _cidClose(); }

/* ── محاكاة اتصال (اختبار) ── */
async function cidSimulate() {
    if (!_cidAuthorized()) return;
    const phone = prompt('محاكاة مكالمة واردة — أدخل رقم الهاتف:');
    if (phone === null) return;
    const ext = _cidMyExtension(); // محاكاة على تحويلتي إن وُجدت
    try {
        await fetch('api/cti/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
            body: JSON.stringify({ phone, ext })
        });
        // الصندوق سيظهر تلقائياً عبر حدث SSE incoming-call
    } catch { alert('تعذّرت المحاكاة — تأكد من الاتصال بالسيرفر'); }
}

function _cidMountSimButton() {
    if (document.getElementById('_cidSimBtn')) return;
    if (!_cidAuthorized() || IS_LOCAL) return;
    _cidEnsureStyles();
    const b = document.createElement('button');
    b.id = '_cidSimBtn';
    b.type = 'button';
    b.textContent = '📞 محاكاة اتصال';
    b.title = 'اختبار صندوق رقم المتصل (قبل وصل المقسم)';
    b.onclick = cidSimulate;
    document.body.appendChild(b);
}

/* ── تسجيل عالمي + إقلاع ── */
if (typeof window !== 'undefined') {
    window._onIncomingCall = _onIncomingCall;
    window.closeCallerId   = closeCallerId;
    window.cidSimulate     = cidSimulate;
    window._cidEdit        = _cidEdit;
    window._cidSave        = _cidSave;
    window._cidMountSimButton = _cidMountSimButton;

    window.addEventListener('keydown', e => { if (e.key === 'Escape') _cidClose(); });

    // اعرض زر المحاكاة بعد تسجيل الدخول (currentUser جاهز)
    const _cidBoot = () => { try { _cidMountSimButton(); } catch {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_cidBoot, 1500));
    else setTimeout(_cidBoot, 1500);
    // أعِد المحاولة دورياً حتى يتوفّر currentUser (أول دقيقة)
    let _cidTries = 0;
    const _cidIv = setInterval(() => { _cidBoot(); if (++_cidTries > 20 || document.getElementById('_cidSimBtn')) clearInterval(_cidIv); }, 3000);
}
