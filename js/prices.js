/* ══════════════════════════════════════════════════════
   PRICES — Price list view & edit (cc_manager only)
══════════════════════════════════════════════════════ */

function renderPrices() {
    const canEdit = perm('editPrices');
    const search  = (document.getElementById('priceSearchInput')?.value || '').trim().toLowerCase();
    const list    = priceList.filter(item =>
        (canEdit || !item.hidden) &&
        (!search ||
        item.name.toLowerCase().includes(search) ||
        item.weight.toLowerCase().includes(search))
    );

    // شريط الحذف الجماعي
    const bulkBarHtml = (canEdit && _selP.size > 0) ? `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;
                    background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.3);
                    border-radius:12px;margin-bottom:10px;">
            <span style="font-weight:700;color:var(--accent-red);font-size:13px;">✓ تم تحديد ${_selP.size} صنف</span>
            <button onclick="bulkDeleteP()"
                style="background:var(--accent-red);color:#fff;border:none;border-radius:8px;
                       padding:6px 16px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;">
                🗑 حذف المحدد (${_selP.size})
            </button>
            <button onclick="clearSelP()"
                style="background:var(--bg-input);color:var(--text-dim);border:1px solid var(--border);
                       border-radius:8px;padding:6px 14px;cursor:pointer;font-family:'Cairo';font-size:13px;">
                ✕ إلغاء التحديد
            </button>
        </div>` : '';

    const allVisibleSelected = list.length > 0 && list.every(item => _selP.has(priceList.indexOf(item)));

    // أعمدة الشبكة حسب الصلاحية
    const COLS = canEdit
        ? '4% 5% 33% 22% 13% 23%'
        : '6% 44% 28% 22%';

    // أنماط الخلايا
    const hCell = 'padding:10px 12px;font-size:13px;font-weight:700;color:#fff;background:var(--accent-red);white-space:nowrap;';
    const dCell = 'padding:9px 12px;font-size:13px;border-bottom:1px solid var(--border);word-break:break-word;align-content:center;';

    // صف العناوين
    const headersHtml = canEdit
        ? `<div style="${hCell}text-align:center;border-radius:8px 0 0 0;">
               <input type="checkbox" id="chkAllP" ${allVisibleSelected?'checked':''}
                   style="accent-color:#fff;width:15px;height:15px;cursor:pointer;"
                   onchange="selectAllP(this.checked)">
           </div>
           <div style="${hCell}text-align:right;">#</div>
           <div style="${hCell}text-align:right;">اسم الصنف</div>
           <div style="${hCell}text-align:right;">الوزن / الوحدة</div>
           <div style="${hCell}text-align:center;">السعر (د.أ)</div>
           <div style="${hCell}text-align:center;border-radius:0 8px 0 0;">إجراءات</div>`
        : `<div style="${hCell}text-align:right;border-radius:8px 0 0 0;">#</div>
           <div style="${hCell}text-align:right;">اسم الصنف</div>
           <div style="${hCell}text-align:right;">الوزن / الوحدة</div>
           <div style="${hCell}text-align:center;border-radius:0 8px 0 0;">السعر (د.أ)</div>`;

    // صفوف البيانات
    let rowsHtml = '';
    if (list.length === 0) {
        rowsHtml = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">لا يوجد نتائج للبحث</div>`;
    } else {
        list.forEach((item, visIdx) => {
            const realIdx  = priceList.indexOf(item);
            const isHidden = !!item.hidden;
            const isChecked = _selP.has(realIdx);
            const rowExtra = isHidden
                ? 'opacity:0.45;'
                : isChecked
                ? 'background:rgba(211,47,47,0.07);'
                : '';

            const cellBase = dCell + rowExtra;

            rowsHtml += canEdit
                ? `<div style="${cellBase}text-align:center;" data-price-row="${realIdx}">
                       <input type="checkbox" class="chk-p" data-idx="${realIdx}" ${isChecked?'checked':''}
                           style="accent-color:var(--accent-red);width:15px;height:15px;cursor:pointer;"
                           onchange="toggleSelP(${realIdx},this.checked)">
                   </div>
                   <div style="${cellBase}color:var(--text-dim);" data-price-row="${realIdx}">${visIdx + 1}</div>
                   <div style="${cellBase}font-weight:600;" data-price-row="${realIdx}">
                       ${sanitize(item.name)}
                       ${isHidden ? `<span style="margin-right:6px;font-size:11px;background:rgba(0,0,0,0.18);color:var(--text-dim);padding:2px 7px;border-radius:6px;">مُخفى</span>` : ''}
                   </div>
                   <div style="${cellBase}color:var(--text-dim);" data-price-row="${realIdx}">${sanitize(item.weight)}</div>
                   <div style="${cellBase}text-align:center;" id="price-cell-${realIdx}" data-price-row="${realIdx}">
                       <span style="font-weight:700;color:#2e7d32;font-size:15px;">${item.price}</span>
                   </div>
                   <div style="${cellBase}text-align:center;white-space:nowrap;" data-price-row="${realIdx}">
                       <button onclick="startEditPrice(${realIdx})" id="edit-btn-${realIdx}"
                           style="background:rgba(211,47,47,0.12);border:1px solid rgba(211,47,47,0.3);border-radius:8px;
                                  padding:5px 10px;cursor:pointer;color:var(--accent-red);font-family:'Cairo';font-size:12px;">
                           ✏️ تعديل
                       </button>
                       <button onclick="togglePriceHidden(${realIdx})"
                           style="margin-right:4px;background:${isHidden?'rgba(46,125,50,0.12)':'rgba(100,100,100,0.1)'};
                                  border:1px solid ${isHidden?'rgba(46,125,50,0.35)':'rgba(100,100,100,0.25)'};
                                  border-radius:8px;padding:5px 10px;cursor:pointer;
                                  color:${isHidden?'#2e7d32':'var(--text-dim)'};font-family:'Cairo';font-size:12px;">
                           ${isHidden ? '👁 إظهار' : '🙈 إخفاء'}
                       </button>
                       <button onclick="deletePrice(${realIdx})"
                           style="margin-right:4px;background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.25);
                                  border-radius:8px;padding:5px 10px;cursor:pointer;color:var(--accent-red);
                                  font-family:'Cairo';font-size:12px;">
                           🗑
                       </button>
                   </div>`
                : `<div style="${cellBase}color:var(--text-dim);">${visIdx + 1}</div>
                   <div style="${cellBase}font-weight:600;">
                       ${sanitize(item.name)}
                       ${isHidden ? `<span style="margin-right:6px;font-size:11px;background:rgba(0,0,0,0.18);color:var(--text-dim);padding:2px 7px;border-radius:6px;">مُخفى</span>` : ''}
                   </div>
                   <div style="${cellBase}color:var(--text-dim);">${sanitize(item.weight)}</div>
                   <div style="${cellBase}text-align:center;" id="price-cell-${realIdx}">
                       <span style="font-weight:700;color:#2e7d32;font-size:15px;">${item.price}</span>
                   </div>`;
        });
    }

    document.getElementById('priceListContainer').innerHTML = bulkBarHtml + `
        <div style="overflow-x:auto;margin-top:10px;">
            <div style="display:grid;grid-template-columns:${COLS};min-width:420px;">
                ${headersHtml}
                ${rowsHtml}
            </div>
        </div>`;
}

function filterPrices() { renderPrices(); }

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
