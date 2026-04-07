/* ══════════════════════════════════════════════════════
   RENDER — Filter & render all tables
══════════════════════════════════════════════════════ */
function filterTable() {
    // إعادة ضبط الصفحة عند تغيير الفلتر
    if (typeof _pg !== 'undefined') { _pg.M = 1; _pg.O = 1; _pg.I = 1; _pg.C = 1; }
    renderAll();
}

/* ── مساعد: تنسيق وقت الاتصال ── */
function _formatCallTime(callTime) {
    try {
        const d = new Date(callTime);
        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} — ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch(e) { return callTime; }
}

/* ── خيارات حالة الملاحظة المشتركة ── */
const _AUDIT_STATUS_OPTIONS = [
    'مكتوبة','غير مكتوبة',
    'المتابعة مع الشفت الصباحي','المتابعة مع الشفت المسائي',
    'المراقب بريك','لا يوجد مراقب','غير واضحة للمراقب'
];
function _auditStatusSelect(id, prefix='auditStatus') {
    return `<select id="${prefix}-${id}" style="width:100%;margin-bottom:10px;">
        <option value="">— اختر الحالة —</option>
        ${_AUDIT_STATUS_OPTIONS.map(o => `<option value="${o}">${o}</option>`).join('')}
    </select>`;
}
function _auditStatusSelectWithSelected(id, prefix, selectedVal) {
    return `<select id="${prefix}-${id}" style="width:100%;margin-bottom:10px;">
        <option value="">— اختر الحالة —</option>
        ${_AUDIT_STATUS_OPTIONS.map(o => `<option value="${o}"${selectedVal===o?' selected':''}>${o}</option>`).join('')}
    </select>`;
}

/* ── مساعد: بناء صندوق التدقيق لجدول السيطرة ── */
function _buildAuditHtml(x, isControl, isControlEmployee, isControlSub, controlEmps, auditStatusBadge) {
    if (isControlSub) {
        if (x.controlSubReply && !x.controlSubReplyReturned) {
            return `<div class="final-audit-text" style="background:rgba(106,27,154,0.1);border-color:rgba(156,39,176,0.3);color:#ce93d8;">
                ردك: ${sanitize(x.controlSubReply)}
                <span class="status-badge awaiting" style="margin-right:8px;font-size:10px;">بانتظار موافقة مدير السيطرة</span>
            </div>`;
        }
        return `<div class="audit-box" style="border-right-color:#9c27b0;">
            <label style="display:block;margin-bottom:5px;text-align:right;color:#ce93d8;">حالة الملاحظة: <span style="color:var(--accent-red);">*</span></label>
            ${_auditStatusSelect(x.id, 'subReplyStatus')}
            <label style="display:block;margin-bottom:5px;text-align:right;color:#ce93d8;">📝 ردك على الشكوى:</label>
            <textarea id="subReply-${x.id}" rows="2" placeholder="اكتب ردك هنا...">${x.controlSubReply||''}</textarea>
            <button class="btn btn-main" style="width:100%;margin-top:10px;font-size:12px;padding:8px;background:#7b1fa2;" onclick="saveControlSubReply(${x.id})">إرسال الرد</button>
        </div>`;
    }

    if (isControl || isControlEmployee) {
        if (x.audit) {
            if (isControl) {
                const sc = x.auditStatus === 'مكتوبة'
                    ? { bg:'rgba(46,125,50,0.15)', border:'rgba(46,125,50,0.4)', color:'#81c784' }
                    : x.auditStatus === 'غير مكتوبة'
                    ? { bg:'rgba(198,40,40,0.15)', border:'rgba(198,40,40,0.4)', color:'#ef9a9a' }
                    : { bg:'rgba(21,101,192,0.15)', border:'rgba(21,101,192,0.4)', color:'#90caf9' };
                return `<div class="final-audit-text">
                    رد قسم السيطرة: ${sanitize(x.audit)}
                    <div style="margin-top:10px;padding:10px 14px;border-radius:10px;border:1px solid ${sc.border};background:${sc.bg};display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <div>
                            <span style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:2px;">حالة الملاحظة</span>
                            <span style="font-size:15px;font-weight:800;color:${sc.color};">${sanitize(x.auditStatus||'—')}</span>
                        </div>
                        <button class="btn-edit-sm" onclick="toggleAuditStatusEdit(${x.id})">✏️ تعديل الحالة</button>
                    </div>
                    <div id="auditStatusEditBox-${x.id}" style="display:none;margin-top:8px;">
                        ${_auditStatusSelectWithSelected(x.id, 'auditStatusEdit', x.auditStatus)}
                        <button class="btn btn-main" style="width:100%;padding:8px;font-size:12px;" onclick="saveAuditStatusEdit(${x.id})">حفظ الحالة</button>
                    </div>
                </div>`;
            }
            return `<div class="final-audit-text">رد قسم السيطرة: ${sanitize(x.audit)} ${auditStatusBadge}</div>`;
        }

        if (isControlEmployee && x.controlSubReply && !x.controlSubReplyApproved) {
            return `<div class="audit-box" style="border-right-color:#9c27b0;">
                <div style="font-size:12px;color:#ce93d8;font-weight:700;margin-bottom:8px;">💬 رد موظف السيطرة (${sanitize(x.assignedToSubName||'')})</div>
                <div style="background:rgba(156,39,176,0.08);border:1px solid rgba(156,39,176,0.2);border-radius:8px;padding:10px;margin-bottom:10px;font-size:13px;color:var(--text-main);">${sanitize(x.controlSubReply)}${x.controlSubReplyStatus?`<span class="emp-badge" style="margin-right:8px;font-size:11px;background:rgba(21,101,192,0.2);color:#90caf9;">${sanitize(x.controlSubReplyStatus)}</span>`:''}</div>
                <div id="subReplyEditBox-${x.id}" style="display:none;margin-bottom:10px;">
                    <textarea id="subReplyEdit-${x.id}" rows="2" style="width:100%;margin-bottom:6px;">${sanitize(x.controlSubReply)}</textarea>
                    <button class="btn btn-main" style="width:100%;padding:6px;font-size:12px;" onclick="saveControlSubReplyEdit(${x.id})">حفظ التعديل</button>
                </div>
                <label style="display:block;margin-bottom:5px;text-align:right;">حالة الملاحظة: <span style="color:var(--accent-red);">*</span></label>
                ${_auditStatusSelect(x.id, 'approveSubStatus')}
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-main" style="flex:1;min-width:100px;padding:8px;font-size:12px;background:#2e7d32;" onclick="approveControlSubReply(${x.id})">✅ موافقة وإرسال</button>
                    <button class="btn-edit-sm" onclick="var b=document.getElementById('subReplyEditBox-${x.id}');b.style.display=b.style.display==='none'?'block':'none'">✏️ تعديل</button>
                    <button class="btn-return" onclick="returnControlSubReply(${x.id})">↩ إرجاع</button>
                    <button class="btn-delete-sm" onclick="deleteControlSubReply(${x.id})">🗑 حذف</button>
                </div>
            </div>`;
        }

        if (isControlEmployee && x.assignedToSubId && !x.controlSubReply) {
            return `<div style="margin-top:8px;padding:10px 14px;background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.25);border-radius:10px;font-size:12px;color:#ffb74d;">
                ⏳ تم الإرسال لـ <b>${sanitize(x.assignedToSubName)}</b> — بانتظار الرد
            </div>`;
        }

        if (isControl && x.controlEmpReply && !x.controlEmpReplyApproved) {
            return `<div class="audit-box" style="border-right-color:#9c27b0;">
                <div style="font-size:12px;color:#ce93d8;font-weight:700;margin-bottom:8px;">💬 رد مدير قسم السيطرة (${sanitize(x.assignedToName||'')})</div>
                <div style="background:rgba(156,39,176,0.08);border:1px solid rgba(156,39,176,0.2);border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;color:var(--text-main);">${sanitize(x.controlEmpReply)}</div>
                <label style="display:block;margin-bottom:5px;text-align:right;">حالة الملاحظة: <span style="color:var(--accent-red);">*</span></label>
                ${_auditStatusSelect(x.id, 'approveAuditStatus')}
                <button class="btn btn-main" style="width:100%;padding:8px;font-size:12px;background:#2e7d32;" onclick="approveControlEmpReply(${x.id})">✅ موافقة على الرد وإرساله</button>
            </div>`;
        }

        if (isControl && x.assignedToEmpId && !x.controlEmpReply) {
            return `<div style="margin-top:8px;padding:10px 14px;background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.25);border-radius:10px;font-size:12px;color:#ffb74d;">
                ⏳ تم الإرسال لـ <b>${sanitize(x.assignedToName)}</b> — بانتظار الرد
            </div>`;
        }

        const empOptions = controlEmps.map(e => `<option value="${e.empId}">${e.name}</option>`).join('');
        if (isControlEmployee) {
            return `<div class="audit-box">
                <label style="display:block;margin-bottom:5px;text-align:right;">حالة الملاحظة: <span style="color:var(--accent-red);">*</span></label>
                ${_auditStatusSelect(x.id, 'auditStatus')}
                <label style="display:block;margin-bottom:5px;text-align:right;">رد قسم السيطرة:</label>
                <textarea id="audit-${x.id}" rows="2" placeholder="اكتب الرد هنا..."></textarea>
                <button class="btn btn-main" style="width:100%;margin-top:10px;font-size:12px;padding:8px;" onclick="saveAudit(${x.id})">إرسال الرد</button>
                ${empOptions ? `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
                    <label style="display:block;margin-bottom:5px;text-align:right;color:#ffb74d;font-size:12px;">📤 أو إرسال لموظف السيطرة للمتابعة:</label>
                    <div style="display:flex;gap:8px;">
                        <select id="assignSub-${x.id}" style="flex:1;"><option value="">اختر موظف</option>${empOptions}</select>
                        <button class="btn-approve" style="white-space:nowrap;" onclick="assignToControlSub(${x.id})">إرسال</button>
                    </div>
                </div>` : ''}
            </div>`;
        }
        return `<div class="audit-box">
            <label style="display:block;margin-bottom:5px;text-align:right;">حالة الملاحظة: <span style="color:var(--accent-red);">*</span></label>
            ${_auditStatusSelect(x.id, 'auditStatus')}
            <label style="display:block;margin-bottom:5px;text-align:right;">رد قسم السيطرة:</label>
            <textarea id="audit-${x.id}" rows="2" placeholder="اكتب الرد هنا..."></textarea>
            <button class="btn btn-main" style="width:100%;margin-top:10px;font-size:12px;padding:8px;" onclick="saveAudit(${x.id})">إرسال الرد</button>
            ${empOptions ? `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
                <label style="display:block;margin-bottom:5px;text-align:right;color:#ffb74d;font-size:12px;">📤 أو إرسال لمدير قسم السيطرة للمتابعة:</label>
                <div style="display:flex;gap:8px;">
                    <select id="assignEmp-${x.id}" style="flex:1;"><option value="">اختر موظف</option>${empOptions}</select>
                    <button class="btn-approve" style="white-space:nowrap;" onclick="assignToControlEmployee(${x.id})">إرسال</button>
                </div>
            </div>` : ''}
        </div>`;
    }

    if (x.audit) {
        return `<div class="final-audit-text" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;">
            <div>رد قسم السيطرة: ${sanitize(x.audit)} ${auditStatusBadge}</div>
            <button class="btn-notify" onclick="openNotifyModal(${x.id})">📣 تبليغ</button>
        </div>`;
    }
    return '';
}

function resetSearch(t) {
    const clear = (ids) => ids.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const clearDate = (fieldId) => {
        const el=document.getElementById(fieldId); if(el) el.value='';
        const disp=document.getElementById(fieldId+'-display'); if(disp){ disp.textContent='📅 اختر التاريخ'; disp.classList.remove('selected'); }
    };
    if (t==='M') {
        clear(['searchCityM','searchTextM','searchAddedByM','searchDeliveredByM','searchTypeM']);
        document.getElementById('searchBranchM').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateM');
        _pg.M = 1;
    } else if (t==='O') {
        clear(['searchCityO','searchTextO','searchAddedByO','searchTypeO']);
        document.getElementById('searchBranchO').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateO');
        _pg.O = 1;
    } else if (t==='I') {
        clear(['searchCityI','searchAddedByI','searchTypeI']);
        document.getElementById('searchBranchI').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateI');
        _pg.I = 1;
    } else if (t==='C') {
        clear(['searchCityC','searchTextC']);
        document.getElementById('searchBranchC').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateC');
        _pg.C = 1;
    }
    renderAll();
}

function _renderTableM(get, isAdmin) {
    const addMontasiaCard = document.getElementById('addMontasiaCard');
    if (addMontasiaCard) addMontasiaCard.style.display = (currentUser?.role === 'control_employee') ? 'none' : '';
    const tbodyM = document.querySelector("#tableM tbody");
    if (!tbodyM) return;

    const canDelete = perm('deleteM');
    const mBar = document.getElementById('mExportImportBar');
    if (mBar) mBar.style.display = canDelete ? '' : 'none';

    const f = {
        city:        get("searchCityM"),
        branch:      get("searchBranchM"),
        date:        get("searchDateM"),
        text:        get("searchTextM").toLowerCase(),
        addedBy:     get("searchAddedByM"),
        deliveredBy: get("searchDeliveredByM"),
        type:        get("searchTypeM")
    };
    // فلتر الفرع لموظف/مدير الفرع ومدير المنطقة
    const _myRole = currentUser?.role;
    let _branchFilter = null;
    if (_myRole === 'branch_employee' || _myRole === 'branch_manager') {
        const _me = employees.find(e => e.empId === currentUser?.empId);
        if (_me?.assignedBranch) _branchFilter = { type:'single', branch:_me.assignedBranch.branch };
    } else if (_myRole === 'area_manager') {
        const _me = employees.find(e => e.empId === currentUser?.empId);
        if (_me?.assignedBranches?.length) _branchFilter = { type:'multi', branches:_me.assignedBranches.map(b=>b.branch) };
    }

    const allRows = db.montasiat.filter(x =>
        !x.deleted &&
        (!_branchFilter || (_branchFilter.type==='single' ? x.branch===_branchFilter.branch : _branchFilter.branches.includes(x.branch))) &&
        (!f.city        || x.city===f.city) &&
        (!f.branch      || x.branch===f.branch) &&
        (!f.date        || x.iso.startsWith(f.date)) &&
        (!f.text        || x.notes.toLowerCase().includes(f.text)) &&
        (!f.addedBy     || (x.addedBy||'').includes(f.addedBy)) &&
        (!f.deliveredBy || (x.deliveredBy||'').includes(f.deliveredBy)) &&
        (!f.type        || (x.type||'')=== f.type)
    );
    if (!_pg.M) _pg.M = 1;
    const _pageM = Math.min(_pg.M, Math.max(1, Math.ceil(allRows.length / _PAGE_SIZE)));
    _pg.M = _pageM;
    const rows = allRows.slice((_pageM - 1) * _PAGE_SIZE, _pageM * _PAGE_SIZE);
    tbodyM.innerHTML = rows.map(x => {
        const statusClass = x.status==='تم التسليم' ? 'done'
            : x.status==='مرفوضة'         ? 'rejected'
            : x.status==='بانتظار الموافقة' ? 'awaiting'
            : x.status==='قيد الاستلام'   ? 'mobile-pending'
            : x.status==='تمت الموافقة'   ? 'mob-approved'
            : 'pending';
        let actions = '';
        if (perm('approveM') && x.status==='بانتظار الموافقة') actions += `<button class="btn-approve" onclick="approveMontasia(${x.id})">✓ موافقة</button>`;
        // الموافقة على منتسيات التطبيق (قيد الاستلام) — مدير أو موظف كول سنتر
        if ((perm('deliverM') || currentUser?.isAdmin) && x.status==='قيد الاستلام') actions += `<button class="btn-approve" onclick="approveMontasiaFromMobile(${x.id})">✓ موافقة</button>`;
        if (perm('editM'))   actions += `<button class="btn-edit-sm" onclick="startEditMontasia(${x.id})">✏️ تعديل</button>`;
        if (perm('deliverM') && x.status==='قيد الانتظار') actions += `<button class="btn-deliver" onclick="deliver(${x.id})" style="margin:2px">تسليم</button>`;
        if (perm('rejectM')  && (x.status==='قيد الانتظار'||x.status==='بانتظار الموافقة'||x.status==='قيد الاستلام')) actions += `<button class="btn-reject" onclick="rejectMontasia(${x.id})">رفض</button>`;
        if (canDelete) actions += `<button class="btn-delete-sm" onclick="deleteMontasia(${x.id})">🗑</button>`;
        const editBox = perm('editM') ? `
            <div class="inline-edit-box" id="edit-${x.id}" style="display:none;">
                <textarea id="editText-${x.id}" rows="2" style="margin-bottom:8px;">${sanitize(x.notes)}</textarea>
                <button class="btn-main btn" style="width:100%;padding:8px;font-size:12px;" onclick="saveEditMontasia(${x.id})">حفظ التعديل</button>
            </div>` : '';
        const deliveryBranchNote = x.deliveryBranch
            ? `<div class="added-by" style="color:#64b5f6;">🔀 سُلِّم لـ: ${sanitize(x.deliveryBranch)} — ${sanitize(x.deliveryCity)}</div>` : '';
        const deliveredRow = x.deliveredBy
            ? `<div class="added-by">📦 سلّمه: ${sanitize(x.deliveredBy)}</div>${deliveryBranchNote}` : '';
        const deliveryTimeBox = x.dt
            ? `<div style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;
                           padding:4px 9px;border-radius:8px;
                           background:rgba(46,125,50,0.12);border:1px solid rgba(46,125,50,0.3);">
                   <span style="font-size:11px;color:#a5d6a7;font-family:monospace;">⏱ ${_toLatinDigits(x.dt)}</span>
               </div>`
            : '';
        const typeLabel = x.type==='نقدي'
            ? `<span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(255,193,7,0.15);color:#ffd54f;">نقدي</span>`
            : x.type==='أخرى'
            ? `<span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(100,181,246,0.15);color:#90caf9;">أخرى</span>`
            : `<span style="color:var(--text-dim);font-size:12px;">—</span>`;
        const photoCell = x.photoBase64
            ? `<div style="margin-top:6px;">
                   <img src="data:image/jpeg;base64,${x.photoBase64}"
                        style="max-width:90px;max-height:70px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);"
                        onclick="_showPhoto('${x.id}')" title="عرض الصورة"/>
               </div>` : '';
        const mobileTag = x.source==='mobile'
            ? `<span style="padding:1px 6px;border-radius:5px;font-size:10px;background:rgba(255,152,0,0.15);color:#ffb74d;margin-right:4px;">📱</span>` : '';
        const approvedByRow = x.approvedBy
            ? `<div class="added-by">✓ وافق: ${sanitize(x.approvedBy)}</div>` : '';
        return `<tr data-id="${x.id}">
            <td><b>${x.branch}</b><br><small>${x.city}</small>${mobileTag}</td>
            <td style="text-align:center;">${typeLabel}</td>
            <td><span class="text-box-cell">${sanitize(x.notes)}</span>${photoCell}${editBox}</td>
            <td><div class="added-by" style="font-size:12px;color:var(--text-main);">📥 ${sanitize(x.addedBy||'—')}</div>${deliveredRow}${approvedByRow}</td>
            <td style="vertical-align:top;">
                <span class="status-badge ${statusClass}">${x.status}${x.status==='تم التسليم' && x.deliveredBy ? ' بواسطة '+sanitize(x.deliveredBy) : ''}</span>
                ${deliveryTimeBox}
            </td>
            <td><small>${_toLatinDigits(x.time)}</small></td>
            <td>${actions}</td>
        </tr>`;
    }).join('');

    // شريط الترقيم لجدول م
    const mPagBar = document.getElementById('paginationM');
    if (mPagBar) mPagBar.innerHTML = _paginationBar('M', allRows.length, _pageM);

}

function _renderTableO(get) {
    const tbodyO = document.querySelector("#tableO tbody");
    if (!tbodyO) return;

    const f = {
        city:    get("searchCityO"),
        branch:  get("searchBranchO"),
        date:    get("searchDateO"),
        text:    get("searchTextO").toLowerCase(),
        addedBy: get("searchAddedByO"),
        type:    get("searchTypeO")
    };
    const allRowsO = db.montasiat.filter(x =>
        !x.deleted &&
        (x.status==='قيد الانتظار' || x.status==='بانتظار الموافقة' || x.status==='قيد الاستلام') &&
        (!f.city    || x.city===f.city) &&
        (!f.branch  || x.branch===f.branch) &&
        (!f.date    || x.iso.startsWith(f.date)) &&
        (!f.text    || x.notes.toLowerCase().includes(f.text)) &&
        (!f.addedBy || (x.addedBy||'').includes(f.addedBy)) &&
        (!f.type    || (x.type||'')=== f.type)
    );
    if (!_pg.O) _pg.O = 1;
    const _pageO = Math.min(_pg.O, Math.max(1, Math.ceil(allRowsO.length / _PAGE_SIZE)));
    _pg.O = _pageO;
    const rows = allRowsO.slice((_pageO - 1) * _PAGE_SIZE, _pageO * _PAGE_SIZE);
    tbodyO.innerHTML = rows.map(x => {
        let actionBtn = '—';
        if (x.status==='بانتظار الموافقة' && perm('approveM'))
            actionBtn = `<button class="btn-approve" onclick="approveMontasia(${x.id})">✓ موافقة</button>`;
        else if (x.status==='قيد الاستلام' && (perm('deliverM') || currentUser?.isAdmin))
            actionBtn = `<button class="btn-approve" onclick="approveMontasiaFromMobile(${x.id})">✓ موافقة</button>`;
        else if (x.status==='قيد الانتظار' && perm('deliverM'))
            actionBtn = `<button class="btn-deliver" onclick="deliver(${x.id})">تسليم</button>`;
        const statusDot = x.status==='بانتظار الموافقة'
            ? `<span class="status-badge awaiting" style="font-size:11px;padding:2px 8px;">${x.status}</span><br>`
            : x.status==='قيد الاستلام'
            ? `<span class="status-badge mobile-pending" style="font-size:11px;padding:2px 8px;">📱 ${x.status}</span><br>` : '';
        return `<tr>
            <td><b>${x.branch}</b><br><small>${x.city}</small></td>
            <td><span class="text-box-cell">${sanitize(x.notes)}</span></td>
            <td><small style="color:var(--text-main)">📥 ${sanitize(x.addedBy||'—')}</small></td>
            <td>${statusDot}<small>${_toLatinDigits(x.time)}</small></td>
            <td>${actionBtn}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" style="color:var(--text-dim);padding:20px;">لا توجد نتائج</td></tr>`;

    const oPagBar = document.getElementById('paginationO');
    if (oPagBar) oPagBar.innerHTML = _paginationBar('O', allRowsO.length, _pageO);
}

function _renderTableI(get) {
    const tbodyI = document.querySelector("#tableI tbody");
    if (!tbodyI) return;

    const canManage = perm('deleteM');
    const thActions = document.getElementById('thInquiryActions');
    if (thActions) thActions.textContent = canManage ? 'إجراءات' : '';

    const f = {
        city:    get("searchCityI"),
        branch:  get("searchBranchI"),
        date:    get("searchDateI"),
        type:    get("searchTypeI"),
        addedBy: get("searchAddedByI")
    };
    const allRowsI = db.inquiries.filter(x =>
        !x.deleted &&
        (!f.city    || x.city===f.city) &&
        (!f.branch  || x.branch===f.branch) &&
        (!f.date    || x.iso.startsWith(f.date)) &&
        (!f.type    || x.type===f.type) &&
        (!f.addedBy || (x.addedBy||'').includes(f.addedBy))
    );
    if (!_pg.I) _pg.I = 1;
    const _pageI = Math.min(_pg.I, Math.max(1, Math.ceil(allRowsI.length / _PAGE_SIZE)));
    _pg.I = _pageI;
    const rows = allRowsI.slice((_pageI - 1) * _PAGE_SIZE, _pageI * _PAGE_SIZE);
    const _tbodyIRows = rows; // kept for select-all check below
    tbodyI.innerHTML = rows.map(x => {
        const editBox = canManage ? `
            <div id="inqEdit-${x.id}" style="display:none;margin-top:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:12px;">
                <div style="margin-bottom:8px;">
                    <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:4px;">رقم الهاتف</label>
                    <input type="text" id="inqPhone-${x.id}" value="${sanitize(x.phone)}" style="width:100%;padding:6px 10px;border-radius:8px;">
                </div>
                <div style="margin-bottom:10px;">
                    <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:4px;">الملاحظات</label>
                    <textarea id="inqNotes-${x.id}" rows="2" style="width:100%;">${sanitize(x.notes||'')}</textarea>
                </div>
                <button class="btn btn-main" style="width:100%;padding:7px;font-size:12px;" onclick="saveEditInquiry(${x.id})">حفظ التعديل</button>
            </div>` : '';
        const actions = canManage ? `
            <td style="white-space:nowrap;">
                <button class="btn-edit-sm" onclick="startEditInquiry(${x.id})">✏️ تعديل</button>
                <button class="btn-delete-sm" style="margin-top:4px;" onclick="deleteInquiry(${x.id})">🗑</button>
            </td>` : '<td></td>';
        return `<tr>
            <td><span class="seq-badge" title="الرقم التسلسلي">#${x.seq||'—'}</span></td>
            <td><b>${x.branch}</b><br><small>${x.city}</small></td>
            <td>${sanitize(x.phone)}</td>
            <td>
                <span class="emp-badge">${x.type||'—'}</span>
                ${x.notes?`<br><span class="text-box-cell" style="font-size:13px;color:var(--text-dim)">${sanitize(x.notes)}</span>`:''}
                ${editBox}
            </td>
            <td><small style="color:var(--text-main)">${sanitize(x.addedBy||'—')}</small></td>
            <td><small>${_toLatinDigits(x.time)}</small></td>
            ${actions}
        </tr>`;
    }).join('');

    const iPagBar = document.getElementById('paginationI');
    if (iPagBar) iPagBar.innerHTML = _paginationBar('I', allRowsI.length, _pageI);
}

function _renderTableC(get, isAdmin) {
    const tbodyC = document.querySelector("#tableC tbody");
    if (!tbodyC) return;

    const canDeleteC = perm('deleteC');

    const isControl         = currentUser?.role === 'control';
    const isMedia           = currentUser?.role === 'media';
    const isControlEmployee = currentUser?.role === 'control_employee';
    const isControlSub      = currentUser?.role === 'control_sub';
    const f = {
        city:   get("searchCityC"),
        branch: get("searchBranchC"),
        date:   get("searchDateC"),
        text:   get("searchTextC").toLowerCase()
    };
    const allRowsC = db.complaints.filter(x =>
        !x.deleted &&
        (isControlSub ? (x.assignedToSubId === currentUser.empId && x.status === 'تمت الموافقة') :
         (isControl || isControlEmployee || isMedia) ? x.status === 'تمت الموافقة' : true) &&
        (!f.city   || x.city===f.city) &&
        (!f.branch || x.branch===f.branch) &&
        (!f.date   || x.iso.startsWith(f.date)) &&
        (!f.text   || x.notes.toLowerCase().includes(f.text))
    );
    if (!_pg.C) _pg.C = 1;
    const _pageC = Math.min(_pg.C, Math.max(1, Math.ceil(allRowsC.length / _PAGE_SIZE)));
    _pg.C = _pageC;
    const rows = allRowsC.slice((_pageC - 1) * _PAGE_SIZE, _pageC * _PAGE_SIZE);

    tbodyC.innerHTML = rows.map(x => {
        const hideFromControl = isControl || isMedia || isControlEmployee || isControlSub;

        const custHtml = (!hideFromControl && x.customer?.phone)
            ? `<div class="customer-info-box">👤 <b>الهاتف:</b> ${sanitize(x.customer.phone)}</div>`
            : '';

        const linkHtml = (!hideFromControl && x.linkedInqSeq && perm('viewLinkBadge'))
            ? `<div><span class="linked-inq" onclick="jumpToInquiry(${x.linkedInqSeq})" title="انتقل للاستفسار المرتبط">🔗 استفسار #${x.linkedInqSeq}</span></div>`
            : '';

        const fileLink = x.file ? `<br><a href="${x.file}" target="_blank" class="btn-attach">📎 عرض المرفق</a>` : '';

        const ctStr = x.callTime ? _formatCallTime(x.callTime) : '';
        let extraInfoHtml = '';
        if (x.callTime || x.noteDate || x.moveNumber || x.invoiceValue) {
            if (isControl || isControlEmployee) {
                extraInfoHtml = `<div style="margin-top:10px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;font-size:13px;">
                    ${ctStr       ? `<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="background:rgba(255,255,255,0.06);padding:9px 14px;color:var(--text-dim);font-weight:700;min-width:140px;text-align:right;">🕐 وقت تلقي الاتصال</span><span style="padding:9px 14px;color:var(--text-main);">${sanitize(ctStr)}</span></div>` : ''}
                    ${x.noteDate  ? `<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="background:rgba(255,255,255,0.06);padding:9px 14px;color:var(--text-dim);font-weight:700;min-width:140px;text-align:right;">📅 تاريخ الملاحظة</span><span style="padding:9px 14px;color:var(--text-main);">${sanitize(x.noteDate)}</span></div>` : ''}
                    ${x.moveNumber? `<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.07);"><span style="background:rgba(255,255,255,0.06);padding:9px 14px;color:var(--text-dim);font-weight:700;min-width:140px;text-align:right;">🔢 رقم الحركة</span><span style="padding:9px 14px;color:var(--text-main);">${sanitize(x.moveNumber)}</span></div>` : ''}
                    ${x.invoiceValue?`<div style="display:flex;"><span style="background:rgba(255,255,255,0.06);padding:9px 14px;color:var(--text-dim);font-weight:700;min-width:140px;text-align:right;">💰 قيمة الفاتورة</span><span style="padding:9px 14px;color:var(--text-main);">${sanitize(x.invoiceValue)}</span></div>` : ''}
                </div>`;
            } else {
                extraInfoHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px;">
                    ${ctStr?`<div style="background:linear-gradient(135deg,rgba(21,101,192,0.18),rgba(21,101,192,0.08));border:1px solid rgba(21,101,192,0.3);border-radius:12px;padding:10px 13px;display:flex;flex-direction:column;gap:3px;"><span style="font-size:10px;color:#64b5f6;font-weight:700;letter-spacing:0.5px;">وقت الاتصال</span><span style="font-size:13px;color:var(--text-main);font-weight:600;font-family:monospace;">🕐 ${sanitize(ctStr)}</span></div>`:''}
                    ${x.noteDate?`<div style="background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.08));border:1px solid rgba(46,125,50,0.3);border-radius:12px;padding:10px 13px;display:flex;flex-direction:column;gap:3px;"><span style="font-size:10px;color:#81c784;font-weight:700;letter-spacing:0.5px;">تاريخ الملاحظة</span><span style="font-size:13px;color:var(--text-main);font-weight:600;">📅 ${sanitize(x.noteDate)}</span></div>`:''}
                    ${x.moveNumber?`<div style="background:linear-gradient(135deg,rgba(123,31,162,0.18),rgba(123,31,162,0.08));border:1px solid rgba(123,31,162,0.3);border-radius:12px;padding:10px 13px;display:flex;flex-direction:column;gap:3px;"><span style="font-size:10px;color:#ce93d8;font-weight:700;letter-spacing:0.5px;">رقم الحركة</span><span style="font-size:13px;color:var(--text-main);font-weight:600;">🔢 ${sanitize(x.moveNumber)}</span></div>`:''}
                    ${x.invoiceValue?`<div style="background:linear-gradient(135deg,rgba(230,81,0,0.18),rgba(230,81,0,0.08));border:1px solid rgba(230,81,0,0.3);border-radius:12px;padding:10px 13px;display:flex;flex-direction:column;gap:3px;"><span style="font-size:10px;color:#ffb74d;font-weight:700;letter-spacing:0.5px;">قيمة الفاتورة</span><span style="font-size:13px;color:var(--text-main);font-weight:600;">💰 ${sanitize(x.invoiceValue)}</span></div>`:''}
                </div>`;
            }
        }

        let cStatusBadge = '';
        if (x.status === 'مُرجعة للتعديل') cStatusBadge = `<span class="status-badge returned">${x.status}</span>`;
        else if (x.status !== 'تمت الموافقة') cStatusBadge = `<span class="status-badge awaiting">${x.status||'بانتظار الموافقة'}</span>`;

        const auditStatusBadge = x.auditStatus
            ? `<span class="emp-badge" style="margin-right:6px;background:rgba(21,101,192,0.2);color:#90caf9;font-size:11px;">${sanitize(x.auditStatus)}</span>`
            : '';

        const controlEmps = isControl
            ? employees.filter(e => e.title === 'مدير قسم السيطرة')
            : isControlEmployee
                ? employees.filter(e => e.title === 'موظف سيطرة')
                : [];

        const auditHtml = _buildAuditHtml(x, isControl, isControlEmployee, isControlSub, controlEmps, auditStatusBadge);

        const canFollowup = perm('addC') && (!isMedia || x.addedBy === currentUser.name);
        let followupHtml = '';
        if (x.audit && !isControl && !isControlEmployee && !isControlSub) {
            if (x.followupResult) {
                followupHtml = `<div style="margin-top:10px;padding:12px;background:rgba(46,125,50,0.1);border:1px solid rgba(46,125,50,0.3);border-radius:10px;text-align:right;">
                    <div style="font-size:12px;color:#81c784;font-weight:700;margin-bottom:5px;">📞 نتيجة المتابعة مع الزبون</div>
                    <div style="font-size:13px;color:var(--text-main);">${sanitize(x.followupResult)}</div>
                    <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">${sanitize(x.followupBy||'')} — ${_toLatinDigits(x.followupTime||'')}</div>
                </div>`;
            } else if (canFollowup) {
                followupHtml = `<div class="audit-box" style="margin-top:10px;border-right-color:#2e7d32;">
                    <label style="color:#81c784;display:block;margin-bottom:5px;text-align:right;">📞 نتيجة المتابعة مع الزبون:</label>
                    <textarea id="followup-${x.id}" rows="2" placeholder="اكتب نتيجة المتابعة مع الزبون..."></textarea>
                    <button class="btn btn-main" style="width:100%;margin-top:8px;font-size:12px;padding:8px;background:#2e7d32;" onclick="saveFollowupResult(${x.id})">حفظ نتيجة المتابعة</button>
                </div>`;
            }
        }

        const returnEditBox = (x.status==='مُرجعة للتعديل' && !isAdmin && x.addedBy===currentUser.name && perm('addC'))
            ? `<div class="inline-edit-box" style="margin-top:10px;">
                <textarea id="returnEdit-${x.id}" rows="2" style="margin-bottom:8px;">${sanitize(x.notes)}</textarea>
                <button class="btn-main btn" style="width:100%;padding:8px;font-size:12px;" onclick="saveReturnEdit(${x.id})">إعادة إرسال</button>
               </div>` : '';

        let adminActions = '';
        if (perm('approveC') && x.status!=='تمت الموافقة') adminActions += `<button class="btn-approve" onclick="approveControl(${x.id})">✓ موافقة</button>`;
        if (perm('editC'))    adminActions += `<button class="btn-edit-sm" onclick="editControl(${x.id})">✏️ تعديل</button>`;
        if (perm('returnC') && x.status!=='مُرجعة للتعديل') adminActions += `<button class="btn-return" onclick="returnControl(${x.id})">↩ إرجاع</button>`;
        if (perm('deleteC'))  adminActions += `<button class="btn-delete-sm" onclick="deleteControl(${x.id})">🗑</button>`;

        const adminEditBox = perm('editC') ? `
            <div class="inline-edit-box" id="cedit-${x.id}" style="display:none;margin-top:10px;">
                <textarea id="ceditText-${x.id}" rows="2" style="margin-bottom:8px;">${sanitize(x.notes)}</textarea>
                <button class="btn-main btn" style="width:100%;padding:8px;font-size:12px;" onclick="saveEditControl(${x.id})">حفظ التعديل</button>
            </div>` : '';

        return `<tr data-id="${x.id}">
            <td><b>${x.branch}</b><br><small>${x.city}</small><br>${cStatusBadge}</td>
            <td>
                <span class="text-box-cell">${sanitize(x.notes)}</span>
                ${extraInfoHtml}${custHtml}${linkHtml}${fileLink}${auditHtml}${followupHtml}${returnEditBox}${adminEditBox}
            </td>
            <td><small style="color:var(--text-main)">📥 ${sanitize(x.addedBy||'—')}</small></td>
            <td><small>${_toLatinDigits(x.time)}</small></td>
            <td>${adminActions}</td>
        </tr>`;
    }).join('');

    const cPagBar = document.getElementById('paginationC');
    if (cPagBar) cPagBar.innerHTML = _paginationBar('C', allRowsC.length, _pageC);
}

function renderAll() {
    const isAdmin = currentUser?.isAdmin;
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    _renderTableM(get, isAdmin);
    _renderTableO(get);
    _renderTableI(get);
    _renderTableC(get, isAdmin);
    if (typeof _updateBadges === 'function') _updateBadges();
    if (typeof _checkNotifications === 'function') _checkNotifications();
}
