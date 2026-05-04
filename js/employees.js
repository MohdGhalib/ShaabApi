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
        cityEl.innerHTML = '<option value="">المحافظة</option>';
        Object.keys(branches).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            cityEl.appendChild(opt);
        });
        document.getElementById('eBranchName').innerHTML = '<option value="">الفرع</option>';
        // لمدير الفرع: تحديث الفروع مع إظهار المحجوز
        cityEl.onchange = () => _updateBranchNameForBranchManager(title);
    } else if (title === 'موظف سيطرة') {
        single.style.display = 'none';
        multi.style.display  = 'block';
        const listEl = document.getElementById('eMultiBranchList');
        if (!listEl) return;
        const secLabel = document.querySelector('#eMultiBranchSection > label');
        if (secLabel) secLabel.innerHTML = '🏢 الفروع المسؤول عنها <span id="_ctrlSubBranchCount" style="background:rgba(211,47,47,0.2);border:1px solid rgba(211,47,47,0.4);color:#ef9a9a;border-radius:20px;padding:1px 10px;font-size:11px;font-weight:700;margin-right:6px;">0 فرع</span>';

        const _updateCount = () => {
            const n = listEl.querySelectorAll('input[type=checkbox]:checked').length;
            const el = document.getElementById('_ctrlSubBranchCount');
            if (el) el.textContent = n + ' فرع';
        };

        // جمع الفروع المحجوزة لموظفي السيطرة الحاليين
        const takenBy = {};
        employees.forEach(e => {
            if (e.title !== 'موظف سيطرة') return;
            (e.assignedBranches || []).forEach(b => {
                takenBy[b.city + '::' + b.branch] = e.name;
            });
        });

        listEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:2px;';
        listEl.innerHTML = '';

        Object.entries(branches).forEach(([city, brs]) => {
            // ── Accordion wrapper ──
            const accordion = document.createElement('div');
            accordion.style.cssText = 'border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;transition:border-color .2s;';

            // ── City trigger row ──
            const trigger = document.createElement('div');
            trigger.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.04);cursor:pointer;user-select:none;';

            const cityLeft = document.createElement('div');
            cityLeft.style.cssText = 'display:flex;align-items:center;gap:8px;';
            cityLeft.innerHTML = `<span style="font-size:13px;font-weight:800;color:var(--text-main);">${city}</span>
                <span class="_cityCount" style="font-size:10px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.4);border-radius:20px;padding:1px 8px;">0/${brs.length}</span>`;

            const arrow = document.createElement('span');
            arrow.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.35);transition:transform .2s;';
            arrow.textContent = '▼';

            trigger.appendChild(cityLeft);
            trigger.appendChild(arrow);

            // ── Dropdown panel ──
            const panel = document.createElement('div');
            panel.style.cssText = 'display:none;border-top:1px solid rgba(255,255,255,0.07);padding:10px 12px;background:rgba(0,0,0,0.15);';

            const brGrid = document.createElement('div');
            brGrid.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

            brs.forEach(br => {
                const taken = takenBy[city + '::' + br];
                const row = document.createElement('label');
                row.style.cssText = taken
                    ? 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:9px;cursor:not-allowed;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.01);opacity:0.5;'
                    : 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:9px;cursor:pointer;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02);transition:all .15s;';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = `${city}::${br}`;
                cb.disabled = !!taken;
                cb.style.cssText = 'width:16px;height:16px;accent-color:#ef5350;flex-shrink:0;' + (taken ? 'cursor:not-allowed;' : 'cursor:pointer;');
                const brName = document.createElement('span');
                brName.style.cssText = 'font-size:13px;font-weight:600;flex:1;' + (taken ? 'color:rgba(255,255,255,0.3);' : 'color:rgba(255,255,255,0.7);');
                brName.textContent = br;
                cb.onchange = () => {
                    if (cb.checked) {
                        row.style.background = 'rgba(211,47,47,0.15)';
                        row.style.borderColor = 'rgba(211,47,47,0.4)';
                        brName.style.color = '#ef9a9a';
                    } else {
                        row.style.background = 'rgba(255,255,255,0.02)';
                        row.style.borderColor = 'rgba(255,255,255,0.07)';
                        brName.style.color = 'rgba(255,255,255,0.7)';
                    }
                    const checked = panel.querySelectorAll('input:checked').length;
                    cityLeft.querySelector('._cityCount').textContent = checked + '/' + brs.length;
                    if (checked > 0) {
                        accordion.style.borderColor = 'rgba(211,47,47,0.4)';
                        cityLeft.querySelector('._cityCount').style.cssText = 'font-size:10px;background:rgba(211,47,47,0.2);color:#ef9a9a;border-radius:20px;padding:1px 8px;';
                    } else {
                        accordion.style.borderColor = 'rgba(255,255,255,0.08)';
                        cityLeft.querySelector('._cityCount').style.cssText = 'font-size:10px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.4);border-radius:20px;padding:1px 8px;';
                    }
                    _updateCount();
                };
                row.appendChild(cb);
                row.appendChild(brName);
                if (taken) {
                    const badge = document.createElement('span');
                    badge.textContent = taken;
                    badge.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:20px;background:rgba(255,152,0,0.12);color:#ffb74d;border:1px solid rgba(255,152,0,0.25);white-space:nowrap;';
                    row.appendChild(badge);
                }
                brGrid.appendChild(row);
            });

            panel.appendChild(brGrid);

            // ── Toggle on click ──
            let open = false;
            trigger.onclick = () => {
                open = !open;
                panel.style.display = open ? 'block' : 'none';
                arrow.style.transform = open ? 'rotate(180deg)' : '';
                trigger.style.background = open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
            };

            accordion.appendChild(trigger);
            accordion.appendChild(panel);
            listEl.appendChild(accordion);
        });
    } else if (title === 'مدير منطقة') {
        single.style.display = 'none';
        multi.style.display  = 'block';
        const listEl = document.getElementById('eMultiBranchList');
        if (!listEl) return;

        // جمع الفروع المحجوزة لمديري المناطق الحاليين مع اسم صاحبها
        const takenBy = {};
        employees.forEach(e => {
            if (e.title !== 'مدير منطقة') return;
            (e.assignedBranches || []).forEach(b => {
                takenBy[b.city + '::' + b.branch] = e.name;
            });
        });

        // إعادة بناء القائمة في كل مرة لتعكس الحجوزات الحالية
        listEl.innerHTML = '';
        Object.entries(branches).forEach(([city, brs]) => {
            // ── عنوان المحافظة ──
            const hdr = document.createElement('div');
            hdr.style.cssText = 'grid-column:1/-1;margin-top:10px;padding:4px 10px 5px;'
                + 'font-weight:700;font-size:12px;color:var(--accent-red);letter-spacing:0.4px;'
                + 'border-bottom:1px solid var(--border);';
            hdr.textContent = city;
            listEl.appendChild(hdr);

            brs.forEach(b => {
                const key     = city + '::' + b;
                const manager = takenBy[key];
                const isTaken = !!manager;

                const lbl = document.createElement('label');
                lbl.title = isTaken ? `محجوز لـ: ${manager}` : '';
                lbl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;'
                    + `border-radius:8px;font-size:13px;`
                    + `cursor:${isTaken ? 'not-allowed' : 'pointer'};`
                    + `opacity:${isTaken ? '0.4' : '1'};`
                    + (isTaken ? 'text-decoration:line-through;' : '');

                const cb = document.createElement('input');
                cb.type    = 'checkbox';
                cb.value   = key;
                cb.style.accentColor = 'var(--accent-red)';
                if (isTaken) cb.disabled = true;

                lbl.appendChild(cb);
                lbl.appendChild(document.createTextNode(' ' + b));
                if (isTaken) {
                    const note = document.createElement('small');
                    note.style.color = 'var(--accent-red)';
                    note.style.fontSize = '10px';
                    note.textContent = ` (${manager})`;
                    lbl.appendChild(note);
                }
                listEl.appendChild(lbl);
            });
        });
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
    } else if (title === 'مدير منطقة' || title === 'موظف سيطرة') {
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
        // مؤشر الاتصال + اسم قابل للضغط (لمدير الكول سنتر فقط)
        const _isOnline = (sessions || []).some(s => s.empId === e.empId &&
            (typeof _isSessionAlive === 'function' ? _isSessionAlive(s) : !s.logoutIso));
        const _dot = _isOnline
            ? `<span title="مسجّل دخول الآن" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#4caf50;box-shadow:0 0 8px #4caf50,0 0 2px #fff;margin-left:6px;vertical-align:middle;"></span>`
            : '';
        const _nameHtml = (typeof _empNameHTML === 'function')
            ? _empNameHTML(e.name)
            : sanitize(e.name);
        return `<tr>
        <td>${i+1}</td><td><b>${_nameHtml}</b>${_dot}${branchInfo}</td>
        <td><span class="emp-badge">${sanitize(e.title)}</span></td>
        <td><span class="emp-id-display">${sanitize(e.empId)}</span></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">
            ${_canChangeEmpPassword(e) ? `<button class="btn-delete-sm" style="background:rgba(33,150,243,0.15);color:#64b5f6;border-color:rgba(33,150,243,0.3);" onclick="openSetEmpPassword('${e.empId}')">🔑 كلمة المرور</button>` : ''}
            ${(e.title === 'مدير فرع' || e.title === 'موظف فرع') && currentUser?.isAdmin ? `<button class="btn-delete-sm" style="background:rgba(76,175,80,0.15);color:#81c784;border-color:rgba(76,175,80,0.3);" onclick="openTransferModal('${e.empId}')">↔ نقل</button>` : ''}
            <button class="btn-delete-sm" onclick="deleteEmployee('${e.empId}')">🗑 حذف</button>
        </td>
    </tr>`;
    }).join('');
}

// ── تحديث قائمة الفروع لمدير الفرع (مع حجب المحجوز) ─────────────────────────
function _updateBranchNameForBranchManager(title) {
    const city = document.getElementById('eBranchCity')?.value;
    const brEl = document.getElementById('eBranchName');
    if (!brEl) return;

    // الفروع المحجوزة لمديري الفروع الحاليين
    const takenBy = {};
    if (title === 'مدير فرع') {
        employees.forEach(e => {
            if (e.title !== 'مدير فرع') return;
            if (e.assignedBranch?.city === city) {
                takenBy[e.assignedBranch.branch] = e.name;
            }
        });
    }

    let html = '<option value="">الفرع</option>';
    if (city && branches[city]) {
        branches[city].forEach(b => {
            const manager = takenBy[b];
            if (manager) {
                html += `<option value="${b}" disabled style="color:var(--accent-red);opacity:0.6">${b} — محجوز لـ: ${manager}</option>`;
            } else {
                html += `<option value="${b}">${b}</option>`;
            }
        });
    }
    brEl.innerHTML = html;
}

// ── نقل موظف فرع / مدير فرع إلى فرع آخر ─────────────────────────────────────
let _transferTargetEmpId = null;

function openTransferModal(empId) {
    const emp = employees.find(e => e.empId === empId);
    if (!emp) return;
    _transferTargetEmpId = empId;

    document.getElementById('transferEmpName').textContent = `${emp.name} — ${emp.title}`;
    const cur = emp.assignedBranch
        ? `${emp.assignedBranch.branch} (${emp.assignedBranch.city})`
        : 'غير محدد';
    document.getElementById('transferCurrentBranch').textContent = cur;

    // تعبئة المحافظات
    const cityEl = document.getElementById('transferCity');
    cityEl.innerHTML = '<option value="">اختر المحافظة</option>';
    Object.keys(branches).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        cityEl.appendChild(opt);
    });
    document.getElementById('transferBranch').innerHTML = '<option value="">اختر الفرع</option>';
    document.getElementById('transferMsg').textContent = '';
    document.getElementById('transferConflictSection').style.display = 'none';
    document.getElementById('transferConfirmBtn').style.display = 'block';
    document.getElementById('transferModal').classList.remove('hidden');
}

function closeTransferModal() {
    _transferTargetEmpId = null;
    document.getElementById('transferModal').classList.add('hidden');
}

function updateTransferBranches() {
    const city = document.getElementById('transferCity').value;
    const brEl = document.getElementById('transferBranch');
    brEl.innerHTML = '<option value="">اختر الفرع</option>';
    if (city && branches[city]) {
        branches[city].forEach(b => {
            brEl.innerHTML += `<option value="${b}">${b}</option>`;
        });
    }
    _checkTransferConflict();
}

function _checkTransferConflict() {
    const city   = document.getElementById('transferCity').value;
    const branch = document.getElementById('transferBranch').value;
    const msgEl  = document.getElementById('transferMsg');
    const confEl = document.getElementById('transferConflictSection');

    if (!city || !branch) { msgEl.textContent = ''; confEl.style.display = 'none'; return; }

    const emp   = employees.find(e => e.empId === _transferTargetEmpId);
    const other = employees.find(e =>
        e.empId !== _transferTargetEmpId &&
        e.title === 'مدير فرع' &&
        e.assignedBranch?.city === city &&
        e.assignedBranch?.branch === branch
    );

    if (other) {
        msgEl.style.color = 'var(--accent-red)';
        msgEl.textContent = '';
        document.getElementById('transferConflictOtherName').textContent = other.name;
        document.getElementById('transferConflictEmpName').textContent   = emp?.name || '';
        confEl.style.display = 'block';
        document.getElementById('transferConfirmBtn').style.display = 'none';
    } else {
        msgEl.textContent = '';
        confEl.style.display = 'none';
        document.getElementById('transferConfirmBtn').style.display = 'block';
    }
}

function confirmTransfer(action) {
    // action: 'move' | 'swap'
    const city   = document.getElementById('transferCity').value;
    const branch = document.getElementById('transferBranch').value;
    const msgEl  = document.getElementById('transferMsg');
    if (!city || !branch) {
        msgEl.style.color = 'var(--accent-red)';
        msgEl.textContent = 'يرجى اختيار المحافظة والفرع';
        return;
    }

    const emp   = employees.find(e => e.empId === _transferTargetEmpId);
    if (!emp) { closeTransferModal(); return; }

    const other = employees.find(e =>
        e.empId !== _transferTargetEmpId &&
        e.title === 'مدير فرع' &&
        e.assignedBranch?.city === city &&
        e.assignedBranch?.branch === branch
    );

    if (other) {
        if (action === 'swap') {
            // تبديل الفروع
            const empOld = emp.assignedBranch ? { ...emp.assignedBranch } : null;
            other.assignedBranch = empOld;
            emp.assignedBranch   = { city, branch };
        } else {
            // نقل فقط — إخلاء الآخر
            other.assignedBranch = null;
            emp.assignedBranch   = { city, branch };
        }
    } else {
        emp.assignedBranch = { city, branch };
    }

    saveEmployees();
    renderEmployees();
    closeTransferModal();
}
