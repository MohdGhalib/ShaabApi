/* ══════════════════════════════════════════════════════
   تدقيق إداري (ADMIN AUDIT) — تحليلات يومية للاستفسارات والشكاوى
   مصدر البيانات: db.inquiries (سجل المكالمات الموحّد). type==='شكوى' → شكوى،
   وأي نوع آخر → استفسار. كل سجل يحمل phone/city/branch/type/notes/complaintType/iso.
   الصلاحية: مدير الكول سنتر + الأدمن فقط (انظر setProfileUI + switchTab).
══════════════════════════════════════════════════════ */

function _aaNormalizePhone(phone) {
    return String(phone || '').replace(/[^\d]/g, '');
}

/* تحقّق رقم أردني صحيح:
   - إن بدأ بـ0 → 10 خانات ويبدأ بـ 077/078/079
   - إن لم يبدأ بـ0 → 9 خانات ويبدأ بـ 77/78/79 */
function _aaPhoneValidity(phone) {
    const p = _aaNormalizePhone(phone);
    if (!p)               return { valid: false, reason: 'رقم فارغ' };
    if (p.startsWith('0')) {
        if (p.length !== 10)   return { valid: false, reason: `يبدأ بـ0 فيجب 10 خانات (الحالي ${p.length})` };
        if (!/^07[789]/.test(p)) return { valid: false, reason: 'بداية غير صحيحة (المطلوب 077/078/079)' };
        return { valid: true };
    }
    if (p.length !== 9)        return { valid: false, reason: `لا يبدأ بـ0 فيجب 9 خانات (الحالي ${p.length})` };
    if (!/^7[789]/.test(p))    return { valid: false, reason: 'بداية غير صحيحة (المطلوب 77/78/79)' };
    return { valid: true };
}

function _aaDayRecords(dateStr) {
    return (db.inquiries || []).filter(x => !x.deleted && (x.iso || '').slice(0, 10) === dateStr);
}

function _aaIsComplaint(r) { return r.type === 'شكوى'; }

/* طبيعة المكالمة: النوع + نوع الشكوى (إن وُجد) + مقتطف من الملاحظات */
function _aaNature(r) {
    const bits = [];
    if (r.type)          bits.push(sanitize(r.type));
    if (r.complaintType) bits.push(sanitize(r.complaintType));
    const n = (r.notes || '').trim();
    if (n) bits.push(sanitize(n.length > 60 ? n.slice(0, 60) + '…' : n));
    return bits.join(' — ') || '—';
}

function _aaPhoneCell(phone) {
    const v = _aaPhoneValidity(phone);
    const color = v.valid ? 'var(--text-main)' : '#ef9a9a';
    return `<span style="font-family:monospace;direction:ltr;display:inline-block;color:${color};font-weight:700;">${sanitize(_aaNormalizePhone(phone) || phone || '—')}</span>`;
}

/* جدول مكالمات عام — أعمدة قابلة للاختيار */
function _aaCallsTable(rows, cols) {
    if (!rows.length) return '<div style="padding:14px;color:var(--text-dim);font-size:13px;">لا توجد سجلات</div>';
    const head = cols.map(c => `<th style="text-align:right;padding:7px 10px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);">${c.label}</th>`).join('');
    const body = rows.map(r => {
        const tds = cols.map(c => `<td style="text-align:right;padding:7px 10px;font-size:13px;color:var(--text-main);border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top;">${c.cell(r)}</td>`).join('');
        return `<tr>${tds}</tr>`;
    }).join('');
    return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;direction:rtl;">
        <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const _AA_COL_PHONE  = { label: 'الرقم',  cell: r => _aaPhoneCell(r.phone) };
const _AA_COL_NATURE = { label: 'طبيعة المكالمة', cell: r => _aaNature(r) };
const _AA_COL_BRANCH = { label: 'الفرع',  cell: r => sanitize(r.branch || '—') };
const _AA_COL_TYPE   = { label: 'النوع',  cell: r => sanitize(r.type || '—') };
const _AA_COL_TIME   = { label: 'الوقت',  cell: r => sanitize((r.time || '').split('|')[0].trim() || '—') };

function _aaSectionCard(title, icon, count, innerHtml) {
    return `
    <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:15px;color:var(--text-main);">${icon} ${title}</h3>
            ${count != null ? `<span style="background:rgba(46,125,50,0.18);border:1px solid rgba(46,125,50,0.4);color:#a5d6a7;border-radius:20px;padding:2px 12px;font-size:12px;font-weight:700;">${count}</span>` : ''}
        </div>
        ${innerHtml}
    </div>`;
}

function renderAdminAudit() {
    const container = document.getElementById('adminAuditContainer');
    if (!container) return;

    let dateStr = document.getElementById('aaDate')?.value || '';
    if (!dateStr) dateStr = iso(); // افتراضي: اليوم
    const recs = _aaDayRecords(dateStr);

    const totalCalls   = recs.length;
    const totalComplaints = recs.filter(_aaIsComplaint).length;
    const totalInquiries  = totalCalls - totalComplaints;

    // ── 1) المكالمات المكررة (نفس الرقم ≥ مرتين في اليوم) ──
    const byPhone = new Map();
    recs.forEach(r => {
        const p = _aaNormalizePhone(r.phone);
        if (!p) return;
        if (!byPhone.has(p)) byPhone.set(p, []);
        byPhone.get(p).push(r);
    });
    const repeated = [...byPhone.entries()]
        .filter(([, arr]) => arr.length >= 2)
        .sort((a, b) => b[1].length - a[1].length);
    let sec1 = repeated.length
        ? repeated.map(([p, arr]) => `
            <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(255,179,0,0.08);">
                    <span style="font-family:monospace;direction:ltr;font-weight:700;color:#ffd54f;">${sanitize(p)}</span>
                    <span style="font-size:12px;color:#ffb74d;font-weight:700;">📞 ${arr.length} مكالمات</span>
                </div>
                ${_aaCallsTable(arr, [_AA_COL_TIME, _AA_COL_TYPE, _AA_COL_BRANCH, _AA_COL_NATURE])}
            </div>`).join('')
        : '<div style="padding:14px;color:var(--text-dim);font-size:13px;">لا توجد أرقام كرّرت الاتصال اليوم</div>';

    // ── 2) استفسارات الشكاوى ──
    const complaints = recs.filter(_aaIsComplaint);
    const sec2 = _aaCallsTable(complaints, [_AA_COL_PHONE, _AA_COL_BRANCH, _AA_COL_NATURE, _AA_COL_TIME]);

    // ── 3) أرقام أردنية خاطئة (مجمّعة حسب الرقم) ──
    const invalidMap = new Map();
    recs.forEach(r => {
        const v = _aaPhoneValidity(r.phone);
        if (v.valid) return;
        const key = _aaNormalizePhone(r.phone) || ('(فارغ)_' + (r.id || Math.random()));
        if (!invalidMap.has(key)) invalidMap.set(key, { phone: r.phone, reason: v.reason, calls: [] });
        invalidMap.get(key).calls.push(r);
    });
    const invalids = [...invalidMap.values()];
    let sec3 = invalids.length
        ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;direction:rtl;">
            <thead><tr>
                <th style="text-align:right;padding:7px 10px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);">الرقم الخاطئ</th>
                <th style="text-align:right;padding:7px 10px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);">سبب الخطأ</th>
                <th style="text-align:right;padding:7px 10px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);">عدد المكالمات</th>
                <th style="text-align:right;padding:7px 10px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);">الفرع / الطبيعة</th>
            </tr></thead><tbody>
            ${invalids.map(o => `<tr>
                <td style="text-align:right;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);"><span style="font-family:monospace;direction:ltr;color:#ef5350;font-weight:700;">${sanitize(_aaNormalizePhone(o.phone) || o.phone || '—')}</span></td>
                <td style="text-align:right;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;color:#ffab91;">${sanitize(o.reason)}</td>
                <td style="text-align:right;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;color:var(--text-main);">${o.calls.length}</td>
                <td style="text-align:right;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;color:var(--text-dim);">${o.calls.map(c => sanitize(c.branch || '—') + ' (' + _aaNature(c) + ')').join('<br>')}</td>
            </tr>`).join('')}
            </tbody></table></div>`
        : '<div style="padding:14px;color:var(--text-dim);font-size:13px;">كل الأرقام اليوم صحيحة ✓</div>';

    // ── 4) أكثر فرعين (استفسارات + شكاوى) ──
    const byBranch = new Map();
    recs.forEach(r => {
        const b = (r.branch || '—').trim() || '—';
        if (!byBranch.has(b)) byBranch.set(b, []);
        byBranch.get(b).push(r);
    });
    const topBranches = [...byBranch.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2);
    let sec4 = topBranches.length
        ? topBranches.map(([b, arr], i) => `
            <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(21,101,192,0.10);">
                    <span style="font-weight:700;color:#90caf9;">${i === 0 ? '🥇' : '🥈'} ${sanitize(b)}</span>
                    <span style="font-size:12px;color:#64b5f6;font-weight:700;">${arr.length} اتصال (شكاوى: ${arr.filter(_aaIsComplaint).length} · استفسارات: ${arr.filter(x => !_aaIsComplaint(x)).length})</span>
                </div>
                ${_aaCallsTable(arr, [_AA_COL_PHONE, _AA_COL_TYPE, _AA_COL_NATURE, _AA_COL_TIME])}
            </div>`).join('')
        : '<div style="padding:14px;color:var(--text-dim);font-size:13px;">لا توجد بيانات</div>';

    // ── 5) أكثر نوعين استفسار ──
    const byType = new Map();
    recs.forEach(r => {
        const t = (r.type || '—').trim() || '—';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(r);
    });
    const topTypes = [...byType.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2);
    let sec5 = topTypes.length
        ? topTypes.map(([t, arr], i) => `
            <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:rgba(46,125,50,0.10);">
                    <span style="font-weight:700;color:#a5d6a7;">${i === 0 ? '🥇' : '🥈'} ${sanitize(t)}</span>
                    <span style="font-size:12px;color:#81c784;font-weight:700;">${arr.length} اتصال</span>
                </div>
                ${_aaCallsTable(arr, [_AA_COL_PHONE, _AA_COL_BRANCH, _AA_COL_NATURE, _AA_COL_TIME])}
            </div>`).join('')
        : '<div style="padding:14px;color:var(--text-dim);font-size:13px;">لا توجد بيانات</div>';

    // ── رأس الصفحة (التاريخ + الملخّص) ──
    const header = `
    <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <h2 style="margin:0;font-size:18px;color:var(--text-main);">🧾 تدقيق إداري</h2>
            <div style="display:flex;align-items:center;gap:8px;">
                <label style="font-size:13px;color:var(--text-dim);">يوم:</label>
                <div class="date-picker-wrap" onclick="calOnSelect=renderAdminAudit;openDatePicker('aaDate')">
                    <span class="date-display" id="aaDate-display">📅 ${sanitize(dateStr)}</span>
                    <input type="hidden" id="aaDate" value="${sanitize(dateStr)}">
                </div>
                <button onclick="renderAdminAudit()" style="padding:7px 14px;border-radius:9px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-dim);font-family:'Cairo';font-weight:700;cursor:pointer;font-size:13px;">🔄 تحديث</button>
            </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
            <div style="flex:1;min-width:130px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:var(--text-main);">${totalCalls}</div>
                <div style="font-size:12px;color:var(--text-dim);">إجمالي المكالمات</div>
            </div>
            <div style="flex:1;min-width:130px;background:rgba(46,125,50,0.08);border:1px solid rgba(46,125,50,0.3);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#a5d6a7;">${totalInquiries}</div>
                <div style="font-size:12px;color:var(--text-dim);">استفسارات</div>
            </div>
            <div style="flex:1;min-width:130px;background:rgba(229,57,53,0.08);border:1px solid rgba(229,57,53,0.3);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#ef9a9a;">${totalComplaints}</div>
                <div style="font-size:12px;color:var(--text-dim);">شكاوى</div>
            </div>
        </div>
    </div>`;

    container.innerHTML =
        header +
        _aaSectionCard('المكالمات المكررة على النظام', '🔁', repeated.length, sec1) +
        _aaSectionCard('استفسارات الشكاوى', '📣', complaints.length, sec2) +
        _aaSectionCard('أرقام أردنية خاطئة', '⚠️', invalids.length, sec3) +
        _aaSectionCard('أكثر فرعين (استفسارات + شكاوى)', '🏢', null, sec4) +
        _aaSectionCard('أكثر نوعين استفسار', '🏷️', null, sec5);
}
