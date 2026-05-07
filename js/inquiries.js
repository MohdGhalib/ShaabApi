/* ══════════════════════════════════════════════════════
   INQUIRIES — CRUD operations
══════════════════════════════════════════════════════ */
function toggleInquiryNotes() {
    const t = document.getElementById("iType").value;
    document.getElementById("iNotesBox").style.display = (t==="شكوى"||t==="أخرى") ? "block" : "none";
    const itemBox = document.getElementById("iItemNameBox");
    if (itemBox) itemBox.style.display = (t === "استفسار عن أصناف") ? "block" : "none";
    if (t !== "استفسار عن أصناف") {
        const _i = document.getElementById("iItemName"); if (_i) _i.value = '';
    }
    const ctBox = document.getElementById("iComplaintTypeBox");
    if (ctBox) ctBox.style.display = (t === "شكوى") ? "block" : "none";
    if (t !== "شكوى") {
        const ctSel = document.getElementById("iComplaintType");
        if (ctSel) ctSel.value = "";
        toggleComplaintFinancialBox();
    }
}

function toggleComplaintFinancialBox() {
    const ct = document.getElementById("iComplaintType")?.value || '';
    const fin = document.getElementById("iFinancialBox");
    if (fin) fin.style.display = (ct === "مالية") ? "block" : "none";
    if (ct !== "مالية") {
        // تنظيف الحقول لو الصندوق أُخفي
        ['iMoveNumber','iInvoiceValue','iNoteDate'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
        const _f = document.getElementById('iFile'); if (_f) _f.value = '';
        const _l = document.getElementById('iFileLabel'); if (_l) _l.textContent = 'لم يُختر ملف';
        const _disp = document.getElementById('iNoteDate-display');
        if (_disp) { _disp.textContent = '📅 اختر التاريخ'; _disp.classList.remove('selected'); }
    }
    // مربع رفع صورة الصنف لشكاوى "جودة صنف"
    const qBox = document.getElementById("iQualityPhotoBox");
    if (qBox) qBox.style.display = (ct === "جودة صنف") ? "block" : "none";
    if (ct !== "جودة صنف") {
        const _q = document.getElementById('iQualityPhoto');      if (_q) _q.value = '';
        const _ql= document.getElementById('iQualityPhotoLabel'); if (_ql) { _ql.textContent = 'لم تُختر صورة'; _ql.style.color = 'var(--text-dim)'; }
    }
}

function toggleUnspecifiedBranch() {
    const type    = document.getElementById("iType")?.value || '';
    const cityEl  = document.getElementById("iCityAdd");
    const branchEl= document.getElementById("iBranchAdd");
    if (!cityEl || !branchEl) return;

    // إذا كان شكوى: احذف خيار "غير محدد" إن وُجد
    if (type === 'شكوى') {
        const opt = cityEl.querySelector('option[value="غير محدد"]');
        if (opt) {
            opt.remove();
            if (cityEl.value === 'غير محدد') { cityEl.value = ''; branchEl.innerHTML = '<option value="">الفرع</option>'; }
        }
        return;
    }

    // غير شكوى: أضف خيار "غير محدد" إن لم يكن موجوداً
    if (!cityEl.querySelector('option[value="غير محدد"]')) {
        const opt = document.createElement('option');
        opt.value = 'غير محدد'; opt.textContent = 'غير محدد الفرع';
        cityEl.insertBefore(opt, cityEl.options[1]);
    }

    // إذا اختار "غير محدد": أفرغ الفرع وضع قيمة افتراضية
    if (cityEl.value === 'غير محدد') {
        branchEl.innerHTML = '<option value="غير محدد">غير محدد</option>';
    }
}

function addInquiry() {
    const ctryEl = document.getElementById("iCountryAdd");
    const cityEl  = document.getElementById("iCityAdd");
    const branchEl= document.getElementById("iBranchAdd");
    const co = ctryEl ? ctryEl.value : '';
    const c = cityEl.value, t = document.getElementById("iType").value;
    const p = document.getElementById("iPhone").value;
    const b = c === 'غير محدد' ? 'غير محدد' : branchEl.value;
    const needsNotes = (t==="شكوى"||t==="أخرى");
    const n = needsNotes ? document.getElementById("iNotes").value.trim() : "";
    const ct = (t === "شكوى") ? (document.getElementById("iComplaintType")?.value || '') : '';
    const itemName = (t === "استفسار عن أصناف") ? (document.getElementById("iItemName")?.value.trim() || '') : '';
    if (!c||!b||!p||!t) return alert("يرجى إكمال البيانات");
    if (needsNotes&&!n) return alert("يرجى كتابة التفاصيل");
    if (t === "شكوى" && !ct) return alert("يرجى تحديد نوع الشكوى");
    if (t === "استفسار عن أصناف" && !itemName) return alert("يرجى كتابة اسم الصنف");
    let invoiceValue='', moveNumber='', noteDate='';
    let fileInput = null;
    if (ct === "مالية") {
        invoiceValue = document.getElementById("iInvoiceValue")?.value.trim() || '';
        moveNumber   = document.getElementById("iMoveNumber")?.value.trim()   || '';
        noteDate     = document.getElementById("iNoteDate")?.value            || '';
        fileInput    = document.getElementById("iFile");
    }

    if (!db.inquiriesnqSeq) db.inquiriesnqSeq = 1;
    const baseRec = {
        id: Date.now(), seq: db.inquiriesnqSeq++,
        country: co || _countryForCity(c), city:c, branch:b, phone:p,
        type:t, notes:n,
        complaintType: ct || null,
        invoiceValue: invoiceValue || '',
        moveNumber:   moveNumber   || '',
        noteDate:     noteDate     || '',
        itemName: itemName || '',
        time: now(), iso: iso(), addedBy: currentUser.name
    };

    // صورة الصنف لشكاوى "جودة صنف" — base64
    let qualityPhotoInput = null;
    if (ct === 'جودة صنف') qualityPhotoInput = document.getElementById('iQualityPhoto');

    const _afterSave = () => {
        save();
        document.getElementById("iPhone").value="";
        document.getElementById("iType").value="";
        document.getElementById("iNotes").value="";
        document.getElementById("iNotesBox").style.display="none";
        const _ctSel = document.getElementById("iComplaintType"); if (_ctSel) _ctSel.value = "";
        const _ctBox = document.getElementById("iComplaintTypeBox"); if (_ctBox) _ctBox.style.display = "none";
        const _iName = document.getElementById("iItemName"); if (_iName) _iName.value = "";
        const _iBox  = document.getElementById("iItemNameBox"); if (_iBox) _iBox.style.display = "none";
        const _qPh   = document.getElementById("iQualityPhoto"); if (_qPh) _qPh.value = "";
        const _qPhL  = document.getElementById("iQualityPhotoLabel"); if (_qPhL) { _qPhL.textContent = 'لم تُختر صورة'; _qPhL.style.color = 'var(--text-dim)'; }
        toggleComplaintFinancialBox();
        if (ctryEl) ctryEl.value = "";
        document.getElementById("iCityAdd").value="";
        if (typeof updateCities === 'function') updateCities("iCountryAdd","iCityAdd","iBranchAdd");
        else updateBranches("iCityAdd","iBranchAdd");
        populateLinkedInquirySelect();
        toggleUnspecifiedBranch();
    };

    // قراءة الفاتورة (للشكاوى المالية) ثم صورة الجودة (لشكاوى جودة صنف) ثم الحفظ
    const _readQualityPhotoThenSave = (recWithFile) => {
        if (qualityPhotoInput && qualityPhotoInput.files && qualityPhotoInput.files[0]) {
            const f = qualityPhotoInput.files[0];
            if (f.size > 5 * 1024 * 1024) {
                alert('صورة الصنف أكبر من 5MB — لن تُرفق');
                db.inquiries.unshift({ ...recWithFile, qualityPhoto: null });
            } else {
                const r2 = new FileReader();
                r2.onload = e2 => {
                    db.inquiries.unshift({ ...recWithFile, qualityPhoto: e2.target.result });
                    if (typeof _logAudit === 'function') _logAudit('addInquiry', baseRec.branch || '—', `${baseRec.type} — ${(baseRec.notes||baseRec.itemName||baseRec.offerName||'').substring(0,40)}`, 'inquiry', baseRec.id);
                    _afterSave();
                };
                r2.readAsDataURL(f);
                return;
            }
        } else {
            db.inquiries.unshift({ ...recWithFile, qualityPhoto: null });
        }
        if (typeof _logAudit === 'function') _logAudit('addInquiry', baseRec.branch || '—', `${baseRec.type} — ${(baseRec.notes||baseRec.itemName||baseRec.offerName||'').substring(0,40)}`, 'inquiry', baseRec.id);
        _afterSave();
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            _readQualityPhotoThenSave({ ...baseRec, file: e.target.result });
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        _readQualityPhotoThenSave({ ...baseRec, file: null });
    }
}


function deleteInquiry(id) {
    const item = db.inquiries.find(x => x.id === id);
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--text-main);margin-bottom:4px;">${sanitize(item.branch)} &nbsp;—&nbsp; ${sanitize(item.city)}</div>
         <div style="color:var(--text-dim);">${sanitize(item.type)}${item.notes ? ' — ' + sanitize(item.notes.length > 60 ? item.notes.slice(0,60) + '…' : item.notes) : ''}</div>
         <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">📞 ${sanitize(item.phone)} &nbsp;|&nbsp; 📥 ${sanitize(item.addedBy||'—')}</div>`,
        () => {
            item.deleted     = true;
            item.deletedBy   = currentUser ? currentUser.name : '—';
            item.deletedAtTs = Date.now();
            _logAudit('deleteInquiry', item.branch || '—', `${item.branch} — ${item.type}`);
            save();
            populateLinkedInquirySelect();
        }
    );
}

function startEditInquiry(id) {
    const box = document.getElementById(`inqEdit-${id}`);
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function saveEditInquiry(id) {
    const phone = document.getElementById(`inqPhone-${id}`)?.value.trim();
    const notes = document.getElementById(`inqNotes-${id}`)?.value.trim();
    if (!phone) return alert("يرجى إدخال رقم الهاتف");
    const item = db.inquiries.find(x => x.id === id);
    if (item) {
        item.phone   = phone;
        item.notes   = notes;
        item.editedBy = currentUser.name;
        if (typeof _logAudit === 'function') _logAudit('editInquiry', item.branch || '—', `${item.type} — ${(notes||'').substring(0,40)}`);
        save();
    }
}

function jumpToInquiry(seq) {
    switchTab('i');
    setTimeout(() => {
        const rows = document.querySelectorAll('#tableI tbody tr');
        rows.forEach(r => {
            r.style.outline = '';
            const seqCell = r.querySelector('.seq-badge');
            if (seqCell && seqCell.textContent.trim() === '#'+seq) {
                r.style.outline = '2px solid var(--accent-red)';
                r.scrollIntoView({ behavior:'smooth', block:'center' });
            }
        });
    }, 200);
}

function toggleCountInquiry(id) {
    const inq = db.inquiries.find(x => x.id === id);
    if (!inq || inq.type !== 'شكوى') return;
    const role    = currentUser?.role;
    const isAdmin = currentUser?.isAdmin;
    if (role !== 'cc_manager' && !isAdmin) return;

    // إذا الاستفسار مرتبط بشكوى في السيطرة → احتسب على الشكوى لا على الاستفسار
    const linked = db.complaints.find(c => !c.deleted && String(c.linkedInqSeq) === String(inq.seq));
    if (linked) {
        linked.countedByCC = !linked.countedByCC;
        linked.countedByCCSource = linked.countedByCC ? 'inquiry' : null;
    } else {
        inq.countedByCC = !inq.countedByCC;
        inq.countedByCCSource = inq.countedByCC ? 'inquiry' : null;
    }
    save();
}

/* ══════════════════════════════════════════════════════
   MEDIA NOTES — ملاحظات الزبائن (شكاوي الميديا)
══════════════════════════════════════════════════════ */
function addMediaNote() {
    const city   = document.getElementById('mnCity')?.value   || '';
    const branch = document.getElementById('mnBranch')?.value || '';
    const phone  = document.getElementById('mnPhone')?.value.trim()  || '';
    const notes  = document.getElementById('mnNotes')?.value.trim()  || '';

    if (!city || !branch || !phone || !notes) return alert('يرجى إكمال جميع الحقول');

    if (!db.inquiriesnqSeq) db.inquiriesnqSeq = 1;
    db.inquiries.unshift({
        id: Date.now(), seq: db.inquiriesnqSeq++,
        city, branch, phone, type: 'شكوى', notes,
        time: now(), iso: iso(), addedBy: currentUser.name
    });
    save();

    document.getElementById('mnPhone').value = '';
    document.getElementById('mnNotes').value = '';
    document.getElementById('mnCity').value  = '';
    updateBranches('mnCity', 'mnBranch');
    populateLinkedInquirySelect();
    renderMediaNotes();
}

function renderMediaNotes() {
    const tbody = document.querySelector('#tableMN tbody');
    if (!tbody) return;

    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const fCity   = get('mnSearchCity');
    const fBranch = get('mnSearchBranch');
    const fDate   = get('mnSearchDate');
    const fText   = get('mnSearchText').toLowerCase();
    const fStatus = get('mnSearchStatus');

    const myNotes = (db.inquiries || []).filter(x => {
        if (x.deleted || x.type !== 'شكوى' || x.addedBy !== currentUser?.name) return false;
        if (fCity   && x.city   !== fCity)   return false;
        if (fBranch && x.branch !== fBranch) return false;
        if (fDate   && !(x.iso||'').startsWith(fDate)) return false;
        if (fText   && !(x.phone||'').includes(fText) && !(x.notes||'').toLowerCase().includes(fText)) return false;
        if (fStatus) {
            const isLinked = (db.complaints||[]).some(c => !c.deleted && String(c.linkedInqSeq) === String(x.seq));
            if (fStatus === 'مرتبطة' && !isLinked) return false;
            if (fStatus === 'بانتظار' && isLinked)  return false;
        }
        return true;
    });

    if (!myNotes.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:28px;">لا توجد ملاحظات مسجلة</td></tr>';
        return;
    }

    tbody.innerHTML = myNotes.map(x => {
        const linked = (db.complaints || []).find(c => !c.deleted && String(c.linkedInqSeq) === String(x.seq));
        const statusBadge = linked
            ? `<span style="padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(46,125,50,0.18);color:#81c784;">🔗 مرتبطة بسيطرة</span>`
            : `<span style="padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(255,152,0,0.15);color:#ffb74d;">⏳ بانتظار الربط</span>`;
        return `<tr>
            <td><span class="seq-badge" style="font-size:12px;font-weight:700;">#${x.seq}</span></td>
            <td><b>${sanitize(x.branch)}</b><br><small>${sanitize(x.city)}</small></td>
            <td>${sanitize(x.phone)}</td>
            <td>${sanitize(x.notes)}</td>
            <td>${statusBadge}</td>
            <td><small>${_toLatinDigits ? _toLatinDigits(x.time) : x.time}</small></td>
        </tr>`;
    }).join('');
}
