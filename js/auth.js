/* ══════════════════════════════════════════════════════
   AUTH — Login, logout, permissions
══════════════════════════════════════════════════════ */
async function hashPassword(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
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
        'viewPrices','editPrices'
    ],
    // مدير الكول سنتر
    cc_manager: [
        'addM','editM','deliverM','rejectM','deleteM',
        'addI','viewI',
        'addC','editC','approveC','returnC','deleteC',
        'addEmp','viewStats','viewBreak','viewLinkBadge','viewBranches',
        'viewPrices','editPrices'
    ],
    // موظف كول سنتر
    cc_employee: [
        'addM','deliverM',
        'addI','viewI',
        'addC',
        'viewBreak','viewLinkBadge',
        'viewPrices'
    ],
    // مسؤول قسم السيطرة — رد + إضافة موظفين خاصين
    control: [
        'auditC', 'addControlEmp'
    ],
    // مدير قسم السيطرة (مضاف من مدير/كول سنتر) — رد كامل + اطلاع على المنتسيات
    control_employee: [
        'auditC', 'addEmp', 'viewM'
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
    recordLogout();
    setToken(null);
    // مسح توقيتات المشاهدة عند تسجيل الخروج
    try { localStorage.removeItem('_shaabLastSeen'); } catch {}
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
                const expected = await hashPassword((candidate.salt || '') + pass);
                // كلمة المرور الافتراضية = الرقم الوظيفي
                const defaultOk = !candidate.passwordHash && pass === candidate.empId;
                if (expected === candidate.passwordHash || defaultOk) emp = candidate;
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
                // فشل تسجيل الدخول العادي — جرّب كلمة مرور لوحة التحكم
                if (res.status !== 429) {
                    try {
                        const ar = await fetch('/api/admin/unlock', {
                            method:  'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body:    JSON.stringify({ password: pass })
                        });
                        if (ar.ok) {
                            const ad = await ar.json();
                            _ap.open(ad.token);
                            return;
                        }
                    } catch(_) {}
                }
                _showLoginError('');
                return;
            }
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
        try { await loadAllData(); } catch(e) { /* نكمل الدخول حتى لو فشل التحميل */ }
    }

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("mainApp").style.display   = "flex";
    setProfileUI();
    recordLogin();
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

    // سجل التدقيق — للمدير ومدير الكول سنتر فقط
    if (isAdmin || isCCManager) {
        document.getElementById('tab-l')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-l')?.classList.add('hidden');
    }

    // سلة المحذوفات — للمدير ومدير الكول سنتر فقط
    if (isAdmin || isCCManager) {
        document.getElementById('tab-t')?.classList.remove('hidden');
    } else {
        document.getElementById('tab-t')?.classList.add('hidden');
    }

    if (isMedia) {
        ['tab-m','tab-m-sub','tab-o','tab-b','tab-e','tab-s','tab-f','tab-cu','tab-c-sub'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('tab-p')?.classList.remove('hidden');
    } else if (isControlEmployee) {
        ['tab-i','tab-b','tab-s'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('tab-m').classList.remove('hidden');
        document.getElementById('tab-m-sub')?.classList.remove('hidden');
        document.getElementById('tab-o').classList.remove('hidden');
        document.getElementById('tab-e').classList.remove('hidden');
        document.getElementById('tab-cu')?.classList.remove('hidden');
        document.getElementById('tab-c-sub')?.classList.remove('hidden');
        document.getElementById('tab-f')?.classList.remove('hidden');
    } else if (isControlSub) {
        ['tab-m','tab-m-sub','tab-o','tab-i','tab-b','tab-e','tab-s','tab-f'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
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
    }

    // إظهار مجموعة الموظفين إذا كان أي عنصر فرعي مرئياً
    _syncEmpGroup();

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


