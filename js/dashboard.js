/* ══════════════════════════════════════════════════════
   DASHBOARD — Overview cards and recent items
══════════════════════════════════════════════════════ */
let _highlightId = null;

function viewDashboardItem(tab, id) {
    _highlightId = id;
    switchTab(tab);
    // بعد رسم الجدول نبحث عن الصف ونُبرزه
    requestAnimationFrame(() => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.transition = 'background 0.3s';
        row.style.background = 'rgba(211,47,47,0.18)';
        setTimeout(() => { row.style.background = ''; }, 2500);
        _highlightId = null;
    });
}
function renderDashboard() {
    const container = document.getElementById('dashboardContainer');
    if (!container) return;

    const todayIso = iso();

    // ── بطاقات الإحصاء ──
    const pendingM   = (db.montasiat  || []).filter(x => !x.deleted && x.status === 'قيد الانتظار').length;
    const noAuditC   = (db.complaints || []).filter(x => !x.deleted && x.status === 'تمت الموافقة' && !x.audit).length;
    const todayI     = (db.inquiries  || []).filter(x => !x.deleted && x.iso && x.iso.startsWith(todayIso)).length;
    const totalEmps  = (employees     || []).length;

    // ── آخر 5 منتسيات ──
    const recentM = (db.montasiat || []).filter(x => !x.deleted).slice(0, 5);
    // ── آخر 5 شكاوي ──
    const recentC = (db.complaints || []).filter(x => !x.deleted).slice(0, 5);

    const cardStyle = (color) =>
        `background:linear-gradient(135deg,${color}22,${color}11);border:1px solid ${color}44;border-radius:18px;padding:22px 24px;display:flex;flex-direction:column;gap:6px;`;

    const cards = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px;">
        <div style="${cardStyle('#d32f2f')}">
            <div style="font-size:13px;color:var(--text-dim);font-weight:600;">⏳ منتسيات لم يتم تسليمها</div>
            <div style="font-size:38px;font-weight:800;color:#ef5350;">${pendingM}</div>
        </div>
        <div style="${cardStyle('#e65100')}">
            <div style="font-size:13px;color:var(--text-dim);font-weight:600;">🚨 شكاوي بدون رد</div>
            <div style="font-size:38px;font-weight:800;color:#ff7043;">${noAuditC}</div>
        </div>
        <div style="${cardStyle('#1565c0')}">
            <div style="font-size:13px;color:var(--text-dim);font-weight:600;">💬 استفسارات اليوم</div>
            <div style="font-size:38px;font-weight:800;color:#64b5f6;">${todayI}</div>
        </div>
        <div style="${cardStyle('#2e7d32')}">
            <div style="font-size:13px;color:var(--text-dim);font-weight:600;">👤 إجمالي الموظفين</div>
            <div style="font-size:38px;font-weight:800;color:#81c784;">${totalEmps}</div>
        </div>
    </div>`;

    // ── مساعد: بناء grid-table بدل <table> لضمان توافق الأعمدة ──
    function _gridTable(cols, headers, rows) {
        const COLS = cols.join(' ');
        const hCell = 'padding:10px 12px;font-size:12px;font-weight:600;color:var(--text-dim);border-bottom:2px solid var(--border);white-space:nowrap;';
        const dCell = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;';
        const headerHtml = headers.map(h => `<div style="${hCell}">${h}</div>`).join('');
        const bodyHtml   = rows.length
            ? rows.join('')
            : `<div style="grid-column:1/-1;padding:16px;text-align:center;color:var(--text-dim);">لا توجد بيانات</div>`;
        return `<div style="overflow-x:auto;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:380px;">
                ${headerHtml}${bodyHtml}
            </div>
        </div>`;
    }

    const dCell = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;';

    const viewBtn = (tab, id) =>
        `<button onclick="viewDashboardItem('${tab}',${id})"
            style="cursor:pointer;background:rgba(211,47,47,0.12);border:1px solid rgba(211,47,47,0.35);
                   color:#ef5350;border-radius:7px;padding:3px 11px;font-family:'Cairo';font-size:11px;
                   font-weight:700;white-space:nowrap;">عرض ←</button>`;

    const recentMGrid = _gridTable(
        ['22%','38%','18%','12%','10%'],
        ['الفرع','التفاصيل','الحالة','أضافه',''],
        recentM.map(x => {
            const isRoast = x.type === 'اصناف محمص الشعب';
            const detailsCell = isRoast
                ? `<span style="color:var(--text-dim);font-size:11px;">—</span>`
                : `<span class="text-box-cell" style="font-size:12px;">${sanitize((x.notes||'').substring(0,50))}${(x.notes||'').length>50?'…':''}</span>`;
            return `
            <div style="${dCell}"><b>${sanitize(x.branch)}</b><br><small style="color:var(--text-dim)">${sanitize(x.city)}</small></div>
            <div style="${dCell}">${detailsCell}</div>
            <div style="${dCell}"><span class="status-badge ${x.status==='تم التسليم'?'done':x.status==='مرفوضة'?'rejected':x.status==='قيد الانتظار'?'not-delivered':'pending'}">${x.status==='قيد الانتظار'?'لم يتم التسليم':sanitize(x.status)}</span></div>
            <div style="${dCell}"><small>${sanitize(x.addedBy||'—')}</small></div>
            <div style="${dCell};text-align:center;">${viewBtn('m', x.id)}</div>`;
        })
    );

    const recentCGrid = _gridTable(
        ['22%','38%','18%','12%','10%'],
        ['الفرع','الشكوى','الرد','أضافه',''],
        recentC.map(x => `
            <div style="${dCell}"><b>${sanitize(x.branch)}</b><br><small style="color:var(--text-dim)">${sanitize(x.city)}</small></div>
            <div style="${dCell}"><span class="text-box-cell" style="font-size:12px;">${sanitize((x.notes||'').substring(0,50))}${(x.notes||'').length>50?'…':''}</span></div>
            <div style="${dCell}"><span class="status-badge ${x.audit?'done':'pending'}">${x.audit?'تم الرد':'بانتظار الرد'}</span></div>
            <div style="${dCell}"><small>${sanitize(x.addedBy||'—')}</small></div>
            <div style="${dCell};text-align:center;">${viewBtn('c', x.id)}</div>`)
    );

    const btnStyle = `cursor:pointer;background:rgba(211,47,47,0.12);border:1px solid rgba(211,47,47,0.35);
        color:#ef5350;border-radius:8px;padding:4px 14px;font-family:'Cairo';font-size:12px;font-weight:700;`;

    container.innerHTML = cards + `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card" style="padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h4 style="margin:0;color:var(--accent-red);">📋 آخر المنتسيات</h4>
                <button style="${btnStyle}" onclick="switchTab('m')">عرض الكل ←</button>
            </div>
            ${recentMGrid}
        </div>
        <div class="card" style="padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h4 style="margin:0;color:var(--accent-red);">🚨 آخر الشكاوي</h4>
                <button style="${btnStyle}" onclick="switchTab('c')">عرض الكل ←</button>
            </div>
            ${recentCGrid}
        </div>
    </div>`;
}
