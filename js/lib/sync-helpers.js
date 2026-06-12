/* ══════════════════════════════════════════════════════
   sync-helpers — منطق المزامنة النقي القابل للاختبار (المسار A, 2026-06-08)
   يعزل ثلاث وظائف حرجة كانت مبعثرة/مكرّرة داخل data.js ليحرسها node --test:
   - _buildLiteBlob : يجرّد مصفوفات السجلات من الـ Master_DB blob (حارس ضد عودة أي
     مصفوفة للـ blob — وهو سبب انهيارات HTTP/2 وتضخّم الحفظ السابقة).
   - _pruneByAge    : تقليم بالعمر مع شرط "أبقِ دائماً" (الجلسات المفتوحة مثلاً).
   - _mergeById     : دمج سجلات الخادم مع المحلي (الخادم يفوز، أعلام أحادية الاتجاه،
     إبقاء المحلي غير الموجود على الخادم) — يُستخدم في جلب الرسائل والتدقيق.
   نقي عمداً (لا DOM/لا globals) ليعمل في المتصفح وفي الاختبار سواء.
   ══════════════════════════════════════════════════════ */
(function (root) {
    /* المفاتيح التي يجب ألا تركب الـ Master_DB blob أبداً (لها جداول/مفاتيح مستقلة).
       أي إضافة مصفوفة سجلات جديدة للـ blob مستقبلاً يجب أن تُضاف هنا. */
    const BLOB_STRIP_KEYS = [
        'inquiries', 'montasiat', 'complaints',  // per-record tables (Migration #11)
        'auditLog',                              // audit_log table
        'messages',                              // messages table
        'managerNotes',                          // manager_notes table (ملاحظات مدراء مناطق)
        'auditNotes', 'compensations'            // مفاتيح مستقلة (إزالة ازدواج)
    ];

    /* الحالة النهائية المقصودة للـ Master_DB blob = إعدادات/عدّادات صغيرة فقط، مثل:
       branchInfo, montasiatSeqByYear, inqSeq, inquiriesnqSeq, auditSettings,
       emergencyMessages (نص + مُقلَّم 7 أيام), permissionOverrides, locked.
       أي *مصفوفة سجلات* يجب أن تخرج لجدول/مفتاح مستقل وتُضاف إلى BLOB_STRIP_KEYS. */

    /* أعِد نسخة سطحية من db خالية من مفاتيح المصفوفات الثقيلة (lite blob). */
    function _buildLiteBlob(db) {
        const lite = Object.assign({}, db || {});
        for (const k of BLOB_STRIP_KEYS) delete lite[k];
        return lite;
    }

    /* حارس "blob نحيف": يكتشف أي مصفوفة كبيرة تسلّلت إلى الـ blob (مفتاح جديد نُسي
       تجريده). يعيد قائمة المخالِفين [{key,length}] — يستدعيه data.js ليُحذّر في الـ
       console. عتبة افتراضية 50 لتفادي إنذار كاذب على إعدادات صغيرة. نقي (لا console). */
    function _findHeavyArrays(liteDb, maxLen) {
        maxLen = (typeof maxLen === 'number') ? maxLen : 50;
        const offenders = [];
        for (const k of Object.keys(liteDb || {})) {
            const v = liteDb[k];
            if (Array.isArray(v) && v.length > maxLen) offenders.push({ key: k, length: v.length });
        }
        return offenders;
    }

    /* تقليم بالعمر. opts = { retentionDays, tsOf(item)->ms, keepIf(item)->bool, now }.
       يعيد { items, changed }. keepIf لإبقاء عناصر بصرف النظر عن العمر (جلسة مفتوحة). */
    function _pruneByAge(items, opts) {
        opts = opts || {};
        if (!Array.isArray(items) || !items.length) return { items: items || [], changed: false };
        const days   = opts.retentionDays || 90;
        const now    = (typeof opts.now === 'number') ? opts.now : Date.now();
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        const tsOf   = opts.tsOf   || ((it) => (it && typeof it.id === 'number') ? it.id : 0);
        const keepIf = opts.keepIf || (() => false);
        const out = items.filter((it) => {
            if (!it) return false;
            if (keepIf(it)) return true;
            const t = tsOf(it);
            return !(t && t < cutoff);
        });
        return { items: out, changed: out.length !== items.length };
    }

    /* دمج سجلات الخادم مع المحلية. opts = { idOf, sortKey, monotonicTrueKeys, newerWinsBy }.
       الخادم مصدر الحقيقة لكل id افتراضياً؛ والأعلام في monotonicTrueKeys أحادية الاتجاه
       (تبقى true لو كانت true محلياً أو على الخادم)؛ والمحلي غير الموجود على الخادم يُبقى.
       newerWinsBy: اسم حقل ختم زمني (مثل 'updatedTs') — لو كان المحلي أحدث من الخادم يُبقى
       السجل المحلي كاملاً (يحمي تعديلاً/إغلاقاً/إلغاء إغلاق محلياً لم يصل بعد للخادم فيمنع
       الوميض في الاتجاهين)، مع تطبيق monotonicTrueKeys فوق المُختار في الحالتين. */
    function _mergeById(local, server, opts) {
        opts = opts || {};
        const idOf    = opts.idOf    || ((x) => (x ? x.id : null));
        const sortKey = opts.sortKey || ((x) => (x && x.ts) || 0);
        const mono    = opts.monotonicTrueKeys || [];
        const nw      = opts.newerWinsBy || null;
        local  = Array.isArray(local)  ? local  : [];
        server = Array.isArray(server) ? server : [];

        const localById = new Map();
        for (const m of local) { const id = idOf(m); if (id != null) localById.set(String(id), m); }

        const byId = new Map();
        for (const s of server) {
            const id = idOf(s); if (id == null) continue;
            const l = localById.get(String(id));
            // الأحدث يفوز: لو المحلي أحدث (ختم أكبر) نُبقيه كاملاً، وإلا الخادم
            const chosen = (l && nw && ((l[nw] || 0) > (s[nw] || 0))) ? l : s;
            if (l) for (const k of mono) chosen[k] = !!(s[k] || l[k]);
            byId.set(String(id), chosen);
        }
        for (const m of local) { const id = idOf(m); if (id != null && !byId.has(String(id))) byId.set(String(id), m); }

        return Array.from(byId.values()).sort((a, b) => (sortKey(b) - sortKey(a)));
    }

    const api = { BLOB_STRIP_KEYS, _buildLiteBlob, _findHeavyArrays, _pruneByAge, _mergeById };
    if (root) Object.assign(root, api);                          // متصفح: متاح كـ globals
    if (typeof module !== 'undefined' && module.exports)         // node: قابل للاختبار
        module.exports = api;
})(typeof window !== 'undefined' ? window : null);
