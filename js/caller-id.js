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

/* تحويلة هذا الجهاز (تُضبط مرّة واحدة لكل كمبيوتر — مخزّنة محلياً) */
function _cidDeviceExtension() {
    try { return (localStorage.getItem('Shaab_DeviceExtension') || '').trim(); } catch { return ''; }
}

/* التحويلة الفعّالة: تحويلة الجهاز أولاً (الأدقّ مع تبادل الموظفين)، وإلا تحويلة الحساب */
function _cidMyExtension() {
    const dev = _cidDeviceExtension();
    if (dev) return dev;
    try {
        const me = (employees || []).find(e => e.empId === currentUser?.empId);
        return me?.extension ? String(me.extension).trim() : '';
    } catch { return ''; }
}

/* ضبط/تغيير تحويلة هذا الجهاز */
function cidSetDeviceExtension() {
    const cur = _cidDeviceExtension();
    const v = prompt('📟 تحويلة هذا الجهاز\nاكتب الرقم الداخلي للهاتف المجاور لهذا الكمبيوتر (مثال: 101).\nاتركه فارغاً لإلغاء الربط:', cur);
    if (v === null) return;
    const val = v.trim();
    try {
        if (val) localStorage.setItem('Shaab_DeviceExtension', val);
        else localStorage.removeItem('Shaab_DeviceExtension');
    } catch {}
    _cidUpdateExtBtn();
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
        #_cidExtBtn {
            position:fixed; bottom:58px; inset-inline-start:18px; z-index:99990;
            background:rgba(33,33,33,.92); color:#e8c79a; border:1px solid rgba(193,124,50,.5);
            cursor:pointer; border-radius:30px; padding:8px 14px; font-family:'Cairo',sans-serif;
            font-size:12px; font-weight:700; box-shadow:0 4px 16px rgba(0,0,0,.4);
        }
        #_cidExtBtn:hover { background:rgba(60,40,20,.95); }
    `;
    document.head.appendChild(s);
}

function _cidUpdateExtBtn() {
    const eb = document.getElementById('_cidExtBtn');
    if (!eb) return;
    const ext = _cidDeviceExtension();
    eb.textContent = '📟 تحويلة الجهاز: ' + (ext || 'غير محددة');
    eb.style.color = ext ? '#7bd88f' : '#e8a0a0';
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
    // التحويلة تُختار الآن عند تسجيل الدخول (loginExtension) — لا حاجة لزر ضبط يدوي.
}

/* ════════════════════════════════════════════════════════════════
   الاتصال الصادر (Click-to-Dial) — زر «اتصال بالزبون» على بطاقة العميل
   ════════════════════════════════════════════════════════════════ */

/* حوّل الرقم لصيغة الطلب على المقسم:
   - تحويلة داخلية قصيرة (≤5 خانات) → كما هي بلا زيادة (مثال 177 → 177)
   - رقم خارجي/خليوي → نضيف 9 للحصول على خط خارجي (مثال 0795959559 → 90795959559) */
function _cidDialNumber(raw) {
    let s = String(raw || '');
    s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); // أرقام عربية → لاتينية
    s = s.replace(/[\s\-()+]/g, '');
    if (!s) return '';
    if (s.length <= 5) return s;   // تحويلة داخلية
    return '9' + s;                // رقم خارجي → 9 قبله
}

/* صندوق تأكيد بسيط بثيم النظام */
function _cidConfirm(titleHtml, bodyHtml, okText, onOk) {
    let ov = document.getElementById('_cidConfirmOverlay');
    if (ov) ov.remove();
    _cidEnsureCallDialStyles();
    ov = document.createElement('div');
    ov.id = '_cidConfirmOverlay';
    ov.innerHTML = `
        <div class="cidc-box" onclick="event.stopPropagation()">
            <div class="cidc-title">${titleHtml}</div>
            <div class="cidc-body">${bodyHtml}</div>
            <div class="cidc-btns">
                <button class="cidc-ok">${okText}</button>
                <button class="cidc-cancel">إلغاء</button>
            </div>
        </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('.cidc-cancel').onclick = () => ov.remove();
    ov.querySelector('.cidc-ok').onclick = () => { ov.remove(); try { onOk(); } catch {} };
    document.body.appendChild(ov);
}

function _cidToast(msg) {
    _cidEnsureCallDialStyles();
    const t = document.createElement('div');
    t.className = '_cidToast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3200);
}

/* الزر الرئيسي: يؤكّد ثم يأمر المقسم بالاتصال (يرنّ هاتف الموظف أولاً ثم يطلب الرقم) */
function cidPlaceCall(phone, name) {
    if (!(typeof IS_LOCAL !== 'undefined' && IS_LOCAL) && !_cidAuthorized()) return;
    phone = phone || window._c360CurrentPhone || '';
    name  = name  || window._c360CurrentName  || '';
    if (!phone) { alert('لا يوجد رقم للاتصال'); return; }

    const myExt = _cidMyExtension();
    if (!myExt) { alert('⚠️ لم تُضبط تحويلتك الداخلية في النظام — لا يمكن إجراء الاتصال.\nتواصل مع المدير لإضافة تحويلتك.'); return; }

    const dial = _cidDialNumber(phone);
    const who = name ? `<b>${name}</b>` : 'الزبون';
    _cidConfirm(
        '📞 تأكيد الاتصال',
        `هل تريد الاتصال بـ ${who}؟<div class="cidc-num">${phone}</div>
         <div class="cidc-note">سيرنّ هاتفك (تحويلة ${myExt}) أولاً، وعند رفعه يطلب المقسم الرقم تلقائياً.</div>`,
        '📞 اتصال',
        async () => {
            if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) {
                _cidToast(`محاكاة: أمر اتصال بالرقم ${dial} (تحويلة ${myExt})`);
                return;
            }
            try {
                const r = await fetch('api/cti/make-call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
                    body: JSON.stringify({ ext: myExt, phone, dial })
                });
                if (!r.ok) throw new Error('' + r.status);
                _cidToast(`📞 جارٍ الاتصال... ارفع سماعة هاتفك (تحويلة ${myExt})`);
            } catch { alert('تعذّر إرسال أمر الاتصال — تأكد من الاتصال بالسيرفر/المقسم.'); }
        }
    );
}

function _cidEnsureCallDialStyles() {
    if (document.getElementById('_cidDialStyles')) return;
    const s = document.createElement('style');
    s.id = '_cidDialStyles';
    s.textContent = `
        #_cidConfirmOverlay {
            position:fixed; inset:0; z-index:1000020; direction:rtl;
            background:rgba(8,5,2,.6); backdrop-filter:blur(4px);
            display:flex; align-items:center; justify-content:center; padding:20px;
            font-family:'Cairo','Tajawal',sans-serif;
        }
        #_cidConfirmOverlay .cidc-box {
            background:linear-gradient(160deg,#1c1206,#0e0a04); color:#eee;
            border:1px solid rgba(193,124,50,.5); border-radius:20px;
            padding:24px; max-width:380px; width:92%; text-align:center;
            box-shadow:0 12px 50px rgba(0,0,0,.6);
        }
        #_cidConfirmOverlay .cidc-title { font-size:19px; font-weight:900; color:#e8c79a; margin-bottom:12px; }
        #_cidConfirmOverlay .cidc-body { font-size:14px; line-height:1.7; color:#ddd; }
        #_cidConfirmOverlay .cidc-num {
            font-size:22px; font-weight:800; color:#fff; direction:ltr; unicode-bidi:plaintext;
            margin:10px 0; letter-spacing:.5px;
        }
        #_cidConfirmOverlay .cidc-note { font-size:12px; color:#aaa; margin-top:8px; }
        #_cidConfirmOverlay .cidc-btns { display:flex; gap:10px; margin-top:20px; }
        #_cidConfirmOverlay .cidc-ok {
            flex:1; background:linear-gradient(135deg,#2e7d32,#1b5e20); color:#fff; border:none;
            border-radius:12px; padding:12px; font-family:'Cairo'; font-size:15px; font-weight:800; cursor:pointer;
        }
        #_cidConfirmOverlay .cidc-cancel {
            flex:1; background:rgba(255,255,255,.08); color:#ddd; border:none;
            border-radius:12px; padding:12px; font-family:'Cairo'; font-size:15px; font-weight:700; cursor:pointer;
        }
        ._cidToast {
            position:fixed; bottom:74px; inset-inline-start:18px; z-index:1000021;
            background:linear-gradient(135deg,#1b5e20,#2e7d32); color:#fff;
            padding:12px 18px; border-radius:14px; font-family:'Cairo'; font-size:13px; font-weight:700;
            box-shadow:0 6px 20px rgba(0,0,0,.45); direction:rtl; max-width:320px;
            transition:opacity .4s; opacity:1;
        }
    `;
    document.head.appendChild(s);
}

/* ── تسجيل عالمي + إقلاع ── */
if (typeof window !== 'undefined') {
    window._onIncomingCall      = _onIncomingCall;
    window.cidSimulate          = cidSimulate;
    window.cidPlaceCall         = cidPlaceCall;
    window.cidSetDeviceExtension = cidSetDeviceExtension;
    window._cidMountSimButton   = _cidMountSimButton;

    const _cidBoot = () => { try { _cidMountSimButton(); } catch {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_cidBoot, 1500));
    else setTimeout(_cidBoot, 1500);
    let _cidTries = 0;
    const _cidIv = setInterval(() => { _cidBoot(); if (++_cidTries > 20 || document.getElementById('_cidSimBtn')) clearInterval(_cidIv); }, 3000);
}
