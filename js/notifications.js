/* ══════════════════════════════════════════════════════
   NOTIFICATIONS — cc_manager only: login/logout + idle alerts
   - Stack of slide-down notifications near top-center
   - Transient: fades after a few seconds (login/logout)
   - Sticky: stays until X clicked (employee idle ≥ 1 hour)
   - Click sticky → audit log tab + employee filter set
══════════════════════════════════════════════════════ */

const _NOTIF_SEEN_KEY  = '_shaabNotifSeen';
const _NOTIF_IDLE_MS   = 60 * 60 * 1000;   // ساعة
const _NOTIF_AUTOFADE  = 5000;              // 5 ثوانٍ
let   _notifSoundFile  = 'audio/notify-letter.wav';
let   _notifAudio2     = null;
let   _seenLoginIds    = new Set();
let   _seenLogoutIds   = new Set();
let   _idleNotifShown  = new Set();         // session.id → marker
let   _idleCheckTimer  = null;
let   _notifInited     = false;

function _isCCMgr() { return currentUser?.role === 'cc_manager'; }

function _saveNotifSeen() {
    try {
        localStorage.setItem(_NOTIF_SEEN_KEY, JSON.stringify({
            logins:  Array.from(_seenLoginIds),
            logouts: Array.from(_seenLogoutIds)
        }));
    } catch {}
}

function _loadNotifSeen() {
    try {
        const d = JSON.parse(localStorage.getItem(_NOTIF_SEEN_KEY) || '{}');
        _seenLoginIds  = new Set(d.logins  || []);
        _seenLogoutIds = new Set(d.logouts || []);
    } catch {}
}

function initNotifications() {
    if (!_isCCMgr()) return;
    if (_notifInited) return;
    _notifInited = true;
    _loadNotifSeen();
    // Mark all existing sessions as seen on first launch (no replay)
    if (_seenLoginIds.size === 0 && (sessions || []).length) {
        sessions.forEach(s => _seenLoginIds.add(s.id));
        sessions.forEach(s => { if (s.logoutIso) _seenLogoutIds.add(s.id); });
        _saveNotifSeen();
    }
    if (_idleCheckTimer) clearInterval(_idleCheckTimer);
    _idleCheckTimer = setInterval(_checkIdleEmployees, 60 * 1000);
}

function _checkSessionsForNotifs() {
    if (!_isCCMgr()) return;
    const myId = currentUser?.empId;
    (sessions || []).forEach(s => {
        if (s.empId === myId) return;                    // تجاهل النفس
        if (!_seenLoginIds.has(s.id)) {
            _seenLoginIds.add(s.id);
            _showTransientNotif('login', s.empName);
        }
        if (s.logoutIso && !_seenLogoutIds.has(s.id)) {
            _seenLogoutIds.add(s.id);
            _showTransientNotif('logout', s.empName);
        }
    });
    _saveNotifSeen();
    _checkIdleEmployees();
}

function _checkIdleEmployees() {
    if (!_isCCMgr()) return;
    const now = Date.now();
    const myId = currentUser?.empId;
    (sessions || []).forEach(s => {
        if (s.logoutIso) return;
        if (s.empId === myId) return;
        const loginTs = Date.parse(s.loginIso) || 0;
        const lastAction = (db.auditLog || [])
            .filter(e => e.empId === s.empId && e.action !== 'login' && e.action !== 'logout')
            .reduce((max, e) => Math.max(max, e.ts || 0), 0);
        const lastTs = Math.max(loginTs, lastAction);
        if ((now - lastTs) >= _NOTIF_IDLE_MS) {
            // مفتاح يتغيّر مع كل ساعة جديدة لمنع التكرار
            const bucket = Math.floor((now - lastTs) / _NOTIF_IDLE_MS);
            const key = `${s.id}-${bucket}`;
            if (!_idleNotifShown.has(key)) {
                _idleNotifShown.add(key);
                _showStickyIdleNotif(s.empName, s.empId, lastTs);
            }
        }
    });
}

function _playNotifSound() {
    try {
        if (!_notifAudio2) _notifAudio2 = new Audio(_notifSoundFile);
        _notifAudio2.currentTime = 0;
        _notifAudio2.play().catch(() => {});
    } catch {}
}

function _ensureNotifStack() {
    let stack = document.getElementById('notifStack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'notifStack';
        stack.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:96vw;';
        document.body.appendChild(stack);
    }
    return stack;
}

function _showTransientNotif(type, empName) {
    const stack = _ensureNotifStack();
    const isLogin = type === 'login';
    const item = document.createElement('div');
    item.style.cssText = `
        background: ${isLogin
            ? 'linear-gradient(135deg,rgba(46,125,50,0.96),rgba(46,125,50,0.86))'
            : 'linear-gradient(135deg,rgba(120,120,120,0.96),rgba(120,120,120,0.86))'};
        color:#fff;padding:11px 22px;border-radius:12px;
        box-shadow:0 6px 20px rgba(0,0,0,0.45);
        font-family:'Cairo';font-weight:700;font-size:14px;
        opacity:0;transform:translateY(-30px);
        transition:opacity 0.4s ease,transform 0.4s ease;
        pointer-events:auto;white-space:nowrap;`;
    item.innerHTML = `${isLogin ? '🟢' : '⚫'} ${sanitize(empName)} ${isLogin ? 'سجّل الدخول' : 'سجّل الخروج'}`;
    stack.appendChild(item);
    requestAnimationFrame(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
    });
    _playNotifSound();
    setTimeout(() => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(-20px)';
        setTimeout(() => item.remove(), 400);
    }, _NOTIF_AUTOFADE);
}

function _showStickyIdleNotif(empName, empId, lastActiveTs) {
    const stack = _ensureNotifStack();
    const minutes = Math.floor((Date.now() - lastActiveTs) / 60000);
    const item = document.createElement('div');
    item.style.cssText = `
        background:linear-gradient(135deg,rgba(245,124,0,0.96),rgba(245,124,0,0.86));
        color:#fff;padding:11px 14px 11px 18px;border-radius:12px;
        box-shadow:0 6px 20px rgba(0,0,0,0.45);
        font-family:'Cairo';font-weight:700;font-size:14px;
        opacity:0;transform:translateY(-30px);
        transition:opacity 0.4s ease,transform 0.4s ease;
        pointer-events:auto;display:flex;align-items:center;gap:12px;
        max-width:96vw;cursor:pointer;`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:rgba(255,255,255,0.25);border:none;color:#fff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        item.style.opacity = '0';
        item.style.transform = 'translateY(-20px)';
        setTimeout(() => item.remove(), 400);
    };
    const txt = document.createElement('span');
    txt.innerHTML = `⚠️ ${sanitize(empName)} غير نشط منذ ${minutes} دقيقة — اضغط لعرض حركاته`;
    item.appendChild(txt);
    item.appendChild(closeBtn);
    item.onclick = () => {
        if (typeof switchTab === 'function') switchTab('l');
        setTimeout(() => {
            const empSel = document.getElementById('searchEmpAudit');
            if (empSel) {
                empSel.value = empName;
                if (typeof _onAuditFilterChange === 'function') _onAuditFilterChange();
            }
        }, 250);
        item.style.opacity = '0';
        item.style.transform = 'translateY(-20px)';
        setTimeout(() => item.remove(), 400);
    };
    stack.appendChild(item);
    requestAnimationFrame(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
    });
    _playNotifSound();
}
