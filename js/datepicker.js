/* ══════════════════════════════════════════════════════
   DATE PICKER — Year / Month / Day picker
══════════════════════════════════════════════════════ */
let calTarget=null, calMode='month', calYear=new Date().getFullYear(), calMonth=new Date().getMonth(), calYearPage=0, calOnSelect=null;
const calMonths=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const calDayNames=['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

function openDatePicker(fieldId, defaultMode) {
    closeDatePicker(); calTarget=fieldId;
    const cur=document.getElementById(fieldId).value;
    const today=new Date();
    calYear  = cur ? parseInt(cur.split('-')[0]) : today.getFullYear();
    calMonth = cur && cur.split('-')[1] ? parseInt(cur.split('-')[1])-1 : today.getMonth();
    calYearPage = Math.floor((calYear-2020)/12);
    if (!cur) calMode = defaultMode || 'month'; else if (cur.length===4) calMode='year'; else if (cur.length===7) calMode='month'; else calMode='day';

    const wrap=document.getElementById(fieldId+'-display').parentElement;
    const rect=wrap.getBoundingClientRect();
    const overlay=document.createElement('div'); overlay.className='cal-overlay'; overlay.id='calOverlay'; overlay.onclick=closeDatePicker; document.body.appendChild(overlay);
    const popup=document.createElement('div'); popup.className='cal-popup'; popup.id='calPopup'; popup.onclick=e=>e.stopPropagation();
    let top=rect.bottom+8, left=rect.left;
    if (top+420>window.innerHeight) top=rect.top-420;
    if (left+370>window.innerWidth) left=window.innerWidth-375;
    popup.style.top=top+'px'; popup.style.left=left+'px';
    document.body.appendChild(popup); renderCal();
}

function renderCal() {
    const popup=document.getElementById('calPopup'); if(!popup) return;
    const today=new Date();
    const curVal=document.getElementById(calTarget)?.value||'';
    const tabs=`<div class="cal-mode-tabs">
        <button class="cal-mode-tab ${calMode==='year'?'active':''}"  onclick="setCalMode('year')">📅 سنة</button>
        <button class="cal-mode-tab ${calMode==='month'?'active':''}" onclick="setCalMode('month')">🗓 شهر</button>
        <button class="cal-mode-tab ${calMode==='day'?'active':''}"   onclick="setCalMode('day')">📆 يوم</button>
    </div>`;
    let body='';
    if (calMode==='year') {
        const baseYear=2020+calYearPage*12;
        const years=Array.from({length:12},(_,i)=>baseYear+i);
        const selYear=curVal.length>=4?parseInt(curVal):null;
        body=`<div class="cal-year-bar">
            <button class="cal-year-nav" onclick="calYearPageMove(-1)">&#8250;</button>
            <span style="font-family:'Cairo';font-size:14px;color:var(--text-dim);">${baseYear}—${baseYear+11}</span>
            <button class="cal-year-nav" onclick="calYearPageMove(1)">&#8249;</button>
        </div><div class="cal-years-grid">${years.map(y=>`<button class="cal-year-btn ${y===today.getFullYear()?'current-yr':''} ${y===selYear?'selected-yr':''}" onclick="selectYear(${y})">${y}</button>`).join('')}</div>`;
    } else if (calMode==='month') {
        const selYear=curVal.length>=4?parseInt(curVal.split('-')[0]):null;
        const selMonth=curVal.length>=7?parseInt(curVal.split('-')[1])-1:null;
        body=`<div class="cal-year-bar">
            <button class="cal-year-nav" onclick="calYearMove(-1)">&#8250;</button>
            <span class="cal-year-label" onclick="setCalMode('year')">${calYear}</span>
            <button class="cal-year-nav" onclick="calYearMove(1)">&#8249;</button>
        </div><div class="cal-months-grid">${calMonths.map((name,i)=>`<button class="cal-month-btn ${i===today.getMonth()&&calYear===today.getFullYear()?'current-month':''} ${i===selMonth&&calYear===selYear?'selected-month':''}" onclick="selectMonth(${i})">${name}</button>`).join('')}</div>`;
    } else {
        const selYear=curVal.length>=4?parseInt(curVal.split('-')[0]):null;
        const selMonth=curVal.length>=7?parseInt(curVal.split('-')[1])-1:null;
        const selDay=curVal.length>=10?parseInt(curVal.split('-')[2]):null;
        const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
        const firstDow=new Date(calYear,calMonth,1).getDay();
        let dayCells='';
        for(let i=0;i<firstDow;i++) dayCells+=`<button class="cal-day-btn empty"></button>`;
        for(let d=1;d<=daysInMonth;d++) dayCells+=`<button class="cal-day-btn ${d===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear()?'today':''} ${d===selDay&&calMonth===selMonth&&calYear===selYear?'selected-day':''}" onclick="selectDay(${d})">${d}</button>`;
        body=`<div class="cal-year-bar">
            <button class="cal-year-nav" onclick="calMonthMove(-1)">&#8250;</button>
            <span class="cal-year-label" style="font-size:14px;" onclick="setCalMode('month')">${calMonths[calMonth]} ${calYear}</span>
            <button class="cal-year-nav" onclick="calMonthMove(1)">&#8249;</button>
        </div><div class="cal-days-header">${calDayNames.map(d=>`<div class="cal-day-name">${d}</div>`).join('')}</div><div class="cal-days-grid">${dayCells}</div>`;
    }
    popup.innerHTML=tabs+body+`<button class="cal-clear" onclick="clearDate()">✕ مسح التاريخ</button>`;
}

function setCalMode(m){calMode=m;renderCal();}
function calYearMove(d){calYear+=d;renderCal();}
function calMonthMove(d){calMonth+=d;if(calMonth<0){calMonth=11;calYear--;}if(calMonth>11){calMonth=0;calYear++;}renderCal();}
function calYearPageMove(d){calYearPage+=d;renderCal();}

function _calDone(){ closeDatePicker(); const fn=calOnSelect; calOnSelect=null; fn ? fn() : filterTable(); }
function selectYear(y){
    document.getElementById(calTarget).value=String(y);
    const disp=document.getElementById(calTarget+'-display');
    disp.textContent='📅 '+y; disp.classList.add('selected');
    calYear=y; _calDone();
}
function selectMonth(m){
    calMonth=m;
    const isoVal=`${calYear}-${String(m+1).padStart(2,'0')}`;
    document.getElementById(calTarget).value=isoVal;
    const disp=document.getElementById(calTarget+'-display');
    disp.textContent='📅 '+calMonths[m]+' '+calYear; disp.classList.add('selected');
    _calDone();
}
function selectDay(d){
    const isoVal=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    document.getElementById(calTarget).value=isoVal;
    const disp=document.getElementById(calTarget+'-display');
    disp.textContent=`📅 ${d} ${calMonths[calMonth]} ${calYear}`; disp.classList.add('selected');
    _calDone();
}
function clearDate(){
    document.getElementById(calTarget).value='';
    const disp=document.getElementById(calTarget+'-display');
    disp.textContent='📅 اختر التاريخ'; disp.classList.remove('selected');
    _calDone();
}
function closeDatePicker(){document.getElementById('calOverlay')?.remove();document.getElementById('calPopup')?.remove();}
function setDatePickerValue(fieldId, isoDate){
    const el=document.getElementById(fieldId); if(!el) return;
    el.value=isoDate;
    const disp=document.getElementById(fieldId+'-display'); if(!disp) return;
    if(!isoDate){ disp.textContent='📅 اختر التاريخ'; disp.classList.remove('selected'); return; }
    const parts=isoDate.split('-');
    if(parts.length===3) disp.textContent=`📅 ${parseInt(parts[2])} ${calMonths[parseInt(parts[1])-1]} ${parts[0]}`;
    else if(parts.length===2) disp.textContent=`📅 ${calMonths[parseInt(parts[1])-1]} ${parts[0]}`;
    else disp.textContent='📅 '+isoDate;
    disp.classList.add('selected');
}
