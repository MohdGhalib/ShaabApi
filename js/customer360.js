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
        @keyframes _c360SlideUp { from { opacity:0; transform:translateY(28px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes _c360StampLand { 0% { opacity:0; transform:rotate(-12deg) scale(1.5); } 60% { opacity:1; transform:rotate(-12deg) scale(0.92); } 100% { opacity:1; transform:rotate(-12deg) scale(1); } }

        #c360Modal {
            position:fixed; inset:0;
            background:radial-gradient(ellipse at center, rgba(60,30,8,0.92) 0%, rgba(15,8,2,0.96) 100%);
            backdrop-filter:blur(8px);
            z-index:99998; display:flex; align-items:center; justify-content:center;
            padding:20px; direction:rtl;
            font-family:'Cairo','Tajawal',sans-serif;
        }
        #c360Modal.hidden { display:none; }
        #c360Modal .c360-wrap {
            max-width:720px; width:100%; max-height:92vh;
            display:flex; flex-direction:column;
            animation:_c360SlideUp 0.45s cubic-bezier(0.34,1.3,0.64,1);
        }

        /* الشريط العلوي (إرشاد) */
        #c360Modal .c360-instruction {
            background:linear-gradient(135deg,#25d366 0%,#128c7e 50%,#075e54 100%);
            color:#fff; padding:14px 22px; border-radius:18px 18px 0 0;
            display:flex; align-items:center; gap:14px;
            border:1.5px solid rgba(37,211,102,0.5); border-bottom:0;
            box-shadow:0 -6px 26px rgba(7,94,84,0.45);
            position:relative; overflow:hidden;
        }
        #c360Modal .c360-instruction::before {
            content:''; position:absolute; inset:0;
            background:repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 14px);
            pointer-events:none;
        }
        #c360Modal .c360-instruction-icon {
            width:38px; height:38px; background:rgba(255,255,255,0.22);
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            font-size:19px; flex-shrink:0; border:1.5px solid rgba(255,255,255,0.35);
        }
        #c360Modal .c360-instruction-text {
            font-size:13.5px; font-weight:800; line-height:1.55; letter-spacing:0.2px;
            text-shadow:0 1px 2px rgba(0,0,0,0.25);
        }

        /* الإيصال */
        #c360Modal .c360-receipt {
            background:linear-gradient(180deg, #fdf8ef 0%, #faf2e3 100%);
            border:1.5px solid rgba(139,69,19,0.25);
            border-radius:0 0 18px 18px;
            box-shadow:0 36px 90px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.85);
            position:relative; overflow:hidden;
            display:flex; flex-direction:column;
            flex:1; min-height:0;
        }
        #c360Modal .c360-receipt::before {
            content:''; position:absolute; inset:0;
            background-image:
                radial-gradient(circle at 14% 18%, rgba(139,69,19,0.04) 0, transparent 12%),
                radial-gradient(circle at 86% 78%, rgba(120,53,15,0.05) 0, transparent 14%);
            pointer-events:none;
        }
        #c360Modal .c360-bean {
            position:absolute; font-size:18px; opacity:0.18;
            user-select:none; pointer-events:none;
        }
        #c360Modal .c360-bean.c360-b1 { top:8px; right:14px; transform:rotate(35deg); }
        #c360Modal .c360-bean.c360-b2 { bottom:80px; left:18px; transform:rotate(-22deg); font-size:14px; }

        #c360Modal .c360-close {
            position:absolute; top:12px; left:14px; z-index:5;
            width:30px; height:30px; border-radius:50%;
            background:rgba(58,40,24,0.08); color:#5c3919;
            border:1px solid rgba(58,40,24,0.18);
            font-size:14px; font-weight:800; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            transition:background 0.18s, transform 0.18s;
            font-family:'Cairo';
        }
        #c360Modal .c360-close:hover { background:rgba(198,40,40,0.12); color:#c62828; transform:rotate(90deg); }

        /* رأس الإيصال */
        #c360Modal .c360-receipt-head {
            padding:24px 28px 18px; text-align:center;
            border-bottom:2px dashed rgba(139,69,19,0.22);
            position:relative;
        }
        #c360Modal .c360-brand {
            font-size:10.5px; font-weight:800; color:#8b6f47;
            letter-spacing:4px; margin-bottom:8px; text-transform:uppercase;
        }
        #c360Modal .c360-receipt-title {
            font-size:20px; font-weight:900; color:#3a2818;
            letter-spacing:0.3px; line-height:1.4;
        }
        #c360Modal .c360-stamp {
            position:absolute; top:16px; right:22px;
            transform:rotate(-12deg);
            border:2.5px solid #c62828; color:#c62828;
            padding:4px 12px; border-radius:6px;
            font-size:11px; font-weight:900; letter-spacing:1.5px;
            background:rgba(198,40,40,0.04);
            animation:_c360StampLand 0.7s 0.35s cubic-bezier(0.5,1.6,0.4,1) both;
            opacity:0;
        }

        /* شريط البحث */
        #c360Modal .c360-search {
            padding:14px 28px;
            background:rgba(255,245,220,0.4);
            border-bottom:2px dashed rgba(139,69,19,0.22);
            display:flex; gap:10px; align-items:center;
        }
        #c360Modal .c360-search input {
            flex:1; background:#fff; color:#3a2818;
            border:1.5px solid rgba(139,69,19,0.22);
            border-radius:10px; padding:10px 14px;
            font-family:'Cairo','Tajawal',sans-serif; font-size:14px; font-weight:700;
            transition:border-color 0.18s, box-shadow 0.18s;
            direction:rtl;
        }
        #c360Modal .c360-search input:focus {
            outline:none; border-color:#c0935d;
            box-shadow:0 0 0 3px rgba(192,147,93,0.18);
        }
        #c360Modal .c360-search input::placeholder { color:#a08770; font-weight:600; }

        /* شريط الملخّص (pills) */
        #c360Modal .c360-summary {
            padding:14px 28px;
            background:rgba(192,147,93,0.06);
            border-bottom:2px dashed rgba(139,69,19,0.22);
            display:flex; gap:8px; flex-wrap:wrap;
        }
        #c360Modal .c360-summary .pill {
            background:linear-gradient(135deg, #fff5dc 0%, #ffe9c2 100%);
            color:#5c3919;
            border:1.5px solid rgba(192,147,93,0.45);
            border-radius:14px; padding:5px 12px;
            font-size:11.5px; font-weight:800;
            box-shadow:0 1px 3px rgba(139,69,19,0.08);
        }

        /* جسم القائمة */
        #c360Modal .c360-body {
            overflow-y:auto; padding:8px 28px 20px; flex:1; min-height:0;
            position:relative;
        }
        #c360Modal .c360-section { margin-top:18px; }
        #c360Modal .c360-section-title {
            font-size:13.5px; font-weight:900; color:#5c3919;
            margin-bottom:10px;
            display:flex; align-items:center; gap:8px;
            letter-spacing:0.3px;
        }
        #c360Modal .c360-item {
            background:#fff;
            border:1.5px solid rgba(139,69,19,0.18);
            border-radius:12px; padding:11px 14px; margin:8px 0;
            font-size:12.5px; line-height:1.7;
            color:#3a2818;
            box-shadow:0 2px 6px rgba(139,69,19,0.05);
            transition:transform 0.18s, box-shadow 0.18s;
        }
        #c360Modal .c360-item:hover {
            transform:translateY(-1px);
            box-shadow:0 6px 14px rgba(139,69,19,0.12);
            border-color:#c0935d;
        }
        #c360Modal .c360-item .row1 {
            display:flex; justify-content:space-between; gap:8px; align-items:center;
            margin-bottom:4px;
        }
        #c360Modal .c360-item .row1 strong { color:#3a2818; font-weight:800; font-size:13px; }
        #c360Modal .c360-item .meta {
            font-size:11px; color:#8b6f47; font-weight:600;
            margin-top:4px;
        }
        #c360Modal .c360-item .status {
            font-size:10.5px; padding:3px 10px; border-radius:10px; font-weight:800;
        }
        #c360Modal .c360-item .status.done {
            background:rgba(46,125,50,0.12); color:#2e7d32;
            border:1px solid rgba(46,125,50,0.35);
        }
        #c360Modal .c360-item .status.pending {
            background:rgba(245,124,0,0.12); color:#e65100;
            border:1px solid rgba(245,124,0,0.35);
        }
        #c360Modal .c360-item .status.rejected {
            background:rgba(198,40,40,0.12); color:#c62828;
            border:1px solid rgba(198,40,40,0.35);
        }
        #c360Modal .c360-empty {
            color:#a08770; font-size:12px; padding:10px 4px;
            text-align:center; font-style:italic;
        }

        /* phone link in tables — same coffee tone but readable on dark bg */
        .c360-phone-link {
            color:#64b5f6 !important; cursor:pointer !important;
            text-decoration:underline !important; text-decoration-style:dotted !important;
            text-underline-offset:3px; font-weight:700;
            transition:color 0.15s ease;
        }
        .c360-phone-link:hover { color:#bbdefb !important; background:rgba(100,181,246,0.12); border-radius:4px; padding:1px 4px; }
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
        <div class="c360-wrap" onclick="event.stopPropagation()">
            <div class="c360-instruction">
                <div class="c360-instruction-icon">👤</div>
                <div class="c360-instruction-text">ملف الزبون والتعاملات السابقة معنا</div>
            </div>
            <div class="c360-receipt">
                <span class="c360-bean c360-b1">☕</span>
                <span class="c360-bean c360-b2">●</span>
                <button class="c360-close" onclick="closeCustomer360()" aria-label="إغلاق">✕</button>

                <div class="c360-receipt-head">
                    <div class="c360-brand">محامص الشعب</div>
                    <div class="c360-receipt-title">📞 ملف الزبون</div>
                    <span class="c360-stamp">ملف</span>
                </div>

                <div class="c360-search">
                    <input type="tel" id="c360PhoneInput" placeholder="ابحث برقم آخر — أدخل الرقم واضغط Enter" autocomplete="off" />
                </div>

                <div class="c360-summary" id="c360Summary"></div>

                <div class="c360-body" id="c360Body"></div>
            </div>
        </div>
    `;
    /* لا تُغلق عند النقر خارج النافذة — الإغلاق فقط بزر ✕ */
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
