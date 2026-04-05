/* ══════════════════════════════════════════════════════
   CLOCK — Analog + Digital with toggle
══════════════════════════════════════════════════════ */
let _clockRaf    = null;
let _clockLogo   = null;
let _clockLoaded = false;
let _clockMode   = localStorage.getItem('_clockMode') || 'analog'; // 'analog' | 'digital'
let _digitalRaf  = null;

function toggleClockMode() {
    _clockMode = _clockMode === 'analog' ? 'digital' : 'analog';
    localStorage.setItem('_clockMode', _clockMode);
    _applyClockMode();
}

function _applyClockMode() {
    const analog  = document.getElementById('analogClockWrapper');
    const digital = document.getElementById('digitalClockWrapper');
    if (!analog || !digital) return;

    if (_clockMode === 'digital') {
        analog.style.display  = 'none';
        digital.style.display = 'flex';
        digital.classList.add('clock-pop');
        _startDigitalClock();
        if (_clockRaf) { cancelAnimationFrame(_clockRaf); _clockRaf = null; }
    } else {
        digital.style.display = 'none';
        analog.style.display  = '';
        analog.classList.remove('hidden');
        analog.classList.add('clock-pop');
        _stopDigitalClock();
        if (_clockRaf) cancelAnimationFrame(_clockRaf);
        _tickClock();
    }
}

function _startDigitalClock() {
    _stopDigitalClock();
    _tickDigital();
}

function _stopDigitalClock() {
    if (_digitalRaf) { cancelAnimationFrame(_digitalRaf); _digitalRaf = null; }
}

function _tickDigital() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    const s    = String(now.getSeconds()).padStart(2, '0');
    const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const day  = days[now.getDay()];
    const dateStr = `${day} ${now.getDate()}/${now.getMonth()+1}`;

    const tEl = document.getElementById('digitalTime');
    const dEl = document.getElementById('digitalDate');
    if (tEl) tEl.textContent = `${h}:${m}:${s}`;
    if (dEl) dEl.textContent = dateStr;

    _digitalRaf = requestAnimationFrame(_tickDigital);
}

function initClock() {
    // تحميل اللوجو مرة واحدة
    if (!_clockLoaded) {
        _clockLogo     = new Image();
        _clockLogo.src = 'img/logo.png';
        _clockLoaded   = true;
    }

    // إضافة حدث النقر على الساعتين
    ['analogClockWrapper','analogClock','digitalClockWrapper'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._clockListened) {
            el.addEventListener('click', toggleClockMode);
            el._clockListened = true;
        }
    });

    _applyClockMode();
}

function stopClock() {
    if (_clockRaf) { cancelAnimationFrame(_clockRaf); _clockRaf = null; }
    _stopDigitalClock();
    const analog  = document.getElementById('analogClockWrapper');
    const digital = document.getElementById('digitalClockWrapper');
    if (analog)  analog.style.display  = 'none';
    if (digital) digital.style.display = 'none';
}

function _tickClock() {
    _drawClock();
    _clockRaf = requestAnimationFrame(_tickClock);
}

function _drawClock() {
    const canvas = document.getElementById('analogClock');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;   // 84px (2× للشاشات عالية الدقة)
    const cx  = W / 2, cy = W / 2;
    const R   = W / 2 - 3;

    const isDark   = document.documentElement.getAttribute('data-theme') !== 'light';
    const handClr  = isDark ? '#ffffff' : '#1a1a1a';
    const tickClr  = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
    const rimClr   = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
    const secClr   = '#d32f2f';

    ctx.clearRect(0, 0, W, W);

    // ── خلفية اللوجو شفافة ──
    if (_clockLogo && _clockLogo.complete && _clockLogo.naturalWidth) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R + 2, 0, 2 * Math.PI);
        ctx.clip();
        ctx.globalAlpha = 0.28;
        ctx.drawImage(_clockLogo, cx - R, cy - R, R * 2, R * 2);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ── إطار الساعة ──
    ctx.strokeStyle = rimClr;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.stroke();

    // ── علامات الساعات (12 علامة) ──
    for (let i = 0; i < 12; i++) {
        const angle  = (i * 30 - 90) * Math.PI / 180;
        const isMain = i % 3 === 0;        // 12، 3، 6، 9
        const len    = isMain ? 7 : 4;
        const x1 = cx + (R - len) * Math.cos(angle);
        const y1 = cy + (R - len) * Math.sin(angle);
        const x2 = cx + R * Math.cos(angle);
        const y2 = cy + R * Math.sin(angle);
        ctx.strokeStyle = tickClr;
        ctx.lineWidth   = isMain ? 2 : 1;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    const now = new Date();
    const hr  = now.getHours() % 12;
    const mn  = now.getMinutes();
    const sc  = now.getSeconds();
    const ms  = now.getMilliseconds();

    // ── عقرب الساعات ──
    _drawHand(ctx, cx, cy,
        (hr * 30 + mn * 0.5) * Math.PI / 180 - Math.PI / 2,
        R * 0.50, 3.5, handClr);

    // ── عقرب الدقائق ──
    _drawHand(ctx, cx, cy,
        (mn * 6 + sc * 0.1) * Math.PI / 180 - Math.PI / 2,
        R * 0.68, 2.5, handClr);

    // ── عقرب الثواني (ناعم بالـ ms) ──
    _drawHand(ctx, cx, cy,
        ((sc + ms / 1000) * 6) * Math.PI / 180 - Math.PI / 2,
        R * 0.76, 1.2, secClr);

    // ── نقطة المركز ──
    ctx.fillStyle = handClr;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = secClr;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
    ctx.fill();
}

function _drawHand(ctx, cx, cy, angle, length, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur  = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + length * Math.cos(angle), cy + length * Math.sin(angle));
    ctx.stroke();
    ctx.shadowBlur  = 0;
}
