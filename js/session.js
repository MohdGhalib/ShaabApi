/* ══════════════════════════════════════════════════════
   SESSION — Inactivity warning (no auto-logout)
══════════════════════════════════════════════════════ */
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 دقيقة بدون نشاط

let _sessionTimer = null;

function initSessionWatcher() {
    const resetEvents = ['mousemove','keydown','click','touchstart'];
    resetEvents.forEach(ev => document.addEventListener(ev, _resetSessionTimer, { passive: true }));
    _resetSessionTimer();
}

function _resetSessionTimer() {
    clearTimeout(_sessionTimer);
    const modal = document.getElementById('sessionModal');
    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
    }
    _sessionTimer = setTimeout(_showSessionWarning, SESSION_IDLE_MS);
}

function _showSessionWarning() {
    const modal = document.getElementById('sessionModal');
    if (modal) modal.classList.remove('hidden');
}

function stayLoggedIn() {
    _resetSessionTimer();
}
