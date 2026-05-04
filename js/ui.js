/* ══════════════════════════════════════════════════════
   UI — Tabs, init, dropdowns
══════════════════════════════════════════════════════ */

/* ── حالة التحديد المتعدد لقائمة الأسعار ── */
const _selP = new Set(); // قائمة الأسعار — تخزن الـ realIdx

function _updateBulkBar(barId, count, deleteFn, clearFn) {
    const el = document.getElementById(barId);
    if (!el) return;
    if (count === 0) { el.innerHTML = ''; return; }
    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;
                    background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.3);
                    border-radius:12px;margin-bottom:10px;">
            <span style="font-weight:700;color:var(--accent-red);font-size:13px;">✓ تم تحديد ${count} عنصر</span>
            <button onclick="${deleteFn}()"
                style="background:var(--accent-red);color:#fff;border:none;border-radius:8px;
                       padding:6px 16px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;">
                🗑 حذف المحدد (${count})
            </button>
            <button onclick="${clearFn}()"
                style="background:var(--bg-input);color:var(--text-dim);border:1px solid var(--border);
                       border-radius:8px;padding:6px 14px;cursor:pointer;font-family:'Cairo';font-size:13px;">
                ✕ إلغاء التحديد
            </button>
        </div>`;
}

/* ── Popup تأكيد الحذف العام ── */
let _deleteCallback = null;

function showDeleteConfirm(previewHtml, onConfirm) {
    _deleteCallback = onConfirm;
    document.getElementById('deleteConfirmPreview').innerHTML = previewHtml;
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
}
function confirmDeleteAction() {
    if (_deleteCallback) _deleteCallback();
    _deleteCallback = null;
    document.getElementById('deleteConfirmModal').classList.add('hidden');
}
function cancelDeleteAction() {
    _deleteCallback = null;
    document.getElementById('deleteConfirmModal').classList.add('hidden');
}
function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const next = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('Shaab_Theme', next);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = next === 'light' ? '🌙' : '☀️';
}

function applyThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️';
}

/* ── ترقيم الصفحات ── */
const _pg = { M:1, I:1, C:1, O:1, CU:1 };
const _DEFAULT_PAGE_SIZE = 10;
const _pgSize = { M:10, O:10, I:10, C:10, CU:10 };
try {
    const _saved = JSON.parse(localStorage.getItem('_shaabPgSize') || '{}');
    Object.assign(_pgSize, _saved);
} catch {}

function changePage(table, dir) {
    _pg[table] = Math.max(1, (_pg[table] || 1) + dir);
    renderAll();
}

function changePageSize(table, size) {
    const n = parseInt(size, 10);
    _pgSize[table] = (n > 0) ? n : _DEFAULT_PAGE_SIZE;
    _pg[table] = 1;
    try { localStorage.setItem('_shaabPgSize', JSON.stringify(_pgSize)); } catch {}
    renderAll();
}

function _paginationBar(table, total, currentPage) {
    const size = _pgSize[table] || _DEFAULT_PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(total / size));
    const cp = Math.min(currentPage, pages);
    const sizeOptions = [10, 20, 50, 100].map(n =>
        `<option value="${n}" ${n === size ? 'selected' : ''}>${n}</option>`).join('');
    const sizeBox = `<span style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px;">عرض
        <select onchange="changePageSize('${table}', this.value)" style="padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);font-family:'Cairo';font-size:12px;cursor:pointer;">${sizeOptions}</select>
        / صفحة</span>`;
    if (pages <= 1 && total <= 10) return '';
    const navBtns = (pages <= 1) ? '' : `
        <button onclick="changePage('${table}',-1)" ${cp<=1?'disabled':''} style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';">◄ السابق</button>
        <span style="font-size:13px;color:var(--text-dim);">صفحة <b style="color:var(--text-main);">${cp}</b> من <b style="color:var(--text-main);">${pages}</b> (${total} عنصر)</span>
        <button onclick="changePage('${table}',1)" ${cp>=pages?'disabled':''} style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';">التالي ►</button>`;
    return `<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px;flex-wrap:wrap;">${navBtns}${sizeBox}</div>`;
}

/* ── شارات الأرقام على التبويبات ── */
// آخر وقت زار فيه المستخدم كل تبويب (timestamp)
// يُحفظ في localStorage حتى يبقى بين الجلسات
const _sessionStart = Date.now();
let   _lastSeenAt   = {};
let   _activeTab    = null;

function _loadLastSeen() {
    try { _lastSeenAt = JSON.parse(localStorage.getItem('_shaabLastSeen') || '{}'); } catch { _lastSeenAt = {}; }
}
function _markTabSeen(tab) {
    _lastSeenAt[tab] = Date.now();
    try { localStorage.setItem('_shaabLastSeen', JSON.stringify(_lastSeenAt)); } catch {}
}
function _getLastSeen(tab) {
    // إذا لم تُزر من قبل: نعدّ الجديد منذ بدء الجلسة الحالية فقط
    return _lastSeenAt[tab] ?? _sessionStart;
}
_loadLastSeen();

function _updateBadges() {
    const lastM = _getLastSeen('m');
    const lastC = _getLastSeen('c');
    const lastI = _getLastSeen('i');

    // عدد الإضافات الجديدة التي لم يُشاهَد التبويب بعدها
    const newM = (db.montasiat  || []).filter(x => !x.deleted && x.status === 'قيد الانتظار' && x.id > lastM).length;
    const newC = (db.complaints || []).filter(x => !x.deleted && x.id > lastC).length;
    const newI = (db.inquiries  || []).filter(x => !x.deleted && x.id > lastI).length;

    const set = (id, tab, count) => {
        const el = document.getElementById(id);
        if (!el) return;
        const hide = count === 0 || _activeTab === tab;
        el.textContent  = hide ? '' : count;
        el.style.display = hide ? 'none' : '';
    };
    set('badge-m', 'm', newM);
    set('badge-c', 'c', newC);
    set('badge-i', 'i', newI);

    // ── شارة جرس الإشعارات ──
    const total = newM + newC + newI;
    const bell  = document.getElementById('notifBellBadge');
    if (bell) {
        bell.textContent  = total > 9 ? '9+' : total;
        bell.style.display = total > 0 ? 'flex' : 'none';
    }
}

/* ── لوحة الإشعارات ── */
let _notifOpen = false;

function _toggleNotifPanel() {
    _notifOpen = !_notifOpen;
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    if (_notifOpen) {
        _renderNotifPanel();
        panel.style.display = 'block';
        // أعد تشغيل الأنيميشن
        panel.style.animation = 'none';
        void panel.offsetWidth;
        panel.style.animation = '';
    } else {
        panel.style.display = 'none';
    }
}

// إغلاق لوحة الإشعارات عند النقر خارجها
document.addEventListener('click', e => {
    if (!_notifOpen) return;
    const btn   = document.getElementById('notifBellBtn');
    const panel = document.getElementById('notifPanel');
    if (btn && !btn.contains(e.target) && panel && !panel.contains(e.target)) {
        _notifOpen = false;
        panel.style.display = 'none';
    }
});

function _renderNotifPanel() {
    const lastM = _getLastSeen('m');
    const lastC = _getLastSeen('c');
    const lastI = _getLastSeen('i');

    const newMItems = (db.montasiat  || []).filter(x => !x.deleted && x.id > lastM).slice(0, 4);
    const newCItems = (db.complaints || []).filter(x => !x.deleted && x.id > lastC).slice(0, 4);
    const newIItems = (db.inquiries  || []).filter(x => !x.deleted && x.id > lastI).slice(0, 4);
    const total     = newMItems.length + newCItems.length + newIItems.length;

    const sItem = `padding:9px 12px;cursor:pointer;border-radius:10px;transition:background 0.15s;
                   font-size:13px;display:flex;flex-direction:column;gap:2px;`;
    const sLabel= `font-size:10px;font-weight:700;letter-spacing:0.5px;color:var(--text-dim);
                   padding:6px 12px 3px;`;
    let html = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-weight:700;font-size:14px;color:var(--text-main);">🔔 الإشعارات</span>
        ${total > 0
            ? `<button onclick="_markAllNotifRead()"
                  style="font-size:12px;padding:4px 12px;border-radius:8px;border:1px solid var(--border);
                         background:transparent;color:var(--text-dim);font-family:'Cairo';cursor:pointer;">
                  ✓ تم القراءة</button>`
            : ''}
    </div>
    <div style="overflow-y:auto;max-height:310px;padding:8px;">`;

    if (total === 0) {
        html += `<div style="padding:28px;text-align:center;color:var(--text-dim);font-size:13px;">
                    ✅ لا توجد إشعارات جديدة</div>`;
    }

    if (newMItems.length) {
        html += `<div style="${sLabel}">📋 منتسيات</div>`;
        newMItems.forEach(x => {
            html += `<div style="${sItem}" onclick="_navFromNotif('m',${x.id})"
                         onmouseover="this.style.background='rgba(211,47,47,0.08)'"
                         onmouseout="this.style.background=''">
                <span style="font-weight:700;color:var(--text-main);">${sanitize(x.branch)} — ${sanitize(x.city)}</span>
                <span style="color:var(--text-dim);font-size:11px;">${sanitize((x.notes||'').substring(0,45))}${(x.notes||'').length>45?'…':''}</span>
            </div>`;
        });
    }

    if (newCItems.length) {
        html += `<div style="${sLabel}">🚨 شكاوي</div>`;
        newCItems.forEach(x => {
            html += `<div style="${sItem}" onclick="_navFromNotif('c',${x.id})"
                         onmouseover="this.style.background='rgba(211,47,47,0.08)'"
                         onmouseout="this.style.background=''">
                <span style="font-weight:700;color:var(--text-main);">${sanitize(x.branch)} — ${sanitize(x.city)}</span>
                <span style="color:var(--text-dim);font-size:11px;">${sanitize((x.notes||'').substring(0,45))}${(x.notes||'').length>45?'…':''}</span>
            </div>`;
        });
    }

    if (newIItems.length) {
        html += `<div style="${sLabel}">💬 استفسارات</div>`;
        newIItems.forEach(x => {
            html += `<div style="${sItem}" onclick="_navFromNotif('i',${x.id})"
                         onmouseover="this.style.background='rgba(211,47,47,0.08)'"
                         onmouseout="this.style.background=''">
                <span style="font-weight:700;color:var(--text-main);">${sanitize(x.branch)} — ${sanitize(x.city)}</span>
                <span style="color:var(--text-dim);font-size:11px;">${sanitize((x.text||x.notes||'').substring(0,45))}${((x.text||x.notes||'').length>45)?'…':''}</span>
            </div>`;
        });
    }

    html += `</div>`;
    document.getElementById('notifPanel').innerHTML = html;
}

function _navFromNotif(tab, id) {
    _notifOpen = false;
    const panel = document.getElementById('notifPanel');
    if (panel) panel.style.display = 'none';
    viewDashboardItem(tab, id);
}

function _markAllNotifRead() {
    _markTabSeen('m');
    _markTabSeen('c');
    _markTabSeen('i');
    _notifOpen = false;
    const panel = document.getElementById('notifPanel');
    if (panel) panel.style.display = 'none';
    _updateBadges();
}

function _syncEmpGroup() {
    const grpE = document.getElementById('nav-group-e');
    if (!grpE) return;
    const anyVisible = ['tab-b','tab-e','tab-s'].some(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
    grpE.classList.toggle('hidden', !anyVisible);
}

function toggleTabE() {
    const grpE = document.getElementById('nav-group-e');
    if (grpE) grpE.classList.toggle('open');
    const btn = document.getElementById('tab-emp-group');
    if (btn) btn.classList.toggle('group-active', grpE?.classList.contains('open'));
}

function toggleTabM() {
    const grpM = document.getElementById('nav-group-m');
    if (grpM) grpM.classList.toggle('open');
}

function toggleTabC() {
    const grpC = document.getElementById('nav-group-c');
    if (grpC) grpC.classList.toggle('open');
}

function toggleTabMsg() {
    const grpMsg = document.getElementById('nav-group-msg');
    if (grpMsg) grpMsg.classList.toggle('open');
}

function switchTab(t) {
    // تحديد الـ active لجميع التبويبات العادية
    ['o','i','cu','comp','mn','b','e','s','f','p','h','l','t','msg','msg-mine','msg-all'].forEach(id => {
        const btn = document.getElementById(`tab-${id}`);
        if (btn) btn.classList.toggle('active', t === id);
    });

    // tab-m-sub: active عند 'm' — tab-m الأب: group-active عند 'm' أو 'o'
    document.getElementById('tab-m-sub')?.classList.toggle('active', t === 'm');
    const tabM = document.getElementById('tab-m');
    if (tabM) { tabM.classList.remove('active'); tabM.classList.toggle('group-active', t === 'm' || t === 'o'); }

    // tab-c-sub: active عند 'c' — tab-c الأب: group-active عند 'c' أو 'cu' أو 'comp'
    document.getElementById('tab-c-sub')?.classList.toggle('active', t === 'c');
    const tabC = document.getElementById('tab-c');
    if (tabC) { tabC.classList.remove('active'); tabC.classList.toggle('group-active', t === 'c' || t === 'cu' || t === 'comp' || t === 'mn'); }

    // فتح/إغلاق القوائم الفرعية
    const grpM = document.getElementById('nav-group-m');
    if (grpM) grpM.classList.toggle('open', t === 'm' || t === 'o');
    const grpC = document.getElementById('nav-group-c');
    if (grpC) grpC.classList.toggle('open', t === 'c' || t === 'cu' || t === 'comp' || t === 'mn');

    // فتح/إغلاق مجموعة الموظفين
    const grpE = document.getElementById('nav-group-e');
    if (grpE) grpE.classList.toggle('open', ['b','e','s'].includes(t));
    const tabEGroup = document.getElementById('tab-emp-group');
    if (tabEGroup) tabEGroup.classList.toggle('group-active', ['b','e','s'].includes(t));

    // تسجيل وقت المشاهدة وإخفاء الشارة عند فتح التبويب
    _activeTab = t;
    if (['m','o','c','cu','comp','mn','i'].includes(t)) {
        _markTabSeen(t === 'o' ? 'm' : (t === 'cu' || t === 'comp' || t === 'mn') ? 'c' : t);
    }
    const badge = document.getElementById(`badge-${t}`);
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }

    document.getElementById('page-container').innerHTML = PAGES[t] || '';

    setupCitySelects();
    if (typeof setupCountrySelects === 'function') setupCountrySelects();

    if (t === 'e') {
        renderEmployees();
    } else if (t === 'b') {
        renderBreakHistory();
    } else if (t === 's') {
        setDatePickerValue('statDate', iso());
        populateStatSelect();
        renderStats();
    } else if (t === 'f') {
        renderBranches();
    } else if (t === 'p') {
        renderPrices();
        return;
    } else if (t === 'h') {
        if (typeof renderDashboard === 'function') renderDashboard();
        return;
    } else if (t === 'l') {
        if (typeof renderAuditLog === 'function') renderAuditLog();
        return;
    } else if (t === 'msg' || t === 'msg-mine' || t === 'msg-all') {
        // إعداد التقسيم الفرعي + رسم الصفحة
        if (typeof _setMsgPageView === 'function') {
            _setMsgPageView(t === 'msg-all' ? 'all' : 'mine');
        }
        // تفعيل الـ active للأزرار الفرعية والمجموعة
        document.getElementById('tab-msg-mine')?.classList.toggle('active', t !== 'msg-all');
        document.getElementById('tab-msg-all')?.classList.toggle('active', t === 'msg-all');
        const tabMsgParent = document.getElementById('tab-msg');
        if (tabMsgParent) { tabMsgParent.classList.remove('active'); tabMsgParent.classList.add('group-active'); }
        const grpMsg = document.getElementById('nav-group-msg');
        if (grpMsg) grpMsg.classList.add('open');
        // رسم الصفحة (PAGES['msg'] يتضمن الحاوية)
        document.getElementById('page-container').innerHTML = PAGES['msg'] || '';
        if (typeof renderMessagesPage === 'function') renderMessagesPage();
        return;
    } else if (t === 't') {
        if (typeof renderTrash === 'function') renderTrash();
        return;
    } else if (t === 'cu') {
        if (typeof renderControlOpen === 'function') renderControlOpen();
        return;
    } else if (t === 'comp') {
        setupCitySelects();
    if (typeof setupCountrySelects === 'function') setupCountrySelects();
        if (typeof _populateCompComplaintSelect === 'function') _populateCompComplaintSelect();
        if (typeof renderCompensations === 'function') renderCompensations();
        const addCompCard = document.getElementById('addCompCard');
        if (addCompCard) addCompCard.style.display = perm('addComp') ? '' : 'none';
        const compHr = document.querySelector('#page-container hr');
        if (compHr && !perm('addComp')) compHr.style.display = 'none';
        return;
    } else if (t === 'mn') {
        setupCitySelects();
    if (typeof setupCountrySelects === 'function') setupCountrySelects();
        if (typeof renderMediaNotes === 'function') renderMediaNotes();
        return;
    } else {
        populateEmployeeDropdowns();
        renderAll();
    }

    // Apply permission gates for add-form cards
    const permGates = { addMontasiaCard:'addM', addInquiryCard:'addI', addControlCard:'addC' };
    Object.entries(permGates).forEach(([id, p]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = perm(p) ? '' : 'none';
    });

    // الميديا: يظهر ربط الاستفسار لكن مقيّد بملاحظاته فقط (يُعالَج في populateLinkedInquirySelect)

    // تهيئة حقول الوقت عند فتح تبويب السيطرة
    if (t === 'c') {
        const _d = new Date();
        const _hh = String(_d.getHours()).padStart(2,'0'), _mm = String(_d.getMinutes()).padStart(2,'0');
        setDatePickerValue('cCallDate', iso());
        const _tEl = document.getElementById('cCallTimeOnly'); if (_tEl) _tEl.value = `${_hh}:${_mm}`;
        setDatePickerValue('cNoteDate', iso());
        // الميديا: إخفاء فلتر الموظف لأنهم يرون شكاويهم فقط تلقائياً
        const addedByRow = document.getElementById('searchAddedByC')?.closest('div');
        if (addedByRow) addedByRow.style.display = currentUser?.role === 'media' ? 'none' : '';
    }
}

function init() {
    if (perm('viewStats'))    document.getElementById('tab-s').classList.remove('hidden');
    if (perm('viewBranches')) document.getElementById('tab-f').classList.remove('hidden');
    if (perm('viewComp'))     document.getElementById('tab-comp').classList.remove('hidden');
    if (!perm('addEmp'))      document.getElementById('tab-e').classList.add('hidden');
    if (!perm('viewBreak'))   document.getElementById('tab-b').classList.add('hidden');
    const role = currentUser?.role;
    let _startTab;
    if (role === 'media' || role === 'control' || role === 'control_employee' || role === 'control_sub') {
        _startTab = 'c';
    } else if (currentUser?.isAdmin || role === 'cc_manager') {
        _startTab = 'h';
    } else {
        _startTab = 'm';
    }
    _syncEmpGroup();
    switchTab(_startTab);
}

function setupCitySelects() {
    const citySelects = ['mCityAdd','iCityAdd','cCityAdd','searchCityM','searchCityC','searchCityO','searchCityI','branchCitySearch','searchCityCU','compCity','compSearchCity','mnCity','mnSearchCity'];
    const ctrlSubAB = (currentUser?.role === 'control_sub' && currentUser?.assignedBranches?.length)
        ? currentUser.assignedBranches : null;
    let allOptions = '', filteredOptions = '';
    for (let c in branches) {
        allOptions += `<option value="${c}">${c}</option>`;
        if (!ctrlSubAB || ctrlSubAB.some(b => b.city === c))
            filteredOptions += `<option value="${c}">${c}</option>`;
    }
    // تقييم الفروع: محافظات الأردن فقط
    let jordanOnlyOptions = '';
    if (typeof COUNTRIES_DATA !== 'undefined' && COUNTRIES_DATA["الأردن"]) {
        for (const r in COUNTRIES_DATA["الأردن"].regions) jordanOnlyOptions += `<option value="${r}">${r}</option>`;
    }
    citySelects.forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        const isSearch = id.startsWith('search');
        let opts;
        if (id === 'branchCitySearch') opts = jordanOnlyOptions;
        else opts = (ctrlSubAB && isSearch) ? filteredOptions : allOptions;
        el.innerHTML = (isSearch ? '<option value="">الكل</option>' : '<option value="">اختيار المحافظة</option>') + opts;
    });
    setTimeout(() => toggleUnspecifiedBranch(), 0);
}

function updateBranches(cityId, branchId) {
    const city = document.getElementById(cityId).value;
    const branchEl = document.getElementById(branchId);
    if (city === 'غير محدد') {
        branchEl.innerHTML = '<option value="غير محدد">غير محدد</option>';
        if (branchEl) branchEl.disabled = false;
        return;
    }
    const isSearch = cityId.includes('search');
    let html = isSearch ? '<option value="">الكل</option>' : '<option value="">الفرع</option>';
    const ctrlSubAB = (currentUser?.role === 'control_sub' && currentUser?.assignedBranches?.length)
        ? currentUser.assignedBranches : null;
    if (city && branches[city]) {
        branches[city].forEach(b => {
            if (ctrlSubAB && isSearch && !ctrlSubAB.some(ab => ab.city === city && ab.branch === b)) return;
            html += `<option value="${b}">${b}</option>`;
        });
    }
    branchEl.innerHTML = html;
    // إقفال الفرع حتى اختيار المحافظة
    branchEl.disabled = !city;
}

/* ── خريطة ربط دولة ↔ محافظة/فرع ── */
const _COUNTRY_LINKAGE = {
    'mCountryAdd':           { cityId:'mCityAdd',          branchId:'mBranchAdd',         isSearch:false },
    'iCountryAdd':           { cityId:'iCityAdd',          branchId:'iBranchAdd',         isSearch:false },
    'cCountryAdd':           { cityId:'cCityAdd',          branchId:'cBranchAdd',         isSearch:false },
    'compCountry':           { cityId:'compCity',          branchId:'compBranch',         isSearch:false },
    'searchCountryM':        { cityId:'searchCityM',       branchId:'searchBranchM',      isSearch:true  },
    'searchCountryC':        { cityId:'searchCityC',       branchId:'searchBranchC',      isSearch:true  },
    'searchCountryO':        { cityId:'searchCityO',       branchId:'searchBranchO',      isSearch:true  },
    'searchCountryI':        { cityId:'searchCityI',       branchId:'searchBranchI',      isSearch:true  },
    'searchCountryCU':       { cityId:'searchCityCU',      branchId:'searchBranchCU',     isSearch:true  },
    'searchCountryComp':     { cityId:'compSearchCity',    branchId:'compSearchBranch',   isSearch:true  },
    'searchCountryAudit':    { cityId:'searchCityAudit',   branchId:'searchBranchAudit',  isSearch:true  },
    'deliverCountrySelect':  { cityId:'deliverCitySelect', branchId:'deliverBranchSelect',isSearch:true  }
};

/* ── ربط دولة → مدن: ينظّف قائمة المدن ويحدّث label المستوى الثاني ── */
function updateCities(countryId, cityId, branchId) {
    const cEl = document.getElementById(countryId);
    const ciEl = document.getElementById(cityId);
    if (!cEl || !ciEl) return;
    const country = cEl.value;
    const isSearch = cityId.toLowerCase().includes('search');
    const regionLabel = (country && COUNTRIES_DATA[country]) ? COUNTRIES_DATA[country].regionLabel : 'المحافظة';

    // تحديث نصوص أي label/placeholder مرتبطة بهذا الـ cityId
    document.querySelectorAll(`[data-region-label-for="${cityId}"]`).forEach(el => {
        el.textContent = regionLabel;
    });

    let html = isSearch ? '<option value="">الكل</option>' : `<option value="">اختيار ${regionLabel}</option>`;
    if (country && COUNTRIES_DATA[country]) {
        for (const r in COUNTRIES_DATA[country].regions) html += `<option value="${r}">${r}</option>`;
    }
    ciEl.innerHTML = html;
    // إقفال المحافظة حتى اختيار الدولة
    ciEl.disabled = !country;

    if (branchId) {
        const bEl = document.getElementById(branchId);
        if (bEl) {
            bEl.innerHTML = isSearch ? '<option value="">الكل</option>' : '<option value="">الفرع</option>';
            // الفرع يبقى مقفلاً ما دام لا توجد دولة (وبالتبعية لا توجد محافظة)
            bEl.disabled = true;
        }
    }
}

/* ── تعبئة قوائم الدول + قفل المحافظات/الفروع المرتبطة ابتدائياً ── */
function setupCountrySelects() {
    let allOptions = '';
    for (const c in COUNTRIES_DATA) allOptions += `<option value="${c}">${c}</option>`;
    for (const id in _COUNTRY_LINKAGE) {
        const el = document.getElementById(id); if (!el) continue;
        const link = _COUNTRY_LINKAGE[id];
        const isSearch = !!link.isSearch;
        el.innerHTML = (isSearch ? '<option value="">الكل</option>' : '<option value="">اختيار الدولة</option>') + allOptions;
        const ciEl = document.getElementById(link.cityId);
        const bEl  = document.getElementById(link.branchId);
        if (ciEl) { ciEl.innerHTML = isSearch ? '<option value="">الكل</option>' : '<option value="">اختيار المحافظة</option>'; ciEl.disabled = true; }
        if (bEl)  { bEl.innerHTML  = isSearch ? '<option value="">الكل</option>' : '<option value="">الفرع</option>';        bEl.disabled  = true; }
    }
}

function populateEmployeeDropdowns() {
    const nonMediaEmps  = employees.filter(e => e.title !== 'موظف ميديا' && e.title !== 'مدير قسم السيطرة' && e.title !== 'موظف سيطرة');
    const deliveryEmps  = employees.filter(e => e.title !== 'موظف ميديا');

    // موظف الاستلام (إضافة) — بدون ميديا وبدون السيطرة
    ['searchAddedByM','searchAddedByO'].forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        const cur = el.value;
        el.innerHTML = '<option value="">الكل</option><option value="المدير">المدير</option>';
        nonMediaEmps.forEach(e => el.innerHTML += `<option value="${sanitize(e.name)}">${sanitize(e.name)}</option>`);
        if (cur) el.value = cur;
    });

    // موظف التسليم — يشمل مدير قسم السيطرة وموظفي السيطرة
    const delivEl = document.getElementById('searchDeliveredByM');
    if (delivEl) {
        const cur = delivEl.value;
        delivEl.innerHTML = '<option value="">الكل</option><option value="المدير">المدير</option>';
        deliveryEmps.forEach(e => delivEl.innerHTML += `<option value="${sanitize(e.name)}">${sanitize(e.name)}</option>`);
        if (cur) delivEl.value = cur;
    }
    // بحث الاستفسارات: مسؤول الكول سنتر وموظف الكول سنتر وموظف الميديا فقط
    const inqEl = document.getElementById('searchAddedByI');
    if (inqEl) {
        const cur = inqEl.value;
        const inqEmps = employees.filter(e =>
            e.title === 'مدير الكول سنتر' ||
            e.title === 'موظف كول سنتر'   ||
            e.title === 'موظف ميديا'
        );
        inqEl.innerHTML = '<option value="">الكل</option><option value="المدير">المدير</option>';
        inqEmps.forEach(e => inqEl.innerHTML += `<option value="${sanitize(e.name)}">${sanitize(e.name)}</option>`);
        if (cur) inqEl.value = cur;
    }
    // بحث السيطرة: مدير الكول سنتر + موظف كول سنتر + موظف ميديا
    const ctrlEl = document.getElementById('searchAddedByC');
    if (ctrlEl) {
        const cur = ctrlEl.value;
        const ctrlEmps = employees.filter(e =>
            e.title === 'مدير الكول سنتر' ||
            e.title === 'موظف كول سنتر'   ||
            e.title === 'موظف ميديا'
        );
        ctrlEl.innerHTML = '<option value="">الكل</option><option value="المدير">المدير</option>';
        ctrlEmps.forEach(e => ctrlEl.innerHTML += `<option value="${sanitize(e.name)}">${sanitize(e.name)}</option>`);
        if (cur) ctrlEl.value = cur;
    }
    populateLinkedInquirySelect();
}

function populateLinkedInquirySelect() {
    const sel = document.getElementById('cLinkedInquiry'); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— بدون ربط —</option>';
    const reservedSeqs = new Set(
        db.complaints.filter(c => !c.deleted && c.linkedInqSeq).map(c => String(c.linkedInqSeq))
    );
    // إعادة الحجز: مسؤول الكول سنتر والمدير فقط
    const canReclaim = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    // حجز الجديد: مسؤول الكول سنتر وموظف الكول سنتر والمدير وموظف الميديا
    const isMediaLink = currentUser?.role === 'media';
    const canClaim    = canReclaim || currentUser?.role === 'cc_employee' || isMediaLink;
    // الميديا يرى فقط ملاحظاته هو
    // الربط بالسيطرة مسموح فقط لشكاوى نوعها مالية أو سوء تعامل (أو القديمة بدون نوع — للتوافق الخلفي)
    const _linkableCT = (ctv) => !ctv || ctv === 'مالية' || ctv === 'سوء تعامل';
    const complaints = db.inquiries.filter(x =>
        !x.deleted && x.type === 'شكوى' && _linkableCT(x.complaintType) &&
        (!isMediaLink || x.addedBy === currentUser.name)
    );
    complaints.forEach(x => {
        const seqStr     = String(x.seq);
        const isReserved = reservedSeqs.has(seqStr);
        const preview    = x.notes ? x.notes.substring(0, 25) : '...';
        if (isReserved && !canReclaim) {
            // محجوزة ولا يملك صلاحية إعادة الحجز → معطّلة
            sel.innerHTML += `<option value="${x.seq}" disabled style="color:#666">🔒 #${x.seq} — ${x.branch} — ${sanitize(x.phone)}</option>`;
        } else if (isReserved && canReclaim) {
            sel.innerHTML += `<option value="${x.seq}">🔄 (إعادة حجز) — #${x.seq} — ${x.branch} — ${sanitize(x.phone)}</option>`;
        } else if (canClaim) {
            sel.innerHTML += `<option value="${x.seq}">#${x.seq} — ${x.branch} — ${sanitize(x.phone)} — ${sanitize(preview)}</option>`;
        }
    });
    if (cur) sel.value = cur;
}

function onLinkedInquiryChange() {
    const sel = document.getElementById('cLinkedInquiry');
    const seqVal = sel.value;
    const preview = document.getElementById('linkedInqPreview');
    const previewText = document.getElementById('linkedInqPreviewText');

    const _lockStyle      = 'opacity:0.65;cursor:not-allowed;background:rgba(255,255,255,0.04);';
    const _lockWrapStyle  = 'opacity:0.65;cursor:not-allowed;pointer-events:none;';
    const _unlockStyle    = '';
    const _setLocked = (id, locked, isInput=true) => {
        const el = document.getElementById(id); if (!el) return;
        if (isInput) el.readOnly = locked; else el.disabled = locked;
        el.style.cssText = locked ? _lockStyle : _unlockStyle;
    };

    const _typeBadge = document.getElementById('cInferredTypeBadge');
    const _typeText  = document.getElementById('cInferredTypeText');

    if (!seqVal) {
        preview.style.display = 'none';
        const countryEl= document.getElementById('cCountryAdd');
        const cityEl   = document.getElementById('cCityAdd');
        const branchEl = document.getElementById('cBranchAdd');
        const phoneEl  = document.getElementById('cCustomerPhone');
        const notesEl  = document.getElementById('cNotes');
        if (countryEl){ countryEl.disabled = false; countryEl.value = ''; countryEl.style.cssText = _unlockStyle; }
        if (cityEl)   { cityEl.disabled  = false; cityEl.value   = ''; cityEl.style.cssText   = _unlockStyle; }
        if (branchEl) { branchEl.disabled= false; branchEl.innerHTML = '<option value="">الفرع</option>'; branchEl.style.cssText = _unlockStyle; }
        if (phoneEl)  { phoneEl.readOnly = false; phoneEl.value  = ''; phoneEl.style.cssText  = _unlockStyle; }
        if (notesEl)  { notesEl.readOnly = false; notesEl.value  = ''; notesEl.style.cssText  = _unlockStyle; }
        // فك قفل الحقول المالية + إخفاء صفها + إخفاء بادج النوع + مسح المرفق المنقول
        ['cMoveNumber','cInvoiceValue','cCallTimeOnly'].forEach(id => _setLocked(id, false));
        const _finRow = document.getElementById('cFinancialFieldsRow');
        if (_finRow) _finRow.style.display = 'none';
        const _mnEl = document.getElementById('cMoveNumber'); if (_mnEl) _mnEl.value = '';
        const _ivEl = document.getElementById('cInvoiceValue'); if (_ivEl) _ivEl.value = '';
        const _cd = document.getElementById('cCallDate'); if (_cd) _cd.value = '';
        const _cdDisp = document.getElementById('cCallDate-display'); if (_cdDisp) { _cdDisp.textContent = '📅 اختر التاريخ'; _cdDisp.classList.remove('selected'); }
        const _nd = document.getElementById('cNoteDate'); if (_nd) _nd.value = '';
        const _ndDisp = document.getElementById('cNoteDate-display'); if (_ndDisp) { _ndDisp.textContent = '📅 اختر التاريخ'; _ndDisp.classList.remove('selected'); }
        const _wrapCD = document.getElementById('cCallDate-display')?.closest('.date-picker-wrap');  if (_wrapCD) _wrapCD.style.cssText = _unlockStyle;
        const _wrapND = document.getElementById('cNoteDate-display')?.closest('.date-picker-wrap');  if (_wrapND) _wrapND.style.cssText = _unlockStyle;
        if (_typeBadge) _typeBadge.style.display = 'none';
        const _lblImp = document.getElementById('cFileLabel'); if (_lblImp) _lblImp.textContent = 'لم يُختر ملف';
        document.getElementById('cFile').dataset.inheritedFile = '';
        return;
    }

    const inq = db.inquiries.find(x => String(x.seq) === String(seqVal));
    if (!inq) return;

    // تعبئة الدولة وتأمينها
    const countryEl = document.getElementById('cCountryAdd');
    const inqCountry = inq.country || (typeof _countryForCity === 'function' ? _countryForCity(inq.city) : '');
    if (countryEl) {
        countryEl.value = inqCountry || '';
        if (typeof updateCities === 'function') updateCities('cCountryAdd','cCityAdd','cBranchAdd');
        countryEl.disabled = true;
        countryEl.style.cssText = _lockStyle;
    }

    // تعبئة المحافظة والفرع وتأمينهما
    const cityEl   = document.getElementById('cCityAdd');
    const branchEl = document.getElementById('cBranchAdd');
    if (cityEl) {
        cityEl.value = inq.city || '';
        cityEl.disabled = true;
        cityEl.style.cssText = _lockStyle;
        updateBranches('cCityAdd', 'cBranchAdd');
        setTimeout(() => {
            if (branchEl) {
                branchEl.value = inq.branch || '';
                branchEl.disabled = true;
                branchEl.style.cssText = _lockStyle;
            }
        }, 0);
    }

    // تعبئة رقم الهاتف وتأمينه
    const phoneEl = document.getElementById('cCustomerPhone');
    if (phoneEl) { phoneEl.value = inq.phone || ''; phoneEl.readOnly = true; phoneEl.style.cssText = _lockStyle; }

    // تعبئة نص الشكوى وتأمينه
    const notesEl = document.getElementById('cNotes');
    if (notesEl) { notesEl.value = inq.notes || ''; notesEl.readOnly = true; notesEl.style.cssText = _lockStyle; }

    // تعبئة وقت تلقي الاتصال (وقت إضافة الاستفسار الفعلي) وتأمينه
    // ملاحظة: inq.iso = تاريخ فقط؛ نستخدم inq.id (Date.now() عند الإضافة) للوقت الدقيق
    try {
        const _ts = inq.id || (inq.iso ? Date.parse(inq.iso) : Date.now());
        const d = new Date(_ts);
        const _datePart = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const _timePart = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        if (typeof setDatePickerValue === 'function') setDatePickerValue('cCallDate', _datePart);
        else { const _cd = document.getElementById('cCallDate'); if (_cd) _cd.value = _datePart; }
        const _t = document.getElementById('cCallTimeOnly'); if (_t) _t.value = _timePart;
    } catch(e) {}
    const _wrapCD = document.getElementById('cCallDate-display')?.closest('.date-picker-wrap');
    if (_wrapCD) _wrapCD.style.cssText = _lockWrapStyle;
    _setLocked('cCallTimeOnly', true);

    // تعبئة الحقول المالية (إن وجدت) وتأمينها — تظهر فقط عند نوع "مالية"
    const isFin = (inq.complaintType === 'مالية');
    const _ndEl = document.getElementById('cNoteDate');
    if (_ndEl && inq.noteDate) {
        if (typeof setDatePickerValue === 'function') setDatePickerValue('cNoteDate', inq.noteDate);
        else _ndEl.value = inq.noteDate;
    } else if (_ndEl) {
        _ndEl.value = '';
        const _ndDisp = document.getElementById('cNoteDate-display'); if (_ndDisp) { _ndDisp.textContent = '📅 اختر التاريخ'; _ndDisp.classList.remove('selected'); }
    }
    const _wrapND = document.getElementById('cNoteDate-display')?.closest('.date-picker-wrap');
    if (_wrapND) _wrapND.style.cssText = isFin ? _lockWrapStyle : _unlockStyle;
    // إظهار/إخفاء صف "رقم الحركة + قيمة الفاتورة" حسب نوع الشكوى
    const _finRow = document.getElementById('cFinancialFieldsRow');
    if (_finRow) _finRow.style.display = isFin ? 'grid' : 'none';
    const _mn = document.getElementById('cMoveNumber');
    if (_mn) {
        _mn.value = isFin ? (inq.moveNumber || '') : '';
        _mn.readOnly = isFin;
        _mn.style.cssText = isFin ? _lockStyle : _unlockStyle;
    }
    const _iv = document.getElementById('cInvoiceValue');
    if (_iv) {
        _iv.value = isFin ? (inq.invoiceValue || '') : '';
        _iv.readOnly = isFin;
        _iv.style.cssText = isFin ? _lockStyle : _unlockStyle;
    }

    // عرض بادج نوع الشكوى المستنبط
    if (_typeBadge && _typeText) {
        const _ct = inq.complaintType || 'أخرى';
        _typeText.textContent = _ct;
        _typeBadge.style.display = '';
    }

    // نقل المرفق من الاستفسار إلى الشكوى (إن وُجد)
    const _fileInputEl = document.getElementById('cFile');
    const _lbl = document.getElementById('cFileLabel');
    if (inq.file) {
        if (_fileInputEl) _fileInputEl.dataset.inheritedFile = inq.file;
        if (_lbl) _lbl.textContent = '📎 مرفق من الاستفسار (سيُنقل تلقائياً)';
    } else {
        if (_fileInputEl) _fileInputEl.dataset.inheritedFile = '';
        if (_lbl) _lbl.textContent = 'لم يُختر ملف';
    }

    preview.style.display = 'block';
    previewText.textContent = `مرتبط بالاستفسار #${inq.seq} — ${inq.branch} — ${inq.phone}${inq.notes ? ' — ' + inq.notes.substring(0,40) : ''}${inq.complaintType ? ' — ' + inq.complaintType : ''}`;
}
