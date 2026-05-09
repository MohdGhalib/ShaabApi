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
    // مربع "هل المنتسية موجودة؟" يظهر فقط لاستفسار عن منتسيات
    const mxBox = document.getElementById("iMontasiaExistsBox");
    if (mxBox) mxBox.style.display = (t === "استفسار عن منتسيات") ? "block" : "none";
    if (t !== "استفسار عن منتسيات") {
        const exYes = document.getElementById('iMontasiaExistsYes');
        const exNo  = document.getElementById('iMontasiaExistsNo');
        if (exYes) exYes.checked = false;
        if (exNo)  exNo.checked  = false;
        const sBox = document.getElementById('iMontasiaSerialBox');
        if (sBox) sBox.style.display = 'none';
        const sIn  = document.getElementById('iMontasiaSerial');
        if (sIn) sIn.value = '';
    }
}

/* ── إظهار/إخفاء حقل رقم المنتسية حسب اختيار "نعم/لا" ── */
function _toggleMontasiaSerialBox() {
    const yes = document.getElementById('iMontasiaExistsYes')?.checked;
    const sBox = document.getElementById('iMontasiaSerialBox');
    if (sBox) sBox.style.display = yes ? 'block' : 'none';
    if (!yes) {
        const sIn = document.getElementById('iMontasiaSerial');
        if (sIn) sIn.value = '';
        const prv = document.getElementById('iMontasiaPreview');
        if (prv) { prv.style.display = 'none'; prv.innerHTML = ''; }
    }
}

/* ── البحث برقم المنتسية في نموذج الاستفسار ──
   - يتحقق من وجود الرقم
   - يعرض كامل التفاصيل في صندوق معاينة
   - يثبّت الدولة/المحافظة/الفرع تلقائياً على نموذج الاستفسار */
function _searchMontasiaBySerialFromInquiry() {
    const inEl = document.getElementById('iMontasiaSerial');
    const prv  = document.getElementById('iMontasiaPreview');
    if (!inEl || !prv) return;
    const serial = (inEl.value || '').trim();
    if (!serial) { prv.style.display = 'none'; prv.innerHTML = ''; return alert('يرجى إدخال رقم المنتسية'); }
    const _norm = serial.replace(/[-\s]/g, '');
    const m = (db.montasiat || []).find(x => !x.deleted && (x.serial||'').replace(/[-\s]/g,'') === _norm);
    if (!m) {
        prv.style.display = 'block';
        prv.innerHTML = `<div style="background:rgba(211,47,47,0.08);border:1px dashed rgba(211,47,47,0.4);border-radius:10px;padding:12px;color:#ef9a9a;font-size:13px;font-weight:700;text-align:center;">✗ لم يتم العثور على منتسية بالرقم: ${sanitize(serial)}</div>`;
        return;
    }
    // ── تثبيت الدولة/المحافظة/الفرع تلقائياً
    const ctryEl = document.getElementById('iCountryAdd');
    const cityEl = document.getElementById('iCityAdd');
    const brEl   = document.getElementById('iBranchAdd');
    if (ctryEl && m.country) {
        ctryEl.value = m.country;
        if (typeof updateCities === 'function') updateCities('iCountryAdd','iCityAdd','iBranchAdd');
    }
    if (cityEl && m.city) {
        cityEl.value = m.city;
        if (typeof updateBranches === 'function') updateBranches('iCityAdd','iBranchAdd');
    }
    if (brEl && m.branch) brEl.value = m.branch;
    if (typeof toggleUnspecifiedBranch === 'function') toggleUnspecifiedBranch();

    // ── بناء صندوق التفاصيل الكاملة
    const _row = (k, v) => v ? `<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="background:rgba(255,255,255,0.05);padding:7px 12px;color:var(--text-dim);font-weight:700;min-width:130px;">${k}</span><span style="padding:7px 12px;color:var(--text-main);">${v}</span></div>` : '';
    const _items = (Array.isArray(m.items) && m.items.length)
        ? `<div style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);"><b>الأصناف:</b><ul style="margin:4px 0 0;padding-right:18px;">${m.items.map(it => `<li>${sanitize(it.name||'')}${it.value?` — قيمة: ${sanitize(it.value)}`:''}${it.weight?` — وزن: ${sanitize(it.weight)}`:''}${it.notes?` — ${sanitize(it.notes)}`:''}</li>`).join('')}</ul></div>`
        : '';
    const _statusColor = m.status === 'تم التسليم' ? '#a5d6a7' : m.status === 'مرفوضة' ? '#ef9a9a' : '#ffd54f';
    const _reservedNote = m.reservedFor && m.reservedFor.inqSeq
        ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(255,152,0,0.08);border:1px dashed rgba(255,152,0,0.4);border-radius:8px;color:#ffb74d;font-size:12px;font-weight:700;text-align:center;">⚠️ هذه المنتسية محجوزة بالفعل لاستفسار آخر #${sanitize(m.reservedFor.inqSeq)} (${sanitize(m.reservedFor.phone||'—')})</div>`
        : '';
    prv.style.display = 'block';
    prv.innerHTML = `
        <div style="background:rgba(46,125,50,0.05);border:1px solid rgba(46,125,50,0.4);border-radius:12px;overflow:hidden;">
            <div style="padding:10px 14px;background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.08));font-size:13px;font-weight:700;color:#a5d6a7;display:flex;justify-content:space-between;align-items:center;">
                <span>✓ منتسية موجودة — #${sanitize(m.serial||'')}</span>
                <span style="background:rgba(0,0,0,0.18);padding:3px 10px;border-radius:6px;font-family:monospace;color:${_statusColor};font-size:11px;">${sanitize(m.status||'—')}</span>
            </div>
            <div style="font-size:12px;line-height:1.7;">
                ${_row('الفرع المبلِّغ', sanitize((m.branch||'—') + ' — ' + (m.city||'—')))}
                ${_row('النوع', sanitize(m.type||'—'))}
                ${_row('التفاصيل', sanitize(m.notes||''))}
                ${_row('القيمة المالية المفقودة', sanitize(m.missingValue||''))}
                ${_row('اسم الصنف', sanitize(m.roastItemName||''))}
                ${_row('قيمة الصنف', sanitize(m.roastItemValue||''))}
                ${_row('الوزن', sanitize(m.roastItemWeight||''))}
                ${_items}
                ${_row('موظف الفرع', sanitize(m.branchEmp||''))}
                ${_row('وقت التبليغ', sanitize(m.time||''))}
                ${_row('سجّل بواسطة', sanitize(m.addedBy||''))}
            </div>
            <div style="padding:10px 14px;background:rgba(100,181,246,0.06);border-top:1px solid rgba(100,181,246,0.25);font-size:12px;color:#90caf9;text-align:center;font-weight:700;">
                📌 تم تثبيت الفرع <b style="color:#fff;">${sanitize(m.branch||'')} — ${sanitize(m.city||'')}</b> على نموذج الاستفسار
            </div>
            ${_reservedNote}
        </div>`;
}

/* ── إظهار فلتر "نوع الشكوى" في شريط بحث الاستفسارات عند اختيار "شكوى" فقط ── */
function _toggleComplaintTypeFilterI() {
    const sel    = document.getElementById('searchTypeI');
    const wrap   = document.getElementById('searchComplaintTypeIWrap');
    const subSel = document.getElementById('searchComplaintTypeI');
    if (!wrap) return;
    const show = sel && sel.value === 'شكوى';
    wrap.style.display = show ? '' : 'none';
    if (!show && subSel) subSel.value = '';
}

/* ── بحث مباشر داخل جدول الاستفسارات حسب الرقم المُدخَل في حقل العميل ──
   عند الكتابة في حقل رقم الهاتف بنموذج الإضافة، يفلتر الجدول لإظهار سجلات
   نفس الرقم فقط (للوصول لتاريخ مكالمات الزبون). يُفرَّغ تلقائياً عند الحفظ. */
function _iLivePhoneSearch(val) {
    const v = (val || '').trim();
    window._iLivePhoneFilter = v;
    if (typeof filterTable === 'function') filterTable();
    // مؤشر بصري لطي الجدول لنتائج هذا الرقم فقط
    const tbl = document.getElementById('tableI');
    if (tbl) tbl.style.outline = v ? '2px solid rgba(100,181,246,0.5)' : '';
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

    // ── استفسار عن منتسيات: تحقق من اختيار "نعم/لا" ورقم المنتسية إن كان "نعم"
    let _montasiaSerialInput = '';
    let _montasiaExistsAns = '';
    if (t === "استفسار عن منتسيات") {
        const exYes = document.getElementById('iMontasiaExistsYes')?.checked;
        const exNo  = document.getElementById('iMontasiaExistsNo')?.checked;
        if (!exYes && !exNo) return alert('يرجى تحديد: هل المنتسية موجودة؟ (نعم/لا)');
        _montasiaExistsAns = exYes ? 'yes' : 'no';
        if (exYes) {
            const _raw = (document.getElementById('iMontasiaSerial')?.value || '').trim();
            if (!_raw) return alert('يرجى إدخال رقم المنتسية');
            // طبيع الرقم (إزالة "-") ثم ابحث في القائمة بمقارنة طبيعية
            _montasiaSerialInput = _raw.replace(/[-\s]/g, '');
            const _foundM = (db.montasiat || []).find(x => !x.deleted && (x.serial||'').replace(/[-\s]/g,'') === _montasiaSerialInput);
            if (!_foundM) return alert('رقم المنتسية غير موجود في النظام: ' + _raw);
            // اعتمد القيمة المحفوظة في DB لضمان التطابق
            _montasiaSerialInput = _foundM.serial;
        }
    }
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
        montasiaExists: _montasiaExistsAns || '',
        montasiaSerial: _montasiaSerialInput || '',
        time: now(), iso: iso(), addedBy: currentUser.name
    };

    // صورة الصنف لشكاوى "جودة صنف" — base64
    let qualityPhotoInput = null;
    if (ct === 'جودة صنف') qualityPhotoInput = document.getElementById('iQualityPhoto');

    const _afterSave = () => {
        save();
        document.getElementById("iPhone").value="";
        // أزل فلتر البحث المباشر بالرقم وأعد الجدول للحالة الكاملة
        window._iLivePhoneFilter = '';
        const _tblI = document.getElementById('tableI'); if (_tblI) _tblI.style.outline = '';
        document.getElementById("iType").value="";
        document.getElementById("iNotes").value="";
        document.getElementById("iNotesBox").style.display="none";
        const _ctSel = document.getElementById("iComplaintType"); if (_ctSel) _ctSel.value = "";
        const _ctBox = document.getElementById("iComplaintTypeBox"); if (_ctBox) _ctBox.style.display = "none";
        const _iName = document.getElementById("iItemName"); if (_iName) _iName.value = "";
        const _iBox  = document.getElementById("iItemNameBox"); if (_iBox) _iBox.style.display = "none";
        const _qPh   = document.getElementById("iQualityPhoto"); if (_qPh) _qPh.value = "";
        const _qPhL  = document.getElementById("iQualityPhotoLabel"); if (_qPhL) { _qPhL.textContent = 'لم تُختر صورة'; _qPhL.style.color = 'var(--text-dim)'; }
        // تنظيف حقول "هل المنتسية موجودة؟"
        const _mxYes = document.getElementById('iMontasiaExistsYes'); if (_mxYes) _mxYes.checked = false;
        const _mxNo  = document.getElementById('iMontasiaExistsNo');  if (_mxNo)  _mxNo.checked  = false;
        const _mSrl  = document.getElementById('iMontasiaSerial');    if (_mSrl)  _mSrl.value    = '';
        const _mxBox = document.getElementById('iMontasiaExistsBox'); if (_mxBox) _mxBox.style.display = 'none';
        const _msBox = document.getElementById('iMontasiaSerialBox'); if (_msBox) _msBox.style.display = 'none';
        const _mPrv  = document.getElementById('iMontasiaPreview');   if (_mPrv)  { _mPrv.style.display = 'none'; _mPrv.innerHTML = ''; }
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

/* ══════════════════════════════════════════════════════
   حجز المنتسية للزبون من داخل الاستفسار
   - يطلب تأكيداً بنص المنتسية وتفاصيلها الكاملة
   - يضع فرع المنتسية ونصها على بيانات الزبون في الاستفسار
   - يربط المنتسية بالاستفسار (reservedFor) لإظهار زر "رقم الزبون"
══════════════════════════════════════════════════════ */
function reserveMontasiaForInquiry(inqId) {
    const inq = (db.inquiries || []).find(x => x.id === inqId);
    if (!inq) return alert('الاستفسار غير موجود');
    const serial = (inq.montasiaSerial || '').trim();
    if (!serial) return alert('لا يوجد رقم منتسية مرتبط بهذا الاستفسار');
    const m = (db.montasiat || []).find(x => !x.deleted && x.serial === serial);
    if (!m) return alert('لم يتم العثور على المنتسية رقم ' + serial);

    if (m.reservedFor && m.reservedFor.inqId && m.reservedFor.inqId !== inqId) {
        const _otherInq = (db.inquiries || []).find(q => q.id === m.reservedFor.inqId);
        if (_otherInq && !_otherInq.deleted) {
            return alert('هذه المنتسية محجوزة بالفعل لاستفسار آخر #' + (m.reservedFor.inqSeq || '—') + ' — لا يمكن حجزها مرتين');
        }
    }
    if (m.status === 'تم التسليم') {
        return alert('لا يمكن حجز منتسية تم تسليمها بالفعل');
    }

    // بناء تفاصيل المنتسية للعرض
    const _details = [];
    _details.push(`<div><b>رقم المنتسية:</b> ${sanitize(m.serial || '—')}</div>`);
    _details.push(`<div><b>الفرع المبلِّغ:</b> ${sanitize(m.branch || '—')} — ${sanitize(m.city || '—')}</div>`);
    _details.push(`<div><b>النوع:</b> ${sanitize(m.type || '—')}</div>`);
    _details.push(`<div><b>الحالة:</b> ${sanitize(m.status || '—')}</div>`);
    if (m.notes)          _details.push(`<div><b>التفاصيل:</b> ${sanitize(m.notes)}</div>`);
    if (m.missingValue)   _details.push(`<div><b>القيمة المالية المفقودة:</b> ${sanitize(m.missingValue)}</div>`);
    if (m.roastItemName)  _details.push(`<div><b>اسم الصنف:</b> ${sanitize(m.roastItemName)}</div>`);
    if (m.roastItemValue) _details.push(`<div><b>قيمة الصنف:</b> ${sanitize(m.roastItemValue)}</div>`);
    if (m.roastItemWeight)_details.push(`<div><b>الوزن:</b> ${sanitize(m.roastItemWeight)}</div>`);
    if (m.branchEmp)      _details.push(`<div><b>موظف الفرع:</b> ${sanitize(m.branchEmp)}</div>`);
    if (m.time)           _details.push(`<div><b>وقت التبليغ:</b> ${sanitize(m.time)}</div>`);

    const overlay = document.createElement('div');
    overlay.id = '_reserveMontasiaConfirm';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:20px;
                    padding:28px 26px;width:520px;max-width:94vw;box-shadow:0 30px 60px rgba(0,0,0,0.5);max-height:88vh;overflow:auto;">
            <div style="font-size:30px;text-align:center;margin-bottom:8px;">📦</div>
            <h3 style="margin:0 0 10px;color:var(--accent-red);text-align:center;">تأكيد حجز المنتسية للزبون</h3>
            <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;
                        padding:14px 16px;font-size:13px;line-height:1.9;color:var(--text-main);margin-bottom:14px;">
                ${_details.join('')}
            </div>
            <div style="background:rgba(255,193,7,0.08);border:1px dashed rgba(255,193,7,0.45);border-radius:10px;
                        padding:12px;font-size:13px;color:#ffd54f;text-align:center;font-weight:700;margin-bottom:14px;">
                ⚠️ تأكد أن هذه المنتسية تابعة للزبون نفسه قبل الحجز
            </div>
            <div style="font-size:12px;color:var(--text-dim);text-align:center;margin-bottom:14px;">
                سيتم تحديث الاستفسار: المحافظة → <b>${sanitize(m.city||'—')}</b>، الفرع → <b>${sanitize(m.branch||'—')}</b>،
                وإضافة نص المنتسية إلى ملاحظات الاستفسار.
            </div>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button onclick="confirmReserveMontasia(${inqId})"
                    style="padding:9px 22px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:'Cairo';font-weight:700;">
                    ✓ تأكيد الحجز للزبون
                </button>
                <button onclick="document.getElementById('_reserveMontasiaConfirm')?.remove()"
                    style="padding:9px 22px;background:rgba(211,47,47,0.12);color:#ef9a9a;border:1px solid rgba(211,47,47,0.4);border-radius:10px;cursor:pointer;font-family:'Cairo';font-weight:700;">
                    إلغاء
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function confirmReserveMontasia(inqId) {
    const ov = document.getElementById('_reserveMontasiaConfirm');
    if (ov) ov.remove();
    const inq = (db.inquiries || []).find(x => x.id === inqId);
    if (!inq) return alert('الاستفسار غير موجود');
    const serial = (inq.montasiaSerial || '').trim();
    const m = (db.montasiat || []).find(x => !x.deleted && x.serial === serial);
    if (!m) return alert('لم يتم العثور على المنتسية');

    // 1) حدّث الاستفسار: الفرع/المحافظة + إضافة نص المنتسية للملاحظات
    inq.city   = m.city   || inq.city;
    inq.branch = m.branch || inq.branch;
    if (m.country) inq.country = m.country;
    const mText = (m.notes || '').trim();
    if (mText) {
        const tag = `[منتسية #${m.serial}] ${mText}`;
        inq.notes = inq.notes ? (inq.notes + '\n' + tag) : tag;
    }
    inq.reservedMontasiaSerial = m.serial;
    inq.reservedMontasiaId     = m.id;
    inq.reservedAt             = now();
    inq.reservedBy             = currentUser?.name || '—';

    // 2) حدّث المنتسية: ربطها بالزبون عبر الاستفسار
    m.reservedFor = {
        inqId:   inq.id,
        inqSeq:  inq.seq,
        phone:   inq.phone || '',
        name:    inq.addedBy || '',
        at:      now(),
        by:      currentUser?.name || '—'
    };

    if (typeof _logAudit === 'function') {
        _logAudit('reserveMontasia', m.branch || '—', `حجز للزبون ${inq.phone||'—'} | استفسار #${inq.seq}`, 'montasia', m.id);
    }
    save();
    alert('✓ تم حجز المنتسية #' + m.serial + ' للزبون بنجاح');
    if (typeof renderAll === 'function') renderAll();
}
