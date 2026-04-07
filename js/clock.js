/* ══════════════════════════════════════════════════════
   DIGITAL CLOCK — 12 ساعة + مربع التاريخ
══════════════════════════════════════════════════════ */
let _clockInterval = null;

const _clockDays   = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const _clockMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function _tickClock() {
    const now  = new Date();

    // ── 12 ساعة ──
    const rawH = now.getHours();
    const ampm = rawH >= 12 ? 'م' : 'ص';
    const h12  = String(rawH % 12 || 12).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    const s    = String(now.getSeconds()).padStart(2, '0');

    // ── التاريخ ──
    const day      = _clockDays[now.getDay()];
    const dateStr  = `${now.getDate()} ${_clockMonths[now.getMonth()]} ${now.getFullYear()}`;

    const tEl    = document.getElementById('clockTime');
    const apEl   = document.getElementById('clockAmPm');
    const dayEl  = document.getElementById('clockDayName');
    const dateEl = document.getElementById('clockDateFull');

    if (tEl)    tEl.textContent   = `${h12}:${m}:${s}`;
    if (apEl)   apEl.textContent  = ampm;
    if (dayEl)  dayEl.textContent = day;
    if (dateEl) dateEl.textContent= dateStr;
}

function initClock() {
    const widget = document.getElementById('clockWidget');
    if (!widget) return;
    widget.style.display = 'block';
    _tickClock();
    if (_clockInterval) clearInterval(_clockInterval);
    _clockInterval = setInterval(_tickClock, 1000);
}

function stopClock() {
    if (_clockInterval) { clearInterval(_clockInterval); _clockInterval = null; }
    const widget = document.getElementById('clockWidget');
    if (widget) widget.style.display = 'none';
}
