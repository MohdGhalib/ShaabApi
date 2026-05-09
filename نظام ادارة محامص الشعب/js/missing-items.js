/* ══════════════════════════════════════════════════════
   MISSING ITEMS — CRUD with 5-second confirm overlay
══════════════════════════════════════════════════════ */
/* ── حالة نافذة وقت تسجيل المنتسية ── */
let _addMTimeMode = 'now';

/* ── إظهار/إخفاء الحقول الإضافية حسب نوع المنتسية ── */
function toggleMontasiaTypeFields() {
    const t = document.getElementById('mType')?.value || '';
    const box   = document.getElementById('mTypeExtraBox');
    const cash  = document.getElementById('mCashFields');
    const roast = document.getElementById('mRoastFields');
    const wF    = document.getElementById('mRoastWeightFields');
    const vF    = document.getElementById('mRoastValueFields');
    const nWrap = document.getElementById('mNotesWrap');
    const multi = document.getElementById('mMultiFieldsWrap');
    if (!box) return;
    box.style.display = 'none';
    if (cash)  cash.style.display  = 'none';
    if (roast) roast.style.display = 'none';
    if (wF)    wF.style.display    = 'none';
    if (vF)    vF.style.display    = 'none';
    if (multi) multi.style.display = 'none';
    document.querySelectorAll('input[name="mRoastSub"]').forEach(r => r.checked = false);
    if (t === 'نقدي') {
        box.style.display = '';
        if (cash) cash.style.display = '';
    } else if (t === 'اصناف محمص الشعب') {
        box.style.display = '';
        if (roast) roast.style.display = '';
    } else if (t === 'متعدد الأصناف') {
        if (multi) multi.style.display = '';
        // ابدأ بصف واحد فارغ لتيسير الاستخدام
        if (typeof _clearMultiItemRows === 'function') _clearMultiItemRows();
        if (typeof _addMultiItemRow === 'function' && document.querySelectorAll('.m-multi-row').length === 0) {
            _addMultiItemRow();
        }
    }
    // التفاصيل (ملاحظة عامة) تظهر مع "أخرى" أو "متعدد الأصناف"
    if (nWrap) nWrap.style.display = (t === 'أخرى' || t === 'متعدد الأصناف') ? '' : 'none';
}

function toggleRoastSubMode() {
    const sub = document.querySelector('input[name="mRoastSub"]:checked')?.value || '';
    const wrap = document.getElementById('mRoastFreeWrap');
    if (wrap) wrap.style.display = sub ? '' : 'none';
}

/* ── تعديل سريع للنوع وحالة التسليم (لمدير الكول سنتر فقط) ── */
function _onTypeEditChange(id) {
    const sel   = document.getElementById('typeEditSel-' + id);
    const cash  = document.getElementById('typeEditCash-' + id);
    const other = document.getElementById('typeEditOther-' + id);
    const roast = document.getElementById('typeEditRoast-' + id);
    const wF    = document.getElementById('typeEditRoastWeight-' + id);
    const vF    = document.getElementById('typeEditRoastValue-' + id);
    if (cash)  cash.style.display  = 'none';
    if (other) other.style.display = 'none';
    if (roast) roast.style.display = 'none';
    if (wF)    wF.style.display    = 'none';
    if (vF)    vF.style.display    = 'none';
    document.querySelectorAll(`input[name="typeEditSub-${id}"]`).forEach(r => r.checked = false);
    const v = sel?.value || '';
    if (v === 'نقدي' && cash) cash.style.display = 'flex';
    else if (v === 'اخرى' && other) other.style.display = 'flex';
    else if (v === 'اصناف محمص الشعب' && roast) roast.style.display = 'flex';
}

function _onTypeEditSubChange(id) {
    const sub = document.querySelector(`input[name="typeEditSub-${id}"]:checked`)?.value || '';
    const wF = document.getElementById('typeEditRoastWeight-' + id);
    const vF = document.getElementById('typeEditRoastValue-' + id);
    if (wF) wF.style.display = sub === 'وزن'  ? 'flex' : 'none';
    if (vF) vF.style.display = sub === 'قيمة' ? 'flex' : 'none';
}

function editMontasiaType(id) {
    if (currentUser?.role !== 'cc_manager') return;
    const item = db.montasiat.find(x => x.id === id);
    if (!item) return;
    // النوع متعدد الأصناف يُعدَّل عبر نافذة منفصلة
    if (item.type === 'متعدد الأصناف' && typeof openMultiItemEditModal === 'function') {
        openMultiItemEditModal(id);
        return;
    }
    const view = document.getElementById('typeView-' + id);
    const edit = document.getElementById('typeEdit-' + id);
    const sel  = document.getElementById('typeEditSel-' + id);
    if (sel) sel.value = item.type || 'اخرى';
    // Pre-fill extra fields
    const _setVal = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
    _setVal('typeEditMissingValue-' + id, item.missingValue);
    _setVal('typeEditNotesCash-'    + id, item.notes);
    _setVal('typeEditNotesOther-'   + id, item.notes);
    _setVal('typeEditRoastValueW-' + id,  item.roastItemValue);
    _setVal('typeEditRoastNameW-' + id,   item.roastItemName);
    _setVal('typeEditRoastWeightW-' + id, item.roastItemWeight);
    _setVal('typeEditRoastNameV-' + id,   item.roastItemName);
    _setVal('typeEditRoastValueV-' + id,  item.roastItemValue);
    if (view) view.style.display = 'none';
    if (edit) edit.style.display = 'flex';
    _onTypeEditChange(id);
    if (item.roastSubType) {
        const subRadio = document.querySelector(`input[name="typeEditSub-${id}"][value="${item.roastSubType}"]`);
        if (subRadio) { subRadio.checked = true; _onTypeEditSubChange(id); }
    }
}

function cancelMontasiaTypeEdit(id) {
    const view = document.getElementById('typeView-' + id);
    const edit = document.getElementById('typeEdit-' + id);
    if (edit) edit.style.display = 'none';
    if (view) view.style.display = 'flex';
}

function saveMontasiaType(id) {
    if (currentUser?.role !== 'cc_manager') return;
    const item = db.montasiat.find(x => x.id === id);
    const sel  = document.getElementById('typeEditSel-' + id);
    if (!item || !sel) return;
    const newType = sel.value;

    const _extras = {};
    let   _newNotes = null;            // null = لا تُعدَّل التفاصيل
    if (newType === 'نقدي') {
        const mv = (document.getElementById('typeEditMissingValue-' + id)?.value || '').trim();
        if (!mv) return alert('يرجى إدخال القيمة المالية المفقودة');
        _extras.missingValue = mv;
        const nc = (document.getElementById('typeEditNotesCash-' + id)?.value || '').trim();
        _newNotes = nc;                // اختيارية
    } else if (newType === 'اخرى') {
        const no = (document.getElementById('typeEditNotesOther-' + id)?.value || '').trim();
        if (!no) return alert('يرجى كتابة التفاصيل');
        _newNotes = no;
    } else if (newType === 'اصناف محمص الشعب') {
        const sub = document.querySelector(`input[name="typeEditSub-${id}"]:checked`)?.value || '';
        if (!sub) return alert('يرجى اختيار "وزن" أو "قيمة"');
        _extras.roastSubType = sub;
        if (sub === 'وزن') {
            const v  = (document.getElementById('typeEditRoastValueW-' + id)?.value  || '').trim();
            const nm = (document.getElementById('typeEditRoastNameW-' + id)?.value   || '').trim();
            const w  = (document.getElementById('typeEditRoastWeightW-' + id)?.value || '').trim();
            if (!v || !nm || !w) return alert('يرجى إكمال (القيمة المالية، اسم الصنف، الوزن)');
            _extras.roastItemValue = v; _extras.roastItemName = nm; _extras.roastItemWeight = w;
        } else {
            const nm = (document.getElementById('typeEditRoastNameV-' + id)?.value  || '').trim();
            const v  = (document.getElementById('typeEditRoastValueV-' + id)?.value || '').trim();
            if (!nm || !v) return alert('يرجى إكمال (اسم الصنف، القيمة المالية)');
            _extras.roastItemName = nm; _extras.roastItemValue = v;
        }
    }

    item.type = newType;
    if (newType !== 'نقدي') item.missingValue = '';
    if (newType !== 'اصناف محمص الشعب') {
        item.roastSubType    = '';
        item.roastItemName   = '';
        item.roastItemValue  = '';
        item.roastItemWeight = '';
    } else if (_extras.roastSubType === 'قيمة') {
        // عند التحويل من وزن إلى قيمة: امسح حقل الوزن نهائيًا
        item.roastItemWeight = '';
    }
    Object.assign(item, _extras);
    if (_newNotes !== null) item.notes = _newNotes;
    if (typeof _logAudit === 'function') _logAudit('editMontasiaType', item.branch || '—', `${_montasiaSummary(item).substring(0,40)} → ${newType}`, 'montasia', item.id);
    save();
    renderAll();
}

function editMontasiaStatus(id) {
    if (currentUser?.role !== 'cc_manager') return;
    const item = db.montasiat.find(x => x.id === id);
    if (!item) return;
    const view = document.getElementById('statusView-' + id);
    const edit = document.getElementById('statusEdit-' + id);
    const sel  = document.getElementById('statusEditSel-' + id);
    if (sel) sel.value = (item.status === 'تم التسليم') ? 'تم التسليم' : 'قيد الانتظار';
    if (view) view.style.display = 'none';
    if (edit) edit.style.display = 'flex';
}

function cancelMontasiaStatusEdit(id) {
    const view = document.getElementById('statusView-' + id);
    const edit = document.getElementById('statusEdit-' + id);
    if (edit) edit.style.display = 'none';
    if (view) view.style.display = 'flex';
}

function saveMontasiaStatus(id) {
    if (currentUser?.role !== 'cc_manager') return;
    const item = db.montasiat.find(x => x.id === id);
    const sel  = document.getElementById('statusEditSel-' + id);
    if (!item || !sel) return;
    const newStatus = sel.value;
    if (newStatus !== item.status) {
        item.status = newStatus;
        if (newStatus === 'تم التسليم') {
            if (!item.dt) item.dt = now();
            if (!item.deliveredBy) item.deliveredBy = currentUser?.name || '—';
        } else if (newStatus === 'قيد الانتظار') {
            item.dt = '';
            item.deliveredBy = '';
        }
        if (typeof _logAudit === 'function') _logAudit('editMontasiaStatus', item.branch || '—', `${_montasiaSummary(item).substring(0,40)} → ${newStatus}`, 'montasia', item.id);
        save();
    }
    renderAll();
}

function _toggleRoastSubFilter(suffix) {
    const tEl = document.getElementById('searchType' + suffix);
    const wrap = document.getElementById('searchRoastSub' + suffix + 'Wrap');
    const sel  = document.getElementById('searchRoastSub' + suffix);
    if (!wrap) return;
    const show = tEl?.value === 'اصناف محمص الشعب';
    wrap.style.display = show ? '' : 'none';
    if (!show && sel) sel.value = '';
}

function _resetMontasiaExtraFields() {
    ['mMissingValue','mRoastFreeText']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.querySelectorAll('input[name="mRoastSub"]').forEach(r => r.checked = false);
    const box = document.getElementById('mTypeExtraBox');
    if (box) box.style.display = 'none';
    ['mCashFields','mRoastFields','mRoastFreeWrap']
        .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const nWrap = document.getElementById('mNotesWrap');
    if (nWrap) nWrap.style.display = 'none';
    const multi = document.getElementById('mMultiFieldsWrap');
    if (multi) multi.style.display = 'none';
    if (typeof _clearMultiItemRows === 'function') _clearMultiItemRows();
}

function addMontasia() {
    const c = document.getElementById("mCityAdd").value;
    const b = document.getElementById("mBranchAdd").value;
    const n = document.getElementById("mNotes").value.trim();
    const t = document.getElementById("mType").value;
    const be = (document.getElementById("mBranchEmp")?.value||'').trim();
    if (!c||!b||!t||!be) return alert("يرجى إكمال البيانات");
    if (t === 'أخرى' && !n) return alert("يرجى إكمال البيانات");
    if (t === 'متعدد الأصناف') {
        const probe = (typeof _collectMultiItems === 'function') ? _collectMultiItems() : { error:'حقل الأصناف غير متاح' };
        if (probe.error) return alert(probe.error);
    }

    // فتح نافذة اختيار وقت التسجيل
    _addMTimeMode = 'now';
    selectAddMTimeMode('now');
    const prevDate = document.getElementById('addMPrevDate');
    const prevDisp = document.getElementById('addMPrevDate-display');
    const prevTime = document.getElementById('addMPrevTime');
    const prevReason = document.getElementById('addMPrevReason');
    if (prevDate) prevDate.value = '';
    if (prevDisp) { prevDisp.textContent = '📅 اختر التاريخ'; prevDisp.classList.remove('selected'); }
    if (prevTime) prevTime.value = '';
    if (prevReason) prevReason.value = '';
    document.getElementById("addMontasiaTimeModal").classList.remove("hidden");
}

function selectAddMTimeMode(mode) {
    _addMTimeMode = mode;
    const nowCard    = document.getElementById('addMNowCard');
    const prevCard   = document.getElementById('addMPrevCard');
    const prevFields = document.getElementById('addMPrevFields');
    if (nowCard)  { nowCard.style.borderColor  = mode==='now'      ? 'var(--accent-red)' : ''; nowCard.style.background  = mode==='now'      ? 'var(--soft-red)' : ''; }
    if (prevCard) { prevCard.style.borderColor = mode==='previous' ? 'var(--accent-red)' : ''; prevCard.style.background = mode==='previous' ? 'var(--soft-red)' : ''; }
    if (prevFields) prevFields.style.display = mode==='previous' ? 'block' : 'none';
}

function cancelAddMontasia() {
    document.getElementById("addMontasiaTimeModal").classList.add("hidden");
}

function confirmAddMontasia() {
    const co = document.getElementById("mCountryAdd")?.value || '';
    const c = document.getElementById("mCityAdd").value;
    const b = document.getElementById("mBranchAdd").value;
    const n = document.getElementById("mNotes").value.trim();
    const t = document.getElementById("mType").value;
    const be = (document.getElementById("mBranchEmp")?.value||'').trim();
    if (!c||!b||!t||!be) return alert("يرجى إكمال البيانات");
    if (t === 'أخرى' && !n) return alert("يرجى إكمال البيانات");

    const _extra = {};
    if (t === 'نقدي') {
        const mv = (document.getElementById('mMissingValue')?.value || '').trim();
        if (!mv) return alert('يرجى إدخال القيمة المالية المفقودة');
        _extra.missingValue = mv;
    } else if (t === 'اصناف محمص الشعب') {
        const sub = document.querySelector('input[name="mRoastSub"]:checked')?.value || '';
        if (!sub) return alert('يرجى اختيار "وزن" أو "قيمة" أو "وزن وقيمة"');
        const txt = (document.getElementById('mRoastFreeText')?.value || '').trim();
        if (!txt) return alert('يرجى كتابة تفاصيل الصنف');
        _extra.roastSubType    = sub;
        _extra.roastItemName   = txt;
        _extra.roastItemValue  = '';
        _extra.roastItemWeight = '';
    } else if (t === 'متعدد الأصناف') {
        const collected = (typeof _collectMultiItems === 'function') ? _collectMultiItems() : { error:'حقل الأصناف غير متاح' };
        if (collected.error) return alert(collected.error);
        _extra.items = collected.items;
    }

    const rec = { id:Date.now(), country: co || _countryForCity(c), city:c, branch:b, notes:n, type:t, branchEmp:be, time:now(), iso:iso(),
        status:'قيد الانتظار', dt:'', addedBy:currentUser.name, deliveredBy:'', ..._extra };

    if (_addMTimeMode === 'previous') {
        const dateVal = document.getElementById('addMPrevDate')?.value;
        const timeVal = document.getElementById('addMPrevTime')?.value;
        const reasonVal = (document.getElementById('addMPrevReason')?.value||'').trim();
        if (!dateVal) return alert("يرجى تحديد تاريخ التسجيل السابق");
        if (!timeVal) return alert("يرجى تحديد وقت التسجيل السابق");
        if (!reasonVal) return alert("يرجى كتابة سبب التسجيل بوقت سابق");
        const [y,m,d] = dateVal.split('-');
        const _h = parseInt(timeVal.split(':')[0]||0);
        const _m = (timeVal.split(':')[1]||'00');
        const _ampm = _h>=12?'PM':'AM';
        const _h12 = _h%12||12;
        rec.time = `${parseInt(d)}/${parseInt(m)}/${y}، ${_h12}:${_m} ${_ampm}`;
        rec.iso  = `${y}-${m}-${d}`;
        rec.addLateReason   = reasonVal;
        rec.addLateNotedAt  = now();
        rec.isLateAdd       = true;
    }

    rec.serial = _genMontasiaSerial(rec.iso);

    db.montasiat.unshift(rec);
    if (typeof _skipMontasiaNotif !== 'undefined') _skipMontasiaNotif = true;
    if (typeof _logAudit === 'function') {
        _logAudit('addMontasia', rec.branch || '—', `${rec.type} — #${rec.serial} — ${_montasiaSummary(rec).substring(0,80)}`, 'montasia', rec.id);
    }
    save();
    document.getElementById("mNotes").value = "";
    document.getElementById("mType").value = "";
    _resetMontasiaExtraFields();
    const beEl = document.getElementById("mBranchEmp"); if (beEl) beEl.value = "";
    const ctryEl = document.getElementById("mCountryAdd"); if (ctryEl) ctryEl.value = "";
    document.getElementById("mCityAdd").value = "";
    if (typeof updateCities === 'function') updateCities("mCountryAdd","mCityAdd","mBranchAdd");
    else updateBranches("mCityAdd", "mBranchAdd");
    cancelAddMontasia();
}

function showAddLateNote(id) {
    const item = db.montasiat.find(x => x.id === id);
    if (!item || !item.addLateReason) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:24px;
                    padding:36px 32px;width:420px;max-width:92vw;box-shadow:0 30px 60px rgba(0,0,0,0.5);">
            <div style="font-size:28px;text-align:center;margin-bottom:10px;">📝</div>
            <h3 style="margin:0 0 6px;color:var(--accent-red);text-align:center;">سبب التسجيل بوقت سابق</h3>
            <div style="font-size:13px;color:var(--text-dim);text-align:center;margin-bottom:20px;">
                ${sanitize(item.branch)} — ${sanitize(item.city)}
                ${item.addLateNotedAt ? `<br><span style="color:var(--text-main);font-weight:700;">⏰ وقت تسجيل الملاحظة: ${typeof _toLatinDigits==='function'?_toLatinDigits(item.addLateNotedAt):item.addLateNotedAt}</span>` : ''}
            </div>
            <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:14px;
                        padding:16px;font-size:14px;color:var(--text-main);line-height:1.8;text-align:right;">
                ${sanitize(item.addLateReason)}
            </div>
            <button onclick="this.closest('.snModal').remove()"
                style="width:100%;margin-top:20px;padding:12px;border:1px solid var(--border);
                       border-radius:12px;background:var(--bg-input);color:var(--text-dim);
                       font-family:'Cairo';font-size:14px;cursor:pointer;">
                إغلاق
            </button>
        </div>
    `;
    overlay.classList.add('snModal');
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

/* ── Delivery modal ── */
let _deliverId       = null;
let _deliverType     = 'same';
let _deliverTimeMode = 'now';

function deliver(id) {
    const item = db.montasiat.find(x => x.id===id);
    if (!item) return;
    _deliverId       = id;
    _deliverType     = 'same';
    _deliverTimeMode = 'now';

    // معلومات المنتسية
    document.getElementById("deliveryItemInfo").innerHTML =
        `<b style="color:var(--text-main)">${sanitize(item.branch)}</b> &nbsp;—&nbsp; ${sanitize(item.city)}
         <div style="margin-top:4px;font-size:12px;">${sanitize(item.notes.substring(0,60))}${item.notes.length>60?'...':''}</div>`;

    // إعادة ضبط الخيارات
    selectDeliveryType('same');
    selectDeliveryTimeMode('now');

    // تعبئة قائمة الدول والمحافظات (دعم التسليم لدولة أخرى)
    if (typeof setupCountrySelects === 'function') setupCountrySelects();
    const ctryEl = document.getElementById("deliverCountrySelect");
    if (ctryEl) ctryEl.value = '';
    const cityEl = document.getElementById("deliverCitySelect");
    let opts = '<option value="">اختر المحافظة</option>';
    for (let c in branches) opts += `<option value="${c}">${c}</option>`;
    cityEl.innerHTML = opts;
    document.getElementById("deliverBranchSelect").innerHTML = '<option value="">اختر الفرع</option>';
    // إعادة label إلى المحافظة افتراضياً
    document.querySelectorAll('[data-region-label-for="deliverCitySelect"]').forEach(el => el.textContent = 'المحافظة');

    // تفريغ حقول الوقت السابق
    const prevDate = document.getElementById('deliverPrevDate');
    const prevDisp = document.getElementById('deliverPrevDate-display');
    const prevTime = document.getElementById('deliverPrevTime');
    const prevNote = document.getElementById('deliverPrevNotes');
    if (prevDate) prevDate.value = '';
    if (prevDisp) { prevDisp.textContent = '📅 اختر التاريخ'; prevDisp.classList.remove('selected'); }
    if (prevTime) prevTime.value = '';
    if (prevNote) prevNote.value = '';

    document.getElementById("deliveryModal").classList.remove("hidden");
}

function selectDeliveryTimeMode(mode) {
    _deliverTimeMode = mode;
    const nowCard    = document.getElementById('deliverNowCard');
    const prevCard   = document.getElementById('deliverPrevCard');
    const prevFields = document.getElementById('deliverPrevFields');
    if (nowCard)  { nowCard.style.borderColor  = mode==='now'      ? 'var(--accent-red)' : ''; nowCard.style.background  = mode==='now'      ? 'var(--soft-red)' : ''; }
    if (prevCard) { prevCard.style.borderColor = mode==='previous' ? 'var(--accent-red)' : ''; prevCard.style.background = mode==='previous' ? 'var(--soft-red)' : ''; }
    if (prevFields) prevFields.style.display = mode==='previous' ? 'block' : 'none';
}

function selectDeliveryType(type) {
    _deliverType = type;
    const sameCard  = document.getElementById("deliverSameBranchCard");
    const otherCard = document.getElementById("deliverOtherBranchCard");
    const selector  = document.getElementById("deliveryBranchSelector");

    sameCard.style.borderColor  = type === 'same'  ? 'var(--accent-red)' : '';
    sameCard.style.background   = type === 'same'  ? 'var(--soft-red)'   : '';
    otherCard.style.borderColor = type === 'other' ? 'var(--accent-red)' : '';
    otherCard.style.background  = type === 'other' ? 'var(--soft-red)'   : '';
    selector.style.display      = type === 'other' ? 'block' : 'none';
}

function confirmDeliver() {
    const item = db.montasiat.find(x => x.id===_deliverId);
    if (!item) return cancelDeliver();

    if (_deliverType === 'other') {
        const country= document.getElementById("deliverCountrySelect")?.value || '';
        const city   = document.getElementById("deliverCitySelect").value;
        const branch = document.getElementById("deliverBranchSelect").value;
        if (!city || !branch) return alert("يرجى اختيار المحافظة والفرع");
        item.deliveryCountry= country || _countryForCity(city);
        item.deliveryCity   = city;
        item.deliveryBranch = branch;
    }

    if (_deliverTimeMode === 'previous') {
        const dateVal = document.getElementById('deliverPrevDate')?.value;
        const timeVal = document.getElementById('deliverPrevTime')?.value;
        if (!dateVal) return alert("يرجى تحديد تاريخ التسليم");
        if (!timeVal) return alert("يرجى تحديد وقت التسليم");
        // تنسيق: YYYY/MM/DD — HH:MM
        const [y,m,d] = dateVal.split('-');
        item.dt = `${y}/${m}/${d} — ${timeVal}`;
        const notesVal = document.getElementById('deliverPrevNotes')?.value.trim();
        if (notesVal) {
            item.deliverNotes      = notesVal;
            item.deliverNotesAddedAt = now();
        }
        item.isLateDelivery = true;
    } else {
        item.dt = now();
    }

    item.status      = 'تم التسليم';
    item.deliveredBy = currentUser.name;
    if (typeof _logAudit === 'function') _logAudit('deliverMontasia', item.branch || '—', `${_montasiaSummary(item).substring(0,80)}`, 'montasia', item.id);
    save();
    cancelDeliver();
}

function cancelDeliver() {
    _deliverId   = null;
    _deliverType = 'same';
    document.getElementById("deliveryModal").classList.add("hidden");
}

function approveMontasia(id) {
    const item = db.montasiat.find(x => x.id===id);
    if (item) {
        item.status='قيد الانتظار';
        if (typeof _logAudit === 'function') _logAudit('approveMontasia', item.branch || '—', `${_montasiaSummary(item).substring(0,80)}`, 'montasia', item.id);
        save();
    }
}

// الموافقة على منتسيات التطبيق → قيد الانتظار (لتفعيل نظام التسليم)
function approveMontasiaFromMobile(id) {
    const item = db.montasiat.find(x => x.id===id);
    if (!item) return;
    item.status     = 'قيد الانتظار';
    item.approvedBy = currentUser ? currentUser.name : '—';
    item.approvedAt = now();
    if (typeof _logAudit === 'function') _logAudit('approveMontasiaMobile', item.branch || '—', `${_montasiaSummary(item).substring(0,80)}`, 'montasia', item.id);
    save();
}

// عرض صورة المنتسية في نافذة منبثقة
function _showPhoto(idStr) {
    const id   = Number(idStr);
    const item = db.montasiat.find(x => x.id===id);
    if (!item?.photoBase64) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.innerHTML = `<img src="data:image/jpeg;base64,${item.photoBase64}"
        style="max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.6);" />`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

function confirmDeliverDirect(id) {
    const item = db.montasiat.find(x => x.id===id);
    if (!item) return;
    item.status      = 'تم التسليم';
    item.dt          = now();
    item.deliveredBy = currentUser.name;
    save();
}

function showDeliverNotes(id) {
    const item = db.montasiat.find(x => x.id === id);
    if (!item || !item.deliverNotes) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:24px;
                    padding:36px 32px;width:420px;max-width:92vw;box-shadow:0 30px 60px rgba(0,0,0,0.5);">
            <div style="font-size:28px;text-align:center;margin-bottom:10px;">📝</div>
            <h3 style="margin:0 0 6px;color:var(--accent-red);text-align:center;">ملاحظات التسليم</h3>
            <div style="font-size:13px;color:var(--text-dim);text-align:center;margin-bottom:20px;">
                ${sanitize(item.branch)} — ${sanitize(item.city)}
                ${item.deliverNotesAddedAt ? `<br><span style="color:var(--text-main);font-weight:700;">⏰ وقت تسجيل الملاحظة: ${typeof _toLatinDigits==='function'?_toLatinDigits(item.deliverNotesAddedAt):item.deliverNotesAddedAt}</span>` : ''}
            </div>
            <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:14px;
                        padding:16px;font-size:14px;color:var(--text-main);line-height:1.8;text-align:right;">
                ${sanitize(item.deliverNotes)}
            </div>
            <button onclick="this.closest('.snModal').remove()"
                style="width:100%;margin-top:20px;padding:12px;border:1px solid var(--border);
                       border-radius:12px;background:var(--bg-input);color:var(--text-dim);
                       font-family:'Cairo';font-size:14px;cursor:pointer;">
                إغلاق
            </button>
        </div>
    `;
    overlay.classList.add('snModal');
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

function rejectMontasia(id) {
    const item = db.montasiat.find(x => x.id===id);
    if (item) { item.status='مرفوضة'; save(); }
}


function deleteMontasia(id) {
    const item = db.montasiat.find(x => x.id === id);
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--text-main);margin-bottom:4px;">${sanitize(item.branch)} &nbsp;—&nbsp; ${sanitize(item.city)}</div>
         <div style="color:var(--text-dim);">${sanitize(item.notes.length > 80 ? item.notes.slice(0,80) + '…' : item.notes)}</div>
         <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">📥 ${sanitize(item.addedBy||'—')} &nbsp;|&nbsp; ${sanitize(item.time)}</div>`,
        () => {
            item.deleted      = true;
            item.deletedBy    = currentUser ? currentUser.name : '—';
            item.deletedAtTs  = Date.now();
            _logAudit('deleteMontasia', item.branch || '—', `${item.branch} — ${_montasiaSummary(item).substring(0,80)}`);
            save();
        }
    );
}

function startEditMontasia(id) {
    const box = document.getElementById(`edit-${id}`);
    if (box) box.style.display = box.style.display==='none' ? 'block' : 'none';
}

function saveEditMontasia(id) {
    const newText = document.getElementById(`editText-${id}`).value.trim();
    if (!newText) return alert("يرجى كتابة التفاصيل");
    const item = db.montasiat.find(x => x.id===id);
    if (item) {
        item.notes=newText; item.editedBy=currentUser.name;
        if (typeof _logAudit === 'function') _logAudit('editMontasiaNotes', item.branch || '—', `${(newText||'').substring(0,40)}`, 'montasia', item.id);
        save();
    }
}

/* ══ تعديل المحافظة + الفرع لمنتسية موجودة (cc_manager) ══ */
function editMontasiaBranch(id) {
    if (currentUser?.role !== 'cc_manager' && !currentUser?.isAdmin) return;
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    closeEditMontasiaBranchModal();

    const overlay = document.createElement('div');
    overlay.id = '_ebOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100002;display:flex;align-items:center;justify-content:center;font-family:Cairo;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeEditMontasiaBranchModal(); };

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:14px;width:380px;max-width:96vw;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;border-radius:14px 14px 0 0;">
                <h3 style="margin:0;font-size:15px;">📍 تعديل المحافظة والفرع</h3>
                <button onclick="closeEditMontasiaBranchModal()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="padding:16px 18px;">
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;background:var(--bg-input);padding:8px 10px;border-radius:8px;">
                    الحالي: <b style="color:var(--text-main);">${item.city || '—'}</b> / <b style="color:var(--text-main);">${item.branch || '—'}</b>
                </div>
                <label style="display:block;margin-bottom:5px;font-size:12px;color:var(--text-dim);">المحافظة:</label>
                <select id="_ebCity" style="width:100%;padding:8px 10px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;font-family:Cairo;margin-bottom:12px;"></select>
                <label style="display:block;margin-bottom:5px;font-size:12px;color:var(--text-dim);">الفرع:</label>
                <select id="_ebBranch" style="width:100%;padding:8px 10px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;font-family:Cairo;"></select>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button onclick="closeEditMontasiaBranchModal()" style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:Cairo;font-weight:700;font-size:12px;">إلغاء</button>
                    <button onclick="saveMontasiaBranch(${id})" style="padding:8px 18px;border:none;border-radius:8px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;cursor:pointer;font-family:Cairo;font-weight:700;font-size:12px;">💾 حفظ</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // املأ قائمة المحافظات من COUNTRIES_DATA — نطاق دولة المنتسية
    const cityEl = document.getElementById('_ebCity');
    const brEl   = document.getElementById('_ebBranch');
    const country = item.country || 'الأردن';
    const cdata = (typeof COUNTRIES_DATA !== 'undefined') ? COUNTRIES_DATA[country] : null;
    const regions = cdata && cdata.regions ? cdata.regions : {};

    if (cityEl) {
        cityEl.innerHTML = '<option value="">— اختر —</option>' +
            Object.keys(regions).map(c => `<option value="${c}">${c}</option>`).join('');
        cityEl.value = item.city || '';
    }

    // ربط تغيير المحافظة لتحديث الفروع — نستخدم نفس COUNTRIES_DATA لضمان النتيجة
    const repopulateBranches = () => {
        if (!brEl || !cityEl) return;
        const branches = regions[cityEl.value] || [];
        brEl.innerHTML = '<option value="">— اختر —</option>' +
            branches.map(b => `<option value="${b}">${b}</option>`).join('');
    };
    if (cityEl) cityEl.onchange = repopulateBranches;
    repopulateBranches();
    if (brEl) brEl.value = item.branch || '';
}

function closeEditMontasiaBranchModal() {
    const o = document.getElementById('_ebOverlay');
    if (o) o.remove();
}

/* ══ تعديل وقت/موظف الاستلام والتسليم لمنتسية موجودة (cc_manager) ══ */
function _montasiaSummary(item) {
    if (!item) return '';
    if (item.type === 'اصناف محمص الشعب') {
        const sub  = item.roastSubType    ? '['+item.roastSubType+'] '       : '';
        const name = item.roastItemName   ? item.roastItemName               : '';
        const val  = item.roastItemValue  ? ' — قيمة: ' + item.roastItemValue  : '';
        const wt   = item.roastItemWeight ? ' — وزن: '  + item.roastItemWeight : '';
        const out  = (sub + name + val + wt).trim();
        if (out) return out;
    } else if (item.type === 'متعدد الأصناف' && Array.isArray(item.items)) {
        const n = item.items.length;
        const head = item.items.slice(0, 2).map(it => it && it.name ? it.name : '').filter(Boolean).join('، ');
        return n + ' صنف' + (head ? ' — ' + head : '') + (item.notes ? ' — ' + item.notes : '');
    } else if (item.type === 'نقدي' && item.missingValue) {
        return item.missingValue + (item.notes ? ' — ' + item.notes : '');
    }
    return item.notes || '';
}

function _fmtMontasiaTimeFromInputs(dateStr, timeStr) {
    if (!dateStr || !timeStr) return '';
    const [y, mo, d] = dateStr.split('-');
    const [hh, mm] = timeStr.split(':');
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${parseInt(d, 10)}/${parseInt(mo, 10)}/${y}، ${h12}:${mm}:00 ${ampm}`;
}

function _parseMontasiaTimeToInputs(rawStr, isoStr) {
    let dateStr = '', timeStr = '';
    if (isoStr && /^\d{4}-\d{2}-\d{2}$/.test(isoStr)) dateStr = isoStr;
    if (!rawStr) return { date: dateStr, time: timeStr };
    const s = String(rawStr);
    const dm = s.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
    if (!dateStr && dm) {
        let y, mo, d;
        if (dm[1].length === 4) { y = dm[1]; mo = dm[2]; d = dm[3]; }
        else { d = dm[1]; mo = dm[2]; y = dm[3]; }
        dateStr = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const tm = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?/);
    if (tm) {
        let h = parseInt(tm[1], 10);
        const m = tm[2];
        const ap = (tm[3] || '').toUpperCase();
        if (ap === 'PM' && h < 12) h += 12;
        else if (ap === 'AM' && h === 12) h = 0;
        timeStr = `${String(h).padStart(2, '0')}:${m}`;
    }
    return { date: dateStr, time: timeStr };
}

function _openMontasiaTimeEditModal(id, mode) {
    if (currentUser?.role !== 'cc_manager' && !currentUser?.isAdmin) return;
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    closeEditMontasiaTimeModal();

    const isReceipt = mode === 'receipt';
    const title = isReceipt ? '🕒 تعديل وقت/موظف الاستلام' : '🚚 تعديل وقت/موظف التسليم';
    const headerGrad = isReceipt ? 'linear-gradient(135deg,#1976d2,#0d47a1)' : 'linear-gradient(135deg,#2e7d32,#1b5e20)';
    const curTime = isReceipt ? (item.time || '—') : (item.dt || '—');
    const curEmp = isReceipt ? (item.addedBy || '—') : (item.deliveredBy || '—');
    const parsed = _parseMontasiaTimeToInputs(isReceipt ? item.time : item.dt, isReceipt ? item.iso : '');

    const _ccTitles = ['مدير الكول سنتر', 'موظف كول سنتر'];
    const _curEmpName = isReceipt ? (item.addedBy || '') : (item.deliveredBy || '');
    const _ccList = (typeof employees !== 'undefined' && Array.isArray(employees))
        ? employees.filter(e => !e.deleted && _ccTitles.includes(e.title))
        : [];
    if (_curEmpName && !_ccList.some(e => e.name === _curEmpName)) {
        _ccList.unshift({ name: _curEmpName, title: '—' });
    }
    const empOpts = '<option value="">— اختر موظف —</option>' +
        _ccList.map(e => `<option value="${sanitize(e.name)}" ${e.name === _curEmpName ? 'selected' : ''}>${sanitize(e.name)}${e.title && e.title !== '—' ? ' — ' + sanitize(e.title) : ''}</option>`).join('');

    const overlay = document.createElement('div');
    overlay.id = '_emtOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100002;display:flex;align-items:center;justify-content:center;font-family:Cairo;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeEditMontasiaTimeModal(); };

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:14px;width:400px;max-width:96vw;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:${headerGrad};color:#fff;border-radius:14px 14px 0 0;">
                <h3 style="margin:0;font-size:15px;">${title}</h3>
                <button onclick="closeEditMontasiaTimeModal()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="padding:16px 18px;">
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;background:var(--bg-input);padding:8px 10px;border-radius:8px;line-height:1.7;">
                    الحالي: <b style="color:var(--text-main);">${sanitize(curTime)}</b><br>
                    الموظف: <b style="color:var(--text-main);">${sanitize(curEmp)}</b>
                </div>
                <label style="display:block;margin-bottom:5px;font-size:12px;color:var(--text-dim);">التاريخ:</label>
                <input id="_emtDate" type="date" value="${parsed.date}" style="width:100%;padding:8px 10px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;font-family:Cairo;margin-bottom:10px;box-sizing:border-box;">
                <label style="display:block;margin-bottom:5px;font-size:12px;color:var(--text-dim);">الوقت:</label>
                <input id="_emtTime" type="time" value="${parsed.time}" style="width:100%;padding:8px 10px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;font-family:Cairo;margin-bottom:10px;box-sizing:border-box;">
                <label style="display:block;margin-bottom:5px;font-size:12px;color:var(--text-dim);">اسم الموظف (الكول سنتر):</label>
                <select id="_emtEmp" style="width:100%;padding:8px 10px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;font-family:Cairo;box-sizing:border-box;">${empOpts}</select>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button onclick="closeEditMontasiaTimeModal()" style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:Cairo;font-weight:700;font-size:12px;">إلغاء</button>
                    <button onclick="saveMontasiaTimeEdit(${id}, '${isReceipt ? 'receipt' : 'delivery'}')" style="padding:8px 18px;border:none;border-radius:8px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;cursor:pointer;font-family:Cairo;font-weight:700;font-size:12px;">💾 حفظ</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function editMontasiaReceipt(id) { _openMontasiaTimeEditModal(id, 'receipt'); }
function editMontasiaDelivery(id) { _openMontasiaTimeEditModal(id, 'delivery'); }

function closeEditMontasiaTimeModal() {
    const o = document.getElementById('_emtOverlay');
    if (o) o.remove();
}

function saveMontasiaTimeEdit(id, mode) {
    if (currentUser?.role !== 'cc_manager' && !currentUser?.isAdmin) return;
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    const isReceipt = mode === 'receipt';
    const dateVal = (document.getElementById('_emtDate')?.value || '').trim();
    const timeVal = (document.getElementById('_emtTime')?.value || '').trim();
    const empVal  = (document.getElementById('_emtEmp')?.value  || '').trim();
    if (!dateVal) return alert('يرجى تحديد التاريخ');
    if (!timeVal) return alert('يرجى تحديد الوقت');
    if (!empVal)  return alert('يرجى إدخال اسم الموظف');

    if (!isReceipt && (item.status === 'قيد الانتظار' || item.status === 'بانتظار الموافقة' || item.status === 'قيد الاستلام')) {
        return alert('لا يمكن تعديل وقت التسليم لمنتسية لم تُسلَّم بعد');
    }

    const newStr = _fmtMontasiaTimeFromInputs(dateVal, timeVal);
    if (isReceipt) {
        const oldRef = `${item.time || '—'} / ${item.addedBy || '—'}`;
        item.time    = newStr;
        item.iso     = dateVal;
        item.addedBy = empVal;
        if (typeof _logAudit === 'function')
            _logAudit('editMontasiaReceipt', item.branch || '—', `${oldRef} → ${newStr} / ${empVal}`, 'montasia', item.id);
    } else {
        const oldRef = `${item.dt || '—'} / ${item.deliveredBy || '—'}`;
        item.dt          = newStr;
        item.deliveredBy = empVal;
        if (typeof _logAudit === 'function')
            _logAudit('editMontasiaDelivery', item.branch || '—', `${oldRef} → ${newStr} / ${empVal}`, 'montasia', item.id);
    }
    if (typeof save === 'function') save();
    if (typeof renderAll === 'function') renderAll();
    closeEditMontasiaTimeModal();
}

function saveMontasiaBranch(id) {
    if (currentUser?.role !== 'cc_manager' && !currentUser?.isAdmin) return;
    const item = (db.montasiat || []).find(x => x.id === id);
    if (!item) return;
    const newCity   = (document.getElementById('_ebCity')?.value   || '').trim();
    const newBranch = (document.getElementById('_ebBranch')?.value || '').trim();
    if (!newCity || !newBranch) return alert('يرجى اختيار المحافظة والفرع');
    if (item.city === newCity && item.branch === newBranch) { closeEditMontasiaBranchModal(); return; }
    const oldRef = `${item.city || '—'} / ${item.branch || '—'}`;
    item.city   = newCity;
    item.branch = newBranch;
    if (typeof _logAudit === 'function')
        _logAudit('editMontasiaBranch', `${newCity} / ${newBranch}`, `${oldRef} → ${newCity} / ${newBranch}`, 'montasia', item.id);
    if (typeof save === 'function') save();
    if (typeof renderAll === 'function') renderAll();
    closeEditMontasiaBranchModal();
}

/* ══ تصدير / استيراد Excel ══ */
function exportMontasiat() {
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const f = {
        country:     get('searchCountryM'),
        city:        get('searchCityM'),
        branch:      get('searchBranchM'),
        date:        get('searchDateM'),
        text:        get('searchTextM').toLowerCase(),
        addedBy:     get('searchAddedByM'),
        deliveredBy: get('searchDeliveredByM'),
        type:        get('searchTypeM'),
    };
    // فلاتر مدير قسم السيطرة: القسم + الفروع المحددة داخله
    const isCtrlMgrM = currentUser?.role === 'control_employee';
    const selectedSectionM = isCtrlMgrM ? get('searchSectionM') : '';
    let selectedSectionBranchesM = [];
    if (isCtrlMgrM && selectedSectionM) {
        const _picker = document.getElementById('mSectionBranchPicker');
        if (_picker) {
            selectedSectionBranchesM = Array.from(_picker.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        }
    }
    const filtered = db.montasiat.filter(x =>
        !x.deleted &&
        (!f.country     || (x.country || _countryForCity(x.city)) === f.country) &&
        (!f.city        || x.city === f.city) &&
        (!f.branch      || x.branch === f.branch) &&
        (!f.date        || x.iso.startsWith(f.date)) &&
        (!f.text        || (x.notes||'').toLowerCase().includes(f.text)) &&
        (!f.addedBy     || (x.addedBy||'').includes(f.addedBy)) &&
        (!f.deliveredBy || (x.deliveredBy||'').includes(f.deliveredBy)) &&
        (!f.type        || (x.type||'') === f.type) &&
        (!selectedSectionM || selectedSectionBranchesM.includes(x.branch))
    );
    if (!filtered.length) return alert('لا توجد نتائج للتصدير بالفلتر الحالي');
    // بناء عمود "التفاصيل" حسب نوع المنتسية
    const _buildDetails = (x) => {
        if (x.type === 'نقدي') {
            const parts = [];
            if (x.missingValue) parts.push(`القيمة المالية المفقودة: ${x.missingValue}`);
            if (x.notes)        parts.push(x.notes);
            return parts.join(' — ');
        }
        if (x.type === 'اصناف محمص الشعب') {
            const parts = [];
            if (x.roastSubType)    parts.push(`النوع: ${x.roastSubType}`);
            if (x.roastItemName)   parts.push(`اسم الصنف: ${x.roastItemName}`);
            if (x.roastItemValue)  parts.push(`القيمة المالية: ${x.roastItemValue}`);
            if (x.roastItemWeight) parts.push(`الوزن: ${x.roastItemWeight}`);
            if (x.notes)           parts.push(x.notes);
            return parts.join(' — ');
        }
        if (x.type === 'متعدد الأصناف' && typeof _buildItemsExportText === 'function') {
            const txt = _buildItemsExportText(x);
            return x.notes ? `${txt}\n[ملاحظة: ${x.notes}]` : txt;
        }
        return x.notes || '';
    };
    const rows = filtered.map(x => ({
        'المحافظة':    x.city          || '',
        'الفرع':       x.branch        || '',
        'النوع':           x.type          || '',
        'موظف الفرع':     x.branchEmp     || '',
        'التفاصيل':        _buildDetails(x),
        'الحالة':          x.status        || '',
        'وقت الإضافة':    _toLatinDigits(x.time || ''),
        'وقت التسليم':    _toLatinDigits(x.dt   || ''),
        'أضافه':           x.addedBy       || '',
        'سلّمه':           x.deliveredBy   || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المنتسيات');
    const suffix = f.type || f.city || f.addedBy || f.date || '';
    XLSX.writeFile(wb, `منتسيات${suffix ? '_' + suffix : ''}_${iso()}.xlsx`);
}

let _importMontasiaData = [];

function importMontasiat(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        input.value = '';
        try {
            const wb   = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
            const ws   = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            _importMontasiaData = rows.filter(r =>
                String(r['الفرع']).trim() && String(r['المحافظة']).trim() && String(r['التفاصيل']).trim()
            );
            if (!_importMontasiaData.length) {
                alert('لا توجد بيانات صحيحة في الملف.\nتأكد من وجود الأعمدة: المحافظة، الفرع، التفاصيل');
                return;
            }
            const preview = _importMontasiaData.slice(0, 5).map(r =>
                `<div style="padding:5px 0;border-bottom:1px solid var(--border);">
                    <b style="color:var(--text-main);">${sanitize(r['الفرع'])}</b>
                    <span style="color:var(--text-dim);"> — ${sanitize(r['المحافظة'])}</span>
                    <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${sanitize(String(r['التفاصيل']).slice(0,60))}${String(r['التفاصيل']).length>60?'…':''}</div>
                </div>`
            ).join('');
            const more = _importMontasiaData.length > 5
                ? `<div style="padding:6px 0;color:var(--text-dim);font-size:12px;">… و ${_importMontasiaData.length - 5} مدخلات أخرى</div>`
                : '';
            document.getElementById('importMontasiaPreview').innerHTML =
                `<div style="font-weight:700;color:#64b5f6;margin-bottom:10px;">سيتم إضافة ${_importMontasiaData.length} منتسية:</div>${preview}${more}`;
            document.getElementById('importMontasiaModal').classList.remove('hidden');
        } catch(err) {
            alert('تعذّر قراءة الملف. تأكد أنه ملف Excel صحيح (.xlsx)');
        }
    };
    reader.readAsBinaryString(file);
}

function confirmImportMontasia() {
    const base = Date.now();
    // استخراج التاريخ (YYYY-MM-DD) من Date object أو نص ISO
    function _isDateObj(v) { return v && typeof v.getTime === 'function' && !isNaN(v.getTime()); }
    function _extractIsoDate(val) {
        if (!val) return null;
        if (_isDateObj(val) && val.getUTCFullYear() > 2000) {
            return val.getUTCFullYear()+'-'+String(val.getUTCMonth()+1).padStart(2,'0')+'-'+String(val.getUTCDate()).padStart(2,'0');
        }
        if (typeof val === 'number' && val >= 1) {
            var d = new Date(Math.floor(val - 25569) * 86400000);
            if (d.getUTCFullYear() > 2000) {
                return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
            }
        }
        var s = String(val);
        var sm = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (sm && parseInt(sm[1]) > 2000) return sm[1]+'-'+sm[2]+'-'+sm[3];
        // تنسيق D/M/YYYY أو DD/MM/YYYY (نص من Excel)
        var sm2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (sm2 && parseInt(sm2[3]) > 2000) {
            return sm2[3]+'-'+String(parseInt(sm2[2])).padStart(2,'0')+'-'+String(parseInt(sm2[1])).padStart(2,'0');
        }
        return null;
    }
    function _extractTime(val) {
        if (!val && val !== 0) return null;
        if (_isDateObj(val)) {
            return String(val.getUTCHours()).padStart(2,'0')+':'+String(val.getUTCMinutes()).padStart(2,'0');
        }
        if (typeof val === 'number') {
            var frac = val - Math.floor(val);
            if (frac < 0) frac += 1;
            var totalMin = Math.round(frac * 1440);
            return String(Math.floor(totalMin/60)).padStart(2,'0')+':'+String(totalMin%60).padStart(2,'0');
        }
        if (typeof val === 'string') {
            var tm = val.match(/(\d{1,2}):(\d{2})/);
            if (tm) return String(parseInt(tm[1])).padStart(2,'0')+':'+tm[2];
        }
        return null;
    }
    // دمج تاريخ من عمود + وقت من عمود آخر
    function _buildDateTime(dateVal, timeVal) {
        var isoDate = _extractIsoDate(dateVal);
        if (!isoDate) return null;
        var parts = isoDate.split('-');
        var timeStr = _extractTime(timeVal) || '00:00';
        var _h=parseInt(timeStr.split(':')[0]||0), _m=(timeStr.split(':')[1]||'00');
        var _ampm=_h>=12?'PM':'AM', _h12=_h%12||12;
        var display = parseInt(parts[2])+'/'+(parseInt(parts[1]))+'/'+parts[0]+'، '+_h12+':'+_m+' '+_ampm;
        return { iso: isoDate, time: display };
    }

    _importMontasiaData.forEach((r, i) => {
        // دمج التاريخ من 'التاريخ' + الوقت من 'وقت الإضافة'
        var parsed = _buildDateTime(r['التاريخ'] || r['تاريخ الإضافة'] || r['تاريخ'], r['وقت الإضافة']);
        if (!parsed) {
            // احتياطي: أي عمود تاريخ صالح
            var fallback = r['التاريخ']||r['وقت الإضافة']||r['تاريخ الإضافة']||r['تاريخ']||'';
            var fi = _extractIsoDate(fallback);
            if (fi) { var fp=fi.split('-'); parsed={iso:fi,time:parseInt(fp[2])+'/'+(parseInt(fp[1]))+'/'+fp[0]+'، 00:00'}; }
        }
        // دمج تاريخ التسليم + وقت التسليم
        var dtParsed = _buildDateTime(r['التاريخ_1'] || r['تاريخ التسليم'], r['وقت التسليم']);
        var _city    = String(r['المحافظة']).trim();
        var _country = String(r['الدولة'] || '').trim() || (typeof _countryForCity === 'function' ? _countryForCity(_city) : 'الأردن');
        var _type    = String(r['النوع'] || '').trim();
        if (_type === 'اخرى') _type = 'أخرى'; // تطبيع الهمزة
        var _delBranch = String(r['فرع التسليم'] || '').trim();
        var _delCity   = String(r['محافظة التسليم'] || '').trim();
        var _delNotes  = String(r['ملاحظات التسليم'] || '').trim();
        var _rec = {
            id:          base + i,
            country:     _country,
            city:        _city,
            branch:      String(r['الفرع']).trim(),
            notes:       String(r['التفاصيل']).trim(),
            type:        _type,
            status:      String(r['الحالة']||'').trim() || 'قيد الانتظار',
            time:        parsed   ? parsed.time   : now(),
            iso:         parsed   ? parsed.iso    : iso(),
            branchEmp:   String(r['موظف الفرع'] || '').trim(),
            addedBy:     (String(r['أضافه'] || r['اضافه'] || r['الموظف'] || '').trim()) || currentUser.name,
            deliveredBy: String(r['سلّمه'] || r['سلمه'] || '').trim() || '',
            dt:          dtParsed ? dtParsed.time : ''
        };
        if (_delBranch) {
            _rec.deliveryBranch  = _delBranch;
            _rec.deliveryCity    = _delCity || _city;
            _rec.deliveryCountry = _country;
        }
        if (_delNotes) {
            _rec.deliverNotes        = _delNotes;
            _rec.deliverNotesAddedAt = _rec.dt || _rec.time;
        }
        // ميزة "تأخير التسليم" تلقائياً إذا تواريخ الإضافة والتسليم مختلفة
        if (parsed && dtParsed && parsed.iso !== dtParsed.iso) _rec.isLateDelivery = true;
        db.montasiat.unshift(_rec);
    });
    _importMontasiaData = [];
    save();
    document.getElementById('importMontasiaModal').classList.add('hidden');
}

function cancelImportMontasia() {
    _importMontasiaData = [];
    document.getElementById('importMontasiaModal').classList.add('hidden');
}

function toggleCountMontasia(id) {
    const item = db.montasiat.find(x => x.id === id);
    if (!item) return;
    item.countedByControl = !item.countedByControl;
    save();
    renderAll();
}

/* ── توليد رقم تسلسلي للمنتسية بصيغة YY-NNN (سنة-تسلسل) ──
   يضمن عدم تكرار الرقم مع أي منتسية موجودة بالنظام (ضمن نفس السنة + اختلاف السنة يكفي للتمييز). */
function _genMontasiaSerial(isoDate) {
    const _iso = isoDate || (typeof iso === 'function' ? iso() : new Date().toISOString().slice(0,10));
    const yy = String(_iso).substring(2, 4);
    if (!db.montasiatSeqByYear || typeof db.montasiatSeqByYear !== 'object') db.montasiatSeqByYear = {};
    if (!db.montasiatSeqByYear[yy]) {
        // أعِد بناء العداد من البيانات الفعلية لتفادي أي تعارض
        let max = 0;
        for (const x of (db.montasiat || [])) {
            if (x.serial && typeof x.serial === 'string' && x.serial.startsWith(yy + '-')) {
                const n = parseInt(x.serial.split('-')[1], 10);
                if (!isNaN(n) && n > max) max = n;
            }
        }
        db.montasiatSeqByYear[yy] = max;
    }
    db.montasiatSeqByYear[yy]++;
    return `${yy}-${String(db.montasiatSeqByYear[yy]).padStart(3, '0')}`;
}

/* ── الانتقال إلى المنتسية برقمها التسلسلي وتمييزها بصرياً ── */
function jumpToMontasia(serial) {
    if (!serial) return;
    if (typeof switchTab === 'function') switchTab('m');
    setTimeout(() => {
        const target = (db.montasiat || []).find(x => !x.deleted && x.serial === serial);
        if (!target) { alert('لم يتم العثور على المنتسية رقم ' + serial); return; }
        const rows = document.querySelectorAll('#tableM tbody tr');
        rows.forEach(r => {
            r.style.outline = '';
            if (String(r.dataset.id) === String(target.id)) {
                r.style.outline = '2px solid var(--accent-red)';
                r.scrollIntoView({ behavior:'smooth', block:'center' });
            }
        });
    }, 250);
}

