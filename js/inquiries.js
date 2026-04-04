/* ══════════════════════════════════════════════════════
   INQUIRIES — CRUD operations
══════════════════════════════════════════════════════ */
function toggleInquiryNotes() {
    const t = document.getElementById("iType").value;
    document.getElementById("iNotesBox").style.display = (t==="شكوى"||t==="أخرى") ? "block" : "none";
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
    const cityEl  = document.getElementById("iCityAdd");
    const branchEl= document.getElementById("iBranchAdd");
    const c = cityEl.value, t = document.getElementById("iType").value;
    const p = document.getElementById("iPhone").value;
    const b = c === 'غير محدد' ? 'غير محدد' : branchEl.value;
    const needsNotes = (t==="شكوى"||t==="أخرى");
    const n = needsNotes ? document.getElementById("iNotes").value.trim() : "";
    if (!c||!b||!p||!t) return alert("يرجى إكمال البيانات");
    if (needsNotes&&!n) return alert("يرجى كتابة التفاصيل");
    if (!db.inquiriesnqSeq) db.inquiriesnqSeq = 1;
    db.inquiries.unshift({ id:Date.now(), seq:db.inquiriesnqSeq++, city:c, branch:b, phone:p, type:t, notes:n,
        time:now(), iso:iso(), addedBy:currentUser.name });
    save();
    document.getElementById("iPhone").value="";
    document.getElementById("iType").value="";
    document.getElementById("iNotes").value="";
    document.getElementById("iNotesBox").style.display="none";
    populateLinkedInquirySelect();
    toggleUnspecifiedBranch();
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
