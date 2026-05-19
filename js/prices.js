/* ══════════════════════════════════════════════════════
   PRICES — Price list view & edit (cc_manager only)
══════════════════════════════════════════════════════ */

/* ⚡ أنماط مُستخرَجة من inline styles لتقليل حجم HTML الناتج وتسريع
   parse + layout عند رسم قوائم طويلة (الإطار السابق كان ~2KB inline لكل صنف). */
let _pricesStylesInjected = false;
function _injectPricesStyles() {
    if (_pricesStylesInjected) return;
    _pricesStylesInjected = true;
    const css = `
        .p-h-cell{padding:10px 12px;font-size:13px;font-weight:700;color:#fff;background:var(--accent-red);white-space:nowrap;}
        .p-cell{padding:9px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;}
        .p-cell-c{text-align:center;}
        .p-cell-r{text-align:right;}
        .p-row-hidden{opacity:0.45;}
        .p-row-sel{background:rgba(211,47,47,0.07);}
        .p-name{font-weight:600;}
        .p-dim{color:var(--text-dim);}
        .p-price{font-weight:700;color:#2e7d32;font-size:15px;}
        .p-tag{margin-right:6px;font-size:11px;background:rgba(0,0,0,0.18);color:var(--text-dim);padding:2px 7px;border-radius:6px;}
        .p-chk{accent-color:var(--accent-red);width:15px;height:15px;cursor:pointer;}
        .p-chkw{accent-color:#fff;}
        .p-chkb{accent-color:#1976d2;}
        .p-btn{border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-family:'Cairo';font-size:12px;font-weight:700;}
        .p-btn-view{background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;}
        .p-btn-edit{margin-right:4px;background:rgba(211,47,47,0.12);border:1px solid rgba(211,47,47,0.3);color:var(--accent-red);font-weight:400;}
        .p-btn-tg-on{margin-right:4px;background:rgba(46,125,50,0.12);border:1px solid rgba(46,125,50,0.35);color:#2e7d32;font-weight:400;}
        .p-btn-tg-off{margin-right:4px;background:rgba(100,100,100,0.1);border:1px solid rgba(100,100,100,0.25);color:var(--text-dim);font-weight:400;}
        .p-btn-del{margin-right:4px;background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.25);color:var(--accent-red);font-weight:400;}
    `;
    const tag = document.createElement('style');
    tag.id = '_prices_styles';
    tag.textContent = css;
    document.head.appendChild(tag);
}

function renderPrices() {
    _injectPricesStyles();
    const canEdit = perm('editPrices');
    // إظهار زر "إضافة صنف" فقط لأصحاب الصلاحية
    const _addBtn = document.getElementById('btnTogglePriceAdd');
    if (_addBtn) _addBtn.style.display = canEdit ? '' : 'none';
    if (!canEdit) {
        const _addForm = document.getElementById('priceAddForm');
        if (_addForm) _addForm.style.display = 'none';
    }
    const search  = (document.getElementById('priceSearchInput')?.value || '').trim().toLowerCase();
    // ⚡ فهرس واحد عبر Map بدلاً من priceList.indexOf لكل صنف داخل forEach
    //   — O(n) بدلاً من O(n²). فرق كبير عند ~300 صنف.
    const _idxByItem = new Map();
    for (let i = 0; i < priceList.length; i++) _idxByItem.set(priceList[i], i);
    const list    = priceList.filter(item =>
        (canEdit || !item.hidden) &&
        (!search ||
        item.name.toLowerCase().includes(search) ||
        item.weight.toLowerCase().includes(search))
    );

    // شريط التحديد الجماعي — زر "عرض المحدد" يظهر للجميع، و"حذف" للمدراء فقط
    const bulkBarHtml = (_selP.size > 0) ? `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;
                    background:rgba(21,101,192,0.08);border:1px solid rgba(21,101,192,0.3);
                    border-radius:12px;margin-bottom:10px;">
            <span style="font-weight:700;color:#0d47a1;font-size:13px;">✓ تم تحديد ${_selP.size} صنف</span>
            <button onclick="_showPriceCardMulti()"
                style="background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;border:none;border-radius:8px;
                       padding:6px 16px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;">
                👁 عرض المحدد (${_selP.size})
            </button>
            ${canEdit ? `<button onclick="bulkDeleteP()"
                style="background:var(--accent-red);color:#fff;border:none;border-radius:8px;
                       padding:6px 16px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;">
                🗑 حذف المحدد (${_selP.size})
            </button>` : ''}
            <button onclick="clearSelP()"
                style="background:var(--bg-input);color:var(--text-dim);border:1px solid var(--border);
                       border-radius:8px;padding:6px 14px;cursor:pointer;font-family:'Cairo';font-size:13px;">
                ✕ إلغاء التحديد
            </button>
        </div>` : '';

    const allVisibleSelected = list.length > 0 && list.every(item => _selP.has(_idxByItem.get(item)));

    // أعمدة الشبكة حسب الصلاحية
    const COLS = canEdit
        ? '4% 5% 30% 20% 13% 28%'
        : '5% 5% 36% 24% 14% 16%';

    // صف العناوين
    const chkCls = canEdit ? 'p-chk p-chkw' : 'p-chk p-chkb';
    const headersHtml =
        `<div class="p-h-cell p-cell-c" style="border-radius:8px 0 0 0;">
             <input type="checkbox" id="chkAllP" ${allVisibleSelected?'checked':''}
                 class="${chkCls}" onchange="selectAllP(this.checked)">
         </div>
         <div class="p-h-cell p-cell-r">#</div>
         <div class="p-h-cell p-cell-r">اسم الصنف</div>
         <div class="p-h-cell p-cell-r">الوزن / الوحدة</div>
         <div class="p-h-cell p-cell-c">السعر (د.أ)</div>
         <div class="p-h-cell p-cell-c" style="border-radius:0 8px 0 0;">${canEdit ? 'إجراءات' : 'عرض'}</div>`;

    // ⚡ pagination — نرسم 50 صنفاً فقط في المرّة الواحدة، لتفادي ثقل DOM
    //    عند 300+ صنف. التنقل بين الصفحات لحظي. البحث يعيد لصفحة 1.
    if (_pricePage > Math.max(1, Math.ceil(list.length / _PRICE_PAGE_SIZE))) _pricePage = 1;
    const totalPages = Math.max(1, Math.ceil(list.length / _PRICE_PAGE_SIZE));
    const startIdx = (_pricePage - 1) * _PRICE_PAGE_SIZE;
    const endIdx   = Math.min(startIdx + _PRICE_PAGE_SIZE, list.length);
    const pageItems = list.slice(startIdx, endIdx);

    // صفوف البيانات — استعمال classes بدل inline styles + event delegation
    let rowsHtml = '';
    if (list.length === 0) {
        rowsHtml = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">لا يوجد نتائج للبحث</div>`;
    } else {
        const parts = [];
        for (let i = 0; i < pageItems.length; i++) {
            const item     = pageItems[i];
            const realIdx  = _idxByItem.get(item);
            const isHidden = !!item.hidden;
            const isChecked = _selP.has(realIdx);
            const rowCls = 'p-cell' + (isHidden ? ' p-row-hidden' : (isChecked ? ' p-row-sel' : ''));
            const name = sanitize(item.name);
            const wt   = sanitize(item.weight);
            const hiddenTag = isHidden ? '<span class="p-tag">مُخفى</span>' : '';
            const rowNum = startIdx + i + 1;

            if (canEdit) {
                parts.push(
                    `<div class="${rowCls} p-cell-c"><input type="checkbox" class="${chkCls}" data-pchk="${realIdx}" ${isChecked?'checked':''}></div>`
                    + `<div class="${rowCls} p-dim">${rowNum}</div>`
                    + `<div class="${rowCls} p-name">${name}${hiddenTag}</div>`
                    + `<div class="${rowCls} p-dim">${wt}</div>`
                    + `<div class="${rowCls} p-cell-c" id="price-cell-${realIdx}"><span class="p-price">${item.price}</span></div>`
                    + `<div class="${rowCls} p-cell-c" style="white-space:nowrap;">`
                    +   `<button class="p-btn p-btn-view" data-pact="view" data-pidx="${realIdx}">👁 عرض</button>`
                    +   `<button class="p-btn p-btn-edit" id="edit-btn-${realIdx}" data-pact="edit" data-pidx="${realIdx}">✏️</button>`
                    +   `<button class="p-btn ${isHidden?'p-btn-tg-on':'p-btn-tg-off'}" data-pact="toggle" data-pidx="${realIdx}">${isHidden?'👁':'🙈'}</button>`
                    +   `<button class="p-btn p-btn-del" data-pact="del" data-pidx="${realIdx}">🗑</button>`
                    + `</div>`
                );
            } else {
                parts.push(
                    `<div class="${rowCls} p-cell-c"><input type="checkbox" class="${chkCls}" data-pchk="${realIdx}" ${isChecked?'checked':''}></div>`
                    + `<div class="${rowCls} p-dim">${rowNum}</div>`
                    + `<div class="${rowCls} p-name">${name}${hiddenTag}</div>`
                    + `<div class="${rowCls} p-dim">${wt}</div>`
                    + `<div class="${rowCls} p-cell-c" id="price-cell-${realIdx}"><span class="p-price">${item.price}</span></div>`
                    + `<div class="${rowCls} p-cell-c"><button class="p-btn p-btn-view" data-pact="view" data-pidx="${realIdx}">👁 عرض</button></div>`
                );
            }
        }
        rowsHtml = parts.join('');
    }

    // شريط الصفحات — يظهر فقط لو يوجد أكثر من صفحة
    let pageBarHtml = '';
    if (totalPages > 1) {
        const _pgBtn = (label, page, disabled, active) =>
            `<button class="p-btn" ${disabled?'disabled':''} data-pgo="${page}"
                style="background:${active?'var(--accent-red)':'var(--bg-input)'};color:${active?'#fff':'var(--text-main)'};
                       border:1px solid var(--border);min-width:34px;opacity:${disabled?'0.4':'1'};
                       cursor:${disabled?'default':'pointer'};">${label}</button>`;
        const buttons = [];
        buttons.push(_pgBtn('« السابق', _pricePage - 1, _pricePage === 1, false));
        const _pages = [];
        if (totalPages <= 7) for (let p = 1; p <= totalPages; p++) _pages.push(p);
        else {
            _pages.push(1);
            if (_pricePage > 3) _pages.push('…');
            for (let p = Math.max(2, _pricePage-1); p <= Math.min(totalPages-1, _pricePage+1); p++) _pages.push(p);
            if (_pricePage < totalPages - 2) _pages.push('…');
            _pages.push(totalPages);
        }
        for (const p of _pages) {
            if (p === '…') buttons.push('<span style="padding:0 6px;color:var(--text-dim);">…</span>');
            else buttons.push(_pgBtn(String(p), p, false, p === _pricePage));
        }
        buttons.push(_pgBtn('التالي »', _pricePage + 1, _pricePage === totalPages, false));
        pageBarHtml = `<div style="display:flex;gap:6px;justify-content:center;align-items:center;margin-top:14px;flex-wrap:wrap;">
            <span style="color:var(--text-dim);font-size:12px;margin-left:8px;">${startIdx+1}–${endIdx} من ${list.length}</span>
            ${buttons.join('')}
        </div>`;
    }

    document.getElementById('priceListContainer').innerHTML = bulkBarHtml + `
        <div style="overflow-x:auto;margin-top:10px;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:420px;">
                ${headersHtml}
                ${rowsHtml}
            </div>
        </div>
        ${pageBarHtml}`;

    _bindPriceContainerEvents();
}

/* ── pagination state ── */
const _PRICE_PAGE_SIZE = 50;
let _pricePage = 1;
function _gotoPricePage(p) {
    _pricePage = Math.max(1, p|0);
    renderPrices();
}

/* ── event delegation: نربط مستمعاً واحداً على الحاوية بدل آلاف الـ onclick
   inline — يُسرّع الـ parsing ويُقلل استهلاك الذاكرة بشكل ملحوظ. ── */
let _priceEventsBound = false;
function _bindPriceContainerEvents() {
    if (_priceEventsBound) return;
    const container = document.getElementById('priceListContainer');
    if (!container) return;
    _priceEventsBound = true;
    container.addEventListener('click', (e) => {
        const pgBtn = e.target.closest('[data-pgo]');
        if (pgBtn && !pgBtn.disabled) { _gotoPricePage(+pgBtn.dataset.pgo); return; }
        const btn = e.target.closest('[data-pact]');
        if (!btn) return;
        const idx = +btn.dataset.pidx;
        const act = btn.dataset.pact;
        if (act === 'view')        _showPriceCardSingle(idx);
        else if (act === 'edit') {
            const input = document.getElementById(`price-input-${idx}`);
            if (input) savePrice(idx); else startEditPrice(idx);
        }
        else if (act === 'toggle') togglePriceHidden(idx);
        else if (act === 'del')    deletePrice(idx);
    });
    container.addEventListener('change', (e) => {
        const chk = e.target.closest('input[data-pchk]');
        if (!chk) return;
        toggleSelP(+chk.dataset.pchk, chk.checked);
    });
}

function filterPrices() { _pricePage = 1; renderPrices(); }

/* ── التحديد المتعدد ── */
function toggleSelP(realIdx, checked) {
    checked ? _selP.add(realIdx) : _selP.delete(realIdx);
    renderPrices();
}
function selectAllP(checked) {
    const search = (document.getElementById('priceSearchInput')?.value || '').trim().toLowerCase();
    priceList.forEach((item, idx) => {
        const visible = (perm('editPrices') || !item.hidden) &&
            (!search || item.name.toLowerCase().includes(search) || item.weight.toLowerCase().includes(search));
        if (visible) checked ? _selP.add(idx) : _selP.delete(idx);
    });
    renderPrices();
}
function clearSelP() { _selP.clear(); renderPrices(); }
function bulkDeleteP() {
    if (!_selP.size) return;
    const names = [..._selP].filter(i => priceList[i])
        .map(i => `<div style="padding:3px 0;border-bottom:1px solid var(--border);">${sanitize(priceList[i].name)} — ${sanitize(priceList[i].weight)}</div>`).join('');
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--accent-red);margin-bottom:8px;">سيتم حذف ${_selP.size} صنف:</div>${names}`,
        () => {
            const toDelete = new Set(_selP);
            _selP.clear();
            [...toDelete].sort((a,b) => b-a).forEach(i => priceList.splice(i, 1));
            savePriceList();
            renderPrices();
        }
    );
}

/* ── حذف صنف واحد ── */
function deletePrice(realIdx) {
    const item = priceList[realIdx];
    if (!item) return;
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--text-main);margin-bottom:4px;">${sanitize(item.name)}</div>
         <div style="color:var(--text-dim);">${sanitize(item.weight)}</div>
         <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">السعر: ${item.price} د.أ</div>`,
        () => { _selP.delete(realIdx); priceList.splice(realIdx, 1); savePriceList(); renderPrices(); }
    );
}

/* ── إخفاء / إظهار صنف ── */
function togglePriceHidden(idx) {
    priceList[idx].hidden = !priceList[idx].hidden;
    savePriceList();
    renderPrices();
}

/* ── تعديل السعر ── */
function startEditPrice(idx) {
    const item = priceList[idx];
    const cell = document.getElementById(`price-cell-${idx}`);
    const btn  = document.getElementById(`edit-btn-${idx}`);
    if (!cell || !btn) return;

    cell.innerHTML = `
        <input type="number" id="price-input-${idx}" value="${item.price}"
            step="0.25" min="0"
            style="width:80px;padding:5px 8px;border:1px solid var(--accent-red);border-radius:8px;
                   background:var(--bg-input);color:var(--text-main);font-family:'Cairo';font-size:14px;text-align:center;">
    `;
    btn.innerHTML         = `✅ حفظ`;
    btn.onclick           = () => savePrice(idx);
    btn.style.background  = 'rgba(46,125,50,0.15)';
    btn.style.borderColor = 'rgba(46,125,50,0.4)';
    btn.style.color       = '#2e7d32';
    document.getElementById(`price-input-${idx}`)?.focus();
}

function savePrice(idx) {
    const input = document.getElementById(`price-input-${idx}`);
    if (!input) return;
    const val = parseFloat(input.value);
    if (isNaN(val) || val < 0) { alert('سعر غير صحيح'); return; }

    priceList[idx].price = val;
    savePriceList();
    renderPrices();

    // تظليل خلايا الصف المحدّث
    const cells = document.querySelectorAll(`[data-price-row="${idx}"]`);
    cells.forEach(c => { c.style.background = 'rgba(46,125,50,0.12)'; });
    setTimeout(() => cells.forEach(c => { c.style.background = ''; }), 1200);
}

/* ══════════════════════════════════════════════════════
   عرض سعر صنف (أو أصناف متعددة) — صياغة جاهزة + نسخ
══════════════════════════════════════════════════════ */
function _formatItemLine(item) {
    const w = item.weight ? ` (${item.weight})` : '';
    return `${item.name}${w} بسعر ${item.price} دينار`;
}

function _buildPriceTextSingle(item) {
    return 'اهلا وسهلا فيك ,, السعر الحالي للصنف الذي تم الاستفسار عنه من خلالكم هو :\n' +
           _formatItemLine(item);
}

function _buildPriceTextMulti(items) {
    if (items.length === 1) return _buildPriceTextSingle(items[0]);
    const lines = items.map(_formatItemLine).join('\n');
    return 'اهلا وسهلا فيك ,, السعر الحالي للأصناف الذي تم الاستفسار عنها من خلالكم هو :\n' + lines;
}

function _showPriceCardSingle(realIdx) {
    const item = priceList[realIdx];
    if (!item) return;
    _showPriceCardForText(_buildPriceTextSingle(item));
}

function _showPriceCardMulti() {
    const items = [..._selP].sort((a,b)=>a-b).map(i => priceList[i]).filter(Boolean);
    if (items.length === 0) { alert('لم يتم تحديد أي صنف'); return; }
    _showPriceCardForText(_buildPriceTextMulti(items));
}

function _showPriceCardForText(text) {
    // أزل أي بطاقة سابقة
    document.getElementById('_priceCardOverlay')?.remove();
    const o = document.createElement('div');
    o.id = '_priceCardOverlay';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;' +
                      'display:flex;align-items:center;justify-content:center;font-family:Cairo,sans-serif;direction:rtl;';
    const safeText = sanitize(text).replace(/\n/g, '<br>');
    o.innerHTML = `
        <div style="background:#fff;color:#222;border-radius:14px;padding:24px;max-width:560px;width:92%;
                    box-shadow:0 20px 50px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;
                        padding-bottom:10px;border-bottom:2px solid #e0e0e0;">
                <h3 style="margin:0;color:#0d47a1;font-size:18px;">📋 نص العرض</h3>
                <button onclick="document.getElementById('_priceCardOverlay').remove()"
                        style="background:none;border:none;color:#999;font-size:22px;cursor:pointer;line-height:1;">✕</button>
            </div>
            <div id="_priceCardText" style="background:#f5f9ff;border-right:4px solid #1976d2;padding:14px 16px;
                                            border-radius:8px;font-size:15px;line-height:1.9;color:#222;
                                            white-space:pre-wrap;word-break:break-word;min-height:80px;">${safeText}</div>
            <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
                <button id="_priceCardCopyBtn" onclick="_copyPriceCardText()"
                        style="flex:1;padding:11px;background:linear-gradient(135deg,#1976d2,#0d47a1);
                               color:#fff;border:none;border-radius:10px;cursor:pointer;
                               font-family:Cairo;font-weight:700;font-size:14px;">
                    📋 نسخ النص
                </button>
                <button onclick="document.getElementById('_priceCardOverlay').remove()"
                        style="flex:0 0 auto;padding:11px 22px;background:#eee;color:#333;
                               border:1px solid #ccc;border-radius:10px;cursor:pointer;
                               font-family:Cairo;font-weight:700;font-size:14px;">
                    إغلاق
                </button>
            </div>
        </div>
    `;
    o.dataset.rawText = text;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if (e.target === o) o.remove(); });
}

async function _copyPriceCardText() {
    const o = document.getElementById('_priceCardOverlay');
    if (!o) return;
    const text = o.dataset.rawText || '';
    const btn  = document.getElementById('_priceCardCopyBtn');
    let ok = false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text); ok = true;
        }
    } catch {}
    if (!ok) {
        // fallback: textarea + execCommand
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            ok = document.execCommand('copy');
            document.body.removeChild(ta);
        } catch {}
    }
    if (btn) {
        btn.textContent = ok ? '✓ تم النسخ' : '⚠ تعذّر النسخ';
        btn.style.background = ok ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#991b1b)';
        setTimeout(() => {
            btn.textContent = '📋 نسخ النص';
            btn.style.background = 'linear-gradient(135deg,#1976d2,#0d47a1)';
        }, 1800);
    }
}

/* ── إظهار/إخفاء نموذج إضافة صنف ── */
function togglePriceAddForm(forceState) {
    if (!perm('editPrices')) return;
    const form = document.getElementById('priceAddForm');
    if (!form) return;
    const show = (forceState === true) || (forceState === undefined && form.style.display === 'none');
    form.style.display = show ? 'block' : 'none';
    if (show) {
        document.getElementById('newPriceName')?.focus();
    } else {
        // امسح الحقول
        ['newPriceName','newPriceWeight','newPricePrice'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
    }
}

/* ── إضافة صنف جديد لقائمة الأسعار ── */
async function addPriceItem() {
    if (!perm('editPrices')) return alert('فقط مدير الكول سنتر يمكنه إضافة الأصناف');
    const name   = (document.getElementById('newPriceName')?.value   || '').trim();
    const weight = (document.getElementById('newPriceWeight')?.value || '').trim();
    const priceS = (document.getElementById('newPricePrice')?.value  || '').trim();
    if (!name)   return alert('يرجى كتابة اسم الصنف');
    if (!weight) return alert('يرجى كتابة الوزن / الوحدة');
    if (!priceS) return alert('يرجى كتابة السعر');
    const price = parseFloat(priceS);
    if (isNaN(price) || price < 0) return alert('السعر غير صحيح');

    // تحقّق من التكرار: نفس الاسم + الوزن
    const exists = (priceList || []).some(x => x.name === name && x.weight === weight);
    if (exists) {
        if (!confirm('يوجد صنف بنفس الاسم والوزن — هل تريد إضافته على أي حال؟')) return;
    }

    if (!Array.isArray(priceList)) priceList = [];
    // ⚠️ id ضروري لتفادي فقدان العنصر عند conflict مع السيرفر — انظر _handleVersionConflict
    priceList.unshift({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name, weight, price
    });

    // عطّل الزر مؤقتاً لإظهار حالة "جاري الحفظ" ومنع نقرات متكررة
    const saveBtn = document.querySelector('[onclick="addPriceItem()"]');
    const _origBtnHTML = saveBtn ? saveBtn.innerHTML : null;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '⏳ جاري الحفظ...'; }

    if (typeof _logAudit === 'function') {
        _logAudit('addPrice', '—', `${name} — ${weight} — ${price} د.أ`);
    }

    // ⚠️ انتظر تأكيد السيرفر فعلياً قبل اعتبار الإضافة ناجحة — يحلّ مشكلة
    //    "أضفت من الجهاز A ولم أجد على الجهاز B" حيث المتصفح أُغلق قبل
    //    اكتمال الـ fetch فالصنف ظل في localStorage فقط ولم يصل السيرفر.
    let _saveOk = false;
    try {
        const res = await savePriceList();
        _saveOk = !!(res && res.ok);
    } catch (e) {
        console.error('[prices] save failed:', e);
        _saveOk = false;
    }

    if (saveBtn && _origBtnHTML != null) { saveBtn.disabled = false; saveBtn.innerHTML = _origBtnHTML; }

    if (!_saveOk) {
        alert('⚠️ تعذّر حفظ الصنف على السيرفر — تحقق من الاتصال وأعد المحاولة.\n\nالصنف محفوظ محلياً ولن يضيع، لكنه قد لا يظهر على أجهزة أخرى حتى يصل السيرفر.');
        // لا نخفي النموذج ولا نمسح الحقول — يستطيع المستخدم إعادة المحاولة
        renderPrices();
        return;
    }

    // ✓ تأكد السيرفر — امسح وأخفِ + أعد الرسم
    togglePriceAddForm(false);
    renderPrices();
}
