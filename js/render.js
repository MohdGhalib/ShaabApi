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
            return `<div class="final-audit-text">
                <div>رد قسم السيطرة: ${sanitize(x.audit)}</div>
                ${x.auditStatus ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;">
                    <span style="font-size:12px;color:var(--text-dim);font-weight:700;">حالة الملاحظة</span>
                    <span style="font-size:17px;font-weight:800;color:${x.auditStatus==='مكتوبة'?'#81c784':x.auditStatus==='غير مكتوبة'?'#ef9a9a':'#90caf9'};">${sanitize(x.auditStatus)}</span>
                </div>` : ''}
            </div>`;
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
        return `<div class="final-audit-text">
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
                <div>رد قسم السيطرة: ${sanitize(x.audit)}</div>
                <button class="btn-notify" onclick="openNotifyModal(${x.id})">📣 تبليغ</button>
            </div>
            ${x.auditStatus ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;">
                <span style="font-size:12px;color:var(--text-dim);font-weight:700;">حالة الملاحظة</span>
                <span style="font-size:17px;font-weight:800;color:${x.auditStatus==='مكتوبة'?'#81c784':x.auditStatus==='غير مكتوبة'?'#ef9a9a':'#90caf9'};">${sanitize(x.auditStatus)}</span>
            </div>` : ''}
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
        clear(['searchCityC','searchTextC','searchTypeC','searchFinStatusC','searchAddedByC']);
        document.getElementById('searchBranchC').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateC');
        _pg.C = 1;
    } else if (t==='CU') {
        clear(['searchCityCU','searchTextCU']);
        document.getElementById('searchBranchCU').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateCU');
    }
    renderAll();
}

function _renderTableM(get, isAdmin) {
    const addMontasiaCard = document.getElementById('addMontasiaCard');
    if (addMontasiaCard) addMontasiaCard.style.display = (currentUser?.role === 'control_employee' || currentUser?.role === 'control_sub') ? 'none' : '';
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
    } else if (_myRole === 'control_sub') {
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
            : x.status==='قيد الانتظار'   ? 'not-delivered'
            : 'pending';
        let actions = '';
        if (perm('approveM') && x.status==='بانتظار الموافقة') actions += `<button class="btn-approve" onclick="approveMontasia(${x.id})">✓ موافقة</button>`;
        // الموافقة على منتسيات التطبيق (قيد الاستلام) — مدير أو موظف كول سنتر
        if ((perm('deliverM') || currentUser?.isAdmin) && x.status==='قيد الاستلام') actions += `<button class="btn-approve" onclick="approveMontasiaFromMobile(${x.id})">✓ موافقة</button>`;
        if (perm('editM'))   actions += `<button class="btn-edit-sm" onclick="startEditMontasia(${x.id})">✏️ تعديل</button>`;
        const isCtrlEmpM = currentUser?.role === 'control_employee';
        if ((perm('deliverM') || currentUser?.role==='control_employee' || currentUser?.role==='control_sub') && x.status==='قيد الانتظار') actions += `<button class="btn-deliver" onclick="deliver(${x.id})" style="margin:2px">تسليم</button>`;
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
        const deliveryTimeBox = x.dt && x.status !== 'قيد الانتظار'
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
            <td><div class="added-by" style="font-size:12px;color:var(--text-main);">📥 ${sanitize(x.addedBy||'—')}</div>${approvedByRow}</td>
            <td style="vertical-align:top;">
                <span class="status-badge ${statusClass}">${x.status==='قيد الانتظار' ? 'لم يتم التسليم' : x.status}${x.status==='تم التسليم' && x.deliveredBy ? ' بواسطة '+sanitize(x.deliveredBy) : ''}</span>
                ${deliveryTimeBox}
            </td>
            <td><small>${_toLatinDigits(x.time)}</small></td>
            <td style="text-align:center;">
                <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                ${x.deliverNotes
                    ? `<button onclick="showDeliverNotes(${x.id})"
                        style="cursor:pointer;background:rgba(25,118,210,0.12);border:1px solid rgba(25,118,210,0.35);
                               color:#64b5f6;border-radius:8px;padding:5px 14px;font-family:'Cairo';font-size:12px;font-weight:700;">
                        👁 عرض</button>`
                    : `<button disabled
                        style="cursor:not-allowed;background:rgba(255,255,255,0.03);border:1px solid var(--border);
                               color:var(--text-dim);border-radius:8px;padding:5px 14px;font-family:'Cairo';font-size:12px;opacity:0.4;">
                        عرض</button>`
                }
                ${isCtrlEmpM && x.isLateDelivery
                    ? (x.countedByControl
                        ? `<div style="display:flex;gap:4px;align-items:center;"><span style="padding:4px 7px;font-size:10px;font-family:'Cairo';border-radius:7px;border:1px solid rgba(46,125,50,0.4);background:rgba(46,125,50,0.15);color:#81c784;font-weight:700;">✓ تم الاحتساب</span><button onclick="toggleCountMontasia(${x.id})" style="padding:4px 7px;font-size:10px;font-family:'Cairo';cursor:pointer;border-radius:7px;border:1px solid rgba(211,47,47,0.4);background:rgba(211,47,47,0.1);color:#ef9a9a;font-weight:700;">تراجع</button></div>`
                        : `<button onclick="toggleCountMontasia(${x.id})" style="padding:4px 10px;font-size:10px;font-family:'Cairo';cursor:pointer;border-radius:7px;border:1px solid rgba(255,152,0,0.35);background:rgba(255,152,0,0.08);color:#ffb74d;font-weight:700;">📊 احتساب تقييم</button>`)
                    : ''
                }
                </div>
            </td>
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
    const _ctrlSubO = currentUser?.role === 'control_sub' ? employees.find(e => e.empId === currentUser?.empId) : null;
    const allRowsO = db.montasiat.filter(x =>
        !x.deleted &&
        (x.status==='قيد الانتظار' || x.status==='بانتظار الموافقة' || x.status==='قيد الاستلام') &&
        (!_ctrlSubO?.assignedBranches?.length || _ctrlSubO.assignedBranches.some(b => b.branch === x.branch && b.city === x.city)) &&
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
        else if (x.status==='قيد الانتظار' && (perm('deliverM') || currentUser?.role==='control_employee' || currentUser?.role==='control_sub'))
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
        const canCountI = (currentUser?.role === 'cc_manager' || currentUser?.isAdmin) && x.type === 'شكوى';
        const _linkedC  = canCountI ? db.complaints.find(c => !c.deleted && String(c.linkedInqSeq) === String(x.seq)) : null;
        const countedI  = canCountI && (_linkedC ? !!_linkedC.countedByCC : !!x.countedByCC);
        // رسالة تقاطع: إذا تم احتسابها في السيطرة (countedByControl) → أظهر رسالة بدل زر الاحتساب
        const _ctrlCounted = canCountI && _linkedC && !!_linkedC.countedByControl;
        const countBtnI = canCountI
            ? (_ctrlCounted
                ? `<div style="margin-top:4px;padding:5px 10px;border-radius:8px;border:1px solid rgba(21,101,192,0.35);background:rgba(21,101,192,0.1);font-size:11px;font-family:'Cairo';color:#64b5f6;font-weight:700;text-align:center;">🛡️ تم احتسابها في السيطرة</div>`
                : (countedI
                    ? `<div style="display:flex;gap:5px;align-items:center;margin-top:4px;"><span style="flex:1;padding:5px 8px;font-size:11px;font-family:'Cairo';border-radius:8px;border:1px solid rgba(46,125,50,0.4);background:rgba(46,125,50,0.15);color:#81c784;font-weight:700;text-align:center;">✓ تم احتساب الشكوى على الفرع</span><button onclick="toggleCountInquiry(${x.id})" style="padding:5px 8px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid rgba(211,47,47,0.4);background:rgba(211,47,47,0.1);color:#ef9a9a;font-weight:700;">تراجع</button></div>`
                    : `<button onclick="toggleCountInquiry(${x.id})" style="display:block;margin-top:4px;width:100%;padding:5px 10px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid rgba(255,152,0,0.35);background:rgba(255,152,0,0.08);color:#ffb74d;font-weight:700;">📊 احتساب شكوى</button>`))
            : '';

        const actions = canManage ? `
            <td style="white-space:nowrap;">
                <button class="btn-edit-sm" onclick="startEditInquiry(${x.id})">✏️ تعديل</button>
                <button class="btn-delete-sm" style="margin-top:4px;" onclick="deleteInquiry(${x.id})">🗑</button>
                ${countBtnI}
            </td>` : (canCountI ? `<td>${countBtnI}</td>` : '<td></td>');
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

    // لا تُعيد الرسم إذا كان المستخدم يكتب في حقل داخل الجدول
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') && tbodyC.contains(active)) return;

    const canDeleteC = perm('deleteC');

    const isControl         = currentUser?.role === 'control';
    const isMedia           = currentUser?.role === 'media';
    const isControlEmployee = currentUser?.role === 'control_employee';
    const isControlSub      = currentUser?.role === 'control_sub';
    const isCCMgrC          = currentUser?.role === 'cc_manager';
    const linkedCompIds = new Set(
        (db.compensations || []).filter(x => !x.deleted && x.linkedComplaintId)
                               .map(x => x.linkedComplaintId)
    );
    const f = {
        city:      get("searchCityC"),
        branch:    get("searchBranchC"),
        date:      get("searchDateC"),
        text:      get("searchTextC").toLowerCase(),
        type:      get("searchTypeC"),
        finStatus: get("searchFinStatusC"),
        addedBy:   get("searchAddedByC")
    };
    const allRowsC = (db.complaints || []).filter(x =>
        !x.deleted &&
        (isControlSub ? (
            x.status === 'تمت الموافقة' &&
            (currentUser.assignedBranches?.length
                ? currentUser.assignedBranches.some(b => b.branch === x.branch && b.city === x.city)
                : x.assignedToSubId === currentUser.empId)
        ) : (isControl || isControlEmployee || isMedia) ? x.status === 'تمت الموافقة' : true) &&
        (!f.city      || x.city===f.city) &&
        (!f.branch    || x.branch===f.branch) &&
        (!f.date      || x.iso.startsWith(f.date)) &&
        (!f.text      || (x.notes||'').toLowerCase().includes(f.text)) &&
        (!f.type      || (x.type||'أخرى') === f.type) &&
        (isMedia ? x.addedBy === currentUser?.name : (!f.addedBy || x.addedBy === f.addedBy)) &&
        (!f.finStatus || (
            f.finStatus === 'مفتوحة' ? (x.type === 'مالية' && !linkedCompIds.has(x.id)) :
            f.finStatus === 'مغلقة'  ? (x.type === 'مالية' && linkedCompIds.has(x.id))  : true
        ))
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

        const ctStr  = x.callTime ? _formatCallTime(x.callTime) : '';
        const hasMore = !!(ctStr || x.noteDate || x.moveNumber || x.invoiceValue);
        const _row = (label, val, last) =>
            `<div style="display:flex;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.07);'}">
                <span style="background:rgba(255,255,255,0.06);padding:9px 14px;color:var(--text-dim);font-weight:700;min-width:140px;text-align:right;">${label}</span>
                <span style="padding:9px 14px;color:var(--text-main);">${val}</span>
            </div>`;
        const extraInfoHtml = `<div style="margin-top:10px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;font-size:13px;">
            ${_row('📝 التفاصيل', sanitize(x.notes), !hasMore)}
            ${ctStr        ? _row('🕐 وقت تلقي الاتصال', sanitize(ctStr),       !(x.noteDate||x.moveNumber||x.invoiceValue)) : ''}
            ${x.noteDate   ? _row('📅 تاريخ الملاحظة',   sanitize(x.noteDate),  !(x.moveNumber||x.invoiceValue))             : ''}
            ${x.moveNumber ? _row('🔢 رقم الحركة',        sanitize(x.moveNumber),!x.invoiceValue)                            : ''}
            ${x.invoiceValue?_row('💰 قيمة الفاتورة',     sanitize(x.invoiceValue), true)                                    : ''}
        </div>`;

        let cStatusBadge = '';
        if (x.status === 'مُرجعة للتعديل') cStatusBadge = `<span class="status-badge returned">${x.status}</span>`;
        else if (x.status !== 'تمت الموافقة') cStatusBadge = `<span class="status-badge awaiting">${x.status||'بانتظار الموافقة'}</span>`;
        else if (!hideFromControl) cStatusBadge = `<span class="status-badge done" style="font-size:10px;">✓ أُرسلت للسيطرة</span>`;

        const auditStatusBadge = x.auditStatus
            ? `<span class="emp-badge" style="margin-right:6px;background:rgba(21,101,192,0.2);color:#90caf9;font-size:11px;">${sanitize(x.auditStatus)}</span>`
            : '';

        const controlEmps = isControl
            ? employees.filter(e => e.title === 'مدير قسم السيطرة')
            : isControlEmployee
                ? employees.filter(e => e.title === 'موظف سيطرة' &&
                    (!e.assignedBranches?.length || e.assignedBranches.some(b => b.branch === x.branch && b.city === x.city)))
                : [];

        const auditHtml = _buildAuditHtml(x, isControl, isControlEmployee, isControlSub, controlEmps, auditStatusBadge);

        const canFollowup = perm('addC') && (!isMedia || x.addedBy === currentUser.name);
        let followupHtml = '';
        if (x.audit && !isControl) {
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

        // زر احتساب شكوى — مدير السيطرة (محجوب على شكاوي الكول سنتر والميديا)
        if (isControlEmployee) {
            const _addedByEmp   = employees.find(e => e.name === x.addedBy);
            const _addedByTitle = _addedByEmp?.title || '';
            const _blockedTitles = ['مدير الكول سنتر','موظف كول سنتر','موظف ميديا'];
            const _canCount     = !_blockedTitles.includes(_addedByTitle);
            if (_canCount) {
                const counted = !!x.countedByControl;
                adminActions += counted
                    ? `<div style="display:flex;gap:5px;align-items:center;margin-top:6px;"><span style="flex:1;padding:5px 8px;font-size:11px;font-family:'Cairo';border-radius:8px;border:1px solid rgba(46,125,50,0.4);background:rgba(46,125,50,0.15);color:#81c784;font-weight:700;text-align:center;">✓ تم احتساب الشكوى على الفرع</span><button onclick="toggleCountComplaint(${x.id})" style="padding:5px 8px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid rgba(211,47,47,0.4);background:rgba(211,47,47,0.1);color:#ef9a9a;font-weight:700;">تراجع</button></div>`
                    : `<button onclick="toggleCountComplaint(${x.id})" style="display:block;margin-top:6px;width:100%;padding:5px 10px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid rgba(255,152,0,0.35);background:rgba(255,152,0,0.08);color:#ffb74d;font-weight:700;">📊 احتساب شكوى</button>`;
            }
        }
        // زر احتساب شكوى — مدير الكول سنتر والمدير
        if (isCCMgrC || isAdmin) {
            // رسالة تقاطع: إذا تم احتسابها من الاستفسارات → أظهر رسالة بدل زر الاحتساب
            const _inqCounted = x.linkedInqSeq && x.countedByCC && x.countedByCCSource === 'inquiry';
            if (_inqCounted) {
                adminActions += `<div style="margin-top:6px;padding:5px 10px;border-radius:8px;border:1px solid rgba(156,39,176,0.35);background:rgba(156,39,176,0.1);font-size:11px;font-family:'Cairo';color:#ce93d8;font-weight:700;text-align:center;">📋 تم احتسابها في الاستفسارات</div>`;
            } else {
                const counted = !!x.countedByCC;
                adminActions += counted
                    ? `<div style="display:flex;gap:5px;align-items:center;margin-top:6px;"><span style="flex:1;padding:5px 8px;font-size:11px;font-family:'Cairo';border-radius:8px;border:1px solid rgba(46,125,50,0.4);background:rgba(46,125,50,0.15);color:#81c784;font-weight:700;text-align:center;">✓ تم احتساب الشكوى على الفرع</span><button onclick="toggleCountComplaint(${x.id})" style="padding:5px 8px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid rgba(211,47,47,0.4);background:rgba(211,47,47,0.1);color:#ef9a9a;font-weight:700;">تراجع</button></div>`
                    : `<button onclick="toggleCountComplaint(${x.id})" style="display:block;margin-top:6px;width:100%;padding:5px 10px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid rgba(255,152,0,0.35);background:rgba(255,152,0,0.08);color:#ffb74d;font-weight:700;">📊 احتساب شكوى</button>`;
            }
        }

        const adminEditBox = perm('editC') ? `
            <div class="inline-edit-box" id="cedit-${x.id}" style="display:none;margin-top:10px;">
                <textarea id="ceditText-${x.id}" rows="2" style="margin-bottom:8px;">${sanitize(x.notes)}</textarea>
                <button class="btn-main btn" style="width:100%;padding:8px;font-size:12px;" onclick="saveEditControl(${x.id})">حفظ التعديل</button>
            </div>` : '';

        const isFinancial = x.type === 'مالية';
        const isLinked    = linkedCompIds.has(x.id);
        const barColor    = isFinancial ? (isLinked ? '#2e7d32' : '#c62828') : '';
        const finBar      = barColor
            ? `<span style="position:absolute;top:0;right:0;bottom:0;width:6px;background:${barColor};border-radius:0 4px 4px 0;"></span>`
            : '';
        const typeBadge   = isFinancial
            ? `<span style="display:inline-block;margin-top:4px;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;background:${isLinked ? 'rgba(46,125,50,0.18)' : 'rgba(198,40,40,0.15)'};color:${isLinked ? '#81c784' : '#ef9a9a'};">💰 مالية${isLinked ? ' ✓' : ''}</span>`
            : '';

        return `<tr data-id="${x.id}">
            <td style="position:relative;padding-right:${barColor ? '14px' : ''}">${finBar}<b>${x.branch}</b><br><small>${x.city}</small><br>${cStatusBadge}${typeBadge}</td>
            <td>
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
    renderControlOpen();
    if (typeof renderCompensations === 'function') renderCompensations();
    if (typeof _updateBadges === 'function') _updateBadges();
    if (typeof _checkNotifications === 'function') _checkNotifications();
}

function renderControlOpen() {
    const tbody = document.querySelector('#tableCU tbody');
    if (!tbody) return;

    // لا تُعيد الرسم إذا كان المستخدم يكتب في حقل داخل الجدول
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') && tbody.contains(active)) return;

    const get  = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const city   = get('searchCityCU');
    const branch = get('searchBranchCU');
    const date   = get('searchDateCU');
    const text   = get('searchTextCU').toLowerCase();

    const isControl         = currentUser?.role === 'control';
    const isControlEmployee = currentUser?.role === 'control_employee';
    const isControlSub      = currentUser?.role === 'control_sub';
    const isMediaCU         = currentUser?.role === 'media';

    const rows = (db.complaints || []).filter(x =>
        !x.deleted &&
        x.status === 'تمت الموافقة' &&
        !x.audit &&
        (isMediaCU ? x.addedBy === currentUser.name : true) &&
        (isControlSub ? (
            currentUser.assignedBranches?.length
                ? currentUser.assignedBranches.some(b => b.branch === x.branch && b.city === x.city)
                : x.assignedToSubId === currentUser.empId
        ) : true) &&
        (!city   || x.city   === city) &&
        (!branch || x.branch === branch) &&
        (!date   || (x.iso||'').startsWith(date)) &&
        (!text   || (x.notes||'').toLowerCase().includes(text))
    );

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-dim);padding:28px;text-align:center;">✅ لا توجد متابعات مفتوحة</td></tr>`;
        const bar = document.getElementById('paginationCU');
        if (bar) bar.innerHTML = '';
        return;
    }

    tbody.innerHTML = rows.map(x => {
        const ctStr = x.callTime ? _formatCallTime(x.callTime) : '';

        const controlEmps = isControl
            ? employees.filter(e => e.title === 'مدير قسم السيطرة')
            : isControlEmployee
                ? employees.filter(e => e.title === 'موظف سيطرة' &&
                    (!e.assignedBranches?.length || e.assignedBranches.some(b => b.branch === x.branch && b.city === x.city)))
                : [];

        const auditHtml = _buildAuditHtml(x, isControl, isControlEmployee, isControlSub, controlEmps, '');

        return `<tr data-id="${x.id}">
            <td><b>${sanitize(x.branch)}</b><br><small>${sanitize(x.city)}</small></td>
            <td>
                <div style="border:1px solid rgba(255,255,255,0.1);border-radius:10px;overflow:hidden;font-size:13px;margin-bottom:${auditHtml?'10px':'0'};">
                    <div style="display:flex;${ctStr?'border-bottom:1px solid rgba(255,255,255,0.07);':''}">
                        <span style="background:rgba(255,255,255,0.06);padding:8px 12px;color:var(--text-dim);font-weight:700;min-width:110px;text-align:right;">📝 التفاصيل</span>
                        <span style="padding:8px 12px;color:var(--text-main);">${sanitize(x.notes)}</span>
                    </div>
                    ${ctStr ? `<div style="display:flex;">
                        <span style="background:rgba(255,255,255,0.06);padding:8px 12px;color:var(--text-dim);font-weight:700;min-width:110px;text-align:right;">🕐 وقت الاتصال</span>
                        <span style="padding:8px 12px;color:var(--text-main);">${sanitize(ctStr)}</span>
                    </div>` : ''}
                </div>
                ${auditHtml}
            </td>
            <td><small>${sanitize(x.addedBy||'—')}</small></td>
            <td><small>${_toLatinDigits(x.time)}</small></td>
        </tr>`;
    }).join('');

    const bar = document.getElementById('paginationCU');
    if (bar) bar.innerHTML = _paginationBar('CU', rows.length, 1);
}
