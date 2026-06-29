/* ══════════════════════════════════════════════════════
   RENDER — Filter & render all tables
══════════════════════════════════════════════════════ */
function filterTable() {
    // إعادة ضبط الصفحة عند تغيير الفلتر
    if (typeof _pg !== 'undefined') { _pg.M = 1; _pg.O = 1; _pg.I = 1; _pg.C = 1; }
    renderAll();
}

/* استخراج تاريخ التسليم من x.dt كصيغة YYYY-MM-DD — يدعم 3 صيغ تخزين */
function _getDeliveryIso(x) {
    if (!x || !x.dt) return '';
    const s = String(x.dt).trim();

    // الصيغة 1: YYYY/M/D — "2026/05/06 — 14:30"  (يدوي via confirmAddMontasia)
    let m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;

    // الصيغة 2: D/M/YYYY — "6/5/2026، 14:30 PM"  (تلقائي via now())
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;

    // الصيغة 3: أي شيء آخر يقبله Date constructor (ISO، locale string)
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return '';
}

/* بحث نصّي شامل لمنتسية: يفحص ملاحظات + اسم الصنف + قيمة + تفاصيل الأصناف المتعددة */
function _matchTextM(x, q) {
    if (!q) return true;
    const fields = [
        x.notes,
        x.roastItemName, x.roastItemValue, x.roastItemWeight,
        x.missingValue,
        x.branchEmp, x.branch, x.city
    ];
    if (Array.isArray(x.items)) {
        for (const it of x.items) {
            if (it) fields.push(it.name, it.value, it.weight, it.notes);
        }
    }
    for (const v of fields) {
        if (v != null && String(v).toLowerCase().includes(q)) return true;
    }
    return false;
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
function resetSearch(t) {
    const clear = (ids) => ids.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const clearDate = (fieldId) => {
        const el=document.getElementById(fieldId); if(el) el.value='';
        const disp=document.getElementById(fieldId+'-display'); if(disp){ disp.textContent='📅 اختر التاريخ'; disp.classList.remove('selected'); }
    };
    if (t==='M') {
        clear(['searchCountryM','searchCityM','searchTextM','searchSerialM','searchTypeM','searchSectionM','searchRoastSubM','searchReservedM']);
        if (typeof updateCities === 'function') updateCities('searchCountryM','searchCityM','searchBranchM');
        else document.getElementById('searchBranchM').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateM');
        clearDate('searchDeliverDateM');
        // إخفاء قائمة فروع القسم لمدير قسم السيطرة
        const _sbWrap = document.getElementById('mSectionBranchWrap');
        if (_sbWrap) _sbWrap.style.display = 'none';
        const _sbBox = document.getElementById('mSectionBranchPicker');
        if (_sbBox) { _sbBox.innerHTML = ''; _sbBox.dataset.section = ''; }
        if (typeof _toggleRoastSubFilter === 'function') _toggleRoastSubFilter('M');
        _pg.M = 1;
    } else if (t==='O') {
        clear(['searchCountryO','searchCityO','searchTextO','searchAddedByO','searchTypeO','searchRoastSubO']);
        if (typeof updateCities === 'function') updateCities('searchCountryO','searchCityO','searchBranchO');
        else document.getElementById('searchBranchO').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateO');
        if (typeof _toggleRoastSubFilter === 'function') _toggleRoastSubFilter('O');
        _pg.O = 1;
    } else if (t==='I') {
        clear(['searchCountryI','searchCityI','searchAddedByI','searchTypeI','searchComplaintTypeI']);
        if (typeof updateCities === 'function') updateCities('searchCountryI','searchCityI','searchBranchI');
        else document.getElementById('searchBranchI').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateI');
        // أخفِ فلتر "نوع الشكوى" الفرعي
        const _ctw = document.getElementById('searchComplaintTypeIWrap');
        if (_ctw) _ctw.style.display = 'none';
        // أزل أيضاً فلتر البحث المباشر بالرقم (إن كان نشطاً)
        window._iLivePhoneFilter = '';
        const _tblI = document.getElementById('tableI'); if (_tblI) _tblI.style.outline = '';
        _pg.I = 1;
    } else if (t==='C') {
        clear(['searchCountryC','searchCityC','searchTextC','searchTypeC','searchFinStatusC','searchAddedByC','searchMediaSourceC']);
        if (typeof updateCities === 'function') updateCities('searchCountryC','searchCityC','searchBranchC');
        else document.getElementById('searchBranchC').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateC');
        _pg.C = 1;
    } else if (t==='CU') {
        clear(['searchCountryCU','searchCityCU','searchTextCU']);
        if (typeof updateCities === 'function') updateCities('searchCountryCU','searchCityCU','searchBranchCU');
        else document.getElementById('searchBranchCU').innerHTML='<option value="">الكل</option>';
        clearDate('searchDateCU');
    }
    renderAll();
}

/* ── أدوات فلاتر مدير قسم السيطرة لشاشة المنتسيات ── */
/* قائمة فروع كل قسم (مع دعم "الفروع الدولية" = كل الفروع خارج الأردن) */
function _branchesForSectionM(section) {
    if (!section) return [];
    if (section === 'الفروع الدولية') {
        const out = [];
        if (typeof COUNTRIES_DATA !== 'undefined') {
            for (const c in COUNTRIES_DATA) {
                if (c === 'الأردن') continue;
                const regs = COUNTRIES_DATA[c].regions || {};
                for (const r in regs) (regs[r] || []).forEach(b => out.push(b));
            }
        }
        return out;
    }
    const map = (typeof REGION_MAP !== 'undefined') ? REGION_MAP : null;
    return (map && map[section]) ? map[section].slice() : [];
}
/* تعبئة قائمة فروع القسم (مع تحديد الكل افتراضياً) */
function _populateSectionBranchPickerM(section) {
    const wrap = document.getElementById('mSectionBranchWrap');
    const box  = document.getElementById('mSectionBranchPicker');
    const ttl  = document.getElementById('mSectionBranchTitle');
    if (!wrap || !box) return;
    const branches = _branchesForSectionM(section);
    if (!section || !branches.length) {
        wrap.style.display = 'none';
        box.innerHTML = '';
        box.dataset.section = '';
        return;
    }
    wrap.style.display = '';
    if (ttl) ttl.textContent = section === 'الفروع الدولية' ? 'الفروع الدولية' : `قسم ${section}`;
    box.innerHTML = branches.map(b => `
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:13px;color:var(--text);">
            <input type="checkbox" value="${b}" checked onchange="filterTable()" style="cursor:pointer;accent-color:#9c27b0;">
            <span>${b}</span>
        </label>`).join('');
    box.dataset.section = section;
}
function _getSelectedSectionBranchesM() {
    const box = document.getElementById('mSectionBranchPicker');
    if (!box) return [];
    return Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}
function _toggleAllSectionBranchesM(check) {
    const box = document.getElementById('mSectionBranchPicker');
    if (!box) return;
    box.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = !!check; });
    if (typeof filterTable === 'function') filterTable();
}
/* عند تغيير اختيار القسم: إعادة تعبئة قائمة الفروع وتطبيق الفلتر */
function _onSectionChangeM() {
    const sel = document.getElementById('searchSectionM');
    _populateSectionBranchPickerM(sel ? sel.value : '');
    if (typeof filterTable === 'function') filterTable();
}

function _renderTableM(get, isAdmin) {
    const addMontasiaCard = document.getElementById('addMontasiaCard');
    if (addMontasiaCard) addMontasiaCard.style.display = (currentUser?.role === 'control_employee' || currentUser?.role === 'control_sub') ? 'none' : '';
    const tbodyM = document.querySelector("#tableM tbody");
    if (!tbodyM) return;

    const canDelete = perm('deleteM');
    const isCCMgrM  = currentUser?.role === 'cc_manager';
    const isCtrlMgrM = currentUser?.role === 'control_employee';
    const mBar = document.getElementById('mExportImportBar');
    if (mBar) mBar.style.display = (canDelete || isCCMgrM || isCtrlMgrM) ? '' : 'none';
    // مدير قسم السيطرة: يرى زر التصدير فقط (لا استيراد ولا حذف)
    const lblImp  = document.getElementById('lblImportMontasiat');
    const hintImp = document.getElementById('hintImportMontasiat');
    if (lblImp)  lblImp.style.display  = (canDelete || isCCMgrM) ? 'flex'  : 'none';
    if (hintImp) hintImp.style.display = (canDelete || isCCMgrM) ? ''      : 'none';

    // ── فلاتر مدير قسم السيطرة (قسم + فروع القسم متعددة)
    const ctrlFiltersBox = document.getElementById('mCtrlMgrFilters');
    if (ctrlFiltersBox) ctrlFiltersBox.style.display = isCtrlMgrM ? '' : 'none';

    const selectedSectionM = isCtrlMgrM ? (get("searchSectionM") || '') : '';
    if (isCtrlMgrM) {
        // مزامنة قائمة الفروع مع القسم الحالي إن لزم
        const _picker = document.getElementById('mSectionBranchPicker');
        if (_picker && _picker.dataset.section !== selectedSectionM) {
            _populateSectionBranchPickerM(selectedSectionM);
        } else if (!selectedSectionM) {
            const _wrap = document.getElementById('mSectionBranchWrap');
            if (_wrap) _wrap.style.display = 'none';
        }
    }
    const selectedSectionBranchesM = isCtrlMgrM ? _getSelectedSectionBranchesM() : [];

    const f = {
        country:     get("searchCountryM"),
        city:        get("searchCityM"),
        branch:      get("searchBranchM"),
        date:        get("searchDateM"),         // وقت التبليغ
        deliverDate: get("searchDeliverDateM"),  // وقت التسليم
        text:        get("searchTextM").toLowerCase(),
        serial:      ((get("searchSerialM") || '').trim().toLowerCase()).replace(/[-\s]/g, ''),
        type:        get("searchTypeM"),
        subType:     get("searchRoastSubM"),
        reservedOnly: get("searchReservedM")     // منتسيات مسجلة لزبائن (غير مسلّمة + محجوزة)
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
        (!f.country     || (x.country || _countryForCity(x.city))===f.country) &&
        (!f.city        || x.city===f.city) &&
        (!f.branch      || x.branch===f.branch) &&
        (!f.date        || x.iso.startsWith(f.date)) &&
        (!f.text        || _matchTextM(x, f.text)) &&
        (!f.serial      || (x.serial||'').toLowerCase().replace(/[-\s]/g,'').includes(f.serial)) &&
        (!f.deliverDate || _getDeliveryIso(x).startsWith(f.deliverDate)) &&
        (!f.type        || (x.type||'')=== f.type) &&
        (!f.subType     || (x.roastSubType||'') === f.subType) &&
        (!selectedSectionM || selectedSectionBranchesM.includes(x.branch)) &&
        (!f.reservedOnly || (!!x.reservedFor && x.status !== 'تم التسليم'))
    );
    if (!_pg.M) _pg.M = 1;
    const _sizeM = _pgSize.M || _DEFAULT_PAGE_SIZE;
    const _pageM = Math.min(_pg.M, Math.max(1, Math.ceil(allRows.length / _sizeM)));
    _pg.M = _pageM;
    const rows = allRows.slice((_pageM - 1) * _sizeM, _pageM * _sizeM);
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
        const typeLabel = x.type==='نقدي'
            ? `<span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(255,193,7,0.15);color:#ffd54f;">نقدي</span>`
            : x.type==='أخرى'
            ? `<span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(100,181,246,0.15);color:#90caf9;">أخرى</span>`
            : x.type==='اصناف محمص الشعب'
            ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                   <span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(156,204,101,0.18);color:#c5e1a5;">أصناف محامص الشعب</span>
                   ${x.roastSubType==='وزن'
                       ? `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(255,152,0,0.20);color:#ffb74d;">⚖️ وزن</span>`
                       : x.roastSubType==='قيمة'
                       ? `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(186,104,200,0.22);color:#e1bee7;">💵 قيمة</span>`
                       : x.roastSubType==='وزن وقيمة'
                       ? `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(255,167,38,0.22);color:#ffcc80;">🌰 وزن وقيمة</span>`
                       : ''}
               </div>`
            : x.type==='متعدد الأصناف'
            ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                   <span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(76,175,80,0.18);color:#a5d6a7;">📋 متعدد الأصناف</span>
                   <span style="font-size:10px;color:var(--text-dim);">${(Array.isArray(x.items)?x.items.length:0)} أصناف</span>
               </div>`
            : `<span style="color:var(--text-dim);font-size:12px;">—</span>`;
        let extraInfo = '';
        const _lblColor = '#80deea';
        if (x.type === 'نقدي' && x.missingValue) {
            extraInfo = `<div style="margin-top:5px;font-size:12px;font-weight:700;"><span style="color:${_lblColor};">القيمة المالية المفقودة:</span> <span style="color:#ffd54f;">${sanitize(x.missingValue)}</span></div>`;
        } else if (x.type === 'اصناف محمص الشعب') {
            const lines = [];
            if (x.roastItemName)   lines.push({l:'اسم الصنف', v:sanitize(x.roastItemName)});
            if (x.roastItemValue)  lines.push({l:'القيمة المالية', v:sanitize(x.roastItemValue)});
            if (x.roastItemWeight) lines.push({l:'الوزن', v:sanitize(x.roastItemWeight)});
            if (lines.length) extraInfo = `<div style="margin-top:5px;font-size:12px;font-weight:700;line-height:1.7;">${lines.map(o=>`<div><span style="color:${_lblColor};">${o.l}:</span> <span style="color:#c5e1a5;">${o.v}</span></div>`).join('')}</div>`;
        } else if (x.type === 'متعدد الأصناف' && typeof _renderItemsCellHTML === 'function') {
            extraInfo = `<div style="margin-top:6px;background:rgba(76,175,80,0.05);border:1px dashed rgba(76,175,80,0.3);border-radius:8px;padding:6px 8px;">${_renderItemsCellHTML(x)}</div>`;
        }
        const _photoSrc = (typeof _montasiaPhotoSrc === 'function') ? _montasiaPhotoSrc(x)
                          : (x.photoBase64 ? 'data:image/jpeg;base64,' + x.photoBase64 : '');
        const photoCell = _photoSrc
            ? `<div style="margin-top:6px;">
                   <img src="${_photoSrc}"
                        style="max-width:90px;max-height:70px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);"
                        onclick="_showPhoto('${x.id}')" title="عرض الصورة"/>
               </div>` : '';
        const mobileTag = x.source==='mobile'
            ? `<span style="padding:1px 6px;border-radius:5px;font-size:10px;background:rgba(255,152,0,0.15);color:#ffb74d;margin-right:4px;">📱</span>` : '';
        const approvedByRow = x.approvedBy
            ? `<div class="added-by">✓ وافق: ${sanitize(x.approvedBy)}</div>` : '';
        const _isCCMgr = currentUser?.role === 'cc_manager';
        const _typeEditPanel = _isCCMgr ? `
            <div id="typeEdit-${x.id}" style="display:none;flex-direction:column;gap:8px;align-items:stretch;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:10px;width:230px;">
                <select id="typeEditSel-${x.id}" onchange="_onTypeEditChange(${x.id})" style="padding:6px;font-size:12px;font-family:'Cairo';width:100%;">
                    <option value="نقدي">نقدي</option>
                    <option value="اخرى">اخرى</option>
                    <option value="اصناف محمص الشعب">أصناف محامص الشعب</option>
                </select>
                <div id="typeEditCash-${x.id}" style="display:none;flex-direction:column;gap:6px;">
                    <input id="typeEditMissingValue-${x.id}" type="text" inputmode="decimal" placeholder="القيمة المالية المفقودة *" style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;">
                    <textarea id="typeEditNotesCash-${x.id}" rows="2" placeholder="تفاصيل إضافية (اختياري)" style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;resize:vertical;"></textarea>
                </div>
                <div id="typeEditOther-${x.id}" style="display:none;flex-direction:column;gap:6px;">
                    <textarea id="typeEditNotesOther-${x.id}" rows="3" placeholder="التفاصيل *" style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;resize:vertical;"></textarea>
                </div>
                <div id="typeEditRoast-${x.id}" style="display:none;flex-direction:column;gap:6px;">
                    <div style="display:flex;gap:14px;justify-content:center;font-size:12px;">
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="typeEditSub-${x.id}" value="وزن"  onchange="_onTypeEditSubChange(${x.id})"> ⚖️ وزن</label>
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="typeEditSub-${x.id}" value="قيمة" onchange="_onTypeEditSubChange(${x.id})"> 💵 قيمة</label>
                    </div>
                    <div id="typeEditRoastWeight-${x.id}" style="display:none;flex-direction:column;gap:5px;">
                        <input id="typeEditRoastValueW-${x.id}"  type="text" inputmode="decimal" placeholder="القيمة المالية *" style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;">
                        <input id="typeEditRoastNameW-${x.id}"   type="text" placeholder="اسم الصنف *"        style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;">
                        <input id="typeEditRoastWeightW-${x.id}" type="text" inputmode="decimal" placeholder="الوزن *"            style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;">
                    </div>
                    <div id="typeEditRoastValue-${x.id}" style="display:none;flex-direction:column;gap:5px;">
                        <input id="typeEditRoastNameV-${x.id}"  type="text" placeholder="اسم الصنف *"        style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;">
                        <input id="typeEditRoastValueV-${x.id}" type="text" inputmode="decimal" placeholder="القيمة المالية *" style="width:100%;padding:6px;font-size:12px;font-family:'Cairo';box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:5px;justify-content:center;">
                    <button onclick="saveMontasiaType(${x.id})" style="padding:5px 14px;font-size:11px;background:rgba(46,125,50,0.18);border:1px solid rgba(46,125,50,0.5);color:#a5d6a7;border-radius:7px;cursor:pointer;font-family:'Cairo';font-weight:700;">💾 حفظ</button>
                    <button onclick="cancelMontasiaTypeEdit(${x.id})" style="padding:5px 12px;font-size:11px;background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.4);color:#ef9a9a;border-radius:7px;cursor:pointer;font-family:'Cairo';font-weight:700;">إلغاء</button>
                </div>
            </div>` : '';
        const _typePencil = _isCCMgr ? `<button onclick="editMontasiaType(${x.id})" title="تعديل النوع" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:13px;">✏️</button>` : '';
        const _typeCell = `
            <div id="typeView-${x.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                ${typeLabel}
                ${_typePencil}
            </div>${_typeEditPanel}`;
        const _statusEditPanel = _isCCMgr ? `
            <div id="statusEdit-${x.id}" style="display:none;flex-direction:column;gap:6px;align-items:center;">
                <select id="statusEditSel-${x.id}" style="padding:5px;font-size:12px;width:140px;font-family:'Cairo';">
                    <option value="قيد الانتظار">لم يتم التسليم</option>
                    <option value="تم التسليم">تم التسليم</option>
                </select>
                <div style="display:flex;gap:5px;">
                    <button onclick="saveMontasiaStatus(${x.id})" style="padding:4px 12px;font-size:11px;background:rgba(46,125,50,0.18);border:1px solid rgba(46,125,50,0.5);color:#a5d6a7;border-radius:7px;cursor:pointer;font-family:'Cairo';font-weight:700;">💾 حفظ</button>
                    <button onclick="cancelMontasiaStatusEdit(${x.id})" style="padding:4px 10px;font-size:11px;background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.4);color:#ef9a9a;border-radius:7px;cursor:pointer;font-family:'Cairo';font-weight:700;">إلغاء</button>
                </div>
            </div>` : '';
        const _statusPencil = _isCCMgr ? `<button onclick="editMontasiaStatus(${x.id})" title="تعديل الحالة" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:13px;margin-right:4px;">✏️</button>` : '';
        const _statusBadge = `<span class="status-badge ${statusClass}">${x.status==='قيد الانتظار' ? 'لم يتم التسليم' : (x.status==='تم التسليم' ? 'تم التسليم' : x.status)}</span>`;
        const _statusCell = `
            <div id="statusView-${x.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <div style="display:inline-flex;align-items:center;">${_statusBadge}${_statusPencil}</div>
            </div>${_statusEditPanel}`;
        return `<tr data-id="${x.id}">
            <td><b>${x.branch}</b>${_isCCMgr?` <button onclick="editMontasiaBranch(${x.id})" title="تعديل الفرع/المحافظة" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:12px;">✏️</button>`:''}${x.branchEmp?`<br><span style="font-size:13px;color:var(--text-dim);font-weight:700;">👤 ${sanitize(x.branchEmp)}</span>`:''}${mobileTag}</td>
            <td style="text-align:center;">${_typeCell}</td>
            <td>
                ${x.serial ? `<div style="margin-bottom:4px;"><span style="display:inline-block;background:rgba(100,181,246,0.15);color:#90caf9;border:1px solid rgba(100,181,246,0.4);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;font-family:monospace;">#${sanitize(x.serial)}</span></div>` : ''}
                <span class="text-box-cell">${sanitize(x.notes)}</span>${perm('editM')?` <button onclick="startEditMontasia(${x.id})" title="تعديل المدخلات" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:13px;vertical-align:middle;">✏️</button>`:''}${extraInfo}${photoCell}${editBox}
                ${x.reservedFor && x.reservedFor.inqSeq ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    <button onclick="jumpToInquiryById(${x.reservedFor.inqId})" title="انتقل لاستفسار الزبون" style="background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.10));border:1px solid rgba(46,125,50,0.45);color:#a5d6a7;border-radius:8px;padding:5px 12px;font-family:'Cairo';font-size:11px;font-weight:700;cursor:pointer;">👤 رقم الزبون${x.reservedFor.phone?` — ${sanitize(x.reservedFor.phone)}`:''}</button>${x.reservedFor.phone && (currentUser?.role === 'cc_manager' || currentUser?.role === 'cc_employee') ? `<span class="c360-phone-link" onclick="event.stopPropagation();openCustomer360('${sanitize(x.reservedFor.phone)}')" title="عرض ملف الزبون" style="margin-right:6px;font-size:11px;">📞 ملف الزبون</span>` : ''}
                    ${(currentUser?.role === 'cc_manager' || currentUser?.isAdmin) ? `<button onclick="unreserveMontasia(${x.id})" title="فك حجز المنتسية (مدير الكول سنتر فقط)" style="background:linear-gradient(135deg,rgba(211,47,47,0.18),rgba(211,47,47,0.10));border:1px solid rgba(211,47,47,0.45);color:#ef9a9a;border-radius:8px;padding:5px 12px;font-family:'Cairo';font-size:11px;font-weight:700;cursor:pointer;">🔓 فك الحجز</button>` : ''}
                </div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:center;">${_statusCell}</td>
            <td style="text-align:center;vertical-align:top;">
                <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                    <span style="font-weight:700;color:var(--text-main);font-size:13px;">${typeof _empNameHTML==='function'?_empNameHTML(x.addedBy||'—'):sanitize(x.addedBy||'—')}</span>
                    <small style="color:var(--text-dim);">${_toLatinDigits(_timeToAmPm(x.time))}${_isCCMgr?` <button onclick="editMontasiaReceipt(${x.id})" title="تعديل وقت/موظف الاستلام" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:12px;">✏️</button>`:''}</small>
                    ${x.addLateReason
                        ? `<button onclick="showAddLateNote(${x.id})" style="cursor:pointer;background:rgba(255,152,0,0.12);border:1px solid rgba(255,152,0,0.35);color:#ffb74d;border-radius:7px;padding:3px 10px;font-family:'Cairo';font-size:11px;font-weight:700;">👁 عرض</button>`
                        : ''
                    }
                    ${approvedByRow}
                </div>
            </td>
            <td style="text-align:center;vertical-align:top;">
                <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                ${x.dt && x.status !== 'قيد الانتظار'
                    ? `<span style="font-weight:700;color:var(--text-main);font-size:13px;">${typeof _empNameHTML==='function'?_empNameHTML(x.deliveredBy||'—'):sanitize(x.deliveredBy||'—')}</span>
                       <small style="color:#a5d6a7;font-family:monospace;">⏱ ${_toLatinDigits(_timeToAmPm(x.dt))}${_isCCMgr?` <button onclick="editMontasiaDelivery(${x.id})" title="تعديل وقت/موظف التسليم" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:12px;">✏️</button>`:''}</small>
                       ${x.deliveryBranch && x.deliveryBranch !== x.branch
                           ? `<div style="font-size:12px;color:var(--accent-red);font-weight:700;">تم التسليم بفرع ${sanitize(x.deliveryBranch)}</div>`
                           : `<div style="font-size:12px;color:var(--text-dim);">تم التسليم بنفس الفرع</div>`
                       }
                       ${x.deliverNotes
                           ? `<button onclick="showDeliverNotes(${x.id})"
                                style="cursor:pointer;background:rgba(25,118,210,0.12);border:1px solid rgba(25,118,210,0.35);
                                       color:#64b5f6;border-radius:8px;padding:4px 12px;font-family:'Cairo';font-size:11px;font-weight:700;">
                                👁 عرض</button>`
                           : ''
                       }`
                    : `<span style="color:var(--text-dim);font-size:12px;">—</span>`
                }
                ${_isCCMgr && x.isLateDelivery
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
        country: get("searchCountryO"),
        branch:  get("searchBranchO"),
        date:    get("searchDateO"),
        text:    get("searchTextO").toLowerCase(),
        addedBy: get("searchAddedByO"),
        type:    get("searchTypeO"),
        subType: get("searchRoastSubO")
    };
    const _ctrlSubO = currentUser?.role === 'control_sub' ? employees.find(e => e.empId === currentUser?.empId) : null;
    const allRowsO = db.montasiat.filter(x =>
        !x.deleted &&
        (x.status==='قيد الانتظار' || x.status==='بانتظار الموافقة' || x.status==='قيد الاستلام') &&
        (!_ctrlSubO?.assignedBranches?.length || _ctrlSubO.assignedBranches.some(b => b.branch === x.branch && b.city === x.city)) &&
        (!f.country || (x.country || _countryForCity(x.city))===f.country) &&
        (!f.city    || x.city===f.city) &&
        (!f.branch  || x.branch===f.branch) &&
        (!f.date    || x.iso.startsWith(f.date)) &&
        (!f.text    || (x.notes||'').toLowerCase().includes(f.text)) &&
        (!f.addedBy || (x.addedBy||'').includes(f.addedBy)) &&
        (!f.type    || (x.type||'')=== f.type) &&
        (!f.subType || (x.roastSubType||'') === f.subType)
    );
    if (!_pg.O) _pg.O = 1;
    const _sizeO = _pgSize.O || _DEFAULT_PAGE_SIZE;
    const _pageO = Math.min(_pg.O, Math.max(1, Math.ceil(allRowsO.length / _sizeO)));
    _pg.O = _pageO;
    const rows = allRowsO.slice((_pageO - 1) * _sizeO, _pageO * _sizeO);
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
        let _xInfo = '';
        const _lblC = '#80deea';
        if (x.type === 'نقدي' && x.missingValue) {
            _xInfo = `<div style="margin-top:5px;font-size:12px;font-weight:700;"><span style="color:${_lblC};">القيمة المالية المفقودة:</span> <span style="color:#ffd54f;">${sanitize(x.missingValue)}</span></div>`;
        } else if (x.type === 'اصناف محمص الشعب') {
            const _lines = [];
            if (x.roastItemName)   _lines.push({l:'اسم الصنف', v:sanitize(x.roastItemName)});
            if (x.roastItemValue)  _lines.push({l:'القيمة المالية', v:sanitize(x.roastItemValue)});
            if (x.roastItemWeight) _lines.push({l:'الوزن', v:sanitize(x.roastItemWeight)});
            if (_lines.length) _xInfo = `<div style="margin-top:5px;font-size:12px;font-weight:700;line-height:1.7;">${_lines.map(o=>`<div><span style="color:${_lblC};">${o.l}:</span> <span style="color:#c5e1a5;">${o.v}</span></div>`).join('')}</div>`;
        }
        return `<tr>
            <td><b>${x.branch}</b><br><small>${x.city}</small></td>
            <td><span class="text-box-cell">${sanitize(x.notes)}</span>${_xInfo}</td>
            <td><small style="color:var(--text-main)">📥 ${sanitize(x.addedBy||'—')}</small></td>
            <td>${statusDot}<small>${_toLatinDigits(_timeToAmPm(x.time))}</small></td>
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
        country:       get("searchCountryI"),
        city:          get("searchCityI"),
        branch:        get("searchBranchI"),
        date:          get("searchDateI"),
        type:          get("searchTypeI"),
        complaintType: get("searchComplaintTypeI"),
        addedBy:       get("searchAddedByI"),
        livePhone:     (window._iLivePhoneFilter || '').trim()
    };
    const allRowsI = db.inquiries.filter(x =>
        !x.deleted &&
        (!f.country       || (x.country || _countryForCity(x.city))===f.country) &&
        (!f.city          || x.city===f.city) &&
        (!f.branch        || x.branch===f.branch) &&
        (!f.date          || x.iso.startsWith(f.date)) &&
        (!f.type          || x.type===f.type) &&
        (!f.complaintType || (x.type==='شكوى' && (x.complaintType||'')===f.complaintType)) &&
        (!f.addedBy       || (x.addedBy||'').includes(f.addedBy)) &&
        (!f.livePhone     || (x.phone||'').includes(f.livePhone))
    );
    if (!_pg.I) _pg.I = 1;
    const _sizeI = _pgSize.I || _DEFAULT_PAGE_SIZE;
    const _pageI = Math.min(_pg.I, Math.max(1, Math.ceil(allRowsI.length / _sizeI)));
    _pg.I = _pageI;
    const rows = allRowsI.slice((_pageI - 1) * _sizeI, _pageI * _sizeI);
    const _tbodyIRows = rows; // kept for select-all check below
    const isCCMgrI = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    // زر تصدير Excel — يظهر لمدير الكول سنتر / الأدمن فقط
    const _expBtnI = document.getElementById('btnExportInquiriesI');
    if (_expBtnI) _expBtnI.style.display = isCCMgrI ? '' : 'none';
    const _iqEditIcon = (fn, label) => isCCMgrI
        ? ` <button onclick="${fn}" title="تعديل ${label}" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 4px;font-size:11px;vertical-align:middle;">✏️</button>`
        : '';

    tbodyI.innerHTML = rows.map(x => {
        const canCountI = (currentUser?.role === 'cc_manager' || currentUser?.isAdmin) && x.type === 'شكوى';
        const _linkedC  = canCountI ? (db.complaints || []).find(c => !c.deleted && String(c.linkedInqSeq) === String(x.seq)) : null;
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
                <button class="btn-delete-sm" onclick="deleteInquiry(${x.id})">🗑</button>
                ${countBtnI}
            </td>` : (canCountI ? `<td>${countBtnI}</td>` : '<td></td>');
        // بادج نوع الشكوى الفرعي + بيانات الشكوى المالية إن وُجدت
        const _ctMap = {
            'مالية':     { icon:'💰', bg:'rgba(198,40,40,0.15)',  color:'#ef9a9a' },
            'سوء تعامل': { icon:'⚠️', bg:'rgba(255,152,0,0.15)',  color:'#ffb74d' },
            'جودة صنف':  { icon:'🔧', bg:'rgba(21,101,192,0.15)', color:'#64b5f6' },
            'أخرى':      { icon:'🏷️', bg:'rgba(120,144,156,0.18)', color:'#b0bec5' }
        };
        const _ctStyle = _ctMap[x.complaintType];
        const ctBadge = _ctStyle
            ? `<span style="display:inline-block;margin-right:6px;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;background:${_ctStyle.bg};color:${_ctStyle.color};">${_ctStyle.icon} ${x.complaintType}</span>`
            : '';
        const finFieldsHtml = (x.complaintType === 'مالية' && (x.invoiceValue || x.moveNumber || x.noteDate || x.file))
            ? `<div style="margin-top:6px;padding:8px 10px;border-radius:8px;background:rgba(198,40,40,0.06);border:1px dashed rgba(239,83,80,0.3);font-size:11px;color:var(--text-dim);display:flex;flex-wrap:wrap;gap:8px;">
                ${x.invoiceValue ? `<span>💰 ${sanitize(x.invoiceValue)}</span>` : ''}
                ${x.moveNumber   ? `<span>🔢 ${sanitize(x.moveNumber)}</span>` : ''}
                ${x.noteDate     ? `<span>📅 ${sanitize(x.noteDate)}</span>` : ''}
                ${x.file         ? `<button onclick="openInvoiceFile('${x.id}')" class="btn-attach" style="padding:2px 8px;font-size:11px;border:none;cursor:pointer;font-family:Cairo;">📎 الفاتورة</button>` : ''}
              </div>` : '';
        const _itemBadge = x.itemName
            ? `<div style="margin-top:5px;font-size:12px;font-weight:700;"><span style="color:#80deea;">📦 اسم الصنف:</span> <span style="color:#90caf9;">${sanitize(x.itemName)}</span></div>` : '';
        // زر التبليغ لشكاوى "جودة صنف"
        const notifyBtnI = (x.type === 'شكوى' && x.complaintType === 'جودة صنف')
            ? `<button onclick="openNotifyModalForInquiry(${x.id})" title="فتح شاشة التبليغ" style="margin-right:6px;padding:3px 10px;font-size:11px;border:none;border-radius:6px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;cursor:pointer;font-family:'Cairo';font-weight:700;vertical-align:middle;">📣 تبليغ</button>`
            : '';
        // ─ روابط المنتسية لاستفسار "استفسار عن منتسيات" ─
        const _hasMontasiaSerial = x.type === 'استفسار عن منتسيات' && x.montasiaSerial;
        const _existsTag = x.type === 'استفسار عن منتسيات' && x.montasiaExists
            ? `<span style="margin-right:6px;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;background:${x.montasiaExists==='yes'?'rgba(46,125,50,0.15)':'rgba(120,120,120,0.15)'};color:${x.montasiaExists==='yes'?'#a5d6a7':'#bdbdbd'};">${x.montasiaExists==='yes'?'✓ المنتسية موجودة':'لا — لا توجد منتسية'}</span>`
            : '';
        const _serialHtml = _hasMontasiaSerial
            ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <button onclick="${x.reservedMontasiaId ? `jumpToMontasiaById(${x.reservedMontasiaId})` : `jumpToMontasia('${sanitize(x.montasiaSerial)}')`}" title="انتقل للمنتسية" style="background:linear-gradient(135deg,rgba(100,181,246,0.18),rgba(100,181,246,0.08));border:1px solid rgba(100,181,246,0.45);color:#90caf9;border-radius:8px;padding:4px 12px;font-family:monospace;font-size:11px;font-weight:700;cursor:pointer;">📦 منتسية #${sanitize(x.montasiaSerial)}</button>
                ${!x.reservedMontasiaSerial ? `<button onclick="reserveMontasiaForInquiry(${x.id})" title="حجز المنتسية للزبون" style="background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.08));border:1px solid rgba(46,125,50,0.45);color:#a5d6a7;border-radius:8px;padding:4px 12px;font-family:'Cairo';font-size:11px;font-weight:700;cursor:pointer;">🔒 حجز للزبون</button>` : `<span style="background:rgba(46,125,50,0.12);border:1px solid rgba(46,125,50,0.4);color:#a5d6a7;border-radius:8px;padding:3px 10px;font-family:'Cairo';font-size:10px;font-weight:700;">✓ محجوزة للزبون</span>`}
              </div>`
            : '';
        return `<tr data-id="${x.id}">
            <td><span class="seq-badge" title="الرقم التسلسلي">#${x.seq||'—'}</span></td>
            <td><b>${sanitize(x.branch)}</b>${_iqEditIcon(`editInquiryBranch(${x.id})`,'الفرع والمحافظة')}<br><small>${sanitize(x.city)}</small></td>
            <td>${(() => {
                const _ph = sanitize(x.phone);
                const _isCC = currentUser?.role === 'cc_manager' || currentUser?.role === 'cc_employee';
                const _cnt = (typeof _c360ContactCount === 'function' && x.phone) ? _c360ContactCount(x.phone) : 0;
                const _badge = (_cnt > 1) ? `<span class="phone-contact-badge" title="${_cnt} تواصل سابق">${_cnt}</span>` : '';
                const _inner = _isCC
                    ? `<span class="c360-phone-link" onclick="openCustomer360('${_ph}')" title="عرض ملف الزبون">${_ph}</span>`
                    : _ph;
                return `<span class="phone-cell-wrap">${_inner}${_badge}</span>${_iqEditIcon(`editInquiryPhone(${x.id})`,'رقم الجوال')}`;
            })()}</td>
            <td>
                <span class="emp-badge">${x.type||'—'}</span>${_iqEditIcon(`editInquiryType(${x.id})`,'نوع الاستفسار')}${ctBadge}${_existsTag}${notifyBtnI}
                ${_itemBadge}
                ${x.notes
                    ? `<br><span class="text-box-cell" style="font-size:13px;color:var(--text-dim)">${sanitize(x.notes)}</span>${_iqEditIcon(`editInquiryNotes(${x.id})`,'نص الاستفسار')}`
                    : (isCCMgrI ? `<br>${_iqEditIcon(`editInquiryNotes(${x.id})`,'نص الاستفسار')}<span style="font-size:11px;color:var(--text-dim);">— لا يوجد نص —</span>` : '')}
                ${_serialHtml}
                ${finFieldsHtml}
                ${x.videoUrl && typeof _videoWatchBtn === 'function' ? `<br><span style="display:inline-block;margin-top:6px;">${_videoWatchBtn(x.videoUrl)}</span>` : ''}
            </td>
            <td><small style="color:var(--text-main)">${typeof _empNameHTML==='function'?_empNameHTML(x.addedBy||'—'):sanitize(x.addedBy||'—')}</small>${_iqEditIcon(`editInquiryAddedBy(${x.id})`,'اسم الموظف')}</td>
            <td><small>${_toLatinDigits(x.time)}</small>${_iqEditIcon(`editInquiryTime(${x.id})`,'الوقت')}</td>
            ${actions}
        </tr>`;
    }).join('');

    const iPagBar = document.getElementById('paginationI');
    if (iPagBar) iPagBar.innerHTML = _paginationBar('I', allRowsI.length, _pageI);
}

function renderAll() {
    const isAdmin = currentUser?.isAdmin;
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    _renderTableM(get, isAdmin);
    _renderTableO(get);
    _renderTableI(get);
    // تحديث جدول التدقيق إن كان مفتوحًا (دون إعادة بناء الفلاتر)
    if (typeof _renderAuditTable === 'function' && document.getElementById('auditTableContainer')) {
        _renderAuditTable();
    }
    // اشعارات مدير الكول سنتر — تسجيل دخول/خروج/خمول
    if (typeof _checkSessionsForNotifs === 'function') _checkSessionsForNotifs();
    // رسائل جديدة + شارة العداد
    if (typeof _checkNewMessages === 'function') _checkNewMessages();
    // تحديث صفحة الرسائل إن كانت مفتوحة (لا تُعِد البناء أثناء الكتابة لتجنّب اختفاء شريط الإدخال)
    if (typeof renderMessagesPage === 'function' && document.getElementById('messagesPageContainer')) {
        const _msgInputEl = document.getElementById('msgChatInput');
        const _isTypingMsg = _msgInputEl && (document.activeElement === _msgInputEl || (_msgInputEl.value && _msgInputEl.value.length));
        if (!_isTypingMsg) renderMessagesPage();
    }
    // تحديث جدول الموظفين إن كان مفتوحًا (لتحديث النقطة الخضراء)
    if (typeof renderEmployees === 'function' && document.querySelector('#tableE tbody')) {
        renderEmployees();
    }
    // كشف طلب تسجيل خروج إجباري للمستخدم الحالي
    if (typeof _checkForceLogoutForMe === 'function') _checkForceLogoutForMe();
    if (typeof _updateBadges === 'function') _updateBadges();
    if (typeof _checkNotifications === 'function') _checkNotifications();
}

