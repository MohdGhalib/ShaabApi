/* ══════════════════════════════════════════════════════
   MISSING ITEMS — CRUD with 5-second confirm overlay
══════════════════════════════════════════════════════ */
function addMontasia() {
    const c = document.getElementById("mCityAdd").value;
    const b = document.getElementById("mBranchAdd").value;
    const n = document.getElementById("mNotes").value.trim();
    const t = document.getElementById("mType").value;
    if (!c||!b||!n||!t) return alert("يرجى إكمال البيانات");
    db.montasiat.unshift({ id:Date.now(), city:c, branch:b, notes:n, type:t, time:now(), iso:iso(),
        status:'قيد الانتظار', dt:'', addedBy:currentUser.name, deliveredBy:'' });
    if (typeof _skipMontasiaNotif !== 'undefined') _skipMontasiaNotif = true;
    save();
    document.getElementById("mNotes").value = "";
    document.getElementById("mType").value = "";
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

    // تعبئة قائمة المحافظات
    const cityEl = document.getElementById("deliverCitySelect");
    let opts = '<option value="">اختر المحافظة</option>';
    for (let c in branches) opts += `<option value="${c}">${c}</option>`;
    cityEl.innerHTML = opts;
    document.getElementById("deliverBranchSelect").innerHTML = '<option value="">اختر الفرع</option>';

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
        const city   = document.getElementById("deliverCitySelect").value;
        const branch = document.getElementById("deliverBranchSelect").value;
        if (!city || !branch) return alert("يرجى اختيار المحافظة والفرع");
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
        if (notesVal) item.deliverNotes = notesVal;
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
                ${item.dt ? `<br><span style="color:var(--text-main);font-weight:700;">⏰ ${typeof _toLatinDigits==='function'?_toLatinDigits(item.dt):item.dt}</span>` : ''}
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
        'النوع':       x.type          || '',
        'التفاصيل':    x.notes         || '',
        'الحالة':      x.status        || '',
        'وقت الإضافة': _toLatinDigits(x.time || ''),
        'وقت التسليم': _toLatinDigits(x.dt   || ''),
        'أضافه':       x.addedBy       || '',
        'سلّمه':       x.deliveredBy   || '',
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
            const wb   = XLSX.read(e.target.result, { type: 'binary' });
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
    _importMontasiaData.forEach((r, i) => {
        db.montasiat.unshift({
            id:          base + i,
            city:        String(r['المحافظة']).trim(),
            branch:      String(r['الفرع']).trim(),
            notes:       String(r['التفاصيل']).trim(),
            status:      String(r['الحالة']||'').trim() || 'قيد الانتظار',
            time:        now(),
            iso:         iso(),
            addedBy:     currentUser.name,
            deliveredBy: '',
            dt:          '',
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

function toggleCountMontasia(id) {
    const item = db.montasiat.find(x => x.id === id);
    if (!item) return;
    item.countedByControl = !item.countedByControl;
    save();
    renderAll();
}
