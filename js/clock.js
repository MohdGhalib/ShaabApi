/* ══════════════════════════════════════════════════════
   DIGITAL CLOCK — رقمية حضارية
══════════════════════════════════════════════════════ */
let _clockInterval = null;

const _clockDays = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const _clockMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function _tickClock() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    const s    = String(now.getSeconds()).padStart(2, '0');
    const day  = _clockDays[now.getDay()];
    const date = `${day} ${now.getDate()} ${_clockMonths[now.getMonth()]}`;

    const tEl = document.getElementById('clockTime');
    const dEl = document.getElementById('clockDate');
    if (tEl) tEl.textContent = `${h}:${m}:${s}`;
    if (dEl) dEl.textContent = date;
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
