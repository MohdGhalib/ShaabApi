/* ══════════════════════════════════════════════════════════════════
   CUSTOMER 360 — Phone-based customer history modal
   ══════════════════════════════════════════════════════════════════
   - يظهر سجل الزبون الكامل (استفسارات/منتسيات/شكاوى) بالنقر على رقمه
   - متاح فقط لـ cc_manager و cc_employee
   - Ctrl+K يفتح بحث سريع برقم الهاتف من أي مكان */

function _c360IsAuthorized() {
    const role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : null;
    return role === 'cc_manager' || role === 'cc_employee';
}

function _c360NormalizePhone(p) {
    return String(p || '').replace(/[\s\-+()]/g, '').replace(/^0+/, '');
}

function _c360PhoneOf(rec) {
    return rec?.phone || rec?.customerPhone || rec?.mobile || '';
}

/* عدّ عدد التواصلات السابقة لهذا الرقم (استفسارات + منتسيات محجوزة + شكاوى)
   يُستخدم لعرض badge صغير بجانب رقم الهاتف في جدول الاستفسارات */
function _c360ContactCount(rawPhone) {
    if (!rawPhone) return 0;
    const norm = _c360NormalizePhone(rawPhone);
    if (!norm) return 0;
    const match = (p) => {
        const np = _c360NormalizePhone(p);
        return np && (np.includes(norm) || norm.includes(np));
    };
    let n = 0;
    if (typeof db === 'object' && db) {
        n += (db.inquiries  || []).filter(x => !x.deleted && match(x.phone)).length;
        n += (db.montasiat  || []).filter(x => !x.deleted && match(x.reservedFor?.phone)).length;
        n += (db.complaints || []).filter(x => !x.deleted && match(x.customer?.phone)).length;
    }
    return n;
}
if (typeof window !== 'undefined') window._c360ContactCount = _c360ContactCount;

function _c360EnsureStyles() {
    if (document.getElementById('c360Styles')) return;
    const s = document.createElement('style');
    s.id = 'c360Styles';
    s.textContent = `
        #c360Modal { position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:99998; display:flex; align-items:center; justify-content:center; padding:20px; font-family:'Cairo',sans-serif; direction:rtl; }
        #c360Modal.hidden { display:none; }
        #c360Modal .c360-box { background:#1a1a1a; color:#fff; border:1px solid #444; border-radius:14px; width:100%; max-width:760px; max-height:88vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 48px rgba(0,0,0,0.6); }
        #c360Modal .c360-header { padding:14px 18px; background:linear-gradient(135deg,#1565c0,#0d3a73); display:flex; justify-content:space-between; align-items:center; gap:12px; }
        #c360Modal .c360-title { font-size:15px; font-weight:800; }
        #c360Modal .c360-close { background:rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4); border-radius:6px; padding:4px 12px; cursor:pointer; font-family:'Cairo'; font-size:13px; font-weight:700; }
        #c360Modal .c360-close:hover { background:rgba(255,255,255,0.32); }
        #c360Modal .c360-search { padding:10px 18px; background:rgba(255,255,255,0.04); border-bottom:1px solid rgba(255,255,255,0.08); display:flex; gap:8px; align-items:center; }
        #c360Modal .c360-search input { flex:1; background:#0e0e0e; color:#fff; border:1px solid #555; border-radius:8px; padding:8px 12px; font-family:'Cairo','monospace'; font-size:14px; }
        #c360Modal .c360-summary { padding:12px 18px; background:rgba(100,181,246,0.05); border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:14px; flex-wrap:wrap; font-size:12px; }
        #c360Modal .c360-summary .pill { background:rgba(100,181,246,0.12); border:1px solid rgba(100,181,246,0.35); border-radius:14px; padding:4px 12px; color:#90caf9; font-weight:700; }
        #c360Modal .c360-body { overflow-y:auto; padding:10px 18px 20px; flex:1; }
        #c360Modal .c360-section { margin-top:14px; }
        #c360Modal .c360-section-title { font-size:13px; font-weight:800; color:#ef9a9a; margin-bottom:6px; display:flex; align-items:center; gap:8px; }
        #c360Modal .c360-item { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:9px; padding:9px 11px; margin:6px 0; font-size:12.5px; line-height:1.6; }
        #c360Modal .c360-item .row1 { display:flex; justify-content:space-between; gap:8px; align-items:center; }
        #c360Modal .c360-item .meta { font-size:11px; color:#999; }
        #c360Modal .c360-item .status { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700; }
        #c360Modal .c360-item .status.done { background:rgba(76,175,80,0.18); color:#a5d6a7; border:1px solid rgba(76,175,80,0.4); }
        #c360Modal .c360-item .status.pending { background:rgba(245,124,0,0.18); color:#ffcc80; border:1px solid rgba(245,124,0,0.4); }
        #c360Modal .c360-item .status.rejected { background:rgba(229,57,53,0.18); color:#ef9a9a; border:1px solid rgba(229,57,53,0.4); }
        #c360Modal .c360-empty { color:#888; font-size:12px; padding:8px 4px; }
        .c360-phone-link { color:#90caf9; cursor:pointer; text-decoration:underline dotted; }
        .c360-phone-link:hover { color:#bbdefb; }
        .phone-cell-wrap { position:relative; display:inline-block; padding-top:6px; }
        .phone-contact-badge {
            position:absolute; top:-2px; right:-10px;
            min-width:16px; height:16px; padding:0 4px;
            background:#d32f2f; color:#fff;
            border:1.5px solid #1a1a1a; border-radius:10px;
            font-size:9px; font-weight:800; line-height:13px;
            text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.5);
            pointer-events:none;
        }
    `;
    document.head.appendChild(s);
}

function _c360EnsureModal() {
    if (document.getElementById('c360Modal')) return;
    const el = document.createElement('div');
    el.id = 'c360Modal';
    el.className = 'hidden';
    el.innerHTML = `
        <div class="c360-box" onclick="event.stopPropagation()">
            <div class="c360-header">
                <div class="c360-title">📞 ملف الزبون</div>
                <button class="c360-close" onclick="closeCustomer360()">إغلاق ✕</button>
            </div>
            <div class="c360-search">
                <input type="tel" id="c360PhoneInput" placeholder="ابحث برقم آخر — أدخل الرقم واضغط Enter" autocomplete="off" />
            </div>
            <div class="c360-summary" id="c360Summary"></div>
            <div class="c360-body" id="c360Body"></div>
        </div>
    `;
    el.addEventListener('click', e => { if (e.target === el) closeCustomer360(); });
    document.body.appendChild(el);

    const inp = document.getElementById('c360PhoneInput');
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') openCustomer360(inp.value);
        if (e.key === 'Escape') closeCustomer360();
    });
}

function _c360FmtStatus(rawStatus) {
    const s = rawStatus || '';
    let cls = 'pending';
    if (s.includes('تم') || s.includes('مغلق')) cls = 'done';
    else if (s.includes('مرفوض') || s.includes('ملغ')) cls = 'rejected';
    return `<span class="status ${cls}">${_c360Esc(s || '—')}</span>`;
}

function _c360Esc(t) {
    return String(t || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function _c360RenderItems(arr, kind) {
    if (!arr.length) return '<div class="c360-empty">— لا يوجد —</div>';
    return arr.slice(0, 15).map(x => {
        let summary = '';
        if (kind === 'inquiry')  summary = x.type ? `${_c360Esc(x.type)}` : '';
        else if (kind === 'montasia') summary = `#${_c360Esc(x.serial || '—')} — ${_c360Esc(x.type || '')}`;
        else if (kind === 'complaint') summary = _c360Esc((x.notes || '').slice(0, 60));
        const notesLine = (kind !== 'complaint' && x.notes) ? `<div style="margin-top:4px;color:#bbb;">${_c360Esc(x.notes.slice(0, 100))}</div>` : '';
        return `
            <div class="c360-item">
                <div class="row1">
                    <div><strong>${summary || '—'}</strong></div>
                    ${kind !== 'inquiry' ? _c360FmtStatus(x.status) : ''}
                </div>
                <div class="meta">📅 ${_c360Esc(x.iso || x.time || '')} · ${_c360Esc(x.branch || '')} · 👤 ${_c360Esc(x.addedBy || '')}</div>
                ${notesLine}
            </div>
        `;
    }).join('') + (arr.length > 15 ? `<div class="c360-empty">... و ${arr.length - 15} أخرى</div>` : '');
}

function openCustomer360(rawPhone) {
    if (!_c360IsAuthorized()) {
        console.log('[c360] not authorized for this role');
        return;
    }
    _c360EnsureStyles();
    _c360EnsureModal();

    const inp = document.getElementById('c360PhoneInput');
    if (rawPhone) inp.value = rawPhone;
    const phone = inp.value || rawPhone || '';
    const norm = _c360NormalizePhone(phone);

    const matches = (rec) => {
        if (!norm) return false;
        const p = _c360NormalizePhone(_c360PhoneOf(rec));
        return p && (p.includes(norm) || norm.includes(p));
    };

    const inq = (db?.inquiries  || []).filter(x => !x.deleted && matches(x)).sort((a,b)=>(b.id||0)-(a.id||0));
    const mnt = (db?.montasiat  || []).filter(x => !x.deleted && matches(x)).sort((a,b)=>(b.id||0)-(a.id||0));
    const cmp = (db?.complaints || []).filter(x => !x.deleted && matches(x)).sort((a,b)=>(b.id||0)-(a.id||0));

    const all = [...inq, ...mnt, ...cmp];
    let firstIso = '—', lastIso = '—';
    if (all.length) {
        const isos = all.map(x => x.iso).filter(Boolean).sort();
        firstIso = isos[0] || '—';
        lastIso  = isos[isos.length - 1] || '—';
    }

    document.getElementById('c360Summary').innerHTML = norm ? `
        <span class="pill">📞 ${_c360Esc(phone)}</span>
        <span class="pill">❓ ${inq.length} استفسار</span>
        <span class="pill">📋 ${mnt.length} منتسية</span>
        <span class="pill">⚠️ ${cmp.length} شكوى</span>
        <span class="pill">📅 أول تعامل: ${_c360Esc(firstIso.slice(0,10))}</span>
        <span class="pill">📅 آخر: ${_c360Esc(lastIso.slice(0,10))}</span>
    ` : '<span class="pill">أدخل رقم هاتف للبحث</span>';

    document.getElementById('c360Body').innerHTML = !norm ? '' : `
        <div class="c360-section">
            <div class="c360-section-title">📋 المنتسيات (${mnt.length})</div>
            ${_c360RenderItems(mnt, 'montasia')}
        </div>
        <div class="c360-section">
            <div class="c360-section-title">❓ الاستفسارات (${inq.length})</div>
            ${_c360RenderItems(inq, 'inquiry')}
        </div>
        <div class="c360-section">
            <div class="c360-section-title">⚠️ الشكاوى (${cmp.length})</div>
            ${_c360RenderItems(cmp, 'complaint')}
        </div>
    `;

    document.getElementById('c360Modal').classList.remove('hidden');
    setTimeout(() => inp.focus(), 50);
}

function closeCustomer360() {
    const el = document.getElementById('c360Modal');
    if (el) el.classList.add('hidden');
}

/* أنزِل الـ styles فور تحميل السكربت — الـ badge على رقم الهاتف يستخدمها قبل أن يُفتح الـ modal */
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _c360EnsureStyles);
    } else {
        _c360EnsureStyles();
    }
}

/* Ctrl+K — quick search shortcut (cc_manager / cc_employee only) */
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            if (!_c360IsAuthorized()) return;
            e.preventDefault();
            openCustomer360('');
        }
        if (e.key === 'Escape') closeCustomer360();
    });

    window.openCustomer360  = openCustomer360;
    window.closeCustomer360 = closeCustomer360;
}
