/* ══════════════════════════════════════════════════════
   EMPLOYEES — Add, delete, render
══════════════════════════════════════════════════════ */
function _visibleEmployees() {
    // مدير قسم السيطرة يرى فقط موظفي السيطرة الذين أضافهم هو
    if (currentUser?.role === 'control_employee') {
        return employees.filter(e => e.title === 'موظف سيطرة');
    }
    // قسم السيطرة يرى فقط مديري قسم السيطرة الذين أضافهم هو
    if (currentUser?.role === 'control') {
        return employees.filter(e => e.title === 'مدير قسم السيطرة' && e.addedBy === currentUser.empId);
    }
    // الجميع (بما فيهم المدير) لا يرون موظفي السيطرة
    return employees.filter(e => e.title !== 'موظف سيطرة');
}

function onEmployeeTitleChange() {
    const title = document.getElementById('eTitle')?.value || '';
    const single = document.getElementById('eSingleBranchSection');
    const multi  = document.getElementById('eMultiBranchSection');
    if (!single || !multi) return;

    if (title === 'موظف فرع' || title === 'مدير فرع') {
        single.style.display = 'block';
        multi.style.display  = 'none';
        // تعبئة خيارات المحافظة
        const cityEl = document.getElementById('eBranchCity');
        if (cityEl && cityEl.options.length <= 1) {
            Object.keys(branches).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                cityEl.appendChild(opt);
            });
        }
    } else if (title === 'مدير منطقة') {
        single.style.display = 'none';
        multi.style.display  = 'block';
        const listEl = document.getElementById('eMultiBranchList');
        if (listEl && !listEl.dataset.populated) {
            listEl.dataset.populated = '1';
            Object.entries(branches).forEach(([city, brs]) => {
                brs.forEach(b => {
                    const lbl = document.createElement('label');
                    lbl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;cursor:pointer;font-size:13px;';
                    lbl.innerHTML = `<input type="checkbox" value="${city}::${b}" style="accent-color:var(--accent-red);"> ${b} <small style="color:var(--text-dim)">(${city})</small>`;
                    listEl.appendChild(lbl);
                });
            });
        }
    } else {
        single.style.display = 'none';
        multi.style.display  = 'none';
    }
}

async function addEmployee() {
    const name=document.getElementById("eName").value.trim(),
          title=document.getElementById("eTitle").value.trim(),
          empId=document.getElementById("eId").value.trim();
    if (!name||!title||!empId) return alert("يرجى إكمال جميع البيانات");
    if (currentUser?.role === 'control' && title !== 'مدير قسم السيطرة') return alert("قسم السيطرة يمكنه إضافة مدير قسم السيطرة فقط");
    if (currentUser?.role === 'control_employee' && title !== 'موظف سيطرة') return alert("مدير قسم السيطرة يمكنه إضافة موظف سيطرة فقط");
    if (employees.some(e => e.empId===empId)) return alert("هذا الرقم الوظيفي مستخدم مسبقاً");

    // اختيار الفرع للأدوار المعنية
    let assignedBranch = null, assignedBranches = null;
    if (title === 'موظف فرع' || title === 'مدير فرع') {
        const city = document.getElementById('eBranchCity')?.value;
        const br   = document.getElementById('eBranchName')?.value;
        if (city && br) assignedBranch = { city, branch: br };
    } else if (title === 'مدير منطقة') {
        const checked = [...(document.getElementById('eMultiBranchList')?.querySelectorAll('input[type=checkbox]:checked') || [])];
        if (checked.length) {
            assignedBranches = checked.map(cb => {
                const [city, branch] = cb.value.split('::');
                return { city, branch };
            });
        }
    }

    const addedBy = currentUser?.isAdmin ? null : (currentUser?.empId || null);
    const salt = generateSalt();
    const passwordHash = await hashPassword(salt + empId);
    employees.unshift({ id:Date.now(), name, title, empId, addedBy, salt, passwordHash,
        ...(assignedBranch   ? { assignedBranch }   : {}),
        ...(assignedBranches ? { assignedBranches } : {})
    });
    saveEmployees();
    document.getElementById("eName").value = document.getElementById("eTitle").value = document.getElementById("eId").value = "";
    onEmployeeTitleChange();
    populateEmployeeDropdowns();
    renderEmployees();
}

function deleteEmployee(empId) {
    const emp = employees.find(e => e.empId === empId);
    if (!emp) return;
    if (currentUser?.role === 'control_employee' && emp.addedBy !== currentUser.empId) return alert("لا تملك صلاحية حذف هذا الموظف");
    if (currentUser?.role === 'control'          && emp.addedBy !== currentUser.empId) return alert("لا تملك صلاحية حذف هذا الموظف");
    showDeleteConfirm(
        `<div style="font-weight:700;color:var(--text-main);margin-bottom:4px;">${sanitize(emp.name)}</div>
         <div style="color:var(--text-dim);">${sanitize(emp.title)}</div>
         <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">الرقم الوظيفي: ${sanitize(emp.empId)}</div>`,
        () => { employees = employees.filter(e => e.empId !== empId); saveEmployees(); populateEmployeeDropdowns(); renderEmployees(); }
    );
}

function _canChangeEmpPassword(emp) {
    if (currentUser?.isAdmin) return true;
    const role = currentUser?.role;
    if (role === 'cc_manager')       return emp.title !== 'موظف سيطرة';
    if (role === 'control_employee') return emp.title === 'موظف سيطرة';
    return false;
}

let _setEmpPwTargetId = null;

function openSetEmpPassword(empId) {
    const emp = employees.find(e => e.empId === empId);
    if (!emp) return;
    _setEmpPwTargetId = empId;
    document.getElementById('setEmpPwName').textContent = `${emp.name} — ${emp.title}`;
    document.getElementById('setEmpPwNew').value  = '';
    document.getElementById('setEmpPwNew2').value = '';
    const msg = document.getElementById('setEmpPwMsg');
    msg.textContent = ''; msg.style.color = '';
    document.getElementById('setEmpPasswordModal').classList.remove('hidden');
}

function closeSetEmpPassword() {
    _setEmpPwTargetId = null;
    document.getElementById('setEmpPasswordModal').classList.add('hidden');
}

async function confirmSetEmpPassword() {
    const msg  = document.getElementById('setEmpPwMsg');
    const pw1  = document.getElementById('setEmpPwNew').value;
    const pw2  = document.getElementById('setEmpPwNew2').value;
    if (!pw1)             { msg.textContent = 'يرجى إدخال كلمة المرور';       msg.style.color = '#ef5350'; return; }
    if (pw1.length < 4)   { msg.textContent = 'كلمة المرور 4 أحرف على الأقل'; msg.style.color = '#ef5350'; return; }
    if (pw1 !== pw2)      { msg.textContent = 'كلمة المرور غير متطابقة';       msg.style.color = '#ef5350'; return; }
    const emp = employees.find(e => e.empId === _setEmpPwTargetId);
    if (!emp) { closeSetEmpPassword(); return; }
    emp.salt         = generateSalt();
    emp.passwordHash = await hashPassword(emp.salt + pw1);
    saveEmployees();
    msg.textContent = '✅ تم تغيير كلمة المرور بنجاح';
    msg.style.color = '#81c784';
    setTimeout(closeSetEmpPassword, 1200);
}


function renderEmployees() {
    const tbody = document.querySelector("#tableE tbody"); if (!tbody) return;
    // تصفية المسميات حسب الدور
    const eTitleEl = document.getElementById('eTitle');
    if (eTitleEl && currentUser?.role === 'control') {
        eTitleEl.innerHTML = `<option value="">اختر المسمى الوظيفي</option>
            <option value="مدير قسم السيطرة">مدير قسم السيطرة</option>`;
    } else if (eTitleEl && currentUser?.role === 'control_employee') {
        eTitleEl.innerHTML = `<option value="">اختر المسمى الوظيفي</option>
            <option value="موظف سيطرة">موظف سيطرة</option>`;
    }
    const list = _visibleEmployees();
    if (!list.length) {
        tbody.innerHTML=`<tr><td colspan="5" style="color:var(--text-dim);padding:30px;">لا يوجد موظفون مسجلون بعد</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((e,i) => {
        let branchInfo = '';
        if (e.assignedBranch) {
            branchInfo = `<div style="font-size:11px;color:var(--text-dim);margin-top:3px;">📍 ${sanitize(e.assignedBranch.branch)} — ${sanitize(e.assignedBranch.city)}</div>`;
        } else if (e.assignedBranches?.length) {
            branchInfo = `<div style="font-size:11px;color:var(--text-dim);margin-top:3px;">📍 ${e.assignedBranches.map(b => `${sanitize(b.branch)}`).join(' · ')}</div>`;
        }
        return `<tr>
        <td>${i+1}</td><td><b>${sanitize(e.name)}</b>${branchInfo}</td>
        <td><span class="emp-badge">${sanitize(e.title)}</span></td>
        <td><span class="emp-id-display">${sanitize(e.empId)}</span></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">
            ${_canChangeEmpPassword(e) ? `<button class="btn-delete-sm" style="background:rgba(33,150,243,0.15);color:#64b5f6;border-color:rgba(33,150,243,0.3);" onclick="openSetEmpPassword('${e.empId}')">🔑 كلمة المرور</button>` : ''}
            <button class="btn-delete-sm" onclick="deleteEmployee('${e.empId}')">🗑 حذف</button>
        </td>
    </tr>`;
    }).join('');
}
