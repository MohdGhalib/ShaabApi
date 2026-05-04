/* ══════════════════════════════════════════════════════
   AUDIT LOG — Comprehensive employee activity log
   Retains last 7 days, searchable + exportable
══════════════════════════════════════════════════════ */

const AUDIT_ACTION_LABELS = {
    'addMontasia':           'إضافة منتسية',
    'editMontasiaType':      'تعديل نوع منتسية',
    'editMontasiaStatus':    'تعديل حالة منتسية',
    'editMontasiaNotes':     'تعديل تفاصيل منتسية',
    'deliverMontasia':       'تسليم منتسية',
    'approveMontasia':       'الموافقة على منتسية',
    'approveMontasiaMobile': 'موافقة منتسية (موبايل)',
    'deleteMontasia':        'حذف منتسية',
    'restoreMontasia':       'استعادة منتسية',
    'addInquiry':            'إضافة استفسار',
    'editInquiry':           'تعديل استفسار',
    'deleteInquiry':         'حذف استفسار',
    'restoreInquiry':        'استعادة استفسار',
    'addComplaint':          'إضافة شكوى سيطرة',
    'approveComplaint':      'الموافقة على شكوى',
    'editComplaint':         'تعديل شكوى',
    'deleteComplaint':       'حذف شكوى',
    'restoreComplaint':      'استعادة شكوى',
};

function _auditActionLabel(a) { return AUDIT_ACTION_LABELS[a] || a; }

const _lastAuditFilter = { emp:'', branch:'', date:'', action:'' };

function _readAuditFilters() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    _lastAuditFilter.emp    = get('auditSearchEmp');
    _lastAuditFilter.branch = get('auditSearchBranch');
    _lastAuditFilter.date   = get('auditSearchDate');
    _lastAuditFilter.action = get('auditSearchAction');
}

function _onAuditFilterChange() {
    _readAuditFilters();
    renderAuditLog();
}

function resetAuditSearch() {
    _lastAuditFilter.emp = _lastAuditFilter.branch = _lastAuditFilter.date = _lastAuditFilter.action = '';
    renderAuditLog();
}

function _filteredAuditEntries() {
    const fEmp    = (_lastAuditFilter.emp    || '').toLowerCase();
    const fBranch = (_lastAuditFilter.branch || '').toLowerCase();
    const fDate   = _lastAuditFilter.date    || '';
    const fAction = _lastAuditFilter.action  || '';

    return (db.auditLog || []).slice().reverse().filter(e => {
        if (fEmp    && !((e.by||'').toLowerCase().includes(fEmp) || (e.empId||'').toLowerCase().includes(fEmp))) return false;
        if (fBranch && !(e.entity||'').toLowerCase().includes(fBranch)) return false;
        if (fDate   && (e.iso||'') !== fDate) return false;
        if (fAction && (e.action||'') !== fAction) return false;
        return true;
    });
}

function exportAuditLog() {
    if (typeof XLSX === 'undefined') return alert('تعذّر تحميل مكتبة Excel');
    const list = _filteredAuditEntries();
    if (!list.length) return alert('لا توجد سجلات للتصدير');
    const rows = list.map(e => ({
        'العملية':    _auditActionLabel(e.action),
        'الفرع':      e.entity || '—',
        'التفاصيل':   e.summary || '—',
        'الموظف':     e.by || '—',
        'رقم الموظف': e.empId || '—',
        'الدور':      e.role || '—',
        'التاريخ':    e.iso || '—',
        'الوقت':      e.time || '—',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل التدقيق');
    XLSX.writeFile(wb, `سجل_التدقيق_${iso()}.xlsx`);
}

function renderAuditLog() {
    const container = document.getElementById('auditLogContainer');
    if (!container) return;

    const entries = _filteredAuditEntries();
    const totalAll = (db.auditLog || []).length;

    const COLS  = '15% 12% 30% 13% 12% 18%';
    const hCell = 'padding:10px 12px;font-size:12px;font-weight:600;color:var(--text-dim);border-bottom:2px solid var(--border);white-space:nowrap;';
    const dCell = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;';

    const headers = ['العملية','الفرع','التفاصيل','الموظف','رقم الموظف','الوقت']
        .map(h => `<div style="${hCell}">${h}</div>`).join('');

    const dataRows = entries.length
        ? entries.map(entry => `
            <div style="${dCell}"><span class="emp-badge" style="font-size:12px;">${sanitize(_auditActionLabel(entry.action))}</span></div>
            <div style="${dCell}">${sanitize(entry.entity || '—')}</div>
            <div style="${dCell}"><span class="text-box-cell" style="font-size:12px;">${sanitize(entry.summary || '—')}</span></div>
            <div style="${dCell}"><small style="color:var(--text-main);">${sanitize(entry.by || '—')}</small></div>
            <div style="${dCell}"><small style="color:var(--text-dim);">${sanitize(entry.empId || '—')}</small></div>
            <div style="${dCell}"><small style="color:var(--text-dim);">${_toLatinDigits(entry.time || '—')}</small></div>`).join('')
        : `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-dim);">لا توجد سجلات مطابقة</div>`;

    const actionOptions = Object.entries(AUDIT_ACTION_LABELS)
        .map(([k,v]) => `<option value="${k}" ${_lastAuditFilter.action===k?'selected':''}>${v}</option>`).join('');

    container.innerHTML = `
    <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <h3 style="margin:0;">📋 سجل التدقيق</h3>
            <small style="color:var(--text-dim);">${entries.length} من ${totalAll} سجل (آخر 7 أيام)</small>
        </div>
        <div class="search-bar" style="margin-bottom:16px;">
            <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
            <div><label>اسم الموظف / رقمه</label><input type="text" id="auditSearchEmp" placeholder="بحث..." value="${sanitize(_lastAuditFilter.emp)}" oninput="_onAuditFilterChange()"></div>
            <div><label>الفرع</label><input type="text" id="auditSearchBranch" placeholder="بحث..." value="${sanitize(_lastAuditFilter.branch)}" oninput="_onAuditFilterChange()"></div>
            <div><label>التاريخ</label><input type="date" id="auditSearchDate" value="${sanitize(_lastAuditFilter.date)}" onchange="_onAuditFilterChange()"></div>
            <div><label>نوع العملية</label>
                <select id="auditSearchAction" onchange="_onAuditFilterChange()">
                    <option value="">الكل</option>
                    ${actionOptions}
                </select>
            </div>
            <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetAuditSearch()">تفريغ</button>
            <button class="btn" style="background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.08));border:1px solid rgba(46,125,50,0.5);color:#a5d6a7;align-self:end;font-weight:700;" onclick="exportAuditLog()">⬇️ تصدير Excel</button>
        </div>
        <div style="overflow-x:auto;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:760px;">
                ${headers}
                ${dataRows}
            </div>
        </div>
    </div>`;

    // Restore focus to active text inputs after re-render
    const active = document.activeElement?.id;
    if (active && ['auditSearchEmp','auditSearchBranch','auditSearchDate'].includes(active)) {
        const el = document.getElementById(active);
        if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch {} }
    }
}
