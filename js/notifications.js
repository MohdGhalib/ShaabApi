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
        // شرط أساسي: الموظف يجب أن يكون مسجّل دخول حاليًا
        if (s.logoutIso) return;
        if (s.empId === myId) return;
        // كلمة "غير نشط" = لا يوجد سجل حركات للموظف في سجل التدقيق لمدة ساعة
        const loginTs = Date.parse(s.loginIso) || 0;
        const lastAction = (db.auditLog || [])
            .filter(e => e.empId === s.empId && e.action !== 'login' && e.action !== 'logout')
            .reduce((max, e) => Math.max(max, e.ts || 0), 0);
        // نقطة المرجع: آخر حركة فعلية، أو وقت الدخول إن لم تكن هناك حركات
        const lastTs = Math.max(loginTs, lastAction);
        if ((now - lastTs) >= _NOTIF_IDLE_MS) {
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
        stack.style.cssText = 'position:fixed;top:78px;left:66px;z-index:99998;display:flex;flex-direction:column;gap:6px;align-items:stretch;pointer-events:none;width:340px;max-width:calc(100vw - 80px);';
        document.body.appendChild(stack);
    }
    return stack;
}

/* ── تنسيق موحّد لكل الرسائل (نفس الحجم واللون والتصميم) ── */
const _NOTIF_BASE_CSS = `
    color:#fff;padding:9px 14px;border-radius:12px;
    box-shadow:0 4px 16px rgba(0,0,0,0.40);
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    font-family:'Cairo';font-weight:700;font-size:13px;
    line-height:1.4;
    opacity:0;transform:translateX(-20px);
    transition:opacity 0.35s ease,transform 0.35s ease;
    pointer-events:auto;display:flex;align-items:center;gap:8px;
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

/* ══ بطاقة الموظف + تسجيل خروج عن بُعد ══════════════════ */

// أسماء قابلة للضغط: HTML للموظف المسجّل دخول (يراه مدير الكول سنتر فقط)
function _empNameHTML(name) {
    if (!name || name === '—') return sanitize(name || '—');
    const safe = sanitize(name);
    if (!_isCCMgr()) return safe;
    if (name === currentUser?.name) return safe;          // المدير لا يمكنه إخراج نفسه
    const online = (sessions || []).some(s => s.empName === name && !s.logoutIso);
    if (!online) return safe;
    const enc = encodeURIComponent(name);
    return `<span class="online-emp-name" onclick="_showEmpCard(decodeURIComponent('${enc}'))" title="موظف مسجّل دخول — اضغط للبطاقة" style="cursor:pointer;color:#81d4fa;border-bottom:1px dashed currentColor;font-weight:700;">${safe}</span>`;
}

function _showEmpCard(name) {
    if (!_isCCMgr()) return;
    if (name === currentUser?.name) return alert('لا يمكنك إخراج نفسك من النظام');
    const session = (sessions || []).find(s => s.empName === name && !s.logoutIso);
    const emp = (employees || []).find(e => e.name === name);
    if (!session) return alert('الموظف لم يعد مسجّل دخول');
    closeEmpCard();
    const overlay = document.createElement('div');
    overlay.id = '_empCardOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:"Cairo";';
    overlay.onclick = (e) => { if (e.target === overlay) closeEmpCard(); };
    const loginAt = session.loginIso ? new Date(session.loginIso) : null;
    const loginStr = loginAt ? `${loginAt.toLocaleDateString('ar-EG')} — ${loginAt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}` : '—';
    overlay.innerHTML = `
        <div style="background:var(--bg-main);border:1px solid var(--border);border-radius:18px;padding:26px;width:380px;max-width:92vw;text-align:right;box-shadow:0 12px 40px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                <h3 style="margin:0;color:var(--text-main);">👤 بطاقة الموظف</h3>
                <button onclick="closeEmpCard()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px;">
                <div><span style="color:var(--text-dim);font-size:12px;">الاسم:</span> <b style="color:var(--text-main);">${sanitize(name)}</b></div>
                <div><span style="color:var(--text-dim);font-size:12px;">الرقم الوظيفي:</span> <b style="color:#81d4fa;font-family:monospace;">${sanitize(session.empId || emp?.empId || '—')}</b></div>
                <div><span style="color:var(--text-dim);font-size:12px;">المسمى الوظيفي:</span> <b style="color:var(--text-main);">${sanitize(emp?.title || '—')}</b></div>
                <div><span style="color:var(--text-dim);font-size:12px;">وقت تسجيل الدخول:</span> <b style="color:#a5d6a7;">${sanitize(loginStr)}</b></div>
                <div><span style="color:var(--text-dim);font-size:12px;">الحالة:</span> <span style="padding:2px 10px;border-radius:6px;background:rgba(46,125,50,0.18);color:#a5d6a7;font-weight:700;font-size:12px;">🟢 مسجّل دخول</span></div>
            </div>
            <button onclick="_confirmForceLogout('${encodeURIComponent(name)}')" style="width:100%;padding:12px;border:none;border-radius:12px;background:linear-gradient(135deg,rgba(211,47,47,0.95),rgba(211,47,47,0.85));color:#fff;font-family:'Cairo';font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(211,47,47,0.3);">🔴 تسجيل خروج الموظف من النظام</button>
        </div>`;
    document.body.appendChild(overlay);
}

function closeEmpCard() {
    const o = document.getElementById('_empCardOverlay');
    if (o) o.remove();
}

function _confirmForceLogout(encName) {
    const name = decodeURIComponent(encName);
    if (name === currentUser?.name) { closeEmpCard(); return alert('لا يمكنك إخراج نفسك من النظام'); }
    if (!confirm(`هل أنت متأكد من تسجيل خروج الموظف:\n${name}؟`)) return;
    const session = (sessions || []).find(s => s.empName === name && !s.logoutIso);
    if (!session) { closeEmpCard(); return alert('الموظف لم يعد مسجّل دخول'); }
    session.forceLogoutBy = currentUser?.name || 'مسؤول النظام';
    session.forceLogoutAt = new Date().toISOString();
    if (typeof saveSessions === 'function') saveSessions();
    if (typeof _logAudit === 'function') { _logAudit('forceLogout', '—', `إخراج ${name} من النظام`); save(); }
    closeEmpCard();
    alert(`تم إرسال طلب تسجيل خروج الموظف "${name}". سيتم إخراجه خلال ثوانٍ.`);
}

/* عند المتلقّي: كشف طلب تسجيل خروج إجباري */
let _forcedOutHandled = false;
function _checkForceLogoutForMe() {
    if (!currentUser || currentUser.isAdmin || _forcedOutHandled) return;
    const mySession = (sessions || []).find(s => s.empId === currentUser.empId && !s.logoutIso && s.forceLogoutBy);
    if (mySession) {
        _forcedOutHandled = true;
        _showForcedOutToast();
        setTimeout(() => {
            try { if (typeof doLogout === 'function') doLogout(); } catch(e) { location.reload(); }
        }, 2000);
    }
}

function _showForcedOutToast() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200000;display:flex;align-items:center;justify-content:center;font-family:"Cairo";backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    overlay.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(211,47,47,0.96),rgba(211,47,47,0.86));color:#fff;padding:28px 36px;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.6);text-align:center;max-width:90vw;">
            <div style="font-size:42px;margin-bottom:12px;">⚠️</div>
            <div style="font-size:17px;font-weight:800;line-height:1.6;">تم تسجيل خروجك من النظام<br>بواسطة مسؤول النظام</div>
        </div>`;
    document.body.appendChild(overlay);
}

function _showStickyIdleNotif(empName, empId, lastActiveTs) {
    const stack = _ensureNotifStack();
    const minutes = Math.floor((Date.now() - lastActiveTs) / 60000);
    // نفس درجة العمق المستخدمة في الدخول/الخروج، بلون عنبري داكن للتمييز
    const bg = 'linear-gradient(135deg,rgba(216,67,21,0.96),rgba(216,67,21,0.86))';
    const item = document.createElement('div');
    item.style.cssText = _NOTIF_BASE_CSS + `background:${bg};cursor:pointer;`;
    item.dataset.empId = empId;
    const txt = document.createElement('span');
    txt.style.cssText = 'flex:1;';
    txt.innerHTML = `⚠️ ${sanitize(empName)} غير نشط منذ ${minutes} دقيقة`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:rgba(255,255,255,0.22);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;';
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
