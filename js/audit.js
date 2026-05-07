/* ══════════════════════════════════════════════════════
   AUDIT LOG — Comprehensive employee activity log
   Retains last 7 days, searchable + exportable
══════════════════════════════════════════════════════ */

const AUDIT_ACTION_LABELS = {
    'addMontasia':           'إضافة منتسية',
    'editMontasiaType':      'تعديل نوع منتسية',
    'editMontasiaStatus':    'تعديل حالة منتسية',
    'editMontasiaNotes':     'تعديل تفاصيل منتسية',
    'editMontasiaBranch':    'تعديل فرع منتسية',
    'auditComplaint':        'رد قسم السيطرة',
    'assignControlEmp':      'إسناد شكوى لمدير قسم السيطرة',
    'controlEmpReply':       'رد مدير قسم السيطرة',
    'approveControlEmpReply':'موافقة على رد مدير السيطرة',
    'assignControlSub':      'إسناد شكوى لموظف سيطرة',
    'controlSubReply':       'رد موظف سيطرة',
    'approveControlSubReply':'موافقة على رد موظف سيطرة',
    'returnSubReply':        'إرجاع رد موظف سيطرة',
    'deleteSubReply':        'حذف رد موظف سيطرة',
    'editControlSubReply':   'تعديل رد موظف سيطرة',
    'editAuditStatus':       'تعديل حالة الملاحظة',
    'toggleCountComplaint':  'احتساب/تراجع شكوى',
    'editComplaintField':    'تعديل حقل شكوى',
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
    'login':                 'تسجيل دخول',
    'logout':                'تسجيل خروج',
    'forceLogout':           'إخراج موظف من النظام',
    'sendMessage':           'إرسال رسالة',
    'interventionMessage':   'تدخّل إداري في محادثة',
    'uploadPhoto':           'رفع صورة موظف',
    'deletePhoto':           'حذف صورة موظف',
};
function _auditActionLabel(a) { return AUDIT_ACTION_LABELS[a] || a; }

/* ── Map audit action → record type (للسجلات القديمة بلا refId) ── */
const _AUDIT_ACTION_TO_TYPE = {
    'addMontasia':           'montasia',
    'deliverMontasia':       'montasia',
    'approveMontasia':       'montasia',
    'approveMontasiaMobile': 'montasia',
    'editMontasiaType':      'montasia',
    'editMontasiaStatus':    'montasia',
    'editMontasiaNotes':     'montasia',
    'editMontasiaBranch':    'montasia',
    'editMontasiaItems':     'montasia',
    'deleteMontasia':        'montasia',
    'restoreMontasia':       'montasia',
    'addInquiry':            'inquiry',
    'editInquiry':           'inquiry',
    'deleteInquiry':         'inquiry',
    'restoreInquiry':        'inquiry',
    'addComplaint':          'complaint',
    'editComplaint':         'complaint',
    'deleteComplaint':       'complaint',
    'restoreComplaint':      'complaint',
    'auditComplaint':        'complaint',
    'editComplaintField':    'complaint',
    'toggleCountComplaint':  'complaint',
    'editAuditStatus':       'complaint',
    'approveComplaint':      'complaint'
};

function _auditEntryRecordType(entry) {
    if (entry.refType) return entry.refType;
    return _AUDIT_ACTION_TO_TYPE[entry.action] || null;
}

/* ── Jump from audit row to the actual record (montasi/inquiry/complaint) ──
   يدعم refId الصريح (السجلات الجديدة) وfallback بالطابع الزمني (للسجلات القديمة)
   لأن كل سجل يُنشأ بـ id=Date.now() والـ audit.ts قريب جدًا من id السجل. */
function _jumpFromAudit(refType, refId, fallbackAction, fallbackTs, fallbackEntity) {
    let resolvedType = refType || (_AUDIT_ACTION_TO_TYPE[fallbackAction] || null);
    let resolvedId   = (refId != null && refId !== '') ? refId : null;

    if (!resolvedType) {
        alert('هذا النوع من السجلات لا يدعم النقر للوصول.');
        return;
    }
    const tabMap   = { montasia:'m', inquiry:'i', complaint:'c' };
    const tableMap = { montasia:'#tableM', inquiry:'#tableI', complaint:'#tableC' };
    const tab = tabMap[resolvedType], table = tableMap[resolvedType];
    if (!tab || !table || typeof switchTab !== 'function') return;

    // Fallback: لو ما عندنا refId، نبحث عن سجل قريب من ts
    if (resolvedId == null && fallbackTs) {
        const records = (resolvedType === 'montasia' ? (db.montasiat || []) :
                         resolvedType === 'inquiry'  ? (db.inquiries || []) :
                         resolvedType === 'complaint' ? (db.complaints || []) : []);
        // نطاق ±60 ثانية من وقت السجل الإحصائي (audit ts ≈ record id بفارق صغير)
        const candidates = records.filter(r => {
            if (r.deleted) return false;
            if (typeof r.id !== 'number') return false;
            if (Math.abs(r.id - fallbackTs) > 60_000) return false;
            if (fallbackEntity && r.branch && r.branch !== fallbackEntity) return false;
            return true;
        });
        if (candidates.length === 0) {
            alert('السجل غير موجود — قد يكون محذوفاً أو خارج النطاق الزمني.');
            return;
        }
        candidates.sort((a, b) => Math.abs(a.id - fallbackTs) - Math.abs(b.id - fallbackTs));
        resolvedId = candidates[0].id;
    }

    if (resolvedId == null) {
        alert('تعذّر تحديد السجل — لا يوجد معرّف.');
        return;
    }

    switchTab(tab);

    // قد يحتاج الجدول وقتاً ليُرسَم — نحاول حتى 5 مرات
    let attempts = 0;
    const tryFind = () => {
        attempts++;
        const row = document.querySelector(`${table} tbody tr[data-id="${resolvedId}"]`);
        if (row) {
            document.querySelectorAll(`${table} tbody tr`).forEach(r => { r.style.outline = ''; r.style.boxShadow = ''; });
            row.style.outline      = '3px solid #64b5f6';
            row.style.boxShadow    = '0 0 18px rgba(100,181,246,0.5)';
            row.style.borderRadius = '8px';
            row.scrollIntoView({ behavior:'smooth', block:'center' });
            setTimeout(() => { row.style.outline = ''; row.style.boxShadow = ''; }, 4000);
            return;
        }
        if (attempts >= 5) {
            alert('السجل غير موجود في الصفحة الحالية — قد يكون:\n' +
                  '• محذوفاً\n' +
                  '• خارج عوامل التصفية الحالية (امسح الفلاتر بزر "تفريغ")\n' +
                  '• على صفحة لاحقة (انتقل بين الصفحات)');
            return;
        }
        setTimeout(tryFind, 200);
    };
    setTimeout(tryFind, 250);
}

const _lastAuditFilter = { emp:'', country:'', city:'', branch:'', date:'', action:'' };
let _auditPage = 1;
const _AUDIT_SIZE_KEY = '_shaabAuditPgSize';
let _auditPgSize = 20;
try {
    const _v = parseInt(localStorage.getItem(_AUDIT_SIZE_KEY) || '20', 10);
    if (_v > 0) _auditPgSize = _v;
} catch {}

/* ── helpers لربط الفرع بالدولة/المحافظة ── */
function _branchInCountry(branch, country) {
    if (!country || !COUNTRIES_DATA[country]) return true;
    for (const r in COUNTRIES_DATA[country].regions) {
        if (COUNTRIES_DATA[country].regions[r].includes(branch)) return true;
    }
    return false;
}
function _branchInCity(branch, city) {
    if (!city || !branches[city]) return true;
    return branches[city].includes(branch);
}

function _readAuditFilters() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    _lastAuditFilter.emp     = get('searchEmpAudit');
    _lastAuditFilter.country = get('searchCountryAudit');
    _lastAuditFilter.city    = get('searchCityAudit');
    _lastAuditFilter.branch  = get('searchBranchAudit');
    _lastAuditFilter.date    = get('auditSearchDate');
    _lastAuditFilter.action  = get('auditSearchAction');
}

function _onAuditFilterChange() {
    _readAuditFilters();
    _auditPage = 1;
    _renderAuditTable();
}

function resetAuditSearch() {
    _lastAuditFilter.emp = _lastAuditFilter.country = _lastAuditFilter.city = '';
    _lastAuditFilter.branch = _lastAuditFilter.date = _lastAuditFilter.action = '';
    _auditPage = 1;
    renderAuditLog();
}

async function reloadAuditLog() {
    try {
        if (typeof loadAllData === 'function') await loadAllData();
        _renderAuditTable();
    } catch(e) { console.error('reloadAuditLog failed:', e); }
}

function changeAuditPage(dir) {
    _auditPage = Math.max(1, _auditPage + dir);
    _renderAuditTable();
}

function changeAuditPageSize(size) {
    const n = parseInt(size, 10);
    _auditPgSize = (n > 0) ? n : 20;
    _auditPage = 1;
    try { localStorage.setItem(_AUDIT_SIZE_KEY, String(_auditPgSize)); } catch {}
    _renderAuditTable();
}

function _filteredAuditEntries() {
    const f = _lastAuditFilter;
    const fEmp = (f.emp || '').toLowerCase();
    return (db.auditLog || []).slice().reverse().filter(e => {
        if (fEmp     && (e.by||'').toLowerCase() !== fEmp) return false;
        if (f.country && !_branchInCountry(e.entity, f.country)) return false;
        if (f.city    && !_branchInCity(e.entity, f.city)) return false;
        if (f.branch  && (e.entity||'') !== f.branch) return false;
        if (f.date    && (e.iso||'') !== f.date) return false;
        if (f.action  && (e.action||'') !== f.action) return false;
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

function _buildAuditTable() {
    const entries = _filteredAuditEntries();
    const totalAll = (db.auditLog || []).length;
    const total = entries.length;
    const pages = Math.max(1, Math.ceil(total / _auditPgSize));
    if (_auditPage > pages) _auditPage = pages;
    const cp = _auditPage;
    const slice = entries.slice((cp-1) * _auditPgSize, cp * _auditPgSize);

    const COLS  = '15% 12% 30% 13% 12% 18%';
    const hCell = 'padding:10px 12px;font-size:12px;font-weight:600;color:var(--text-dim);border-bottom:2px solid var(--border);white-space:nowrap;';
    const dCell = 'padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;';

    const headers = ['العملية','الفرع','التفاصيل','الموظف','رقم الموظف','الوقت']
        .map(h => `<div style="${hCell}">${h}</div>`).join('');

    const _isCCMgr = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    const dataRows = slice.length
        ? slice.map(entry => {
            // قابل للنقر إذا: (أ) فيه refType+refId، أو (ب) action معروف من خريطة الأنواع + ts متوفر
            const inferredType = _auditEntryRecordType(entry);
            const hasDirectRef = entry.refType && entry.refId != null;
            const hasFallback  = !hasDirectRef && inferredType && entry.ts;
            const canJump = _isCCMgr && (hasDirectRef || hasFallback);
            const labelText = sanitize(_auditActionLabel(entry.action));
            // بناء استدعاء النقر — escape للـ entity بسيط (الفروع ما تحتوي اقتباس)
            const safeEntity = String(entry.entity || '').replace(/'/g, '');
            const onclickStr = hasDirectRef
                ? `_jumpFromAudit('${entry.refType}', ${entry.refId}, '${entry.action || ''}', ${entry.ts || 0}, '${safeEntity}')`
                : `_jumpFromAudit('', null, '${entry.action || ''}', ${entry.ts || 0}, '${safeEntity}')`;
            const actionCell = canJump
                ? `<button onclick="${onclickStr}"
                           title="فتح السجل في تبويبه"
                           style="padding:4px 11px;font-size:12px;font-family:'Cairo';font-weight:700;
                                  border:1px solid rgba(100,181,246,0.55);
                                  background:rgba(100,181,246,0.18);color:#64b5f6;
                                  border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;"
                           onmouseover="this.style.background='rgba(100,181,246,0.35)'"
                           onmouseout="this.style.background='rgba(100,181,246,0.18)'">
                       ${labelText} <span style="font-size:13px;">↗</span>
                   </button>`
                : `<span class="emp-badge" style="font-size:12px;">${labelText}</span>`;
            return `
            <div style="${dCell}">${actionCell}</div>
            <div style="${dCell}">${sanitize(entry.entity || '—')}</div>
            <div style="${dCell}"><span class="text-box-cell" style="font-size:12px;">${sanitize(entry.summary || '—')}</span></div>
            <div style="${dCell}"><small style="color:var(--text-main);">${typeof _empNameHTML==='function'?_empNameHTML(entry.by || '—'):sanitize(entry.by || '—')}</small></div>
            <div style="${dCell}"><small style="color:var(--text-dim);">${sanitize(entry.empId || '—')}</small></div>
            <div style="${dCell}"><small style="color:var(--text-dim);">${_toLatinDigits(entry.time || '—')}</small></div>`;
        }).join('')
        : `<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-dim);">لا توجد سجلات مطابقة</div>`;

    const sizeOpts = [10, 20, 50, 100].map(n => `<option value="${n}" ${n===_auditPgSize?'selected':''}>${n}</option>`).join('');
    const navBtns = (pages <= 1) ? '' : `
        <button onclick="changeAuditPage(-1)" ${cp<=1?'disabled':''} style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';">◄ السابق</button>
        <span style="font-size:13px;color:var(--text-dim);">صفحة <b style="color:var(--text-main);">${cp}</b> من <b style="color:var(--text-main);">${pages}</b> (${total} سجل)</span>
        <button onclick="changeAuditPage(1)" ${cp>=pages?'disabled':''} style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';">التالي ►</button>`;
    const sizeBox = `<span style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px;">عرض
        <select onchange="changeAuditPageSize(this.value)" style="padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);font-family:'Cairo';font-size:12px;cursor:pointer;">${sizeOpts}</select>
        / صفحة</span>`;

    return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <small style="color:var(--text-dim);">${total} من ${totalAll} سجل (آخر 7 أيام)</small>
        </div>
        <div style="overflow-x:auto;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:760px;">
                ${headers}
                ${dataRows}
            </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px;flex-wrap:wrap;">
            ${navBtns}${sizeBox}
        </div>`;
}

function _renderAuditTable() {
    const tbl = document.getElementById('auditTableContainer');
    if (tbl) tbl.innerHTML = _buildAuditTable();
}

function renderAuditLog() {
    const container = document.getElementById('auditLogContainer');
    if (!container) return;

    const actionOptions = Object.entries(AUDIT_ACTION_LABELS)
        .map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

    // قائمة الموظفين: كل الموظفين بدون استثناء
    const empOptions = (employees || [])
        .slice()
        .sort((a,b) => (a.name||'').localeCompare(b.name||'', 'ar'))
        .map(e => `<option value="${sanitize(e.name)}">${sanitize(e.name)}${e.empId ? ' — ' + sanitize(e.empId) : ''}</option>`)
        .join('');

    container.innerHTML = `
    <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <h3 style="margin:0;">📋 سجل التدقيق</h3>
        </div>
        <div class="search-bar" style="margin-bottom:16px;">
            <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
            <div><label>الموظف</label>
                <select id="searchEmpAudit" onchange="_onAuditFilterChange()">
                    <option value="">الكل</option>
                    ${empOptions}
                </select>
            </div>
            <div><label>الدولة</label>
                <select id="searchCountryAudit" onchange="updateCities('searchCountryAudit','searchCityAudit','searchBranchAudit');_onAuditFilterChange()"></select>
            </div>
            <div><label data-region-label-for="searchCityAudit">المحافظة</label>
                <select id="searchCityAudit" onchange="updateBranches('searchCityAudit','searchBranchAudit');_onAuditFilterChange()"></select>
            </div>
            <div><label>الفرع</label>
                <select id="searchBranchAudit" onchange="_onAuditFilterChange()"><option value="">الكل</option></select>
            </div>
            <div><label>التاريخ</label>
                <input type="date" id="auditSearchDate" value="${sanitize(_lastAuditFilter.date)}" onchange="_onAuditFilterChange()">
            </div>
            <div><label>نوع العملية</label>
                <select id="auditSearchAction" onchange="_onAuditFilterChange()">
                    <option value="">الكل</option>
                    ${actionOptions}
                </select>
            </div>
            <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetAuditSearch()">تفريغ</button>
            <button class="btn" style="background:linear-gradient(135deg,rgba(21,101,192,0.18),rgba(21,101,192,0.08));border:1px solid rgba(21,101,192,0.5);color:#90caf9;align-self:end;font-weight:700;" onclick="reloadAuditLog()">🔄 تحديث</button>
            <button class="btn" style="background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.08));border:1px solid rgba(46,125,50,0.5);color:#a5d6a7;align-self:end;font-weight:700;" onclick="exportAuditLog()">⬇️ تصدير Excel</button>
        </div>
        <div id="auditTableContainer"></div>
    </div>`;

    // تعبئة قوائم الدول/المحافظات/الفروع
    if (typeof setupCountrySelects === 'function') setupCountrySelects();

    // استعادة قيم الفلتر بعد إعادة الرندر
    const _set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    _set('searchEmpAudit', _lastAuditFilter.emp);
    _set('auditSearchAction', _lastAuditFilter.action);
    if (_lastAuditFilter.country) {
        _set('searchCountryAudit', _lastAuditFilter.country);
        if (typeof updateCities === 'function') updateCities('searchCountryAudit','searchCityAudit','searchBranchAudit');
        _set('searchCityAudit', _lastAuditFilter.city);
        if (_lastAuditFilter.city && typeof updateBranches === 'function') updateBranches('searchCityAudit','searchBranchAudit');
        _set('searchBranchAudit', _lastAuditFilter.branch);
    }

    _renderAuditTable();
}
