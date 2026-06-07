/* اختبارات الدوال النقية في الواجهة (تُشغَّل بـ: node --test ShaabApi.Tests/js)
   تحمي عطلَي 2026-06-07:
   - _canonRec: حلقة إرسال/409 اللانهائية بسبب offerName '' مقابل null + ترتيب المفاتيح.
   - _montasiaPhotoSrc: عرض صورة المنتسية (رابط جديد أو base64 قديم). */
const test = require('node:test');
const assert = require('node:assert');

const { _canonRec } = require('../../js/lib/canon.js');
const { _montasiaPhotoSrc } = require('../../js/upload.js');

test('_canonRec: offerName "" يساوي null (العطل الأساسي)', () => {
    const local  = { id: 1, type: 'جودة', offerName: '' };
    const server = { id: 1, type: 'جودة', offerName: null };
    assert.strictEqual(_canonRec(local), _canonRec(server));
});

test('_canonRec: المفتاح المفقود يساوي null', () => {
    const local  = { id: 1, type: 'جودة' };                 // لا offerName
    const server = { id: 1, type: 'جودة', offerName: null };
    assert.strictEqual(_canonRec(local), _canonRec(server));
});

test('_canonRec: اختلاف ترتيب المفاتيح لا يُحدث فرقاً', () => {
    const a = { id: 1, branch: 'عمان', status: 'تم التسليم' };
    const b = { status: 'تم التسليم', id: 1, branch: 'عمان' };
    assert.strictEqual(_canonRec(a), _canonRec(b));
});

test('_canonRec: اختلاف محتوى حقيقي يُكتشف', () => {
    const a = { id: 1, offerName: 'عرض أ' };
    const b = { id: 1, offerName: 'عرض ب' };
    assert.notStrictEqual(_canonRec(a), _canonRec(b));
});

test('_canonRec: كائنات/مصفوفات متداخلة تُقارَن قانونياً', () => {
    const a = { id: 1, items: [{ n: 'x', w: '' }], meta: { b: 1, a: 2 } };
    const b = { id: 1, meta: { a: 2, b: 1 }, items: [{ w: null, n: 'x' }] };
    assert.strictEqual(_canonRec(a), _canonRec(b));
});

test('_montasiaPhotoSrc: photoUrl يُعاد كما هو', () => {
    assert.strictEqual(_montasiaPhotoSrc({ photoUrl: 'api/files/abc' }), 'api/files/abc');
});

test('_montasiaPhotoSrc: base64 خام يُغلَّف بـ data:', () => {
    assert.strictEqual(
        _montasiaPhotoSrc({ photoBase64: 'AAAABBBB' }),
        'data:image/jpeg;base64,AAAABBBB'
    );
});

test('_montasiaPhotoSrc: رابط مخزّن في الحقل القديم يُعاد كما هو', () => {
    assert.strictEqual(
        _montasiaPhotoSrc({ photoBase64: '/api/files/xyz' }),
        '/api/files/xyz'
    );
});

test('_montasiaPhotoSrc: لا صورة → سلسلة فارغة', () => {
    assert.strictEqual(_montasiaPhotoSrc({}), '');
    assert.strictEqual(_montasiaPhotoSrc(null), '');
});

test('_montasiaPhotoSrc: photoUrl له الأولوية على photoBase64', () => {
    assert.strictEqual(
        _montasiaPhotoSrc({ photoUrl: 'api/files/new', photoBase64: 'OLD' }),
        'api/files/new'
    );
});
