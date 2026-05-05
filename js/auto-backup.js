/* ══════════════════════════════════════════════════════
   Auto-Backup System  (v2)
   - Captures a snapshot of all system DBs (live values, not stale localStorage)
   - Manual backup, sync-then-backup, and auto-sync every minute (manager-only)
   - Rolling buffer of last N snapshots
   - Manager UI: list / restore / download / clear / import / auto-toggle
   ══════════════════════════════════════════════════════ */

const _AB_STORE_KEY      = 'Shaab_AutoBackups';
const _AB_AUTO_KEY       = 'Shaab_AutoBackup_Auto';   // '1' = on, '0'/null = off
const _AB_MAX_SNAPSHOTS  = 30;
const _AB_DEBOUNCE_MS    = 1500;
const _AB_AUTOSYNC_MS    = 60_000;                    // كل دقيقة
const _AB_FS_DB_NAME     = 'Shaab_AutoBackup_FS';     // IndexedDB لتخزين folder handle
const _AB_FS_HANDLE_KEY  = 'folderHandle';
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

function _abTakeSnapshot(reason) {
    try {
        const arr  = _abReadAll();
        const snap = _abMakeSnapshot(reason);
        // dedupe — تخطٍّ النسخ المتطابقة لأهم مفتاحَين
        if (arr.length > 0) {
            const last       = arr[arr.length - 1];
            const sameMaster = last.data && last.data['Shaab_Master_DB']    === snap.data['Shaab_Master_DB'];
            const sameEmp    = last.data && last.data['Shaab_Employees_DB'] === snap.data['Shaab_Employees_DB'];
            // للنسخ التلقائية فقط نتخطى عند التطابق؛ النسخ اليدوية والمزامنة تُحفظ دائماً
            const isAuto     = !reason || reason === 'auto' || reason.startsWith('save:') || reason === 'startup';
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

/* ── helpers for UI ── */
function _abFormatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/1024/1024).toFixed(2) + ' MB';
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
                : '<span style="color:#ffb74d;">⚠ يحتاج إذن</span>';
            lbl.innerHTML = `📁 <b style="color:var(--text-main);">${_abFolderInfo.name}</b> · ${tag}`;
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

async function _abWriteToFolder(snap) {
    try {
        const handle = await _abGetFolderHandle();
        if (!handle) return false;
        const perm = await _abQueryPerm(handle);
        if (perm !== 'granted') return false; // لا نطلب إذناً خارج user-gesture
        const ts = new Date(snap.ts);
        const pad = (n) => String(n).padStart(2, '0');
        const safeReason = String(snap.reason || 'auto').replace(/[^a-zA-Z0-9_-]/g, '');
        const fname = `shaab_backup_${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())}_` +
                      `${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}_${safeReason}.json`;
        const fileHandle = await handle.getFileHandle(fname, { create: true });
        const writable   = await fileHandle.createWritable();
        await writable.write(JSON.stringify(snap, null, 2));
        await writable.close();
        return true;
    } catch (e) { console.warn('[autoBackup] folder write failed:', e); return false; }
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
    _abTakeSnapshot(tag);
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
    try { return localStorage.getItem(_AB_AUTO_KEY) === '1'; }
    catch { return false; }
}

function startAutoBackup() {
    stopAutoBackup();
    try { localStorage.setItem(_AB_AUTO_KEY, '1'); } catch {}
    _abAutoTimer = setInterval(() => {
        if (document.hidden) return; // تجنّب المزامنة عندما تكون الصفحة مخفية
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

/* ── Restore from snapshot ── */
function restoreAutoBackup(idx) {
    const arr = _abReadAll();
    const snap = arr[idx];
    if (!snap) { alert('النسخة غير موجودة'); return; }
    const dig = _abDigest(snap);
    const msg = 'هل أنت متأكد من استعادة نسخة ' + _abFormatTs(snap.ts) + '؟\n\n' +
                'منتسيات: ' + dig.montasiat + '\n' +
                'استفسارات: ' + dig.inquiries + '\n' +
                'شكاوى: ' + dig.complaints + '\n' +
                'موظفون: ' + dig.employees + '\n\n' +
                '⚠️ ستحلّ هذه النسخة محلّ البيانات الحالية وسيُرفع التغيير للسيرفر.';
    if (!confirm(msg)) return;

    _abTakeSnapshot('pre-restore');

    for (const k of _AB_TRACKED_KEYS) {
        const v = (snap.data || {})[k];
        if (v != null) {
            try {
                if (typeof _push === 'function') _push(k, v);
                else localStorage.setItem(k, v);
            } catch (e) { console.warn('restore push failed for', k, e); }
        }
    }
    alert('تمّت الاستعادة محلياً. ستُحدَّث الصفحة لقراءة البيانات من جديد.');
    setTimeout(() => location.reload(), 600);
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
function showAutoBackupsModal() {
    closeAutoBackupsModal();
    const arr = _abReadAll();
    const autoOn = isAutoBackupOn();
    const overlay = document.createElement('div');
    overlay.id = '_abOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100001;display:flex;align-items:center;justify-content:center;font-family:"Cairo";padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeAutoBackupsModal(); };

    let rowsHtml = '';
    if (arr.length === 0) {
        rowsHtml = '<div style="text-align:center;color:var(--text-dim);padding:30px;">لا توجد نسخ احتياطية بعد</div>';
    } else {
        for (let i = arr.length - 1; i >= 0; i--) {
            const s = arr[i];
            const d = _abDigest(s);
            rowsHtml += `
                <div style="display:flex;align-items:center;gap:12px;padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:var(--bg-input);margin-bottom:8px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:var(--text-main);font-size:13px;">${_abFormatTs(s.ts)}</div>
                        <div style="font-size:11px;color:var(--text-dim);margin-top:3px;">
                            بواسطة: ${s.user || '—'} · سبب: ${s.reason || 'auto'} · حجم: ${_abFormatBytes(s.size||0)}
                        </div>
                        <div style="font-size:11px;color:#81d4fa;margin-top:2px;">
                            منتسيات: ${d.montasiat} · استفسارات: ${d.inquiries} · شكاوى: ${d.complaints} · موظفون: ${d.employees}
                        </div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button onclick="restoreAutoBackup(${i})" title="استعادة" style="padding:7px 10px;border:none;border-radius:8px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;cursor:pointer;font-family:'Cairo';font-size:12px;font-weight:700;">↺ استعادة</button>
                        <button onclick="downloadAutoBackup(${i})" title="تنزيل" style="padding:7px 10px;border:none;border-radius:8px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;cursor:pointer;font-family:'Cairo';font-size:12px;font-weight:700;">⬇ تنزيل</button>
                        <button onclick="deleteAutoBackup(${i})" title="حذف" style="padding:7px 10px;border:none;border-radius:8px;background:rgba(211,47,47,0.18);color:#ef9a9a;cursor:pointer;font-family:'Cairo';font-size:12px;font-weight:700;">🗑</button>
                    </div>
                </div>`;
        }
    }

    const toggleBg = autoOn
        ? 'linear-gradient(135deg,#2e7d32,#1b5e20)'
        : 'rgba(120,120,120,0.25)';
    const toggleColor = autoOn ? '#fff' : 'var(--text-dim)';
    const toggleLabel = autoOn ? '🟢 المزامنة التلقائية كل دقيقة: مفعّلة' : '⚪ المزامنة التلقائية كل دقيقة: متوقّفة';

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:18px;width:680px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);">
                <h3 style="margin:0;color:var(--text-main);font-size:17px;">📦 النسخ الاحتياطية الكاملة للنظام</h3>
                <button onclick="closeAutoBackupsModal()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>

            <!-- شريط الإجراءات السريعة -->
            <div style="padding:14px 22px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <button id="_abSyncBtn" onclick="manualSyncAndBackup()" style="padding:9px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">🔄 مزامنة + نسخة الآن</button>
                <button onclick="takeManualBackup()" style="padding:9px 14px;border:none;border-radius:10px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">+ نسخة محلية فقط</button>
                <label style="padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">
                    📂 استيراد ملف
                    <input type="file" accept="application/json,.json" style="display:none;" onchange="importAutoBackupFile(this)">
                </label>
                <button onclick="clearAllAutoBackups()" style="padding:9px 14px;border:none;border-radius:10px;background:rgba(211,47,47,0.18);color:#ef9a9a;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;margin-right:auto;">حذف الكل</button>
            </div>

            <!-- شريط المزامنة التلقائية -->
            <div style="padding:12px 22px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <button onclick="toggleAutoBackup()" style="padding:8px 14px;border:none;border-radius:10px;background:${toggleBg};color:${toggleColor};cursor:pointer;font-family:'Cairo';font-weight:700;font-size:12px;">${toggleLabel}</button>
                <div style="font-size:11px;color:var(--text-dim);">
                    آخر مزامنة: <span id="_abLastSyncLabel" style="color:var(--text-main);font-weight:700;">${_abFormatTs(_abLastSyncTs)}</span>
                </div>
            </div>

            <!-- شريط مجلد الحفظ على القرص -->
            <div style="padding:12px 22px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(33,150,243,0.05);">
                <div style="font-size:12px;color:var(--text-dim);min-width:135px;">💾 مجلد الحفظ على القرص:</div>
                <div id="_abFolderLabel" style="font-size:12px;flex:1;min-width:140px;color:var(--text-dim);">جارٍ الفحص...</div>
                <button onclick="pickBackupFolder()" style="padding:7px 12px;border:none;border-radius:8px;background:linear-gradient(135deg,#6a1b9a,#4a148c);color:#fff;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:12px;">🗂️ اختيار / تغيير</button>
                <button onclick="reauthorizeBackupFolder()" style="padding:7px 12px;border:none;border-radius:8px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:12px;">🔓 تجديد الإذن</button>
                <button onclick="clearBackupFolder()" style="padding:7px 12px;border:none;border-radius:8px;background:rgba(211,47,47,0.18);color:#ef9a9a;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:12px;">إلغاء الربط</button>
            </div>

            <!-- قائمة النسخ -->
            <div style="padding:14px 22px;overflow-y:auto;flex:1;">
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;">
                    عدد النسخ: <b style="color:var(--text-main);">${arr.length}</b> / ${_AB_MAX_SNAPSHOTS} (الأحدث في الأعلى)
                    · تشمل كل البيانات: المنتسيات، الاستفسارات، الشكاوى، <b>جميع الحسابات</b>، الجلسات، فترات الراحة، قائمة الأسعار
                </div>
                ${rowsHtml}
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
