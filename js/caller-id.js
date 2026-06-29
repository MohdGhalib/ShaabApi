/* ══════════════════════════════════════════════════════════════════
   CALLER-ID — رقم المتصل يُملأ تلقائياً في شاشة الاستفسارات (Panasonic KX-NS500)
   ══════════════════════════════════════════════════════════════════
   - برنامج الجسر يستدعي POST /api/cti/incoming-call → يُبَثّ حدث SSE 'incoming-call'
   - data.js يمرّر الحدث إلى window._onIncomingCall (مُسجَّل أدناه)
   - السلوك: ننتقل لشاشة الاستفسارات ونضع الرقم في خانة الهاتف (#iPhone) ونشغّل
     البحث المباشر، فتظهر استفسارات الزبون السابقة أسفل الرقم (ميزة موجودة مسبقاً).
   - التوجيه بالتحويلة: يُملأ على شاشة الموظف الذي رنّ داخليّه فقط.
   - متاح فقط لـ cc_manager / cc_employee / admin.
   - زر «📞 محاكاة اتصال» (محلياً «معاينة») لاختبار المسار قبل وصل المقسم. */

function _cidAuthorized() {
    const role  = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : null;
    const admin = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.isAdmin : false;
    return admin || role === 'cc_manager' || role === 'cc_employee';
}

function _cidNorm(p) {
    if (typeof _c360NormalizePhone === 'function') return _c360NormalizePhone(p);
    return String(p || '').replace(/[\s\-+()]/g, '').replace(/^0+/, '');
}

/* تحويلة الموظف الحالي (إن خُصِّصت في صفحة الموظفين) */
function _cidMyExtension() {
    try {
        const me = (employees || []).find(e => e.empId === currentUser?.empId);
        return me?.extension ? String(me.extension).trim() : '';
    } catch { return ''; }
}

/* ── وضع رقم المتصل في خانة هاتف الاستفسار وتشغيل البحث المباشر ── */
function _cidFillInquiryPhone(phone) {
    // انتقل لشاشة الاستفسارات (إن لم تكن مفتوحة)
    if (typeof switchTab === 'function') { try { switchTab('i'); } catch {} }

    const apply = () => {
        const inp = document.getElementById('iPhone');
        if (!inp) return false;
        inp.value = phone;
        // شغّل نفس منطق الإدخال اليدوي: البحث المباشر + تحقّق الرقم
        if (typeof _iLivePhoneSearch === 'function') _iLivePhoneSearch(phone);
        if (typeof _validatePhoneLive === 'function') _validatePhoneLive('iPhone', 'iPhoneErr');
        try { inp.focus(); } catch {}
        // وميض بصري مؤقت لتنبيه الموظف أن الرقم وصل من مكالمة
        inp.style.transition = 'background .35s';
        inp.style.background = 'rgba(193,124,50,.28)';
        setTimeout(() => { inp.style.background = ''; }, 1600);
        return true;
    };
    // لو لم تُبنَ الشاشة بعد، أعد المحاولة بعد لحظة
    if (!apply()) setTimeout(apply, 300);
}

/* ── منع تكرار البثّ (إعادة بثّ نفس الرقم خلال 8 ثوانٍ) ── */
let _cidLast = { norm: '', ts: 0 };

/* نقطة الدخول — يستدعيها data.js عند حدث incoming-call */
function _onIncomingCall(info) {
    if (!IS_LOCAL && !_cidAuthorized()) return;
    info = info || {};
    const phone = (info.phone || '').trim();
    const norm  = info.norm || _cidNorm(phone);
    if (!norm) return;

    // التوجيه بالتحويلة: لو الحدث يحمل تحويلة وموظفي مختلف → ليست لي
    const ext   = (info.ext || '').toString().trim();
    const myExt = _cidMyExtension();
    if (ext && myExt && ext !== myExt) return;

    // منع التكرار
    const now = info.ts || Date.now();
    if (_cidLast.norm === norm && (now - _cidLast.ts) < 8000) return;
    _cidLast = { norm, ts: now };

    if (typeof _playSound === 'function') { try { _playSound(); } catch {} }

    _cidFillInquiryPhone(phone || norm);
}

/* ── محاكاة اتصال (اختبار / معاينة) ── */
async function cidSimulate() {
    if (!IS_LOCAL && !_cidAuthorized()) return;
    const phone = prompt('محاكاة مكالمة واردة — أدخل رقم الهاتف:');
    if (phone === null) return;
    const ext = _cidMyExtension(); // محاكاة على تحويلتي إن وُجدت

    // محلياً (file://): لا سيرفر/SSE — نفّذ مباشرة
    if (IS_LOCAL) { _onIncomingCall({ phone, ext, ts: Date.now() }); return; }
    try {
        await fetch('api/cti/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
            body: JSON.stringify({ phone, ext })
        });
        // النتيجة تصل تلقائياً عبر حدث SSE incoming-call فيُملأ الحقل
    } catch { alert('تعذّرت المحاكاة — تأكد من الاتصال بالسيرفر'); }
}

/* ── زر المحاكاة العائم ── */
function _cidEnsureBtnStyle() {
    if (document.getElementById('cidBtnStyle')) return;
    const s = document.createElement('style');
    s.id = 'cidBtnStyle';
    s.textContent = `
        #_cidSimBtn {
            position:fixed; bottom:18px; inset-inline-start:18px; z-index:99990;
            background:rgba(193,124,50,.92); color:#fff; border:none; cursor:pointer;
            border-radius:30px; padding:9px 15px; font-family:'Cairo',sans-serif;
            font-size:13px; font-weight:700; box-shadow:0 4px 16px rgba(0,0,0,.4);
        }
        #_cidSimBtn:hover { background:#c17c32; }
    `;
    document.head.appendChild(s);
}

function _cidMountSimButton() {
    if (document.getElementById('_cidSimBtn')) return;
    // محلياً: أظهر الزر لأي مستخدم للمعاينة. على السيرفر: لطاقم الكول سنتر/الأدمن فقط.
    if (!IS_LOCAL && !_cidAuthorized()) return;
    _cidEnsureBtnStyle();
    const b = document.createElement('button');
    b.id = '_cidSimBtn';
    b.type = 'button';
    b.textContent = IS_LOCAL ? '📞 معاينة اتصال' : '📞 محاكاة اتصال';
    b.title = 'وضع رقم متصل تجريبي في خانة الاستفسار (قبل وصل المقسم)';
    b.onclick = cidSimulate;
    document.body.appendChild(b);
}

/* ── تسجيل عالمي + إقلاع ── */
if (typeof window !== 'undefined') {
    window._onIncomingCall    = _onIncomingCall;
    window.cidSimulate        = cidSimulate;
    window._cidMountSimButton = _cidMountSimButton;

    const _cidBoot = () => { try { _cidMountSimButton(); } catch {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_cidBoot, 1500));
    else setTimeout(_cidBoot, 1500);
    let _cidTries = 0;
    const _cidIv = setInterval(() => { _cidBoot(); if (++_cidTries > 20 || document.getElementById('_cidSimBtn')) clearInterval(_cidIv); }, 3000);
}
