/* ══════════════════════════════════════════════════════
   رفع الملفات/الصور (Migration #11 — image off-loading)
   يرفع الملف إلى /api/files ويُرجع رابطاً صغيراً (/api/files/{id})
   يُخزَّن داخل السجل بدل base64 الضخم. عند فشل الرفع أو في الوضع
   المحلي (file://) يعود إلى base64 حتى لا تضيع الصورة.
   ══════════════════════════════════════════════════════ */
function _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

/**
 * يرفع File/Blob إلى السيرفر ويُرجع رابط /api/files/{id}.
 * عند الفشل (أو الوضع المحلي) يُرجع data:base64 كحل احتياطي.
 * @param {File|Blob} file
 * @param {string} [refType]  نوع السجل (employee/complaint/inquiry/message…) — للتنظيف المستقبلي
 * @param {string|number} [refId]
 * @returns {Promise<string|null>} الرابط أو data URL أو null
 */
async function _uploadFile(file, refType, refId) {
    if (!file) return null;

    // الوضع المحلي (file://) — لا سيرفر: احتفظ بـ base64 كما كان
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) {
        try { return await _fileToDataUrl(file); } catch { return null; }
    }

    const token = (typeof getSavedToken === 'function')
        ? getSavedToken()
        : localStorage.getItem('_shaab_token');

    const fd = new FormData();
    fd.append('file', file);
    if (refType) fd.append('refType', String(refType));
    if (refId != null) fd.append('refId', String(refId));

    try {
        const res = await fetch('api/files', {
            method:  'POST',
            // ⚠️ لا تضع Content-Type يدوياً — المتصفح يضبط boundary الخاص بـ multipart
            headers: { 'Authorization': 'Bearer ' + token },
            body:    fd
        });
        if (!res.ok) throw new Error('upload failed: ' + res.status);
        const data = await res.json();
        if (!data || !data.url) throw new Error('upload: no url in response');
        return data.url; // مثل: api/files/ab12…
    } catch (err) {
        console.warn('[_uploadFile] فشل الرفع — fallback إلى base64:', err);
        try { return await _fileToDataUrl(file); } catch { return null; }
    }
}

/**
 * يرفع فيديو إلى /api/videos (يُخزَّن كملف على القرص، لا داخل قاعدة البيانات)
 * ويُرجع رابط api/videos/{id}. عند الفشل أو في الوضع المحلي يُرجع null
 * (لا نحوّل الفيديو إلى base64 — كبير جداً ويضخّم localStorage).
 * @param {File|Blob} file
 * @param {string} [refType]
 * @param {string|number} [refId]
 * @returns {Promise<string|null>}
 */
async function _uploadVideo(file, refType, refId) {
    if (!file) return null;

    // الوضع المحلي (file://) — لا سيرفر ولا تخزين قرص
    if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) {
        console.warn('[_uploadVideo] وضع محلي — لن يُرفع الفيديو');
        return null;
    }

    const token = (typeof getSavedToken === 'function')
        ? getSavedToken()
        : localStorage.getItem('_shaab_token');

    const fd = new FormData();
    fd.append('file', file);
    if (refType) fd.append('refType', String(refType));
    if (refId != null) fd.append('refId', String(refId));

    try {
        const res = await fetch('api/videos', {
            method:  'POST',
            // ⚠️ لا تضع Content-Type يدوياً — المتصفح يضبط boundary الخاص بـ multipart
            headers: { 'Authorization': 'Bearer ' + token },
            body:    fd
        });
        if (!res.ok) throw new Error('video upload failed: ' + res.status);
        const data = await res.json();
        if (!data || !data.url) throw new Error('video upload: no url in response');
        return data.url; // مثل: api/videos/ab12…
    } catch (err) {
        console.warn('[_uploadVideo] فشل رفع الفيديو:', err);
        return null;
    }
}

/**
 * مصدر صورة المنتسية للعرض: يدعم الصيغة الجديدة (رابط photoUrl /api/files)
 * والقديمة (photoBase64 — base64 خام). يُرجع '' إن لم توجد صورة.
 */
function _montasiaPhotoSrc(rec) {
    if (!rec) return '';
    if (rec.photoUrl) return String(rec.photoUrl);          // الجديد: رابط
    if (rec.photoBase64) {
        const v = String(rec.photoBase64);
        if (/^(https?:|\/|api\/)/i.test(v)) return v;       // رابط مخزّن بالخطأ في الحقل القديم
        return 'data:image/jpeg;base64,' + v;               // القديم: base64 خام
    }
    return '';
}

/* ── مشغّل الفيديو (نافذة منبثقة تدعم التمرير/Seek) ── */
function _playVideo(url) {
    if (!url) return;
    let ov = document.getElementById('_videoOverlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = '_videoOverlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:20px;';
        ov.onclick = (e) => { if (e.target === ov) _closeVideo(); };
        const box = document.createElement('div');
        box.style.cssText = 'position:relative;max-width:900px;width:100%;';
        box.innerHTML = '<button onclick="_closeVideo()" style="position:absolute;top:-42px;left:0;background:#fff;color:#c62828;border:none;border-radius:8px;padding:6px 16px;font-family:Cairo;font-weight:700;cursor:pointer;font-size:13px;">✕ إغلاق</button>'
            + '<video id="_videoPlayer" controls autoplay playsinline style="width:100%;max-height:80vh;border-radius:10px;background:#000;"></video>';
        ov.appendChild(box);
        document.body.appendChild(ov);
    }
    const vp = document.getElementById('_videoPlayer');
    if (vp) { vp.src = url; try { vp.play(); } catch {} }
    ov.style.display = 'flex';
}
function _closeVideo() {
    const ov = document.getElementById('_videoOverlay');
    const vp = document.getElementById('_videoPlayer');
    if (vp) { try { vp.pause(); } catch {} vp.removeAttribute('src'); try { vp.load(); } catch {} }
    if (ov) ov.style.display = 'none';
}
/* زر "مشاهدة الفيديو" — يُرجع HTML فارغاً إن لم يوجد فيديو */
function _videoWatchBtn(url) {
    if (!url) return '';
    const safe = String(url).replace(/'/g, '%27').replace(/"/g, '%22');
    return `<button onclick="_playVideo('${safe}')" title="مشاهدة الفيديو" style="border:1px solid rgba(186,104,200,0.45);cursor:pointer;font-family:Cairo;background:rgba(156,39,176,0.12);color:#ce93d8;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:700;">🎥 مشاهدة الفيديو</button>`;
}

if (typeof window !== 'undefined') {
    window._uploadFile       = _uploadFile;
    window._uploadVideo      = _uploadVideo;
    window._playVideo        = _playVideo;
    window._closeVideo       = _closeVideo;
    window._videoWatchBtn    = _videoWatchBtn;
    window._fileToDataUrl    = _fileToDataUrl;
    window._montasiaPhotoSrc = _montasiaPhotoSrc;
}
/* node: تصدير الدالة النقية للاختبار (لا يؤثر على المتصفح) */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _montasiaPhotoSrc };
}
