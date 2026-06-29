/* ══════════════════════════════════════════════════════
   AUTH — Login, logout, permissions
══════════════════════════════════════════════════════ */
async function hashPassword(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// 🔒 يتحقق من كلمة مرور السوبر أدمن دون تضمين النص الصريح في الكود:
//   • وضع السيرفر: عبر /api/sa2fa/verify-password (الخادم وحده يملك القيمة).
//   • الوضع المحلي (file://): مقارنة هاش SHA-256 فقط (للتطوير دون اتصال).
// ملاحظة: عند القفل التزاحمي (429) يعود false فيتابع المستخدم العادي تسجيل دخوله بشكل طبيعي.
// 🔒 وضع IS_LOCAL (file://) فقط — مُعطَّل في النشر على سيرفر.
// على السيرفر يُتحقّق من كلمة مرور السوبر أدمن عبر الخادم (SuperAdminPassword من البيئة)،
// فلا نُضمّن أي هاش لها في JS المرسَل للمتصفّح.
const _SA_PWD_HASH = '';
async function _isSuperAdminPassword(pass) {
    if (!pass) return false;
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) {
        try { return (await hashPassword(pass)) === _SA_PWD_HASH; } catch { return false; }
    }
    try {
        const r = await fetch('api/sa2fa/verify-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ password: pass })
        });
        if (!r.ok) return false;
        const d = await r.json();
        return !!(d && d.ok);
    } catch { return false; }
}
window._isSuperAdminPassword = _isSuperAdminPassword;

// PBKDF2 — يطابق HashPbkdf2 في السيرفر (100,000 iter, SHA-256, 32 bytes out)
async function hashPbkdf2(password, salt) {
    const enc = new TextEncoder();
    const pwKey = await crypto.subtle.importKey(
        'raw', enc.encode(password || ''),
        { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt || ''), iterations: 100000, hash: 'SHA-256' },
        pwKey, 32 * 8
    );
    const hex = Array.from(new Uint8Array(bits))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return 'pbkdf2:' + hex;
}

// تحقق موحَّد من كلمة المرور — يدعم PBKDF2 الحديث + SHA-256 القديم
async function verifyEmpPassword(password, salt, storedHash) {
    if (!storedHash) return false;
    if (storedHash.startsWith('pbkdf2:')) {
        const calc = await hashPbkdf2(password, salt || '');
        return calc === storedHash;
    }
    // SHA-256 القديم: hash(salt + password)
    const old = await hashPassword((salt || '') + password);
    return old === storedHash;
}

let _failCount  = 0;
let _lockUntil  = 0;

const PERMISSIONS = {
    // المدير الرئيسي — كامل الصلاحيات
    admin: [
        'addM','approveM','editM','deliverM','rejectM','deleteM',
        'addI','viewI',
        'addC','editC','approveC','returnC','deleteC','auditC',
        'addEmp','viewStats','viewBreak','viewLinkBadge','viewBranches',
        'viewPrices','editPrices',
        'addComp','viewComp','deleteComp'
    ],
    // مدير الكول سنتر
    cc_manager: [
        'addM','editM','deliverM','rejectM','deleteM',
        'addI','viewI',
        'addC','editC','approveC','returnC','deleteC',
        'addEmp','viewStats','viewBreak','viewLinkBadge','viewBranches',
        'viewPrices','editPrices',
        'addComp','viewComp','deleteComp'
    ],
    // موظف كول سنتر
    cc_employee: [
        'addM','deliverM',
        'addI','viewI',
        'addC',
        'viewBreak','viewLinkBadge',
        'viewPrices',
        'addComp','viewComp'
    ],
    // مسؤول قسم السيطرة — رد + إضافة موظفين خاصين
    control: [
        'addC', 'auditC', 'addControlEmp',
        'addComp','viewComp'
    ],
    // مدير قسم السيطرة (مضاف من مدير/كول سنتر) — رد كامل + اطلاع على المنتسيات
    control_employee: [
        'auditC', 'addEmp', 'viewM',
        'addComp','viewComp'
    ],
    // مدير قسم السيطرة داخلي (مضاف من مسؤول السيطرة) — رد بدون حالة ملاحظة
    control_sub: [],
    // موظف ميديا — إرسال شكاوي للسيطرة فقط بدون موافقة
    media: [
        'addC',
        'viewPrices'
    ],
    // موظف فرع — صلاحيات التطبيق فقط، لا دخول للموقع
    branch_employee: [],
    // مدير فرع — صلاحيات التطبيق فقط، لا دخول للموقع
    branch_manager: [],
    // مدير منطقة — صلاحيات التطبيق فقط، لا دخول للموقع
    area_manager: []
};

function perm(p) {
    if (!currentUser) return false;
    const r = currentUser.isAdmin ? 'admin' : (currentUser.role || 'cc_employee');
    return (PERMISSIONS[r] || []).includes(p);
}

/* 🔐 دخول السوبر أدمن مع التحقق الثنائي (TOTP) إن كان مفعّلاً على الخادم */
async function _superAdminLogin(pass, isLocked) {
    if (typeof IS_LOCAL === 'undefined' || !IS_LOCAL) {
        // 1) بوابة التحقق الثنائي (إن كانت مفعّلة)
        let st = { enabled: false };
        try { st = await fetch('api/sa2fa/status').then(r => r.json()); } catch {}
        if (st && st.enabled) {
            const verified = await _show2FAModal();   // نافذة عصرية تتولّى الإدخال + التحقق
            if (!verified) return;                     // ألغى المستخدم أو لم يُكمل
        }
        // 2) منح توكن المسؤول من الخادم (نفس صلاحيات الحساب الملغى 0785110515)
        try {
            const ar = await fetch('/api/admin/unlock', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ password: pass })
            });
            if (!ar.ok) { _showLoginError('تعذّر منح صلاحية المسؤول'); return; }
            const ad = await ar.json();
            setToken(ad.token);
            currentUser = { name:'سوبر أدمن', title:'سوبر أدمن', empId:'super-admin', isAdmin:true, role:'admin' };
        } catch { _showLoginError('خطأ في الاتصال بالسيرفر'); return; }
        // 3) حمّل بيانات الخادم بصلاحية المسؤول
        try { await loadAllData(); } catch (e) { console.error('[SA] loadAllData failed:', e); }
        if (typeof _initialLoadOk !== 'undefined' && !_initialLoadOk) {
            alert('تعذّر تحميل البيانات من الخادم — سيُعاد تحميل الصفحة.');
            location.reload(); return;
        }
    }
    _grantSuperAdmin(isLocked);
}

/* 🔐 نافذة التحقق الثنائي — تصميم «إسبريسو تحريري» (عاجي دافئ + لمسة كهرمانية + خانات OTP).
   تُرجع Promise<boolean> (تم التحقق؟). */
function _show2FAModal() {
    return new Promise((resolve) => {
        if (!document.getElementById('_v2font')) {
            const l = document.createElement('link');
            l.id = '_v2font'; l.rel = 'stylesheet';
            l.href = 'https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&display=swap';
            document.head.appendChild(l);
        }
        const overlay = document.createElement('div');
        overlay.id = '_sa2faOverlay';
        overlay.innerHTML = `
          <style>
            #_sa2faOverlay{--esp:#2a2018;--esp2:#3c2e22;--amber:#b0742f;--amber-soft:#caa36b;
              --cream:#fbf6ee;--line:rgba(96,70,44,.14);--muted:#8c7c69;
              position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;direction:rtl;
              font-family:'Cairo',sans-serif;animation:_v2fade .22s ease both;
              background:radial-gradient(120% 100% at 50% 0%, rgba(176,116,47,.16), rgba(0,0,0,0) 52%), rgba(26,18,12,.62);
              backdrop-filter:blur(7px) saturate(1.05);}
            .v2-card{position:relative;width:404px;max-width:92vw;padding:40px 34px 26px;border-radius:22px;text-align:center;
              background:linear-gradient(180deg,#fdfaf4 0%, var(--cream) 100%);border:1px solid var(--line);overflow:hidden;
              box-shadow:0 32px 80px rgba(40,26,14,.34), 0 2px 0 rgba(255,255,255,.6) inset;
              animation:_v2pop .4s cubic-bezier(.2,.9,.28,1.06) both;}
            .v2-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
              background:linear-gradient(90deg,transparent,var(--amber),transparent);opacity:.85;}
            .v2-seal{position:relative;width:66px;height:66px;margin:4px auto 20px;display:flex;align-items:center;justify-content:center;
              border-radius:50%;color:#fff;background:radial-gradient(circle at 36% 28%,#caa36b,#b0742f 60%,#8a5824);
              box-shadow:0 10px 24px rgba(176,116,47,.4), 0 0 0 1px rgba(255,255,255,.3) inset;}
            .v2-seal::after{content:'';position:absolute;inset:-9px;border-radius:50%;border:1px dashed rgba(176,116,47,.35);}
            .v2-title{margin:0 0 8px;font-family:'El Messiri','Cairo',sans-serif;font-weight:700;font-size:25px;letter-spacing:.3px;color:#2a2018;}
            .v2-sub{margin:0 0 28px;color:var(--muted);font-size:13px;line-height:1.75;}
            .v2-otp{display:flex;gap:9px;justify-content:center;direction:ltr;}
            .v2-cell{width:47px;height:58px;text-align:center;font-size:25px;font-weight:700;color:#2a2018;caret-color:var(--amber);
              font-family:ui-monospace,'SF Mono',Menlo,monospace;outline:none;border-radius:13px;
              border:1.5px solid var(--line);background:#fff;transition:.16s ease;
              animation:_v2rise .42s cubic-bezier(.2,.9,.3,1.05) both;}
            .v2-cell:focus{border-color:var(--amber);box-shadow:0 0 0 3px rgba(176,116,47,.16);transform:translateY(-2px);}
            .v2-cell.filled{border-color:var(--amber-soft);background:#fffdf8;}
            .v2-otp.err .v2-cell{border-color:#c0492f;color:#c0492f;}
            .v2-err{color:#c0492f;font-size:12.5px;min-height:18px;margin:14px 0 0;font-weight:600;}
            .v2-actions{display:flex;gap:10px;margin-top:18px;}
            .v2-btn{flex:2;padding:14px;border:none;border-radius:13px;font-family:'Cairo';font-size:15px;font-weight:800;cursor:pointer;
              color:#fdfaf4;background:linear-gradient(165deg,var(--esp2),var(--esp));letter-spacing:.3px;
              box-shadow:0 10px 22px rgba(42,32,24,.28);transition:.2s;}
            .v2-btn:hover{filter:brightness(1.12);transform:translateY(-1px);}
            .v2-btn:disabled{opacity:.55;cursor:default;transform:none;filter:none;}
            .v2-ghost{flex:1;padding:14px;border-radius:13px;border:1px solid var(--line);background:transparent;color:#6f5f4c;
              font-family:'Cairo';font-size:14px;font-weight:600;cursor:pointer;transition:.18s;}
            .v2-ghost:hover{background:rgba(176,116,47,.07);color:#2a2018;}
            .v2-foot{margin-top:22px;padding-top:15px;border-top:1px solid var(--line);
              font-size:11px;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:6px;}
            .v2-foot svg{opacity:.7;}
            @keyframes _v2fade{from{opacity:0}to{opacity:1}}
            @keyframes _v2pop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
            @keyframes _v2rise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
            @keyframes _v2shake{10%,90%{transform:translateX(-3px)}30%,70%{transform:translateX(5px)}50%{transform:translateX(-8px)}}
          </style>
          <div class="v2-card" id="_v2card">
            <div class="v2-seal">
              <svg width="29" height="29" viewBox="0 0 24 24" fill="none"><path d="M6.5 10V8a5.5 5.5 0 0111 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="4.3" y="10" width="15.4" height="10.6" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="14.6" r="1.6" fill="currentColor"/><rect x="11.2" y="15.4" width="1.6" height="3" rx=".8" fill="currentColor"/></svg>
            </div>
            <h3 class="v2-title">التحقّق بخطوتين</h3>
            <p class="v2-sub">أدخل الرمز المكوّن من 6 أرقام<br>من تطبيق Google Authenticator</p>
            <div class="v2-otp" id="_v2otp" dir="ltr">
              ${[0,1,2,3,4,5].map(i=>`<input class="v2-cell" data-i="${i}" style="animation-delay:${120+i*45}ms" type="text" inputmode="numeric" autocomplete="${i===0?'one-time-code':'off'}" maxlength="1">`).join('')}
            </div>
            <div class="v2-err" id="_v2err"></div>
            <div class="v2-actions">
              <button class="v2-ghost" id="_v2cancel">إلغاء</button>
              <button class="v2-btn"  id="_v2submit">تحقّق</button>
            </div>
            <div class="v2-foot">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6.5 10V8a5.5 5.5 0 0111 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="4.3" y="10" width="15.4" height="10.6" rx="3" stroke="currentColor" stroke-width="2" fill="none"/></svg>
              محمي بتشفير TOTP — يتغيّر الرمز كل 30 ثانية
            </div>
          </div>`;
        document.body.appendChild(overlay);

        const card  = overlay.querySelector('#_v2card');
        const otp   = overlay.querySelector('#_v2otp');
        const cells = Array.from(overlay.querySelectorAll('.v2-cell'));
        const err   = overlay.querySelector('#_v2err');
        const btn   = overlay.querySelector('#_v2submit');
        const done  = (v) => { overlay.remove(); resolve(v); };
        const code  = () => cells.map(c => c.value).join('');
        const refresh = () => cells.forEach(c => c.classList.toggle('filled', !!c.value));
        setTimeout(() => cells[0].focus(), 90);

        cells.forEach((c, i) => {
            c.addEventListener('input', () => {
                c.value = c.value.replace(/\D/g, '').slice(0, 1);
                err.textContent = ''; otp.classList.remove('err'); refresh();
                if (c.value && i < 5) cells[i + 1].focus();
                if (code().length === 6) verify();
            });
            c.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !c.value && i > 0) { cells[i - 1].focus(); cells[i - 1].value = ''; refresh(); e.preventDefault(); }
                else if (e.key === 'ArrowLeft'  && i > 0) cells[i - 1].focus();
                else if (e.key === 'ArrowRight' && i < 5) cells[i + 1].focus();
                else if (e.key === 'Enter')  verify();
                else if (e.key === 'Escape') done(false);
            });
            c.addEventListener('paste', (e) => {
                e.preventDefault();
                const d = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
                d.forEach((ch, k) => { if (cells[k]) cells[k].value = ch; });
                refresh(); (cells[Math.min(d.length, 5)] || cells[5]).focus();
                if (code().length === 6) verify();
            });
        });

        let busy = false;
        async function verify() {
            if (busy) return;
            if (code().length < 6) { err.textContent = 'الرجاء إدخال 6 أرقام'; return; }
            busy = true; btn.disabled = true; btn.textContent = 'جارٍ التحقّق…';
            let vr = { ok: false };
            try {
                vr = await fetch('api/sa2fa/verify', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ code: code() })
                }).then(r => r.json());
            } catch {}
            if (vr && vr.ok) { done(true); return; }
            err.textContent = (vr && vr.error) ? vr.error : '❌ رمز غير صحيح، حاول مجدداً';
            otp.classList.add('err'); card.style.animation = '_v2shake .42s';
            setTimeout(() => { card.style.animation = ''; }, 440);
            cells.forEach(c => c.value = ''); refresh(); cells[0].focus();
            busy = false; btn.disabled = false; btn.textContent = 'تحقّق';
        }
        btn.onclick = verify;
        overlay.querySelector('#_v2cancel').onclick = () => done(false);
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) done(false); });
    });
}

function _grantSuperAdmin(isLocked) {
    if (typeof window._lkSetSuperAdminSession === 'function') window._lkSetSuperAdminSession();
    currentUser = { name:'سوبر أدمن', title:'سوبر أدمن', empId:'super-admin', isAdmin:true, role:'admin' };
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainApp").style.display   = "flex";
    try { if (typeof setProfileUI === 'function') setProfileUI(); } catch {}
    try { if (typeof recordLogin === 'function') recordLogin(); } catch {}
    try { if (typeof init === 'function') init(); } catch {}
    try { if (typeof initSessionWatcher === 'function') initSessionWatcher(); } catch {}
    try { if (typeof initClock === 'function') initClock(); } catch {}
    try {
        if (isLocked && typeof window._lkInjectUnlockButton === 'function') window._lkInjectUnlockButton();
        else if (typeof window._lkInjectLockButton === 'function')           window._lkInjectLockButton();
    } catch {}
}

/* 🔐 تفعيل/إعادة تعيين التحقق الثنائي للسوبر أدمن — يُستدعى من زر لوحة السوبر أدمن أو الكونسول */
async function saEnable2FA() {
    const pwd = prompt('🔐 لتفعيل/إعادة تعيين التحقق الثنائي، أدخل كلمة مرور السوبر أدمن:');
    if (pwd === null) return;
    let code = '';
    try {
        const st = await fetch('api/sa2fa/status').then(r => r.json());
        if (st && st.enabled) {
            const c = prompt('التحقق الثنائي مفعّل حالياً. أدخل الرمز الحالي لإعادة التعيين:');
            if (c === null) return;
            code = String(c).trim();
        }
    } catch {}
    let res;
    try {
        res = await fetch('api/sa2fa/setup', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ password: pwd, code })
        }).then(r => r.json());
    } catch { alert('تعذّر الاتصال بالخادم'); return; }
    if (!res || !res.ok) { alert('❌ ' + (res && res.error ? res.error : 'فشل التفعيل')); return; }
    alert('✅ تم تفعيل التحقق الثنائي!\n\n' +
          'افتح Google Authenticator → ➕ → «إدخال مفتاح الإعداد» → الصق هذا المفتاح:\n\n' +
          res.secret + '\n\n' +
          '(نوع المفتاح: مبني على الوقت / Time-based — الاسم: محامص الشعب)\n\n' +
          'عند الدخول القادم سيُطلب منك الرمز المكوّن من 6 أرقام.');
    console.log('[2FA] otpauth URI (لتحويله إلى QR إن رغبت):', res.otpauth);
}
if (typeof window !== 'undefined') window.saEnable2FA = saEnable2FA;

function recordLogin() {
    if (!currentUser || currentUser.isAdmin) return;
    // إغلاق أي جلسات مفتوحة سابقاً لنفس الموظف (أُغلق المتصفح دون خروج)
    const _now = new Date().toISOString();
    sessions.forEach(s => {
        if (s.empId === currentUser.empId && !s.logoutIso) s.logoutIso = _now;
    });
    sessions.push({
        id: Date.now(),
        empId: currentUser.empId,
        empName: currentUser.name,
        loginIso: _now,
        logoutIso: null,
        lastSeen: Date.now(),  // تهيئة فورية حتى يظهر الموظف "متصل" قبل أول heartbeat tick
        date: iso()
    });
    saveSessions();
}

function recordLogout() {
    if (!currentUser || currentUser.isAdmin) return;
    const s = [...sessions].reverse().find(s => s.empId === currentUser.empId && !s.logoutIso);
    if (s) { s.logoutIso = new Date().toISOString(); saveSessions(); }
}

function doLogout() {
    if (typeof stopClock === 'function') stopClock();
    const _bellW = document.getElementById('notifBellWidget');
    if (_bellW) _bellW.style.display = 'none';
    if (typeof _logAudit === 'function') { _logAudit('logout', '—', currentUser?.name || '—'); save(); }
    recordLogout();
    setToken(null);
    // مسح توقيتات المشاهدة عند تسجيل الخروج
    try { localStorage.removeItem('_shaabLastSeen'); } catch {}
    // مسح جلسة السوبر أدمن — إذا كان مسجّل دخول كسوبر أدمن، إنهاء امتيازه عند الخروج
    // هذا يمنع ظهور زر "إلغاء قفل النظام" بعد الخروج ما لم يعد دخول السوبر أدمن
    try { sessionStorage.removeItem('Shaab_SuperAdminSession'); } catch {}
    // إزالة أزرار القفل/الفك إن وُجدت في الواجهة قبل التحديث
    try { const lb = document.getElementById('_lkLockBtn');   if (lb) lb.remove(); } catch {}
    try { const ub = document.getElementById('_lkUnlockBtn'); if (ub) ub.remove(); } catch {}
    location.reload();
}

function _showLoginError(msg) {
    const errEl   = document.getElementById('loginError');
    const loginBox = document.querySelector('.login-box');
    if (loginBox) {
        loginBox.classList.remove('shake');
        void loginBox.offsetWidth;
        loginBox.classList.add('shake');
        loginBox.addEventListener('animationend', () => loginBox.classList.remove('shake'), { once: true });
    }
    if (errEl && loginBox) {
        if (msg) errEl.textContent = msg;
        const rect = loginBox.getBoundingClientRect();
        const errH = errEl.offsetHeight || 48;
        errEl.style.top = (rect.top - errH - 10) + 'px';
        errEl.style.transform = 'translateX(-50%) translateY(-18px)';
        errEl.classList.remove('show');
        void errEl.offsetWidth;
        errEl.style.transform = 'translateX(-50%) translateY(0)';
        errEl.classList.add('show');
        clearTimeout(errEl._hideTimer);
        errEl._hideTimer = setTimeout(() => {
            errEl.style.transform = 'translateX(-50%) translateY(-18px)';
            errEl.classList.remove('show');
        }, 4000);
    }
}

async function login() {
    const pass  = document.getElementById("passInput").value;

    // ── فحص قفل النظام + كلمة مرور السوبر أدمن (تحقّق على الخادم — لا نص صريح في الكود) ──
    const _isLocked  = (typeof isSystemLocked === 'function' && isSystemLocked());
    const _isSA      = await _isSuperAdminPassword(pass);

    // إن كان النظام مقفل، فقط كلمة مرور السوبر أدمن مقبولة
    if (_isLocked && !_isSA) {
        _showLoginError('🔒 النظام مقفل — تواصل مع محمد غالب: 0785110515');
        return;
    }

    // كلمة مرور السوبر أدمن — دخول مباشر (سواء النظام مقفل أو مفتوح)
    // هذا يتيح للسوبر أدمن إدارة النظام (ومنه قفله يدوياً) في أي وقت
    if (_isSA) {
        _superAdminLogin(pass, _isLocked);   // TOTP ثم منح توكن المسؤول من الخادم
        return;
    }

    if (IS_LOCAL) {
        // ── وضع التطوير المحلي (file://) — مصادقة محلية ──
        if (Date.now() < _lockUntil) {
            _showLoginError(`محاولات كثيرة — انتظر ${Math.ceil((_lockUntil - Date.now())/1000)} ثانية`);
            return;
        }
        // تسجيل دخول المدير: الرقم الوظيفي "admin" أو فارغ + كلمة المرور الرئيسية
        const passHash = await hashPassword(pass);
        if ((!pass || pass === 'admin') && passHash === PASSWORD_HASH) {
            _failCount = 0;
            currentUser = { name:"المدير", title:"مدير النظام", empId:"admin", isAdmin:true };
        } else {
            // تسجيل دخول الموظف: البحث بالرقم الوظيفي ثم التحقق من كلمة المرور
            const candidate = employees.find(e => e.empId === pass);
            let emp = null;
            if (candidate) {
                // كلمة المرور الافتراضية = الرقم الوظيفي (لو لم يوضَع hash بعد)
                const defaultOk = !candidate.passwordHash && pass === candidate.empId;
                // التحقق المتوافق مع PBKDF2 (الجديد) + SHA-256 (القديم)
                const passOk = candidate.passwordHash
                    ? await verifyEmpPassword(pass, candidate.salt || '', candidate.passwordHash)
                    : false;
                if (passOk || defaultOk) emp = candidate;
            }
            if (!emp) {
                _failCount++;
                if (_failCount >= 5) { _lockUntil = Date.now() + 60000; _failCount = 0; }
                _showLoginError('');
                return;
            }
            _failCount = 0;
            let role = 'cc_employee';
            if (emp.title === 'مدير الكول سنتر') role = 'cc_manager';
            else if (emp.title === 'موظف كول سنتر') role = 'cc_employee';
            else if (emp.title === 'قسم السيطرة') role = 'control';
            else if (emp.title === 'موظف ميديا') role = 'media';
            else if (emp.title === 'مدير قسم السيطرة') role = 'control_employee';
            else if (emp.title === 'موظف سيطرة') role = 'control_sub';
            else if (emp.title === 'موظف فرع')   role = 'branch_employee';
            else if (emp.title === 'مدير فرع')    role = 'branch_manager';
            else if (emp.title === 'مدير منطقة')  role = 'area_manager';
            if (role === 'branch_employee' || role === 'branch_manager' || role === 'area_manager') {
                _showLoginError('هذا الحساب مخصص لتطبيق الجوال فقط');
                return;
            }
            currentUser = { ...emp, isAdmin:false, role };
        }
    } else {
        // ── وضع السيرفر — مصادقة عبر JWT ──
        try {
            const res = await fetch('/api/auth/login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ password: pass })
            });
            if (res.status === 429) {
                const d = await res.json();
                _showLoginError(d.error || 'محاولات كثيرة');
                return;
            }
            if (!res.ok) {
                // فشل تسجيل الدخول العادي. مسار السوبر أدمن يُعالَج مسبقاً (مع TOTP)،
                // فلم يعد هناك مسار unlock احتياطي يتجاوز التحقق الثنائي.
                _showLoginError('');
                return;
            } else {
            const d = await res.json();
            setToken(d.token);
            currentUser = {
                name:    d.name,
                title:   d.title,
                empId:   d.empId,
                isAdmin: d.isAdmin,
                role:    d.role
            };
            // المدير يُوجَّه تلقائياً للوحة التحكم
            if (d.isAdmin) {
                _ap.open(d.token);
                return;
            }
            }
        } catch(e) {
            _showLoginError('خطأ في الاتصال بالسيرفر');
            return;
        }
        // منع أدوار الجوال من الدخول عبر الويب
        if (['branch_employee','branch_manager','area_manager'].includes(currentUser?.role)) {
            _showLoginError('هذا الحساب مخصص لتطبيق الجوال فقط');
            setToken(null);
            currentUser = null;
            return;
        }
        // تحميل البيانات بعد الحصول على الـ token
        try { await loadAllData(); } catch(e) { console.error('[login] loadAllData failed:', e); }
        /* 🛡️ (Fix, 2026-06-07) لا تُكمل الدخول إذا فشل التحميل الأولي: الحفظ سيُحظر
           (حماية بيانات الخادم من الدهس بحالة فارغة)، والعمل بلا حفظ يضيّع تعديلات
           المستخدم. ننبّه ونُعيد المحاولة بدل المتابعة بصمت. */
        if (!IS_LOCAL && typeof _initialLoadOk !== 'undefined' && !_initialLoadOk) {
            alert('تعذّر تحميل البيانات من الخادم — تحقق من اتصال الإنترنت. سيُعاد تحميل الصفحة.');
            location.reload();
            return;
        }
    }

    // ── التحويلة: إلزامية لطاقم الكول سنتر، وتُثبَّت لهذه الجلسة على هذا الجهاز ──
    {
        const _extSel = document.getElementById('loginExtension');
        const _raw    = _extSel ? _extSel.value.trim() : '';
        // «none» أو الفراغ = بدون تحويلة
        const _ext    = (_raw === '' || _raw === 'none') ? '' : _raw;
        // موظف الكول سنتر: التحويلة إلزامية (101/103). مدير الكول سنتر: يجوز «بدون تحويلة».
        if (currentUser?.role === 'cc_employee' && !_ext) {
            _showLoginError('⚠️ يرجى اختيار التحويلة للمتابعة');
            if (!IS_LOCAL && typeof setToken === 'function') setToken(null);
            currentUser = null;
            return; // نبقى في شاشة الدخول (كلمة المرور لا تزال مكتوبة)
        }
        try {
            if (_ext) localStorage.setItem('Shaab_DeviceExtension', _ext);
            else localStorage.removeItem('Shaab_DeviceExtension');
        } catch {}
    }

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainApp").style.display   = "flex";
    setProfileUI();
    recordLogin();
    if (typeof _logAudit === 'function') { _logAudit('login', '—', currentUser?.name || '—'); save(); }
    if (typeof initNotifications === 'function') initNotifications();
    if (typeof startSessionHeartbeat === 'function') startSessionHeartbeat();
    init();

    // لا نطلب إذن الإشعارات تلقائياً — يُطلب فقط عند الحاجة الفعلية

    // بدء مراقبة الجلسة
    if (typeof initSessionWatcher === 'function') initSessionWatcher();

    // تشغيل الساعة العقربية
    if (typeof initClock === 'function') initClock();

    // إظهار جرس الإشعارات في شريط العلوي
    (function() {
        const bell = document.getElementById('notifBellWidget');
        if (!bell) return;
        bell.style.display = 'flex';
    })();

    // تهيئة SSE (سيرفر فقط)
    if (!IS_LOCAL && typeof _initSSE === 'function') _initSSE();
}

function setProfileUI() {
    document.getElementById("sidebarName").textContent  = currentUser.name;
    document.getElementById("sidebarTitle").textContent = currentUser.title;
    document.getElementById("profileBtn").style.display = "flex";
    // تحديث صورة الـ avatar في الشريط الجانبي
    refreshSidebarAvatar();

    // إظهار/إخفاء التبويبات حسب الصلاحيات
    const isMedia          = currentUser.role === 'media';
    const isControlEmployee= currentUser.role === 'control_employee';
    const isControlSub     = currentUser.role === 'control_sub';
    const isAdmin          = currentUser.isAdmin;
    const isCCManager      = currentUser.role === 'cc_manager';

    // لوحة التحكم — مرئية للجميع إلا موظف السيطرة
    if (!isControlSub) {
        document.getElementById('tab-h')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-h')?.classList.add('hidden');
    }

    // متابعات موظفي السيطرة — لمدير قسم السيطرة فقط لا غير
    const _canSeeAN = currentUser?.title === 'مدير قسم السيطرة'
        || currentUser?.empId === '1111';
    if (_canSeeAN) {
        document.getElementById('tab-an')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-an')?.classList.add('hidden');
    }

    // ملاحظات مدراء مناطق — لموظفي الكول سنتر ومدير الكول سنتر فقط
    const _canSeeRMN = currentUser?.role === 'cc_employee' || currentUser?.role === 'cc_manager';
    document.getElementById('tab-rmn')?.classList.toggle('hidden', !_canSeeRMN);

    // سجل التدقيق — للمدير ومدير الكول سنتر فقط
    if (isAdmin || isCCManager) {
        document.getElementById('tab-l')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-l')?.classList.add('hidden');
    }

    // تدقيق إداري — للمدير ومدير الكول سنتر فقط
    if (isAdmin || isCCManager) {
        document.getElementById('tab-ti')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-ti')?.classList.add('hidden');
    }

    // الرسائل — لمدير/موظفي الكول سنتر + كل أدوار قسم السيطرة
    const isCCEmp     = currentUser?.role === 'cc_employee';
    const isControl   = currentUser?.role === 'control';
    const grpMsg  = document.getElementById('nav-group-msg');
    if (isAdmin || isCCManager || isCCEmp || isControl || isControlEmployee || isControlSub) {
        grpMsg?.classList.remove('hidden');
    } else {
        grpMsg?.classList.add('hidden');
    }
    // "جميع المراسلات" — إشراف: للأدمن/مدير الكول سنتر (الكل) + مدير قسم السيطرة (قسمه حصراً)
    const tabAll = document.getElementById('tab-msg-all');
    if (isAdmin || isCCManager || isControlEmployee) tabAll?.classList.remove('hidden');
    else tabAll?.classList.add('hidden');

    // سلة المحذوفات — للمدير ومدير الكول سنتر فقط
    if (isAdmin || isCCManager) {
        document.getElementById('tab-t')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-t')?.classList.add('hidden');
    }

    if (isMedia) {
        ['tab-m','tab-m-sub','tab-o','tab-b','tab-e','tab-s','tab-f','tab-comp'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('tab-c-sub')?.classList.remove('hidden');
        document.getElementById('tab-cu')?.classList.remove('hidden');
        document.getElementById('tab-mn')?.classList.remove('hidden');
        document.getElementById('tab-p')?.classList.remove('hidden');
    } else if (isControlEmployee) {
        ['tab-i','tab-b','tab-s'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('tab-m').classList.remove('hidden');
        document.getElementById('tab-m-sub')?.classList.remove('hidden');
        document.getElementById('tab-o').classList.remove('hidden');
        document.getElementById('tab-e').classList.remove('hidden');
        document.getElementById('tab-cu')?.classList.remove('hidden');
        document.getElementById('tab-comp')?.classList.remove('hidden');
        document.getElementById('tab-c-sub')?.classList.remove('hidden');
        document.getElementById('tab-f')?.classList.remove('hidden');
    } else if (isControlSub) {
        ['tab-i','tab-b','tab-e','tab-s','tab-f'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('tab-m')?.classList.remove('hidden');
        document.getElementById('tab-m-sub')?.classList.remove('hidden');
        document.getElementById('tab-o')?.classList.remove('hidden');
        document.getElementById('tab-cu')?.classList.remove('hidden');
        document.getElementById('tab-c-sub')?.classList.remove('hidden');
    } else {
        if (perm('viewI'))        document.getElementById("tab-i").classList.remove("hidden");
        if (!perm('viewBreak'))   document.getElementById("tab-b").classList.add("hidden");
        if (!perm('addEmp') && !perm('addControlEmp')) document.getElementById("tab-e").classList.add("hidden");
        if (perm('viewStats'))    document.getElementById("tab-s").classList.remove("hidden");
        if (perm('viewBranches')) document.getElementById("tab-f").classList.remove("hidden");
        if (perm('viewPrices'))   document.getElementById("tab-p")?.classList.remove("hidden");
        document.getElementById('tab-m-sub')?.classList.remove('hidden');
        document.getElementById('tab-c-sub')?.classList.remove('hidden');
        if (isAdmin || isCCManager) document.getElementById('tab-cu')?.classList.remove('hidden');
        if (perm('viewComp')) document.getElementById('tab-comp')?.classList.remove('hidden');
    }

    // إظهار مجموعة الموظفين إذا كان أي عنصر فرعي مرئياً
    _syncEmpGroup();

}

function refreshSidebarAvatar() {
    const avatarEl = document.getElementById('sidebarAvatar');
    if (!avatarEl || !currentUser) return;
    const me = (employees || []).find(e => e.empId === currentUser?.empId);
    if (me?.photo) {
        avatarEl.innerHTML = `<img src="${me.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
    } else {
        avatarEl.innerHTML = '👤';
    }
}

function openProfile() {
    document.getElementById("modalName").textContent        = currentUser.name;
    document.getElementById("modalTitleTop").textContent    = currentUser.title;
    document.getElementById("modalNameDetail").textContent  = currentUser.name;
    const empIdEl = document.getElementById("modalEmpId");
    if (empIdEl) empIdEl.textContent = '*'.repeat((currentUser.empId || '').length || 4);
    document.getElementById("modalTitleDetail").textContent = currentUser.title;

    document.getElementById("profileModal").classList.remove("hidden");
}

function closeProfile() { document.getElementById("profileModal").classList.add("hidden"); }


