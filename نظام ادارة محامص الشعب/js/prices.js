/* ══════════════════════════════════════════════════════
   PRICES — Price list view & edit (cc_manager only)
══════════════════════════════════════════════════════ */

function renderPrices() {
    const canEdit = perm('editPrices');
    // إظهار زر "إضافة صنف" فقط لأصحاب الصلاحية
    const _addBtn = document.getElementById('btnTogglePriceAdd');
    if (_addBtn) _addBtn.style.display = canEdit ? '' : 'none';
    if (!canEdit) {
        const _addForm = document.getElementById('priceAddForm');
        if (_addForm) _addForm.style.display = 'none';
    }
    const search  = (document.getElementById('priceSearchInput')?.value || '').trim().toLowerCase();
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

    const allVisibleSelected = list.length > 0 && list.every(item => _selP.has(priceList.indexOf(item)));

    // أعمدة الشبكة حسب الصلاحية
    const COLS = canEdit
        ? '4% 5% 30% 20% 13% 28%'
        : '5% 5% 36% 24% 14% 16%';

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
        : `<div style="${hCell}text-align:center;border-radius:8px 0 0 0;">
               <input type="checkbox" id="chkAllP" ${allVisibleSelected?'checked':''}
                   style="accent-color:#fff;width:15px;height:15px;cursor:pointer;"
                   onchange="selectAllP(this.checked)">
           </div>
           <div style="${hCell}text-align:right;">#</div>
           <div style="${hCell}text-align:right;">اسم الصنف</div>
           <div style="${hCell}text-align:right;">الوزن / الوحدة</div>
           <div style="${hCell}text-align:center;">السعر (د.أ)</div>
           <div style="${hCell}text-align:center;border-radius:0 8px 0 0;">عرض</div>`;

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
                       <button onclick="_showPriceCardSingle(${realIdx})"
                           style="background:linear-gradient(135deg,#1976d2,#0d47a1);border:none;border-radius:8px;
                                  padding:5px 10px;cursor:pointer;color:#fff;font-family:'Cairo';font-size:12px;font-weight:700;">
                           👁 عرض
                       </button>
                       <button onclick="startEditPrice(${realIdx})" id="edit-btn-${realIdx}"
                           style="margin-right:4px;background:rgba(211,47,47,0.12);border:1px solid rgba(211,47,47,0.3);border-radius:8px;
                                  padding:5px 10px;cursor:pointer;color:var(--accent-red);font-family:'Cairo';font-size:12px;">
                           ✏️
                       </button>
                       <button onclick="togglePriceHidden(${realIdx})"
                           style="margin-right:4px;background:${isHidden?'rgba(46,125,50,0.12)':'rgba(100,100,100,0.1)'};
                                  border:1px solid ${isHidden?'rgba(46,125,50,0.35)':'rgba(100,100,100,0.25)'};
                                  border-radius:8px;padding:5px 10px;cursor:pointer;
                                  color:${isHidden?'#2e7d32':'var(--text-dim)'};font-family:'Cairo';font-size:12px;">
                           ${isHidden ? '👁' : '🙈'}
                       </button>
                       <button onclick="deletePrice(${realIdx})"
                           style="margin-right:4px;background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.25);
                                  border-radius:8px;padding:5px 10px;cursor:pointer;color:var(--accent-red);
                                  font-family:'Cairo';font-size:12px;">
                           🗑
                       </button>
                   </div>`
                : `<div style="${cellBase}text-align:center;">
                       <input type="checkbox" class="chk-p" data-idx="${realIdx}" ${isChecked?'checked':''}
                           style="accent-color:#1976d2;width:15px;height:15px;cursor:pointer;"
                           onchange="toggleSelP(${realIdx},this.checked)">
                   </div>
                   <div style="${cellBase}color:var(--text-dim);">${visIdx + 1}</div>
                   <div style="${cellBase}font-weight:600;">
                       ${sanitize(item.name)}
                       ${isHidden ? `<span style="margin-right:6px;font-size:11px;background:rgba(0,0,0,0.18);color:var(--text-dim);padding:2px 7px;border-radius:6px;">مُخفى</span>` : ''}
                   </div>
                   <div style="${cellBase}color:var(--text-dim);">${sanitize(item.weight)}</div>
                   <div style="${cellBase}text-align:center;" id="price-cell-${realIdx}">
                       <span style="font-weight:700;color:#2e7d32;font-size:15px;">${item.price}</span>
                   </div>
                   <div style="${cellBase}text-align:center;">
                       <button onclick="_showPriceCardSingle(${realIdx})"
                           style="background:linear-gradient(135deg,#1976d2,#0d47a1);border:none;border-radius:8px;
                                  padding:5px 12px;cursor:pointer;color:#fff;font-family:'Cairo';font-size:12px;font-weight:700;">
                           👁 عرض
                       </button>
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
function addPriceItem() {
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
    priceList.unshift({ name, weight, price });
    savePriceList();

    if (typeof _logAudit === 'function') {
        _logAudit('addPrice', '—', `${name} — ${weight} — ${price} د.أ`);
    }

    // امسح وأخفِ + أعد الرسم
    togglePriceAddForm(false);
    renderPrices();
}
