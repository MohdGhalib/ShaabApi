/* ══════════════════════════════════════════════════════
   TRASH — Soft-deleted items with restore + manual purge
══════════════════════════════════════════════════════ */

/* ── حالة التحديد لكل قسم (تخزن x.id) ── */
const _selTrash = { M: new Set(), I: new Set(), C: new Set() };

function _canPurgeTrash() {
    return !!currentUser && (currentUser.isAdmin || currentUser.role === 'cc_manager');
}

function renderTrash() {
    const container = document.getElementById('trashContainer');
    if (!container) return;

    const deletedM = (db.montasiat  || []).filter(x => x.deleted);
    const deletedI = (db.inquiries  || []).filter(x => x.deleted);
    const deletedC = (db.complaints || []).filter(x => x.deleted);

    // تنظيف التحديد من العناصر التي لم تعد موجودة
    const _alive = (arr, sel) => { const ids = new Set(arr.map(x=>x.id)); [...sel].forEach(id => { if(!ids.has(id)) sel.delete(id); }); };
    _alive(deletedM, _selTrash.M);
    _alive(deletedI, _selTrash.I);
    _alive(deletedC, _selTrash.C);

    const canPurge = _canPurgeTrash();

    const COLS   = canPurge ? '5% 16% 32% 13% 14% 20%' : '18% 40% 14% 16% 12%';
    const hCell  = 'padding:10px 12px;font-size:12px;font-weight:600;color:var(--text-dim);border-bottom:2px solid var(--border);white-space:nowrap;';
    const dCell  = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;';
    const HEADERS = canPurge
        ? ['', 'الفرع', 'التفاصيل', 'حُذف بواسطة', 'مدة الحذف', 'إجراء']
        : ['الفرع', 'التفاصيل', 'حُذف بواسطة', 'مدة الحذف', 'إجراء'];

    function _buildSection(items, key, restoreFn, purgeFn) {
        if (!items.length) return `<div style="color:var(--text-dim);font-size:13px;padding:12px 0;">لا توجد عناصر محذوفة في هذا القسم</div>`;

        const sel = _selTrash[key];
        const allSelected = items.every(x => sel.has(x.id));

        // شريط التحديد الجماعي
        const bulkBarHtml = (canPurge && sel.size > 0) ? `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;
                        background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.3);
                        border-radius:12px;margin-bottom:10px;">
                <span style="font-weight:700;color:var(--accent-red);font-size:13px;">✓ تم تحديد ${sel.size} عنصر</span>
                <button onclick="bulkPurgeTrash('${key}')"
                    style="background:var(--accent-red);color:#fff;border:none;border-radius:8px;
                           padding:6px 14px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;">
                    🗑 حذف نهائي للمحدد (${sel.size})
                </button>
                <button onclick="clearSelTrash('${key}')"
                    style="background:var(--bg-input);color:var(--text-dim);border:1px solid var(--border);
                           border-radius:8px;padding:6px 12px;cursor:pointer;font-family:'Cairo';font-size:13px;">
                    ✕ إلغاء التحديد
                </button>
            </div>` : '';

        const headerHtml = HEADERS.map((h, i) => {
            if (canPurge && i === 0) {
                return `<div style="${hCell}text-align:center;">
                    <input type="checkbox" ${allSelected?'checked':''}
                        style="accent-color:var(--accent-red);width:15px;height:15px;cursor:pointer;"
                        onchange="selectAllTrash('${key}', this.checked)">
                </div>`;
            }
            return `<div style="${hCell}">${h}</div>`;
        }).join('');

        const rowsHtml = items.map(x => {
            const deletedAgo   = x.deletedAtTs ? Math.floor((Date.now() - x.deletedAtTs) / 86400000) : '—';
            const autoDeleteIn = x.deletedAtTs ? Math.max(0, 30 - Math.floor((Date.now() - x.deletedAtTs) / 86400000)) : '—';
            const urgentColor  = (typeof autoDeleteIn === 'number' && autoDeleteIn <= 3) ? '#ef5350' : 'var(--text-dim)';
            const isChecked = sel.has(x.id);
            const rowExtra = isChecked ? 'background:rgba(211,47,47,0.07);' : '';

            const checkboxCell = canPurge ? `
                <div style="${dCell}text-align:center;${rowExtra}">
                    <input type="checkbox" ${isChecked?'checked':''}
                        style="accent-color:var(--accent-red);width:15px;height:15px;cursor:pointer;"
                        onchange="toggleSelTrash('${key}', ${x.id}, this.checked)">
                </div>` : '';

            const purgeBtn = canPurge ? `
                <button onclick="${purgeFn}(${x.id})"
                    style="margin-right:6px;background:var(--accent-red);color:#fff;border:none;border-radius:8px;
                           padding:6px 10px;cursor:pointer;font-family:'Cairo';font-size:12px;font-weight:700;">
                    🗑 حذف نهائي
                </button>` : '';

            return `
                ${checkboxCell}
                <div style="${dCell}${rowExtra}">
                    <b style="font-size:13px;">${sanitize(x.branch||'—')}</b><br>
                    <small style="color:var(--text-dim);">${sanitize(x.city||'—')}</small>
                </div>
                <div style="${dCell}${rowExtra}">
                    <span class="text-box-cell" style="font-size:12px;">${sanitize((x.notes||'').substring(0,80))}${(x.notes||'').length>80?'…':''}</span>
                </div>
                <div style="${dCell}${rowExtra}">
                    <small style="color:var(--text-dim);">${sanitize(x.deletedBy||'—')}</small>
                </div>
                <div style="${dCell}${rowExtra}">
                    <small style="color:var(--text-dim);">${deletedAgo} يوم</small><br>
                    <small style="color:${urgentColor};">يُحذف بعد: ${autoDeleteIn} يوم</small>
                </div>
                <div style="${dCell}${rowExtra}">
                    <button class="btn-approve" style="font-size:12px;padding:6px 10px;" onclick="${restoreFn}(${x.id})">↩ استعادة</button>
                    ${purgeBtn}
                </div>`;
        }).join('');

        return bulkBarHtml + `<div style="overflow-x:auto;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:580px;">
                ${headerHtml}${rowsHtml}
            </div>
        </div>`;
    }

    container.innerHTML = `
        <div class="card" style="margin-bottom:20px;">
            <h4 style="margin:0 0 14px;color:var(--accent-red);">📋 منتسيات محذوفة (${deletedM.length})</h4>
            ${_buildSection(deletedM, 'M', 'restoreMontasia', 'purgeMontasia')}
        </div>
        <div class="card" style="margin-bottom:20px;">
            <h4 style="margin:0 0 14px;color:var(--accent-red);">💬 استفسارات محذوفة (${deletedI.length})</h4>
            ${_buildSection(deletedI, 'I', 'restoreInquiry', 'purgeInquiry')}
        </div>
        <div class="card">
            <h4 style="margin:0 0 14px;color:var(--accent-red);">🚨 شكاوي محذوفة (${deletedC.length})</h4>
            ${_buildSection(deletedC, 'C', 'restoreComplaint', 'purgeComplaint')}
        </div>`;
}

/* ── التحديد المتعدد ── */
function toggleSelTrash(key, id, checked) {
    const sel = _selTrash[key]; if (!sel) return;
    checked ? sel.add(id) : sel.delete(id);
    renderTrash();
}
function selectAllTrash(key, checked) {
    const sel = _selTrash[key]; if (!sel) return;
    const src = key === 'M' ? (db.montasiat||[]) : key === 'I' ? (db.inquiries||[]) : (db.complaints||[]);
    src.filter(x => x.deleted).forEach(x => { checked ? sel.add(x.id) : sel.delete(x.id); });
    renderTrash();
}
function clearSelTrash(key) {
    const sel = _selTrash[key]; if (!sel) return;
    sel.clear();
    renderTrash();
}

/* ── الاستعادة ── */
function restoreMontasia(id) {
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    delete item.deleted;
    delete item.deletedBy;
    delete item.deletedAtTs;
    _logAudit('restoreMontasia', item.branch || '—', `${item.branch} — ${(typeof _montasiaSummary==='function' ? _montasiaSummary(item) : (item.notes||'')).substring(0,80)}`);
    _selTrash.M.delete(id);
    save();
    renderTrash();
}

function restoreInquiry(id) {
    const item = (db.inquiries || []).find(x => x.id === id);
    if (!item) return;
    delete item.deleted;
    delete item.deletedBy;
    delete item.deletedAtTs;
    _logAudit('restoreInquiry', item.branch || '—', `${item.branch} — ${item.type}`);
    _selTrash.I.delete(id);
    save();
    renderTrash();
}

function restoreComplaint(id) {
    const item = (db.complaints || []).find(x => x.id === id);
    if (!item) return;
    delete item.deleted;
    delete item.deletedBy;
    delete item.deletedAtTs;
    _logAudit('restoreComplaint', item.branch || '—', `${item.branch} — ${(item.notes||'').substring(0,40)}`);
    _selTrash.C.delete(id);
    save();
    renderTrash();
}

/* ── الحذف النهائي اليدوي (فردي) ── */
function purgeMontasia(id) {
    if (!_canPurgeTrash()) return;
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    const summary = (typeof _montasiaSummary==='function' ? _montasiaSummary(item) : (item.notes||'')).substring(0,80);
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--accent-red);margin-bottom:6px;">حذف منتسية نهائياً</div>
         <div style="color:var(--text-main);">${sanitize(item.branch||'—')} — ${sanitize(item.type||'—')}</div>
         <div style="color:var(--text-dim);font-size:12px;margin-top:4px;">${sanitize(summary)}</div>`,
        () => {
            db.montasiat = (db.montasiat||[]).filter(x => x.id !== id);
            _selTrash.M.delete(id);
            _logAudit('purgeMontasia', item.branch || '—', `${item.branch} — ${summary}`);
            save();
            renderTrash();
        }
    );
}

function purgeInquiry(id) {
    if (!_canPurgeTrash()) return;
    const item = (db.inquiries || []).find(x => x.id === id);
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--accent-red);margin-bottom:6px;">حذف استفسار نهائياً</div>
         <div style="color:var(--text-main);">${sanitize(item.branch||'—')} — ${sanitize(item.type||'—')}</div>
         <div style="color:var(--text-dim);font-size:12px;margin-top:4px;">${sanitize((item.notes||'').substring(0,80))}</div>`,
        () => {
            db.inquiries = (db.inquiries||[]).filter(x => x.id !== id);
            _selTrash.I.delete(id);
            _logAudit('purgeInquiry', item.branch || '—', `${item.branch} — ${item.type}`);
            save();
            renderTrash();
        }
    );
}

function purgeComplaint(id) {
    if (!_canPurgeTrash()) return;
    const item = (db.complaints || []).find(x => x.id === id);
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--accent-red);margin-bottom:6px;">حذف شكوى نهائياً</div>
         <div style="color:var(--text-main);">${sanitize(item.branch||'—')}</div>
         <div style="color:var(--text-dim);font-size:12px;margin-top:4px;">${sanitize((item.notes||'').substring(0,80))}</div>`,
        () => {
            db.complaints = (db.complaints||[]).filter(x => x.id !== id);
            _selTrash.C.delete(id);
            _logAudit('purgeComplaint', item.branch || '—', `${item.branch} — ${(item.notes||'').substring(0,40)}`);
            save();
            renderTrash();
        }
    );
}

/* ── الحذف النهائي للعناصر المحددة (جماعي) ── */
function bulkPurgeTrash(key) {
    if (!_canPurgeTrash()) return;
    const sel = _selTrash[key]; if (!sel || !sel.size) return;
    const arrName = key === 'M' ? 'montasiat' : key === 'I' ? 'inquiries' : 'complaints';
    const label   = key === 'M' ? 'منتسية'   : key === 'I' ? 'استفسار'   : 'شكوى';
    const auditTag = key === 'M' ? 'purgeMontasia' : key === 'I' ? 'purgeInquiry' : 'purgeComplaint';

    const ids = new Set(sel);
    const items = (db[arrName] || []).filter(x => ids.has(x.id));
    if (!items.length) return;

    const preview = items.slice(0, 8).map(x =>
        `<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <b>${sanitize(x.branch||'—')}</b>
            <span style="color:var(--text-dim);"> — ${sanitize((x.notes||x.type||'').substring(0,50))}</span>
        </div>`
    ).join('');
    const more = items.length > 8 ? `<div style="padding:4px 0;color:var(--text-dim);font-size:12px;">…و ${items.length - 8} عنصر آخر</div>` : '';

    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--accent-red);margin-bottom:8px;">سيتم حذف ${items.length} ${label} نهائياً</div>${preview}${more}`,
        () => {
            db[arrName] = (db[arrName] || []).filter(x => !ids.has(x.id));
            items.forEach(x => _logAudit(auditTag, x.branch || '—', `${x.branch||'—'} — ${(x.notes||x.type||'').substring(0,60)}`));
            sel.clear();
            save();
            renderTrash();
        }
    );
}
