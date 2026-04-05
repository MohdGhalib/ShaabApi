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
const _pg = { M:1, I:1, C:1, O:1 };
const _PAGE_SIZE = 50;

function changePage(table, dir) {
    _pg[table] = Math.max(1, (_pg[table] || 1) + dir);
    renderAll();
}

function _paginationBar(table, total, currentPage) {
    const pages = Math.max(1, Math.ceil(total / _PAGE_SIZE));
    if (pages <= 1) return '';
    const cp = Math.min(currentPage, pages);
    return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px;flex-wrap:wrap;">
        <button onclick="changePage('${table}',-1)" ${cp<=1?'disabled':''} style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';">◄ السابق</button>
        <span style="font-size:13px;color:var(--text-dim);">صفحة <b style="color:var(--text-main);">${cp}</b> من <b style="color:var(--text-main);">${pages}</b> (${total} عنصر)</span>
        <button onclick="changePage('${table}',1)" ${cp>=pages?'disabled':''} style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';">التالي ►</button>
    </div>`;
}

/* ── شارات الأرقام على التبويبات ── */
function _updateBadges() {
    const pendingM = (db.montasiat  || []).filter(x => !x.deleted && x.status === 'قيد الانتظار').length;
    const noAuditC = (db.complaints || []).filter(x => !x.deleted && x.status === 'تمت الموافقة' && !x.audit).length;
    const todayI   = (db.inquiries  || []).filter(x => !x.deleted && x.iso && x.iso.startsWith(iso())).length;

    const set = (id, count) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = count > 0 ? count : '';
        el.style.display = count > 0 ? '' : 'none';
    };
    set('badge-m', pendingM);
    set('badge-c', noAuditC);
    set('badge-i', todayI);
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
    const isOpen = grpM && grpM.classList.contains('open');
    if (isOpen) {
        // القائمة مفتوحة → أغلقها فقط بدون تغيير التبويب
        grpM.classList.remove('open');
        const tabM = document.getElementById('tab-m');
        if (tabM) { tabM.classList.remove('group-active'); tabM.classList.add('active'); }
    } else {
        // القائمة مغلقة → افتح وانتقل للتبويب
        const bm = document.getElementById('badge-m');
        if (bm) { bm.textContent = ''; bm.style.display = 'none'; }
        switchTab('m');
    }
}

function switchTab(t) {
    ['m','o','i','c','b','e','s','f','p','h','l','t'].forEach(id => {
        const btn = document.getElementById(`tab-${id}`);
        if (btn) btn.classList.toggle('active', t === id);
        // القائمة الفرعية: nav-sub-item تأخذ .active بدل .nav-item
        if (btn && btn.classList.contains('nav-sub-item')) {
            btn.classList.toggle('active', t === id);
        }
    });

    // فتح/إغلاق القائمة الفرعية لنظام المنتسيات
    const grpM = document.getElementById('nav-group-m');
    if (grpM) grpM.classList.toggle('open', t === 'm' || t === 'o');

    // تمييز زر الأب عند تفعيل إحدى فروع المنتسيات
    const tabM = document.getElementById('tab-m');
    if (tabM) tabM.classList.toggle('group-active', t === 'o');

    // فتح/إغلاق مجموعة الموظفين
    const grpE = document.getElementById('nav-group-e');
    if (grpE) grpE.classList.toggle('open', ['b','e','s'].includes(t));
    const tabEGroup = document.getElementById('tab-emp-group');
    if (tabEGroup) tabEGroup.classList.toggle('group-active', ['b','e','s'].includes(t));

    // إخفاء شارة الإشعار عند فتح التبويب
    const badge = document.getElementById(`badge-${t}`);
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }

    document.getElementById('page-container').innerHTML = PAGES[t] || '';

    setupCitySelects();

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
    } else if (t === 't') {
        if (typeof renderTrash === 'function') renderTrash();
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

    // إخفاء ربط الاستفسار عند موظف الميديا
    if (t === 'c' && currentUser?.role === 'media') {
        const linkRow = document.getElementById('cLinkedInquiryRow');
        if (linkRow) linkRow.style.display = 'none';
    }

    // تهيئة حقول الوقت عند فتح تبويب السيطرة
    if (t === 'c') {
        const _d = new Date();
        const _hh = String(_d.getHours()).padStart(2,'0'), _mm = String(_d.getMinutes()).padStart(2,'0');
        setDatePickerValue('cCallDate', iso());
        const _tEl = document.getElementById('cCallTimeOnly'); if (_tEl) _tEl.value = `${_hh}:${_mm}`;
        setDatePickerValue('cNoteDate', iso());
    }
}

function init() {
    if (perm('viewStats'))    document.getElementById('tab-s').classList.remove('hidden');
    if (perm('viewBranches')) document.getElementById('tab-f').classList.remove('hidden');
    if (!perm('addEmp'))      document.getElementById('tab-e').classList.add('hidden');
    if (!perm('viewBreak'))   document.getElementById('tab-b').classList.add('hidden');
    const role = currentUser?.role;
    let _startTab;
    if (role === 'media' || role === 'control_employee' || role === 'control_sub') {
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
    const citySelects = ['mCityAdd','iCityAdd','cCityAdd','searchCityM','searchCityC','searchCityO','searchCityI','branchCitySearch'];
    let options = '';
    for (let c in branches) options += `<option value="${c}">${c}</option>`;
    citySelects.forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = (id.startsWith('search') ? '<option value="">الكل</option>' : '<option value="">اختيار المحافظة</option>') + options;
    });
    // خيار "غير محدد" لقائمة الاستفسارات فقط — يُضاف بعد التحميل
    setTimeout(() => toggleUnspecifiedBranch(), 0);
}

function updateBranches(cityId, branchId) {
    const city = document.getElementById(cityId).value;
    if (city === 'غير محدد') {
        document.getElementById(branchId).innerHTML = '<option value="غير محدد">غير محدد</option>';
        return;
    }
    let html = cityId.includes('search') ? '<option value="">الكل</option>' : '<option value="">الفرع</option>';
    if (city && branches[city]) branches[city].forEach(b => html += `<option value="${b}">${b}</option>`);
    document.getElementById(branchId).innerHTML = html;
}

function populateEmployeeDropdowns() {
    const nonMediaEmps = employees.filter(e => e.title !== 'موظف ميديا' && e.title !== 'مدير قسم السيطرة' && e.title !== 'موظف سيطرة');
    ['searchAddedByM','searchDeliveredByM','searchAddedByO','searchAddedByI'].forEach(id => {
        const el = document.getElementById(id); if (!el) return;
        const cur = el.value;
        el.innerHTML = '<option value="">الكل</option><option value="المدير">المدير</option>';
        nonMediaEmps.forEach(e => el.innerHTML += `<option value="${sanitize(e.name)}">${sanitize(e.name)}</option>`);
        if (cur) el.value = cur;
    });
    populateLinkedInquirySelect();
}

function populateLinkedInquirySelect() {
    const sel = document.getElementById('cLinkedInquiry'); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— بدون ربط —</option>';
    const reservedSeqs = new Set(
        db.complaints.filter(c => !c.deleted && c.linkedInqSeq).map(c => String(c.linkedInqSeq))
    );
    const complaints = db.inquiries.filter(x => !x.deleted && x.type === 'شكوى');
    complaints.forEach(x => {
        const seqStr = String(x.seq);
        const isReserved = reservedSeqs.has(seqStr);
        const preview = x.notes ? x.notes.substring(0, 25) : '...';
        const label = isReserved
            ? `🔒 محجوزة — #${x.seq} — ${x.branch} — ${sanitize(x.phone)}`
            : `#${x.seq} — ${x.branch} — ${sanitize(x.phone)} — ${sanitize(preview)}`;
        sel.innerHTML += `<option value="${x.seq}" ${isReserved ? 'disabled style="color:#666"' : ''}>${label}</option>`;
    });
    if (cur && !reservedSeqs.has(String(cur))) sel.value = cur;
}

function onLinkedInquiryChange() {
    const sel = document.getElementById('cLinkedInquiry');
    const seqVal = sel.value;
    const preview = document.getElementById('linkedInqPreview');
    const previewText = document.getElementById('linkedInqPreviewText');

    if (!seqVal) {
        preview.style.display = 'none';
        // إعادة تفعيل جميع الحقول وتفريغها
        const cityEl   = document.getElementById('cCityAdd');
        const branchEl = document.getElementById('cBranchAdd');
        const phoneEl  = document.getElementById('cCustomerPhone');
        const notesEl  = document.getElementById('cNotes');
        if (cityEl)   { cityEl.disabled   = false; cityEl.value   = ''; }
        if (branchEl) { branchEl.disabled = false; branchEl.innerHTML = '<option value="">الفرع</option>'; }
        if (phoneEl)  { phoneEl.readOnly  = false; phoneEl.value  = ''; }
        if (notesEl)  { notesEl.readOnly  = false; notesEl.value  = ''; }
        return;
    }

    const inq = db.inquiries.find(x => String(x.seq) === String(seqVal));
    if (!inq) return;

    // تعبئة المحافظة والفرع وجعلهما غير قابلَين للتعديل
    const cityEl   = document.getElementById('cCityAdd');
    const branchEl = document.getElementById('cBranchAdd');
    if (cityEl) {
        cityEl.value = inq.city || '';
        cityEl.disabled = true;
        updateBranches('cCityAdd', 'cBranchAdd');
        setTimeout(() => { if (branchEl) { branchEl.value = inq.branch || ''; branchEl.disabled = true; } }, 0);
    }

    // تعبئة رقم الهاتف وجعله غير قابل للتعديل
    const phoneEl = document.getElementById('cCustomerPhone');
    if (phoneEl) { phoneEl.value = inq.phone || ''; phoneEl.readOnly = true; }

    // تعبئة نص الشكوى وجعله غير قابل للتعديل
    const notesEl = document.getElementById('cNotes');
    if (notesEl) { notesEl.value = inq.notes || ''; notesEl.readOnly = true; }

    preview.style.display = 'block';
    previewText.textContent = `مرتبط بالاستفسار #${inq.seq} — ${inq.branch} — ${inq.phone}${inq.notes ? ' — ' + inq.notes.substring(0,40) : ''}`;
}
