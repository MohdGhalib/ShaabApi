/* ══════════════════════════════════════════════════════
   _canonRec — مقارنة قانونية للسجلات (Migration #11 fix, 2026-06-07)
   ترتيب مفاتيح موحّد + معاملة null/undefined/'' كـ"غياب". يمنع اعتبار سجل
   "معدّلاً" بسبب فروق شكلية (مثل offerName: '' محلياً مقابل null من الخادم)
   التي كانت تسبب حلقة إرسال/409 لا نهائية وبطء المتصفح.
   مُستقل ونقي عمداً ليكون قابلاً للاختبار (js/tests + ShaabApi.Tests).
   ══════════════════════════════════════════════════════ */
(function (root) {
    function _canonRec(rec) {
        const norm = (v) => {
            if (v === null || v === undefined || v === '') return undefined;
            if (Array.isArray(v)) return v.map(norm);
            if (typeof v === 'object') {
                const out = {};
                for (const k of Object.keys(v).sort()) {
                    const nv = norm(v[k]);
                    if (nv !== undefined) out[k] = nv;
                }
                return out;
            }
            return v;
        };
        try { return JSON.stringify(norm(rec)) ?? ''; }
        catch { try { return JSON.stringify(rec); } catch { return ''; } }
    }

    if (root) root._canonRec = _canonRec;                 // متصفح: متاح كـ global
    if (typeof module !== 'undefined' && module.exports)  // node: قابل للاختبار
        module.exports = { _canonRec };
})(typeof window !== 'undefined' ? window : null);
