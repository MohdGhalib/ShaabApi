/* ══════════════════════════════════════════════════════════════════
   CALLER-ID — شاشة ملف الزبون عند ورود مكالمة (Panasonic KX-NS500)
   ══════════════════════════════════════════════════════════════════
   - برنامج الجسر يستدعي POST /api/cti/incoming-call → يُبَثّ حدث SSE 'incoming-call'
   - data.js يمرّر الحدث إلى window._onIncomingCall (مُسجَّل أدناه)
   - السلوك: تظهر نفس شاشة «ملف الزبون» (customer360) في «وضع المكالمة»:
       • زبون له اسم محفوظ → يظهر الاسم بخط واضح + تفاصيله + زر «موافق».
       • زبون بلا اسم → خانة إدخال اسم + حفظ، ولا يمكن الإغلاق قبل الحفظ.
   - بعد «موافق» → يُملأ الرقم في خانة هاتف الاستفسار ويُقفل (غير قابل للتعديل).
   - التوجيه بالتحويلة: تظهر على شاشة الموظف الذي رنّ داخليّه فقط.
   - متاح فقط لـ cc_manager / cc_employee / admin. */

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

/* جلب جهة الاتصال من دفتر الهاتف (أحدث اسم محفوظ) — كائن أو null */
async function _cidFetchContact(norm) {
    if (!norm || (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) || !_token) return null;
    try {
        const r = await fetch('api/contacts/' + encodeURIComponent(norm), {
            headers: { 'Authorization': `Bearer ${_token}` }
        });
        if (!r.ok) return null;
        return await r.json(); // null إن لم تُسجَّل
    } catch { return null; }
}

/* ── وضع الرقم في خانة الاستفسار وقفله (غير قابل للتعديل) ── */
function _cidFillInquiryPhoneLocked(phone) {
    if (typeof switchTab === 'function') { try { switchTab('i'); } catch {} }
    const apply = () => {
        const inp = document.getElementById('iPhone');
        if (!inp) return false;
        inp.value = phone;
        inp.readOnly = true;
        inp.setAttribute('data-cid-lock', '1');
        inp.style.background = 'rgba(193,124,50,.14)';
        inp.style.cursor = 'not-allowed';
        inp.title = 'رقم وارد من مكالمة — غير قابل للتعديل';
        if (typeof _iLivePhoneSearch === 'function') _iLivePhoneSearch(phone);
        if (typeof _validatePhoneLive === 'function') _validatePhoneLive('iPhone', 'iPhoneErr');
        return true;
    };
    if (!apply()) setTimeout(apply, 300);
}

/* ── منع تكرار البثّ (نفس الرقم خلال 8 ثوانٍ) ── */
let _cidLast = { norm: '', ts: 0 };

/* نقطة الدخول — يستدعيها data.js عند حدث incoming-call */
async function _onIncomingCall(info) {
    if (!(typeof IS_LOCAL !== 'undefined' && IS_LOCAL) && !_cidAuthorized()) return;
    info = info || {};
    const phone = (info.phone || '').trim();
    const norm  = info.norm || _cidNorm(phone);
    if (!norm) return;

    // التوجيه بالتحويلة: لو الحدث يحمل تحويلة وتحويلتي مختلفة → ليست لي
    const ext   = (info.ext || '').toString().trim();
    const myExt = _cidMyExtension();
    if (ext && myExt && ext !== myExt) return;

    // منع التكرار
    const now = info.ts || Date.now();
    if (_cidLast.norm === norm && (now - _cidLast.ts) < 8000) return;
    _cidLast = { norm, ts: now };

    if (typeof _playSound === 'function') { try { _playSound(); } catch {} }

    // اجلب الاسم المحفوظ من دفتر الهاتف ثم افتح شاشة ملف الزبون في «وضع المكالمة»
    const contact = await _cidFetchContact(norm);
    if (typeof openCustomer360 === 'function') {
        openCustomer360(phone || norm, {
            callMode: true,
            contact,
            onConfirm: (ph) => _cidFillInquiryPhoneLocked(ph)
        });
    }
}

/* ── محاكاة اتصال (اختبار / معاينة) ── */
async function cidSimulate() {
    if (!(typeof IS_LOCAL !== 'undefined' && IS_LOCAL) && !_cidAuthorized()) return;
    const phone = prompt('محاكاة مكالمة واردة — أدخل رقم الهاتف:');
    if (phone === null) return;
    const ext = _cidMyExtension();

    // محلياً (file://): لا سيرفر/SSE — نفّذ مباشرة
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) { _onIncomingCall({ phone, ext, ts: Date.now() }); return; }
    try {
        await fetch('api/cti/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
            body: JSON.stringify({ phone, ext })
        });
        // النتيجة تصل تلقائياً عبر حدث SSE incoming-call
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
    const local = (typeof IS_LOCAL !== 'undefined' && IS_LOCAL);
    if (!local && !_cidAuthorized()) return;
    _cidEnsureBtnStyle();
    const b = document.createElement('button');
    b.id = '_cidSimBtn';
    b.type = 'button';
    b.textContent = local ? '📞 معاينة اتصال' : '📞 محاكاة اتصال';
    b.title = 'اختبار شاشة المكالمة الواردة (قبل وصل المقسم)';
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
