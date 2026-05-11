/* ══════════════════════════════════════════════════════
   Auto-Backup System  (v2)
   - Captures a snapshot of all system DBs (live values, not stale localStorage)
   - Manual backup, sync-then-backup, and auto-sync every minute (manager-only)
   - Rolling buffer of last N snapshots
   - Manager UI: list / restore / download / clear / import / auto-toggle
   ══════════════════════════════════════════════════════ */

const _AB_STORE_KEY      = 'Shaab_AutoBackups';
const _AB_AUTO_KEY       = 'Shaab_AutoBackup_Auto';   // '1' = on, '0'/null = off
const _AB_MAX_SNAPSHOTS  = 100;
const _AB_DEBOUNCE_MS    = 1500;
const _AB_AUTOSYNC_MS    = 15 * 60_000;               // كل 15 دقيقة
const _AB_FS_DB_NAME     = 'Shaab_AutoBackup_FS';     // IndexedDB لتخزين folder handle
const _AB_FS_HANDLE_KEY  = 'folderHandle';
const _AB_FS_MODE_KEY    = 'Shaab_AutoBackup_FsMode'; // 'override' (افتراضي) | 'accumulate'
const _AB_FS_FIXED_NAME  = 'shaab_backup_latest.json';
const _AB_FS_ROLLING_MAX = 100;                       // أقصى عدد ملفات في النمط التراكمي
const _AB_FS_NAME_REGEX  = /^shaab_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[A-Za-z0-9_-]*\.json$/i;
const _AB_TRACKED_KEYS   = [
    'Shaab_Master_DB',       // المنتسيات + الاستفسارات + الشكاوى + audit log + التعويضات
    'Shaab_Employees_DB',    // كل حسابات المستخدمين/الموظفين بدون استثناء
    'Shaab_Breaks_DB',       // فترات الراحة
    'Shaab_Sessions_DB',     // الجلسات
    'Shaab_PriceList_DB'     // قائمة الأسعار
];

let _abTimer       = null;   // debounce لـ snapshot بعد التعديلات
let _abAutoTimer   = null;   // تايمر المزامنة التلقائية (دقيقة)
let _abLastSyncTs  = 0;      // طابع زمني لآخر مزامنة ناجحة
let _abFolderInfo  = { name: null, hasPermission: false };  // حالة المجلد المختار

function _abReadAll() {
    try { return JSON.parse(localStorage.getItem(_AB_STORE_KEY) || '[]'); }
    catch { return []; }
}

function _abWriteAll(arr) {
    while (arr.length > 0) {
        try { localStorage.setItem(_AB_STORE_KEY, JSON.stringify(arr)); return true; }
        catch (e) {
            // QuotaExceeded — drop the oldest and retry
            arr.shift();
        }
    }
    try { localStorage.removeItem(_AB_STORE_KEY); } catch {}
    return false;
}

/* ── قراءة البيانات الحيّة (من المتغيرات في الذاكرة، أو localStorage كـ fallback) ── */
function _abReadLiveData() {
    const out  = {};
    const live = (typeof IS_LOCAL !== 'undefined' && !IS_LOCAL);

    if (live) {
        try { if (typeof db        !== 'undefined' && db        != null) out['Shaab_Master_DB']    = JSON.stringify(db); } catch {}
        try { if (typeof employees !== 'undefined' && employees != null) out['Shaab_Employees_DB'] = JSON.stringify(employees); } catch {}
        try { if (typeof breaks    !== 'undefined' && breaks    != null) out['Shaab_Breaks_DB']    = JSON.stringify(breaks); } catch {}
        try { if (typeof sessions  !== 'undefined' && sessions  != null) out['Shaab_Sessions_DB']  = JSON.stringify(sessions); } catch {}
        try { if (typeof priceList !== 'undefined' && priceList != null) out['Shaab_PriceList_DB'] = JSON.stringify(priceList); } catch {}
    }
    // fallback لأي مفتاح ناقص
    for (const k of _AB_TRACKED_KEYS) {
        if (out[k]) continue;
        const v = localStorage.getItem(k);
        if (v != null) out[k] = v;
    }
    return out;
}

function _abMakeSnapshot(reason) {
    const data = _abReadLiveData();
    let totalSize = 0;
    for (const k in data) totalSize += (data[k] || '').length;
    return {
        ts:     Date.now(),
        iso:    new Date().toISOString(),
        reason: reason || 'auto',
        user:   (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '—',
        empId:  (typeof currentUser !== 'undefined' && currentUser && currentUser.empId) || '—',
        size:   totalSize,
        data:   data
    };
}

function _abDigest(snap) {
    try {
        const dbo = JSON.parse(snap.data['Shaab_Master_DB']    || '{}');
        const emp = JSON.parse(snap.data['Shaab_Employees_DB'] || '[]');
        return {
            montasiat:  (dbo.montasiat  || []).length,
            inquiries:  (dbo.inquiries  || []).length,
            complaints: (dbo.complaints || []).length,
            employees:  Array.isArray(emp) ? emp.length : 0
        };
    } catch { return { montasiat:0, inquiries:0, complaints:0, employees:0 }; }
}

/* حارس فقدان البيانات — يمنع كتابة snapshot فارغ فوق النسخ الجيدة
   يُرجع سبب الفقدان (string) أو false إذا البيانات صحية. */
function _abDetectDataLoss(snap, prevSnap) {
    if (!prevSnap || !prevSnap.data || !snap || !snap.data) return false;
    try {
        const prevDb  = JSON.parse(prevSnap.data['Shaab_Master_DB']    || '{}');
        const newDb   = JSON.parse(snap.data['Shaab_Master_DB']        || '{}');
        const prevEmp = JSON.parse(prevSnap.data['Shaab_Employees_DB'] || '[]');
        const newEmp  = JSON.parse(snap.data['Shaab_Employees_DB']     || '[]');

        // 1. الموظفون اختفوا
        if (Array.isArray(prevEmp) && prevEmp.length > 0 &&
            (!Array.isArray(newEmp) || newEmp.length === 0))
            return 'الموظفون فارغون (' + prevEmp.length + ' → 0)';

        // 2. المنتسيات اختفت
        const prevM = Array.isArray(prevDb.montasiat) ? prevDb.montasiat.length : 0;
        const newM  = Array.isArray(newDb.montasiat)  ? newDb.montasiat.length  : 0;
        if (prevM > 0 && newM === 0)
            return 'المنتسيات فارغة (' + prevM + ' → 0)';

        // 3. انخفاض حاد في الحجم > 50% (يلتقط أي اختفاء كبير لم تغطه القاعدتان أعلاه)
        if (prevSnap.size > 2048 && snap.size < prevSnap.size * 0.5)
            return 'انخفاض حاد في الحجم (' + prevSnap.size + ' → ' + snap.size + ')';

        return false;
    } catch { return false; }
}

let _abLastBlockedAt = 0; // طابع زمني لآخر منع — يظهر في الواجهة
let _abLastBlockedReason = '';

function _abTakeSnapshot(reason) {
    try {
        const arr  = _abReadAll();
        const snap = _abMakeSnapshot(reason);

        // حارس فقدان البيانات — إن كانت اللقطة تبدو فارغة بعد بيانات جيدة، ارفض الحفظ
        const last = arr.length > 0 ? arr[arr.length - 1] : null;
        const lossReason = _abDetectDataLoss(snap, last);
        if (lossReason) {
            _abLastBlockedAt = Date.now();
            _abLastBlockedReason = lossReason;
            console.warn('[autoBackup] 🛑 BLOCKED snapshot — ' + lossReason);
            // ملاحظة: القفل التلقائي للنظام عند فقدان البيانات أُلغي بناءً على طلب المستخدم
            // الـ snapshot الفارغ ما زال يُرفض (لا يُحفظ فوق نسخة جيدة)، لكن لا يتفعّل قفل النظام تلقائياً
            // القفل اليدوي للسوبر أدمن من زر "🔒 قفل النظام يدوياً" لا يزال متاحاً
            return null;
        }

        // dedupe — تخطٍّ النسخ المتطابقة لأهم مفتاحَين
        if (arr.length > 0) {
            const last       = arr[arr.length - 1];
            const sameMaster = last.data && last.data['Shaab_Master_DB']    === snap.data['Shaab_Master_DB'];
            const sameEmp    = last.data && last.data['Shaab_Employees_DB'] === snap.data['Shaab_Employees_DB'];
            // dedup للنسخ المُحفَّزة بحدث (save/SSE/polling/startup) — لا تُكتَب لو لم يتغيّر شيء
            // autosync (التايمر كل 15د) يُحفَظ دائماً ليكون "نبضة حياة" حتى بدون تغيير
            const isAuto = !reason || reason === 'auto' || reason.startsWith('save:') ||
                           reason === 'startup' ||
                           reason === 'sync'    || reason === 'remote-load';
            if (isAuto && sameMaster && sameEmp) return null;
        }
        arr.push(snap);
        while (arr.length > _AB_MAX_SNAPSHOTS) arr.shift();
        _abWriteAll(arr);
        // best-effort: اكتب نسخة على المجلد الذي اختاره المستخدم (إن وُجد + إذن ممنوح)
        if (typeof _abWriteToFolder === 'function') _abWriteToFolder(snap);
        return snap;
    } catch (e) { console.warn('[autoBackup] snapshot failed:', e); return null; }
}

function _abScheduleSnapshot(reason) {
    if (_abTimer) clearTimeout(_abTimer);
    _abTimer = setTimeout(() => { _abTimer = null; _abTakeSnapshot(reason); }, _AB_DEBOUNCE_MS);
}

/* ── hook into existing data mutations ── */
(function _abInstallHooks() {
    let installed = false;
    const tryInstall = () => {
        if (installed) return;
        if (typeof window._push !== 'function') return;
        const orig = window._push;
        window._push = function(key, value) {
            const r = orig.apply(this, arguments);
            if (_AB_TRACKED_KEYS.indexOf(key) !== -1) _abScheduleSnapshot('save:' + key);
            return r;
        };
        installed = true;
    };
    if (typeof window._push === 'function') tryInstall();
    else {
        const t = setInterval(() => { tryInstall(); if (installed) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }

    setTimeout(() => _abTakeSnapshot('startup'), 4000);

    window.addEventListener('beforeunload', () => { try { _abTakeSnapshot('unload'); } catch {} });
})();

/* ── hook into loadAllData (يلتقط التغييرات الواردة من السيرفر فوراً) ─────
   loadAllData يُنفَّذ عند: SSE reload event، polling tick، تسجيل الدخول.
   إذا اختلفت البيانات عن آخر snapshot، يُكتَب snapshot جديد (dedupe يعتني بالباقي).
   ──────────────────────────────────────────────────────────────────────── */
(function _abInstallLoadHook() {
    let installed = false;
    const tryInstall = () => {
        if (installed) return;
        if (typeof window.loadAllData !== 'function') return;
        const orig = window.loadAllData;
        window.loadAllData = async function() {
            const r = await orig.apply(this, arguments);
            try { _abScheduleSnapshot('remote-load'); } catch {}
            return r;
        };
        installed = true;
    };
    if (typeof window.loadAllData === 'function') tryInstall();
    else {
        const t = setInterval(() => { tryInstall(); if (installed) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }
})();

/* ── helpers for UI ── */
function _abFormatBytes(n) {
    if (n == null) return '—';
    if (n < 1024)        return n.toLocaleString('en-US') + ' B';
    if (n < 1024*1024)   return n.toLocaleString('en-US') + ' B (' + (n/1024).toFixed(2) + ' KB)';
    return (n/1024/1024).toFixed(3) + ' MB (' + n.toLocaleString('en-US') + ' B)';
}

function _abFormatDelta(d) {
    if (d == null || d === 0) return '<span style="color:var(--text-dim);">±0 B</span>';
    const sign = d > 0 ? '+' : '−';
    const abs  = Math.abs(d);
    const txt  = sign + abs.toLocaleString('en-US') + ' B';
    const col  = d > 0 ? '#81c784' : '#ef9a9a';
    return '<span style="color:' + col + ';font-weight:700;">' + txt + '</span>';
}

function _abFormatTs(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('ar-EG');
    const timeStr = d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
    return dateStr + ' — ' + timeStr;
}

/* ══════════════════════════════════════════════════════
   مجلد الحفظ الدائم (File System Access API)
   - المستخدم يختار مجلداً مرة واحدة
   - الـ handle يُخزَّن في IndexedDB ويستمر بين الجلسات
   - كل snapshot يُكتب كملف .json في ذلك المجلد
   - مدعوم في Chrome/Edge؛ في Safari/Firefox: زر مخفي مع رسالة
   ══════════════════════════════════════════════════════ */
function _abOpenFsDb() {
    return new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(_AB_FS_DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore('handles');
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        } catch (e) { reject(e); }
    });
}

async function _abGetFolderHandle() {
    try {
        const db = await _abOpenFsDb();
        return await new Promise((resolve, reject) => {
            const tx  = db.transaction('handles', 'readonly');
            const req = tx.objectStore('handles').get(_AB_FS_HANDLE_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror   = () => reject(req.error);
        });
    } catch { return null; }
}

async function _abSaveFolderHandle(handle) {
    try {
        const db = await _abOpenFsDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(handle, _AB_FS_HANDLE_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => reject(tx.error);
        });
    } catch { return false; }
}

async function _abClearFolderHandleFromDb() {
    try {
        const db = await _abOpenFsDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').delete(_AB_FS_HANDLE_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => reject(tx.error);
        });
    } catch { return false; }
}

async function _abQueryPerm(handle) {
    try { return await handle.queryPermission({ mode: 'readwrite' }); }
    catch { return 'prompt'; }
}
async function _abRequestPerm(handle) {
    try { return await handle.requestPermission({ mode: 'readwrite' }); }
    catch { return 'denied'; }
}

async function _abRefreshFolderInfo() {
    const handle = await _abGetFolderHandle();
    if (!handle) {
        _abFolderInfo = { name: null, hasPermission: false };
    } else {
        const status = await _abQueryPerm(handle);
        _abFolderInfo = { name: handle.name, hasPermission: status === 'granted' };
    }
    const lbl = document.getElementById('_abFolderLabel');
    if (lbl) {
        if (_abFolderInfo.name) {
            const tag = _abFolderInfo.hasPermission
                ? '<span style="color:#81c784;">✓ جاهز</span>'
                : '<span class="ab-hint-amber">⚠ يحتاج إذن</span>';
            lbl.innerHTML = `📁 <b>${_abFolderInfo.name}</b> · ${tag}`;
        } else {
            lbl.innerHTML = '<span style="color:var(--text-dim);">لم يُحدَّد مجلد بعد</span>';
        }
    }
}

async function pickBackupFolder() {
    if (!('showDirectoryPicker' in window)) {
        alert('متصفّحك لا يدعم حفظ المجلد. استعمل Chrome أو Edge أحدث إصدار.\n\nبديلاً: استعمل زر "⬇ تنزيل" لكل نسخة على حدة.');
        return;
    }
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        // request permission مباشرةً (نحن داخل user-gesture)
        const perm = await _abRequestPerm(handle);
        if (perm !== 'granted') {
            alert('لم يُمنح الإذن للكتابة في المجلد.');
            return;
        }
        await _abSaveFolderHandle(handle);
        await _abRefreshFolderInfo();
        // كتابة آخر snapshot كاختبار
        const arr = _abReadAll();
        if (arr.length > 0) await _abWriteToFolder(arr[arr.length - 1]);
        alert('تم اختيار المجلد: ' + handle.name + '\n\n✓ سيتم حفظ كل النسخ القادمة فيه تلقائياً (بالإضافة لذاكرة المتصفح).');
        if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
    } catch (e) {
        if (e.name !== 'AbortError') alert('فشل اختيار المجلد: ' + e.message);
    }
}

async function clearBackupFolder() {
    if (!confirm('إلغاء ربط مجلد الحفظ؟ لن تُحفَظ النسخ القادمة على القرص (تبقى في المتصفح فقط).')) return;
    await _abClearFolderHandleFromDb();
    await _abRefreshFolderInfo();
    if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
}

async function reauthorizeBackupFolder() {
    const handle = await _abGetFolderHandle();
    if (!handle) { pickBackupFolder(); return; }
    const result = await _abRequestPerm(handle);
    if (result === 'granted') {
        await _abRefreshFolderInfo();
        // اكتب آخر snapshot كاختبار
        const arr = _abReadAll();
        if (arr.length > 0) await _abWriteToFolder(arr[arr.length - 1]);
        alert('✓ تم تجديد الإذن. سيستمر الحفظ التلقائي على القرص.');
    } else {
        alert('لم يُمنح الإذن. حاول مرة أخرى أو اختر مجلداً جديداً.');
    }
    if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
}

function _abGetFsMode() {
    try { return localStorage.getItem(_AB_FS_MODE_KEY) || 'override'; }
    catch { return 'override'; }
}
function _abSetFsMode(mode) {
    try { localStorage.setItem(_AB_FS_MODE_KEY, mode === 'accumulate' ? 'accumulate' : 'override'); } catch {}
}

async function _abEnforceRollingCap(handle) {
    try {
        const names = [];
        for await (const entry of handle.values()) {
            if (entry.kind !== 'file') continue;
            if (_AB_FS_NAME_REGEX.test(entry.name)) names.push(entry.name);
        }
        if (names.length <= _AB_FS_ROLLING_MAX) return 0;
        names.sort(); // طابع زمني داخل الاسم → ترتيب أبجدي = ترتيب زمني
        const toDelete = names.slice(0, names.length - _AB_FS_ROLLING_MAX);
        let deleted = 0;
        for (const n of toDelete) {
            try { await handle.removeEntry(n); deleted++; }
            catch (e) { console.warn('[autoBackup] could not delete', n, e); }
        }
        return deleted;
    } catch (e) { console.warn('[autoBackup] rolling cleanup failed:', e); return 0; }
}

async function _abWriteToFolder(snap) {
    try {
        const handle = await _abGetFolderHandle();
        if (!handle) return false;
        const perm = await _abQueryPerm(handle);
        if (perm !== 'granted') return false; // لا نطلب إذناً خارج user-gesture

        const mode = _abGetFsMode();
        let fname;
        if (mode === 'accumulate') {
            const ts = new Date(snap.ts);
            const pad = (n) => String(n).padStart(2, '0');
            const safeReason = String(snap.reason || 'auto').replace(/[^a-zA-Z0-9_-]/g, '');
            fname = `shaab_backup_${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())}_` +
                    `${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}_${safeReason}.json`;
        } else {
            // override: ملف واحد ثابت يُكتب فوقه في كل مرة
            fname = _AB_FS_FIXED_NAME;
        }
        const fileHandle = await handle.getFileHandle(fname, { create: true });
        const writable   = await fileHandle.createWritable();
        await writable.write(JSON.stringify(snap, null, 2));
        await writable.close();

        // في النمط التراكمي: قصّ القائمة عند الحدّ الأقصى (rolling buffer)
        if (mode === 'accumulate') {
            _abEnforceRollingCap(handle); // خلفياً، لا ننتظر
        }
        return true;
    } catch (e) { console.warn('[autoBackup] folder write failed:', e); return false; }
}

function toggleFsMode() {
    const cur = _abGetFsMode();
    _abSetFsMode(cur === 'override' ? 'accumulate' : 'override');
    if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
}

/* ── Manual snapshot ── */
function takeManualBackup() {
    _abTakeSnapshot('manual');
    if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
}

/* ── مزامنة لحظية + نسخة احتياطية ── */
async function syncAndBackup(reason) {
    const tag = reason || 'sync';
    try {
        if (typeof loadAllData === 'function') {
            await loadAllData();
        }
        _abLastSyncTs = Date.now();
    } catch (e) {
        console.warn('[autoBackup] sync failed:', e);
        // نأخذ snapshot رغم فشل المزامنة (من البيانات الحالية)
    }
    const snap = _abTakeSnapshot(tag);
    if (snap) {
        console.log('[autoBackup] ✓ snapshot saved (' + tag + ') · size=', snap.size, 'B');
    } else {
        console.log('[autoBackup] ⊘ snapshot rejected (' + tag + ') — dedup or data-loss guard');
    }
    // تحديث الواجهة إن كانت مفتوحة
    const lbl = document.getElementById('_abLastSyncLabel');
    if (lbl) lbl.textContent = _abFormatTs(_abLastSyncTs);
}

async function manualSyncAndBackup() {
    const btn = document.getElementById('_abSyncBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري المزامنة...'; }
    try { await syncAndBackup('manual-sync'); }
    finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 مزامنة + نسخة الآن'; }
        if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
    }
}

/* ── مزامنة تلقائية كل دقيقة ── */
function isAutoBackupOn() {
    // الافتراضي: مفعَّل (null/undefined → on). فقط '0' الصريح يوقفه.
    try { return localStorage.getItem(_AB_AUTO_KEY) !== '0'; }
    catch { return true; }
}

function startAutoBackup() {
    stopAutoBackup();
    try { localStorage.setItem(_AB_AUTO_KEY, '1'); } catch {}
    console.log('[autoBackup] ✓ autosync timer started — every', _AB_AUTOSYNC_MS/60000, 'minutes (runs even when tab hidden)');
    _abAutoTimer = setInterval(() => {
        console.log('[autoBackup] ⏰ autosync tick @', new Date().toLocaleTimeString(), '· hidden:', document.hidden);
        syncAndBackup('autosync');
    }, _AB_AUTOSYNC_MS);
}

function stopAutoBackup() {
    if (_abAutoTimer) { clearInterval(_abAutoTimer); _abAutoTimer = null; }
    try { localStorage.setItem(_AB_AUTO_KEY, '0'); } catch {}
}

function toggleAutoBackup() {
    if (isAutoBackupOn()) stopAutoBackup();
    else                  startAutoBackup();
    if (typeof showAutoBackupsModal === 'function') showAutoBackupsModal();
}

/* ── Merge-restore helpers ──
   كل سجل في النظام يُنشأ بـ id = Date.now() — فالسجلات اللي id > snap.ts
   مضافة بعد وقت الباكب، ويجب الاحتفاظ بها أثناء الاستعادة. */
function _abMergeArrayById(baseArr, currentArr, snapTs) {
    if (!Array.isArray(baseArr))    baseArr = [];
    if (!Array.isArray(currentArr)) return baseArr;
    const baseIds = new Set();
    for (const r of baseArr) if (r && r.id != null) baseIds.add(r.id);
    const extras = [];
    for (const r of currentArr) {
        if (!r || r.id == null) continue;
        if (r.id > snapTs && !baseIds.has(r.id)) extras.push(r);
    }
    return baseArr.concat(extras);
}

function _abBuildMergedData(snap) {
    const live = _abReadLiveData();
    const out  = {};
    const ts   = (snap && snap.ts) || 0;

    // Shaab_Master_DB: كائن فيه عدة مصفوفات
    try {
        const baseDb = JSON.parse((snap.data && snap.data['Shaab_Master_DB']) || '{}');
        const liveDb = JSON.parse(live['Shaab_Master_DB']                     || '{}');
        const merged = Object.assign({}, baseDb);
        for (const sk of ['montasiat','inquiries','complaints','compensations','auditLog']) {
            merged[sk] = _abMergeArrayById(baseDb[sk], liveDb[sk], ts);
        }
        out['Shaab_Master_DB'] = JSON.stringify(merged);
    } catch { out['Shaab_Master_DB'] = snap.data && snap.data['Shaab_Master_DB']; }

    // مصفوفات مباشرة على المستوى الأعلى
    for (const k of ['Shaab_Employees_DB','Shaab_Breaks_DB','Shaab_Sessions_DB']) {
        try {
            const baseArr = JSON.parse((snap.data && snap.data[k]) || '[]');
            const liveArr = JSON.parse(live[k]                     || '[]');
            out[k] = JSON.stringify(_abMergeArrayById(baseArr, liveArr, ts));
        } catch { out[k] = snap.data && snap.data[k]; }
    }

    // قائمة الأسعار: إعدادات (ليست سجلات بـ id) — استبدال كامل
    out['Shaab_PriceList_DB'] = snap.data && snap.data['Shaab_PriceList_DB'];

    return out;
}

/* ── Restore from snapshot — استعادة ذكية تحتفظ بالسجلات المضافة بعد وقت الباكب ── */
function restoreAutoBackup(idx) {
    const arr = _abReadAll();
    const snap = arr[idx];
    if (!snap) { alert('النسخة غير موجودة'); return; }

    // ابنِ بيانات الدمج أولاً عشان نقدر نعرض عدد السجلات الجديدة في الحوار
    const merged    = _abBuildMergedData(snap);
    const baseDig   = _abDigest(snap);
    const mergedDig = _abDigest({ data: merged });
    const extra = {
        montasiat:  Math.max(0, mergedDig.montasiat  - baseDig.montasiat),
        inquiries:  Math.max(0, mergedDig.inquiries  - baseDig.inquiries),
        complaints: Math.max(0, mergedDig.complaints - baseDig.complaints),
        employees:  Math.max(0, mergedDig.employees  - baseDig.employees)
    };
    const totalExtra = extra.montasiat + extra.inquiries + extra.complaints + extra.employees;

    const msg = 'هل أنت متأكد من استعادة نسخة ' + _abFormatTs(snap.ts) + '؟\n\n' +
                'البيانات في النسخة:\n' +
                '  • منتسيات: '   + baseDig.montasiat  + (extra.montasiat  ? '  (+ ' + extra.montasiat  + ' جديد)' : '') + '\n' +
                '  • استفسارات: ' + baseDig.inquiries  + (extra.inquiries  ? '  (+ ' + extra.inquiries  + ' جديد)' : '') + '\n' +
                '  • شكاوى: '    + baseDig.complaints + (extra.complaints ? '  (+ ' + extra.complaints + ' جديد)' : '') + '\n' +
                '  • موظفون: '   + baseDig.employees  + (extra.employees  ? '  (+ ' + extra.employees  + ' جديد)' : '') + '\n\n' +
                (totalExtra > 0
                    ? '♻ سيُحتفظ بـ ' + totalExtra + ' سجل أُضيف بعد وقت الباكب — لن يُحذف شيء جديد.'
                    : '♻ لا توجد سجلات جديدة بعد وقت الباكب — استعادة عادية.');
    if (!confirm(msg)) return;

    // التقط نسخة أمان قبل الاستعادة (قد تفشل لو localStorage ممتلئ — مقبول)
    const preSnap = _abMakeSnapshot('pre-restore');

    // فرّغ buffer النسخ الاحتياطية لإتاحة مساحة كافية لكتابة snapshot المستعاد
    try { localStorage.removeItem(_AB_STORE_KEY); console.log('[autoBackup] 🧹 cleared backups buffer to free space for restore'); } catch {}

    let _writeErrors = [];
    for (const k of _AB_TRACKED_KEYS) {
        const v = merged[k];
        if (v != null) {
            try {
                if (typeof _push === 'function') _push(k, v);
                else localStorage.setItem(k, v);
            } catch (e) {
                console.warn('restore push failed for', k, e);
                _writeErrors.push(k + ': ' + (e && e.name === 'QuotaExceededError' ? 'مساحة ممتلئة' : (e.message || 'فشل')));
            }
        }
    }
    console.log('[autoBackup] ♻ smart-restore: kept ' + totalExtra + ' record(s) added after snapshot');

    // أعد كتابة pre-restore فقط في الـ buffer (للتراجع لاحقاً إن أردت)
    if (preSnap) {
        try { _abWriteAll([preSnap]); } catch {}
    }

    if (_writeErrors.length > 0) {
        alert('⚠️ فشل كتابة بعض البيانات:\n' + _writeErrors.join('\n') + '\n\nقد تحتاج لمسح بيانات المتصفّح.');
    }
    // تحديث ناعم بدون reload — يحافظ على الجلسة (مهم في وضع file://)
    setTimeout(async () => {
        try {
            // قراءة مباشرة من localStorage (تتجاوز قفل _isLoading في loadAllData)
            const _readLS = (k, dflt) => {
                try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; }
                catch { return dflt; }
            };
            if (typeof IS_LOCAL !== 'undefined' && IS_LOCAL) {
                if (typeof db        !== 'undefined') db        = _readLS('Shaab_Master_DB',    { montasiat:[], inquiries:[], complaints:[] });
                if (typeof employees !== 'undefined') employees = _readLS('Shaab_Employees_DB', []);
                if (typeof breaks    !== 'undefined') breaks    = _readLS('Shaab_Breaks_DB',    []);
                if (typeof sessions  !== 'undefined') sessions  = _readLS('Shaab_Sessions_DB',  []);
                const _pl = _readLS('Shaab_PriceList_DB', null);
                if (typeof priceList !== 'undefined' && _pl) priceList = _pl;
                console.log('[autoBackup] ✓ restore: data read from localStorage —',
                    'montasiat:', (db.montasiat||[]).length,
                    '· employees:', (employees||[]).length);
            } else if (typeof loadAllData === 'function') {
                await loadAllData();
            }
            if (typeof renderAll === 'function') renderAll();
            alert('✓ تمّت الاستعادة وتحديث البيانات بنجاح.');
        } catch (e) {
            console.warn('[autoBackup] restore refresh failed:', e);
            if (confirm('تعذّر تحديث الواجهة. تحديث الصفحة الآن؟')) location.reload();
        }
    }, 300);
}

/* ── Download snapshot as JSON file ── */
function downloadAutoBackup(idx) {
    const arr = _abReadAll();
    const snap = arr[idx];
    if (!snap) return;
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shaab_backup_' + new Date(snap.ts).toISOString().replace(/[:.]/g,'-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ── Delete one or all ── */
function deleteAutoBackup(idx) {
    if (!confirm('حذف هذه النسخة؟')) return;
    const arr = _abReadAll();
    arr.splice(idx, 1);
    _abWriteAll(arr);
    showAutoBackupsModal();
}

function clearAllAutoBackups() {
    if (!confirm('حذف كل النسخ الاحتياطية المحلية؟ لا يمكن التراجع.')) return;
    try { localStorage.removeItem(_AB_STORE_KEY); } catch {}
    showAutoBackupsModal();
}

/* ── Import a backup file uploaded by user ── */
function importAutoBackupFile(input) {
    const f = input.files && input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
        try {
            const snap = JSON.parse(e.target.result);
            if (!snap || !snap.data || !snap.data['Shaab_Master_DB']) { alert('ملف غير صالح'); return; }
            const arr = _abReadAll();
            snap.reason = (snap.reason || 'imported') + ':import';
            arr.push(snap);
            while (arr.length > _AB_MAX_SNAPSHOTS) arr.shift();
            _abWriteAll(arr);
            showAutoBackupsModal();
        } catch (err) { alert('فشل قراءة الملف: ' + err.message); }
    };
    r.readAsText(f);
    input.value = '';
}

/* ── Modal UI ── */
function _abEnsureStyles() {
    if (document.getElementById('_abStyles')) return;
    const s = document.createElement('style');
    s.id = '_abStyles';
    s.textContent = `
        @keyframes _abSlideUp { from { opacity:0; transform:translateY(28px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes _abStampLand { 0% { opacity:0; transform:rotate(-12deg) scale(1.5); } 60% { opacity:1; transform:rotate(-12deg) scale(0.92); } 100% { opacity:1; transform:rotate(-12deg) scale(1); } }
        #_abOverlay { position:fixed; inset:0; background:radial-gradient(ellipse at center, rgba(60,30,8,0.92) 0%, rgba(15,8,2,0.96) 100%); backdrop-filter:blur(8px); z-index:100001; display:flex; align-items:center; justify-content:center; padding:20px; direction:rtl; font-family:'Cairo','Tajawal',sans-serif; }
        #_abOverlay .ab-wrap { max-width:760px; width:100%; max-height:92vh; display:flex; flex-direction:column; animation:_abSlideUp 0.45s cubic-bezier(0.34,1.3,0.64,1); }
        #_abOverlay .ab-instruction { background:linear-gradient(135deg,#25d366 0%,#128c7e 50%,#075e54 100%); color:#fff; padding:14px 22px; border-radius:18px 18px 0 0; display:flex; align-items:center; gap:14px; border:1.5px solid rgba(37,211,102,0.5); border-bottom:0; box-shadow:0 -6px 26px rgba(7,94,84,0.45); position:relative; overflow:hidden; }
        #_abOverlay .ab-instruction::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 14px); pointer-events:none; }
        #_abOverlay .ab-instruction-icon { width:38px; height:38px; background:rgba(255,255,255,0.22); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; border:1.5px solid rgba(255,255,255,0.35); }
        #_abOverlay .ab-instruction-text { font-size:13.5px; font-weight:800; line-height:1.55; letter-spacing:0.2px; text-shadow:0 1px 2px rgba(0,0,0,0.25); }
        #_abOverlay .ab-receipt { background:linear-gradient(180deg, #fdf8ef 0%, #faf2e3 100%); border:1.5px solid rgba(139,69,19,0.25); border-radius:0 0 18px 18px; box-shadow:0 36px 90px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.85); position:relative; overflow:hidden; display:flex; flex-direction:column; flex:1; min-height:0; }
        #_abOverlay .ab-receipt::before { content:''; position:absolute; inset:0; background-image: radial-gradient(circle at 14% 18%, rgba(139,69,19,0.04) 0, transparent 12%), radial-gradient(circle at 86% 78%, rgba(120,53,15,0.05) 0, transparent 14%); pointer-events:none; }
        #_abOverlay .ab-bean { position:absolute; font-size:18px; opacity:0.18; user-select:none; pointer-events:none; }
        #_abOverlay .ab-bean.ab-b1 { top:8px; right:14px; transform:rotate(35deg); }
        #_abOverlay .ab-bean.ab-b2 { bottom:60px; left:18px; transform:rotate(-22deg); font-size:14px; }
        #_abOverlay .ab-close { position:absolute; top:12px; left:14px; z-index:5; width:30px; height:30px; border-radius:50%; background:rgba(58,40,24,0.08); color:#5c3919; border:1px solid rgba(58,40,24,0.18); font-size:14px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.18s, transform 0.18s; font-family:'Cairo'; }
        #_abOverlay .ab-close:hover { background:rgba(198,40,40,0.12); color:#c62828; transform:rotate(90deg); }
        #_abOverlay .ab-head { padding:22px 28px 16px; text-align:center; border-bottom:2px dashed rgba(139,69,19,0.22); position:relative; }
        #_abOverlay .ab-brand { font-size:10.5px; font-weight:800; color:#8b6f47; letter-spacing:4px; margin-bottom:8px; text-transform:uppercase; }
        #_abOverlay .ab-title { font-size:18px; font-weight:900; color:#3a2818; letter-spacing:0.3px; line-height:1.4; }
        #_abOverlay .ab-stamp { position:absolute; top:16px; right:22px; transform:rotate(-12deg); border:2.5px solid #c62828; color:#c62828; padding:4px 12px; border-radius:6px; font-size:11px; font-weight:900; letter-spacing:1.5px; background:rgba(198,40,40,0.04); animation:_abStampLand 0.7s 0.35s cubic-bezier(0.5,1.6,0.4,1) both; opacity:0; }
        #_abOverlay .ab-section { padding:12px 28px; border-bottom:2px dashed rgba(139,69,19,0.22); display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        #_abOverlay .ab-section-folder { background:rgba(192,147,93,0.08); }
        #_abOverlay .ab-section-label { font-size:12px; font-weight:700; color:#7a5a3a; min-width:140px; }
        #_abOverlay .ab-folder-label { font-size:12px; flex:1; min-width:140px; color:#5c3919; font-weight:600; }
        #_abOverlay .ab-btn { padding:8px 14px; border:0; border-radius:10px; cursor:pointer; font-family:'Cairo','Tajawal',sans-serif; font-weight:800; font-size:12.5px; letter-spacing:0.2px; transition:transform 0.18s, box-shadow 0.18s; }
        #_abOverlay .ab-btn:hover { transform:translateY(-1px); box-shadow:0 6px 14px rgba(0,0,0,0.18); }
        #_abOverlay .ab-btn-primary { background:linear-gradient(135deg,#6b4422,#3a2818); color:#fdf8ef; box-shadow:0 4px 12px rgba(58,40,24,0.35), inset 0 1px 0 rgba(255,255,255,0.18); }
        #_abOverlay .ab-btn-info { background:linear-gradient(135deg,#1976d2,#0d47a1); color:#fff; box-shadow:0 4px 12px rgba(13,71,161,0.3); }
        #_abOverlay .ab-btn-success { background:linear-gradient(135deg,#2e7d32,#1b5e20); color:#fff; box-shadow:0 4px 12px rgba(27,94,32,0.3); }
        #_abOverlay .ab-btn-purple { background:linear-gradient(135deg,#6a1b9a,#4a148c); color:#fff; box-shadow:0 4px 12px rgba(74,20,140,0.3); }
        #_abOverlay .ab-btn-soft { background:#fff; color:#3a2818; border:1.5px solid rgba(139,69,19,0.22); }
        #_abOverlay .ab-btn-soft:hover { border-color:#c0935d; background:#fff5dc; }
        #_abOverlay .ab-btn-danger { background:rgba(198,40,40,0.12); color:#c62828; border:1.5px solid rgba(198,40,40,0.35); }
        #_abOverlay .ab-btn-danger:hover { background:rgba(198,40,40,0.22); }
        #_abOverlay .ab-btn-grow { margin-right:auto; }
        #_abOverlay .ab-toggle-on  { background:linear-gradient(135deg,#2e7d32,#1b5e20); color:#fff; }
        #_abOverlay .ab-toggle-off { background:rgba(139,69,19,0.12); color:#7a5a3a; border:1.5px solid rgba(139,69,19,0.22); }
        #_abOverlay .ab-file-label { padding:8px 14px; border:1.5px solid rgba(139,69,19,0.22); border-radius:10px; background:#fff; color:#3a2818; cursor:pointer; font-family:'Cairo'; font-weight:800; font-size:12.5px; transition:all 0.18s; }
        #_abOverlay .ab-file-label:hover { border-color:#c0935d; background:#fff5dc; }
        #_abOverlay .ab-status-line { font-size:11px; color:#7a5a3a; }
        #_abOverlay .ab-status-line b { color:#3a2818; font-weight:800; }
        #_abOverlay .ab-body { padding:14px 28px 22px; overflow-y:auto; flex:1; min-height:0; }
        #_abOverlay .ab-summary { font-size:11.5px; color:#7a5a3a; margin-bottom:12px; line-height:1.8; background:rgba(192,147,93,0.06); border:1px dashed rgba(192,147,93,0.4); border-radius:10px; padding:10px 14px; }
        #_abOverlay .ab-summary b { color:#3a2818; }
        #_abOverlay .ab-summary .ab-hint-blue  { color:#1565c0; }
        #_abOverlay .ab-summary .ab-hint-amber { color:#bf6f1d; }
        #_abOverlay .ab-row { display:flex; align-items:center; gap:12px; padding:11px 14px; border:1.5px solid rgba(139,69,19,0.18); border-radius:12px; background:#fff; margin-bottom:8px; box-shadow:0 2px 6px rgba(139,69,19,0.05); transition:transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
        #_abOverlay .ab-row:hover { transform:translateY(-1px); box-shadow:0 6px 14px rgba(139,69,19,0.12); border-color:#c0935d; }
        #_abOverlay .ab-row-info { flex:1; min-width:0; }
        #_abOverlay .ab-row-title { font-weight:800; color:#3a2818; font-size:13px; }
        #_abOverlay .ab-row-meta { font-size:11px; color:#8b6f47; margin-top:3px; font-weight:600; }
        #_abOverlay .ab-row-counts { font-size:11px; color:#1565c0; margin-top:2px; font-weight:600; }
        #_abOverlay .ab-row-actions { display:flex; gap:6px; flex-shrink:0; }
        #_abOverlay .ab-empty { text-align:center; color:#a08770; padding:30px; font-style:italic; font-size:13px; }
    `;
    document.head.appendChild(s);
}

function showAutoBackupsModal() {
    closeAutoBackupsModal();
    _abEnsureStyles();
    const arr = _abReadAll();
    const autoOn = isAutoBackupOn();
    const overlay = document.createElement('div');
    overlay.id = '_abOverlay';
    /* لا يُغلق بالنقر خارج النافذة — تناغماً مع modals الإيصال */

    let rowsHtml = '';
    if (arr.length === 0) {
        rowsHtml = '<div class="ab-empty">📭 لا توجد نسخ احتياطية بعد</div>';
    } else {
        for (let i = arr.length - 1; i >= 0; i--) {
            const s        = arr[i];
            const d        = _abDigest(s);
            const prevSize = i > 0 ? (arr[i-1].size || 0) : null;
            const delta    = prevSize != null ? (s.size||0) - prevSize : null;
            rowsHtml += `
                <div class="ab-row" data-coffee-row="1">
                    <div class="ab-row-info">
                        <div class="ab-row-title">${_abFormatTs(s.ts)}</div>
                        <div class="ab-row-meta">
                            بواسطة: ${s.user || '—'} · سبب: ${s.reason || 'auto'} · حجم: ${_abFormatBytes(s.size||0)}${delta != null ? ' · فرق: ' + _abFormatDelta(delta) : ''}
                        </div>
                        <div class="ab-row-counts">
                            منتسيات: ${d.montasiat} · استفسارات: ${d.inquiries} · شكاوى: ${d.complaints} · موظفون: ${d.employees}
                        </div>
                    </div>
                    <div class="ab-row-actions">
                        <button class="ab-btn ab-btn-info" onclick="restoreAutoBackup(${i})" title="استعادة">↺ استعادة</button>
                        <button class="ab-btn ab-btn-success" onclick="downloadAutoBackup(${i})" title="تنزيل">⬇ تنزيل</button>
                        <button class="ab-btn ab-btn-danger" onclick="deleteAutoBackup(${i})" title="حذف">🗑</button>
                    </div>
                </div>`;
        }
    }

    const toggleBg = autoOn
        ? 'linear-gradient(135deg,#2e7d32,#1b5e20)'
        : 'rgba(120,120,120,0.25)';
    const toggleColor = autoOn ? '#fff' : 'var(--text-dim)';
    const autoMin = Math.round(_AB_AUTOSYNC_MS / 60000);
    const toggleLabel = autoOn ? '🟢 المزامنة التلقائية كل ' + autoMin + ' دقيقة: مفعّلة' : '⚪ المزامنة التلقائية كل ' + autoMin + ' دقيقة: متوقّفة';
    const blockedNote = _abLastBlockedAt ? `<span style="color:#ef9a9a;">⚠ آخر منع: ${_abFormatTs(_abLastBlockedAt)} (${_abLastBlockedReason})</span>` : '';

    overlay.innerHTML = `
        <div class="ab-wrap">
            <div class="ab-instruction">
                <div class="ab-instruction-icon">📦</div>
                <div class="ab-instruction-text">إدارة النسخ الاحتياطية — حافظ على نسخة آمنة من بياناتك</div>
            </div>
            <div class="ab-receipt">
                <span class="ab-bean ab-b1">☕</span>
                <span class="ab-bean ab-b2">●</span>
                <button class="ab-close" onclick="closeAutoBackupsModal()" aria-label="إغلاق">✕</button>
                <div class="ab-head">
                    <div class="ab-brand">محامص الشعب</div>
                    <div class="ab-title">📦 النسخ الاحتياطية للنظام</div>
                    <span class="ab-stamp">نسخ</span>
                </div>

            <!-- شريط الإجراءات السريعة -->
            <div class="ab-section">
                <button id="_abSyncBtn" class="ab-btn ab-btn-info" onclick="manualSyncAndBackup()">🔄 مزامنة + نسخة الآن</button>
                <button class="ab-btn ab-btn-soft" onclick="takeManualBackup()">+ نسخة محلية فقط</button>
                <label class="ab-file-label">
                    📂 استيراد ملف
                    <input type="file" accept="application/json,.json" style="display:none;" onchange="importAutoBackupFile(this)">
                </label>
                <button class="ab-btn ab-btn-danger ab-btn-grow" onclick="clearAllAutoBackups()">حذف الكل</button>
            </div>

            <!-- شريط المزامنة التلقائية -->
            <div class="ab-section">
                <button class="ab-btn ${autoOn ? 'ab-toggle-on' : 'ab-toggle-off'}" onclick="toggleAutoBackup()">${toggleLabel}</button>
                <div class="ab-status-line">آخر مزامنة: <span id="_abLastSyncLabel"><b>${_abFormatTs(_abLastSyncTs)}</b></span></div>
                ${blockedNote ? '<div style="font-size:11px;flex-basis:100%;">' + blockedNote + '</div>' : ''}
            </div>

            <!-- شريط مجلد الحفظ على القرص -->
            <div class="ab-section ab-section-folder">
                <div class="ab-section-label">💾 مجلد الحفظ على القرص:</div>
                <div id="_abFolderLabel" class="ab-folder-label">جارٍ الفحص...</div>
                <button class="ab-btn ab-btn-purple" onclick="pickBackupFolder()">🗂️ اختيار / تغيير</button>
                <button class="ab-btn ab-btn-soft" onclick="reauthorizeBackupFolder()">🔓 تجديد الإذن</button>
                <button class="ab-btn ab-btn-danger" onclick="clearBackupFolder()">إلغاء الربط</button>
            </div>

            <!-- شريط نمط الكتابة -->
            <div class="ab-section">
                <div class="ab-section-label">📝 نمط الحفظ على القرص:</div>
                <button class="ab-btn ${_abGetFsMode()==='override' ? 'ab-btn-info' : 'ab-toggle-off'}" onclick="toggleFsMode()">${_abGetFsMode()==='override' ? '✓ استبدال' : 'استبدال'}</button>
                <button class="ab-btn ${_abGetFsMode()==='accumulate' ? 'ab-btn-success' : 'ab-toggle-off'}" onclick="toggleFsMode()">${_abGetFsMode()==='accumulate' ? '✓ تراكمي' : 'تراكمي'}</button>
                <span class="ab-status-line" style="flex:1;">${_abGetFsMode()==='override' ? 'ملف واحد ثابت ('+_AB_FS_FIXED_NAME+') يُكتَب فوقه' : 'ملف منفصل لكل لقطة (آخر '+_AB_FS_ROLLING_MAX+' فقط — يُحذَف الأقدم تلقائياً)'}</span>
            </div>

            <!-- قائمة النسخ -->
            <div class="ab-body">
                <div class="ab-summary">
                    عدد النسخ: <b>${arr.length}</b> / ${_AB_MAX_SNAPSHOTS} (الأحدث في الأعلى)
                    · تشمل كل البيانات: المنتسيات، الاستفسارات، الشكاوى، <b>جميع الحسابات</b>، الجلسات، فترات الراحة، قائمة الأسعار<br>
                    <span class="ab-hint-blue">⚡ النسخ تُلتقَط تلقائياً <b>فقط عند تغيير فعلي</b> (حفظ محلي أو تحديث وارد من جهاز آخر) — لا تتراكم نسخ مكرّرة.</span><br>
                    <span class="ab-hint-amber">🛡️ <b>حارس فقدان البيانات</b>: لقطة تُظهر اختفاء الموظفين/المنتسيات أو انخفاض حاد في الحجم تُرفَض تلقائياً لحماية النسخ القديمة.</span>
                </div>
                ${rowsHtml}
            </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    // تحديث حالة المجلد بشكل غير متزامن
    _abRefreshFolderInfo();
}

function closeAutoBackupsModal() {
    const o = document.getElementById('_abOverlay');
    if (o) o.remove();
}

/* ── زر عائم للمدير + بدء التايمر التلقائي عند تسجيل الدخول ── */
(function _abInjectSidebarEntry() {
    function isManager() {
        return typeof currentUser !== 'undefined' && currentUser &&
               (currentUser.isAdmin || currentUser.role === 'cc_manager');
    }
    let autoStarted = false;
    function tryInject() {
        if (!isManager()) return;
        // بدء تلقائي للمزامنة إذا كان التفضيل مفعّلاً
        if (!autoStarted && isAutoBackupOn()) {
            startAutoBackup();
            autoStarted = true;
        }
        if (document.getElementById('_abFloatBtn')) return;
        const btn = document.createElement('button');
        btn.id = '_abFloatBtn';
        btn.title = 'النسخ الاحتياطية الكاملة للنظام';
        btn.innerText = '📦';
        btn.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:9998;width:46px;height:46px;border-radius:50%;border:1px solid var(--border);background:var(--bg-card);color:var(--text-main);cursor:pointer;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,0.35);transition:transform 0.18s;';
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.08)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = showAutoBackupsModal;
        document.body.appendChild(btn);
    }
    const t = setInterval(() => {
        tryInject();
        if (document.getElementById('_abFloatBtn') && autoStarted) clearInterval(t);
    }, 1000);
    setTimeout(() => clearInterval(t), 120000);
})();
