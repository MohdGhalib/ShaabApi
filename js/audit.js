/* ══════════════════════════════════════════════════════
   AUDIT LOG — View log of delete actions
══════════════════════════════════════════════════════ */
function renderAuditLog() {
    const container = document.getElementById('auditLogContainer');
    if (!container) return;

    const log = (db.auditLog || []).slice().reverse(); // newest first

    const actionLabel = {
        'deleteMontasia':  'حذف منتسية',
        'deleteInquiry':   'حذف استفسار',
        'deleteComplaint': 'حذف شكوى',
        'restoreMontasia': 'استعادة منتسية',
        'restoreInquiry':  'استعادة استفسار',
        'restoreComplaint':'استعادة شكوى',
    };

    const COLS  = '16% 14% 38% 14% 18%';
    const hCell = 'padding:10px 12px;font-size:12px;font-weight:600;color:var(--text-dim);border-bottom:2px solid var(--border);white-space:nowrap;';
    const dCell = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;';

    const headers = ['العملية','الجهة','التفاصيل','بواسطة','الوقت']
        .map(h => `<div style="${hCell}">${h}</div>`).join('');

    const dataRows = log.length
        ? log.map(entry => `
            <div style="${dCell}"><span class="emp-badge" style="font-size:12px;">${sanitize(actionLabel[entry.action] || entry.action)}</span></div>
            <div style="${dCell}">${sanitize(entry.entity || '—')}</div>
            <div style="${dCell}"><span class="text-box-cell" style="font-size:12px;">${sanitize(entry.summary || '—')}</span></div>
            <div style="${dCell}"><small style="color:var(--text-main);">${sanitize(entry.by || '—')}</small></div>
            <div style="${dCell}"><small style="color:var(--text-dim);">${_toLatinDigits(entry.time || '—')}</small></div>`).join('')
        : `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-dim);">لا توجد سجلات</div>`;

    container.innerHTML = `
    <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <h3 style="margin:0;">📋 سجل العمليات</h3>
            <small style="color:var(--text-dim);">آخر ${Math.min(log.length, 200)} عملية</small>
        </div>
        <div style="overflow-x:auto;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:600px;">
                ${headers}
                ${dataRows}
            </div>
        </div>
    </div>`;
}
