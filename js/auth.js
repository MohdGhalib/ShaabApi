/* ══════════════════════════════════════════════════════
   AUTH — Login, logout, permissions
══════════════════════════════════════════════════════ */
async function hashPassword(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

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
async function _superAdminLogin(isLocked) {
    if (typeof IS_LOCAL === 'undefined' || !IS_LOCAL) {
        let st = { enabled: false };
        try { st = await fetch('api/sa2fa/status').then(r => r.json()); } catch {}
        if (st && st.enabled) {
            const verified = await _show2FAModal();   // نافذة عصرية تتولّى الإدخال + التحقق
            if (!verified) return;                     // ألغى المستخدم أو لم يُكمل
        }
    }
    _grantSuperAdmin(isLocked);
}

/* 🔐 نافذة منبثقة عصرية لإدخال رمز التحقق الثنائي — تُرجع Promise<boolean> (تم التحقق؟) */
function _show2FAModal() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = '_sa2faOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:Cairo;animation:_sa2faFade .2s ease;';
        overlay.innerHTML = `
          <style>
            @keyframes _sa2faFade{from{opacity:0}to{opacity:1}}
            @keyframes _sa2faPop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
            @keyframes _sa2faShake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(4px)}50%{transform:translateX(-6px)}}
          </style>
          <div id="_sa2faBox" style="background:linear-gradient(160deg,#201f2e,#14141d);border:1px solid rgba(255,255,255,0.09);border-radius:24px;width:390px;max-width:92vw;padding:32px 28px;box-shadow:0 30px 90px rgba(0,0,0,0.65);text-align:center;direction:rtl;animation:_sa2faPop .28s cubic-bezier(.2,.9,.3,1.2);">
            <div style="width:66px;height:66px;margin:0 auto 18px;border-radius:50%;background:linear-gradient(135deg,#6a1b9a,#283593);display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 10px 28px rgba(106,27,154,0.55);">🔐</div>
            <h3 style="margin:0 0 6px;color:#fff;font-size:19px;font-weight:800;">التحقق الثنائي</h3>
            <p style="margin:0 0 22px;color:#9b9bb3;font-size:13px;line-height:1.6;">أدخل الرمز المكوّن من 6 أرقام<br>من تطبيق Google Authenticator</p>
            <input id="_sa2faInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"
              style="width:100%;box-sizing:border-box;text-align:center;letter-spacing:14px;font-size:30px;font-weight:700;padding:15px 10px;border-radius:16px;border:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#fff;outline:none;font-family:monospace;transition:border-color .2s;">
            <div id="_sa2faErr" style="color:#ff6b6b;font-size:12.5px;min-height:18px;margin-top:10px;font-weight:600;"></div>
            <div style="display:flex;gap:10px;margin-top:16px;">
              <button id="_sa2faCancel" style="flex:1;padding:14px;border-radius:13px;border:1px solid rgba(255,255,255,0.13);background:transparent;color:#bbb;font-family:Cairo;font-size:14px;cursor:pointer;transition:.2s;">إلغاء</button>
              <button id="_sa2faSubmit" style="flex:2;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#6a1b9a,#283593);color:#fff;font-family:Cairo;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(106,27,154,0.4);transition:.2s;">تحقّق</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        const box   = overlay.querySelector('#_sa2faBox');
        const input = overlay.querySelector('#_sa2faInput');
        const err   = overlay.querySelector('#_sa2faErr');
        const btn   = overlay.querySelector('#_sa2faSubmit');
        const done  = (val) => { overlay.remove(); resolve(val); };
        setTimeout(() => input.focus(), 60);
        input.addEventListener('focus', () => { input.style.borderColor = '#7e57c2'; });
        input.addEventListener('blur',  () => { input.style.borderColor = 'rgba(255,255,255,0.12)'; });
        input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); err.textContent = ''; });
        const verify = async () => {
            const code = input.value.trim();
            if (code.length < 6) { err.textContent = 'الرجاء إدخال 6 أرقام'; return; }
            btn.disabled = true; btn.textContent = 'جارٍ التحقق…'; btn.style.opacity = '0.7';
            let vr = { ok: false };
            try {
                vr = await fetch('api/sa2fa/verify', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ code })
                }).then(r => r.json());
            } catch {}
            if (vr && vr.ok) { done(true); return; }
            err.textContent = (vr && vr.error) ? vr.error : '❌ رمز غير صحيح، حاول مجدداً';
            box.style.animation = '_sa2faShake .4s';
            setTimeout(() => { box.style.animation = ''; }, 420);
            btn.disabled = false; btn.textContent = 'تحقّق'; btn.style.opacity = '1';
            input.value = ''; input.focus();
        };
        btn.onclick = verify;
        overlay.querySelector('#_sa2faCancel').onclick = () => done(false);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  verify();
            if (e.key === 'Escape') done(false);
        });
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

    // ── فحص قفل النظام + كلمة مرور السوبر أدمن ──
    const SA_PWD     = (typeof window._LK_SUPER_ADMIN_PWD === 'string') ? window._LK_SUPER_ADMIN_PWD : '090999797269';
    const _isLocked  = (typeof isSystemLocked === 'function' && isSystemLocked());

    // إن كان النظام مقفل، فقط كلمة مرور السوبر أدمن مقبولة
    if (_isLocked && pass !== SA_PWD) {
        _showLoginError('🔒 النظام مقفل — تواصل مع محمد غالب: 0785110515');
        return;
    }

    // كلمة مرور السوبر أدمن — دخول مباشر (سواء النظام مقفل أو مفتوح)
    // هذا يتيح للسوبر أدمن إدارة النظام (ومنه قفله يدوياً) في أي وقت
    if (pass === SA_PWD) {
        _superAdminLogin(_isLocked);   // قد يطلب التحقق الثنائي (TOTP) قبل منح الدخول
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
                // فشل تسجيل الدخول العادي — جرّب كلمة مرور لوحة التحكم (السوبر ادمن)
                let unlockedAsSuperAdmin = false;
                if (res.status !== 429) {
                    try {
                        const ar = await fetch('/api/admin/unlock', {
                            method:  'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body:    JSON.stringify({ password: pass })
                        });
                        if (ar.ok) {
                            const ad = await ar.json();
                            // ادخل mainApp كسوبر ادمن — لوحة admin متاحة من زر جانبي
                            setToken(ad.token);
                            currentUser = {
                                name:    'مسؤول النظام',
                                title:   'سوبر ادمن',
                                empId:   'super-admin',
                                role:    'admin',
                                isAdmin: true
                            };
                            unlockedAsSuperAdmin = true;
                        }
                    } catch(_) {}
                }
                if (!unlockedAsSuperAdmin) {
                    _showLoginError('');
                    return;
                }
                // لا return — اترك التدفّق يكمل (loadAllData → setProfileUI → mainApp)
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

    // سجل التدقيق — للمدير ومدير الكول سنتر فقط
    if (isAdmin || isCCManager) {
        document.getElementById('tab-l')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-l')?.classList.add('hidden');
    }

    // الرسائل — لمدير الكول سنتر وموظفي الكول سنتر
    const isCCEmp = currentUser?.role === 'cc_employee';
    const grpMsg  = document.getElementById('nav-group-msg');
    if (isAdmin || isCCManager || isCCEmp) {
        grpMsg?.classList.remove('hidden');
    } else {
        grpMsg?.classList.add('hidden');
    }
    // "جميع المراسلات" — للمدير ومدير الكول سنتر فقط
    const tabAll = document.getElementById('tab-msg-all');
    if (isAdmin || isCCManager) tabAll?.classList.remove('hidden');
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


