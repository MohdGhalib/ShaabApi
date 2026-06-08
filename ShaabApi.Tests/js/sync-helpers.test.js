/* اختبارات منطق المزامنة النقي (js/lib/sync-helpers.js). تُشغَّل بـ:
   node --test ShaabApi.Tests/js
   تحرس ثلاثة مصادر أعطال:
   - _buildLiteBlob: عودة أي مصفوفة سجلات للـ Master_DB blob (تضخّم + انهيار HTTP/2).
   - _pruneByAge:    حدود الاحتفاظ + إبقاء الجلسات المفتوحة دائماً.
   - _mergeById:     الخادم يفوز، أعلام أحادية الاتجاه، إبقاء المُرسَل محلياً للتو. */
const test = require('node:test');
const assert = require('node:assert');

const { BLOB_STRIP_KEYS, _buildLiteBlob, _pruneByAge, _mergeById } = require('../../js/lib/sync-helpers.js');

/* ════ _buildLiteBlob ════════════════════════════════════ */
test('_buildLiteBlob: يجرّد كل مفاتيح المصفوفات الثقيلة', () => {
    const db = {
        montasiat: [1, 2], inquiries: [3], complaints: [4], auditLog: [5],
        messages: [6], auditNotes: [7], compensations: [8],
        branchInfo: { x: 1 }, montasiatSeqByYear: { 2026: 5 }, locked: false
    };
    const lite = _buildLiteBlob(db);
    for (const k of BLOB_STRIP_KEYS) assert.ok(!(k in lite), `يجب تجريد ${k} من الـ blob`);
    // الإعدادات/العدّادات الصغيرة تبقى
    assert.deepStrictEqual(lite.branchInfo, { x: 1 });
    assert.deepStrictEqual(lite.montasiatSeqByYear, { 2026: 5 });
    assert.strictEqual(lite.locked, false);
});

test('_buildLiteBlob: لا يطفر على الأصل (نسخة سطحية)', () => {
    const db = { messages: [1], branchInfo: { x: 1 } };
    const lite = _buildLiteBlob(db);
    assert.ok(Array.isArray(db.messages), 'الأصل يبقى يحمل messages');
    assert.ok(!('messages' in lite));
});

test('_buildLiteBlob: يتحمّل db فارغاً/ناقصاً', () => {
    assert.deepStrictEqual(_buildLiteBlob({}), {});
    assert.deepStrictEqual(_buildLiteBlob(undefined), {});
});

/* ════ _pruneByAge ═══════════════════════════════════════ */
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

test('_pruneByAge: يحذف الأقدم من المدة ويُبقي الحديث', () => {
    const items = [
        { id: NOW - 100 * DAY },   // قديم → يُحذف
        { id: NOW - 10 * DAY },    // حديث → يبقى
    ];
    const r = _pruneByAge(items, { retentionDays: 90, now: NOW });
    assert.strictEqual(r.items.length, 1);
    assert.strictEqual(r.changed, true);
    assert.strictEqual(r.items[0].id, NOW - 10 * DAY);
});

test('_pruneByAge: keepIf يُبقي العنصر مهما كان عمره (جلسة مفتوحة)', () => {
    const sessions = [
        { loginIso: new Date(NOW - 200 * DAY).toISOString(), logoutIso: null },                 // مفتوحة قديمة → تبقى
        { loginIso: new Date(NOW - 200 * DAY).toISOString(), logoutIso: new Date(NOW - 199 * DAY).toISOString() }, // مغلقة قديمة → تُحذف
    ];
    const r = _pruneByAge(sessions, {
        retentionDays: 90, now: NOW,
        tsOf:   s => new Date(s.loginIso || 0).getTime(),
        keepIf: s => !s.logoutIso,
    });
    assert.strictEqual(r.items.length, 1);
    assert.strictEqual(r.items[0].logoutIso, null);
});

test('_pruneByAge: مصفوفة فارغة/غير مصفوفة آمنة', () => {
    assert.deepStrictEqual(_pruneByAge([], {}).items, []);
    assert.strictEqual(_pruneByAge([], {}).changed, false);
    assert.strictEqual(_pruneByAge(null, {}).changed, false);
});

test('_pruneByAge: بلا تغيير عندما الكل حديث', () => {
    const items = [{ id: NOW - DAY }, { id: NOW - 2 * DAY }];
    const r = _pruneByAge(items, { retentionDays: 90, now: NOW });
    assert.strictEqual(r.changed, false);
    assert.strictEqual(r.items.length, 2);
});

/* ════ _mergeById ════════════════════════════════════════ */
test('_mergeById: الخادم مصدر الحقيقة لكل id', () => {
    const local  = [{ id: 1, text: 'old' }];
    const server = [{ id: 1, text: 'new' }];
    const out = _mergeById(local, server, {});
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].text, 'new');
});

test('_mergeById: الأعلام أحادية الاتجاه (OR محلي/خادم)', () => {
    const local  = [{ id: 1, ts: 5, readByMe: true, deleted: false }];   // قُرئت محلياً، الـ PATCH لم يصل بعد
    const server = [{ id: 1, ts: 5, readByMe: false, deleted: false }];
    const out = _mergeById(local, server, { monotonicTrueKeys: ['readByMe', 'deleted'] });
    assert.strictEqual(out[0].readByMe, true, 'لا يجب أن تومض "غير مقروء"');
});

test('_mergeById: يُبقي المحلي غير الموجود على الخادم (مُرسَل للتو)', () => {
    const local  = [{ id: 2, ts: 9, text: 'just sent' }];
    const server = [{ id: 1, ts: 5, text: 'srv' }];
    const out = _mergeById(local, server, {});
    const ids = out.map(m => m.id).sort();
    assert.deepStrictEqual(ids, [1, 2]);
});

test('_mergeById: يرتّب تنازلياً حسب ts (الأحدث أولاً)', () => {
    const server = [{ id: 1, ts: 100 }, { id: 2, ts: 300 }, { id: 3, ts: 200 }];
    const out = _mergeById([], server, {});
    assert.deepStrictEqual(out.map(m => m.id), [2, 3, 1]);
});

test('_mergeById: معرّفات نصية (سجل تدقيق) تعمل', () => {
    const local  = [{ id: 'a_1', ts: 5 }];
    const server = [{ id: 'a_2', ts: 9 }];
    const out = _mergeById(local, server, {});
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].id, 'a_2'); // الأحدث
});
