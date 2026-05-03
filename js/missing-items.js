/* ══════════════════════════════════════════════════════
   MISSING ITEMS — CRUD with 5-second confirm overlay
══════════════════════════════════════════════════════ */
/* ── حالة نافذة وقت تسجيل المنتسية ── */
let _addMTimeMode = 'now';

function addMontasia() {
    const c = document.getElementById("mCityAdd").value;
    const b = document.getElementById("mBranchAdd").value;
    const n = document.getElementById("mNotes").value.trim();
    const t = document.getElementById("mType").value;
    const be = (document.getElementById("mBranchEmp")?.value||'').trim();
    if (!c||!b||!n||!t||!be) return alert("يرجى إكمال البيانات");

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
    if (!c||!b||!n||!t||!be) return alert("يرجى إكمال البيانات");

    const rec = { id:Date.now(), country: co || _countryForCity(c), city:c, branch:b, notes:n, type:t, branchEmp:be, time:now(), iso:iso(),
        status:'قيد الانتظار', dt:'', addedBy:currentUser.name, deliveredBy:'' };

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

    db.montasiat.unshift(rec);
    if (typeof _skipMontasiaNotif !== 'undefined') _skipMontasiaNotif = true;
    save();
    document.getElementById("mNotes").value = "";
    document.getElementById("mType").value = "";
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
    if (item) { item.status='قيد الانتظار'; save(); }
}

// الموافقة على منتسيات التطبيق → قيد الانتظار (لتفعيل نظام التسليم)
function approveMontasiaFromMobile(id) {
    const item = db.montasiat.find(x => x.id===id);
    if (!item) return;
    item.status     = 'قيد الانتظار';
    item.approvedBy = currentUser ? currentUser.name : '—';
    item.approvedAt = now();
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
            _logAudit('deleteMontasia', item.branch || '—', `${item.branch} — ${(item.notes||'').substring(0,40)}`);
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
    if (item) { item.notes=newText; item.editedBy=currentUser.name; save(); }
}

/* ══ تصدير / استيراد Excel ══ */
function exportMontasiat() {
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const f = {
        city:        get('searchCityM'),
        branch:      get('searchBranchM'),
        date:        get('searchDateM'),
        text:        get('searchTextM').toLowerCase(),
        addedBy:     get('searchAddedByM'),
        deliveredBy: get('searchDeliveredByM'),
        type:        get('searchTypeM'),
    };
    const filtered = db.montasiat.filter(x =>
        !x.deleted &&
        (!f.city        || x.city === f.city) &&
        (!f.branch      || x.branch === f.branch) &&
        (!f.date        || x.iso.startsWith(f.date)) &&
        (!f.text        || (x.notes||'').toLowerCase().includes(f.text)) &&
        (!f.addedBy     || (x.addedBy||'').includes(f.addedBy)) &&
        (!f.deliveredBy || (x.deliveredBy||'').includes(f.deliveredBy)) &&
        (!f.type        || (x.type||'') === f.type)
    );
    if (!filtered.length) return alert('لا توجد نتائج للتصدير بالفلتر الحالي');
    const rows = filtered.map(x => ({
        'المحافظة':    x.city          || '',
        'الفرع':       x.branch        || '',
        'النوع':           x.type          || '',
        'موظف الفرع':     x.branchEmp     || '',
        'التفاصيل':        x.notes         || '',
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
        db.montasiat.unshift({
            id:          base + i,
            city:        String(r['المحافظة']).trim(),
            branch:      String(r['الفرع']).trim(),
            notes:       String(r['التفاصيل']).trim(),
            status:      String(r['الحالة']||'').trim() || 'قيد الانتظار',
            time:        parsed   ? parsed.time   : now(),
            iso:         parsed   ? parsed.iso    : iso(),
            branchEmp:   String(r['موظف الفرع'] || '').trim(),
            addedBy:     (String(r['أضافه'] || r['اضافه'] || r['الموظف'] || '').trim()) || currentUser.name,
            deliveredBy: String(r['سلّمه'] || r['سلمه'] || '').trim() || '',
            dt:          dtParsed ? dtParsed.time : '',
        });
    });
    _importMontasiaData = [];
    save();
    document.getElementById('importMontasiaModal').classList.add('hidden');
}

function cancelImportMontasia() {
    _importMontasiaData = [];
    document.getElementById('importMontasiaModal').classList.add('hidden');
}

/* ══ الإدخال الجماعي للمنتسيات ══ */
let _bulkRowSeq = 0;

function openBulkMontasiat() {
    const modal = document.getElementById('bulkMontasiatModal');
    if (!modal) return;
    document.getElementById('bulkRowsContainer').innerHTML = '';
    _bulkRowSeq = 0;
    for (let i = 0; i < 3; i++) bulkAddRow();
    modal.classList.remove('hidden');
}

function closeBulkMontasiat() {
    const m = document.getElementById('bulkMontasiatModal');
    if (m) m.classList.add('hidden');
}

function _bulkRowHTML(idx) {
    let countryOpts = '<option value="">اختيار الدولة</option>';
    for (const c in COUNTRIES_DATA) countryOpts += `<option value="${c}">${c}</option>`;
    return `
    <div id="bulkRow_${idx}" class="bulk-row" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:12px;color:var(--text-dim);font-weight:700;">سطر #${idx}</span>
            <span id="bulk_status_${idx}"></span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
            <select id="bulk_country_${idx}" onchange="updateCities('bulk_country_${idx}','bulk_city_${idx}','bulk_branch_${idx}')">${countryOpts}</select>
            <select id="bulk_city_${idx}" onchange="updateBranches('bulk_city_${idx}','bulk_branch_${idx}')" disabled><option value="">اختيار المحافظة</option></select>
            <select id="bulk_branch_${idx}" disabled><option value="">الفرع</option></select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <input type="text" id="bulk_branchEmp_${idx}" placeholder="اسم موظف الفرع *">
            <select id="bulk_type_${idx}">
                <option value="">-- نوع المنتسية --</option>
                <option value="نقدي">نقدي</option>
                <option value="أخرى">أخرى</option>
            </select>
        </div>
        <textarea id="bulk_notes_${idx}" placeholder="تفاصيل المنتسية..." rows="2" style="width:100%;box-sizing:border-box;margin-bottom:10px;"></textarea>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-dim);">
                <input type="checkbox" id="bulk_isPrev_${idx}" onchange="_bulkTogglePrev(${idx})">
                🕐 تسجيل بوقت سابق
            </label>
            <div id="bulk_prevFields_${idx}" style="display:none;flex:1;align-items:center;gap:8px;flex-wrap:wrap;">
                <input type="date" id="bulk_date_${idx}" style="padding:8px;">
                <input type="time" id="bulk_time_${idx}" style="padding:8px;">
                <input type="text" id="bulk_reason_${idx}" placeholder="سبب التسجيل بوقت سابق *" style="flex:1;min-width:200px;">
            </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="_bulkRemoveRow(${idx})" style="background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.4);color:#ef9a9a;border-radius:8px;padding:7px 14px;cursor:pointer;font-family:'Cairo';font-weight:700;">🗑️ حذف</button>
            <button onclick="_bulkSaveRow(${idx})" class="btn btn-main" style="padding:7px 22px;">💾 حفظ السطر</button>
        </div>
    </div>`;
}

function bulkAddRow() {
    const container = document.getElementById('bulkRowsContainer');
    if (!container) return;
    const idx = ++_bulkRowSeq;
    container.insertAdjacentHTML('beforeend', _bulkRowHTML(idx));
}

function _bulkTogglePrev(idx) {
    const cb = document.getElementById('bulk_isPrev_' + idx);
    const f  = document.getElementById('bulk_prevFields_' + idx);
    if (f) f.style.display = (cb && cb.checked) ? 'flex' : 'none';
}

function _bulkRemoveRow(idx) {
    const r = document.getElementById('bulkRow_' + idx);
    if (r) r.remove();
}

function _bulkReadRow(idx) {
    const get = id => document.getElementById(id);
    return {
        country:   get('bulk_country_'+idx)?.value || '',
        city:      get('bulk_city_'+idx)?.value || '',
        branch:    get('bulk_branch_'+idx)?.value || '',
        branchEmp:(get('bulk_branchEmp_'+idx)?.value || '').trim(),
        type:      get('bulk_type_'+idx)?.value || '',
        notes:    (get('bulk_notes_'+idx)?.value || '').trim(),
        isPrev:   !!get('bulk_isPrev_'+idx)?.checked,
        dateVal:   get('bulk_date_'+idx)?.value || '',
        timeVal:   get('bulk_time_'+idx)?.value || '',
        reason:   (get('bulk_reason_'+idx)?.value || '').trim()
    };
}

function _bulkBuildRecord(r, idxOffset) {
    if (!r.country || !r.city || !r.branch || !r.branchEmp || !r.type || !r.notes) return null;
    if (r.isPrev && (!r.dateVal || !r.timeVal || !r.reason)) return null;
    const rec = { id: Date.now() + (idxOffset||0), country:r.country, city:r.city, branch:r.branch, notes:r.notes, type:r.type, branchEmp:r.branchEmp,
        time: now(), iso: iso(), status:'قيد الانتظار', dt:'', addedBy: currentUser.name, deliveredBy:'' };
    if (r.isPrev) {
        const [y,m,d] = r.dateVal.split('-');
        const _h = parseInt(r.timeVal.split(':')[0]||0);
        const _mn = (r.timeVal.split(':')[1]||'00');
        const _ampm = _h>=12?'PM':'AM';
        const _h12  = _h%12||12;
        rec.time = `${parseInt(d)}/${parseInt(m)}/${y}، ${_h12}:${_mn} ${_ampm}`;
        rec.iso  = `${y}-${m}-${d}`;
        rec.addLateReason  = r.reason;
        rec.addLateNotedAt = now();
        rec.isLateAdd      = true;
    }
    return rec;
}

function _bulkMarkSaved(idx) {
    const row = document.getElementById('bulkRow_' + idx);
    if (!row) return;
    row.style.opacity = '0.55';
    row.style.pointerEvents = 'none';
    const status = document.getElementById('bulk_status_' + idx);
    if (status) status.innerHTML = '<span style="padding:3px 9px;background:rgba(46,125,50,0.18);border:1px solid rgba(46,125,50,0.4);color:#a5d6a7;border-radius:7px;font-size:11px;font-weight:700;">✅ تم الحفظ</span>';
}

function _bulkSaveRow(idx) {
    const data = _bulkReadRow(idx);
    const rec = _bulkBuildRecord(data, idx);
    if (!rec) return alert('السطر #' + idx + ': يرجى إكمال جميع الحقول' + (data.isPrev ? ' (التاريخ والوقت والسبب مطلوبة عند التسجيل بوقت سابق)' : ''));
    db.montasiat.unshift(rec);
    if (typeof _skipMontasiaNotif !== 'undefined') _skipMontasiaNotif = true;
    save();
    _bulkMarkSaved(idx);
}

function bulkSaveAll() {
    const container = document.getElementById('bulkRowsContainer');
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.bulk-row'));
    let saved = 0, skipped = 0, off = 0;
    rows.forEach(rowEl => {
        if (rowEl.style.pointerEvents === 'none') return;
        const idx = rowEl.id.replace('bulkRow_','');
        const data = _bulkReadRow(idx);
        const rec = _bulkBuildRecord(data, ++off);
        if (!rec) { skipped++; return; }
        db.montasiat.unshift(rec);
        _bulkMarkSaved(idx);
        saved++;
    });
    if (saved) {
        if (typeof _skipMontasiaNotif !== 'undefined') _skipMontasiaNotif = true;
        save();
    }
    alert(`تم حفظ ${saved} منتسية` + (skipped ? `\nتم تجاوز ${skipped} سطر بسبب نقص في البيانات` : ''));
    if (saved && !skipped) closeBulkMontasiat();
}

/* ── حذف كل المنتسيات (مدير الكول سنتر فقط) ── */
function deleteAllMontasiat() {
    if (currentUser?.role !== 'cc_manager') return;
    const total = (db.montasiat || []).filter(x => !x.deleted).length;
    if (!total) return alert('لا توجد منتسيات لحذفها');
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--accent-red);margin-bottom:6px;">⚠️ حذف كل المدخلات بشكل كامل</div>
         <div style="color:var(--text-main);">سيتم حذف <b>${total}</b> منتسية نهائياً ولا يمكن استرجاعها.</div>
         <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">قام بالطلب: ${sanitize(currentUser?.name || '—')}</div>`,
        () => {
            db.montasiat = [];
            if (typeof _logAudit === 'function') _logAudit('deleteAllMontasiat', '—', `حذف كامل لـ ${total} منتسية`);
            save();
            renderAll();
        }
    );
}

function toggleCountMontasia(id) {
    const item = db.montasiat.find(x => x.id === id);
    if (!item) return;
    item.countedByControl = !item.countedByControl;
    save();
    renderAll();
}

