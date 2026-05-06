/* ══════════════════════════════════════════════════════
   CONTROL — Complaints CRUD with manager approval
══════════════════════════════════════════════════════ */
function addControl() {
    const b=document.getElementById("cBranchAdd").value, n=document.getElementById("cNotes").value.trim(),
          c=document.getElementById("cCityAdd").value,
          co=document.getElementById("cCountryAdd")?.value || '';
    if (!b||!n||!c) return alert("يرجى إكمال البيانات");
    const custPhone   = document.getElementById("cCustomerPhone").value.trim();
    const linkedSeq   = document.getElementById("cLinkedInquiry").value;
    const customer    = custPhone ? { phone:custPhone } : null;

    // إن كانت الشكوى مرتبطة باستفسار: نسحب وقت المكالمة + النوع + الحقول المالية + المرفق من الاستفسار
    const linkedInq = linkedSeq ? db.inquiries.find(x => String(x.seq) === String(linkedSeq)) : null;

    let callTime;
    if (linkedInq) {
        // وقت تلقي الاتصال = وقت إضافة الاستفسار الفعلي (inq.id = Date.now())
        const _ts = linkedInq.id || (linkedInq.iso ? Date.parse(linkedInq.iso) : Date.now());
        const d = new Date(_ts);
        const pad = n => String(n).padStart(2,'0');
        callTime = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
        // قراءة من الحقول إن لم يكن هناك ربط
        const _cd = document.getElementById("cCallDate")?.value || '';
        const _ct = document.getElementById("cCallTimeOnly")?.value || '';
        callTime = (_cd && _ct) ? `${_cd}T${_ct}` : new Date().toISOString().slice(0, 16);
    }
    const noteDate    = (linkedInq && linkedInq.complaintType === 'مالية' && linkedInq.noteDate)
                          ? linkedInq.noteDate
                          : (document.getElementById("cNoteDate")?.value || '');
    const moveNumber  = (linkedInq && linkedInq.complaintType === 'مالية' && linkedInq.moveNumber)
                          ? linkedInq.moveNumber
                          : (document.getElementById("cMoveNumber")?.value.trim() || '');
    const invoiceValue= (linkedInq && linkedInq.complaintType === 'مالية' && linkedInq.invoiceValue)
                          ? linkedInq.invoiceValue
                          : (document.getElementById("cInvoiceValue")?.value.trim() || '');

    // النوع: من الاستفسار حصراً عند الربط؛ بدون ربط = 'أخرى'
    const cType = linkedInq ? (linkedInq.complaintType || 'أخرى') : 'أخرى';

    const fileInput = document.getElementById("cFile");
    const inheritedFile = fileInput?.dataset?.inheritedFile || '';

    const status = 'تمت الموافقة';
    const base = { id:Date.now(), country: co || _countryForCity(c), city:c, branch:b, notes:n, audit:'', time:now(), iso:iso(),
        addedBy:currentUser.name, status, customer, linkedInqSeq: linkedSeq||null,
        callTime, noteDate, moveNumber, invoiceValue, type: cType };

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
            if (typeof _logAudit === 'function') _logAudit('addComplaint', base.branch || '—', `${(base.notes||'').substring(0,40)}`);
            save();
            _notifyComplaint();
            resetControlForm();
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else if (inheritedFile) {
        // نقل المرفق المحجوز من الاستفسار المرتبط
        db.complaints.unshift({ ...base, file: inheritedFile });
        if (typeof _logAudit === 'function') _logAudit('addComplaint', base.branch || '—', `${(base.notes||'').substring(0,40)}`);
        save();
        _notifyComplaint();
        resetControlForm();
    } else {
        db.complaints.unshift({ ...base, file:null });
        if (typeof _logAudit === 'function') _logAudit('addComplaint', base.branch || '—', `${(base.notes||'').substring(0,40)}`);
        save();
        _notifyComplaint();
        resetControlForm();
    }
}


function resetControlForm() {
    // رفع التأمين عن الحقول المرتبطة باستفسار
    ['cCountryAdd','cCityAdd','cBranchAdd'].forEach(id => { const el=document.getElementById(id); if(el){el.disabled=false;el.style.cssText='';} });
    ['cCustomerPhone','cNotes'].forEach(id => { const el=document.getElementById(id); if(el){el.readOnly=false;el.style.cssText='';} });

    document.getElementById("cNotes").value = "";
    document.getElementById("cFile").value  = "";
    const _coEl = document.getElementById("cCountryAdd"); if (_coEl) _coEl.value = "";
    document.getElementById("cCityAdd").value = "";
    if (typeof updateCities === 'function') updateCities("cCountryAdd","cCityAdd","cBranchAdd");
    else updateBranches("cCityAdd", "cBranchAdd");
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
    const _badge = document.getElementById('cInferredTypeBadge'); if (_badge) _badge.style.display = 'none';
    const _fileEl = document.getElementById('cFile'); if (_fileEl) _fileEl.dataset.inheritedFile = '';
}

function approveControl(id) {
    const item = db.complaints.find(x => x.id===id);
    if (item) {
        item.status='تمت الموافقة';
        item.approvedBy=currentUser.name;
        if (typeof _logAudit === 'function') _logAudit('approveComplaint', item.branch || '—', `${(item.notes||'').substring(0,40)}`);
        save();
    }
}

function editControl(id) {
    const box = document.getElementById(`cedit-${id}`);
    if (box) box.style.display = box.style.display==='none' ? 'block' : 'none';
}

function saveEditControl(id) {
    const v = document.getElementById(`ceditText-${id}`).value.trim();
    if (!v) return alert("يرجى كتابة التعديل");
    const item = db.complaints.find(x => x.id===id);
    if (item) {
        item.notes=v; item.editedBy=currentUser.name;
        if (typeof _logAudit === 'function') _logAudit('editComplaint', item.branch || '—', `${(v||'').substring(0,40)}`);
        save();
    }
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
    if (item) { item.notes=v; item.status='تمت الموافقة'; item.editedBy=currentUser.name; save(); }
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
        if (typeof _logAudit === 'function') _logAudit('auditComplaint', db.complaints[idx].branch || '—', val.substring(0, 80));
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
        if (typeof _logAudit === 'function') _logAudit('assignControlEmp', item.branch || '—', `إسناد لـ ${emp.name}`);
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
        if (typeof _logAudit === 'function') _logAudit('controlEmpReply', item.branch || '—', val.substring(0, 80));
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
    if (typeof _logAudit === 'function') _logAudit('approveControlEmpReply', item.branch || '—', (item.controlEmpReply || '').substring(0, 80));
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
    _notifyNotesHtml = '';   // إعادة تعيين المحرر النصّي للشكوى
    document.getElementById('notifyPersonName').value = '';
    const ccTa = document.getElementById('notifyCcActions');
    if (ccTa) ccTa.value = '';
    // أخفِ صفّ "اسم الشخص الذي تم تبليغه" لشكاوى سوء التعامل (لأنه قسم التبليغ لا يظهر)
    const item = db.complaints.find(x => x.id === id);
    const pnRow = document.getElementById('notifyPersonNameRow');
    if (pnRow) pnRow.style.display = (item && item.type === 'سوء تعامل') ? 'none' : 'flex';

    // حقل "اسم الموظف" — متاح لمدير الكول سنتر والمدير العام فقط
    const isMgr = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    const empRow   = document.getElementById('notifyEmpNameRow');
    const empInput = document.getElementById('notifyEmpName');
    if (empInput) {
        const defaultName = (item && item.type === 'سوء تعامل')
            ? (item.addedBy || '—')
            : (currentUser?.name || '');
        empInput.value = defaultName;
    }
    if (empRow) empRow.style.display = isMgr ? 'flex' : 'none';

    await _loadLogo();
    refreshNotifyCard();
    document.getElementById('notifyModal').classList.remove('hidden');
}

/* ══════════════════════════════════════════════════════
   فتح الفاتورة المرفقة بالشكوى (تجاوز حظر data: URLs في المتصفحات)
   ══════════════════════════════════════════════════════ */
function openInvoiceFile(id) {
    const item = (db.complaints || []).find(x => String(x.id) === String(id))
              || (db.inquiries  || []).find(x => String(x.id) === String(id));
    if (!item || !item.file) { alert('لا توجد فاتورة مرفقة.'); return; }

    let f = String(item.file).trim();
    let mime = 'application/octet-stream';

    // 1) data URL قياسي (الصيغة الجديدة)
    if (f.startsWith('data:')) {
        const m = f.match(/^data:([^;,]+)/);
        if (m) mime = m[1].trim();
    }
    // 2) http(s) أو رابط نسبي → استدلال من الامتداد
    else if (/^https?:\/\//i.test(f) || f.startsWith('/')) {
        const ext = (f.match(/\.([a-z0-9]+)(\?|#|$)/i) || [])[1];
        if (ext) {
            const e = ext.toLowerCase();
            if (['png','jpg','jpeg','gif','webp','bmp','svg'].includes(e)) {
                mime = 'image/' + (e === 'jpg' ? 'jpeg' : e);
            } else if (e === 'pdf') mime = 'application/pdf';
        }
    }
    // 3) base64 خام بدون data: prefix → نضع image/png افتراضياً
    else if (/^[A-Za-z0-9+/=\s]{40,}$/.test(f)) {
        f = 'data:image/png;base64,' + f.replace(/\s/g, '');
        mime = 'image/png';
    }

    // الصور: data URL يعمل مباشرة في <img> (بلا تحويل)
    // PDF/data: نحوّل إلى Blob URL لتفادي حظر iframe على data:
    let displayUrl = f;
    if (mime === 'application/pdf' && f.startsWith('data:')) {
        try {
            const arr = f.split(',');
            const bstr = atob(arr[1]);
            const u8 = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
            displayUrl = URL.createObjectURL(new Blob([u8], { type: mime }));
        } catch (e) { console.warn('[invoice] blob conv failed', e); }
    }

    console.log('[invoice] mime=', mime,
        '· urlType=', displayUrl.startsWith('blob:') ? 'blob' : (displayUrl.startsWith('data:') ? 'data' : 'http'),
        '· urlLen=', displayUrl.length,
        '· originalPrefix=', String(item.file).substring(0, 30));
    _showInvoiceModal(displayUrl, mime, item);
}

function _showInvoiceModal(url, mime, item) {
    closeInvoiceModal();
    const overlay = document.createElement('div');
    overlay.id = '_invoiceOverlay';
    overlay.dataset.blobUrl = url;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:100050;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Cairo,sans-serif;animation:_invFadeIn 0.22s ease-out;';
    overlay.onclick = (e) => { if (e.target === overlay) closeInvoiceModal(); };

    let preview;
    let downloadName = 'invoice';
    const tryAsImage = mime.startsWith('image/') ||
                       (mime === 'application/octet-stream' && (url.startsWith('data:') || url.startsWith('blob:') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url)));

    if (tryAsImage) {
        downloadName = 'invoice.' + ((mime.split('/')[1] || 'png').replace('jpeg','jpg'));
        // الصورة بحجم معقول (لا upscale) + fallback في عنصر منفصل
        preview = `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;max-width:100%;max-height:100%;">
                <img src="${url}"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                     style="max-width:min(100%,720px);width:auto;height:auto;object-fit:contain;border-radius:12px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,0.45);display:block;">
                <div style="display:none;flex-direction:column;align-items:center;padding:50px 40px;text-align:center;background:#fff;border-radius:12px;color:#333;min-width:320px;box-shadow:0 12px 40px rgba(0,0,0,0.45);">
                    <div style="font-size:64px;margin-bottom:12px;">⚠️</div>
                    <div style="font-size:15px;font-weight:800;">تعذّر عرض الفاتورة</div>
                    <div style="font-size:12px;color:#888;margin-top:8px;">اضغط "تنزيل" لمحاولة فتحها على جهازك</div>
                </div>
            </div>`;
    } else if (mime === 'application/pdf') {
        downloadName = 'invoice.pdf';
        preview = `<iframe src="${url}" style="width:min(100%,800px);height:min(100%,68vh);border:none;border-radius:12px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,0.45);"></iframe>`;
    } else {
        preview = `<div style="padding:60px 50px;text-align:center;background:#fff;border-radius:12px;color:#333;min-width:320px;max-width:480px;box-shadow:0 12px 40px rgba(0,0,0,0.45);">
            <div style="font-size:72px;line-height:1;margin-bottom:18px;">📄</div>
            <div style="font-size:18px;font-weight:800;">ملف مرفق</div>
            <div style="font-size:12px;color:#888;margin-top:6px;">${sanitize(mime)}</div>
            <div style="font-size:13px;color:#666;margin-top:14px;">المعاينة غير متاحة لهذا النوع — اضغط "تنزيل" لحفظه</div>
        </div>`;
    }

    const branchLabel = item ? `${sanitize(item.branch || '—')}${item.city ? ' — ' + sanitize(item.city) : ''}` : '';

    overlay.innerHTML = `
        <style>
            @keyframes _invFadeIn { from{opacity:0;transform:scale(0.96);} to{opacity:1;transform:scale(1);} }
            #_invoiceOverlay ._invBtn { transition: transform 0.18s, background 0.18s, box-shadow 0.18s; }
            #_invoiceOverlay ._invBtn:hover { transform: translateY(-2px); }
            #_invoiceOverlay ._invClose:hover { background: rgba(0,0,0,0.55) !important; }
        </style>
        <div style="background:linear-gradient(180deg,#1e1e2e 0%,#161620 100%);color:#fff;border:1px solid rgba(255,255,255,0.08);border-radius:20px;width:920px;max-width:96vw;height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 120px rgba(0,0,0,0.7);">
            <div style="flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:linear-gradient(135deg,#c62828 0%,#b71c1c 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex;flex-direction:column;gap:3px;">
                    <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:10px;">📎 الفاتورة المرفقة</div>
                    ${branchLabel ? `<div style="font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;">${branchLabel}</div>` : ''}
                </div>
                <button class="_invClose" onclick="closeInvoiceModal()" style="background:rgba(0,0,0,0.3);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div style="flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,0.35);">
                ${preview}
            </div>
            <div style="flex:0 0 auto;padding:14px 22px;display:flex;gap:12px;justify-content:center;background:rgba(0,0,0,0.55);border-top:1px solid rgba(255,255,255,0.05);">
                <a class="_invBtn" href="${url}" download="${downloadName}" style="padding:11px 30px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;border-radius:11px;text-decoration:none;font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:8px;box-shadow:0 6px 18px rgba(25,118,210,0.45);font-family:Cairo;">⬇ تنزيل الفاتورة</a>
                <button class="_invBtn" onclick="closeInvoiceModal()" style="padding:11px 30px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:11px;cursor:pointer;font-family:Cairo;font-weight:800;font-size:14px;">✕ إغلاق</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // اغلق بـ Esc
    overlay._escHandler = (e) => { if (e.key === 'Escape') closeInvoiceModal(); };
    document.addEventListener('keydown', overlay._escHandler);
}

function closeInvoiceModal() {
    const o = document.getElementById('_invoiceOverlay');
    if (!o) return;
    if (o._escHandler) document.removeEventListener('keydown', o._escHandler);
    const url = o.dataset.blobUrl;
    o.remove();
    if (url && url.startsWith('blob:')) {
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1000);
    }
}

/* ── حالة محرر نص الشكوى (HTML مع تنسيق ولون) ── */
let _notifyNotesHtml = '';
let _notifySavedRange = null;

function _onNotifyNotesEdit() {
    const el = document.getElementById('_notifyNotesEditor');
    if (el) _notifyNotesHtml = el.innerHTML;
}

function _saveEditorSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const editor = document.getElementById('_notifyNotesEditor');
    if (editor && editor.contains(range.commonAncestorContainer)) {
        _notifySavedRange = range.cloneRange();
    }
}

function _restoreEditorSelection() {
    if (!_notifySavedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_notifySavedRange);
    return true;
}

function _notifyApplyFormat(cmd, value) {
    const el = document.getElementById('_notifyNotesEditor');
    if (!el) return;
    el.focus();
    _restoreEditorSelection(); // أعد التحديد المحفوظ بعد فقد التركيز
    try { document.execCommand(cmd, false, value || null); } catch {}
    _onNotifyNotesEdit();
}

// راقب تغيّر التحديد عالمياً واحفظه إن كان داخل المحرّر
document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const editor = document.getElementById('_notifyNotesEditor');
    if (!editor) return;
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
        _notifySavedRange = range.cloneRange();
    }
});

function _notifyResetNotes() {
    _notifyNotesHtml = '';
    refreshNotifyCard();
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

    // إزالة شريط أدوات المحرر + الإطار المتقطّع من الصورة
    const cloneToolbar = clone.querySelector('._notifyToolbar');
    if (cloneToolbar) cloneToolbar.remove();
    const cloneEditor = clone.querySelector('#_notifyNotesEditor');
    if (cloneEditor) {
        cloneEditor.removeAttribute('contenteditable');
        cloneEditor.style.border = 'none';
        cloneEditor.style.padding = '0';
        cloneEditor.style.background = 'transparent';
        cloneEditor.style.minHeight = '0';
    }

    document.body.appendChild(clone);

    try {
        const base = await html2canvas(clone, {
            scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
        });

        if (item.type === 'سوء تعامل') {
            // نسخة واحدة فقط لشكاوى سوء التعامل
            _triggerDownload(base, 'شكوى سوء تعامل');
        } else {
            _triggerDownload(base, 'نسخة مدراء الأفرع');
            const samer = _appendStatusCanvas(base, item.auditStatus || '—');
            _triggerDownload(samer, 'نسخة سامر');
        }

    } catch (e) {
        alert('تعذّر التصدير، تأكد من أن المتصفح محدّث.');
        console.error(e);
    } finally {
        document.body.removeChild(clone);
        btn.disabled    = false;
        btn.textContent = item.type === 'سوء تعامل' ? 'تصدير الصورة ⬇️' : 'تصدير الصورتين ⬇️';
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
    const ccActions   = (document.getElementById('notifyCcActions')?.value || '').trim();
    const auditStatus = item.auditStatus || '—';
    // اسم الموظف القابل للتعديل (لمدير الكول سنتر) — يستبدل الاسم الافتراضي
    const empNameInput = (document.getElementById('notifyEmpName')?.value || '').trim();
    // مدير الكول سنتر / المدير → يحصل على محرّر نصّ غني (Bold/لون/توسيط/إلخ)
    const isMgr = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    const _notesBlock = isMgr ? `
        <div class="_notifyToolbar" style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;background:#f5f5f5;padding:6px;border-radius:6px;border:1px dashed #ccc;">
            <button onmousedown="event.preventDefault()" onclick="_notifyApplyFormat('bold')"        title="عريض" style="padding:4px 10px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer;font-weight:800;font-family:Cairo;font-size:13px;">B</button>
            <button onmousedown="event.preventDefault()" onclick="_notifyApplyFormat('italic')"      title="مائل" style="padding:4px 10px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer;font-style:italic;font-family:Cairo;font-size:13px;">I</button>
            <button onmousedown="event.preventDefault()" onclick="_notifyApplyFormat('underline')"   title="تسطير" style="padding:4px 10px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer;text-decoration:underline;font-family:Cairo;font-size:13px;">U</button>
            <span style="border-left:1px solid #ddd;margin:0 4px;"></span>
            <button onmousedown="event.preventDefault()" onclick="_notifyApplyFormat('justifyRight')"  title="محاذاة يمين" style="padding:4px 10px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer;font-family:Cairo;font-size:13px;">⇥</button>
            <button onmousedown="event.preventDefault()" onclick="_notifyApplyFormat('justifyCenter')" title="توسيط"      style="padding:4px 10px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer;font-family:Cairo;font-size:13px;">↔</button>
            <button onmousedown="event.preventDefault()" onclick="_notifyApplyFormat('justifyLeft')"   title="محاذاة يسار" style="padding:4px 10px;border:1px solid #bbb;border-radius:5px;background:#fff;cursor:pointer;font-family:Cairo;font-size:13px;">⇤</button>
            <span style="border-left:1px solid #ddd;margin:0 4px;"></span>
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#666;cursor:pointer;">🎨 لون
                <input type="color" onchange="_notifyApplyFormat('foreColor', this.value)" style="width:28px;height:24px;border:1px solid #bbb;border-radius:4px;cursor:pointer;padding:0;">
            </label>
            <span style="border-left:1px solid #ddd;margin:0 4px;"></span>
            <button onmousedown="event.preventDefault()" onclick="_notifyResetNotes()" title="إعادة تعيين" style="padding:4px 10px;border:1px solid #f44336;border-radius:5px;background:#ffebee;color:#c62828;cursor:pointer;font-family:Cairo;font-size:12px;font-weight:700;">↺ إعادة</button>
        </div>
        <div id="_notifyNotesEditor" contenteditable="true" oninput="_onNotifyNotesEdit()" style="color:#222;font-size:17px;font-weight:700;line-height:1.8;padding:8px 10px;min-height:40px;background:#fff;border:1px dashed #c62828;border-radius:5px;outline:none;">${_notifyNotesHtml || sanitize(item.notes)}</div>
    ` : `<div style="color:#222;font-size:17px;font-weight:700;line-height:1.8;">${sanitize(item.notes)}</div>`;

    const exportBtn = document.getElementById('exportNotifyBtn');
    if (exportBtn) {
        exportBtn.disabled = !personName;
        exportBtn.style.opacity = personName ? '1' : '0.4';
        exportBtn.style.cursor  = personName ? 'pointer' : 'not-allowed';
    }

    // ── تنسيق خاص لشكاوى سوء التعامل ──
    if (item.type === 'سوء تعامل') {
        // زر التصدير لا يحتاج personName في هذا التنسيق
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.style.opacity = '1';
            exportBtn.style.cursor  = 'pointer';
            exportBtn.textContent = 'تصدير الصورة ⬇️';
        }
        document.getElementById('notifyCard').innerHTML = `
            <div style="text-align:center;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #c62828;">
                ${_logoBase64 ? `<img src="${_logoBase64}" style="width:90px;height:90px;object-fit:contain;display:block;margin:0 auto 10px;filter:drop-shadow(0 2px 8px rgba(198,40,40,0.25));">` : ''}
                <div style="font-size:30px;font-weight:800;color:#c62828;">شكوى سوء تعامل</div>
                <div style="font-size:14px;font-weight:700;color:#888;margin-top:4px;">محامص الشعب — قسم متابعة الشكاوى</div>
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

            <div style="margin-bottom:18px;padding:14px 16px;background:#fff3f3;border-right:4px solid #c62828;border-radius:6px;">
                <div style="font-weight:800;color:#c62828;margin-bottom:7px;font-size:16px;">📋 نص الشكوى المرسلة</div>
                ${_notesBlock}
            </div>

            ${ccActions ? `<div style="margin-bottom:18px;padding:14px 16px;background:#e3f2fd;border-right:4px solid #1565c0;border-radius:6px;">
                <div style="font-weight:800;color:#0d47a1;margin-bottom:7px;font-size:16px;">📞 إجراءات الكول سنتر</div>
                <div style="color:#222;font-size:17px;font-weight:700;line-height:1.8;white-space:pre-wrap;">${sanitize(ccActions)}</div>
            </div>` : ''}

            <div style="margin-bottom:14px;padding-top:14px;border-top:2px solid #eee;text-align:center;font-size:15px;font-weight:700;color:#444;">
                👤 اسم الموظف المدخل للشكوى: <strong style="font-size:17px;color:#222;">${sanitize(empNameInput || item.addedBy || '—')}</strong>
            </div>

            <div style="padding:14px 16px;border-radius:8px;text-align:center;background:#fff8e1;border:2px solid #f57f17;">
                <div style="font-size:12px;color:#999;margin-bottom:6px;">حالة الملاحظة</div>
                <div style="font-size:18px;font-weight:800;color:#bf360c;">جاري تدقيق الملاحظة من قسم السيطرة</div>
            </div>
        `;
        return;
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
            ${_notesBlock}
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
            👤 <strong style="font-size:18px;">اسم الموظف: ${sanitize(empNameInput || currentUser.name)}</strong>
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
        if (typeof _logAudit === 'function') _logAudit('assignControlSub', item.branch || '—', `إسناد لـ ${emp.name}`);
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
        item.audit                   = val;
        item.auditStatus             = statusVal;
        item.auditBy                 = currentUser.name;
        item.auditTime               = now();
        item.controlSubReplyApproved = true;
        if (typeof _logAudit === 'function') _logAudit('controlSubReply', item.branch || '—', val.substring(0, 80));
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
    if (typeof _logAudit === 'function') _logAudit('approveControlSubReply', item.branch || '—', (item.controlSubReply || '').substring(0, 80));
    save();
}

function returnControlSubReply(id) {
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.controlSubReplyReturned = true;
        item.controlSubReply         = null;
        if (typeof _logAudit === 'function') _logAudit('returnSubReply', item.branch || '—', `إرجاع لـ ${item.assignedToSubName || '—'}`);
        save();
    }
}

function deleteControlSubReply(id) {
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        const _wasName = item.assignedToSubName || '—';
        item.assignedToSubId         = null;
        item.assignedToSubName       = null;
        item.controlSubReply         = null;
        item.controlSubReplyBy       = null;
        item.controlSubReplyTime     = null;
        item.controlSubReplyReturned = false;
        item.controlSubReplyApproved = false;
        if (typeof _logAudit === 'function') _logAudit('deleteSubReply', item.branch || '—', `إلغاء إسناد ${_wasName}`);
        save();
    }
}

function saveControlSubReplyEdit(id) {
    const val = document.getElementById(`subReplyEdit-${id}`)?.value.trim();
    if (!val) return alert("يرجى كتابة التعديل");
    const item = db.complaints.find(x => x.id === id);
    if (item) {
        item.controlSubReply = val;
        if (typeof _logAudit === 'function') _logAudit('editControlSubReply', item.branch || '—', val.substring(0, 80));
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
        const old = item.auditStatus || '—';
        item.auditStatus = val;
        if (typeof _logAudit === 'function') _logAudit('editAuditStatus', item.branch || '—', `${old} → ${val}`);
        save();
    }
}

function toggleCountComplaint(id) {
    const item    = db.complaints.find(x => x.id === id);
    if (!item) return;
    const role    = currentUser?.role;
    const isAdmin = currentUser?.isAdmin;
    let _action = '';
    if (role === 'control_employee') {
        const _addedByEmp = employees.find(e => e.name === item.addedBy);
        const _blocked = ['مدير الكول سنتر','موظف كول سنتر','موظف ميديا'].includes(_addedByEmp?.title);
        if (_blocked) return;
        item.countedByControl = !item.countedByControl;
        _action = item.countedByControl ? 'احتساب (سيطرة)' : 'تراجع عن الاحتساب (سيطرة)';
    } else if (role === 'cc_manager' || isAdmin) {
        item.countedByCC = !item.countedByCC;
        item.countedByCCSource = item.countedByCC ? 'control' : null;
        _action = item.countedByCC ? 'احتساب (كول سنتر)' : 'تراجع عن الاحتساب (كول سنتر)';
    }
    if (_action && typeof _logAudit === 'function') _logAudit('toggleCountComplaint', item.branch || '—', _action);
    save();
}

/* ══════════════════════════════════════════════════════
   COMPENSATIONS — تعويض الفروع بناء على شكاوي السيطرة
══════════════════════════════════════════════════════ */

function _setCompFieldsLocked(locked) {
    const cityEl   = document.getElementById('compCity');
    const branchEl = document.getElementById('compBranch');
    const notesEl  = document.getElementById('compNotes');
    [cityEl, branchEl].forEach(el => {
        if (!el) return;
        el.disabled = locked;
        el.style.opacity = locked ? '0.6' : '';
        el.style.cursor  = locked ? 'not-allowed' : '';
    });
    if (notesEl) {
        notesEl.readOnly = locked;
        notesEl.style.opacity = locked ? '0.6' : '';
        notesEl.style.cursor  = locked ? 'not-allowed' : '';
    }
}

function onCompComplaintSelect() {
    const cid = document.getElementById('compLinkedComplaint')?.value;
    if (!cid) {
        _setCompFieldsLocked(false);
        const n = document.getElementById('compNotes'); if (n) n.value = '';
        return;
    }
    const complaint = (db.complaints || []).find(c => c.id === Number(cid));
    if (!complaint) return;
    // ملء المحافظة والفرع
    const cityEl = document.getElementById('compCity');
    if (cityEl && complaint.city) {
        cityEl.value = complaint.city;
        updateBranches('compCity', 'compBranch');
        const branchEl = document.getElementById('compBranch');
        if (branchEl && complaint.branch) branchEl.value = complaint.branch;
    }
    // ملء نص الشكوى
    const notesEl = document.getElementById('compNotes');
    if (notesEl) notesEl.value = complaint.notes || '';
    // تأمين الحقول
    _setCompFieldsLocked(true);
}

function _populateCompComplaintSelect() {
    const sel = document.getElementById('compLinkedComplaint');
    if (!sel) return;
    const linked = new Set(
        (db.compensations || []).filter(x => !x.deleted && x.linkedComplaintId)
                                .map(x => x.linkedComplaintId)
    );
    const eligible = (db.complaints || []).filter(x => !x.deleted && x.type === 'مالية' && !linked.has(x.id));
    sel.innerHTML = '<option value="">— اختر شكوى سيطرة مالية (إجباري) —</option>' +
        eligible.map(x =>
            `<option value="${x.id}">[${x.iso||''}] ${sanitize(x.branch)} — ${sanitize(x.city)} | ${sanitize((x.notes||'').substring(0,50))}</option>`
        ).join('');
}

function addCompensation() {
    if (!perm('addComp') && !currentUser?.isAdmin) return;
    const country= document.getElementById('compCountry')?.value || '';
    const city   = document.getElementById('compCity')?.value || '';
    const branch = document.getElementById('compBranch')?.value || '';
    const notes  = document.getElementById('compNotes')?.value.trim() || '';
    const emp    = document.getElementById('compEmployeeName')?.value.trim() || '';
    const amount = document.getElementById('compAmount')?.value.trim() || '';
    const cid       = document.getElementById('compLinkedComplaint')?.value || '';
    const adminNote = document.getElementById('compAdminNote')?.value.trim() || '';

    if (!city || !branch || !notes || !emp || !amount) return alert('يرجى إكمال جميع الحقول');
    if (!cid) return alert('يرجى ربط شكوى سيطرة مالية بالتعويض');

    if (cid) {
        const alreadyLinked = (db.compensations || []).some(x => !x.deleted && x.linkedComplaintId == cid);
        if (alreadyLinked) return alert('هذه الشكوى مرتبطة بتعويض آخر مسبقاً');
    }

    if (!db.compensations) db.compensations = [];
    db.compensations.unshift({
        id: Date.now(),
        country: country || _countryForCity(city),
        city, branch, notes,
        employeeName: emp,
        amount,
        linkedComplaintId: cid ? Number(cid) : null,
        adminNote,
        addedBy: currentUser.name,
        time: now(),
        iso: iso()
    });
    save();

    document.getElementById('compNotes').value        = '';
    document.getElementById('compAdminNote').value     = '';
    document.getElementById('compEmployeeName').value = '';
    document.getElementById('compAmount').value       = '';
    const _cco = document.getElementById('compCountry'); if (_cco) _cco.value = '';
    document.getElementById('compCity').value         = '';
    if (typeof updateCities === 'function') updateCities('compCountry','compCity','compBranch');
    else updateBranches('compCity', 'compBranch');
    _populateCompComplaintSelect();
    renderCompensations();
}

function deleteCompensation(id) {
    if (!perm('deleteComp') && !currentUser?.isAdmin) return;
    const item = (db.compensations || []).find(x => x.id === id);
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--text-main);margin-bottom:4px;">${sanitize(item.branch)} &nbsp;—&nbsp; ${sanitize(item.city)}</div>
         <div style="color:var(--text-dim);">الموظف: ${sanitize(item.employeeName)} &nbsp;|&nbsp; القيمة: ${sanitize(item.amount)} د.أ</div>`,
        () => {
            item.deleted      = true;
            item.deletedBy    = currentUser.name;
            item.deletedAtTs  = Date.now();
            save();
            renderCompensations();
            _populateCompComplaintSelect();
        }
    );
}

function renderCompensations() {
    const tbody = document.querySelector('#tableComp tbody');
    if (!tbody) return;

    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') && tbody.contains(active)) return;

    const country= document.getElementById('searchCountryComp')?.value|| '';
    const city   = document.getElementById('compSearchCity')?.value   || '';
    const branch = document.getElementById('compSearchBranch')?.value || '';
    const date   = document.getElementById('compSearchDate')?.value   || '';

    const rows = (db.compensations || []).filter(x =>
        !x.deleted &&
        (!country|| (x.country || _countryForCity(x.city)) === country) &&
        (!city   || x.city   === city)   &&
        (!branch || x.branch === branch) &&
        (!date   || (x.iso  || '').startsWith(date))
    );

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:28px;">لا توجد تعويضات مسجلة</td></tr>';
        return;
    }

    const canDelete = perm('deleteComp') || currentUser?.isAdmin;

    tbody.innerHTML = rows.map(x => {
        const linked = x.linkedComplaintId
            ? (db.complaints || []).find(c => c.id === x.linkedComplaintId)
            : null;
        const linkedBadge = linked
            ? `<div onclick="jumpToComplaint(${linked.id})" style="margin-top:6px;font-size:11px;background:rgba(21,101,192,0.15);color:#64b5f6;padding:4px 10px;border-radius:6px;display:inline-block;cursor:pointer;border:1px solid rgba(21,101,192,0.3);" title="انتقل لشكوى السيطرة">🔗 شكوى: ${sanitize(linked.branch)} — ${sanitize((linked.notes||'').substring(0,40))} ↗</div>`
            : '';
        const adminNoteBadge = x.adminNote
            ? `<div style="margin-top:8px;padding:8px 12px;border-radius:8px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.08);"><span style="font-size:11px;font-weight:700;color:#fbbf24;display:block;margin-bottom:3px;">✏️ ملاحظة المسؤول</span><span style="font-size:13px;color:var(--text-main);">${sanitize(x.adminNote)}</span></div>`
            : '';
        return `<tr>
            <td><b>${sanitize(x.branch)}</b><br><small>${sanitize(x.city)}</small></td>
            <td>${sanitize(x.notes)}${linkedBadge}${adminNoteBadge}</td>
            <td>${sanitize(x.employeeName)}</td>
            <td style="font-weight:700;color:#81c784;">${sanitize(x.amount)} د.أ</td>
            <td><small>${sanitize(x.addedBy)}</small><br><small style="color:var(--text-dim);">${sanitize(x.time)}</small></td>
            <td>${canDelete ? `<button class="btn-delete-sm" onclick="deleteCompensation(${x.id})">🗑</button>` : '—'}</td>
        </tr>`;
    }).join('');
}

function jumpToComplaint(id) {
    switchTab('c');
    setTimeout(() => {
        const row = document.querySelector(`#tableC tbody tr[data-id="${id}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.transition = 'outline 0s, box-shadow 0.3s';
        row.style.boxShadow  = 'inset 0 0 0 3px #2e7d32';
        setTimeout(() => { row.style.boxShadow = ''; }, 2500);
    }, 300);
}
