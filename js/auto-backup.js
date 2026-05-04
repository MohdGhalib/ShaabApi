/* ══════════════════════════════════════════════════════
   Auto-Backup System
   - Captures a localStorage snapshot whenever data changes
   - Rolling buffer of last N snapshots
   - Manager UI: list / restore / download / clear
   ══════════════════════════════════════════════════════ */

const _AB_STORE_KEY      = 'Shaab_AutoBackups';
const _AB_MAX_SNAPSHOTS  = 30;
const _AB_DEBOUNCE_MS    = 1500;
const _AB_TRACKED_KEYS   = [
    'Shaab_Master_DB',
    'Shaab_Employees_DB',
    'Shaab_Breaks_DB',
    'Shaab_Sessions_DB',
    'Shaab_PriceList_DB'
];

let _abTimer = null;

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

function _abMakeSnapshot(reason) {
    const data = {};
    let totalSize = 0;
    for (const k of _AB_TRACKED_KEYS) {
        const v = localStorage.getItem(k);
        if (v != null) { data[k] = v; totalSize += v.length; }
    }
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
        const db = JSON.parse(snap.data['Shaab_Master_DB'] || '{}');
        const emp = JSON.parse(snap.data['Shaab_Employees_DB'] || '[]');
        return {
            montasiat:   (db.montasiat || []).length,
            inquiries:   (db.inquiries || []).length,
            complaints:  (db.complaints || []).length,
            employees:   Array.isArray(emp) ? emp.length : 0
        };
    } catch { return { montasiat:0, inquiries:0, complaints:0, employees:0 }; }
}

function _abTakeSnapshot(reason) {
    try {
        const arr = _abReadAll();
        const snap = _abMakeSnapshot(reason);
        // dedupe — skip if identical to last snapshot
        if (arr.length > 0) {
            const last = arr[arr.length - 1];
            const sameMaster = last.data && last.data['Shaab_Master_DB'] === snap.data['Shaab_Master_DB'];
            const sameEmp    = (last.data && last.data['Shaab_Employees_DB']) === snap.data['Shaab_Employees_DB'];
            if (sameMaster && sameEmp) return;
        }
        arr.push(snap);
        while (arr.length > _AB_MAX_SNAPSHOTS) arr.shift();
        _abWriteAll(arr);
    } catch (e) { console.warn('[autoBackup] snapshot failed:', e); }
}

function _abScheduleSnapshot(reason) {
    if (_abTimer) clearTimeout(_abTimer);
    _abTimer = setTimeout(() => { _abTimer = null; _abTakeSnapshot(reason); }, _AB_DEBOUNCE_MS);
}

/* ── hook into existing data mutations ── */
(function _abInstallHooks() {
    // Wrap _push (called by save / saveEmployees / saveBreaks / saveSessions / savePriceList)
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
    // _push lives in data.js which loads before this file, but be defensive
    if (typeof window._push === 'function') tryInstall();
    else {
        const t = setInterval(() => { tryInstall(); if (installed) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }

    // Take an initial snapshot once data is in localStorage
    setTimeout(() => _abTakeSnapshot('startup'), 4000);

    // Snapshot on window unload (best-effort)
    window.addEventListener('beforeunload', () => { try { _abTakeSnapshot('unload'); } catch {} });
})();

/* ── helpers for UI ── */
function _abFormatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/1024/1024).toFixed(2) + ' MB';
}

function _abFormatTs(ts) {
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('ar-EG');
    const timeStr = d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
    return dateStr + ' — ' + timeStr;
}

/* ── Manual snapshot (button) ── */
function takeManualBackup() {
    _abTakeSnapshot('manual');
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

    // Take a safety snapshot first
    _abTakeSnapshot('pre-restore');

    // Write each key back to localStorage and push to server via _push
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
    const overlay = document.createElement('div');
    overlay.id = '_abOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100001;display:flex;align-items:center;justify-content:center;font-family:"Cairo";padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeAutoBackupsModal(); };

    let rowsHtml = '';
    if (arr.length === 0) {
        rowsHtml = '<div style="text-align:center;color:var(--text-dim);padding:30px;">لا توجد نسخ احتياطية بعد</div>';
    } else {
        // newest first
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

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:18px;width:640px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);">
                <h3 style="margin:0;color:var(--text-main);font-size:17px;">📦 النسخ الاحتياطية المحلية</h3>
                <button onclick="closeAutoBackupsModal()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="padding:14px 22px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="takeManualBackup()" style="padding:9px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">+ نسخة جديدة الآن</button>
                <label style="padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">
                    📂 استيراد ملف
                    <input type="file" accept="application/json,.json" style="display:none;" onchange="importAutoBackupFile(this)">
                </label>
                <button onclick="clearAllAutoBackups()" style="padding:9px 14px;border:none;border-radius:10px;background:rgba(211,47,47,0.18);color:#ef9a9a;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;margin-right:auto;">حذف الكل</button>
            </div>
            <div style="padding:14px 22px;overflow-y:auto;flex:1;">
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;">
                    عدد النسخ: <b style="color:var(--text-main);">${arr.length}</b> / ${_AB_MAX_SNAPSHOTS} (الأحدث في الأعلى)
                </div>
                ${rowsHtml}
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function closeAutoBackupsModal() {
    const o = document.getElementById('_abOverlay');
    if (o) o.remove();
}

/* ── Inject sidebar entry for managers ── */
(function _abInjectSidebarEntry() {
    function isManager() {
        return typeof currentUser !== 'undefined' && currentUser &&
               (currentUser.isAdmin || currentUser.role === 'cc_manager');
    }
    function tryInject() {
        if (document.getElementById('_abFloatBtn')) return;
        if (!isManager()) return;
        const btn = document.createElement('button');
        btn.id = '_abFloatBtn';
        btn.title = 'النسخ الاحتياطية المحلية';
        btn.innerText = '📦';
        btn.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:9998;width:46px;height:46px;border-radius:50%;border:1px solid var(--border);background:var(--bg-card);color:var(--text-main);cursor:pointer;font-size:20px;box-shadow:0 4px 14px rgba(0,0,0,0.35);transition:transform 0.18s;';
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.08)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = showAutoBackupsModal;
        document.body.appendChild(btn);
    }
    // Poll until logged-in & manager check passes
    const t = setInterval(() => {
        tryInject();
        if (document.getElementById('_abFloatBtn')) clearInterval(t);
    }, 1000);
    setTimeout(() => clearInterval(t), 120000);
})();
