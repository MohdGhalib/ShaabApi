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

/* ── سجل التدقيق ──
   ⚠️ تنبيه مهم: كل سجل يجب أن يحمل حقل id فريد.
   بدون id، عند حدوث conflict أثناء _push للسيرفر، تقوم دالة
   _mergeLocalIntoServerDb بتجاهل السجلات بلا id واستبدال auditLog
   المحلي بنسخة السيرفر — مما يفقد سجلات الموظف الحالي. */
function _logAudit(action, entity, summary, refType, refId) {
    if (!db.auditLog) db.auditLog = [];
    const _now = Date.now();
    const _entry = {
        id:      _now + '_' + (currentUser?.empId || 'X') + '_' + Math.random().toString(36).slice(2, 8),
        action,
        entity,
        summary,
        by:      currentUser ? currentUser.name : '—',
        empId:   currentUser?.empId || '',
        role:    currentUser?.role  || '',
        refType: refType || null,        // 'montasia' | 'inquiry' | 'complaint' | null
        refId:   refId   != null ? refId : null,
        time:    now(),
        iso:     iso(),
        ts:      _now
    };
    db.auditLog.push(_entry);

    /* 📤 (audit_log table) أرسل السطر للخادم ليُحفظ في جدول مستقل (احتفاظ 6 أشهر)
       بدل الاعتماد على Master_DB blob. الإرسال append آمن (لا يدهس شيئاً) لذا لا
       يحتاج _initialLoadOk. */
    if (!(typeof IS_LOCAL !== 'undefined' && IS_LOCAL)) {
        try {
            const _tok = (typeof getSavedToken === 'function') ? getSavedToken() : localStorage.getItem('_shaab_token');
            if (_tok) {
                fetch('api/audit', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
                    body:    JSON.stringify(_entry)
                }).catch(() => {});
            }
        } catch {}
    }

    /* إبقاء عدد معقول في الذاكرة فقط (السجل التاريخي الكامل يُجلب من /api/audit
       عند فتح التبويب). لا تقليم زمني — الاحتفاظ طويل المدى مسؤولية الخادم. */
    if (db.auditLog.length > 3000) db.auditLog = db.auditLog.slice(-3000);
}

/* جلب سجل التدقيق من الجدول المستقل (/api/audit) ودمجه في db.auditLog.
   - loadAllData يستدعيه بنافذة قصيرة (7 أيام) لكشف الخمول عبر الموظفين — throttled.
   - تبويب التدقيق يستدعيه بـ force وبنافذة كاملة (حتى 180 يوماً). */
let _lastAuditFetchTs = 0;
async function _fetchAuditFromServer(days, force) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = (typeof getSavedToken === 'function') ? getSavedToken() : localStorage.getItem('_shaab_token');
    if (!_tok) return;
    const _nowF = Date.now();
    if (!force && _nowF - _lastAuditFetchTs < 60_000) return; // كبح الجلب الخلفي
    _lastAuditFetchTs = _nowF;
    const fromTs = _nowF - (days || 7) * 24 * 60 * 60 * 1000;
    try {
        const res = await fetch('api/audit?fromTs=' + fromTs, { headers: { 'Authorization': 'Bearer ' + _tok } });
        if (!res.ok) return;
        const server = await res.json();
        if (!Array.isArray(server)) return;
        // دمج موحّد (sync-helpers): الخادم يفوز، إبقاء المحلي غير الموجود على الخادم
        db.auditLog = _mergeById(db.auditLog, server, {});
    } catch (e) { console.warn('[audit] fetch from server failed:', e); }
}
if (typeof window !== 'undefined') window._fetchAuditFromServer = _fetchAuditFromServer;

/* ══ الرسائل في جدول مستقل (/api/messages) — خارج الـ Master_DB blob ══════
   نفس فلسفة audit_log: الرسائل لا تركب الـ blob (تضخّم + خطر الدهس). الإرسال
   append عبر POST، وتحديث حالة القراءة/الحذف عبر PATCH، والجلب عبر GET ثم دمج. */
function _msgTok() {
    try { return (typeof getSavedToken === 'function') ? getSavedToken() : localStorage.getItem('_shaab_token'); }
    catch { return null; }
}

/* أرسِل رسالة واحدة للخادم (append آمن — لا يدهس شيئاً). fire-and-forget. */
function _postMessageToServer(m) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _msgTok();
    if (!_tok || !m) return;
    try {
        fetch('api/messages', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
            body:    JSON.stringify(m)
        }).catch(() => {});
    } catch {}
}

/* حدِّث حالة رسالة (قراءة/حذف) على الخادم. patch = { readByMe?, deleted? }. */
function _patchMessageState(id, patch) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _msgTok();
    if (!_tok || id == null) return;
    try {
        fetch('api/messages/' + encodeURIComponent(id), {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
            body:    JSON.stringify(patch || {})
        }).catch(() => {});
    } catch {}
}

/* جلب الرسائل من الجدول المستقل ودمجها في db.messages.
   الدمج: الخادم مصدر الحقيقة لكل id؛ والأعلام readByMe/deleted أحادية الاتجاه
   (OR بين المحلي والخادم) لتفادي وميض "غير مقروء" قبل وصول الـ PATCH. */
let _lastMsgFetchTs = 0;
async function _fetchMessagesFromServer(force) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _msgTok();
    if (!_tok) return;
    const _nowF = Date.now();
    if (!force && _nowF - _lastMsgFetchTs < 20_000) return; // كبح الجلب الخلفي
    _lastMsgFetchTs = _nowF;
    const sinceTs = _nowF - 90 * 24 * 60 * 60 * 1000; // آخر 90 يوماً
    try {
        const res = await fetch('api/messages?sinceTs=' + sinceTs, { headers: { 'Authorization': 'Bearer ' + _tok } });
        if (!res.ok) return;
        const server = await res.json();
        if (!Array.isArray(server)) return;
        if (!db.messages) db.messages = [];
        // دمج موحّد (sync-helpers): الخادم يفوز، readByMe/deleted أحادية الاتجاه، إبقاء المُرسَل للتو
        db.messages = _mergeById(db.messages, server, { monotonicTrueKeys: ['readByMe', 'deleted'] });
    } catch (e) { console.warn('[messages] fetch from server failed:', e); }
}
if (typeof window !== 'undefined') window._fetchMessagesFromServer = _fetchMessagesFromServer;

/* ترحيل مرّة واحدة: ادفع رسائل الـ blob القديمة إلى الجدول المستقل ثم اجلب من الخادم.
   محميّ بعَلَم في localStorage حتى لا يتكرر. آمن: bulk يتجاهل المعرّفات الموجودة. */
async function _migrateMessagesToServer() {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _msgTok();
    if (!_tok) return;
    try {
        if (localStorage.getItem('Shaab_Messages_Migrated') === '1') return;
        const local = Array.isArray(db.messages) ? db.messages.filter(m => m && m.id != null) : [];
        if (local.length) {
            const res = await fetch('api/messages/bulk', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
                body:    JSON.stringify(local)
            });
            if (!res.ok) return; // أعِد المحاولة في التحميل التالي
        }
        localStorage.setItem('Shaab_Messages_Migrated', '1');
    } catch (e) { console.warn('[messages] migration failed (will retry):', e); }
}
if (typeof window !== 'undefined') window._migrateMessagesToServer = _migrateMessagesToServer;

/* ══ ملاحظات مدراء مناطق في جدول مستقل (/api/managerNotes) — نفس فلسفة الرسائل ══
   POST لإضافة ملاحظة، PATCH للتعديل/الإغلاق/الحذف، GET للجلب ثم دمج. خارج الـ blob. */
function _mnTok() {
    try { return (typeof getSavedToken === 'function') ? getSavedToken() : localStorage.getItem('_shaab_token'); }
    catch { return null; }
}

/* أرسِل ملاحظة واحدة للخادم (append آمن — idempotent على id). fire-and-forget. */
function _postManagerNote(n) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _mnTok();
    if (!_tok || !n) return;
    try {
        fetch('api/managerNotes', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
            body:    JSON.stringify(n)
        }).catch(() => {});
    } catch {}
}

/* عدّل ملاحظة على الخادم (إغلاق/حذف/تعديل). patch = { closed?, closeNote?, deleted?, text?, ... }. */
function _patchManagerNote(id, patch) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _mnTok();
    if (!_tok || id == null) return;
    try {
        fetch('api/managerNotes/' + encodeURIComponent(id), {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _tok },
            body:    JSON.stringify(patch || {})
        }).catch(() => {});
    } catch {}
}

/* جلب الملاحظات من الجدول المستقل ودمجها في db.managerNotes.
   deleted أحادية الاتجاه؛ وبقيّة الحقول (closed/تعديلات) تُحسم بـ updatedTs (الأحدث يفوز)
   فيُسمح بإلغاء الإغلاق والتعديل دون رجوع، ودون وميض قبل وصول الـ PATCH. */
let _lastMnFetchTs = 0;
async function _fetchManagerNotesFromServer(force) {
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) return;
    const _tok = _mnTok();
    if (!_tok) return;
    const _nowF = Date.now();
    if (!force && _nowF - _lastMnFetchTs < 20_000) return; // كبح الجلب الخلفي
    _lastMnFetchTs = _nowF;
    try {
        const res = await fetch('api/managerNotes', { headers: { 'Authorization': 'Bearer ' + _tok } });
        if (!res.ok) return;
        const server = await res.json();
        if (!Array.isArray(server)) return;
        if (!db.managerNotes) db.managerNotes = [];
        db.managerNotes = _mergeById(db.managerNotes, server, { monotonicTrueKeys: ['deleted'], newerWinsBy: 'updatedTs' });
        if (typeof renderManagerNotes === 'function' && typeof _activeTab !== 'undefined' && _activeTab === 'rmn') renderManagerNotes();
    } catch (e) { console.warn('[managerNotes] fetch from server failed:', e); }
}
if (typeof window !== 'undefined') window._fetchManagerNotesFromServer = _fetchManagerNotesFromServer;

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
  {name:"هيل مطحون",weight:"1كيلو",price:20},
  {name:"قهوة فلسطينية",weight:"500 غرام",price:6},
  {name:"قهوة فلسطينية",weight:"250 غرام",price:3},
  {name:"قهوة عربية",weight:"40 غرام",price:1},
  {name:"قهوة عربية",weight:"250 غرام",price:3},
  {name:"لوز حبة كاملة نخب اول",weight:"1 كيلو",price:9.5},
  {name:"لوز حبة كاملة نخب ثاني",weight:"1 كيلو",price:8.5},
  {name:"لوز  ارباع مقشر",weight:"1 كيلو",price:7.5},
  {name:"لوز  انصاف مقشر",weight:"1 كيلو",price:7.5},
  {name:"جوز قلب كومبو",weight:"1 كيلو",price:5.5},
  {name:"جوز قلب مبروش",weight:"1 كيلو",price:6},
  {name:"جوز قلب ارباع",weight:"1 كيلو",price:6.5},
  {name:"جوز قلب حبة كاملة",weight:"1 كيلو",price:7.5},
  {name:"صنوبر باكستاني",weight:"1 كيلو",price:30},
  {name:"فستق حلبي احمدي",weight:"1 كيلو",price:19},
  {name:"فستق حلبي بوز",weight:"1 كيلو",price:25},
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
  {name:"مخلوطة سوبر مدخنة",weight:"1 كيلو",price:5.5},
  {name:"مخلوطة سوبر الشعب",weight:"1 كيلو",price:6},
  {name:"مخلوطة سوبر الشعب مدخنة",weight:"1 كيلو",price:7.5},
  {name:"مخلوطة برازيلي",weight:"1 كيلو",price:7},
  {name:"مخلوطة مكس نكهات",weight:"1 كيلو",price:8.5},
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
  {name:"تمر رطب ملكي  باكيت",weight:"1 كيلو",price:3},
  {name:"تمر عجوة المدينة باكيت",weight:"850غرام",price:5.5},
  {name:"تمر عجوة المدينة باكيت",weight:"400غرام",price:3},
  {name:"جنا رطب سكري علب",weight:"1.50كيلو",price:3},
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
  {name:"كمون حب",weight:"1كيلو",price:6.5},
  {name:"كزبرة حب",weight:"1 كيلو",price:2},
  {name:"بهارات دجاج",weight:"1 كيلو",price:4.5},
  {name:"كراوية حب",weight:"1 كيلو",price:3},
  {name:"قزحة",weight:"1 كيلو",price:4.5},
  {name:"فلفل اسود حب",weight:"1 كيلو",price:6.5},
  {name:"بهارات برياني",weight:"1 كيلو",price:4.5},
  {name:"بهارات لحمة",weight:"1 كيلو",price:4.5},
  {name:"ورق غار",weight:"1 كيلو",price:2.5},
  {name:"زعتر بلدي",weight:"1 كيلو",price:2.5},
  {name:"زعتر الضفة",weight:"1 كيلو",price:5},
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
  {name:"المن و السلوى اللؤلؤة الشامية",weight:"400غرام",price:2.5},
  {name:"المن و السلوى اهلنا الطيبين",weight:"400 غرام",price:4.5},
  {name:"كاندي مقرمش",weight:"40 غرام",price:1},
  {name:"علكة شعراوي",weight:"150 غرام",price:0.5},
  {name:"سوفت جيلي 100غم",weight:"100 غرام",price:0.5},
  {name:"معمول جوهرة مكة",weight:"20 حبة",price:1},
  {name:"راحة روسي",weight:"1 كج",price:3.5},
  {name:"ويفر يوناني",weight:"180 غرام",price:1.5},
  {name:"شوكولاتة ايطالي",weight:"1 كيلو",price:7.5},
  {name:"توفي عماني تشيكو 750 غرام",weight:"750 جرام",price:2.5},
  {name:"أرز الشعب  10 كيلو",weight:"10 كيلو",price:10},
  {name:"أرز الشعب 4 كيلو",weight:"4 كيلو",price:3.75},
  {name:"ذرة بوشار",weight:"1كيلو",price:1},
  {name:"ذرة محمصة",weight:"1 كيلو",price:2.5},
  {name:"مشمش مجفف",weight:"1 كيلو",price:10.5},
  {name:"توفي انجليزي",weight:"1 كيلو",price:5.5},
  {name:"بابونج",weight:"1 كيلو",price:4.5},
  {name:"بهارات كيجين",weight:"1 كيلو",price:5.5},
  {name:"جوز بيكان",weight:"1 كيلو",price:14},
  {name:"زهورات",weight:"1 كيلو",price:4.5},
  {name:"نسكافيه الشعب - بدون سكر",weight:"24 ظرف",price:3},
  {name:"نسكافيه الشعب - شوكولاتة",weight:"24 ظرف",price:4},
  {name:"نسكافية الشعب بالكراميل",weight:"24 ظرف",price:4},
  {name:"نسكافيه الشعب كلاسيك",weight:"24 ظرف",price:3},
  {name:"كوكيز كروفكا",weight:"بنكهة البندق ( 136غرام )",price:0.5},
  {name:"كوكيز كروفكا",weight:"بنكهة البرتقال ( 152 غرام )",price:1},
  {name:"كيك تورتينا",weight:"8 حبات ( فانيلا )",price:0.75},
  {name:"كيك تورتينا",weight:"8 حبات ( مشمش )",price:0.75},
  {name:"كيك تورتينا",weight:"8 حبات ( شوكولاتة )",price:0.75},
  {name:"كيك تورتينا",weight:"8 حبات ( فراولة )",price:0.75},
  {name:"كاندي صوص",weight:"علبة كاندي مع صوص حامض بوزن 350 غم",price:2},
  {name:"آيسكريم الهبة مانجا",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة أناناس",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة ليمون",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة خوخ",weight:"فواكة",price:1.5},
  {name:"آيسكريم الهبة فراولة",weight:"فواكة",price:1.5},
  {name:"جرانولا",weight:"1كغ",price:11.5},
  {name:"ملبس نابليون",weight:"نكهات مشكلة",price:5.5},
  {name:"نشا",weight:"1 كيلو",price:0.75},
  {name:"فستق سوداني ني",weight:"1كغ",price:2.25},
  {name:"قضامة صفراء",weight:"1كغ",price:4.5},
  {name:"عصير الجوهر",weight:"720غم",price:1},
  {name:"هيل مفتح",weight:"1كغ",price:24},
  {name:"يانسون حب",weight:"1كغ",price:4.5},
  {name:"تمر عجوة المدينة",weight:"1كغ",price:5},
  {name:"نسكافية الشعب بالبندق",weight:"24 ظرف",price:4},
  {name:"نسكافية الشعب بجوز الهند",weight:"24 ظرف",price:4},
  {name:"فستق برازيلي محمص",weight:"1ك",price:3},
  {name:"أرز الأمل 10 كيلو",weight:"10كغ",price:6.5},
  {name:"أرز الأمل 5 كيلو",weight:"5كغ",price:3.25},
  {name:"تين مجفف",weight:"1 كيلو",price:8.5},
  {name:"قهوة سعودية 250 جرام",weight:"250 جرام",price:4.5},
  {name:"قمر دين شيخ العرب",weight:"مغلف واحد",price:1},
  {name:"افوكادو ايس كريم",weight:"حبة واحدة",price:1.5},
  {name:"جيلي كونجاك بالعصير",weight:"جيلي فواكة مشكل 240غم",price:0.75},
  {name:"كرنشي آيسكريم",weight:"50 غرام",price:1.5},
  {name:"ملبس روسي",weight:"1ك",price:3.5},
  {name:"سوفت جيلي",weight:"1ك",price:3.5},
  {name:"توفي سمرقند",weight:"1كيلو",price:3.5},
  {name:"توفي نحلة",weight:"1كيلو",price:3.5},
  {name:"توفي اذربيجاني",weight:"1كيلو",price:3.5},
  {name:"جيلي بينز",weight:"1كيلو",price:5},
  {name:"شوكولاتة اذربيجاني",weight:"1كيلو",price:5.5},
  {name:"شوكولاته اوزبكستاني",weight:"1كيلو",price:5.5},
  {name:"شوكولاتة الشعب سولفان",weight:"1كيلو",price:5.5},
  {name:"تمرية 500 جرام",weight:"500 غرام",price:3},
  {name:"مكسرات يابانية",weight:"1كيلو",price:4.5},
  {name:"شوكولاته تونسية فاخرة",weight:"1كيلو",price:3.5},
  {name:"ملبس بولندي",weight:"1 كيلو",price:3.5},
  {name:"راحه يوناني",weight:"1kg",price:3.5},
  {name:"زيت زيتون تونسي",weight:"3 لتر",price:14.5},
  {name:"فواكه مجففه بالتبريد",weight:"45 جرام",price:1.5},
  {name:"بندق مقشر",weight:"1 كيلو",price:14},
];

/* ── دول النظام: لكل دولة label خاص للمستوى الثاني (محافظة/إمارة/منطقة) وقائمة المناطق وفروعها ── */
const COUNTRIES_DATA = {
  "الأردن": {
    regionLabel: "المحافظة",
    regions: {
      "عمان":    ["الرئيسي","جسر البيبسي","ماركا الشمالية","الهاشمي","صويلح","الحرية","خلدا","نزال","الوحدات","مرج الحمام","وادي الرمم","المشاغل","طبربور","الرياضية","المنورة","ابو نصير","شارع المطار","الياسمين","الخريطة","اليادودة","طريق البحر الميت","الحجرة","شارع الاستقلال","خلدا الراية"],
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
/* 🛡️ (Fix, 2026-06-07) لا يُضبط true إلا بعد نجاح أول loadAllData من السيرفر.
   يمنع _push من دفع حالة محلية فارغة (db الافتراضي) فوق بيانات الخادم عندما
   يفشل التحميل الأولي على جهاز جديد — كان يسبب مسح auditLog/الجلسات/الرسائل. */
let _initialLoadOk = false;
let _isUnloading = false;        // يمنع toast الخطأ أثناء logout/reload (fetch يُلغى)
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { _isUnloading = true; });
    window.addEventListener('pagehide',     () => { _isUnloading = true; });
}

// 🔒 Optimistic Concurrency: إصدار كل مفتاح Storage على السيرفر
// يُحدَّث عند كل loadAllData ناجح وعند كل _push ناجح
// يُرسل مع كل POST كـ expectedVersion — لو السيرفر يرى version مختلف، يُرفض الحفظ
let _versions = {};
let _onConflictRetrying = false;   // علم لمنع loop لانهائي عند 409
let _inqDedupDone = false;          // شفاء تكرار seq يعمل مرة واحدة/جلسة (يمنع حلقة ترقيم لا نهائية)
let _savingTimer = null;
function setToken(t) {
    _token = t;
    if (t) localStorage.setItem('_shaab_token', t);
    else   localStorage.removeItem('_shaab_token');
}
function getSavedToken() { return localStorage.getItem('_shaab_token'); }

/* ── جلب كل البيانات ── */
async function loadAllData(force) {
    if (_isLoading && !force) return;
    /* 🔍 (Diagnostics, 2026-05-20) Watchdog شامل لكامل دورة loadAllData.
       يلتقط حالة كل منتسية مُسلَّمة قبل البدء — ويقارن في النهاية لاكتشاف
       أي revert غير متعمَّد (revert رسمي = approveMontasia فقط). */
    const _watchdogBefore = (() => {
        try {
            const m = new Map();
            for (const r of (db?.montasiat || [])) {
                if (r && r.id != null && r.status === 'تم التسليم') m.set(r.id, r.status);
            }
            return m;
        } catch { return new Map(); }
    })();
    // عند الإجبار: لا ننتظر إن كان عالقاً — نُعيد ضبط العلَم ونتابع
    _isLoading = true;

    /* 🛡️ التقط التعديلات المحلية المعلقة (التي لم تُحفظ على السيرفر بعد)
       قبل استبدال db ببيانات السيرفر — يحمي من race بين save() المؤجَّل
       (debounce 300ms) و loadAllData المتزامن من SSE/polling/visibilitychange.
       مثال على المشكلة: حجز منتسية لزبون → m.reservedFor يُضاف محلياً →
       polling يفجّر loadAllData قبل اكتمال الحفظ → الحجز يضيع نهائياً. */
    const _pendingEditsByType = {
        montasiat:  new Map(),
        inquiries:  new Map(),
        complaints: new Map()
    };
    try {
        if (typeof _lastSavedRecords === 'object' && _lastSavedRecords) {
            for (const type of ['montasiat', 'inquiries', 'complaints']) {
                const arr = (db && Array.isArray(db[type])) ? db[type] : [];
                const lastMap = _lastSavedRecords[type] || new Map();
                const target = _pendingEditsByType[type];
                for (const r of arr) {
                    if (!r || r.id == null) continue;
                    const cur = _canonRec(r);
                    const last = lastMap.get(r.id);
                    if (last == null || last !== cur) target.set(r.id, r);
                }
            }
        }
    } catch (e) { console.warn('[loadAllData] pending capture failed:', e); }

    /* 🛡️ التقط سجلات التدقيق المحلية (auditLog) قبل استبدال db.
       auditLog لا يدخل في الـ _pendingEditsByType (ليس له endpoint per-record)
       ويُكتَب فقط ضمن Master_DB blob — لذا race بين user يضيف سجل تدقيق
       و loadAllData من polling/SSE يمسح السجلات المحلية الجديدة. الحل:
       احفظ مراجع كل السجلات الموجودة حالياً مع ids ثم أعد المفقود منها بعد التحميل. */
    const _pendingAuditLog = [];
    try {
        if (db && Array.isArray(db.auditLog)) {
            for (const e of db.auditLog) {
                if (e && e.id) _pendingAuditLog.push(e);
            }
        }
    } catch (e) { console.warn('[loadAllData] audit pending capture failed:', e); }

    /* 🛡️ نفس الحماية لقائمة الأسعار: حتى لو فشل localStorage backup أو نظّفه
       _push ناجح سابق، احفظ مراجع للأصناف الموجودة في الذاكرة الآن لتعيد
       استرجاع أي صنف يُحذف بالخطأ من ردّ السيرفر (race مع tab/user آخر). */
    const _pendingPriceList = [];
    try {
        if (Array.isArray(priceList)) {
            for (const x of priceList) {
                if (x && x.id != null) _pendingPriceList.push(x);
            }
        }
    } catch (e) { console.warn('[loadAllData] priceList pending capture failed:', e); }

    try {
    const keys = ['Shaab_Master_DB','Shaab_Employees_DB','Shaab_Breaks_DB','Shaab_Sessions_DB','Shaab_AuditNotes_DB','Shaab_Compensations_DB','Shaab_AuditSettings_DB'];
    if (IS_LOCAL) {
        db        = localStorage.getItem('Shaab_Master_DB')    ? JSON.parse(localStorage.getItem('Shaab_Master_DB'))    : { montasiat:[], inquiries:[], complaints:[] };
        employees = localStorage.getItem('Shaab_Employees_DB') ? JSON.parse(localStorage.getItem('Shaab_Employees_DB')) : [];
        breaks    = localStorage.getItem('Shaab_Breaks_DB')    ? JSON.parse(localStorage.getItem('Shaab_Breaks_DB'))    : [];
        sessions  = localStorage.getItem('Shaab_Sessions_DB')  ? JSON.parse(localStorage.getItem('Shaab_Sessions_DB'))  : [];
        // ملاحظات السيطرة من المفتاح المستقلّ
        try {
            const _an = localStorage.getItem('Shaab_AuditNotes_DB');
            if (_an) {
                const _arr = JSON.parse(_an);
                if (Array.isArray(_arr)) db.auditNotes = _arr;
            }
        } catch {}
        if (!Array.isArray(db.auditNotes)) db.auditNotes = [];
        // تعويضات الفروع من المفتاح المستقلّ
        try {
            const _cp = localStorage.getItem('Shaab_Compensations_DB');
            if (_cp) {
                const _arr = JSON.parse(_cp);
                if (Array.isArray(_arr)) db.compensations = _arr;
            }
        } catch {}
        if (!Array.isArray(db.compensations)) db.compensations = [];
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
            /* 🔄 Phase 4b/4c (Migration #11): جلب السجلات من endpoints منفصلة بالتوازي */
            const [res, _mntRes, _inqRes, _cmpRes] = await Promise.all([
                fetch('api/storage?keys=' + keys.join(','), {
                    headers: { 'Authorization': `Bearer ${_token}` }
                }),
                fetch('api/montasiat', {
                    headers: { 'Authorization': `Bearer ${_token}` }
                }).catch(e => { console.warn('[Phase4b] /api/montasiat fetch failed:', e); return null; }),
                fetch('api/inquiries', {
                    headers: { 'Authorization': `Bearer ${_token}` }
                }).catch(e => { console.warn('[Phase4c] /api/inquiries fetch failed:', e); return null; }),
                // نظام الشكاوى أُزيل — لا جلب من السيرفر (db.complaints يبقى فارغاً)
                Promise.resolve(null)
            ]);
            if (res.status === 401) { location.reload(); return; }
            if (!res.ok) throw new Error('Server error ' + res.status);
            const data = await res.json();
            /* ✅ نجح التحميل من السيرفر — من الآن يُسمح بدفع Master_DB (db سيُملأ أدناه) */
            _initialLoadOk = true;

            /* اقرأ السجلات الجديدة مبكراً — لو فشل أي منها، نُكمل على JSON blob */
            let _newMontasiat = null, _newInquiries = null, _newComplaints = null;
            if (_mntRes && _mntRes.ok) {
                try { _newMontasiat = await _mntRes.json(); }
                catch (e) { console.warn('[Phase4b] /api/montasiat parse failed:', e); }
            }
            if (_inqRes && _inqRes.ok) {
                try { _newInquiries = await _inqRes.json(); }
                catch (e) { console.warn('[Phase4c] /api/inquiries parse failed:', e); }
            }
            if (_cmpRes && _cmpRes.ok) {
                try { _newComplaints = await _cmpRes.json(); }
                catch (e) { console.warn('[Phase4c] /api/complaints parse failed:', e); }
            }

            // 🛡️ حماية حاسمة ضد تفريغ db: لو السيرفر رجّع Master_DB فارغ/مفقود
            // ولدينا بيانات محلية صالحة، لا نُكتب فوقها — هذا منع الكتابة بدب فارغ تماماً.
            const _masterStr = data['Shaab_Master_DB'];
            const _localHasData = (db && (
                (Array.isArray(db.montasiat)  && db.montasiat.length  > 0) ||
                (Array.isArray(db.inquiries)  && db.inquiries.length  > 0) ||
                (Array.isArray(db.complaints) && db.complaints.length > 0)
            ));
            if (_masterStr) {
                try {
                    // 🛡️ التقط التعديلات المحلية لمعلومات الفروع التي قد تكون أحدث من السيرفر
                    // (لتجنّب فقدان تعديل قيد الحفظ عند تحديث من SSE/polling)
                    const _localBranchInfo = (db && typeof db.branchInfo === 'object')
                        ? JSON.parse(JSON.stringify(db.branchInfo))
                        : null;

                    /* 🛡️ (Fix #2, 2026-05-20) التقط pending edits مرة ثانية هنا —
                       في نفس sync tick قبل استبدال db مباشرة. الالتقاط الأول في
                       بداية loadAllData (سطر 460) يفوته أي تعديل يحدث خلال نافذة
                       fetch (100-500ms). مثال: موظف يضغط "تسليم" خلال fetch →
                       التعديل لا يُلتقط → db يُستبدل ببيانات السيرفر القديمة →
                       restore لا يجد البند في pending Map → التسليم يضيع.
                       الالتقاط هنا (post-fetch, pre-replace) يُغلق النافذة. */
                    try {
                        if (typeof _lastSavedRecords === 'object' && _lastSavedRecords) {
                            for (const _type of ['montasiat', 'inquiries', 'complaints']) {
                                const _arr = (db && Array.isArray(db[_type])) ? db[_type] : [];
                                const _lastMap = _lastSavedRecords[_type] || new Map();
                                const _target = _pendingEditsByType[_type];
                                if (!_target) continue;
                                for (const _r of _arr) {
                                    if (!_r || _r.id == null) continue;
                                    if (_target.has(_r.id)) continue; // الالتقاط الأول كافٍ (نفس reference)
                                    const _cur = _canonRec(_r);
                                    const _last = _lastMap.get(_r.id);
                                    if (_last == null || _last !== _cur) _target.set(_r.id, _r);
                                }
                            }
                        }
                    } catch (e) { console.warn('[loadAllData] post-fetch pending capture failed:', e); }

                    /* 🛡️ (Fix #3, 2026-05-20) فرض التقاط أي سجل مُرسَل خلال آخر 10 ثوانٍ —
                       حتى لو _lastSavedRecords تطابق (Fix #2 لن يلتقطه). يحمي من:
                       - Replica lag: السيرفر ردّ 200 لكن نقطة قراءة منفصلة ترى بيانات قديمة
                       - SSE broadcast يصل قبل اكتمال commit للقراءة
                       - أي سيناريو يفقد فيه التحديث في الانتقال بين الكتابة والقراءة
                       النسخة المحلية تفوز طوال نافذة الـ 10s، ثم نثق بالسيرفر. */
                    try {
                        const _nowTs = Date.now();
                        for (const _type of ['montasiat', 'inquiries', 'complaints']) {
                            const _recentMap = _recentlyDispatched[_type];
                            if (!_recentMap || _recentMap.size === 0) continue;
                            const _arr = (db && Array.isArray(db[_type])) ? db[_type] : [];
                            const _target = _pendingEditsByType[_type];
                            if (!_target) continue;
                            for (const _r of _arr) {
                                if (!_r || _r.id == null) continue;
                                const _recent = _recentMap.get(_r.id);
                                if (!_recent) continue;
                                if (_nowTs - _recent.ts > _RECENT_DISPATCH_MS) {
                                    _recentMap.delete(_r.id);
                                    continue;
                                }
                                // فرض الاحتفاظ بالنسخة المحلية بصرف النظر عن أي شيء
                                _target.set(_r.id, _r);
                            }
                        }
                    } catch (e) { console.warn('[loadAllData] recent-dispatch force-capture failed:', e); }

                    /* 🛡️ (CRITICAL FIX, 2026-05-20) احفظ المصفوفات الحالية قبل الاستبدال.
                       السبب: lite blob لا يحوي montasiat/inquiries/complaints، فلو فشل
                       fetch إلى /api/montasiat (أو inquiries/complaints) ولم يعد _newX
                       كمصفوفة، فإن db[X] سيصبح undefined → كل السجلات تختفي!
                       هذا هو سبب الكارثة في الـ watchdog logs (مئات المنتسيات DISAPPEARED). */
                    const _preReplaceM = Array.isArray(db?.montasiat)  ? db.montasiat.slice()  : null;
                    const _preReplaceI = Array.isArray(db?.inquiries)  ? db.inquiries.slice()  : null;
                    const _preReplaceC = Array.isArray(db?.complaints) ? db.complaints.slice() : null;
                    // 🛡️ ملاحظات مدراء المناطق مُستبعدة من الـ blob (BLOB_STRIP_KEYS) ولها جدول مستقل،
                    //    لذا التقطها قبل استبدال db كي لا تُمسح وتختفي القائمة قبل وصول الجلب من الخادم.
                    const _preReplaceMN = Array.isArray(db?.managerNotes) ? db.managerNotes.slice() : null;

                    const _parsed = JSON.parse(_masterStr);
                    db = _parsed;
                    /* 🔄 Phase 4b/4c: استبدل السجلات بالـ endpoints الجديدة لو نجحت،
                       وإلا اترك ما خرج من JSON blob (fallback) */
                    if (Array.isArray(_newMontasiat))  db.montasiat  = _newMontasiat;
                    if (Array.isArray(_newInquiries))  db.inquiries  = _newInquiries;
                    if (Array.isArray(_newComplaints)) db.complaints = _newComplaints;

                    /* 🛡️ (CRITICAL FIX) لو ضاعت أي مصفوفة (فشل fetch + lite blob فارغ)،
                       استعد النسخة المحلية كاحتياط. أفضل من فقدان البيانات. */
                    if (!Array.isArray(db.montasiat) && _preReplaceM) {
                        db.montasiat = _preReplaceM;
                        console.warn('🚨 [DATA-GUARD] /api/montasiat fetch failed AND lite blob has no montasiat — restored', _preReplaceM.length, 'records from local memory');
                    }
                    if (!Array.isArray(db.inquiries) && _preReplaceI) {
                        db.inquiries = _preReplaceI;
                        console.warn('🚨 [DATA-GUARD] /api/inquiries fetch failed AND lite blob has no inquiries — restored', _preReplaceI.length, 'records from local memory');
                    }
                    if (!Array.isArray(db.complaints) && _preReplaceC) {
                        db.complaints = _preReplaceC;
                        console.warn('🚨 [DATA-GUARD] /api/complaints fetch failed AND lite blob has no complaints — restored', _preReplaceC.length, 'records from local memory');
                    }
                    // 🗺️ استرجع ملاحظات مدراء المناطق المحفوظة محلياً (الـ blob لا يحملها أبداً).
                    //    يمنع وميض الاختفاء/العودة وفقدان ملاحظة أُضيفت وما زال POST قيد الإرسال.
                    //    الجلب القسري لاحقاً (_fetchManagerNotesFromServer(true)) يدمج تحديثات الخادم.
                    if (_preReplaceMN) db.managerNotes = _preReplaceMN;

                    /* 🛡️ (CRITICAL FIX) كشف انكماش كارثي: السيرفر ردّ بمصفوفة فارغة أو
                       منكمشة بشدة (>50% drop) رغم وجود سجلات محلية كثيرة — مؤشر على
                       fetch ناقص أو server bug. لا نثق بهذه البيانات — نحتفظ بالمحلية. */
                    if (Array.isArray(db.montasiat) && _preReplaceM && _preReplaceM.length >= 10) {
                        const _shrinkPct = ((_preReplaceM.length - db.montasiat.length) / _preReplaceM.length) * 100;
                        if (_shrinkPct >= 50) {
                            console.warn(`🚨 [DATA-GUARD] /api/montasiat returned ${db.montasiat.length} records but local had ${_preReplaceM.length} (${_shrinkPct.toFixed(0)}% shrink) — keeping local to prevent data loss`);
                            db.montasiat = _preReplaceM;
                        }
                    }
                    if (Array.isArray(db.inquiries) && _preReplaceI && _preReplaceI.length >= 10) {
                        const _shrinkPct = ((_preReplaceI.length - db.inquiries.length) / _preReplaceI.length) * 100;
                        if (_shrinkPct >= 50) {
                            console.warn(`🚨 [DATA-GUARD] /api/inquiries returned ${db.inquiries.length} records but local had ${_preReplaceI.length} (${_shrinkPct.toFixed(0)}% shrink) — keeping local`);
                            db.inquiries = _preReplaceI;
                        }
                    }
                    if (Array.isArray(db.complaints) && _preReplaceC && _preReplaceC.length >= 10) {
                        const _shrinkPct = ((_preReplaceC.length - db.complaints.length) / _preReplaceC.length) * 100;
                        if (_shrinkPct >= 50) {
                            console.warn(`🚨 [DATA-GUARD] /api/complaints returned ${db.complaints.length} records but local had ${_preReplaceC.length} (${_shrinkPct.toFixed(0)}% shrink) — keeping local`);
                            db.complaints = _preReplaceC;
                        }
                    }

                    /* 🔍 (Diagnostics) ابحث عن أي revert تسليم — خلال الاستبدال (قبل pending restore) */
                    _watchDeliveryReverts(_preReplaceM || [], db.montasiat, 'loadAllData/server-fetch');
                    // 🔄 طبّق التعديلات المحلية الأحدث فوق بيانات السيرفر (مقارنة بالـ timestamp)
                    if (_localBranchInfo) {
                        if (!db.branchInfo || typeof db.branchInfo !== 'object') db.branchInfo = {};
                        for (const bk in _localBranchInfo) {
                            const lv = _localBranchInfo[bk];
                            if (!lv || typeof lv !== 'object') continue;
                            const sv = db.branchInfo[bk];
                            const lt = (lv.updatedTs || 0);
                            const st = (sv && sv.updatedTs) || 0;
                            // إن لم يحمل المحلي ختم زمني (بيانات قديمة) ولكن يحوي قيماً تختلف عن السيرفر،
                            // ولم يكن السيرفر يحوي ختم زمني أيضاً، خذ المحلي (احتياط)
                            if (lt > st) {
                                db.branchInfo[bk] = lv;
                            } else if (!lt && !st && JSON.stringify(lv) !== JSON.stringify(sv)) {
                                db.branchInfo[bk] = lv;
                            }
                        }
                    }
                } catch (e) {
                    console.error('[DATA-GUARD] Master_DB parse failed — keeping local state:', e);
                    if (!db || typeof db !== 'object') db = { montasiat:[], inquiries:[], complaints:[] };
                }
            } else if (_localHasData) {
                // السيرفر رجّع Master_DB فارغ/مفقود لكن محلياً عندنا بيانات — لا نلمس db
                console.warn('[DATA-GUARD] Master_DB empty on server but local has data — preserving local state');
            } else {
                // لا بيانات محلية ولا سيرفر — تهيئة فارغة عادية
                db = { montasiat:[], inquiries:[], complaints:[] };
            }

            employees = data['Shaab_Employees_DB'] ? JSON.parse(data['Shaab_Employees_DB']) : [];
            breaks    = data['Shaab_Breaks_DB']    ? JSON.parse(data['Shaab_Breaks_DB'])    : [];
            sessions  = data['Shaab_Sessions_DB']  ? JSON.parse(data['Shaab_Sessions_DB'])  : [];
            priceList = data['Shaab_PriceList_DB'] ? JSON.parse(data['Shaab_PriceList_DB']) : structuredClone(DEFAULT_PRICE_LIST);
            // 🛡️ ملاحظات السيطرة في مفتاح مستقلّ — منعزل عن master_DB لتفادي تعارض الإصدارات
            if (data['Shaab_AuditNotes_DB']) {
                try {
                    const _an = JSON.parse(data['Shaab_AuditNotes_DB']);
                    if (Array.isArray(_an)) db.auditNotes = _an;
                } catch (e) { console.warn('[loadAllData] failed to parse Shaab_AuditNotes_DB:', e); }
            }
            if (!Array.isArray(db.auditNotes)) db.auditNotes = [];
            // 🛡️ تعويضات الفروع في مفتاح مستقلّ
            if (data['Shaab_Compensations_DB']) {
                try {
                    const _cp = JSON.parse(data['Shaab_Compensations_DB']);
                    if (Array.isArray(_cp)) db.compensations = _cp;
                } catch (e) { console.warn('[loadAllData] failed to parse Shaab_Compensations_DB:', e); }
            }
            if (!Array.isArray(db.compensations)) db.compensations = [];
            // 🛡️ إعدادات نموذج تدقيق السيطرة (مشتركة) — مفتاح مستقلّ
            if (data['Shaab_AuditSettings_DB']) {
                try {
                    const _as = JSON.parse(data['Shaab_AuditSettings_DB']);
                    if (_as && typeof _as === 'object') db.auditSettings = _as;
                } catch (e) { console.warn('[loadAllData] failed to parse Shaab_AuditSettings_DB:', e); }
            }
            if (!db.auditSettings || typeof db.auditSettings !== 'object') db.auditSettings = {};

            // 🔒 خزّن إصدارات المفاتيح من السيرفر للحفاظ على التزامن في الحفظ القادم
            if (data['_versions'] && typeof data['_versions'] === 'object') {
                _versions = Object.assign({}, data['_versions']);
            }
        } catch(e) {
            console.error('loadAllData failed:', e);
            throw e;
        }
    }
    if (!db.inqSeq) db.inqSeq = 1;
    if (!db.auditLog) db.auditLog = [];
    if (!db.compensations) db.compensations = [];
    if (!db.auditNotes) db.auditNotes = [];
    if (!db.branchInfo || typeof db.branchInfo !== 'object') db.branchInfo = {};

    // ترحيل تلقائي: ضمان وجود id فريد لكل سجل تدقيق قديم.
    // بدون id، عند conflict مع السيرفر تُفقد السجلات لأن _mergeLocalIntoServerDb
    // يستخدم id كمفتاح للمقارنة. السجلات القديمة قبل هذا التحديث لا تملك id.
    {
        let _auditIdsBackfilled = 0;
        for (const e of db.auditLog) {
            if (e && e.id == null) {
                e.id = (e.ts || Date.now()) + '_legacy_' + Math.random().toString(36).slice(2, 8);
                _auditIdsBackfilled++;
            }
        }
        if (_auditIdsBackfilled > 0) {
            console.log('[AuditLog] backfilled', _auditIdsBackfilled, 'legacy entries with stable ids');
            _loadAllPush();
        }
    }

    // 🛡️ استعادة أصناف الأسعار المعلَّقة (التي ربما لم تصل السيرفر قبل refresh مفاجئ)
    // ⚠️ يجب أن تسبق legacy backfill أدناه: backfill يستدعي savePriceList الذي يكتب
    //   على _PL_PENDING_KEY في localStorage، فإن نُفِّذ قبل الاستعادة لمحى نسخة
    //   احتياطية المستخدم (الأصناف المضافة حديثاً) بنسخة السيرفر القديمة.
    if (typeof _recoverPendingPriceList === 'function') {
        try { _recoverPendingPriceList(); } catch (e) { console.error('[loadAllData] recover priceList failed:', e); }
    }

    // ترحيل تلقائي: ضمان وجود id لكل صنف في قائمة الأسعار.
    // ⚠️ نستخدم id حتمياً مبني على (name|weight) بدلاً من Date.now()+random:
    //   ids عشوائية مختلفة على كل جهاز كانت تجعل _recoverPendingPriceList يرى
    //   نفس الصنف كـ "مفقود" ويُكرّره عشرات المرات بمرور المزامنات.
    /* 🛡️ (CRITICAL FIX, 2026-05-20) Backfill PriceList IDs مرة واحدة فقط لكل جلسة.
       السبب: إذا فشل savePriceList بـ 409 conflict، السيرفر لا يحفظ → loadAllData
       التالي يفتقد IDs مرة أخرى → backfill → save → 409 → loop لا نهائي يستنزف
       localStorage ويغرق Console بالأخطاء.
       الحل: backfill في الذاكرة (مجاناً) لكن savePriceList مرة واحدة فقط.
       لو فشل الـ save مرة، ندع الـ IDs في الذاكرة دون إعادة محاولة دوريّة. */
    if (Array.isArray(priceList)) {
        let _priceIdsBackfilled = 0;
        for (const it of priceList) {
            if (it && it.id == null) {
                const _seedStr = String(it.name || '') + '|' + String(it.weight || '');
                let _h = 0;
                for (let i = 0; i < _seedStr.length; i++) _h = ((_h << 5) - _h + _seedStr.charCodeAt(i)) | 0;
                it.id = 'auto_' + (_h >>> 0).toString(36) + '_' + _seedStr.length;
                _priceIdsBackfilled++;
            }
        }
        if (_priceIdsBackfilled > 0) {
            /* 🛡️ (Fix, 2026-06-07) الـ IDs هنا حتمية (hash من name|weight): كل جهاز
               يحسب نفس الـ id في كل تحميل، فلا حاجة لحفظها على السيرفر. الحفظ السابق
               (savePriceList أثناء loadAllData) كان يسبب 409 على Shaab_PriceList_DB
               عند بدء كل جلسة (الإصدار غير محدّث أثناء التحميل) بلا أي فائدة، فيُغرق
               الـ Console ويستنزف. نُبقيها في الذاكرة فقط — لا حفظ. */
            console.log('[PriceList] backfilled', _priceIdsBackfilled, 'legacy items with deterministic ids (in-memory only — no save)');
        }
    }

    // 🛡️ شفاء تكرار الأصناف في القائمة: نتيجة تفاعل سيئ بين الـ legacy
    //   backfill (ids عشوائية مختلفة على كل جهاز) مع _recoverPendingPriceList
    //   ومسح الـ backup المؤجَّل — كان نفس الصنف يعود بـ id جديد فيُحسب "مفقود"
    //   ويُضاف من جديد. النتيجة: عشرات النسخ لكل صنف.
    //   نُبقي أول نسخة فقط حسب (name|weight). نحفظ النتيجة للسيرفر إذا تغيّر شيء.
    if (Array.isArray(priceList) && priceList.length > 1) {
        try {
            const seen = new Map();   // key=name|weight -> kept item
            const kept = [];
            let dups = 0;
            for (const it of priceList) {
                if (!it) continue;
                const key = String(it.name || '').trim() + '|' + String(it.weight || '').trim();
                if (seen.has(key)) {
                    dups++;
                    continue;
                }
                seen.set(key, it);
                kept.push(it);
            }
            if (dups > 0) {
                console.warn('[PriceList] removed', dups, 'duplicate items by (name|weight)');
                priceList = kept;
                /* 🛡️ (Fix, 2026-06-07) احفظ التنظيف مرة واحدة فقط لكل جلسة: لو فشل
                   بـ 409 لا نعيد المحاولة دورياً (التنظيف يبقى في الذاكرة للعرض)،
                   لتجنّب حلقة savePriceList→409→reload→dedup→save أثناء loadAllData. */
                if (!window._plDedupSavedThisSession && typeof savePriceList === 'function') {
                    window._plDedupSavedThisSession = true;
                    savePriceList();
                }
            }
        } catch (e) { console.error('[PriceList] dedup failed:', e); }
    }

    // 🛡️ شفاء تكرار seq في الاستفسارات (نشأ تاريخياً عن race بين عميلَين
    // يقرآن نفس db.inquiriesnqSeq قبل تزامنها): الأقدم بـ id يحتفظ بـ seq،
    // الأحدث يُعاد ترقيمها لرقم فريد، ويُحدَّث m.reservedFor.inqSeq تبعاً.
    // 🛡️ (Fix, 2026-06-09) مرة واحدة/جلسة + ليس أثناء حلّ التعارض: كان يُعيد الترقيم
    //    في كل loadAllData (العدّاد يتسلّق) فيبقى الاستفسار pending دائماً → حلقة
    //    409/إعادة-ترقيم لا نهائية. التغيير يُدفَع per-record عبر الحفظ العادي.
    if (!_onConflictRetrying && !_inqDedupDone && Array.isArray(db.inquiries) && db.inquiries.length > 0) {
        _inqDedupDone = true;
        try {
            const _bySeq = new Map();
            let _maxSeq = 0;
            for (const q of db.inquiries) {
                if (!q || q.deleted) continue;
                const s = +q.seq;
                if (!Number.isFinite(s) || s <= 0) continue;
                if (s > _maxSeq) _maxSeq = s;
                if (!_bySeq.has(s)) _bySeq.set(s, []);
                _bySeq.get(s).push(q);
            }
            const _renumberMap = new Map();   // oldSeq+inqId -> newSeq (للتحديث في reservedFor)
            const _renamedIds  = new Map();   // inqId -> newSeq
            for (const [seq, group] of _bySeq.entries()) {
                if (group.length < 2) continue;
                // أقدم بـ id يحتفظ بالـ seq؛ البقية تُعاد ترقيمها
                group.sort((a, b) => (a.id || 0) - (b.id || 0));
                for (let i = 1; i < group.length; i++) {
                    _maxSeq++;
                    const oldSeq = group[i].seq;
                    group[i].seq = _maxSeq;
                    _renamedIds.set(group[i].id, _maxSeq);
                    console.warn(`[Inquiries] dedup seq: id=${group[i].id} #${oldSeq} → #${_maxSeq}`);
                }
            }
            if (_renamedIds.size > 0) {
                // حدّث mتعلّقة بأي منتسية تُشير لاستفسار أُعيد ترقيمه
                if (Array.isArray(db.montasiat)) {
                    for (const m of db.montasiat) {
                        if (m && m.reservedFor && m.reservedFor.inqId != null) {
                            const ns = _renamedIds.get(m.reservedFor.inqId);
                            if (ns != null) m.reservedFor.inqSeq = ns;
                        }
                    }
                }
                // وحدّث linkedInqSeq على الشكاوى المرتبطة
                if (Array.isArray(db.complaints)) {
                    for (const c of db.complaints) {
                        if (!c || !c.linkedInqSeq) continue;
                        // ابحث عن الاستفسار المُعاد ترقيمه عبر مطابقة linkedInqId إن وجد
                        if (c.linkedInqId != null) {
                            const ns = _renamedIds.get(c.linkedInqId);
                            if (ns != null) c.linkedInqSeq = ns;
                        }
                    }
                }
                // ارفع العدّاد ليبدأ من بعد آخر seq مستخدم
                if ((db.inquiriesnqSeq || 0) <= _maxSeq) db.inquiriesnqSeq = _maxSeq + 1;
                console.warn(`[Inquiries] healed ${_renamedIds.size} duplicate seq(s); counter → ${db.inquiriesnqSeq}`);
                _loadAllPush();
            }
        } catch (e) { console.error('[Inquiries] dedup failed:', e); }
    }

    // حذف تلقائي: إزالة العناصر المحذوفة منذ أكثر من 30 يوماً
    const _purgeCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const _shouldPurge = (x) => x.deleted && x.deletedAtTs && x.deletedAtTs < _purgeCutoff;
    const _beforePurge = (db.montasiat||[]).length + (db.inquiries||[]).length + (db.complaints||[]).length;
    if (db.montasiat)  db.montasiat  = db.montasiat.filter(x => !_shouldPurge(x));
    if (db.inquiries)  db.inquiries  = db.inquiries.filter(x => !_shouldPurge(x));
    if (db.complaints) db.complaints = db.complaints.filter(x => !_shouldPurge(x));
    const _afterPurge  = (db.montasiat||[]).length + (db.inquiries||[]).length + (db.complaints||[]).length;
    if (_afterPurge < _beforePurge) _loadAllPush();

    // ترحيل تلقائي: إعادة تسمية المفاتيح القصيرة القديمة (مرة واحدة فقط)
    if (Array.isArray(db.m)) {
        db.montasiat  = db.m;  delete db.m;
        db.inquiries  = db.i;  delete db.i;
        db.complaints = db.c;  delete db.c;
        _loadAllPush();
    }

    // ترحيل تلقائي: ترقيم تسلسلي بصيغة YYNNN للمنتسيات الموجودة بدون رقم
    // (مع إزالة الفاصلة "-" من الأرقام القديمة لو وُجدت)
    {
        let _serialChanged = false;
        if (Array.isArray(db.montasiat)) {
            // (1) إزالة "-" من أي سيريال قديم على شكل YY-NNN
            for (const x of db.montasiat) {
                if (typeof x.serial === 'string' && x.serial.includes('-')) {
                    x.serial = x.serial.replace(/-/g, '');
                    _serialChanged = true;
                }
            }
        }
        if (Array.isArray(db.montasiat) && db.montasiat.some(x => !x.serial && !x.deleted)) {
            if (!db.montasiatSeqByYear || typeof db.montasiatSeqByYear !== 'object') db.montasiatSeqByYear = {};
            // (2) استخرج أعلى رقم لكل سنة من المنتسيات التي لها سيريال أصلاً (YYNNN)
            for (const x of db.montasiat) {
                if (x.serial && /^\d{5,}$/.test(x.serial)) {
                    const yy = x.serial.substring(0, 2);
                    const n  = parseInt(x.serial.substring(2), 10);
                    if (!isNaN(n) && (!db.montasiatSeqByYear[yy] || n > db.montasiatSeqByYear[yy])) {
                        db.montasiatSeqByYear[yy] = n;
                    }
                }
            }
            // (3) رتّب المنتسيات بدون سيريال تصاعدياً حسب iso ثم id
            const _toBackfill = db.montasiat
                .filter(x => !x.serial)
                .sort((a, b) => {
                    const A = (a.iso || '0000-00-00') + '|' + (a.id || 0);
                    const B = (b.iso || '0000-00-00') + '|' + (b.id || 0);
                    return A.localeCompare(B);
                });
            for (const x of _toBackfill) {
                const isoDate = x.iso || iso();
                const yy = String(isoDate).substring(2, 4);
                if (!db.montasiatSeqByYear[yy]) db.montasiatSeqByYear[yy] = 0;
                db.montasiatSeqByYear[yy]++;
                x.serial = `${yy}${String(db.montasiatSeqByYear[yy]).padStart(3, '0')}`;
            }
            _serialChanged = true;
        }
        if (_serialChanged) _loadAllPush();
    }

    // ترحيل تلقائي: إضافة salt للموظفين القدامى — في الوضع المحلي فقط.
    // 🔒 في وضع السيرفر، الأسرار (passwordHash/salt) مُجرَّدة من استجابة /api/storage،
    // فلا يجوز للكلاينت "ترحيلها" (سيُعيد ضبط كل كلمات المرور). التحقق يتم على الخادم.
    if (IS_LOCAL) {
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
        /* 🔍 (Diagnostics) قارن حالة المنتسيات المُسلَّمة قبل/بعد loadAllData كاملاً */
        try {
            for (const [id, oldStatus] of _watchdogBefore) {
                const cur = (db?.montasiat || []).find(r => r && r.id === id);
                if (!cur) {
                    console.error(`🚨 [REVERT-LOADALL] montasia ${id} DISAPPEARED after loadAllData! was '${oldStatus}'`);
                } else if (cur.status !== 'تم التسليم') {
                    console.error(`🚨 [REVERT-LOADALL] montasia ${id} reverted in loadAllData: '${oldStatus}' → '${cur.status}'`);
                    console.error('🚨 [REVERT-LOADALL] Record now:', JSON.stringify(cur));
                }
            }
        } catch (e) { console.warn('[loadAllData watchdog] failed:', e); }
    }
    /* 🚀 Phase 5b: init tracking of last-saved record state for diff-based save
       ⚠️ يجب أن يُنفَّذ قبل استعادة التعديلات المعلقة بحيث يبقى lastMap = حالة السيرفر،
       فيرصد _diffRecords التعديلات المستعادة كـ updates ويرسلها في الـ save التالي. */
    if (typeof _initLastSavedRecords === 'function') {
        try { _initLastSavedRecords(); } catch (e) { console.warn('[Phase5b] init failed:', e); }
    }

    /* 🛡️ استعادة التعديلات المحلية المعلقة فوق بيانات السيرفر — يضمن أن
       حجز المنتسيات، تعديلات الاستفسارات والشكاوى التي لم تصل السيرفر بعد
       لا تُمحى عند loadAllData المتزامن. */
    try {
        for (const type of ['montasiat', 'inquiries', 'complaints']) {
            const pending = _pendingEditsByType[type];
            if (!pending || pending.size === 0) continue;
            if (!Array.isArray(db[type])) db[type] = [];
            const byId = new Map();
            for (let i = 0; i < db[type].length; i++) {
                const r = db[type][i];
                if (r && r.id != null) byId.set(r.id, i);
            }
            let _restored = 0;
            for (const [id, rec] of pending.entries()) {
                const idx = byId.get(id);
                if (idx == null) { db[type].unshift(rec); _restored++; }
                else { db[type][idx] = rec; _restored++; }
            }
            if (_restored > 0) {
                console.warn(`[loadAllData] restored ${_restored} pending ${type} edit(s) over server data`);
            }
        }
    } catch (e) { console.error('[loadAllData] pending restore failed:', e); }

    /* 🛡️ استعادة سجلات التدقيق المحلية المفقودة من ردّ السيرفر — يحمي من
       race condition عند: مستخدم يُسجّل عملية → polling يفجّر loadAllData قبل
       اكتمال _push لـ Master_DB → السيرفر يرجع auditLog بدون سجلات هذا
       المستخدم → السجلات تختفي ثم يحفظها هذا الحفظ التالي خالية فيُمحى أثرها. */
    try {
        if (_pendingAuditLog.length > 0) {
            if (!Array.isArray(db.auditLog)) db.auditLog = [];
            const serverIds = new Set();
            for (const e of db.auditLog) {
                if (e && e.id) serverIds.add(e.id);
            }
            let _auditRestored = 0;
            for (const e of _pendingAuditLog) {
                if (!serverIds.has(e.id)) {
                    db.auditLog.push(e);
                    _auditRestored++;
                }
            }
            /* (audit_log table) لم نعد نُحذّر: السجل خرج من الـ blob → السجلات
               المحلية دائماً "غير موجودة" في الـ blob ويعاد دمجها مع جدول الخادم
               عبر _fetchAuditFromServer. هذا سلوك متوقّع وليس خطأً. */
        }
    } catch (e) { console.error('[loadAllData] audit restore failed:', e); }

    /* 📥 (audit_log table) اجلب حركات آخر 7 أيام من الجدول المستقل (throttled داخلياً)
       حتى يبقى كشف خمول الموظفين يعمل بعد إخراج auditLog من الـ blob. fire-and-forget. */
    try { if (typeof _fetchAuditFromServer === 'function') _fetchAuditFromServer(7); } catch {}

    /* 📥 (messages table) رحِّل رسائل الـ blob القديمة مرّة واحدة ثم اجلب من الجدول
       المستقل ودمجها. fire-and-forget — التبويب يُعيد الرسم عبر render.js عند التحديث. */
    try {
        if (typeof _migrateMessagesToServer === 'function') {
            _migrateMessagesToServer().then(() => {
                // غير مُجبَر: throttle 20s يمنع الإفراط في الجلب عند الـ polling المتكرر
                if (typeof _fetchMessagesFromServer === 'function') _fetchMessagesFromServer();
            });
        } else if (typeof _fetchMessagesFromServer === 'function') {
            _fetchMessagesFromServer();
        }
    } catch {}

    /* 📥 (manager_notes table) اجلب ملاحظات مدراء المناطق من الجدول المستقل ودمجها.
       force=true: db استُبدل للتوّ من الـ blob (لا يحمل managerNotes)، لذا تجاوز خنق
       الـ 20 ثانية كي يدمج تحديثات الخادم فوراً ويعمل تحديث SSE اللحظي للمستخدمين الآخرين. */
    try {
        if (typeof _fetchManagerNotesFromServer === 'function') _fetchManagerNotesFromServer(true);
    } catch {}
}

/* ── حفظ البيانات ──
   يرسل expectedVersion للسيرفر — لو السيرفر يحمل version أحدث، يرفض الحفظ بـ 409
   ويُجبر الكلاينت على تحديث البيانات قبل إعادة المحاولة. هذا يمنع طمس البيانات. */
function _push(key, value) {
    if (IS_LOCAL) {
        localStorage.setItem(key, value);
        return Promise.resolve({ ok: true });
    }
    /* 🛡️ (Fix, 2026-06-07) لا تدفع أي شيء للخادم قبل نجاح أول تحميل: على جهاز
       جديد إذا فشل loadAllData الأولي تبقى db/employees/sessions على القيم
       الافتراضية الفارغة، فيدهس هذا الدفعُ بياناتِ الخادم (auditLog/الجلسات/
       الرسائل). نرفض الدفع حتى يؤكّد التحميل أننا رأينا بيانات الخادم. */
    if (!_initialLoadOk) {
        console.warn('[_push] محظور — لم يكتمل التحميل الأولي بعد (حماية من دهس بيانات الخادم):', key);
        return Promise.resolve({ ok: false, blocked: true });
    }
    // ضبط علامة الحفظ الجاري لمنع SSE من تحميل بيانات قديمة
    _isSaving = true;
    clearTimeout(_savingTimer);
    // 🔒 شبكة أمان طويلة فقط — نعتمد على then/catch لإعادة الضبط الفعلي
    // (المدة القديمة 5 ثوانٍ كانت تسبب race condition)
    _savingTimer = setTimeout(() => {
        if (_isSaving) console.warn('[_push] safety release after 60s — fetch may have hung');
        _isSaving = false;
    }, 60_000);

    const expectedVersion = (typeof _versions[key] === 'number') ? _versions[key] : 0;
    const body = JSON.stringify({ key, value, expectedVersion });

    /* 🛡️ Sync Queue: snapshot قبل الإرسال للسجلات الحرجة (Master_DB فقط) */
    const _sqSnap = (key === 'Shaab_Master_DB' && typeof __sq_beforePush === 'function')
        ? (() => { try { return __sq_beforePush(db); } catch { return null; } })()
        : null;

    return fetch('api/storage', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
        body:    body
    }).then(async r => {
        _isSaving = false;
        clearTimeout(_savingTimer);

        if (r.status === 409) {
            // ⚡ تعارض إصدار — السيرفر تغيّر، يجب التحديث ثم إعادة المحاولة
            console.warn('[_push] version conflict on', key, '— refreshing and retrying');
            try {
                const conflictData = await r.json();
                if (typeof conflictData.currentVersion === 'number') {
                    _versions[key] = conflictData.currentVersion;
                }
            } catch {}
            await _handleVersionConflict(key);
            return { ok: true, conflict: true };   // النزاع تمت معالجته داخلياً
        }
        if (!r.ok) {
            const _kb = Math.round((body ? body.length : 0) / 1024);
            console.error(`[_push] SAVE FAILED key=${key} status=${r.status} payload=${_kb}KB` +
                (r.status === 413 ? ' ← PAYLOAD TOO LARGE (server limit 10MB)' : ''));
            if (!_isUnloading) _showSaveError(r.status, key, _kb);
            return { ok: false, status: r.status };
        }

        // ✓ نجح — احفظ الإصدار الجديد + أعِد ضبط عدّاد محاولات التعارض
        try {
            const data = await r.json();
            if (typeof data.version === 'number') _versions[key] = data.version;
        } catch {}
        if (key === 'Shaab_Master_DB') _conflictRetryCount = 0;
        if (key === 'Shaab_Sessions_DB') _sessionsConflictRetry = 0;
        /* 🛡️ ملاحظة: لا ننظّف _PL_PENDING_KEY فور نجاح _push.
           استجابة 200 تعني فقط أن السيرفر قَبِل الكتابة الآن، لكنها لا
           تضمن أن الـ GET التالي سيرجع نفس البيانات (race بين instances،
           استبدال من tab/user آخر بنسخة قديمة، الخ). لذا ننظّف الـ backup
           فقط من داخل _recoverPendingPriceList بعد loadAllData يؤكد أن
           جميع الأصناف موجودة فعلاً في رد السيرفر. هذا يضمن أن أي صنف
           يُضاف ثم يختفي صامتاً من السيرفر يُستعاد في التحميل التالي. */

        /* 🛡️ Sync Queue: علّم السجلات المرسَلة كمؤكَّدة على السيرفر */
        if (_sqSnap && typeof __sq_markConfirmed === 'function') {
            try { __sq_markConfirmed(_sqSnap); } catch {}
        }
        return { ok: true };
    }).catch((err) => {
        _isSaving = false;
        clearTimeout(_savingTimer);
        console.error(`[_push] SAVE FAILED key=${key} (network/abort):`, err);
        /* لا تُظهر toast لو الصفحة قيد إعادة التحميل/الخروج — fetch مُلغى بسبب navigation */
        if (!_isUnloading) _showSaveError('network', key);
        return { ok: false, network: true };
    });
}

/* عند تعارض الإصدارات:
   - بالنسبة لـ Master_DB: ندمج تعديلات المستخدم المحلية فوق آخر بيانات السيرفر، ثم نُعيد الحفظ تلقائياً
     (يحفظ المُدخَلات الجديدة + التعديلات + لا يُزعج المستخدم بإعادة الإدخال)
   - حد أقصى 3 محاولات تلقائية لتجنّب الـ loop اللانهائي
   - لو فشلت كل المحاولات أو فشل الدمج: نُحدّث ونُظهر الـ toast */
let _conflictRetryCount = 0;
let _sessionsConflictRetry = 0;   // حدّ إعادة محاولة دمج الجلسات (يمنع loop)
async function _handleVersionConflict(key) {
    if (_onConflictRetrying) return;
    _onConflictRetrying = true;
    try {
        if (key === 'Shaab_Master_DB') {
            if (_conflictRetryCount >= 3) {
                _conflictRetryCount = 0;
                await loadAllData();
                if (typeof renderAll === 'function') renderAll();
                _showConflictToast();
                return;
            }
            // 1) خذ نسخة من البيانات المحلية (تحوي تعديل المستخدم)
            let localBefore;
            try { localBefore = JSON.parse(JSON.stringify(db)); }
            catch (e) { console.error('[conflict] snapshot failed:', e); localBefore = null; }
            // 2) حدّث db من السيرفر
            await loadAllData();
            // 3) ادمج تعديلات المستخدم فوق البيانات الجديدة
            let mergedAnything = false;
            if (localBefore) {
                try { mergedAnything = _mergeLocalIntoServerDb(localBefore); }
                catch (e) { console.error('[conflict] merge failed:', e); mergedAnything = false; }
            }
            if (typeof renderAll === 'function') renderAll();
            if (mergedAnything) {
                // 4) أعد الحفظ تلقائياً — لا نُزعج المستخدم
                _conflictRetryCount++;
                _onConflictRetrying = false;
                save();
                return;
            }
            // لا توجد تعديلات محلية تستحق الدمج — مجرد تحديث
            _conflictRetryCount = 0;
        } else if (key === 'Shaab_PriceList_DB') {
            /* قائمة الأسعار: تحوي تعديلات بشرية يجب الحفاظ عليها (مثلاً إضافة "جوز هند").
               نأخذ snapshot قبل تحديث السيرفر ثم ندمج الإضافات/التعديلات المحلية. */
            let _plLocalBefore;
            try {
                _plLocalBefore = Array.isArray(priceList) ? JSON.parse(JSON.stringify(priceList)) : [];
            } catch { _plLocalBefore = []; }
            await loadAllData();
            try {
                const _serverById = new Map();
                for (const x of (priceList || [])) if (x && x.id != null) _serverById.set(x.id, x);
                const _adds = [];
                let _editsChanged = false;
                for (const lx of _plLocalBefore) {
                    if (!lx || lx.id == null) continue;
                    const sx = _serverById.get(lx.id);
                    if (!sx) {
                        _adds.push(lx);              // عنصر مُضاف محلياً ولم يصل السيرفر
                    } else if (JSON.stringify(lx) !== JSON.stringify(sx)) {
                        _serverById.set(lx.id, lx);  // تعديل محلي يفوز على نسخة السيرفر
                        _editsChanged = true;
                    }
                }
                if (_adds.length || _editsChanged) {
                    priceList = [
                        ..._adds,
                        ...(priceList || []).map(x => (x && x.id != null) ? (_serverById.get(x.id) || x) : x)
                    ];
                    if (typeof savePriceList === 'function') savePriceList();   // أعد الحفظ تلقائياً
                    console.log(`[conflict] ${key} merged: +${_adds.length} adds, edits=${_editsChanged}`);
                }
            } catch (e) { console.error('[conflict] priceList merge failed:', e); }
            if (typeof renderAll === 'function') renderAll();
        } else if (key === 'Shaab_Sessions_DB') {
            /* الجلسات: لا تَدهس بيانات الخادم. خذ نسخة محلية (تحوي تحديث lastSeen للموظف
               أو علَم الطرد للمدير)، حدّث من الخادم، ثم ادمج المحلي فوقه وأعد الحفظ.
               يصلح: ظهور موظف نشِط "غير متصل" (ضياع lastSeen)، وفشل الطرد إلا بعد عدة محاولات
               (ضياع forceLogoutBy) — كلاهما كان بسبب الاكتفاء بـ loadAllData وإسقاط المحلي. */
            let _sessLocal;
            try { _sessLocal = Array.isArray(sessions) ? JSON.parse(JSON.stringify(sessions)) : []; }
            catch { _sessLocal = []; }
            await loadAllData();
            let _sChanged = false;
            try {
                const _r = _mergeSessions(_sessLocal, sessions);  // الخادم أساس + المحلي يُدمج فوقه
                sessions = _r.items;
                _sChanged = _r.changed;
            } catch (e) { console.error('[conflict] sessions merge failed:', e); }
            if (typeof renderAll === 'function') renderAll();
            if (_sChanged && _sessionsConflictRetry < 3) {
                _sessionsConflictRetry++;
                _onConflictRetrying = false;
                if (typeof saveSessions === 'function') saveSessions();  // أعد الحفظ تلقائياً
                return;
            }
            _sessionsConflictRetry = 0;
        } else {
            // مفاتيح أخرى (employees / breaks): مجرد تحديث صامت
            /* عادةً race condition عابر → اكتفِ بتحديث صامت بدون toast مزعج */
            await loadAllData();
            if (typeof renderAll === 'function') renderAll();
            console.log(`[conflict] ${key} silently refreshed (no toast)`);
        }
    } catch (e) {
        console.error('[_push] conflict refresh failed:', e);
    } finally {
        setTimeout(() => { _onConflictRetrying = false; }, 1000);
    }
}

/* دمج التعديلات المحلية فوق نسخة السيرفر:
   - مصفوفات السجلات (montasiat, inquiries, complaints, compensations, auditLog):
       السجلات الموجودة محلياً وغير موجودة على السيرفر → أضِفها (إدخال جديد)
       السجلات الموجودة في كليهما والمحلي تغيّر → خذ النسخة المحلية (تعديل المستخدم)
       السجلات الموجودة على السيرفر وغير موجودة محلياً → اتركها (موظف آخر أضافها)
   - العدادات (inqSeq, inquiriesnqSeq, montasiatSeqByYear): خذ الأكبر
   - branchInfo: ادمج مفتاح بمفتاح، التغيير المحلي يفوز

   يُرجع true لو دُمج شيء فعلاً (يحتاج إعادة حفظ). */
function _mergeLocalIntoServerDb(localBefore) {
    if (!localBefore || typeof localBefore !== 'object') return false;
    if (!db || typeof db !== 'object') return false;
    let merged = false;

    // (1) مصفوفات السجلات
    // ⚠️ كل مصفوفة هنا يجب أن تحوي سجلات بحقل id فريد، وإلا تُفقد عند conflict.
    // أضفنا 'messages' و 'auditNotes' بعد اكتشاف فقدان الرسائل عند تعارض الإصدارات
    // (الرسائل لا تملك مفتاح تخزين منفصل، فالاعتماد كلياً على دمج Master_DB).
    const arrKeys = ['montasiat', 'inquiries', 'complaints', 'compensations', 'auditLog', 'messages', 'auditNotes'];
    for (const k of arrKeys) {
        const localArr = Array.isArray(localBefore[k]) ? localBefore[k] : [];
        if (!Array.isArray(db[k])) db[k] = [];
        const serverArr = db[k];
        if (!localArr.length && !serverArr.length) continue;

        const serverById = new Map();
        for (const x of serverArr) if (x && x.id != null) serverById.set(x.id, x);

        const newLocal = [];
        for (const lx of localArr) {
            if (!lx || lx.id == null) continue;
            const sx = serverById.get(lx.id);
            if (!sx) {
                newLocal.push(lx); // إدخال جديد
            } else {
                // الاثنان لديه — قارن
                if (JSON.stringify(lx) !== JSON.stringify(sx)) {
                    serverById.set(lx.id, lx); // التعديل المحلي يفوز
                    merged = true;
                }
            }
        }
        if (newLocal.length) merged = true;

        // أعد بناء المصفوفة: العناصر الجديدة محلياً في الأمام (unshift)، ثم بقية السيرفر بترتيبها
        db[k] = [
            ...newLocal,
            ...serverArr.map(x => (x && x.id != null) ? (serverById.get(x.id) || x) : x)
        ];
    }

    // (2) العدادات الرقمية: خذ الأكبر
    for (const k of ['inqSeq', 'inquiriesnqSeq']) {
        if (typeof localBefore[k] === 'number') {
            const newV = Math.max(db[k] || 0, localBefore[k]);
            if (newV !== (db[k] || 0)) { db[k] = newV; merged = true; }
        }
    }
    if (localBefore.montasiatSeqByYear && typeof localBefore.montasiatSeqByYear === 'object') {
        if (!db.montasiatSeqByYear || typeof db.montasiatSeqByYear !== 'object') db.montasiatSeqByYear = {};
        for (const yy in localBefore.montasiatSeqByYear) {
            const newN = Math.max(db.montasiatSeqByYear[yy] || 0, localBefore.montasiatSeqByYear[yy] || 0);
            if (newN !== (db.montasiatSeqByYear[yy] || 0)) {
                db.montasiatSeqByYear[yy] = newN;
                merged = true;
            }
        }
    }

    // (3) branchInfo: مفتاح بمفتاح
    if (localBefore.branchInfo && typeof localBefore.branchInfo === 'object') {
        if (!db.branchInfo || typeof db.branchInfo !== 'object') db.branchInfo = {};
        for (const bk in localBefore.branchInfo) {
            const lv = localBefore.branchInfo[bk];
            const sv = db.branchInfo[bk];
            if (JSON.stringify(lv) !== JSON.stringify(sv)) {
                db.branchInfo[bk] = lv;
                merged = true;
            }
        }
    }

    return merged;
}

function _showConflictToast() {
    let el = document.getElementById('_conflictToast');
    if (!el) {
        el = document.createElement('div');
        el.id = '_conflictToast';
        el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#f57c00;color:#fff;padding:10px 22px;border-radius:10px;font-family:Cairo;font-size:14px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
        el.textContent   = '⚡ البيانات تحدّثت — أعد إجراء التعديل من جديد';
        document.body.appendChild(el);
    }
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function _showSaveError(detail, key, kb) {
    let el = document.getElementById('_saveErrToast');
    if (!el) {
        el = document.createElement('div');
        el.id = '_saveErrToast';
        el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#c62828;color:#fff;padding:10px 22px;border-radius:10px;font-family:Cairo;font-size:14px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
        document.body.appendChild(el);
    }
    /* رسالة تشخيصية: 413 = البيانات أكبر من حدّ الخادم (10MB)؛ 401 = الجلسة منتهية
       (يلزم إعادة دخول)؛ network = انقطاع اتصال فعلي. */
    let msg = '⚠️ فشل الحفظ — تحقق من الاتصال';
    if (detail === 413)            msg = `⚠️ فشل الحفظ — حجم البيانات كبير جداً (${kb || '?'}KB يتجاوز 10MB)`;
    else if (detail === 401)       msg = '⚠️ فشل الحفظ — انتهت الجلسة، أعد تسجيل الدخول';
    else if (detail === 'network') msg = '⚠️ فشل الحفظ — تحقق من الاتصال بالإنترنت';
    else if (typeof detail === 'number') msg = `⚠️ فشل الحفظ (رمز ${detail})`;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/* تجميع (debounce) لطلبات الحفظ المتتالية:
   - الواجهة تتحدّث فوراً (renderAll + الشارات) — بدون تأخير محسوس
   - الإرسال للسيرفر يُؤجَّل 300ms ويُدمج مع أي حفظ آخر يحدث في الفترة
   - يحلّ مشكلة "ادخال اسم ثم نسخه ولصقه بسرعة" — كلا الحفظَين يُجمَّعان في طلب واحد فلا يحدث تعارض */
let _saveDebounceTimer = null;

/* ══════════════════════════════════════════════════════════════════
   🚀 Phase 5b (Migration #11): Smart save — per-record dispatch + lite blob
   ══════════════════════════════════════════════════════════════════
   - يتعقّب آخر حالة محفوظة لكل سجل من inquiries/montasiat/complaints
   - عند save()، يحسب diff ويُرسل التغييرات فردياً عبر endpoints الجديدة
   - يُرسل Master_DB blob مُخفَّفاً (بدون المصفوفات الثلاث) فقط لو نجح الـ dispatch
   - النتيجة: حفظ منتسية واحدة ~200ms بدلاً من ~3000ms */
let _lastSavedRecords = {
    inquiries:  new Map(),
    montasiat:  new Map(),
    complaints: new Map()
};

/* 🛡️ (Fix #3, 2026-05-20) سجل التحديثات المُرسَلة حديثاً — يحمي من:
   1. Replica lag: السيرفر يردّ 200 لكن قراءة لاحقة (loadAllData) ترى بيانات قديمة
   2. SSE broadcasts تصل قبل اكتمال commit للقراءة
   3. أي race ينطوي على قراءة من السيرفر خلال ثوانٍ من الكتابة الناجحة
   loadAllData يفرض الاحتفاظ بالنسخة المحلية لأي سجل ضمن نافذة الـ 10s. */
const _RECENT_DISPATCH_MS = 60_000;  // 60s — covers Railway replica lag spikes
let _recentlyDispatched = {
    inquiries:  new Map(),  // id -> { ts, snapshot }
    montasiat:  new Map(),
    complaints: new Map()
};

/* 🔍 (Diagnostics, 2026-05-20) Watchdog لاكتشاف لحظة revert لمنتسية مُسلَّمة.
   عند كل استبدال لـ db.montasiat، نقارن status للسجلات بين النسخة القديمة
   والجديدة. أي سجل كان 'تم التسليم' وأصبح 'قيد الانتظار' → نطبع تحذير
   كامل مع stack trace ومعلومات السجل. */
function _watchDeliveryReverts(beforeArr, afterArr, source) {
    try {
        if (!Array.isArray(beforeArr) || !Array.isArray(afterArr)) return;
        const beforeMap = new Map();
        for (const r of beforeArr) if (r && r.id != null) beforeMap.set(r.id, r.status);
        for (const r of afterArr) {
            if (!r || r.id == null) continue;
            const oldStatus = beforeMap.get(r.id);
            if (oldStatus === 'تم التسليم' && r.status !== 'تم التسليم') {
                console.error(`🚨 [REVERT] montasia ${r.id} reverted: '${oldStatus}' → '${r.status}' | source=${source}`);
                console.error('🚨 [REVERT] Stack:', new Error().stack);
                console.error('🚨 [REVERT] Record:', JSON.stringify(r));
            }
        }
    } catch (e) { console.warn('[watchDeliveryReverts] failed:', e); }
}

/* 🛡️ (Fix, 2026-06-07) المقارنة القانونية _canonRec انتُقلت إلى js/lib/canon.js
   (مُحمَّل قبل data.js) لتكون قابلة للاختبار. تُستخدم في كل مواقع المقارنة أدناه. */

function _initLastSavedRecords() {
    for (const type of ['inquiries', 'montasiat', 'complaints']) {
        const arr = (db && Array.isArray(db[type])) ? db[type] : [];
        const m = new Map();
        for (const r of arr) {
            if (r && r.id != null) m.set(r.id, _canonRec(r));
        }
        _lastSavedRecords[type] = m;
    }
}

function _diffRecords(type) {
    const arr = (db && Array.isArray(db[type])) ? db[type] : [];
    const lastMap = _lastSavedRecords[type] || new Map();
    const created = [], updated = [], deleted = [];
    const seen = new Set();
    for (const rec of arr) {
        if (!rec || rec.id == null) continue;
        seen.add(rec.id);
        const cur = _canonRec(rec);
        const last = lastMap.get(rec.id);
        if (last == null) created.push(rec);
        else if (last !== cur) updated.push(rec);
    }
    for (const id of lastMap.keys()) {
        if (!seen.has(id)) deleted.push(id);
    }
    return { created, updated, deleted };
}

async function _dispatchOne(method, url, body) {
    const opts = {
        method,
        headers: { 'Authorization': `Bearer ${_token}` }
    };
    if (body != null) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
    return res;
}

async function _flushPerRecordChanges() {
    const tasks = [];
    let summary = '';
    let _serialReconciled = false;
    const _dispatchTs = Date.now();
    for (const type of ['inquiries', 'montasiat', 'complaints']) {
        const diff = _diffRecords(type);
        const urlBase = `api/${type}`;
        // 🛡️ (Fix #3) سجِّل كل إرسال — loadAllData سيفرض الاحتفاظ بالنسخة المحلية
        // خلال نافذة 10s حتى لو السيرفر ردّ ببيانات قديمة (replica lag).
        const recentMap = _recentlyDispatched[type] || (_recentlyDispatched[type] = new Map());
        for (const rec of diff.created) {
            recentMap.set(rec.id, { ts: _dispatchTs, snapshot: JSON.stringify(rec) });
            if (type === 'montasiat') {
                /* 🔒 (Serial fix, 2026-06-10) الخادم هو مرجع الرقم المرجعي: لو أعاد ترقيم
                   المنتسية (تصادم serial مع جهاز آخر) نعتمد رقمه فوراً — وإلا أعاد diff
                   التالي دهس رقم الخادم الصحيح، ولرأى الموظف رقماً مكرراً على الشاشة. */
                tasks.push(_dispatchOne('POST', urlBase, rec).then(async res => {
                    try {
                        const j = await res.json();
                        const srv = j && j.record && j.record.serial;
                        if (srv && srv !== rec.serial) {
                            console.log(`[Phase5b] montasia ${rec.id} serial ${rec.serial} → ${srv} (server-assigned)`);
                            rec.serial = srv;
                            _serialReconciled = true;
                        }
                    } catch (e) { /* رد غير JSON — تجاهل */ }
                }));
            } else {
                tasks.push(_dispatchOne('POST', urlBase, rec));
            }
        }
        for (const rec of diff.updated) {
            recentMap.set(rec.id, { ts: _dispatchTs, snapshot: JSON.stringify(rec) });
            tasks.push(_dispatchOne('PUT', `${urlBase}/${rec.id}`, rec));
        }
        for (const id of diff.deleted) {
            recentMap.set(id, { ts: _dispatchTs, snapshot: null }); // null = deleted
            tasks.push(_dispatchOne('DELETE', `${urlBase}/${id}`, null));
        }
        if (diff.created.length || diff.updated.length || diff.deleted.length) {
            summary += ` ${type[0].toUpperCase()}+${diff.created.length}/~${diff.updated.length}/-${diff.deleted.length}`;
        }
    }
    if (tasks.length === 0) return 0;
    console.log(`[Phase5b] dispatching ${tasks.length} per-record:${summary}`);
    await Promise.all(tasks);
    /* أعِد رصد آخر حالة محفوظة بعد اعتماد أرقام الخادم — يلتقط الـ serial الجديد
       فلا يُرسَل كـ "updated" في الحفظ التالي. ثم أعِد الرسم ليرى الموظف الرقم النهائي. */
    _initLastSavedRecords();
    if (_serialReconciled && typeof renderAll === 'function') {
        try { renderAll(); } catch (e) { console.warn('[Phase5b] renderAll after serial reconcile failed:', e); }
    }
    return tasks.length;
}

/* 🛡️ (Fix, 2026-06-09) دفع الـ blob من داخل loadAllData (ترحيل/تنظيف/تسلسل) موحّد هنا.
   نتخطّاه أثناء حلّ التعارض (_onConflictRetrying) لكسر حلقة: 409 → _handleVersionConflict
   → loadAllData → دفع → 409. الترحيلات idempotent فتُحفَظ في أوّل حفظ عادي لاحق. */
function _loadAllPush() {
    if (_onConflictRetrying) return;
    _push('Shaab_Master_DB', JSON.stringify(_buildLiteBlob(db)));
}

function save() {
    /* 🛡️ (Fix #1, 2026-05-20) احجز SSE/polling فوراً عند استدعاء save() — قبل
       debounce — لإغلاق race window: في السابق كان _isSaving=true يُضبط داخل
       setTimeout بعد 300ms، فيستطيع SSE/polling تشغيل loadAllData خلال هذه
       النافذة ويمسح التعديل المحلي (مثل تسليم منتسية يعود "قيد الانتظار").
       الضبط هنا (قبل debounce) يُغلق النافذة. _safetyTimer يُحرَّر في finally
       داخل setTimeout، أو بعد 60s كاحتياط لو فشل دفع التعديل. */
    _isSaving = true;
    clearTimeout(_savingTimer);
    const _safetyTimer = setTimeout(() => {
        if (_isSaving) console.warn('[save] safety release after 60s');
        _isSaving = false;
    }, 60_000);

    renderAll();
    if (typeof _updateBadges === 'function') _updateBadges();
    /* 🛡️ Sync Queue: احفظ الطابور فوراً قبل الـ debounce لتجنّب فقدان الإدخالات
       إذا أُغلق المتصفح أو حصل crash خلال نافذة الـ 300ms */
    if (typeof __sq_beforePush === 'function') {
        try { __sq_beforePush(db); } catch {}
    }
    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(async () => {
        _saveDebounceTimer = null;
        // _isSaving و _safetyTimer أُعدّا في بداية save() — لا تكرار هنا.

        try {
            /* 🚀 Phase 5b: dispatch per-record changes first */
            let perRecordOk = true;
            try {
                await _flushPerRecordChanges();
            } catch (e) {
                console.error('[Phase5b] per-record flush failed, falling back to full blob:', e);
                perRecordOk = false;
            }

            /* lite blob دائماً — لا نُرسل المصفوفات (تأتي من /api/* عند القراءة).
               🛑 (Fix, 2026-06-07) حتى في حالة فشل per-record لا نرسل blob كاملاً:
               الطلب الضخم (صور base64) يرفضه HTTP/2 لدى Railway (ERR_HTTP2_PROTOCOL_ERROR).
               السجلات التي فشل إرسالها per-record محفوظة في sync-queue (localStorage)
               وتُعاد، و_lastSavedRecords لم تُحدَّث عند الفشل فيُعاد رصدها كـ diff في
               الحفظ التالي. */
            if (!perRecordOk) {
                console.warn('[Phase5b] per-record dispatch failed — lite blob saved; records will retry via sync-queue/diff');
            }
            // lite blob: يجرّد كل مصفوفات السجلات (تعريف موحّد في js/lib/sync-helpers.js)
            const liteDb = _buildLiteBlob(db);
            // حارس "blob نحيف": نبّه لو تسلّلت مصفوفة سجلات ثقيلة جديدة للـ blob (صنف عطل HTTP/2)
            if (typeof _findHeavyArrays === 'function') {
                const _heavy = _findHeavyArrays(liteDb);
                if (_heavy.length) console.warn('[blob-guard] مصفوفات ثقيلة داخل الـ blob — يجب تجريدها/نقلها per-record:', _heavy);
            }
            _push('Shaab_Master_DB', JSON.stringify(liteDb));
        } finally {
            clearTimeout(_safetyTimer);
            /* لا نُحرّر _isSaving هنا فوراً — _push داخلياً يضبطه ويُحرّره
               على then/catch، وذلك يغطّي البقية الفعلية من الـ HTTP request.
               فقط نتأكد أنه لم يبقَ عالقاً لو خرجنا من try بدون استدعاء _push. */
        }
    }, 300);
}

/* أرسِل أي حفظ مؤجَّل فوراً — يُستدعى عند مغادرة الصفحة / blur / إعادة محاولة الطابور.
   🛑 (Fix, 2026-06-07) في السابق كان يرسل db كاملاً (JSON.stringify(db)) بكل المصفوفات
   وصور base64 → طلب ضخم يرفضه HTTP/2 لدى Railway بـ ERR_HTTP2_PROTOCOL_ERROR، فيفشل
   الـ fetch ("فشل الحفظ") ويتكرر بلا توقف من طابور المزامنة (__sq_retryNow كل 10s).
   الحل: أرسِل السجلات عبر نقاط per-record (صغيرة) + lite blob فقط — نفس منطق save(). */
async function _flushPendingSave() {
    if (!_saveDebounceTimer) return;
    clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = null;
    try {
        if (typeof _flushPerRecordChanges === 'function') await _flushPerRecordChanges();
    } catch (e) {
        /* per-record قد يفشل — الطابور (sync-queue) + diff في التحميل التالي يغطّيان الإعادة */
        console.warn('[_flushPendingSave] per-record flush failed:', e);
    }
    // lite blob: يجرّد كل مصفوفات السجلات (تعريف موحّد في js/lib/sync-helpers.js)
    const liteDb = _buildLiteBlob(db);
    _push('Shaab_Master_DB', JSON.stringify(liteDb));
}
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', _flushPendingSave);
    window.addEventListener('pagehide',     _flushPendingSave);
    window.addEventListener('blur',         _flushPendingSave);
}
/* ── إعادة تحميل البيانات يدوياً مع feedback بصري للزر ── */
async function reloadTable(btn) {
    let _orig = null;
    if (btn) {
        _orig = btn.innerHTML;
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.innerHTML = '⏳ جاري التحديث...';
    }
    try {
        // إجبار التحديث حتى لو كان هناك load سابق عالق
        if (typeof loadAllData === 'function') await loadAllData(true);
        if (typeof renderAll === 'function') renderAll();
    } catch (e) {
        console.error('[reloadTable] failed:', e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '';
            if (_orig != null) btn.innerHTML = _orig;
        }
    }
}

function saveEmployees()  { _push('Shaab_Employees_DB',  JSON.stringify(employees)); }
/* 🧹 تقليم الاستراحات: breaks.push سطرٌ لكل استراحة بلا تقليم → ينمو بلا حدّ ويُكتب
   كاملاً في كل مرة (مثل الجلسات تماماً). نحذف الأقدم من 90 يوماً. الإحصائيات اليومية
   تعتمد على استراحات اليوم فقط، فالتاريخ الأقدم آمن للحذف. */
const _BREAKS_RETENTION_DAYS = 90;
function _pruneOldBreaks() {
    const r = _pruneByAge(breaks, {
        retentionDays: _BREAKS_RETENTION_DAYS,
        tsOf: b => (typeof b.id === 'number') ? b.id : new Date(b.startIso || b.date || 0).getTime()
    });
    breaks = r.items;
    return r.changed;
}
function saveBreaks()     { _pruneOldBreaks(); _push('Shaab_Breaks_DB',     JSON.stringify(breaks));    }
/* 🧹 تقليم الجلسات: تنمو Shaab_Sessions_DB بلا حدّ (سطر لكل تسجيل دخول) وتُكتب كاملةً
   في كل مرة. نحذف الجلسات *المغلقة* الأقدم من 90 يوماً، ونُبقي دائماً الجلسات المفتوحة
   (logoutIso=null) حتى لا تتأثر حالة "متصل الآن". الإحصائيات التاريخية تظل متاحة 90 يوماً. */
const _SESSION_RETENTION_DAYS = 90;
function _pruneOldSessions() {
    const r = _pruneByAge(sessions, {
        retentionDays: _SESSION_RETENTION_DAYS,
        tsOf:   s => new Date(s.loginIso || s.logoutIso || 0).getTime(),
        keepIf: s => !s.logoutIso   // أبقِ الجلسات المفتوحة (متصل الآن / لم تُغلق)
    });
    sessions = r.items;
    return r.changed;
}
function saveSessions()   { _pruneOldSessions(); _push('Shaab_Sessions_DB',   JSON.stringify(sessions));  }
/* PriceList Pending Backup Key — يضمن عدم فقدان الأصناف المضافة لو ألغيت الصفحة
   قبل اكتمال fetch إلى السيرفر (مثلاً Reload فوري بعد إضافة "جوز هند") */
const _PL_PENDING_KEY = '_shaab_pl_pending_backup';
function savePriceList() {
    // 🛡️ حفظ محلي فوري قبل الـ fetch — يقاوم: page refresh / network failure / overrride من polling
    try { localStorage.setItem(_PL_PENDING_KEY, JSON.stringify(priceList || [])); } catch {}
    return _push('Shaab_PriceList_DB', JSON.stringify(priceList));
}
/* استرجاع الأصناف المحلية المعلقة (التي لم تصل السيرفر بعد) ودمجها مع priceList الحالي */
function _recoverPendingPriceList() {
    try {
        const _raw = localStorage.getItem(_PL_PENDING_KEY);
        if (!_raw) return;
        const _backup = JSON.parse(_raw);
        if (!Array.isArray(_backup)) { localStorage.removeItem(_PL_PENDING_KEY); return; }
        if (!Array.isArray(priceList)) priceList = [];
        const _serverIds = new Set();
        const _serverNW  = new Set();   // مطابقة بـ name+weight أيضاً — تحمي من id mismatch
        for (const x of priceList) {
            if (x && x.id != null) _serverIds.add(x.id);
            if (x) _serverNW.add(String(x.name || '').trim() + '|' + String(x.weight || '').trim());
        }
        // عنصر يُعتبر "مفقود" فقط لو غاب بـ id وبـ (name|weight) معاً
        const _lost = _backup.filter(x => {
            if (!x || x.id == null) return false;
            if (_serverIds.has(x.id)) return false;
            const nw = String(x.name || '').trim() + '|' + String(x.weight || '').trim();
            if (_serverNW.has(nw)) return false;
            return true;
        });
        if (_lost.length) {
            console.warn('[PriceList] recovering', _lost.length, 'pending item(s) lost before server confirmation:', _lost.map(x=>x.name));
            priceList = [..._lost, ...priceList];
            _push('Shaab_PriceList_DB', JSON.stringify(priceList));
            // النسخة الاحتياطية تظل قائمة حتى يؤكد _push نجاحه عبر تحديث _versions
            // إذا فشل _push مرة أخرى ستحاول الاسترجاع في التحميل التالي
        } else {
            // كل الأصناف موجودة على السيرفر — يمكن تنظيف النسخة الاحتياطية
            localStorage.removeItem(_PL_PENDING_KEY);
        }
    } catch (e) {
        console.error('[PriceList] recover pending failed:', e);
    }
}
function saveAuditNotes()    { _push('Shaab_AuditNotes_DB',    JSON.stringify(db.auditNotes    || [])); }
function saveCompensations() { _push('Shaab_Compensations_DB', JSON.stringify(db.compensations || [])); }
function saveAuditSettings() { _push('Shaab_AuditSettings_DB', JSON.stringify(db.auditSettings || {})); }

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
function _checkNewAssignments() { /* نظام الشكاوى/السيطرة أُزيل */ }

/* ── renderAll آمن: لا يُعيد الرسم إذا كان المستخدم يكتب في input/textarea/contenteditable ── */
let _renderDeferred = false;
function _userIsTyping() {
    const ae = document.activeElement;
    if (!ae) return false;
    if (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') return true;
    if (ae.isContentEditable) return true;
    return false;
}
function _hasOpenOverlay() {
    // أي modal مفتوح: invoice / notify / super-admin / إلخ
    return !!(document.getElementById('_invoiceOverlay') ||
              document.querySelector('.modal-overlay:not(.hidden)'));
}
function _captureFormState() {
    const state = {};
    document.querySelectorAll('textarea, input').forEach(el => {
        if (!el.id) return;
        if (el.type === 'hidden' || el.type === 'file' || el.type === 'button') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked) state[el.id] = { type:'check', val:true };
        } else if (el.value) {
            state[el.id] = { type:'val', val:el.value };
        }
    });
    return state;
}
function _restoreFormState(state) {
    if (!state) return;
    for (const id in state) {
        const el = document.getElementById(id);
        if (!el) continue;
        const s = state[id];
        if (s.type === 'check') { if (!el.checked) el.checked = true; }
        else if (s.type === 'val' && !el.value) { el.value = s.val; }
    }
}
function safeRenderAll() {
    if (_userIsTyping() || _hasOpenOverlay()) { _renderDeferred = true; return; }
    const snap = _captureFormState();
    if (typeof renderAll === 'function') renderAll();
    _restoreFormState(snap);
    _renderDeferred = false;
}
document.addEventListener('focusout', () => {
    setTimeout(() => {
        if (_renderDeferred && !_userIsTyping() && !_hasOpenOverlay()) {
            _renderDeferred = false;
            const snap = _captureFormState();
            if (typeof renderAll === 'function') renderAll();
            _restoreFormState(snap);
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
        // 25s polling حتى مع SSE نشط — حتى تصل الرسائل/التحديثات التي لا تُبثّ كأحداث SSE
        // (الأحداث المهمة كالشكاوى والمنتسيات تظل تصل لحظياً عبر SSE)
        _syncDelay = 25_000;
    });
    es.addEventListener('reload', async () => {
        if (_isSaving) {
            await new Promise(r => { const id = setInterval(() => { if (!_isSaving) { clearInterval(id); r(); } }, 200); });
        }
        /* إن كان المستخدم في تعديل inline (تغيير نوع منتسية، إلخ)، انتظر حتى يغلقه
           حتى لا يُعاد رسم الجدول فوق اختياراته */
        if (window._anyInlineEditOpen) {
            await new Promise(r => { const id = setInterval(() => { if (!window._anyInlineEditOpen) { clearInterval(id); r(); } }, 300); });
        }
        try { await loadAllData(); safeRenderAll(); _checkNewAssignments(); } catch(e) {}
    });
    es.addEventListener('new-complaint', (e) => {
        const role    = currentUser?.role;
        const isAdmin = currentUser?.isAdmin;
        let info = {};
        try { info = JSON.parse(e.data); } catch {}
        // بدون معرف لا يمكن منع التكرار → تجاهل
        if (!info.id) return;
        // تجاهل الشكاوى القديمة المُعاد بثّها (أكثر من 60 ثانية)
        if ((Date.now() - info.id) > 60_000) return;
        // دفاع: تجاهل إذا تم تنبيه نفس الـ id من قبل
        if (_wasNotified('c', info.id)) return;
        // فحص ضد إعادة البث: لو السجل موجود محلياً وتاريخ إنشائه قديم → تجاهل
        try {
            const rec = (db.complaints || []).find(c => c.id === info.id);
            if (rec && rec.iso && (Date.now() - Date.parse(rec.iso)) > 5 * 60 * 1000) return;
        } catch {}
        _markNotified('c', info.id);
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
            // بدون معرف لا يمكن منع التكرار → تجاهل لتفادي إشعارات مكررة
            if (!info.id) return;
            // تجاهل السجلات القديمة (id = Date.now() عند الإنشاء)
            if ((Date.now() - info.id) > 60_000) return;
            // دفاع: تجاهل إذا تم تنبيه نفس الـ id من قبل (يستمر بين الجلسات)
            if (_wasNotified('m', info.id)) return;
            // فحص ضد إعادة بث الأحداث القديمة عند الاتصال الجديد:
            // لو السجل موجود محلياً وتاريخ إنشائه (iso) قديم → تجاهل
            try {
                const rec = (db.montasiat || []).find(m => m.id === info.id);
                if (rec && rec.iso && (Date.now() - Date.parse(rec.iso)) > 5 * 60 * 1000) return;
            } catch {}
            _markNotified('m', info.id);
            _playSound();
            _showMontasiaPopup(info);
        }
    });
    es.addEventListener('incoming-call', (e) => {
        // مكالمة واردة من المقسم (Panasonic CTI) → صندوق رقم المتصل
        let info = {};
        try { info = JSON.parse(e.data); } catch {}
        if (typeof window._onIncomingCall === 'function') window._onIncomingCall(info);
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
    // التبويبات المخفية تتزامن أيضاً (كانت مهملة سابقاً → سبباً رئيسياً لفقدان البيانات)
    // لكن بمعدل أبطأ (دقيقة) لتوفير الموارد. التبويبات المرئية: _syncDelay الطبيعي.
    const delay = document.hidden ? Math.max(_syncDelay, 60_000) : _syncDelay;
    _syncTimer = setTimeout(async () => {
        if (!currentUser) { _scheduleSync(); return; }
        /* لا نقاطع المستخدم لو كان يحرّر inline (تغيير نوع منتسية، إلخ).
           إعادة رسم الجدول تُغلق الـ panel وتُفقد اختياراته. نؤجل لتك التالية. */
        if (window._anyInlineEditOpen) { _scheduleSync(); return; }
        try {
            await loadAllData();
            if (!document.hidden) renderAll();   // لا حاجة لإعادة الرسم لو التبويب مخفي
            _syncDelay = 20_000;
        } catch(e) {
            _syncDelay = Math.min(_syncDelay * 2, 300_000);
        }
        _scheduleSync();
    }, delay);
}

// مزامنة فورية عند عودة المستخدم للتبويب بعد غياب
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
        clearTimeout(_syncTimer);
        _syncDelay = 20_000;
        (async () => {
            /* احترم تعديل inline قيد التنفيذ — لا تُعد الرسم فوق الـ panel */
            if (window._anyInlineEditOpen) { _scheduleSync(); return; }
            try { await loadAllData(); renderAll(); } catch(e) { /* صامت */ }
            _scheduleSync();
        })();
    }
});

_scheduleSync();
