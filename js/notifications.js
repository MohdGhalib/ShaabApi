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
    if (!_notifInited) initNotifications();              // تهيئة كسولة عند أول استدعاء
    const myId = currentUser?.empId;
    const _loggedOutIds = new Set();
    (sessions || []).forEach(s => {
        if (s.empId === myId) return;                    // تجاهل النفس
        if (!_seenLoginIds.has(s.id)) {
            _seenLoginIds.add(s.id);
            _showTransientNotif('login', s.empName);
        }
        if (s.logoutIso && !_seenLogoutIds.has(s.id)) {
            _seenLogoutIds.add(s.id);
            _showTransientNotif('logout', s.empName);
            _loggedOutIds.add(s.empId);
        } else if (s.logoutIso) {
            _loggedOutIds.add(s.empId);
        }
    });
    // أزل أي إشعار خمول لموظف سجّل خروج
    if (_loggedOutIds.size) {
        document.querySelectorAll('#notifStack [data-emp-id]').forEach(el => {
            if (_loggedOutIds.has(el.dataset.empId)) _animateOut(el);
        });
    }
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
        stack.style.cssText = 'position:fixed;top:80px;left:66px;z-index:99998;display:flex;flex-direction:column;gap:8px;align-items:flex-start;pointer-events:none;max-width:min(440px,calc(100vw - 80px));';
        document.body.appendChild(stack);
    }
    return stack;
}

/* ── تنسيق موحّد لكل الرسائل (مماثل لرسائل الدخول/الخروج) ── */
const _NOTIF_BASE_CSS = `
    color:#fff;padding:11px 16px;border-radius:12px;
    box-shadow:0 6px 20px rgba(0,0,0,0.45);
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    font-family:'Cairo';font-weight:700;font-size:13.5px;
    opacity:0;transform:translateX(-30px);
    transition:opacity 0.4s ease,transform 0.4s ease;
    pointer-events:auto;display:flex;align-items:center;gap:10px;
    width:100%;box-sizing:border-box;`;

function _animateIn(el) {
    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(0)';
    });
}
function _animateOut(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    setTimeout(() => el.remove(), 400);
}

function _showTransientNotif(type, empName) {
    const stack = _ensureNotifStack();
    const isLogin = type === 'login';
    const bg = isLogin
        ? 'linear-gradient(135deg,rgba(46,125,50,0.96),rgba(46,125,50,0.86))'
        : 'linear-gradient(135deg,rgba(120,120,120,0.96),rgba(120,120,120,0.86))';
    const item = document.createElement('div');
    item.style.cssText = _NOTIF_BASE_CSS + `background:${bg};`;
    item.innerHTML = `<span style="flex:1;">${isLogin ? '🟢' : '⚫'} ${sanitize(empName)} ${isLogin ? 'سجّل الدخول' : 'سجّل الخروج'}</span>`;
    stack.appendChild(item);
    _animateIn(item);
    _playNotifSound();
    setTimeout(() => _animateOut(item), _NOTIF_AUTOFADE);
}

function _showStickyIdleNotif(empName, empId, lastActiveTs) {
    const stack = _ensureNotifStack();
    const minutes = Math.floor((Date.now() - lastActiveTs) / 60000);
    const bg = 'linear-gradient(135deg,rgba(230,81,0,0.96),rgba(230,81,0,0.86))';
    const item = document.createElement('div');
    item.style.cssText = _NOTIF_BASE_CSS + `background:${bg};cursor:pointer;`;
    item.dataset.empId = empId;
    const txt = document.createElement('span');
    txt.style.cssText = 'flex:1;';
    txt.innerHTML = `⚠️ ${sanitize(empName)} غير نشط منذ ${minutes} دقيقة — اضغط لعرض حركاته`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:rgba(255,255,255,0.25);border:none;color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;';
    closeBtn.onclick = (e) => { e.stopPropagation(); _animateOut(item); };
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
        _animateOut(item);
    };
    stack.appendChild(item);
    _animateIn(item);
    _playNotifSound();
}
