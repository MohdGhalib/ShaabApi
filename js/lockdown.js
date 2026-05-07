/* ══════════════════════════════════════════════════════
   System Lockdown
   - يقفل النظام عند رصد فقدان كامل للبيانات
   - يمنع الدخول والاستعراض ما عدا للسوبر أدمن (كلمة مرور: 0785110515)
   - علم القفل مخزّن في localStorage + IndexedDB لمقاومة العبث
   ══════════════════════════════════════════════════════ */

const _LK_STORE_KEY       = 'Shaab_SystemLockdown';
const _LK_SESSION_KEY     = 'Shaab_SuperAdminSession';
const _LK_IDB_NAME        = 'Shaab_Lockdown_DB';
const _LK_IDB_KEY         = 'lockdown';
const _LK_SUPER_ADMIN_PWD = '0785110515';
const _LK_PHONE           = '0785110515';
const _LK_CONTACT_NAME    = 'محمد غالب';

let _lkWatchdogTimer = null;

/* ── Storage layer 1: localStorage ── */
function _lkReadLS() {
    try { return JSON.parse(localStorage.getItem(_LK_STORE_KEY) || 'null'); }
    catch { return null; }
}
function _lkWriteLS(payload) {
    try { localStorage.setItem(_LK_STORE_KEY, JSON.stringify(payload)); return true; }
    catch { return false; }
}
function _lkClearLS() {
    try { localStorage.removeItem(_LK_STORE_KEY); } catch {}
}

/* ── Storage layer 2: IndexedDB (يقاوم مسح localStorage) ── */
function _lkOpenIdb() {
    return new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(_LK_IDB_NAME, 1);
            req.onupgradeneeded = (e) => { try { e.target.result.createObjectStore('flag'); } catch {} };
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        } catch (e) { reject(e); }
    });
}
async function _lkReadIdb() {
    try {
        const db = await _lkOpenIdb();
        return await new Promise((resolve) => {
            try {
                const tx  = db.transaction('flag','readonly');
                const req = tx.objectStore('flag').get(_LK_IDB_KEY);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror   = () => resolve(null);
            } catch { resolve(null); }
        });
    } catch { return null; }
}
async function _lkWriteIdb(payload) {
    try {
        const db = await _lkOpenIdb();
        await new Promise((resolve) => {
            try {
                const tx = db.transaction('flag','readwrite');
                tx.objectStore('flag').put(payload, _LK_IDB_KEY);
                tx.oncomplete = resolve;
                tx.onerror    = resolve;
            } catch { resolve(); }
        });
        return true;
    } catch { return false; }
}
async function _lkClearIdb() {
    try {
        const db = await _lkOpenIdb();
        await new Promise((resolve) => {
            try {
                const tx = db.transaction('flag','readwrite');
                tx.objectStore('flag').delete(_LK_IDB_KEY);
                tx.oncomplete = resolve;
                tx.onerror    = resolve;
            } catch { resolve(); }
        });
    } catch {}
}

/* ── Public: state ── */
function isSystemLocked() {
    const ls = _lkReadLS();
    return !!(ls && ls.locked);
}

async function isSystemLockedAsync() {
    const ls = _lkReadLS();
    if (ls && ls.locked) return true;
    const idb = await _lkReadIdb();
    if (idb && idb.locked) {
        // أعد كتابة LS من IDB إن كان LS محذوفاً (مقاومة للعبث)
        _lkWriteLS(idb);
        return true;
    }
    return false;
}

function getLockdownReason() {
    const ls = _lkReadLS();
    return (ls && ls.reason) || 'فقدان البيانات';
}

function getLockdownTs() {
    const ls = _lkReadLS();
    return (ls && ls.ts) || 0;
}

/* ── Public: trigger / clear ── */
async function triggerSystemLockdown(reason, isManual) {
    if (isSystemLocked()) return; // already locked
    const payload = {
        locked: true,
        reason: reason || 'فقدان البيانات',
        manual: !!isManual,
        ts:     Date.now(),
        iso:    new Date().toISOString()
    };
    _lkWriteLS(payload);
    _lkWriteIdb(payload).catch(()=>{});
    console.warn('[lockdown] 🔒 SYSTEM LOCKED — reason:', payload.reason);
    try {
        if (typeof IS_LOCAL !== 'undefined' && !IS_LOCAL && typeof _push === 'function') {
            _push('Shaab_SystemLockdown', JSON.stringify(payload));
        }
    } catch {}
    if (typeof _logAudit === 'function') {
        try { _logAudit('lockdown_triggered', '—', payload.reason); if (typeof save === 'function') save(); } catch {}
    }
    // إن كان السوبر أدمن نشط بهذه الجلسة، لا تظهر شاشة القفل
    if (!_lkIsSuperAdminSession()) {
        _lkShowOverlay();
        _lkStartWatchdog();
    } else {
        _lkInjectUnlockButton();
    }
}

async function clearSystemLockdown() {
    if (!_lkIsSuperAdminSession()) {
        alert('فقط السوبر أدمن يقدر يفك قفل النظام');
        return false;
    }
    _lkClearLS();
    await _lkClearIdb();
    try {
        if (typeof IS_LOCAL !== 'undefined' && !IS_LOCAL && typeof _push === 'function') {
            _push('Shaab_SystemLockdown', '');
        }
    } catch {}
    _lkStopWatchdog();
    _lkHideOverlay();
    if (typeof _logAudit === 'function') {
        try { _logAudit('lockdown_cleared', '—', 'سوبر أدمن'); if (typeof save === 'function') save(); } catch {}
    }
    const btn = document.getElementById('_lkUnlockBtn');
    if (btn) btn.remove();
    alert('✓ تم إلغاء قفل النظام بنجاح');
    return true;
}

/* ── Super admin session (sessionStorage فقط — يتلاشى بإغلاق التبويب) ── */
function _lkIsSuperAdminSession() {
    try { return sessionStorage.getItem(_LK_SESSION_KEY) === '1'; }
    catch { return false; }
}
function _lkSetSuperAdminSession() {
    try { sessionStorage.setItem(_LK_SESSION_KEY, '1'); } catch {}
}

/* ── HTML escape helper ── */
function _lkEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Overlay UI (غير قابل للإغلاق) ── */
function _lkBuildOverlay() {
    const exist = document.getElementById('_lkOverlay');
    if (exist) return exist;
    const ls       = _lkReadLS();
    const isManual = !!(ls && ls.manual);
    const reason   = (ls && ls.reason) || 'فقدان البيانات';

    const title = isManual
        ? 'النظام في وضع الإغلاق'
        : 'تم رصد فقدان كامل للبيانات';
    const introHtml = isManual
        ? `<p style="font-size:15px;color:#e2e8f0;line-height:1.7;margin:0 0 12px 0;">رسالة من المسؤول:</p>
           <div style="background:rgba(220,38,38,0.12);border-right:4px solid #dc2626;
                       padding:14px 16px;border-radius:8px;margin:0 0 20px 0;
                       text-align:right;font-size:15px;color:#fef2f2;line-height:1.7;
                       white-space:pre-wrap;word-break:break-word;">${_lkEsc(reason)}</div>
           <p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0 0 20px 0;">للاستفسار، الرجاء التواصل مع:</p>`
        : `<p style="font-size:15px;color:#e2e8f0;line-height:1.7;margin:0 0 20px 0;">
                النظام مقفل لحماية بياناتك ومنع إدخال أي معلومات جديدة.
                <br>للمساعدة، الرجاء التواصل مع:
           </p>`;
    const footerHtml = isManual
        ? `<div style="margin-top:16px;font-size:11px;color:#64748b;">قفل يدوي من المسؤول</div>`
        : `<div style="margin-top:16px;font-size:11px;color:#64748b;">السبب: ${_lkEsc(reason)}</div>`;

    const o = document.createElement('div');
    o.id = '_lkOverlay';
    o.setAttribute('role','dialog');
    o.setAttribute('aria-modal','true');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;' +
        'background:rgba(15,23,42,0.96);backdrop-filter:blur(8px);' +
        'display:flex;align-items:center;justify-content:center;' +
        "font-family:'Cairo',sans-serif;direction:rtl;";
    o.innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #dc2626;
                    border-radius:18px;padding:36px 32px;max-width:560px;width:92%;
                    box-shadow:0 20px 60px rgba(0,0,0,0.7);color:#fff;text-align:center;">
            <div style="font-size:64px;margin-bottom:8px;">🔒</div>
            <h2 style="font-size:24px;font-weight:800;color:#fca5a5;margin:0 0 12px 0;">
                ${_lkEsc(title)}
            </h2>
            ${introHtml}
            <div style="background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.4);
                        border-radius:12px;padding:16px;margin:0 0 24px 0;">
                <div style="font-size:14px;color:#fca5a5;margin-bottom:6px;">${_LK_CONTACT_NAME}</div>
                <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:1px;direction:ltr;">
                    ${_LK_PHONE}
                </div>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;">
                <div style="font-size:13px;color:#94a3b8;margin-bottom:10px;">
                    دخول السوبر أدمن:
                </div>
                <input id="_lkPwd" type="password" placeholder="كلمة المرور" autocomplete="off"
                       style="width:100%;box-sizing:border-box;padding:12px 14px;
                              border:1px solid rgba(255,255,255,0.2);border-radius:10px;
                              background:rgba(255,255,255,0.05);color:#fff;
                              font-family:'Cairo';font-size:15px;text-align:center;outline:none;">
                <div id="_lkErr" style="color:#fca5a5;font-size:13px;min-height:18px;margin-top:8px;"></div>
                <button id="_lkBtn" style="width:100%;margin-top:8px;padding:12px;
                                            background:linear-gradient(135deg,#dc2626,#991b1b);
                                            color:#fff;border:none;border-radius:10px;
                                            font-family:'Cairo';font-weight:700;font-size:15px;
                                            cursor:pointer;">
                    دخول
                </button>
            </div>
            ${footerHtml}
        </div>
    `;
    document.body.appendChild(o);
    document.getElementById('_lkBtn').onclick = _lkTryUnlock;
    document.getElementById('_lkPwd').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _lkTryUnlock();
    });
    return o;
}

function _lkTryUnlock() {
    const pwdEl = document.getElementById('_lkPwd');
    const errEl = document.getElementById('_lkErr');
    const pwd = pwdEl ? pwdEl.value : '';
    if (pwd === _LK_SUPER_ADMIN_PWD) {
        _lkSetSuperAdminSession();
        // سجّل دخول مباشر كسوبر أدمن — لا حاجة لمصادقة إضافية
        if (typeof window.currentUser === 'undefined' || !window.currentUser) {
            window.currentUser = {
                name:    'سوبر أدمن',
                title:   'سوبر أدمن',
                empId:   'super-admin',
                isAdmin: true,
                role:    'admin'
            };
            const loginPage = document.getElementById('loginPage');
            const mainApp   = document.getElementById('mainApp');
            if (loginPage) loginPage.style.display = 'none';
            if (mainApp)   mainApp.style.display   = 'flex';
            try { if (typeof setProfileUI === 'function') setProfileUI(); } catch {}
            try { if (typeof recordLogin === 'function') recordLogin(); } catch {}
            try { if (typeof init === 'function') init(); } catch {}
            try { if (typeof initSessionWatcher === 'function') initSessionWatcher(); } catch {}
            try { if (typeof initClock === 'function') initClock(); } catch {}
        }
        _lkHideOverlay();
        _lkStopWatchdog();
        _lkInjectUnlockButton();
    } else {
        if (errEl) errEl.textContent = 'كلمة مرور خاطئة';
        if (pwdEl) { pwdEl.value = ''; pwdEl.focus(); }
    }
}

function _lkShowOverlay() {
    const o = _lkBuildOverlay();
    o.style.display = 'flex';
    setTimeout(() => { const inp = document.getElementById('_lkPwd'); if (inp) inp.focus(); }, 100);
}
function _lkHideOverlay() {
    const o = document.getElementById('_lkOverlay');
    if (o) o.remove();
}

/* ── Watchdog: يعيد إظهار الـ overlay لو حذفه أحدهم من DevTools ── */
function _lkStartWatchdog() {
    if (_lkWatchdogTimer) return;
    _lkWatchdogTimer = setInterval(() => {
        if (isSystemLocked() && !_lkIsSuperAdminSession()) {
            const o = document.getElementById('_lkOverlay');
            if (!o) _lkShowOverlay();
        }
    }, 1500);
}
function _lkStopWatchdog() {
    if (_lkWatchdogTimer) { clearInterval(_lkWatchdogTimer); _lkWatchdogTimer = null; }
}

/* ── زر فك القفل (للسوبر أدمن فقط بعد الدخول) ── */
function _lkInjectUnlockButton() {
    // أزل زر القفل اليدوي إن كان موجوداً
    const lb = document.getElementById('_lkLockBtn'); if (lb) lb.remove();
    if (document.getElementById('_lkUnlockBtn')) return;
    const btn = document.createElement('button');
    btn.id = '_lkUnlockBtn';
    btn.innerHTML = '🔓 إلغاء قفل النظام';
    btn.title = 'النظام مقفل — اضغط بعد التأكد من استعادة البيانات أو لإنهاء الصيانة';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;' +
        'padding:12px 18px;background:linear-gradient(135deg,#16a34a,#15803d);' +
        'color:#fff;border:none;border-radius:12px;' +
        "font-family:'Cairo';font-weight:700;font-size:14px;" +
        'cursor:pointer;box-shadow:0 8px 20px rgba(22,163,74,0.4);';
    btn.onclick = () => {
        const msg = '⚠️ هل أنت متأكد من إلغاء قفل النظام؟\n\n' +
                    'بعد فك القفل سيتمكن جميع المستخدمين من الدخول وإدخال البيانات.';
        if (!confirm(msg)) return;
        clearSystemLockdown();
    };
    document.body.appendChild(btn);
}

/* ── زر القفل اليدوي (للسوبر أدمن، لما النظام مفتوح) ── */
function _lkInjectLockButton() {
    if (document.getElementById('_lkLockBtn')) return;
    if (isSystemLocked()) return;
    if (!_lkIsSuperAdminSession()) return;
    const btn = document.createElement('button');
    btn.id = '_lkLockBtn';
    btn.innerHTML = '🔒 قفل النظام يدوياً';
    btn.title = 'قفل النظام لجميع المستخدمين مع رسالة مخصّصة';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;' +
        'padding:12px 18px;background:linear-gradient(135deg,#dc2626,#991b1b);' +
        'color:#fff;border:none;border-radius:12px;' +
        "font-family:'Cairo';font-weight:700;font-size:14px;" +
        'cursor:pointer;box-shadow:0 8px 20px rgba(220,38,38,0.4);';
    btn.onclick = _lkPromptManualLock;
    document.body.appendChild(btn);
}

async function _lkPromptManualLock() {
    const msg = prompt(
        '🔒 قفل النظام يدوياً\n\n' +
        'اكتب الرسالة التي ستظهر للمستخدمين:\n' +
        '(سطور متعددة مدعومة)\n\n' +
        'بعد التأكيد سيُمنع جميع المستخدمين من الدخول والتصفح.',
        'النظام في صيانة مجدولة — يرجى المحاولة لاحقاً'
    );
    if (msg === null) return; // الغى المستخدم
    const trimmed = (msg || '').trim();
    if (!trimmed) { alert('الرجاء كتابة رسالة للمستخدمين'); return; }
    const ok = confirm(
        '⚠️ هل أنت متأكد من قفل النظام الآن؟\n\n' +
        'الرسالة التي ستظهر للمستخدمين:\n' +
        '─────────────────\n' +
        trimmed + '\n' +
        '─────────────────\n\n' +
        'سيُمنع جميع المستخدمين من الدخول والتصفح فوراً.\n' +
        'لإلغاء القفل لاحقاً استخدم زر "إلغاء قفل النظام".'
    );
    if (!ok) return;
    await triggerSystemLockdown(trimmed, true);
    // أزل زر القفل اليدوي وأظهر زر فك القفل
    const lb = document.getElementById('_lkLockBtn'); if (lb) lb.remove();
    _lkInjectUnlockButton();
}

/* ── Boot: فحص القفل عند تحميل الصفحة ── */
async function _lkBoot() {
    try {
        const locked = await isSystemLockedAsync();
        const isSA   = _lkIsSuperAdminSession();
        if (locked) {
            if (isSA) {
                // السوبر أدمن سبق دخل — لا تظهر شاشة القفل، أظهر زر الفك
                _lkInjectUnlockButton();
            } else {
                _lkShowOverlay();
                _lkStartWatchdog();
            }
        }
        // ملاحظة: زر القفل اليدوي يُحقَن بعد دخول السوبر أدمن من auth.js مباشرة
    } catch (e) { console.warn('[lockdown] boot failed:', e); }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _lkBoot);
} else {
    _lkBoot();
}

// تعرّض API للنطاق العام
window.isSystemLocked         = isSystemLocked;
window.isSystemLockedAsync    = isSystemLockedAsync;
window.triggerSystemLockdown  = triggerSystemLockdown;
window.clearSystemLockdown    = clearSystemLockdown;
window.getLockdownReason      = getLockdownReason;
window._lkSetSuperAdminSession = _lkSetSuperAdminSession;
window._lkIsSuperAdminSession  = _lkIsSuperAdminSession;
window._lkInjectUnlockButton   = _lkInjectUnlockButton;
window._lkInjectLockButton     = _lkInjectLockButton;
window._LK_SUPER_ADMIN_PWD     = _LK_SUPER_ADMIN_PWD;
