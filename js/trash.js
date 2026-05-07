/* ══════════════════════════════════════════════════════
   TRASH — Soft-deleted items with restore capability
══════════════════════════════════════════════════════ */
function renderTrash() {
    const container = document.getElementById('trashContainer');
    if (!container) return;

    const deletedM = (db.montasiat  || []).filter(x => x.deleted);
    const deletedI = (db.inquiries  || []).filter(x => x.deleted);
    const deletedC = (db.complaints || []).filter(x => x.deleted);

    const COLS   = '18% 40% 14% 16% 12%';
    const hCell  = 'padding:10px 12px;font-size:12px;font-weight:600;color:var(--text-dim);border-bottom:2px solid var(--border);white-space:nowrap;';
    const dCell  = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;';
    const HEADERS = ['الفرع','التفاصيل','حُذف بواسطة','مدة الحذف','إجراء'];

    function _buildSection(items, restoreFn) {
        if (!items.length) return `<div style="color:var(--text-dim);font-size:13px;padding:12px 0;">لا توجد عناصر محذوفة في هذا القسم</div>`;

        const headerHtml = HEADERS.map(h => `<div style="${hCell}">${h}</div>`).join('');

        const rowsHtml = items.map(x => {
            const deletedAgo   = x.deletedAtTs ? Math.floor((Date.now() - x.deletedAtTs) / 86400000) : '—';
            const autoDeleteIn = x.deletedAtTs ? Math.max(0, 30 - Math.floor((Date.now() - x.deletedAtTs) / 86400000)) : '—';
            const urgentColor  = (typeof autoDeleteIn === 'number' && autoDeleteIn <= 3) ? '#ef5350' : 'var(--text-dim)';
            return `
                <div style="${dCell}">
                    <b style="font-size:13px;">${sanitize(x.branch||'—')}</b><br>
                    <small style="color:var(--text-dim);">${sanitize(x.city||'—')}</small>
                </div>
                <div style="${dCell}">
                    <span class="text-box-cell" style="font-size:12px;">${sanitize((x.notes||'').substring(0,80))}${(x.notes||'').length>80?'…':''}</span>
                </div>
                <div style="${dCell}">
                    <small style="color:var(--text-dim);">${sanitize(x.deletedBy||'—')}</small>
                </div>
                <div style="${dCell}">
                    <small style="color:var(--text-dim);">${deletedAgo} يوم</small><br>
                    <small style="color:${urgentColor};">يُحذف بعد: ${autoDeleteIn} يوم</small>
                </div>
                <div style="${dCell}">
                    <button class="btn-approve" style="font-size:12px;padding:6px 12px;" onclick="${restoreFn}(${x.id})">↩ استعادة</button>
                </div>`;
        }).join('');

        return `<div style="overflow-x:auto;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:520px;">
                ${headerHtml}${rowsHtml}
            </div>
        </div>`;
    }

    container.innerHTML = `
        <div class="card" style="margin-bottom:20px;">
            <h4 style="margin:0 0 14px;color:var(--accent-red);">📋 منتسيات محذوفة (${deletedM.length})</h4>
            ${_buildSection(deletedM, 'restoreMontasia')}
        </div>
        <div class="card" style="margin-bottom:20px;">
            <h4 style="margin:0 0 14px;color:var(--accent-red);">💬 استفسارات محذوفة (${deletedI.length})</h4>
            ${_buildSection(deletedI, 'restoreInquiry')}
        </div>
        <div class="card">
            <h4 style="margin:0 0 14px;color:var(--accent-red);">🚨 شكاوي محذوفة (${deletedC.length})</h4>
            ${_buildSection(deletedC, 'restoreComplaint')}
        </div>`;
}

function restoreMontasia(id) {
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    delete item.deleted;
    delete item.deletedBy;
    delete item.deletedAtTs;
    _logAudit('restoreMontasia', item.branch || '—', `${item.branch} — ${(typeof _montasiaSummary==='function' ? _montasiaSummary(item) : (item.notes||'')).substring(0,80)}`);
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
    save();
    renderTrash();
}
