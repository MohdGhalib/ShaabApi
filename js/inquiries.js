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

/* ══════════════════════════════════════════════════════
   معلومات الفرع المعروضة بجانب زر "حفظ الاستفسار"
   - يقرأها الجميع
   - يعدّلها مدير الكول سنتر (cc_manager / admin) فقط
   - تعرض حالة الفرع: مفتوح / يغلق قريباً / مغلق (مع وميض أحمر)
   - تعرض المنتسيات النشطة للفرع كل واحدة في بوكس
══════════════════════════════════════════════════════ */
function _branchInfoKey(city, branch) {
    return `${(city||'').trim()}__${(branch||'').trim()}`;
}

function _getBranchInfo(city, branch) {
    if (!db.branchInfo || typeof db.branchInfo !== 'object') db.branchInfo = {};
    return db.branchInfo[_branchInfoKey(city, branch)] || {};
}

/* حقن @keyframes للوميض مرة واحدة */
function _ensureBranchBlinkStyle() {
    if (document.getElementById('_branchBlinkStyle')) return;
    const st = document.createElement('style');
    st.id = '_branchBlinkStyle';
    st.textContent = `
        @keyframes _branchBlink { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        .branch-blink { animation:_branchBlink 0.9s ease-in-out infinite; }
        .branch-blink-dot { display:inline-block;width:9px;height:9px;border-radius:50%;background:#e53935;box-shadow:0 0 8px rgba(229,57,53,0.85);vertical-align:middle;margin-left:6px;animation:_branchBlink 0.9s ease-in-out infinite;}
        .branch-blink-dot.warn { background:#ffb300;box-shadow:0 0 8px rgba(255,179,0,0.85); }
    `;
    document.head.appendChild(st);
}

/* حساب حالة الفرع حسب الوقت الحالي:
   - 'open'   : ضمن أوقات الدوام
   - 'closing-soon' : باقي ½ ساعة أو أقل على الإغلاق
   - 'closed' : خارج أوقات الدوام
   - null     : لا أوقات محددة */
function _calcBranchStatus(openHour, closeHour) {
    if (!openHour || !closeHour) return null;
    const _toMin = s => { const [h,m] = String(s).split(':').map(n=>parseInt(n,10)); return (h||0)*60 + (m||0); };
    const openMin  = _toMin(openHour);
    const closeMin = _toMin(closeHour);
    const d = new Date();
    const nowMin = d.getHours()*60 + d.getMinutes();
    let isOpen, minsToClose;
    if (closeMin > openMin) {
        // نفس اليوم
        isOpen = nowMin >= openMin && nowMin < closeMin;
        minsToClose = closeMin - nowMin;
    } else {
        // الإغلاق بعد منتصف الليل
        isOpen = nowMin >= openMin || nowMin < closeMin;
        minsToClose = nowMin >= openMin ? (24*60 - nowMin + closeMin) : (closeMin - nowMin);
    }
    if (!isOpen) return 'closed';
    if (minsToClose <= 30) return 'closing-soon';
    return 'open';
}

/* بناء شارة حالة الفرع */
function _renderBranchStatusBadge(openHour, closeHour) {
    const st = _calcBranchStatus(openHour, closeHour);
    if (st === 'closed') {
        return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:8px;background:rgba(229,57,53,0.12);border:1px solid rgba(229,57,53,0.5);"><span class="branch-blink-dot"></span><span class="branch-blink" style="color:#ef5350;font-weight:700;font-size:11px;">🔒 الفرع مغلق</span></span>`;
    }
    if (st === 'closing-soon') {
        return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:8px;background:rgba(255,179,0,0.12);border:1px solid rgba(255,179,0,0.55);"><span class="branch-blink-dot warn"></span><span class="branch-blink" style="color:#ffb300;font-weight:700;font-size:11px;">⏰ الفرع يغلق قريباً</span></span>`;
    }
    if (st === 'open') {
        return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:8px;background:rgba(46,125,50,0.12);border:1px solid rgba(46,125,50,0.45);color:#a5d6a7;font-weight:700;font-size:11px;">🟢 الفرع مفتوح</span>`;
    }
    return '';
}

/* خريطة حقول معلومات الفرع */
const _BRANCH_FIELDS = {
    managerName:      { label: 'مدير الفرع',         type: 'text', icon: '👤' },
    managerPhone:     { label: 'رقم مدير الفرع',     type: 'tel',  icon: '📞' },
    areaManagerName:  { label: 'مدير المنطقة',       type: 'text', icon: '👤' },
    areaManagerPhone: { label: 'رقم مدير المنطقة',   type: 'tel',  icon: '📞' },
    openHour:         { label: 'موعد الافتتاح',      type: 'time', icon: '🕘' },
    closeHour:        { label: 'موعد الإغلاق',       type: 'time', icon: '🕔' }
};

/* بناء رابط واتساب من رقم محلي/دولي
   - يطبّع: 00 → بإزالة، 0 → 962، خلاف ذلك يُتركها كما هي */
function _whatsappUrl(phone) {
    if (!phone) return null;
    let p = String(phone).replace(/[^\d]/g, '').trim();
    if (!p) return null;
    if (p.startsWith('00')) p = p.slice(2);
    else if (p.startsWith('0')) p = '962' + p.slice(1);
    return `https://web.whatsapp.com/send?phone=${p}`;
}

/* تنسيق الوقت من HH:MM (24 ساعة) إلى صيغة 12 ساعة AM/PM */
function _formatTimeAmPm(hhmm) {
    if (!hhmm) return '';
    const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return hhmm;
    let h = parseInt(m[1], 10);
    const mm = m[2];
    if (isNaN(h)) return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${mm} ${ampm}`;
}

/* بناء حقل عرض/تعديل مضمّن (inline) — مدمج في صف أفقي */
function _renderBranchInlineField(fieldKey, value, isCCMgr) {
    const cfg = _BRANCH_FIELDS[fieldKey];
    if (!cfg) return '';
    const isPhone = cfg.type === 'tel';
    const isTime  = cfg.type === 'time';
    const _viewValue = isTime ? _formatTimeAmPm(value) : value;
    const _waUrl  = isPhone ? _whatsappUrl(value) : null;
    const _waBtn = (isPhone && _waUrl) ? `<a href="${_waUrl}" target="WhatsAppWeb" rel="noopener" title="فتح محادثة واتساب" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#25D366;border-radius:50%;text-decoration:none;box-shadow:0 1px 4px rgba(37,211,102,0.4);vertical-align:middle;transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.12)'" onmouseout="this.style.transform='scale(1)'"><svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>` : '';
    const _editBtn = isCCMgr ? `<button onclick="editBranchField('${fieldKey}')" title="تعديل ${sanitize(cfg.label)}" style="background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0 2px;font-size:12px;">✏️</button>` : '';
    const _inputWidth = cfg.type === 'time' ? '110px' : (isPhone ? '130px' : '120px');
    return `<span id="brView-${fieldKey}" style="display:inline-flex;align-items:center;gap:3px;">
            <span style="color:var(--text-main);font-weight:700;${isTime?'font-family:monospace;':''}">${sanitize(_viewValue || '—')}</span>
            ${_editBtn}${_waBtn}
        </span>${isCCMgr ? `<span id="brEdit-${fieldKey}" style="display:none;align-items:center;gap:3px;">
            <input id="brInp-${fieldKey}" type="${cfg.type}" value="${sanitize(value || '')}" style="padding:3px 6px;font-size:11px;font-family:'Cairo';width:${_inputWidth};">
            <button onclick="saveBranchField('${fieldKey}')" title="حفظ" style="padding:2px 7px;background:rgba(46,125,50,0.2);border:1px solid rgba(46,125,50,0.5);color:#a5d6a7;border-radius:5px;cursor:pointer;font-family:'Cairo';font-size:10px;font-weight:700;">💾</button>
            <button onclick="cancelBranchField('${fieldKey}')" title="إلغاء" style="padding:2px 7px;background:rgba(120,120,120,0.1);border:1px solid var(--border);color:var(--text-dim);border-radius:5px;cursor:pointer;font-family:'Cairo';font-size:10px;">✗</button>
        </span>` : ''}`;
}

function _updateBranchInfoPanel() {
    _ensureBranchBlinkStyle();
    const panel = document.getElementById('iBranchInfoPanel');
    if (!panel) return;
    const city = document.getElementById('iCityAdd')?.value || '';
    const br   = document.getElementById('iBranchAdd')?.value || '';
    if (!city || !br || br === 'غير محدد' || city === 'غير محدد') {
        panel.style.display = 'none';
        panel.innerHTML = '';
        _scheduleBranchPanelTick(false);
        return;
    }
    const info        = _getBranchInfo(city, br);
    const isCCMgr     = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    const statusBadge = _renderBranchStatusBadge(info.openHour, info.closeHour);
    panel.style.display = 'block';

    panel.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(33,150,243,0.10),rgba(33,150,243,0.03));border:1px solid rgba(100,181,246,0.40);border-radius:14px;padding:12px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.18);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
                <span style="font-size:13px;font-weight:700;color:#90caf9;">🏢 ${sanitize(br)} / ${sanitize(city)}</span>
                ${statusBadge}
            </div>
            <div style="display:grid;grid-template-columns:max-content max-content max-content;gap:8px 14px;align-items:center;font-size:12px;line-height:1.7;">
                ${(typeof getBranchRegion === 'function' && getBranchRegion(br) === 'فروع العقبة') ? '' : `
                <span style="color:var(--text-dim);">👤 مدير الفرع:</span>
                ${_renderBranchInlineField('managerName', info.managerName, isCCMgr)}
                <span style="display:inline-flex;align-items:center;gap:5px;"><span style="color:var(--text-dim);">📞</span>${_renderBranchInlineField('managerPhone', info.managerPhone, isCCMgr)}</span>
                `}
                <span style="color:var(--text-dim);">👤 مدير المنطقة:</span>
                ${_renderBranchInlineField('areaManagerName', info.areaManagerName, isCCMgr)}
                <span style="display:inline-flex;align-items:center;gap:5px;"><span style="color:var(--text-dim);">📞</span>${_renderBranchInlineField('areaManagerPhone', info.areaManagerPhone, isCCMgr)}</span>
            </div>
            <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);display:grid;grid-template-columns:max-content max-content;gap:6px 12px;align-items:center;font-size:12px;line-height:1.7;">
                <span style="color:var(--text-dim);">🕘 موعد الافتتاح:</span>
                ${_renderBranchInlineField('openHour', info.openHour, isCCMgr)}

                <span style="color:var(--text-dim);">🕔 موعد الإغلاق:</span>
                ${_renderBranchInlineField('closeHour', info.closeHour, isCCMgr)}
            </div>
        </div>`;
    _scheduleBranchPanelTick(true);
}

/* ── تعديل/حفظ/إلغاء بند واحد فقط ── */
function editBranchField(fieldKey) {
    const isCCMgr = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    if (!isCCMgr) return;
    const v = document.getElementById(`brView-${fieldKey}`);
    const e = document.getElementById(`brEdit-${fieldKey}`);
    if (v) v.style.display = 'none';
    if (e) e.style.display = 'inline-flex';
    document.getElementById(`brInp-${fieldKey}`)?.focus();
}

function cancelBranchField(fieldKey) {
    const v = document.getElementById(`brView-${fieldKey}`);
    const e = document.getElementById(`brEdit-${fieldKey}`);
    if (v) v.style.display = 'inline-flex';
    if (e) e.style.display = 'none';
}

function saveBranchField(fieldKey) {
    const isCCMgr = currentUser?.role === 'cc_manager' || currentUser?.isAdmin;
    if (!isCCMgr) return alert('فقط مدير الكول سنتر يمكنه تعديل معلومات الفرع');
    if (!_BRANCH_FIELDS[fieldKey]) return;
    const city = document.getElementById('iCityAdd')?.value || '';
    const br   = document.getElementById('iBranchAdd')?.value || '';
    if (!city || !br || br === 'غير محدد' || city === 'غير محدد') return alert('يرجى اختيار محافظة وفرع صحيحين');

    if (!db.branchInfo || typeof db.branchInfo !== 'object') db.branchInfo = {};
    const k = _branchInfoKey(city, br);
    if (!db.branchInfo[k]) db.branchInfo[k] = {};
    const _val = (document.getElementById(`brInp-${fieldKey}`)?.value || '').trim();
    db.branchInfo[k][fieldKey]   = _val;
    db.branchInfo[k].updatedAt   = now();
    db.branchInfo[k].updatedTs   = Date.now();
    db.branchInfo[k].updatedBy   = currentUser?.name || '—';

    if (typeof _logAudit === 'function') {
        _logAudit('saveBranchInfoField', br, `${city} | ${_BRANCH_FIELDS[fieldKey].label} → ${_val || '—'}`);
    }
    save();
    // 🛡️ دفع فوري للسيرفر لتجنّب فقدان حقل سابق عند حفظ حقل تالٍ بسرعة
    if (typeof _flushPendingSave === 'function') _flushPendingSave();
    _updateBranchInfoPanel();
}

/* تحديث تلقائي كل دقيقة لمزامنة حالة الفرع مع الوقت الحالي */
let _branchPanelTickTimer = null;
function _scheduleBranchPanelTick(active) {
    if (_branchPanelTickTimer) { clearInterval(_branchPanelTickTimer); _branchPanelTickTimer = null; }
    if (!active) return;
    _branchPanelTickTimer = setInterval(() => {
        const panel = document.getElementById('iBranchInfoPanel');
        if (!panel || panel.style.display === 'none') {
            if (_branchPanelTickTimer) { clearInterval(_branchPanelTickTimer); _branchPanelTickTimer = null; }
            return;
        }
        // لا تُحدّث أثناء التحرير (cc_manager)
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && panel.contains(active)) return;
        _updateBranchInfoPanel();
    }, 60_000);
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
        _updateBranchInfoPanel();
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
    //    احفظ القيم الأصلية لاسترجاعها عند فك الحجز
    inq.preReserveCity    = inq.city    || '';
    inq.preReserveBranch  = inq.branch  || '';
    inq.preReserveCountry = inq.country || '';
    inq.preReserveNotes   = inq.notes   || '';
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
