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
                <div style="display:flex;align-items:center;padding:0 14px;flex-shrink:0;">
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
