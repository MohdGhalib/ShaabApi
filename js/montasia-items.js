/* ══════════════════════════════════════════════════════
   Multi-item montasia helpers
   Supports a new type 'متعدد الأصناف' where one montasia
   record contains an items[] array. Each item carries its
   own sub-type (نقدي / محامص-وزن / محامص-قيمة / أخرى) plus
   relevant fields. Legacy single-type records are not
   touched.
   ══════════════════════════════════════════════════════ */

const M_MULTI_TYPE = 'متعدد الأصناف';

/* normalize: returns array of items for ANY montasia record */
function _normalizeMItems(rec) {
    if (!rec) return [];
    if (Array.isArray(rec.items) && rec.items.length > 0) return rec.items;
    const t = rec.type;
    if (t === 'نقدي') {
        return [{ subType:'نقدي', value: rec.missingValue || '', notes: rec.notes || '' }];
    }
    if (t === 'اصناف محمص الشعب') {
        return [{
            subType: rec.roastSubType === 'وزن' ? 'محامص-وزن' : 'محامص-قيمة',
            name:    rec.roastItemName  || '',
            value:   rec.roastItemValue || '',
            weight:  rec.roastItemWeight || ''
        }];
    }
    return [{ subType:'أخرى', notes: rec.notes || '' }];
}

/* small badge per item sub-type */
function _itemBadgeHTML(item) {
    const st = item.subType || 'أخرى';
    if (st === 'نقدي') {
        return '<span style="display:inline-block;background:rgba(255,193,7,0.18);color:#ffd54f;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,193,7,0.35);white-space:nowrap;">💰 نقدي</span>';
    }
    if (st === 'محامص-وزن') {
        return '<span style="display:inline-block;background:rgba(255,152,0,0.20);color:#ffb74d;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(255,152,0,0.4);white-space:nowrap;">🌰 وزن</span>';
    }
    if (st === 'محامص-قيمة') {
        return '<span style="display:inline-block;background:rgba(186,104,200,0.22);color:#e1bee7;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(186,104,200,0.4);white-space:nowrap;">🌰 قيمة</span>';
    }
    return '<span style="display:inline-block;background:rgba(100,181,246,0.18);color:#90caf9;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid rgba(100,181,246,0.35);white-space:nowrap;">📦 أخرى</span>';
}

/* item details rendered as inline HTML (next to badge) */
function _itemDetailHTML(item) {
    const st = item.subType || 'أخرى';
    const safe = (typeof sanitize === 'function') ? sanitize : (s => String(s||''));
    if (st === 'نقدي') {
        const v = item.value ? `<b style="color:#ffd54f;">${safe(item.value)}د</b>` : '';
        const n = item.notes ? ` <span style="color:var(--text-dim);">— ${safe(item.notes)}</span>` : '';
        return v + n || '—';
    }
    if (st === 'محامص-وزن') {
        const parts = [];
        if (item.name)   parts.push(`<b>${safe(item.name)}</b>`);
        if (item.weight) parts.push(`<span style="color:#ffb74d;">${safe(item.weight)}كغ</span>`);
        if (item.value)  parts.push(`<span style="color:#ffd54f;">${safe(item.value)}د</span>`);
        return parts.join(' · ') || '—';
    }
    if (st === 'محامص-قيمة') {
        const parts = [];
        if (item.name)   parts.push(`<b>${safe(item.name)}</b>`);
        if (item.value)  parts.push(`<span style="color:#ffd54f;">${safe(item.value)}د</span>`);
        return parts.join(' · ') || '—';
    }
    return safe(item.notes || '—');
}

/* full items list for table cell — used when rec.type === متعدد الأصناف */
function _renderItemsCellHTML(rec) {
    const items = _normalizeMItems(rec);
    if (!items.length) return '';
    return items.map((it, i) => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;${i < items.length-1 ? 'border-bottom:1px dashed rgba(255,255,255,0.08);' : ''}">
            <span style="flex-shrink:0;color:var(--text-dim);font-size:11px;font-weight:700;min-width:18px;">${i+1}.</span>
            ${_itemBadgeHTML(it)}
            <div style="flex:1;font-size:12px;color:var(--text-main);min-width:0;">${_itemDetailHTML(it)}</div>
        </div>`).join('');
}

/* plain-text per item for Excel export */
function _itemDetailText(item) {
    const st = item.subType || 'أخرى';
    if (st === 'نقدي') {
        const parts = ['نقدي'];
        if (item.value) parts.push(`${item.value}د`);
        if (item.notes) parts.push(item.notes);
        return parts.join(' — ');
    }
    if (st === 'محامص-وزن' || st === 'محامص-قيمة') {
        const parts = [st === 'محامص-وزن' ? 'محامص (وزن)' : 'محامص (قيمة)'];
        if (item.name)   parts.push(item.name);
        if (item.weight) parts.push(`${item.weight}كغ`);
        if (item.value)  parts.push(`${item.value}د`);
        return parts.join(' — ');
    }
    return 'أخرى' + (item.notes ? `: ${item.notes}` : '');
}

function _buildItemsExportText(rec) {
    const items = _normalizeMItems(rec);
    if (!items.length) return rec.notes || '';
    return items.map((it, i) => `${i+1}) ${_itemDetailText(it)}`).join('\n');
}

/* ────────── form helpers (called from add-form UI) ────────── */

let _multiRowCounter = 0;

function _addMultiItemRow() {
    const list = document.getElementById('mMultiItemsList');
    if (!list) return;
    const rowId = 'mItemRow_' + (++_multiRowCounter);
    const div = document.createElement('div');
    div.id = rowId;
    div.className = 'm-multi-row';
    div.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;flex-direction:column;gap:8px;position:relative;';
    div.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="background:rgba(76,175,80,0.18);color:#a5d6a7;padding:2px 9px;border-radius:6px;font-size:11px;font-weight:700;flex-shrink:0;">صنف ${_multiRowCounter}</span>
            <select onchange="_onMultiItemSubTypeChange('${rowId}')" data-role="subType" style="flex:1;font-size:13px;padding:7px;font-family:'Cairo';">
                <option value="">-- نوع الصنف --</option>
                <option value="نقدي">💰 نقدي</option>
                <option value="محامص-وزن">🌰 محامص الشعب (وزن)</option>
                <option value="محامص-قيمة">🌰 محامص الشعب (قيمة)</option>
                <option value="أخرى">📦 أخرى</option>
            </select>
            <button type="button" onclick="_removeMultiItemRow('${rowId}')" title="حذف الصنف" style="background:rgba(211,47,47,0.15);border:1px solid rgba(211,47,47,0.4);color:#ef9a9a;border-radius:8px;padding:6px 10px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;flex-shrink:0;">✕</button>
        </div>
        <div data-role="fields" style="display:none;"></div>
    `;
    list.appendChild(div);
}

function _onMultiItemSubTypeChange(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const st = row.querySelector('[data-role="subType"]').value;
    const fieldsDiv = row.querySelector('[data-role="fields"]');
    if (!st) { fieldsDiv.style.display = 'none'; fieldsDiv.innerHTML = ''; return; }

    let html = '';
    if (st === 'نقدي') {
        html = `
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;">
                <input data-field="value" type="text" inputmode="decimal" placeholder="القيمة بالدينار *" style="font-size:13px;padding:7px;font-family:'Cairo';">
                <input data-field="notes" type="text" placeholder="ملاحظة (اختياري)" style="font-size:13px;padding:7px;font-family:'Cairo';">
            </div>`;
    } else if (st === 'محامص-وزن') {
        html = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <input data-field="name"   type="text" placeholder="اسم الصنف *"  style="font-size:13px;padding:7px;font-family:'Cairo';">
                <input data-field="weight" type="text" inputmode="decimal" placeholder="الوزن (كغ) *" style="font-size:13px;padding:7px;font-family:'Cairo';">
                <input data-field="value"  type="text" inputmode="decimal" placeholder="القيمة بالدينار *" style="font-size:13px;padding:7px;font-family:'Cairo';">
            </div>`;
    } else if (st === 'محامص-قيمة') {
        html = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input data-field="name"  type="text" placeholder="اسم الصنف *"  style="font-size:13px;padding:7px;font-family:'Cairo';">
                <input data-field="value" type="text" inputmode="decimal" placeholder="القيمة بالدينار *" style="font-size:13px;padding:7px;font-family:'Cairo';">
            </div>`;
    } else if (st === 'أخرى') {
        html = `
            <input data-field="notes" type="text" placeholder="وصف الصنف *" style="width:100%;font-size:13px;padding:7px;font-family:'Cairo';box-sizing:border-box;">`;
    }
    fieldsDiv.innerHTML = html;
    fieldsDiv.style.display = '';
}

function _removeMultiItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    // re-number remaining rows
    document.querySelectorAll('.m-multi-row').forEach((r, idx) => {
        const lbl = r.querySelector('span');
        if (lbl) lbl.textContent = 'صنف ' + (idx + 1);
    });
}

/* read all rows and return items[]; also returns error message if invalid */
function _collectMultiItems() {
    const rows = document.querySelectorAll('.m-multi-row');
    if (rows.length === 0) return { error: 'يرجى إضافة صنف واحد على الأقل' };
    const items = [];
    let i = 0;
    for (const row of rows) {
        i++;
        const st = row.querySelector('[data-role="subType"]')?.value || '';
        if (!st) return { error: `الصنف رقم ${i}: لم يتم اختيار النوع` };
        const item = { subType: st };
        const f = (k) => (row.querySelector(`[data-field="${k}"]`)?.value || '').trim();
        if (st === 'نقدي') {
            const v = f('value'); if (!v) return { error: `الصنف رقم ${i} (نقدي): يرجى إدخال القيمة` };
            item.value = v;
            const n = f('notes'); if (n) item.notes = n;
        } else if (st === 'محامص-وزن') {
            const nm = f('name'), w = f('weight'), v = f('value');
            if (!nm || !w || !v) return { error: `الصنف رقم ${i} (محامص-وزن): اكمل اسم الصنف، الوزن، والقيمة` };
            item.name = nm; item.weight = w; item.value = v;
        } else if (st === 'محامص-قيمة') {
            const nm = f('name'), v = f('value');
            if (!nm || !v) return { error: `الصنف رقم ${i} (محامص-قيمة): اكمل اسم الصنف والقيمة` };
            item.name = nm; item.value = v;
        } else if (st === 'أخرى') {
            const n = f('notes');
            if (!n) return { error: `الصنف رقم ${i} (أخرى): يرجى كتابة الوصف` };
            item.notes = n;
        }
        items.push(item);
    }
    return { items };
}

function _clearMultiItemRows() {
    const list = document.getElementById('mMultiItemsList');
    if (list) list.innerHTML = '';
    _multiRowCounter = 0;
}
