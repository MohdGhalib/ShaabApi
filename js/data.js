/* ══════════════════════════════════════════════════════
   DATA — Global state & server storage helpers
══════════════════════════════════════════════════════ */
const PASSWORD_HASH = "8e5fe6d011f3e8594da9a40337bf1007107d014ee56afd1e084205062c3efbf5";
let db          = { m:[], i:[], c:[], auditLog:[] };
let employees   = [];
let breaks      = [];
let sessions    = [];
let priceList   = [];
let currentUser = null;

/* ── سجل التدقيق ── */
function _logAudit(action, entity, summary) {
    if (!db.auditLog) db.auditLog = [];
    db.auditLog.push({
        action,
        entity,
        summary,
        by:    currentUser ? currentUser.name : '—',
        empId: currentUser?.empId || '',
        role:  currentUser?.role  || '',
        time:  now(),
        iso:   iso(),
        ts:    Date.now()
    });
    // الاحتفاظ بسجلات آخر 7 أيام لكل موظف
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    db.auditLog = db.auditLog.filter(e => (e.ts || 0) >= cutoff);
}

/* ── صوت الإشعار (consideration.mp3) ── */
let _notifAudio    = null;
let _audioUnlocked = false;

// نُهيئ الـ Audio ونفتحه عند أول تفاعل لتفادي قيود autoplay
function _unlockAudio() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    try {
        if (!_notifAudio) _notifAudio = new Audio('audio/consideration.mp3');
        const p = _notifAudio.play();
        if (p) p.then(() => { _notifAudio.pause(); _notifAudio.currentTime = 0; }).catch(() => {});
    } catch(e) {}
}
document.addEventListener('click',      _unlockAudio, { capture: true });
document.addEventListener('keydown',    _unlockAudio, { capture: true });
document.addEventListener('touchstart', _unlockAudio, { capture: true });

function _playSound() {
    try {
        if (!_notifAudio) _notifAudio = new Audio('audio/consideration.mp3');
        _notifAudio.currentTime = 0;
        _notifAudio.play().catch(() => {});
    } catch(e) {}
}

/* ── إشعارات المتصفح ── */
let _prevCounts = { montasiat: -1, complaints: -1, auditedC: -1, controlC: -1, myAuditedC: -1 };
let _skipMontasiaNotif = false;

/* ── منع تكرار الإشعارات لنفس السجل (يستمر بين الجلسات) ── */
const _NOTIFIED_KEY = '_shaabNotifiedIds';
let _notifiedIds = { m: new Set(), c: new Set() };
try {
    const raw = JSON.parse(localStorage.getItem(_NOTIFIED_KEY) || '{}');
    _notifiedIds.m = new Set(raw.m || []);
    _notifiedIds.c = new Set(raw.c || []);
} catch {}
function _wasNotified(type, id) { return _notifiedIds[type]?.has(id); }
function _markNotified(type, id) {
    if (!_notifiedIds[type]) _notifiedIds[type] = new Set();
    _notifiedIds[type].add(id);
    // الحدّ الأقصى لكل نوع 2000 معرّف (نحتفظ بأحدث 1000 لتفادي تضخّم localStorage)
    if (_notifiedIds[type].size > 2000) {
        _notifiedIds[type] = new Set(Array.from(_notifiedIds[type]).slice(-1000));
    }
    try {
        localStorage.setItem(_NOTIFIED_KEY, JSON.stringify({
            m: Array.from(_notifiedIds.m),
            c: Array.from(_notifiedIds.c)
        }));
    } catch {}
}

function _checkNotifications() {
    if (!currentUser) return;

    const role    = currentUser.role;
    const isAdmin = currentUser.isAdmin;

    const isCcOrMedia     = isAdmin || role === 'cc_manager' || role === 'media';
    const isControlRole   = role === 'control_employee' || role === 'control_sub' || role === 'control';

    // ── عدادات ──
    // نحسب كل المنتسيات غير المحذوفة (أي حالة) لكشف الجديد فور إرساله من أي مصدر
    const pendingM    = (db.montasiat  || []).filter(x => !x.deleted).length;
    const auditedC    = (db.complaints || []).filter(x => !x.deleted && x.audit).length;
    const controlC    = (db.complaints || []).filter(x => !x.deleted).length;
    // عدد ردود السيطرة على شكاوي الميديا الحالي تحديداً
    const myAuditedC  = role === 'media'
        ? (db.complaints || []).filter(x => !x.deleted && x.audit && x.addedBy === currentUser.name).length
        : -1;

    if (_prevCounts.montasiat >= 0) {
        // منتسية جديدة → كول سنتر + ميديا
        // عند SSE نشط: الإشعار يأتي من new-montasia مباشرة (أفضل للصوت)
        // عند انقطاع SSE: polling يتولى الإشعار هنا
        if (isCcOrMedia && pendingM > _prevCounts.montasiat && !_sseActive && !_skipMontasiaNotif) {
            _playSound();
            _showMontasiaPopup({ branch: '', city: '', type: '', notes: '' });
        }
        _skipMontasiaNotif = false;
        // رد جديد على شكوى (audit) → كول سنتر + أدمن: أي رد / ميديا: ردود على شكاويه هو فقط
        const _auditTriggered = role === 'media'
            ? (myAuditedC > _prevCounts.myAuditedC && _prevCounts.myAuditedC >= 0)
            : (isCcOrMedia && auditedC > _prevCounts.auditedC);
        if (_auditTriggered) {
            _playSound();
            if (Notification.permission === 'granted')
                new Notification('محامص الشعب', { body: role === 'media' ? 'تم الرد على شكواك في قسم السيطرة' : 'تم الرد على شكوى', icon: 'img/logo.png' });
        }
        // شكوى جديدة → قسم السيطرة
        if (isControlRole && controlC > _prevCounts.controlC) {
            _playSound();
            if (Notification.permission === 'granted')
                new Notification('محامص الشعب', { body: `شكوى جديدة في قسم السيطرة`, icon: 'img/logo.png' });
        }
    }

    // طلب إذن المتصفح إن لم يُمنح
    if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});

    _prevCounts.montasiat  = pendingM;
    _prevCounts.auditedC   = auditedC;
    _prevCounts.controlC   = controlC;
    if (role === 'media') _prevCounts.myAuditedC = myAuditedC;
}

const DEFAULT_PRICE_LIST = [
  {name:"قهوة اكسترا",weight:"1 كيلو",price:9.5},
  {name:"قهوة خصوصي",weight:"1 كيلو",price:8.5},
  {name:"قهوة ملوكي",weight:"1 كيلو",price:10.5},
  {name:"هيل سوبر جامبو",weight:"1 كيلو",price:36},
  {name:"هيل تربس",weight:"1 كيلو",price:28},
  {name:"هيل مطحون",weight:"1 كيلو",price:24},
  {name:"قهوة فلسطينية",weight:"500 غرام",price:6},
  {name:"قهوة فلسطينية",weight:"250 غرام",price:3},
  {name:"قهوة عربية",weight:"40 غرام",price:1},
  {name:"قهوة عربية",weight:"250 غرام",price:3},
  {name:"لوز حبة كاملة نخب اول",weight:"1 كيلو",price:7.5},
  {name:"لوز حبة كاملة نخب ثاني",weight:"1 كيلو",price:6.5},
  {name:"لوز ارباع مقشر",weight:"1 كيلو",price:7.5},
  {name:"لوز انصاف مقشر",weight:"1 كيلو",price:7.5},
  {name:"جوز قلب مبروش",weight:"1 كيلو",price:6},
  {name:"جوز قلب ارباع",weight:"1 كيلو",price:6.5},
  {name:"جوز قلب حبة كاملة",weight:"1 كيلو",price:7.5},
  {name:"صنوبر باكستاني",weight:"1 كيلو",price:30},
  {name:"فستق حلبي احمدي",weight:"1 كيلو",price:18},
  {name:"فستق حلبي بوز",weight:"1 كيلو",price:24},
  {name:"كاجو انصاف",weight:"1 كيلو",price:6},
  {name:"كاجو انصاف محمص",weight:"1 كيلو",price:6.5},
  {name:"لوز محمص مدخن",weight:"1 كيلو",price:9.5},
  {name:"لوز محمص حلو",weight:"1 كيلو",price:9.5},
  {name:"لوز محمص مالح",weight:"1 كيلو",price:9.5},
  {name:"فستق سوداني مدخن",weight:"1 كيلو",price:3.5},
  {name:"فستق سوداني حلو",weight:"1 كيلو",price:3},
  {name:"فستق سوداني مالح",weight:"1 كيلو",price:3},
  {name:"فستق سوداني محمص وسط",weight:"1 كيلو",price:3},
  {name:"فستق مياسي",weight:"1 كيلو",price:3},
  {name:"مكاديميا مقشرة",weight:"1 كيلو",price:15},
  {name:"فستق برازيلي نكهات",weight:"1 كيلو",price:3.5},
  {name:"قضامة اسطنبولي",weight:"1 كيلو",price:4},
  {name:"مخلوطة سوبر",weight:"1 كيلو",price:5},
  {name:"مخلوطة سوبر مدخن",weight:"1 كيلو",price:5.5},
  {name:"مخلوطة سوبر الشعب",weight:"1 كيلو",price:6},
  {name:"مخلوطة برازيلي",weight:"1 كيلو",price:7},
  {name:"مخلوطة مكس",weight:"1 كيلو",price:8.5},
  {name:"مخلوطة سوبر اكسترا",weight:"1 كيلو",price:9.5},
  {name:"مخلوطة سوبر ملوكي",weight:"اللوز، الكاجو، الفستق الحلبي، مكاديميا",price:12.5},
  {name:"كاجو سوبر جامبو",weight:"1 كيلو",price:10.5},
  {name:"كاجو سوبر جامبو نكهات",weight:"1 كيلو",price:10.5},
  {name:"كاجو مياسي نكهات",weight:"1 كيلو",price:7.5},
  {name:"زبيب اشقر",weight:"1 كيلو",price:3.5},
  {name:"زبيب اشقر جامبو",weight:"1 كيلو",price:6.5},
  {name:"توت بري",weight:"1 كيلو",price:5.5},
  {name:"زبيب اسود",weight:"1 كيلو",price:4.5},
  {name:"قراصيا",weight:"1 كيلو",price:5.5},
  {name:"تمر مجهول فانسي",weight:"1 كيلو",price:2.5},
  {name:"تمر مجهول جامبو",weight:"1 كيلو",price:4.5},
  {name:"تمر مجهول SF",weight:"1 كيلو",price:4},
  {name:"تمر مجهول سوبر جامبو",weight:"1 كيلو",price:6},
  {name:"تمر رطب ملكي باكيت",weight:"1 كيلو",price:3},
  {name:"تمر عجوة المدينة باكيت",weight:"850 غرام",price:5.5},
  {name:"تمر عجوة المدينة باكيت",weight:"400 غرام",price:3},
  {name:"جنا رطب سكري علب",weight:"1.50 كيلو",price:3},
  {name:"شوكولاتة دراجية بندق",weight:"1 كيلو",price:9.5},
  {name:"شوكولاتة دراجية لوز",weight:"1 كيلو",price:9.5},
  {name:"شوكولاتة الشعب الفاخرة",weight:"1 كيلو",price:7.5},
  {name:"كركم",weight:"1 كيلو",price:2.5},
  {name:"بهارات بخاري",weight:"1 كيلو",price:4.5},
  {name:"ميرامية",weight:"1 كيلو",price:4.5},
  {name:"بهارات شاورما",weight:"1 كيلو",price:4.5},
  {name:"سماق تركي",weight:"1 كيلو",price:6.5},
  {name:"سمسم محمص",weight:"1 كيلو",price:2.75},
  {name:"كركديه",weight:"1 كيلو",price:1.75},
  {name:"زعتر ملوكي",weight:"1 كيلو",price:4},
  {name:"دقة حمراء",weight:"1 كيلو",price:2.5},
  {name:"بهارات بطاطا",weight:"1 كيلو",price:4.5},
  {name:"بابريكا",weight:"1 كيلو",price:3.5},
  {name:"بهارات اوزي",weight:"1 كيلو",price:4.5},
  {name:"بصل ناعم",weight:"1 كيلو",price:2.75},
  {name:"بهارات مشكلة",weight:"1 كيلو",price:4.5},
  {name:"بهارات مقلوبة",weight:"1 كيلو",price:4.5},
  {name:"بهارات منسف",weight:"1 كيلو",price:4.5},
  {name:"بهارات مندي",weight:"1 كيلو",price:4.5},
  {name:"لومي",weight:"1 كيلو",price:4.5},
  {name:"بهارات كبسة",weight:"1 كيلو",price:4.5},
  {name:"زنجبيل مطحون",weight:"1 كيلو",price:4},
  {name:"كمون مطحون",weight:"1 كيلو",price:6.5},
  {name:"كزبرة مطحونة",weight:"1 كيلو",price:2},
  {name:"قرفة مطحونة",weight:"1 كيلو",price:4.5},
  {name:"كراوية مطحونة",weight:"1 كيلو",price:3},
  {name:"فلفل اسود مطحون",weight:"1 كيلو",price:6.5},
  {name:"يانسون مطحون",weight:"1 كيلو",price:4.5},
  {name:"بهارات كبسة مطحونة",weight:"1 كيلو",price:4.5},
  {name:"ثوم مطحون",weight:"1 كيلو",price:2.75},
  {name:"بهارات سمك",weight:"1 كيلو",price:4.5},
  {name:"حلبة",weight:"1 كيلو",price:1.75},
  {name:"كاري",weight:"1 كيلو",price:3},
  {name:"كمون حب",weight:"1 كيلو",price:6.5},
  {name:"كزبرة حب",weight:"1 كيلو",price:2},
  {name:"بهارات دجاج",weight:"1 كيلو",price:4.5},
  {name:"كراوية حب",weight:"1 كيلو",price:3},
  {name:"قزحة",weight:"1 كيلو",price:4.5},
  {name:"فلفل اسود حب",weight:"1 كيلو",price:6.5},
  {name:"بهارات برياني",weight:"1 كيلو",price:4.5},
  {name:"بهارات لحمة",weight:"1 كيلو",price:4.5},
  {name:"ورق غار",weight:"1 كيلو",price:2.5},
  {name:"زعتر بلدي",weight:"1 كيلو",price:2.5},
  {name:"زعتر الضفة",weight:"1 كيلو",price:6.5},
  {name:"نوجا الشعب",weight:"1 كيلو",price:7.5},
  {name:"شوكولاتة دبي",weight:"190 غرام",price:3.5},
  {name:"بزر ابيض حلو",weight:"1 كيلو",price:4},
  {name:"بزر ابيض مالح",weight:"1 كيلو",price:4},
  {name:"بزر ابيض مدخن",weight:"1 كيلو",price:4.5},
  {name:"بزر اسود بلدي",weight:"1 كيلو",price:2.5},
  {name:"بزر افغاني محمص",weight:"1 كيلو",price:4},
  {name:"بزر افغاني محمص مدخن",weight:"1 كيلو",price:4.5},
  {name:"بزر الضفة",weight:"1 كيلو",price:8},
  {name:"بزر ايراني محمص",weight:"1 كيلو",price:4},
  {name:"بزر ايراني مدخن",weight:"1 كيلو",price:4.5},
  {name:"بزر شمام مالح",weight:"1 كيلو",price:4},
  {name:"بزر شمام مدخن",weight:"1 كيلو",price:4.5},
  {name:"بزر عين شمس محمص",weight:"1 كيلو",price:3},
  {name:"بزر عين شمس مدخن",weight:"1 كيلو",price:3.5},
  {name:"بزر مصري محمص",weight:"1 كيلو",price:4},
  {name:"بزر مصري مدخن",weight:"1 كيلو",price:4.5},
  {name:"قهوة سعودية",weight:"250 غرام",price:4.5},
  {name:"قهوة سعودية",weight:"50 غرام",price:1},
  {name:"قهوة امريكية",weight:"420 غرام",price:7},
  {name:"قهوة بريميوم",weight:"250 غرام",price:3},
  {name:"قهوة قطرية",weight:"250 غرام",price:7.5},
  {name:"قهوة فرنسية",weight:"250 غرام",price:4.5},
  {name:"قهوة فرنسية",weight:"100 غرام",price:1.5},
  {name:"كاندي",weight:"1 كيلو",price:5},
  {name:"جيلي علب",weight:"1.200 كيلو",price:2},
  {name:"موالح الفارس",weight:"160 غرام",price:1},
  {name:"تسالي ماليزية حلوة",weight:"500 غرام",price:1},
  {name:"تسالي ماليزية حارة",weight:"500 غرام",price:1.25},
  {name:"بسكوت كليجا نخالة",weight:"12 حبة",price:1.5},
  {name:"بسكوت كليجا بالهيل",weight:"12 حبة",price:1.5},
  {name:"بسكوت نايس",weight:"12 باكيت",price:1},
  {name:"معمول الشعب بالهيل",weight:"20 حبة",price:1},
  {name:"معمول الشعب بالسميد",weight:"20 حبة",price:1},
  {name:"ملبس لوز",weight:"1 كيلو",price:5.5},
  {name:"ملبس قضامة",weight:"1 كيلو",price:3.5},
  {name:"المن و السلوى اللؤلؤة الشامية",weight:"400 غرام",price:2.5},
  {name:"المن و السلوى اهلنا الطيبين",weight:"400 غرام",price:4.5},
  {name:"كاندي مقرمش",weight:"40 غرام",price:1},
  {name:"علكة شعراوي",weight:"150 غرام",price:0.5},
  {name:"سوفت جيلي 100غم",weight:"100 غرام",price:0.5},
  {name:"معمول جوهرة مكة",weight:"20 حبة",price:1},
  {name:"راحة روسي",weight:"250 جرام",price:1},
  {name:"ويفر يوناني",weight:"180 غرام",price:1.5},
  {name:"شوكولاتة ايطالي",weight:"1 كيلو",price:7.5},
  {name:"توفي عماني تشيكو",weight:"750 جرام",price:2.5},
  {name:"أرز الشعب",weight:"10 كيلو",price:10},
  {name:"أرز الشعب",weight:"4 كيلو",price:3.75},
  {name:"ذرة بوشار",weight:"1 كيلو",price:1},
  {name:"ذرة محمصة",weight:"1 كيلو",price:2.5},
  {name:"مشمش مجفف",weight:"1 كيلو",price:10.5},
  {name:"توفي انجليزي",weight:"1 كيلو",price:5.5},
  {name:"بابونج",weight:"1 كيلو",price:4.5},
  {name:"بهارات كيجين",weight:"1 كيلو",price:5.5},
  {name:"زهورات",weight:"1 كيلو",price:4.5},
  {name:"نسكافيه الشعب - بدون سكر",weight:"24 ظرف",price:3},
  {name:"نسكافيه الشعب - شوكولاتة",weight:"24 ظرف",price:4},
  {name:"نسكافية الشعب بالكراميل",weight:"24 ظرف",price:4},
  {name:"نسكافيه الشعب كلاسيك",weight:"24 ظرف",price:3},
  {name:"كوكيز كروفكا",weight:"بنكهة البندق (136 غرام)",price:0.5},
  {name:"كوكيز كروفكا",weight:"بنكهة البرتقال (152 غرام)",price:1},
  {name:"كيك تورتينا",weight:"8 حبات - فانيلا",price:0.75},
  {name:"كيك تورتينا",weight:"8 حبات - مشمش",price:0.75},
  {name:"كيك تورتينا",weight:"8 حبات - شوكولاتة",price:0.75},
  {name:"كيك تورتينا",weight:"8 حبات - فراولة",price:0.75},
  {name:"كاندي صوص",weight:"350 غرام",price:2},
  {name:"آيسكريم الهبة مانجا",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة أناناس",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة ليمون",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة خوخ",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة فراولة",weight:"فواكة",price:1.5},
  {name:"جرانولا",weight:"1 كيلو",price:11.5},
  {name:"ملبس نابليون",weight:"نكهات مشكلة",price:5.5},
  {name:"نشا",weight:"1 كيلو",price:0.75},
  {name:"قهوة بريميوم",weight:"1 كغ",price:12},
  {name:"فستق سوداني ني",weight:"1 كغ",price:2.25},
  {name:"قضامة صفراء",weight:"1 كغ",price:4.5},
  {name:"عصير الجوهر",weight:"720 غرام",price:1},
  {name:"هيل مفتح",weight:"1 كغ",price:20},
  {name:"يانسون حب",weight:"1 كغ",price:4.5},
  {name:"تمر عجوة المدينة",weight:"1 كغ",price:5.5},
  {name:"نسكافية الشعب بالبندق",weight:"24 ظرف",price:4},
  {name:"نسكافية الشعب بجوز الهند",weight:"24 ظرف",price:4},
  {name:"فستق برازيلي محمص",weight:"1 كغ",price:3},
  {name:"أرز الأمل",weight:"10 كغ",price:6.5},
  {name:"أرز الأمل",weight:"5 كغ",price:3.25},
  {name:"تين مجفف",weight:"1 كيلو",price:8.5},
  {name:"قهوة سعودية",weight:"250 جرام",price:4.5},
  {name:"قمر دين شيخ العرب",weight:"مغلف واحد",price:1},
  {name:"افوكادو ايس كريم",weight:"حبة واحدة",price:1.5},
  {name:"جيلي كونجاك بالعصير",weight:"240 غرام",price:1},
  {name:"كرنشي آيسكريم",weight:"50 غرام",price:1.5},
  {name:"تمر مطحون",weight:"1 كيلو",price:1.25},
  {name:"ملبس روسي",weight:"250 جرام",price:1},
  {name:"سوفت جيلي",weight:"1 كغ",price:5.5},
  {name:"توفي سمرقند",weight:"1 كيلو",price:3.5},
  {name:"توفي نحلة",weight:"1 كيلو",price:3.5},
  {name:"توفي اذربيجاني",weight:"1 كيلو",price:3.5},
  {name:"جيلي بينز",weight:"1 كيلو",price:5},
  {name:"شوكولاتة اذربيجاني",weight:"1 كيلو",price:5.5},
  {name:"شوكولاته اوزبكستاني",weight:"1 كيلو",price:5.5},
  {name:"شوكولاتة الشعب سولفان",weight:"1 كيلو",price:5.5},
  {name:"تمرية",weight:"500 غرام",price:3},
  {name:"مكسرات يابانية",weight:"1 كيلو",price:4.5},
  {name:"شوكولاته تونسية فاخرة",weight:"1 كيلو",price:3.5},
  {name:"ملبس بولندي",weight:"1 كيلو",price:3.5},
  {name:"راحه يوناني",weight:"1 كغ",price:3.5},
  {name:"زيت زيتون تونسي",weight:"3 لتر",price:14.5}
];

/* ── دول النظام: لكل دولة label خاص للمستوى الثاني (محافظة/إمارة/منطقة) وقائمة المناطق وفروعها ── */
const COUNTRIES_DATA = {
  "الأردن": {
    regionLabel: "المحافظة",
    regions: {
      "عمان":    ["الرئيسي","جسر البيبسي","ماركا الشمالية","الهاشمي","صويلح","الحرية","خلدا","نزال","الوحدات","مرج الحمام","وادي الرمم","المشاغل","طبربور","الرياضية","المنورة","ابو نصير","شارع المطار","الياسمين","الخريطة","اليادودة","طريق البحر الميت","الحجرة"],
      "اربد":    ["ابو راشد","الطيارة","شارع ال30"],
      "الزرقاء": ["السعادة","شارع 36"],
      "مادبا":   ["مادبا الشرقي","مادبا الغربي"],
      "الكرك":   ["الكرك الثنية","الكرك الوسية"],
      "العقبة":  ["الرئيسي العقبة","البيتزا","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الخلفي"],
      "محافظات بفرع واحد": ["المفرق","الرمثا","جرش","السلط"]
    }
  },
  "السعودية": {
    regionLabel: "المحافظة",
    regions: { "تبوك": ["تبوك"] }
  },
  "الامارات": {
    regionLabel: "الامارة",
    regions: {
      "دبي":     ["البرشا 1","الواجهة البحرية"],
      "الشارقة": ["فرع الشارقة"],
      "ابو ظبي": ["فرع ابو ظبي"]
    }
  },
  "قطر": {
    regionLabel: "المنطقة",
    regions: { "الدوحة": ["الويست ووك","فرع الوكرة","فرع مدينة خليفة"] }
  },
  "البحرين": {
    regionLabel: "المنطقة",
    regions: {
      "الرفاع":   ["الرفاع بوكوارة"],
      "البسيتين": ["البسيتين (الساية)"]
    }
  }
};

/* ── خريطة مسطّحة (city → branches[]) للحفاظ على التوافق مع الكود الحالي ── */
const branches = (function _flat() {
  const out = {};
  for (const c in COUNTRIES_DATA) {
    for (const r in COUNTRIES_DATA[c].regions) {
      out[r] = COUNTRIES_DATA[c].regions[r];
    }
  }
  return out;
})();

/* ── إيجاد الدولة لمحافظة/منطقة/إمارة (للسجلات القديمة بدون country) ── */
function _countryForCity(city) {
  if (!city) return "الأردن";
  for (const c in COUNTRIES_DATA) {
    if (COUNTRIES_DATA[c].regions[city]) return c;
  }
  return "الأردن";
}

/* ── label المستوى الثاني حسب الدولة ── */
function _regionLabelForCountry(country) {
  return (country && COUNTRIES_DATA[country]) ? COUNTRIES_DATA[country].regionLabel : "المحافظة";
}

/* ── كشف وضع التشغيل: محلي أم سيرفر ── */
// IS_LOCAL: صحيح فقط عند فتح الملف مباشرة بدون سيرفر (للتطوير المحلي)
const IS_LOCAL = location.protocol === 'file:';

let _token     = null;
let _isLoading = false;
let _isSaving  = false;          // يمنع SSE من تحميل بيانات قديمة أثناء الحفظ
let _savingTimer = null;
function setToken(t) {
    _token = t;
    if (t) localStorage.setItem('_shaab_token', t);
    else   localStorage.removeItem('_shaab_token');
}
function getSavedToken() { return localStorage.getItem('_shaab_token'); }

/* ── جلب كل البيانات ── */
async function loadAllData() {
    if (_isLoading) return;
    _isLoading = true;
    try {
    const keys = ['Shaab_Master_DB','Shaab_Employees_DB','Shaab_Breaks_DB','Shaab_Sessions_DB'];
    if (IS_LOCAL) {
        db        = localStorage.getItem('Shaab_Master_DB')    ? JSON.parse(localStorage.getItem('Shaab_Master_DB'))    : { montasiat:[], inquiries:[], complaints:[] };
        employees = localStorage.getItem('Shaab_Employees_DB') ? JSON.parse(localStorage.getItem('Shaab_Employees_DB')) : [];
        breaks    = localStorage.getItem('Shaab_Breaks_DB')    ? JSON.parse(localStorage.getItem('Shaab_Breaks_DB'))    : [];
        sessions  = localStorage.getItem('Shaab_Sessions_DB')  ? JSON.parse(localStorage.getItem('Shaab_Sessions_DB'))  : [];
        priceList = localStorage.getItem('Shaab_PriceList_DB') ? JSON.parse(localStorage.getItem('Shaab_PriceList_DB')) : structuredClone(DEFAULT_PRICE_LIST);
    } else {
        // قبل تسجيل الدخول لا يوجد token — نهيئ بيانات فارغة فقط
        if (!_token) {
            db = { montasiat:[], inquiries:[], complaints:[] }; employees = []; breaks = []; sessions = [];
            priceList = structuredClone(DEFAULT_PRICE_LIST);
            if (!db.inqSeq) db.inqSeq = 1;
            return;
        }
        try {
            const res = await fetch('api/storage?keys=' + keys.join(','), {
                headers: { 'Authorization': `Bearer ${_token}` }
            });
            if (res.status === 401) { location.reload(); return; }
            if (!res.ok) throw new Error('Server error ' + res.status);
            const data = await res.json();
            db        = data['Shaab_Master_DB']    ? JSON.parse(data['Shaab_Master_DB'])    : { montasiat:[], inquiries:[], complaints:[] };
            employees = data['Shaab_Employees_DB'] ? JSON.parse(data['Shaab_Employees_DB']) : [];
            breaks    = data['Shaab_Breaks_DB']    ? JSON.parse(data['Shaab_Breaks_DB'])    : [];
            sessions  = data['Shaab_Sessions_DB']  ? JSON.parse(data['Shaab_Sessions_DB'])  : [];
            priceList = data['Shaab_PriceList_DB'] ? JSON.parse(data['Shaab_PriceList_DB']) : structuredClone(DEFAULT_PRICE_LIST);
        } catch(e) {
            console.error('loadAllData failed:', e);
            throw e;
        }
    }
    if (!db.inqSeq) db.inqSeq = 1;
    if (!db.auditLog) db.auditLog = [];
    if (!db.compensations) db.compensations = [];

    // حذف تلقائي: إزالة العناصر المحذوفة منذ أكثر من 30 يوماً
    const _purgeCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const _shouldPurge = (x) => x.deleted && x.deletedAtTs && x.deletedAtTs < _purgeCutoff;
    const _beforePurge = (db.montasiat||[]).length + (db.inquiries||[]).length + (db.complaints||[]).length;
    if (db.montasiat)  db.montasiat  = db.montasiat.filter(x => !_shouldPurge(x));
    if (db.inquiries)  db.inquiries  = db.inquiries.filter(x => !_shouldPurge(x));
    if (db.complaints) db.complaints = db.complaints.filter(x => !_shouldPurge(x));
    const _afterPurge  = (db.montasiat||[]).length + (db.inquiries||[]).length + (db.complaints||[]).length;
    if (_afterPurge < _beforePurge) _push('Shaab_Master_DB', JSON.stringify(db));

    // ترحيل تلقائي: إعادة تسمية المفاتيح القصيرة القديمة (مرة واحدة فقط)
    if (Array.isArray(db.m)) {
        db.montasiat  = db.m;  delete db.m;
        db.inquiries  = db.i;  delete db.i;
        db.complaints = db.c;  delete db.c;
        _push('Shaab_Master_DB', JSON.stringify(db));
    }

    // ترحيل تلقائي: إضافة salt للموظفين القدامى (بعد تسجيل الدخول فقط)
    if (_token || IS_LOCAL) {
        const needsMigration = employees.some(e => !e.salt);
        if (needsMigration) {
            for (const e of employees) {
                if (!e.salt) {
                    e.salt = generateSalt();
                    e.passwordHash = await hashPassword(e.salt + e.empId);
                }
            }
            saveEmployees();
        }
    }

    // إنشاء حساب مدير الكول سنتر الافتراضي إذا لم يكن موجوداً
    if (IS_LOCAL && !employees.some(e => e.empId === '0799')) {
        const _s = generateSalt();
        employees.unshift({
            id: 7990000001,
            name: 'مدير الكول سنتر',
            title: 'مدير الكول سنتر',
            empId: '0799',
            addedBy: null,
            salt: _s,
            passwordHash: await hashPassword(_s + '0799')
        });
        saveEmployees();
    }
    } finally {
        _isLoading = false;
    }
}

/* ── حفظ البيانات ── */
function _push(key, value) {
    if (IS_LOCAL) {
        localStorage.setItem(key, value);
    } else {
        // ضبط علامة الحفظ الجاري لمنع SSE من تحميل بيانات قديمة
        _isSaving = true;
        clearTimeout(_savingTimer);
        // ضمان: إعادة الضبط بعد 5 ثوانٍ كحد أقصى حتى لو فشل الطلب بصمت
        _savingTimer = setTimeout(() => { _isSaving = false; }, 5000);
        fetch('api/storage', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
            body:    JSON.stringify({ key, value })
        }).then(r => {
            _isSaving = false;
            clearTimeout(_savingTimer);
            if (!r.ok) _showSaveError();
        }).catch(() => {
            _isSaving = false;
            clearTimeout(_savingTimer);
            _showSaveError();
        });
    }
}

function _showSaveError() {
    let el = document.getElementById('_saveErrToast');
    if (!el) {
        el = document.createElement('div');
        el.id = '_saveErrToast';
        el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#c62828;color:#fff;padding:10px 22px;border-radius:10px;font-family:Cairo;font-size:14px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
        el.textContent   = '⚠️ فشل الحفظ — تحقق من الاتصال';
        document.body.appendChild(el);
    }
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function save() {
    _push('Shaab_Master_DB', JSON.stringify(db));
    renderAll();
    // تحديث الشارات مباشرةً بعد الحفظ بصرف النظر عن وضع التبويب الحالي
    if (typeof _updateBadges === 'function') _updateBadges();
}
function saveEmployees() { _push('Shaab_Employees_DB', JSON.stringify(employees)); }
function saveBreaks()    { _push('Shaab_Breaks_DB',    JSON.stringify(breaks));    }
function saveSessions()  { _push('Shaab_Sessions_DB',  JSON.stringify(sessions));  }
function savePriceList() { _push('Shaab_PriceList_DB', JSON.stringify(priceList)); }

function _toLatinDigits(str) {
    return String(str)
        .replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660)  // Eastern Arabic ٠-٩
        .replace(/[\u06F0-\u06F9]/g, d => d.charCodeAt(0) - 0x06F0)  // Extended Arabic-Indic ۰-۹
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '');                 // RTL/LTR marks
}

function _fmtTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`;
}

function _timeToAmPm(str) {
    if (!str) return str;
    if (/\b(AM|PM)\b/i.test(str)) return str;
    return str.replace(/(\d{1,2}):(\d{2})(?::(\d{2}))?(\s|$|،)/, (_, h, m, _s, tail) => {
        h = parseInt(h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12  = h % 12 || 12;
        return `${h12}:${m} ${ampm}${tail}`;
    });
}
function now() {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}، ${_fmtTime(d)}`;
}
function iso()  { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function sanitize(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

function generateSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2,'0')).join('');
}

function fmtDuration(sec) {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
}

/* ══════════════════════════════════════════════════════
   تنبيه السيطرة — صوت مستمر لا يتوقف إلا بالضغط
══════════════════════════════════════════════════════ */
let _ctrlAlertAudio  = null;
let _ctrlTitleFlash  = null;
let _prevCompSnap    = {};

function _startCtrlSound() {
    try {
        if (!_ctrlAlertAudio) {
            _ctrlAlertAudio = new Audio('audio/consideration.mp3');
            _ctrlAlertAudio.loop = true;
        }
        _ctrlAlertAudio.currentTime = 0;
        _ctrlAlertAudio.play().catch(() => {});
    } catch(e) {}
}

function _stopCtrlSound() {
    try { if (_ctrlAlertAudio) { _ctrlAlertAudio.pause(); _ctrlAlertAudio.currentTime = 0; } } catch(e) {}
}

function _startTitleFlash(msg) {
    const orig = document.title;
    let on = true;
    _ctrlTitleFlash = setInterval(() => {
        document.title = on ? `🚨 ${msg}` : orig;
        on = !on;
    }, 700);
}

function _stopTitleFlash() {
    if (_ctrlTitleFlash) { clearInterval(_ctrlTitleFlash); _ctrlTitleFlash = null; }
    document.title = 'محامص الشعب';
}

function _closeCtrlAlert() {
    _stopCtrlSound();
    _stopTitleFlash();
    const el = document.getElementById('_ctrlAlertOverlay');
    if (el) el.remove();
}

function _showCtrlAlert(complaintId, notes, branch, city) {
    _closeCtrlAlert();
    _startCtrlSound();
    _startTitleFlash('متابعة جديدة على السيطرة');

    // محاولة إحضار النافذة للأمام
    try { window.focus(); } catch(e) {}

    // إشعار نظام التشغيل لجلب الانتباه عند التصغير
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
            const n = new Notification('🚨 متابعة جديدة على السيطرة', {
                body: `${branch||''}${city?' — '+city:''}\n${(notes||'').substring(0,80)}`,
                requireInteraction: true
            });
            n.onclick = () => { window.focus(); n.close(); };
        } catch(e) {}
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    if (!document.getElementById('_ctrlAlertStyle')) {
        const s = document.createElement('style');
        s.id = '_ctrlAlertStyle';
        s.textContent = `
        #_ctrlAlertOverlay {
            position:fixed;inset:0;z-index:9999999;
            background:rgba(0,0,0,0.88);backdrop-filter:blur(7px);
            display:flex;align-items:center;justify-content:center;
        }
        #_ctrlAlertBox {
            background:#180303;border:2px solid #d32f2f;border-radius:24px;
            padding:36px 32px;width:400px;max-width:92vw;text-align:center;
            animation:_ctrlPulse 1.4s ease-in-out infinite;
        }
        @keyframes _ctrlPulse {
            0%,100%{box-shadow:0 0 40px rgba(211,47,47,.5),0 20px 60px rgba(0,0,0,.8);}
            50%    {box-shadow:0 0 80px rgba(211,47,47,.95),0 20px 60px rgba(0,0,0,.8);}
        }
        #_ctrlAlertViewBtn {
            width:100%;padding:15px;border:none;border-radius:14px;
            background:#d32f2f;color:#fff;font-family:'Cairo';font-size:16px;
            font-weight:800;cursor:pointer;transition:0.2s;margin-top:8px;
        }
        #_ctrlAlertViewBtn:hover{background:#b71c1c;transform:scale(0.98);}
        `;
        document.head.appendChild(s);
    }

    const safeNotes  = sanitize((notes ||'').substring(0,100));
    const safeBranch = sanitize(branch||'');
    const safeCity   = sanitize(city  ||'');
    const overlay    = document.createElement('div');
    overlay.id       = '_ctrlAlertOverlay';
    overlay.innerHTML = `
        <div id="_ctrlAlertBox">
            <div style="font-size:50px;margin-bottom:10px;">🚨</div>
            <div style="font-size:18px;font-weight:800;color:#ef5350;margin-bottom:6px;">
                متابعة جديدة على نظام السيطرة
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,.55);margin-bottom:18px;">
                يرجى المراجعة الفورية
            </div>
            ${safeBranch ? `
            <div style="background:rgba(255,255,255,.06);border-radius:12px;padding:12px 16px;margin-bottom:16px;">
                <div style="font-size:14px;font-weight:700;color:#fff;">
                    📍 ${safeBranch}${safeCity?' — '+safeCity:''}
                </div>
                ${safeNotes?`<div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:6px;">${safeNotes}${(notes||'').length>100?'…':''}</div>`:''}
            </div>` : ''}
            <button id="_ctrlAlertViewBtn" onclick="_ctrlAlertView(${complaintId||'null'})">
                👁 عرض الملاحظة
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function _ctrlAlertView(complaintId) {
    _closeCtrlAlert();
    if (typeof switchTab === 'function') {
        switchTab('c');
        if (complaintId) {
            setTimeout(() => {
                const row = document.querySelector(`tr[data-id="${complaintId}"]`);
                if (row) row.scrollIntoView({ behavior:'smooth', block:'center' });
            }, 450);
        }
    }
}

// لقطة حالة الشكاوي قبل كل reload لكشف التحويلات الجديدة
function _snapshotComplaints() {
    _prevCompSnap = {};
    (db.complaints || []).forEach(c => {
        _prevCompSnap[c.id] = {
            sub:    c.assignedToSubId || null,
            emp:    c.assignedToEmpId || null,
            status: c.status          || null
        };
    });
}

// مساعد: هل موظف السيطرة مسؤول عن فرع الشكوى؟
function _ctrlSubMatchesBranch(complaint) {
    const emp = employees.find(e => e.empId === currentUser?.empId);
    const ab  = emp?.assignedBranches;
    if (!ab?.length) return false; // بلا فروع مُعيَّنة = لا تنبيه
    return ab.some(b => b.branch === complaint.branch && b.city === complaint.city);
}

// بعد reload: كشف شكاوى جديدة أو محوَّلة لهذا الموظف
function _checkNewAssignments() {
    if (!currentUser) return;
    const role  = currentUser.role;
    const empId = currentUser.empId;
    (db.complaints || []).forEach(c => {
        if (c.deleted) return;
        const prev = _prevCompSnap[c.id];
        // مدير السيطرة — شكوى جديدة أو حديثاً صارت "تمت الموافقة"
        if (role === 'control_employee') {
            const isNew       = !prev;
            const justApproved = prev && prev.status !== 'تمت الموافقة' && c.status === 'تمت الموافقة';
            if ((isNew || justApproved) && c.status === 'تمت الموافقة')
                _showCtrlAlert(c.id, c.notes, c.branch, c.city);
        }
        // موظف سيطرة — شكوى جديدة لفرعه أو حديثاً صارت "تمت الموافقة"
        if (role === 'control_sub' && _ctrlSubMatchesBranch(c)) {
            const isNew        = !prev;
            const justApproved = prev && prev.status !== 'تمت الموافقة' && c.status === 'تمت الموافقة';
            if (isNew || justApproved)
                _showCtrlAlert(c.id, c.notes, c.branch, c.city);
        }
    });
}

/* ── renderAll آمن: لا يُعيد الرسم إذا كان المستخدم يكتب في input/textarea/contenteditable ── */
let _renderDeferred = false;
function _userIsTyping() {
    const ae = document.activeElement;
    if (!ae) return false;
    if (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') return true;
    if (ae.isContentEditable) return true;
    return false;
}
function safeRenderAll() {
    if (_userIsTyping()) { _renderDeferred = true; return; }
    if (typeof renderAll === 'function') renderAll();
    _renderDeferred = false;
}
document.addEventListener('focusout', () => {
    setTimeout(() => {
        if (_renderDeferred && !_userIsTyping()) {
            _renderDeferred = false;
            if (typeof renderAll === 'function') renderAll();
        }
    }, 300);
});

/* ── SSE: اتصال فوري بالسيرفر لاستقبال التحديثات ── */
let _sseActive = false;

function _initSSE() {
    if (IS_LOCAL || !_token) return;

    const es = new EventSource(`/api/sse?token=${encodeURIComponent(_token)}`);
    es.addEventListener('connected', () => {
        _sseActive = true;
        _syncDelay = 120_000;
    });
    es.addEventListener('reload', async () => {
        if (_isSaving) {
            await new Promise(r => { const id = setInterval(() => { if (!_isSaving) { clearInterval(id); r(); } }, 200); });
        }
        _snapshotComplaints();
        try { await loadAllData(); safeRenderAll(); _checkNewAssignments(); } catch(e) {}
    });
    es.addEventListener('new-complaint', (e) => {
        const role    = currentUser?.role;
        const isAdmin = currentUser?.isAdmin;
        let info = {};
        try { info = JSON.parse(e.data); } catch {}
        // تجاهل الشكاوى القديمة المُعاد بثّها (أكثر من 60 ثانية)
        if (info.id && (Date.now() - info.id) > 60_000) return;
        // دفاع إضافي: تجاهل إذا تم تنبيه نفس الـ id من قبل
        if (info.id && _wasNotified('c', info.id)) return;
        if (info.id) _markNotified('c', info.id);
        // كول سنتر + ميديا + أدمن → popup + صوت عادي
        // الميديا: لا إشعار إذا كان هو من أضاف الشكوى
        if (isAdmin || role === 'cc_manager' || role === 'media') {
            if (role === 'media' && info.addedBy === currentUser?.name) { /* تجاهل — أنت من أضفتها */ }
            else { _playSound(); _showComplaintPopup(info); }
        }
        // مدير السيطرة → تنبيه مستمر
        if (role === 'control_employee' || role === 'control') {
            let info = {};
            try { info = JSON.parse(e.data); } catch {}
            _showCtrlAlert(info.id || null, info.notes, info.branch, info.city);
        }
        // موظف سيطرة → تنبيه إذا كانت الشكوى لفرعه
        if (role === 'control_sub') {
            let info = {};
            try { info = JSON.parse(e.data); } catch {}
            const emp = employees.find(e2 => e2.empId === currentUser?.empId);
            const ab  = emp?.assignedBranches;
            if (ab?.length && ab.some(b => b.branch === info.branch && b.city === info.city)) {
                _showCtrlAlert(info.id || null, info.notes, info.branch, info.city);
            }
        }
    });
    es.addEventListener('new-montasia', (e) => {
        const role    = currentUser?.role;
        const isAdmin = currentUser?.isAdmin;
        if (isAdmin || role === 'cc_manager' || role === 'media') {
            let info = {};
            try { info = JSON.parse(e.data); } catch {}
            if (info.addedBy && info.addedBy === currentUser?.name) return;
            // تجاهل السجلات القديمة (id = Date.now() عند الإنشاء؛ نتجاهل ما يزيد عن 60 ثانية)
            if (info.id && (Date.now() - info.id) > 60_000) return;
            // دفاع إضافي: تجاهل إذا تم تنبيه نفس الـ id من قبل (يستمر بين الجلسات)
            if (info.id && _wasNotified('m', info.id)) return;
            if (info.id) _markNotified('m', info.id);
            _playSound();
            _showMontasiaPopup(info);
        }
    });
    es.addEventListener('heartbeat', () => { /* keep-alive */ });
    es.onerror = () => {
        _sseActive = false;
        _syncDelay = 20_000;
        es.close();
        setTimeout(_initSSE, 10_000);
    };
}

/* ── _playComplaintAlert محوّل إلى _playSound ── */
function _playComplaintAlert() { _playSound(); }


/* ── popup تنبيه المنتسية الجديدة ── */
(function _injectMontasiaPopupStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #_mPopupOverlay {
        position:fixed;inset:0;z-index:999997;
        background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);
        display:flex;align-items:flex-start;justify-content:center;
        padding-top:60px;
        animation:_mFadeIn .25s ease;
    }
    @keyframes _mFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes _mSlideIn { from{opacity:0;transform:translateY(-28px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes _mPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
    #_mPopupBox {
        background:#0d1f0f;border:1px solid rgba(56,142,60,.5);
        border-radius:20px;padding:28px 28px 22px;max-width:420px;width:92%;
        box-shadow:0 8px 40px rgba(56,142,60,.3),0 2px 12px rgba(0,0,0,.6);
        animation:_mSlideIn .3s cubic-bezier(.22,1,.36,1);
        font-family:'Cairo',sans-serif;direction:rtl;
    }
    #_mPopupBox ._mIcon {
        display:inline-block;font-size:36px;margin-bottom:6px;
        animation:_mPulse 1s ease-in-out infinite;
    }
    #_mPopupBox ._mTitle {
        font-size:18px;font-weight:800;color:#66bb6a;margin-bottom:4px;
    }
    #_mPopupBox ._mSub {
        font-size:13px;color:#aaa;margin-bottom:16px;
    }
    #_mPopupBox ._mCard {
        background:rgba(56,142,60,.1);border:1px solid rgba(56,142,60,.25);
        border-radius:12px;padding:14px 16px;margin-bottom:20px;
    }
    #_mPopupBox ._mCard ._mBranch {
        font-size:15px;font-weight:700;color:#a5d6a7;margin-bottom:4px;
    }
    #_mPopupBox ._mCard ._mType {
        display:inline-block;font-size:11px;padding:2px 8px;border-radius:6px;
        background:rgba(255,255,255,.08);color:#aaa;margin-bottom:6px;
    }
    #_mPopupBox ._mCard ._mNotes {
        font-size:13px;color:#ccc;line-height:1.7;
    }
    #_mPopupBox ._mBtns {
        display:flex;gap:10px;
    }
    #_mPopupBox ._mBtnView {
        flex:1;padding:11px;border:none;border-radius:12px;cursor:pointer;
        background:linear-gradient(135deg,#2e7d32,#43a047);
        color:#fff;font-family:'Cairo',sans-serif;font-size:15px;font-weight:700;
        transition:opacity .2s;
    }
    #_mPopupBox ._mBtnView:hover { opacity:.85; }
    #_mPopupBox ._mBtnIgnore {
        flex:1;padding:11px;border:1px solid rgba(255,255,255,.15);border-radius:12px;cursor:pointer;
        background:rgba(255,255,255,.07);
        color:#aaa;font-family:'Cairo',sans-serif;font-size:15px;font-weight:700;
        transition:background .2s;
    }
    #_mPopupBox ._mBtnIgnore:hover { background:rgba(255,255,255,.13); }
    `;
    document.head.appendChild(s);
})();

function _showMontasiaPopup(info) {
    const old = document.getElementById('_mPopupOverlay');
    if (old) old.remove();

    const branch = sanitize(info.branch || '');
    const city   = sanitize(info.city   || '');
    const type   = sanitize(info.type   || '');
    const notes  = sanitize((info.notes  || '').substring(0, 120));

    const overlay = document.createElement('div');
    overlay.id = '_mPopupOverlay';
    overlay.innerHTML = `
        <div id="_mPopupBox">
            <div style="text-align:center;margin-bottom:12px;">
                <div class="_mIcon">📋</div>
                <div class="_mTitle">منتسية جديدة - لم يتم التسليم</div>
                <div class="_mSub">وردت للتو — تتطلب مراجعتك</div>
            </div>
            <div class="_mCard">
                <div class="_mBranch">📍 ${branch}${city ? ' — ' + city : ''}</div>
                ${type ? `<div class="_mType">${type}</div>` : ''}
                ${notes ? `<div class="_mNotes" style="margin-top:4px">${notes}${(info.notes||'').length > 120 ? '…' : ''}</div>` : ''}
            </div>
            <div class="_mBtns">
                <button class="_mBtnView"   onclick="_montasiaPopupView()">👁 عرض المنتسيات</button>
                <button class="_mBtnIgnore" onclick="_montasiaPopupDismiss()">تجاهل</button>
            </div>
        </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _montasiaPopupDismiss(); });
    document.body.appendChild(overlay);
}

function _montasiaPopupDismiss() {
    const el = document.getElementById('_mPopupOverlay');
    if (el) el.remove();
}

function _montasiaPopupView() {
    _montasiaPopupDismiss();
    if (typeof switchTab === 'function') {
        switchTab('m');
        setTimeout(() => {
            const tbl = document.querySelector('#tableM');
            if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}


/* ── popup تنبيه الشكوى الجديدة ── */
(function _injectPopupStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #_cPopupOverlay {
        position:fixed;inset:0;z-index:999998;
        background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);
        display:flex;align-items:flex-start;justify-content:center;
        padding-top:60px;
        animation:_cFadeIn .25s ease;
    }
    @keyframes _cFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes _cSlideIn { from{opacity:0;transform:translateY(-28px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes _cPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
    #_cPopupBox {
        background:#1a1a2e;border:1px solid rgba(198,40,40,.45);
        border-radius:20px;padding:28px 28px 22px;max-width:420px;width:92%;
        box-shadow:0 8px 40px rgba(198,40,40,.35),0 2px 12px rgba(0,0,0,.6);
        animation:_cSlideIn .3s cubic-bezier(.22,1,.36,1);
        font-family:'Cairo',sans-serif;direction:rtl;
    }
    #_cPopupBox ._cIcon {
        display:inline-block;font-size:36px;margin-bottom:6px;
        animation:_cPulse 1s ease-in-out infinite;
    }
    #_cPopupBox ._cTitle {
        font-size:18px;font-weight:800;color:#ef5350;margin-bottom:4px;
    }
    #_cPopupBox ._cSub {
        font-size:13px;color:#aaa;margin-bottom:16px;
    }
    #_cPopupBox ._cCard {
        background:rgba(198,40,40,.1);border:1px solid rgba(198,40,40,.25);
        border-radius:12px;padding:14px 16px;margin-bottom:20px;
    }
    #_cPopupBox ._cCard ._cBranch {
        font-size:15px;font-weight:700;color:#ef9a9a;margin-bottom:6px;
    }
    #_cPopupBox ._cCard ._cNotes {
        font-size:13px;color:#ccc;line-height:1.7;
    }
    #_cPopupBox ._cBtns {
        display:flex;gap:10px;
    }
    #_cPopupBox ._cBtnView {
        flex:1;padding:11px;border:none;border-radius:12px;cursor:pointer;
        background:linear-gradient(135deg,#c62828,#e53935);
        color:#fff;font-family:'Cairo',sans-serif;font-size:15px;font-weight:700;
        transition:opacity .2s;
    }
    #_cPopupBox ._cBtnView:hover { opacity:.85; }
    #_cPopupBox ._cBtnIgnore {
        flex:1;padding:11px;border:1px solid rgba(255,255,255,.15);border-radius:12px;cursor:pointer;
        background:rgba(255,255,255,.07);
        color:#aaa;font-family:'Cairo',sans-serif;font-size:15px;font-weight:700;
        transition:background .2s;
    }
    #_cPopupBox ._cBtnIgnore:hover { background:rgba(255,255,255,.13); }
    `;
    document.head.appendChild(s);
})();

let _pendingComplaintId = null;

function _showComplaintPopup(info) {
    // إزالة أي popup سابق
    const old = document.getElementById('_cPopupOverlay');
    if (old) old.remove();

    _pendingComplaintId = info.id || null;

    // طلب إذن browser notification إن لم يُمنح بعد
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // browser notification — لجلب تركيز التبويب من موقع آخر
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification('🚨 شكوى جديدة — متابعة السيطرة', {
            body: `${info.branch || ''}${info.city ? ' — ' + info.city : ''}\n${(info.notes || '').substring(0, 80)}`,
            icon: '/img/logo.png',
            requireInteraction: true,
            tag: 'new-complaint'
        });
        n.onclick = () => { window.focus(); n.close(); };
    }

    const branch = sanitize(info.branch || '');
    const city   = sanitize(info.city   || '');
    const notes  = sanitize((info.notes  || '').substring(0, 120));

    const overlay = document.createElement('div');
    overlay.id = '_cPopupOverlay';
    overlay.innerHTML = `
        <div id="_cPopupBox">
            <div style="text-align:center;margin-bottom:12px;">
                <div class="_cIcon">🚨</div>
                <div class="_cTitle">شكوى جديدة في متابعة السيطرة</div>
                <div class="_cSub">وردت للتو — تتطلب مراجعتك</div>
            </div>
            <div class="_cCard">
                <div class="_cBranch">📍 ${branch}${city ? ' — ' + city : ''}</div>
                ${notes ? `<div class="_cNotes">${notes}${(info.notes||'').length > 120 ? '…' : ''}</div>` : ''}
            </div>
            <div class="_cBtns">
                <button class="_cBtnView"  onclick="_complaintPopupView()">👁 عرض الشكوى</button>
                <button class="_cBtnIgnore" onclick="_complaintPopupDismiss()">تجاهل</button>
            </div>
        </div>
    `;

    // إغلاق عند النقر على الخلفية
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _complaintPopupDismiss(); });
    document.body.appendChild(overlay);
}

function _complaintPopupDismiss() {
    const el = document.getElementById('_cPopupOverlay');
    if (el) el.remove();
}

function _complaintPopupView() {
    _complaintPopupDismiss();
    if (typeof switchTab === 'function') {
        if (typeof _pg !== 'undefined') _pg.C = 1;
        switchTab('c');
        // التمرير لأعلى الجدول بعد العرض
        setTimeout(() => {
            const tbl = document.querySelector('#tableC');
            if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

/* ── مزامنة دورية ذكية: visibilitychange + exponential backoff ── */
let _syncDelay = 20_000;
let _syncTimer = null;

function _scheduleSync() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
        if (!currentUser || document.hidden) { _scheduleSync(); return; }
        try {
            await loadAllData();
            renderAll();
            _syncDelay = 20_000;          // إعادة التأخير للقيمة الطبيعية عند النجاح
        } catch(e) {
            _syncDelay = Math.min(_syncDelay * 2, 300_000); // مضاعفة حتى 5 دقائق عند الفشل
        }
        _scheduleSync();
    }, _syncDelay);
}

// مزامنة فورية عند عودة المستخدم للتبويب بعد غياب
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
        clearTimeout(_syncTimer);
        _syncDelay = 20_000;
        (async () => {
            try { await loadAllData(); renderAll(); } catch(e) { /* صامت */ }
            _scheduleSync();
        })();
    }
});

_scheduleSync();
