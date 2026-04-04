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
        by:   currentUser ? currentUser.name : '—',
        time: now()
    });
    // الاحتفاظ بآخر 200 سجل فقط
    if (db.auditLog.length > 200) db.auditLog = db.auditLog.slice(-200);
}

/* ── إشعارات المتصفح ── */
let _prevCounts = { montasiat: -1, inquiries: -1, complaints: -1 };

function _checkNotifications() {
    if (!currentUser) return;
    if (!('Notification' in window)) return;
    // إذا لم يُمنح الإذن بعد، اطلبه مرة واحدة بسياق واضح (عند وجود إشعار فعلي)
    if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
        return;
    }
    if (Notification.permission !== 'granted') return;

    const pendingM   = (db.montasiat  || []).filter(x => !x.deleted && x.status === 'قيد الانتظار').length;
    const noAuditC   = (db.complaints || []).filter(x => !x.deleted && x.status === 'تمت الموافقة' && !x.audit).length;

    if (_prevCounts.montasiat >= 0 && pendingM > _prevCounts.montasiat) {
        new Notification('محامص الشعب', {
            body: `منتسية جديدة قيد الانتظار (${pendingM})`,
            icon: 'img/logo.png'
        });
    }
    if (_prevCounts.complaints >= 0 && noAuditC > _prevCounts.complaints) {
        new Notification('محامص الشعب', {
            body: `شكوى جديدة بدون رد (${noAuditC})`,
            icon: 'img/logo.png'
        });
    }
    _prevCounts.montasiat   = pendingM;
    _prevCounts.complaints  = noAuditC;
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

const branches = {
  "عمان": ["الرئيسي","ماركا","الهاشمي","صويلح","الحرية","خلدا","نزال","الوحدات","مرج الحمام","وادي الرمم","المشاغل","طبربور","الرياضية","المنورة","ابو نصير","شارع المطار","الياسمين","الخريطة","اليادودة","طريق البحر الميت"],
  "اربد": ["ابو راشد","الطيارة","شارع ال30"],
  "الزرقاء": ["السعادة","شارع 36"],
  "مادبا": ["مادبا الشرقي","مادبا الغربي"],
  "الكرك": ["الكرك الثنية","الكرك الوسية"],
  "العقبة": ["الرئيسي","البيتزا","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الخلفي"],
  "محافظات بفرع واحد": ["المفرق","الرمثا","جرش","السلط"]
};

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
    const ampm = h >= 12 ? 'م' : 'ص';
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`;
}

function now() {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}، ${_fmtTime(d)}`;
}
function iso()  { return new Date().toISOString().split('T')[0]; }

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

/* ── SSE: اتصال فوري بالسيرفر لاستقبال التحديثات ── */
let _sseActive = false;

function _initSSE() {
    if (IS_LOCAL || !_token) return;
    const sseToken = _config_SseToken || '';
    if (!sseToken) return;

    const es = new EventSource(`/api/sse?t=${encodeURIComponent(sseToken)}`);
    es.addEventListener('connected', () => {
        _sseActive = true;
        _syncDelay = 120_000; // SSE يتولى التحديث — نبطئ الـ polling
    });
    es.addEventListener('reload', async () => {
        // إذا كان هناك حفظ جارٍ، ننتظر حتى ينتهي لتجنب تحميل بيانات قديمة
        if (_isSaving) {
            await new Promise(r => { const id = setInterval(() => { if (!_isSaving) { clearInterval(id); r(); } }, 200); });
        }
        try { await loadAllData(); renderAll(); } catch(e) { /* صامت */ }
    });
    es.addEventListener('heartbeat', () => { /* keep-alive */ });
    es.onerror = () => {
        _sseActive = false;
        _syncDelay = 20_000; // عودة للـ polling العادي عند انقطاع SSE
        es.close();
        // إعادة الاتصال بعد 10 ثوانٍ
        setTimeout(_initSSE, 10_000);
    };
}

// يُعيَّن من appsettings عبر متغير مُضمَّن في الصفحة (أو يُترك فارغاً في IS_LOCAL)
let _config_SseToken = '';

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
