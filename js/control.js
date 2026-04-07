/* ══════════════════════════════════════════════════════
   CONTROL — Complaints CRUD with manager approval
══════════════════════════════════════════════════════ */
function addControl() {
    const b=document.getElementById("cBranchAdd").value, n=document.getElementById("cNotes").value.trim(),
          c=document.getElementById("cCityAdd").value;
    if (!b||!n||!c) return alert("يرجى إكمال البيانات");
    const custPhone   = document.getElementById("cCustomerPhone").value.trim();
    const linkedSeq   = document.getElementById("cLinkedInquiry").value;
    const customer    = custPhone ? { phone:custPhone } : null;
    const cCallDate   = document.getElementById("cCallDate").value;
    const cCallTimeV  = document.getElementById("cCallTimeOnly").value;
    const callTime    = cCallDate ? (cCallTimeV ? `${cCallDate}T${cCallTimeV}` : cCallDate) : '';
    const noteDate    = document.getElementById("cNoteDate").value;
    const moveNumber  = document.getElementById("cMoveNumber").value.trim();
    const invoiceValue= document.getElementById("cInvoiceValue").value.trim();

    const fileInput = document.getElementById("cFile");
    const status = (currentUser?.isAdmin || currentUser?.role === 'media') ? 'تمت الموافقة' : 'بانتظار الموافقة';
    const base = { id:Date.now(), city:c, branch:b, notes:n, audit:'', time:now(), iso:iso(),
        addedBy:currentUser.name, status, customer, linkedInqSeq: linkedSeq||null,
        callTime, noteDate, moveNumber, invoiceValue };

    const _notifyComplaint = () => {
        if (!IS_LOCAL && (currentUser?.role === 'cc_employee' || currentUser?.role === 'media')) {
            fetch('/api/sse/complaint-notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_token}` },
                body: JSON.stringify({
                    id:     String(base.id),
                    branch: base.branch || '',
                    city:   base.city   || '',
                    notes:  (base.notes || '').substring(0, 120)
                })
            }).catch(() => {});
        }
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            db.complaints.unshift({ ...base, file:e.target.result });
            save();
            _notifyComplaint();
            resetControlForm();
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        db.complaints.unshift({ ...base, file:null });
        save();
        _notifyComplaint();
        resetControlForm();
    }
}


function resetControlForm() {
    document.getElementById("cNotes").value = "";
    document.getElementById("cFile").value  = "";
    const _lbl = document.getElementById('cFileLabel'); if (_lbl) _lbl.textContent = 'لم يُختر ملف';
    document.getElementById("cCustomerPhone").value = "";
    document.getElementById("cMoveNumber").value    = "";
    document.getElementById("cInvoiceValue").value  = "";
    document.getElementById("cLinkedInquiry").value = "";
    const _d = new Date();
    const _hh = String(_d.getHours()).padStart(2,'0'), _mm = String(_d.getMinutes()).padStart(2,'0');
    setDatePickerValue('cCallDate', iso());
    const _tEl = document.getElementById("cCallTimeOnly"); if (_tEl) _tEl.value = `${_hh}:${_mm}`;
    setDatePickerValue('cNoteDate', iso());
    const preview = document.getElementById('linkedInqPreview');
    if (preview) preview.style.display = 'none';
    populateLinkedInquirySelect();
}

function approveControl(id) {
    const item = db.complaints.find(x => x.id===id);
    if (item) { item.status='تمت الموافقة'; item.approvedBy=currentUser.name; save(); }
}

function editControl(id) {
    const box = document.getElementById(`cedit-${id}`);
    if (box) box.style.display = box.style.display==='none' ? 'block' : 'none';
}

function saveEditControl(id) {
    const v = document.getElementById(`ceditText-${id}`).value.trim();
    if (!v) return alert("يرجى كتابة التعديل");
    const item = db.complaints.find(x => x.id===id);
    if (item) { item.notes=v; item.editedBy=currentUser.name; save(); }
}

function returnControl(id) {
    const item = db.complaints.find(x => x.id===id);
    if (item) { item.status='مُرجعة للتعديل'; save(); }
}


function deleteControl(id) {
    const item = db.complaints.find(x => x.id === id);
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--text-main);margin-bottom:4px;">${sanitize(item.branch)} &nbsp;—&nbsp; ${sanitize(item.city)}</div>
         <div style="color:var(--text-dim);">${sanitize(item.notes.length > 80 ? item.notes.slice(0,80) + '…' : item.notes)}</div>
         <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">📥 ${sanitize(item.addedBy||'—')} &nbsp;|&nbsp; ${sanitize(item.time)}</div>`,
        () => {
            item.deleted     = true;
            item.deletedBy   = currentUser ? currentUser.name : '—';
            item.deletedAtTs = Date.now();
            _logAudit('deleteComplaint', item.branch || '—', `${item.branch} — ${(item.notes||'').substring(0,40)}`);
            save();
            populateLinkedInquirySelect();
        }
    );
}

function saveReturnEdit(id) {
    const v = document.getElementById(`returnEdit-${id}`).value.trim();
    if (!v) return alert("يرجى كتابة التعديل");
    const item = db.complaints.find(x => x.id===id);
    if (item) { item.notes=v; item.status='بانتظار الموافقة'; item.editedBy=currentUser.name; save(); }
}

function saveAudit(id) {
    if (!perm('auditC') && !currentUser?.isAdmin) return;
    const val = document.getElementById(`audit-${id}`).value.trim();
    if (!val) return alert("يرجى كتابة الرد أولاً");
    const statusEl = document.getElementById(`auditStatus-${id}`);
    if (statusEl && !statusEl.value) return alert("يرجى تحديد حالة الملاحظة أولاً");
    const idx = db.complaints.findIndex(x => x.id===id);
    if (idx!==-1) {
        db.complaints[idx].audit = val;
        if (statusEl) db.complaints[idx].auditStatus = statusEl.value;
        db.complaints[idx].auditBy   = currentUser.name;
        db.complaints[idx].auditTime = now();
        save();
    }
}

function assignToControlEmployee(id) {
    const empId = document.getElementById(`assignEmp-${id}`).value;
    if (!empId) return alert("يرجى اختيار موظف");
    const emp  = employees.find(e => e.empId === empId);
    const item = db.complaints.find(x => x.id === id);
    if (item && emp) {
        item.assignedToEmpId = empId;
        item.assignedToName  = emp.name;
        save();
    }
}

function saveControlEmpReply(id) {
    const val = document.getElementById(`ceReply-${id}`)?.value.trim();
    if (!val) return alert("يرجى كتابة الرد");
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.controlEmpReply     = val;
        item.controlEmpReplyBy   = currentUser.name;
        item.controlEmpReplyTime = now();
        save();
    }
}

function approveControlEmpReply(id) {
    const item = db.complaints.find(x => x.id === id);
    if (!item || !item.controlEmpReply) return;
    const statusEl = document.getElementById(`approveAuditStatus-${id}`);
    if (statusEl && !statusEl.value) return alert("يرجى تحديد حالة الملاحظة أولاً");
    item.audit                    = item.controlEmpReply;
    if (statusEl) item.auditStatus = statusEl.value;
    item.auditBy                  = currentUser.name;
    item.auditTime                = now();
    item.controlEmpReplyApproved  = true;
    save();
}

function saveFollowupResult(id) {
    const val = document.getElementById(`followup-${id}`).value.trim();
    if (!val) return alert("يرجى كتابة نتيجة المتابعة");
    const item = db.complaints.find(x => x.id===id);
    if (item) {
        item.followupResult = val;
        item.followupBy     = currentUser.name;
        item.followupTime   = now();
        save();
    }
}

let _notifyItemId = null;
let _logoBase64   = null;

async function _loadLogo() {
    if (_logoBase64 !== null) return;
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width  = img.naturalWidth  || 100;
                c.height = img.naturalHeight || 100;
                c.getContext('2d').drawImage(img, 0, 0);
                _logoBase64 = c.toDataURL('image/png');
            } catch (e) {
                _logoBase64 = '';
            }
            resolve();
        };
        img.onerror = () => { _logoBase64 = ''; resolve(); };
        img.src = 'img/logo.png?' + Date.now();
    });
}

async function openNotifyModal(id) {
    _notifyItemId = id;
    document.getElementById('notifyPersonName').value = '';
    await _loadLogo();
    refreshNotifyCard();
    document.getElementById('notifyModal').classList.remove('hidden');
}

function closeNotifyModal() {
    document.getElementById('notifyModal').classList.add('hidden');
    _notifyItemId = null;
}

async function exportControlNotifyImages() {
    const card = document.getElementById('notifyCard');
    const btn  = document.getElementById('exportNotifyBtn');
    const item = db.complaints.find(x => x.id === _notifyItemId);
    if (!card || !item) return;

    btn.disabled     = true;
    btn.textContent  = '⏳ جاري التصدير...';

    await document.fonts.ready;

    // ── نسخ الكارد خارج الشاشة حتى لا تتأثر الواجهة ──
    const clone = card.cloneNode(true);
    clone.style.cssText = [
        'position:fixed', 'top:0', 'left:-9999px',
        'max-height:none', 'overflow:visible',
        'width:' + card.offsetWidth + 'px',
        'background:#fff', 'z-index:-1'
    ].join(';');

    // إخفاء حالة الملاحظة في النسخة
    const cloneStatus = clone.querySelector('#controlNotifyStatus');
    if (cloneStatus) cloneStatus.style.display = 'none';

    document.body.appendChild(clone);

    try {
        const base = await html2canvas(clone, {
            scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
        });

        _triggerDownload(base, 'نسخة مدراء الأفرع');

        const samer = _appendStatusCanvas(base, item.auditStatus || '—');
        _triggerDownload(samer, 'نسخة سامر');

    } catch (e) {
        alert('تعذّر التصدير، تأكد من أن المتصفح محدّث.');
        console.error(e);
    } finally {
        document.body.removeChild(clone);
        btn.disabled    = false;
        btn.textContent = 'تصدير الصورتين ⬇️';
    }
}

function _appendStatusCanvas(baseCanvas, statusText) {
    const sc = {
        'مكتوبة':      { bg:'#e8f5e9', border:'#2e7d32', text:'#1b5e20' },
        'غير مكتوبة': { bg:'#ffebee', border:'#c62828', text:'#b71c1c' }
    }[statusText] || { bg:'#f0f4ff', border:'#1565c0', text:'#0d47a1' };

    const S   = 2;                    // scale factor (يطابق html2canvas scale:2)
    const pad = 40 * S;
    const boxH = 110 * S;
    const gap  = 24 * S;

    const W = baseCanvas.width;
    const H = baseCanvas.height + gap + boxH + pad;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // خلفية بيضاء
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // رسم الصورة الأساسية
    ctx.drawImage(baseCanvas, 0, 0);

    // رسم صندوق حالة الملاحظة
    const bx = pad, by = baseCanvas.height + gap;
    const bw = W - pad * 2, bh = boxH;
    const r  = 14 * S;

    // خلفية الصندوق
    ctx.fillStyle = sc.bg;
    _rrect(ctx, bx, by, bw, bh, r);
    ctx.fill();

    // إطار الصندوق
    ctx.strokeStyle = sc.border;
    ctx.lineWidth   = 2.5 * S;
    _rrect(ctx, bx, by, bw, bh, r);
    ctx.stroke();

    // خط عنوان "حالة الملاحظة"
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888888';
    ctx.font      = `${13 * S}px Cairo, Arial, sans-serif`;
    ctx.fillText('حالة الملاحظة', W / 2, by + 32 * S);

    // قيمة الحالة بخط كبير وعريض
    ctx.fillStyle = sc.text;
    ctx.font      = `900 ${26 * S}px Cairo, Arial, sans-serif`;
    ctx.fillText(statusText, W / 2, by + 78 * S);

    return canvas;
}

function _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function _triggerDownload(canvas, name) {
    const a    = document.createElement('a');
    a.download = name + '.png';
    a.href     = canvas.toDataURL('image/png');
    a.click();
}

function refreshNotifyCard() {
    const item = db.complaints.find(x => x.id === _notifyItemId);
    if (!item) return;
    const personName  = document.getElementById('notifyPersonName').value.trim();
    const auditStatus = item.auditStatus || '—';

    const exportBtn = document.getElementById('exportNotifyBtn');
    if (exportBtn) {
        exportBtn.disabled = !personName;
        exportBtn.style.opacity = personName ? '1' : '0.4';
        exportBtn.style.cursor  = personName ? 'pointer' : 'not-allowed';
    }

    document.getElementById('notifyCard').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;
                    margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #c62828;">
            ${_logoBase64 ? `<img src="${_logoBase64}"
                 style="width:64px;height:64px;object-fit:contain;
                        filter:drop-shadow(0 2px 8px rgba(198,40,40,0.25));">` : ''}
            <div style="text-align:right;">
                <div style="font-size:28px;font-weight:800;color:#c62828;line-height:1.2;">محامص الشعب</div>
                <div style="font-size:15px;font-weight:700;color:#888;margin-top:3px;">بوابة الاتصالات — تقرير متابعة السيطرة</div>
            </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:17px;">
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 12px;font-weight:800;color:#333;width:38%;background:#fafafa;">الفرع</td>
                <td style="padding:10px 12px;font-weight:700;color:#222;">${item.branch} — ${item.city}</td>
            </tr>
            ${item.noteDate ? `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 12px;font-weight:800;color:#333;background:#fafafa;">تاريخ الملاحظة</td>
                <td style="padding:10px 12px;font-weight:700;color:#222;">${item.noteDate}</td>
            </tr>` : ''}
        </table>

        <div style="margin-bottom:14px;padding:14px 16px;background:#fff3f3;border-right:4px solid #c62828;border-radius:6px;">
            <div style="font-weight:800;color:#c62828;margin-bottom:7px;font-size:16px;">📋 نص الشكوى المرسلة</div>
            <div style="color:#222;font-size:17px;font-weight:700;line-height:1.8;">${sanitize(item.notes)}</div>
        </div>

        <div style="margin-bottom:14px;padding:14px 16px;background:#f0f4ff;border-right:4px solid #1565c0;border-radius:6px;">
            <div style="font-weight:800;color:#1565c0;margin-bottom:7px;font-size:16px;">💬 نتيجة التدقيق من قسم السيطرة</div>
            <div style="color:#222;font-size:17px;font-weight:700;line-height:1.8;">${sanitize(item.audit)}</div>
        </div>

        ${item.followupResult ? `
        <div style="margin-bottom:14px;padding:14px 16px;background:#f0fff4;border-right:4px solid #2e7d32;border-radius:6px;">
            <div style="font-weight:800;color:#2e7d32;margin-bottom:7px;font-size:16px;">📞 اجراءات مستلم الشكوى</div>
            <div style="color:#222;font-size:17px;font-weight:700;line-height:1.8;">${sanitize(item.followupResult)}</div>
        </div>` : ''}

        <div style="margin-bottom:18px;padding:14px 16px;background:#fff8e1;border-right:4px solid #f57f17;border-radius:6px;">
            <div style="font-weight:800;color:#e65100;margin-bottom:7px;font-size:16px;">📣 التبليغ</div>
            <div style="font-size:17px;font-weight:700;color:#333;line-height:1.8;">
                تم تبليغ مدير الفرع / مدير المنطقة:${personName ? ` <strong>${sanitize(personName)}</strong>` : ''}
            </div>
        </div>

        <div style="margin-bottom:10px;padding-top:14px;border-top:2px solid #eee;font-size:17px;font-weight:700;color:#333;">
            👤 <strong style="font-size:18px;">اسم الموظف: ${sanitize(currentUser.name)}</strong>
        </div>

        <div id="controlNotifyStatus" style="padding:12px 16px;border-radius:8px;text-align:center;
             background:${auditStatus==='مكتوبة'?'#e8f5e9':auditStatus==='غير مكتوبة'?'#ffebee':'#f0f4ff'};
             border:2px solid ${auditStatus==='مكتوبة'?'#2e7d32':auditStatus==='غير مكتوبة'?'#c62828':'#1565c0'};">
            <div style="font-size:11px;color:#999;margin-bottom:4px;">حالة الملاحظة</div>
            <div style="font-size:18px;font-weight:800;
                 color:${auditStatus==='مكتوبة'?'#1b5e20':auditStatus==='غير مكتوبة'?'#b71c1c':'#0d47a1'};">
                ${auditStatus}
            </div>
        </div>

    `;
}

function assignToControlSub(id) {
    const empId = document.getElementById(`assignSub-${id}`)?.value;
    if (!empId) return alert("يرجى اختيار موظف");
    const emp  = employees.find(e => e.empId === empId);
    const item = db.complaints.find(x => x.id === id);
    if (item && emp) {
        item.assignedToSubId   = empId;
        item.assignedToSubName = emp.name;
        item.controlSubReply          = null;
        item.controlSubReplyReturned  = false;
        item.controlSubReplyApproved  = false;
        save();
    }
}

function saveControlSubReply(id) {
    const val       = document.getElementById(`subReply-${id}`)?.value.trim();
    const statusVal = document.getElementById(`subReplyStatus-${id}`)?.value;
    if (!statusVal) return alert("يرجى تحديد حالة الملاحظة أولاً");
    if (!val)       return alert("يرجى كتابة الرد");
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.controlSubReply         = val;
        item.controlSubReplyStatus   = statusVal;
        item.controlSubReplyBy       = currentUser.name;
        item.controlSubReplyTime     = now();
        item.controlSubReplyReturned = false;
        save();
    }
}

function approveControlSubReply(id) {
    const item = db.complaints.find(x => x.id === id);
    if (!item || !item.controlSubReply) return;
    const statusEl = document.getElementById(`approveSubStatus-${id}`);
    if (statusEl && !statusEl.value) return alert("يرجى تحديد حالة الملاحظة أولاً");
    item.audit                   = item.controlSubReply;
    if (statusEl) item.auditStatus = statusEl.value;
    item.auditBy                 = currentUser.name;
    item.auditTime               = now();
    item.controlSubReplyApproved = true;
    save();
}

function returnControlSubReply(id) {
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.controlSubReplyReturned = true;
        item.controlSubReply         = null;
        save();
    }
}

function deleteControlSubReply(id) {
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.assignedToSubId         = null;
        item.assignedToSubName       = null;
        item.controlSubReply         = null;
        item.controlSubReplyBy       = null;
        item.controlSubReplyTime     = null;
        item.controlSubReplyReturned = false;
        item.controlSubReplyApproved = false;
        save();
    }
}

function saveControlSubReplyEdit(id) {
    const val = document.getElementById(`subReplyEdit-${id}`)?.value.trim();
    if (!val) return alert("يرجى كتابة التعديل");
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.controlSubReply = val;
        save();
    }
}

function toggleAuditStatusEdit(id) {
    const box = document.getElementById(`auditStatusEditBox-${id}`);
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function saveAuditStatusEdit(id) {
    const val = document.getElementById(`auditStatusEdit-${id}`)?.value;
    if (!val) return alert("يرجى تحديد حالة الملاحظة");
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.auditStatus = val;
        save();
    }
}
