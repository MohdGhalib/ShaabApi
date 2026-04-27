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
const _PAGE_SIZE = 10;

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

function switchTab(t) {
    // تحديد الـ active لجميع التبويبات العادية
    ['o','i','cu','b','e','s','f','p','h','l','t'].forEach(id => {
        const btn = document.getElementById(`tab-${id}`);
        if (btn) btn.classList.toggle('active', t === id);
    });

    // tab-m-sub: active عند 'm' — tab-m الأب: group-active عند 'm' أو 'o'
    document.getElementById('tab-m-sub')?.classList.toggle('active', t === 'm');
    const tabM = document.getElementById('tab-m');
    if (tabM) { tabM.classList.remove('active'); tabM.classList.toggle('group-active', t === 'm' || t === 'o'); }

    // tab-c-sub: active عند 'c' — tab-c الأب: group-active عند 'c' أو 'cu'
    document.getElementById('tab-c-sub')?.classList.toggle('active', t === 'c');
    const tabC = document.getElementById('tab-c');
    if (tabC) { tabC.classList.remove('active'); tabC.classList.toggle('group-active', t === 'c' || t === 'cu'); }

    // فتح/إغلاق القوائم الفرعية
    const grpM = document.getElementById('nav-group-m');
    if (grpM) grpM.classList.toggle('open', t === 'm' || t === 'o');
    const grpC = document.getElementById('nav-group-c');
    if (grpC) grpC.classList.toggle('open', t === 'c' || t === 'cu');

    // فتح/إغلاق مجموعة الموظفين
    const grpE = document.getElementById('nav-group-e');
    if (grpE) grpE.classList.toggle('open', ['b','e','s'].includes(t));
    const tabEGroup = document.getElementById('tab-emp-group');
    if (tabEGroup) tabEGroup.classList.toggle('group-active', ['b','e','s'].includes(t));

    // تسجيل وقت المشاهدة وإخفاء الشارة عند فتح التبويب
    _activeTab = t;
    if (['m','o','c','cu','i'].includes(t)) {
        _markTabSeen(t === 'o' ? 'm' : t === 'cu' ? 'c' : t);
    }
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
    } else if (t === 'cu') {
        if (typeof renderControlOpen === 'function') renderControlOpen();
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
    const citySelects = ['mCityAdd','iCityAdd','cCityAdd','searchCityM','searchCityC','searchCityO','searchCityI','branchCitySearch','searchCityCU'];
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
    // حجز الجديد: مسؤول الكول سنتر وموظف الكول سنتر والمدير
    const canClaim   = canReclaim || currentUser?.role === 'cc_employee';
    const complaints = db.inquiries.filter(x => !x.deleted && x.type === 'شكوى');
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
