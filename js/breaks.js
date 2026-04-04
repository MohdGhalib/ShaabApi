/* ══════════════════════════════════════════════════════
   BREAKS — Timer, break history
══════════════════════════════════════════════════════ */
let timerInterval=null, timerStart=null, timerType='';

function startBreak(type) {
    timerType  = type;
    timerStart = Date.now();
    document.getElementById("timerLabel").textContent  = type;
    document.getElementById("timerStatus").textContent = `أنت في ${type}`;
    document.getElementById("breakOverlay").classList.remove("hidden");
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now()-timerStart)/1000);
        document.getElementById("timerDisplay").textContent =
            `${String(Math.floor(elapsed/3600)).padStart(2,'0')}:${String(Math.floor((elapsed%3600)/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
    }, 1000);
}

function stopBreak() {
    if (!timerInterval) return;
    clearInterval(timerInterval); timerInterval=null;
    const endTime  = Date.now();
    const duration = Math.floor((endTime-timerStart)/1000);
    breaks.push({ id:Date.now(), empId:currentUser.empId, empName:currentUser.name,
        type:timerType, startIso:new Date(timerStart).toISOString(),
        endIso:new Date(endTime).toISOString(), duration,
        date:new Date(timerStart).toISOString().split('T')[0] });
    saveBreaks();
    document.getElementById("breakOverlay").classList.add("hidden");
    document.getElementById("timerDisplay").textContent = "00:00:00";
    renderBreakHistory();
}


function renderBreakHistory() {
    const today = iso();
    const myBreaks = breaks.filter(b => b.empId===currentUser.empId && b.date===today);
    const tbody = document.querySelector("#tableBreak tbody"); if (!tbody) return;
    if (!myBreaks.length) {
        tbody.innerHTML=`<tr><td colspan="4" style="color:var(--text-dim);padding:20px;">لا توجد استراحات اليوم</td></tr>`;
        return;
    }
    tbody.innerHTML = myBreaks.map(b => `<tr>
        <td><span class="emp-badge">${b.type}</span></td>
        <td><small>${_fmtTime(b.startIso)}</small></td>
        <td style="color:var(--accent-red);font-family:monospace;font-weight:700">${fmtDuration(b.duration)}</td>
        <td><small>${_fmtTime(b.endIso)}</small></td>
    </tr>`).join('');
}
