/* ══════════════════════════════════════════════════════
   STATS — Employee statistics view
══════════════════════════════════════════════════════ */
function populateStatSelect() {
    const sel = document.getElementById("statEmpSelect");
    const cur = sel.value;
    sel.innerHTML = '<option value="">اختر موظفاً</option>';
    employees.filter(e => e.title !== 'موظف سيطرة' && e.title !== 'مدير قسم السيطرة').forEach(e => sel.innerHTML += `<option value="${sanitize(e.empId)}">${sanitize(e.name)}</option>`);
    if (cur) sel.value = cur;
}

function renderStats() {
    const empId = document.getElementById("statEmpSelect").value;
    const date  = document.getElementById("statDate").value;
    const div   = document.getElementById("statsResult");
    if (!empId||!date) { div.innerHTML=`<p style="color:var(--text-dim)">اختر موظفاً وتاريخاً</p>`; return; }

    const emp      = employees.find(e => e.empId===empId);
    const empBreaks= breaks.filter(b => b.empId===empId && b.date===date);
    const empSess  = sessions.filter(s => s.empId===empId && s.date===date);

    let html = '';

    // ── بلوك الدخول/الخروج ──
    if (empSess.length) {
        html += `<div style="background:rgba(255,255,255,0.03);border-radius:14px;padding:18px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:12px;color:var(--text-dim);">🕐 سجل الدخول والخروج</div>`;
        const _MAX_SESSION_MS = 10 * 60 * 60 * 1000; // 10 ساعات حد أقصى معقول للجلسة
        empSess.forEach(s => {
            const loginTime   = _fmtTime(s.loginIso);
            const logoutTime  = s.logoutIso ? _fmtTime(s.logoutIso) : null;
            const sessionAge  = Date.now() - new Date(s.loginIso).getTime();
            const isStillOpen = !s.logoutIso && sessionAge < _MAX_SESSION_MS;
            html += `<div class="stat-row">
                <span><span class="session-online">دخول ${loginTime}</span></span>
                <span>${logoutTime
                    ? `<span class="session-offline">خروج ${logoutTime}</span>`
                    : isStillOpen
                        ? `<span class="session-online">🟢 ما زال فاتح الموقع</span>`
                        : `<span class="session-offline">لم يُسجَّل خروج</span>`
                }</span>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div style="background:rgba(255,255,255,0.03);border-radius:14px;padding:14px;margin-bottom:16px;color:var(--text-dim);font-size:13px;">لا يوجد تسجيل دخول لهذا الموظف في هذا اليوم</div>`;
    }

    // ── بلوك الاستراحات ──
    if (empBreaks.length) {
        const totalSec = empBreaks.reduce((s,b) => s+b.duration, 0);
        html += `<div style="background:rgba(255,255,255,0.03);border-radius:14px;padding:18px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:700;font-size:15px;">${emp?.name||empId}</span>
                <span style="color:var(--text-dim);font-size:13px;">${date}</span>
            </div>
            <div style="font-size:13px;color:var(--text-dim);">إجمالي وقت الغياب: <span style="color:var(--accent-red);font-family:monospace;font-weight:700;">${fmtDuration(totalSec)}</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border-radius:14px;padding:18px;">
            ${empBreaks.map(b=>`
            <div class="stat-row">
                <span class="stat-type"><span class="emp-badge">${b.type}</span></span>
                <span style="color:var(--text-dim);font-size:12px;">${_fmtTime(b.startIso)} ← ${_fmtTime(b.endIso)}</span>
                <span class="stat-dur">${fmtDuration(b.duration)}</span>
            </div>`).join('')}
        </div>`;
    } else {
        html += `<p style="color:var(--text-dim);font-size:13px;">لا توجد استراحات مسجلة لهذا اليوم</p>`;
    }

    div.innerHTML = html;
}

/* ══════════════════════════════════════════════════════
   BRANCHES — Bar chart per branch, grouped by region
══════════════════════════════════════════════════════ */
const REGION_MAP = {
    'الشرقية':    ['الرئيسي','جسر الببسي','ماركا','ماركا الشمالية','طبربور','الهاشمي','المشاغل','الرياضية','وادي الرمم','نزال','الوحدات'],
    'الجنوبية':   ['مرج الحمام','طريق البحر الميت','اليادودة','الحرية','الياسمين','الخريطة'],
    'الغربية':    ['السلط','صويلح','ابو نصير','المنورة','دابوق','شارع المطار','المطار','مادبا الغربي','مادبا الشرقي','خلدا'],
    'المحافظات':  ['الطيارة','شارع ال30','ابو راشد','الرمثا','المفرق','جرش','شارع 36','السعادة','الكرك الوسية','الكرك الثنية']
};
const REGION_STYLE = {
    'الشرقية':   { bar:'linear-gradient(90deg,#1565c0,#42a5f5)', header:'rgba(21,101,192,0.15)', headerBorder:'rgba(21,101,192,0.35)', headerColor:'#64b5f6' },
    'الجنوبية':  { bar:'linear-gradient(90deg,#2e7d32,#66bb6a)', header:'rgba(46,125,50,0.15)',  headerBorder:'rgba(46,125,50,0.35)',  headerColor:'#81c784' },
    'الغربية':   { bar:'linear-gradient(90deg,#6a1b9a,#ab47bc)', header:'rgba(106,27,154,0.15)', headerBorder:'rgba(106,27,154,0.35)', headerColor:'#ce93d8' },
    'المحافظات': { bar:'linear-gradient(90deg,#e65100,#ff9800)', header:'rgba(230,81,0,0.15)',   headerBorder:'rgba(230,81,0,0.35)',   headerColor:'#ffb74d' }
};

function getBranchRegion(branchName) {
    for (const [region, list] of Object.entries(REGION_MAP)) {
        if (list.includes(branchName)) return region;
    }
    return 'أخرى';
}

function renderBranches() {
    const div = document.getElementById('branchStatsResult'); if (!div) return;
    const searchDate   = document.getElementById('branchDate')?.value         || '';
    const searchCity   = document.getElementById('branchCitySearch')?.value   || '';
    const searchBranch = document.getElementById('branchBranchSearch')?.value || '';

    // تجميع الشكاوى المحتسَبة فقط (عبر زر "احتساب شكوى") — كل دور يرى إحصائياته المستقلة
    const isControlEmpStats = currentUser?.role === 'control_employee';
    const counts = {};
    const addCount = x => {
        if (searchDate   && !x.iso.startsWith(searchDate))  return;
        if (searchCity   && x.city   !== searchCity)         return;
        if (searchBranch && x.branch !== searchBranch)       return;
        const key = `${x.branch}||${x.city}`;
        counts[key] = (counts[key] || 0) + 1;
    };

    if (isControlEmpStats) {
        // مدير قسم السيطرة: شكاوي + منتسيات محتسبة بـ countedByControl
        db.complaints.filter(x => !x.deleted && x.countedByControl).forEach(addCount);
        (db.montasiat || []).filter(x => !x.deleted && x.countedByControl).forEach(addCount);
    } else {
        // مدير الكول سنتر / المدير: استفسارات + شكاوي محتسبة بـ countedByCC
        db.inquiries.filter(x =>
            !x.deleted && x.type === 'شكوى' && x.countedByCC &&
            !db.complaints.some(c => !c.deleted && String(c.linkedInqSeq) === String(x.seq))
        ).forEach(addCount);
        db.complaints.filter(x => !x.deleted && x.countedByCC).forEach(addCount);
    }

    const allData = Object.entries(counts).map(([key, count]) => {
        const [branch, city] = key.split('||');
        return { branch, city, count, region: getBranchRegion(branch) };
    });

    if (!allData.length) {
        div.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد شكاوى مسجلة للفلتر المحدد</div>`;
        return;
    }

    const total    = allData.reduce((s, x) => s + x.count, 0);
    const maxAll   = Math.max(...allData.map(x => x.count));
    const topBranch= [...allData].sort((a,b) => b.count - a.count)[0];

    // بطاقات الملخص العام
    let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;">
        <div style="background:rgba(211,47,47,0.1);border:1px solid rgba(211,47,47,0.25);border-radius:16px;padding:20px;text-align:center;">
            <div style="font-size:32px;font-weight:800;color:var(--accent-red);">${total}</div>
            <div style="font-size:13px;color:var(--text-dim);margin-top:4px;">إجمالي الشكاوى</div>
        </div>
        <div style="background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.25);border-radius:16px;padding:20px;text-align:center;">
            <div style="font-size:17px;font-weight:800;color:#ffb74d;line-height:1.3;">${topBranch.branch}</div>
            <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${topBranch.city} — ${topBranch.region}</div>
            <div style="font-size:13px;color:var(--text-dim);margin-top:4px;">أكثر فرع شكاوى — <b style="color:#ffb74d;">${topBranch.count}</b></div>
        </div>
        <div style="background:rgba(33,150,243,0.08);border:1px solid rgba(33,150,243,0.2);border-radius:16px;padding:20px;text-align:center;">
            <div style="font-size:32px;font-weight:800;color:#64b5f6;">${allData.length}</div>
            <div style="font-size:13px;color:var(--text-dim);margin-top:4px;">فرع مُشتكى عليه</div>
        </div>
    </div>`;

    // عرض كل قسم
    const regionOrder = ['الشرقية','الجنوبية','الغربية','المحافظات','أخرى'];
    regionOrder.forEach(region => {
        const regionData = allData.filter(x => x.region === region).sort((a,b) => b.count - a.count);
        if (!regionData.length) return;

        const style       = REGION_STYLE[region] || { bar:'linear-gradient(90deg,#455a64,#90a4ae)', header:'rgba(69,90,100,0.15)', headerBorder:'rgba(69,90,100,0.35)', headerColor:'#90a4ae' };
        const regionTotal = regionData.reduce((s,x) => s+x.count, 0);
        const regionMax   = regionData[0].count;

        html += `
        <div style="margin-bottom:24px;border:1px solid ${style.headerBorder};border-radius:18px;overflow:hidden;">
            <div style="background:${style.header};border-bottom:1px solid ${style.headerBorder};padding:14px 20px;display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-weight:800;font-size:16px;color:${style.headerColor};">قسم ${region}</span>
                    <button onclick="showRegionDetail('${region}')" style="padding:3px 12px;font-size:11px;font-family:'Cairo';cursor:pointer;border-radius:8px;border:1px solid ${style.headerBorder};background:${style.header};color:${style.headerColor};font-weight:700;">👁 عرض</button>
                </div>
                <div style="display:flex;gap:16px;align-items:center;">
                    <span style="font-size:12px;color:var(--text-dim);">${regionData.length} فرع</span>
                    <span style="background:${style.header};border:1px solid ${style.headerBorder};color:${style.headerColor};padding:3px 14px;border-radius:20px;font-size:13px;font-weight:800;">${regionTotal} شكوى</span>
                </div>
            </div>
            <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">`;

        regionData.forEach((x, i) => {
            const pct      = Math.round((x.count / maxAll) * 100);
            const sharePct = ((x.count / total) * 100).toFixed(1);
            const rank     = i + 1;
            let rankBg = 'rgba(255,255,255,0.06)', rankColor = 'var(--text-dim)';
            if (rank === 1) { rankBg = style.header; rankColor = style.headerColor; }
            html += `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:12px;padding:13px 16px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                    <span style="background:${rankBg};color:${rankColor};border-radius:7px;padding:3px 9px;font-size:11px;font-weight:800;min-width:30px;text-align:center;">#${rank}</span>
                    <div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-weight:700;font-size:14px;color:var(--text-main);">${x.branch}</span>
                        <span style="color:var(--text-dim);font-size:11px;">— ${x.city}</span>
                        <button onclick="showBranchDetail('${x.branch.replace(/'/g,'\\\'').replace(/"/g,'&quot;')}','${x.city.replace(/'/g,'\\\'').replace(/"/g,'&quot;')}')" style="padding:2px 10px;font-size:10px;font-family:'Cairo';cursor:pointer;border-radius:7px;border:1px solid ${style.headerBorder};background:${style.header};color:${style.headerColor};font-weight:700;">👁 عرض</button>
                    </div>
                    <div>
                        <span style="font-size:17px;font-weight:800;color:${style.headerColor};">${x.count}</span>
                        <span style="font-size:11px;color:var(--text-dim);margin-right:3px;">شكوى</span>
                        <span style="font-size:11px;color:var(--text-dim);">(${sharePct}%)</span>
                    </div>
                </div>
                <div style="background:rgba(255,255,255,0.06);border-radius:100px;height:8px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${style.bar};border-radius:100px;"></div>
                </div>
            </div>`;
        });

        html += `</div></div>`;
    });

    div.innerHTML = html;
}

function resetBranchSearch() {
    const city = document.getElementById('branchCitySearch');
    if (city) city.value = '';
    const branch = document.getElementById('branchBranchSearch');
    if (branch) { branch.innerHTML = '<option value="">الكل</option>'; }
    setDatePickerValue('branchDate', '');
    const disp = document.getElementById('branchDate-display');
    if (disp) { disp.textContent = '📅 الكل'; disp.classList.remove('selected'); }
    renderBranches();
}

/* ══════════════════════════════════════════════════════
   EVAL DETAIL MODAL — عرض تفاصيل القسم أو الفرع
══════════════════════════════════════════════════════ */
let _evalDetailFilter = null;
let _evalDetailTitle  = '';

function showRegionDetail(region) {
    _evalDetailFilter = { region };
    _evalDetailTitle  = `قسم ${region}`;
    _renderEvalDetailModal();
}

function showBranchDetail(branch, city) {
    _evalDetailFilter = { branch, city };
    _evalDetailTitle  = `${branch} — ${city}`;
    _renderEvalDetailModal();
}

function _getEvalItems(filter) {
    const isCtrl = currentUser?.role === 'control_employee';
    const match  = x => filter.branch
        ? (x.branch === filter.branch && x.city === filter.city)
        : getBranchRegion(x.branch) === filter.region;

    const items = [];
    if (isCtrl) {
        (db.complaints || []).filter(x => !x.deleted && x.countedByControl && match(x))
            .forEach(x => items.push({ type:'شكوى', id:x.id, notes:x.notes, branch:x.branch, city:x.city, src:'complaint', time:x.time||'' }));
        (db.montasiat || []).filter(x => !x.deleted && x.countedByControl && match(x))
            .forEach(x => items.push({ type:'منتسية', id:x.id, notes:x.notes||x.type||'', branch:x.branch, city:x.city, src:'montasia', time:x.time||'' }));
    } else {
        (db.inquiries || []).filter(x => !x.deleted && x.type==='شكوى' && x.countedByCC && match(x)
            && !(db.complaints||[]).some(c => !c.deleted && String(c.linkedInqSeq)===String(x.seq)))
            .forEach(x => items.push({ type:'شكوى (استفسار)', id:x.id, notes:x.notes, branch:x.branch, city:x.city, src:'inquiry', time:x.time||'' }));
        (db.complaints || []).filter(x => !x.deleted && x.countedByCC && match(x))
            .forEach(x => items.push({ type:'شكوى', id:x.id, notes:x.notes, branch:x.branch, city:x.city, src:'complaint', time:x.time||'' }));
    }
    return items;
}

function _renderEvalDetailModal() {
    const old = document.getElementById('_evalDetailModal');
    if (old) old.remove();

    const items = _getEvalItems(_evalDetailFilter);
    const showBranchCol = !!_evalDetailFilter.region;

    const typeStyle = src => {
        if (src === 'montasia') return { bg:'rgba(46,125,50,0.18)', border:'rgba(46,125,50,0.5)', color:'#81c784', accent:'#2e7d32', label:'منتسية' };
        if (src === 'inquiry')  return { bg:'rgba(21,101,192,0.18)', border:'rgba(21,101,192,0.5)', color:'#64b5f6', accent:'#1565c0', label:'استفسار' };
        return                         { bg:'rgba(183,28,28,0.18)',  border:'rgba(183,28,28,0.5)',  color:'#ef9a9a', accent:'#b71c1c', label:'شكوى' };
    };

    const itemsHtml = items.length
        ? items.map((item, idx) => {
            const ts = typeStyle(item.src);
            return `
            <div style="display:flex;align-items:stretch;gap:0;border-radius:14px;overflow:hidden;border:1px solid ${ts.border};background:rgba(255,255,255,0.02);">
                <div style="width:4px;background:${ts.accent};flex-shrink:0;"></div>
                <div style="flex:1;padding:13px 14px;min-width:0;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;background:${ts.bg};color:${ts.color};border:1px solid ${ts.border};">${ts.label}</span>
                            ${showBranchCol ? `<span style="font-size:12px;color:#90caf9;font-weight:600;">📍 ${sanitize(item.branch)} — ${sanitize(item.city)}</span>` : ''}
                        </div>
                        <span style="font-size:10px;color:rgba(255,255,255,0.3);white-space:nowrap;">#${idx+1}</span>
                    </div>
                    <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:${item.time?'7px':'0'};">${sanitize((item.notes||'').substring(0,140))}${(item.notes||'').length>140?'…':''}</div>
                    ${item.time ? `<div style="font-size:11px;color:rgba(255,255,255,0.3);">🕐 ${sanitize(item.time)}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;padding:0 14px;flex-shrink:0;">
                    <button onclick="_jumpToEvalItem('${item.src}',${item.id})" style="padding:7px 14px;font-size:12px;font-family:'Cairo';cursor:pointer;border-radius:10px;border:1px solid rgba(100,181,246,0.4);background:rgba(21,101,192,0.15);color:#64b5f6;font-weight:700;white-space:nowrap;transition:background .15s;" onmouseover="this.style.background='rgba(21,101,192,0.3)'" onmouseout="this.style.background='rgba(21,101,192,0.15)'">👁 عرض</button>
                    <button onclick="_undoEvalItem('${item.src}',${item.id})" style="padding:7px 14px;font-size:12px;font-family:'Cairo';cursor:pointer;border-radius:10px;border:1px solid rgba(239,154,154,0.4);background:rgba(183,28,28,0.15);color:#ef9a9a;font-weight:700;white-space:nowrap;transition:background .15s;" onmouseover="this.style.background='rgba(183,28,28,0.3)'" onmouseout="this.style.background='rgba(183,28,28,0.15)'">↩ تراجع</button>
                </div>
            </div>`; }).join('')
        : `<div style="text-align:center;padding:50px 20px;">
               <div style="font-size:40px;margin-bottom:12px;">✅</div>
               <div style="color:rgba(255,255,255,0.4);font-size:14px;">لا توجد بنود محتسبة</div>
           </div>`;

    const overlay = document.createElement('div');
    overlay.id = '_evalDetailModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Cairo,sans-serif;direction:rtl;animation:_mFadeIn .2s ease;';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border:1px solid rgba(255,255,255,0.1);border-radius:24px;max-width:600px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05);">

            <!-- Header -->
            <div style="padding:22px 24px 18px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#d32f2f,#f44336);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📋</div>
                        <div>
                            <div style="font-size:16px;font-weight:800;color:#fff;line-height:1.2;">${sanitize(_evalDetailTitle)}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:3px;">البنود المحتسبة في التقييم</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="background:rgba(211,47,47,0.2);border:1px solid rgba(211,47,47,0.4);border-radius:20px;padding:4px 14px;font-size:13px;font-weight:800;color:#ef9a9a;">${items.length} بند</div>
                        <button onclick="document.getElementById('_evalDetailModal').remove()" style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;font-family:'Cairo';">✕</button>
                    </div>
                </div>
            </div>

            <!-- Items list -->
            <div style="overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;">
                ${itemsHtml}
            </div>

            <!-- Footer -->
            <div style="padding:14px 24px;background:rgba(255,255,255,0.03);border-top:1px solid rgba(255,255,255,0.07);flex-shrink:0;display:flex;justify-content:flex-end;">
                <button onclick="document.getElementById('_evalDetailModal').remove()" style="padding:9px 24px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:600;">إغلاق</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
}

function _undoEvalItem(src, id) {
    if (src === 'complaint')  { if (typeof toggleCountComplaint  === 'function') toggleCountComplaint(id);  }
    else if (src === 'inquiry') { if (typeof toggleCountInquiry  === 'function') toggleCountInquiry(id);    }
    else if (src === 'montasia'){ if (typeof toggleCountMontasia === 'function') toggleCountMontasia(id);   }
    _renderEvalDetailModal();
    renderBranches();
}

function _jumpToEvalItem(src, id) {
    document.getElementById('_evalDetailModal')?.remove();
    const tabMap = { complaint:'c', inquiry:'i', montasia:'m' };
    const tableMap = { complaint:'#tableC', inquiry:'#tableI', montasia:'#tableM' };
    const tab = tabMap[src];
    if (!tab || typeof switchTab !== 'function') return;
    switchTab(tab);
    setTimeout(() => {
        const row = document.querySelector(tableMap[src] + ' tbody tr[data-id="' + id + '"]');
        if (!row) return;
        document.querySelectorAll(tableMap[src] + ' tbody tr').forEach(r => r.style.outline = '');
        row.style.outline = '2px solid #64b5f6';
        row.style.borderRadius = '8px';
        row.scrollIntoView({ behavior:'smooth', block:'center' });
        setTimeout(() => { row.style.outline = ''; }, 3000);
    }, 250);
}

/* ══════════════════════════════════════════════════════
   EXPORT — تصدير تقييم الفروع كصورة
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
   EXPORT — تصدير تقييم الفروع كصورة مع معاينة
══════════════════════════════════════════════════════ */
let _exportData = null; // { allData, periodLabel, regionOrder, selections }

function exportBranchEvaluation() {
    const branchDateVal = document.getElementById('branchDate')?.value || '';
    const searchCity    = document.getElementById('branchCitySearch')?.value || '';
    const searchBranch  = document.getElementById('branchBranchSearch')?.value || '';

    const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    let periodLabel = 'إجمالي الفترة';
    if (branchDateVal) {
        const parts = branchDateVal.split('-');
        if (parts.length === 3)      periodLabel = `${parseInt(parts[2])} ${AR_MONTHS[parseInt(parts[1])-1]} ${parts[0]}`;
        else if (parts.length === 2) periodLabel = `${AR_MONTHS[parseInt(parts[1])-1]} ${parts[0]}`;
        else if (parts.length === 1) periodLabel = `سنة ${parts[0]}`;
    }
    if (searchCity)   periodLabel += ` — ${searchCity}`;
    if (searchBranch) periodLabel += ` / ${searchBranch}`;

    const isCtrl = currentUser?.role === 'control_employee';
    const counts = {};
    const addC = x => {
        if (branchDateVal && !(x.iso||'').startsWith(branchDateVal)) return;
        if (searchCity   && x.city   !== searchCity)   return;
        if (searchBranch && x.branch !== searchBranch) return;
        const key = `${x.branch}||${x.city}`;
        counts[key] = (counts[key] || 0) + 1;
    };
    if (isCtrl) {
        (db.complaints||[]).filter(x=>!x.deleted&&x.countedByControl).forEach(addC);
        (db.montasiat||[]).filter(x=>!x.deleted&&x.countedByControl).forEach(addC);
    } else {
        (db.inquiries||[]).filter(x=>!x.deleted&&x.type==='شكوى'&&x.countedByCC&&
            !(db.complaints||[]).some(c=>!c.deleted&&String(c.linkedInqSeq)===String(x.seq))).forEach(addC);
        (db.complaints||[]).filter(x=>!x.deleted&&x.countedByCC).forEach(addC);
    }
    const allData = Object.entries(counts).map(([key,cnt])=>{
        const [branch,city]=key.split('||');
        return {branch,city,count:cnt,region:getBranchRegion(branch)};
    });

    // أضف جميع فروع REGION_MAP بعدد صفر لضمان ظهور كل الأقسام دائماً
    const existingKeys = new Set(allData.map(x=>`${x.branch}||${x.city}`));
    const _cityOf = br => { for (const [c,brs] of Object.entries(branches)) if (brs.includes(br)) return c; return ''; };
    ['الشرقية','الجنوبية','الغربية','المحافظات'].forEach(region => {
        (REGION_MAP[region]||[]).forEach(brName => {
            const city = _cityOf(brName);
            const key  = `${brName}||${city}`;
            if (!existingKeys.has(key)) { allData.push({branch:brName,city,count:0,region}); existingKeys.add(key); }
        });
    });

    const regionOrder = ['الشرقية','الجنوبية','الغربية','المحافظات','أخرى'];
    const selections = {};
    regionOrder.forEach(region => {
        const rd = allData.filter(x=>x.region===region).sort((a,b)=>b.count-a.count);
        if (!rd.length) return;
        const best  = rd[0];
        const worst = rd[rd.length-1];
        // أكثر شكاوى = أسوأ، أقل شكاوى = أفضل
        const bestBranch  = rd[rd.length-1]; // أقل عدد شكاوى
        const worstBranch = rd[0];           // أكثر عدد شكاوى
        selections[region] = {
            bestKey:    `${bestBranch.branch}||${bestBranch.city}`,
            worstKey:   `${worstBranch.branch}||${worstBranch.city}`,
            topTies:    rd.filter(x=>x.count===worstBranch.count), // الأسوأ المتعادلون
            bottomTies: rd.filter(x=>x.count===bestBranch.count)   // الأفضل المتعادلون
        };
    });

    _exportData = { allData, periodLabel, regionOrder, selections };
    _openExportModal();
}

function _openExportModal() {
    document.getElementById('_exportPreviewModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_exportPreviewModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Cairo,sans-serif;direction:rtl;';
    overlay.onclick = e => { if (e.target===overlay) overlay.remove(); };

    overlay.innerHTML = `
    <div style="background:#0f1923;border:1px solid rgba(255,255,255,0.1);border-radius:22px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.7);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
            <div style="font-size:16px;font-weight:800;color:#fff;">معاينة التقرير</div>
            <div style="display:flex;gap:10px;align-items:center;">
                <button onclick="_doExportImage()" style="padding:9px 22px;border-radius:12px;background:linear-gradient(135deg,#2e7d32,#43a047);border:none;color:#fff;font-family:Cairo,sans-serif;font-size:14px;font-weight:800;cursor:pointer;">📸 تصدير كصورة</button>
                <button onclick="document.getElementById('_exportPreviewModal').remove()" style="padding:9px 16px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);font-family:Cairo,sans-serif;cursor:pointer;">✕</button>
            </div>
        </div>
        <div style="overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;" id="_exportModalBody">
        </div>
    </div>`;

    document.body.appendChild(overlay);
    _rebuildExportModal();
}

function _rebuildExportModal() {
    const body = document.getElementById('_exportModalBody');
    if (!body || !_exportData) return;
    const { allData, periodLabel, regionOrder, selections } = _exportData;
    const _rawMax = Math.max(...allData.map(x=>x.count));
    const maxAll = _rawMax > 0 ? _rawMax : 1;
    const total  = allData.reduce((s,x)=>s+x.count,0) || 1;
    const exporterTitle = currentUser?.title || '—';

    let html = `<div style="background:#0d1117;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,0.06);">`;
    // Header
    html += `<div style="text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:4px;">📊 تقرير تقييم الفروع</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);">${sanitize(exporterTitle)}</div>
        <div style="font-size:12px;color:#64b5f6;margin-top:2px;">الفترة: ${sanitize(periodLabel)}</div>
    </div>`;

    regionOrder.forEach(region => {
        const rd = allData.filter(x=>x.region===region).sort((a,b)=>b.count-a.count);
        if (!rd.length) return;
        const sel = selections[region];
        const st  = REGION_STYLE[region] || {bar:'linear-gradient(90deg,#455a64,#90a4ae)',header:'rgba(69,90,100,0.15)',headerBorder:'rgba(69,90,100,0.35)',headerColor:'#90a4ae'};
        const regionTotal = rd.reduce((s,x)=>s+x.count,0);
        const bestItem    = rd.find(x=>`${x.branch}||${x.city}`===sel.bestKey)  || rd[0];
        const worstItem   = rd.find(x=>`${x.branch}||${x.city}`===sel.worstKey) || rd[rd.length-1];
        const topCount    = rd[0].count;
        const bottomCount = rd[rd.length-1].count;
        const topTied     = rd.filter(x=>x.count===topCount);
        const bottomTied  = rd.filter(x=>x.count===bottomCount);

        html += `<div style="margin-bottom:14px;border:1px solid ${st.headerBorder};border-radius:12px;overflow:hidden;">
            <div style="background:${st.header};border-bottom:1px solid ${st.headerBorder};padding:9px 14px;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-weight:800;font-size:14px;color:${st.headerColor};">قسم ${region}</span>
                <span style="border:1px solid ${st.headerBorder};color:${st.headerColor};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:800;">${regionTotal} شكوى</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:1px;background:rgba(255,255,255,0.04);">`;

        rd.forEach((x, i) => {
            const key       = `${x.branch}||${x.city}`;
            const isBest    = key === sel.bestKey;
            const isWorst   = key === sel.worstKey;
            const isTiedTop = x.count === topCount && topTied.length > 1;
            const isTiedBot = x.count === bottomCount && bottomTied.length > 1;
            const pct       = Math.round((x.count/maxAll)*100);
            const sharePct  = ((x.count/total)*100).toFixed(1);

            let rowBg  = 'rgba(255,255,255,0.02)';
            let rowBdr = 'transparent';
            let badge  = '';
            if (isBest)  { rowBg='rgba(46,125,50,0.08)';  rowBdr='rgba(46,125,50,0.3)';  badge=`<span style="background:rgba(46,125,50,0.25);color:#81c784;border:1px solid rgba(46,125,50,0.5);border-radius:8px;padding:2px 9px;font-size:10px;font-weight:800;">⭐ أفضل فرع</span>`; }
            if (isWorst) { rowBg='rgba(183,28,28,0.08)'; rowBdr='rgba(183,28,28,0.3)'; badge=`<span style="background:rgba(183,28,28,0.2);color:#ef9a9a;border:1px solid rgba(183,28,28,0.4);border-radius:8px;padding:2px 9px;font-size:10px;font-weight:800;">⚠️ الفرع الأسوأ</span>`; }

            // Tie selection buttons inline — أعلى عدد = أسوأ، أقل عدد = أفضل
            let tieBtn = '';
            if (isTiedTop && !isWorst) {
                tieBtn += `<button onclick="_updateExportSel('${region}','worst','${key}')" style="padding:2px 8px;font-size:10px;font-family:Cairo,sans-serif;cursor:pointer;border-radius:6px;border:1px solid rgba(183,28,28,0.4);background:rgba(183,28,28,0.1);color:#ef9a9a;margin-right:4px;">⚠️ تحديد كأسوأ</button>`;
            }
            if (isTiedBot && !isBest) {
                tieBtn += `<button onclick="_updateExportSel('${region}','best','${key}')" style="padding:2px 8px;font-size:10px;font-family:Cairo,sans-serif;cursor:pointer;border-radius:6px;border:1px solid rgba(46,125,50,0.4);background:rgba(46,125,50,0.1);color:#81c784;margin-right:4px;">⭐ تحديد كأفضل</button>`;
            }

            html += `<div style="background:${rowBg};border-right:3px solid ${rowBdr};padding:10px 14px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:${(isBest||isWorst)?'6px':'0'};">
                    <span style="font-size:11px;color:rgba(255,255,255,0.3);min-width:20px;">#${i+1}</span>
                    <span style="flex:1;font-weight:${(isBest||isWorst)?'700':'500'};font-size:13px;color:${(isBest||isWorst)?'#e6edf3':'rgba(255,255,255,0.55)'};">${sanitize(x.branch)}<span style="font-size:10px;color:rgba(255,255,255,0.3);margin-right:5px;">— ${sanitize(x.city)}</span></span>
                    ${tieBtn}
                    ${badge}
                    <span style="font-size:13px;font-weight:700;color:${st.headerColor};">${x.count}</span>
                </div>
                ${(isBest||isWorst)?`<div style="background:rgba(255,255,255,0.05);border-radius:100px;height:5px;overflow:hidden;margin-right:28px;"><div style="height:100%;width:${pct}%;background:${st.bar};border-radius:100px;"></div></div>`:''}
            </div>`;
        });
        html += `</div></div>`;
    });

    const exportDate = new Date().toLocaleDateString('ar-SA');
    html += `<div style="text-align:center;margin-top:10px;font-size:10px;color:rgba(255,255,255,0.2);">تم إنشاء هذا التقرير بتاريخ ${exportDate} — محامص الشعب</div>`;
    html += `</div>`;
    body.innerHTML = html;
}

function _updateExportSel(region, type, val) {
    if (!_exportData?.selections[region]) return;
    if (type === 'best')  _exportData.selections[region].bestKey  = val;
    if (type === 'worst') _exportData.selections[region].worstKey = val;
    _rebuildExportModal();
}

function _doExportImage() {
    if (!_exportData) return;
    // شعار مضمّن مسبقاً كـ base64
    const _BRAND_B64 = "data:image/jpeg;base64,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";
    _runExport(_BRAND_B64);
}


function _runExport(rawLogoBase64) {
    // إزالة الخلفية الرمادية من الشعار
    function _removeBg(b64, cb) {
        if (!b64) { cb(''); return; }
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height);
            const px = d.data;
            for (let i = 0; i < px.length; i += 4) {
                const r=px[i],g=px[i+1],b=px[i+2];
                const bright=(r+g+b)/3, sat=Math.max(r,g,b)-Math.min(r,g,b);
                if (bright>182 && sat<45) px[i+3]=0;
                else if (bright>158 && sat<30) px[i+3]=Math.round(((bright-158)/24)*255);
            }
            ctx.putImageData(d, 0, 0);
            cb(c.toDataURL('image/png'));
        };
        img.onerror = () => cb(b64);
        img.src = b64;
    }

    _removeBg(rawLogoBase64, (logoBase64) => {
    const { allData, periodLabel, regionOrder, selections } = _exportData;
    const _rawMax = Math.max(...allData.map(x=>x.count));
    const maxAll = _rawMax > 0 ? _rawMax : 1;
    const total  = allData.reduce((s,x)=>s+x.count,0) || 1;
    const _role = currentUser?.role;
    const exporterDept = _role === 'control_employee' ? 'القسم: السيطرة والتدقيق'
        : (_role === 'cc_manager' || currentUser?.isAdmin) ? 'القسم: الكول سنتر' : '';
    let regionsHtml = '';

    regionOrder.forEach(region => {
        const rd = allData.filter(x=>x.region===region).sort((a,b)=>b.count-a.count);
        if (!rd.length) return;
        const sel       = selections[region];
        // ألوان مخصصة للخلفية البيضاء
        const WB_STYLE = {
            'الشرقية':   {hBg:'#e3f2fd',hBdr:'#1565c0',hColor:'#0d47a1'},
            'الجنوبية':  {hBg:'#e8f5e9',hBdr:'#2e7d32',hColor:'#1b5e20'},
            'الغربية':   {hBg:'#f3e5f5',hBdr:'#6a1b9a',hColor:'#4a148c'},
            'المحافظات': {hBg:'#fff3e0',hBdr:'#e65100',hColor:'#bf360c'},
            'أخرى':      {hBg:'#f5f5f5',hBdr:'#455a64',hColor:'#263238'}
        };
        const ws = WB_STYLE[region] || WB_STYLE['أخرى'];
        const bestItem  = rd.find(x=>`${x.branch}||${x.city}`===sel.bestKey)  || rd[0];
        const worstItem = rd.find(x=>`${x.branch}||${x.city}`===sel.worstKey) || rd[rd.length-1];
        const rows = bestItem===worstItem ? [bestItem] : [bestItem, worstItem];

        let rowsHtml = '';
        rows.forEach(x => {
            const isBest  = x===bestItem;
            const cardBg  = isBest ? '#f1f8e9' : '#ffebee';
            const cardBdr = isBest ? '#558b2f'  : '#c62828';
            const badge   = isBest
                ? `<span style="background:#c8e6c9;color:#1b5e20;border:1px solid #388e3c;border-radius:8px;padding:3px 12px;font-size:12px;font-weight:800;">⭐ أفضل فرع</span>`
                : `<span style="background:#ffcdd2;color:#b71c1c;border:1px solid #c62828;border-radius:8px;padding:3px 12px;font-size:12px;font-weight:800;">⚠️ الفرع الأسوأ</span>`;
            rowsHtml += `<div style="background:${cardBg};border:1.5px solid ${cardBdr};border-radius:10px;padding:13px 16px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-weight:800;font-size:15px;color:#1a1a2e;flex:1;">${x.branch}<span style="color:#546e7a;font-size:12px;font-weight:500;margin-right:6px;">— ${x.city}</span></span>
                    ${badge}
                </div>
            </div>`;
        });
        regionsHtml += `<div style="margin-bottom:16px;border:2px solid ${ws.hBdr};border-radius:14px;overflow:hidden;">
            <div style="background:${ws.hBg};border-bottom:2px solid ${ws.hBdr};padding:11px 18px;">
                <span style="font-weight:900;font-size:15px;color:${ws.hColor};">قسم ${region}</span>
            </div>
            <div style="padding:12px;background:#fff;">${rowsHtml}</div>
        </div>`;
    });

    const exportDate = new Date().toLocaleDateString('ar-SA');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:820px;background:#ffffff;color:#1a1a2e;font-family:Cairo,sans-serif;direction:rtl;padding:28px;box-sizing:border-box;overflow:hidden;';
    container.innerHTML = `<div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid rgba(0,0,0,0.1);">
        ${logoBase64 ? `<img src="${logoBase64}" style="width:110px;height:110px;object-fit:contain;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;">` : ""}
        <div style="font-size:22px;font-weight:900;color:#1a1a2e;margin-bottom:4px;">تقرير تقييم الفروع</div>
        ${exporterDept ? `<div style="font-size:13px;font-weight:700;color:#546e7a;margin-bottom:2px;">${exporterDept}</div>` : ""}
        <div style="font-size:13px;color:#1565c0;">الفترة: ${periodLabel}</div>
    </div>
    ${regionsHtml}
    <div style="text-align:center;margin-top:14px;padding-top:14px;border-top:1px solid rgba(0,0,0,0.08);font-size:10px;color:rgba(0,0,0,0.25);">تم إنشاء هذا التقرير بتاريخ ${exportDate} — محامص الشعب</div>`;

    document.body.appendChild(container);
    html2canvas(container,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false}).then(canvas=>{
        container.remove();
        const link=document.createElement('a');
        link.download='تقييم-الفروع-'+periodLabel.replace(/\s+/g,'-')+'.png';
        link.href=canvas.toDataURL('image/png');
        link.click();
    }).catch(()=>{container.remove();alert('حدث خطأ أثناء التصدير');});
    }); // end _removeBg
}