/* ══════════════════════════════════════════════════════
   SUPER ADMIN PANEL  (v1)
   حصرياً لرقم/أرقام مُحدَّدة في القائمة البيضاء أدناه.
   - Tab A: تجاوز الصلاحيات (Permission Overrides)
   - Tab B: حذف جماعي بالنطاق الزمني (Bulk Delete by Date)
   البيانات مُخزَّنة داخل db.permissionOverrides لتُزامَن مع السيرفر تلقائياً.
   ══════════════════════════════════════════════════════ */

// قائمة بيضاء — تُطابَق ضد empId/phone/phoneNumber/mobile للموظف
const _SA_WHITELIST = ['0785110515'];

function isSuperAdmin() {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    if (currentUser.isAdmin) return true; // الحساب الافتراضي admin
    // ابحث في كل الحقول النصية بـ currentUser — أيّ حقل يطابق الـ whitelist يكفي
    for (const key in currentUser) {
        const v = currentUser[key];
        if (typeof v !== 'string' && typeof v !== 'number') continue;
        const s = String(v).trim();
        if (s && _SA_WHITELIST.indexOf(s) !== -1) return true;
    }
    return false;
}

/* ── معلومات قابلة للتعديل من الواجهة ── */
const _SA_ROLES = [
    { id: 'admin',            label: 'المدير الرئيسي'              },
    { id: 'cc_manager',       label: 'مدير الكول سنتر'             },
    { id: 'cc_employee',      label: 'موظف كول سنتر'               },
    { id: 'control',          label: 'مسؤول قسم السيطرة'           },
    { id: 'control_employee', label: 'مدير قسم السيطرة'            },
    { id: 'control_sub',      label: 'مدير سيطرة (داخلي)'          },
    { id: 'media',            label: 'موظف ميديا'                  }
];

const _SA_TABS = [
    { id: 'tab-h',       label: 'لوحة التحكم'        },
    { id: 'tab-m',       label: 'المنتسيات'          },
    { id: 'tab-i',       label: 'الاستفسارات'        },
    { id: 'tab-o',       label: 'الشكاوى'            },
    { id: 'tab-b',       label: 'فترات الراحة'       },
    { id: 'tab-e',       label: 'الموظفون'           },
    { id: 'tab-s',       label: 'الإحصاءات'          },
    { id: 'tab-f',       label: 'الفروع'             },
    { id: 'tab-p',       label: 'قائمة الأسعار'      },
    { id: 'tab-comp',    label: 'التعويضات'          },
    { id: 'tab-l',       label: 'سجل التدقيق'        },
    { id: 'tab-t',       label: 'سلة المحذوفات'      },
    { id: 'tab-msg-all', label: 'جميع المراسلات'     },
    { id: 'tab-cu',      label: 'العملاء'            },
    { id: 'tab-mn',      label: 'الإشعارات'          }
];

const _SA_PERMS = [
    { id: 'viewPrices',  label: 'رؤية قائمة الأسعار'      },
    { id: 'editPrices',  label: 'تعديل قائمة الأسعار'     },
    { id: 'viewStats',   label: 'رؤية الإحصاءات'          },
    { id: 'viewBreak',   label: 'رؤية فترات الراحة'       },
    { id: 'viewBranches',label: 'رؤية الفروع'             },
    { id: 'viewM',       label: 'رؤية المنتسيات'          },
    { id: 'viewI',       label: 'رؤية الاستفسارات'        },
    { id: 'viewComp',    label: 'رؤية التعويضات'          },
    { id: 'addM',        label: 'إضافة منتسيات'           },
    { id: 'editM',       label: 'تعديل المنتسيات'         },
    { id: 'deliverM',    label: 'تسليم المنتسيات'         },
    { id: 'rejectM',     label: 'رفض المنتسيات'           },
    { id: 'deleteM',     label: 'حذف المنتسيات'           },
    { id: 'addI',        label: 'إضافة استفسار'           },
    { id: 'addC',        label: 'إضافة شكوى'              },
    { id: 'editC',       label: 'تعديل شكاوى'             },
    { id: 'approveC',    label: 'موافقة على شكاوى'        },
    { id: 'returnC',     label: 'إرجاع شكوى'              },
    { id: 'deleteC',     label: 'حذف شكاوى'               },
    { id: 'auditC',      label: 'تدقيق شكوى'              },
    { id: 'addEmp',      label: 'إضافة موظف'              },
    { id: 'addControlEmp', label: 'إضافة موظف سيطرة'      },
    { id: 'addComp',     label: 'إضافة تعويض'             },
    { id: 'deleteComp',  label: 'حذف تعويض'               }
];

/* ── قراءة/كتابة overrides من db (يُزامَن مع السيرفر) ── */
function _saGetOverrides() {
    if (typeof db === 'undefined' || !db) return {};
    return db.permissionOverrides || {};
}

function _saSaveOverrides(ov) {
    if (typeof db === 'undefined' || !db) return false;
    db.permissionOverrides = ov;
    if (typeof save === 'function') save();
    return true;
}

/* ── تطبيق overrides على الواجهة بعد setProfileUI ── */
function _saApplyOverridesToUI() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    const role = currentUser.isAdmin ? 'admin' : (currentUser.role || 'cc_employee');
    const ov   = _saGetOverrides()[role];
    if (!ov || !ov.tabs) return;
    for (const tabId in ov.tabs) {
        const action = ov.tabs[tabId];
        const el = document.getElementById(tabId);
        if (!el) continue;
        if (action === 'show')      el.classList.remove('hidden');
        else if (action === 'hide') el.classList.add('hidden');
    }
}

/* ── ربط setProfileUI لتطبيق overrides بعد كل تشغيل ── */
(function _saHookSetProfileUI() {
    let installed = false;
    const tryInstall = () => {
        if (installed) return;
        if (typeof window.setProfileUI !== 'function') return;
        const orig = window.setProfileUI;
        window.setProfileUI = function() {
            const r = orig.apply(this, arguments);
            try { _saApplyOverridesToUI(); } catch (e) { console.warn('[superAdmin] apply UI failed:', e); }
            return r;
        };
        installed = true;
    };
    if (typeof window.setProfileUI === 'function') tryInstall();
    else {
        const t = setInterval(() => { tryInstall(); if (installed) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }
})();

/* ── ربط perm() لإضافة الصلاحيات الإضافية ── */
(function _saHookPerm() {
    let installed = false;
    const tryInstall = () => {
        if (installed) return;
        if (typeof window.perm !== 'function') return;
        const orig = window.perm;
        window.perm = function(p) {
            if (orig.apply(this, arguments)) return true;
            if (typeof currentUser === 'undefined' || !currentUser) return false;
            const role = currentUser.isAdmin ? 'admin' : (currentUser.role || 'cc_employee');
            const ov   = _saGetOverrides()[role];
            return !!(ov && ov.perms && ov.perms.indexOf(p) !== -1);
        };
        installed = true;
    };
    if (typeof window.perm === 'function') tryInstall();
    else {
        const t = setInterval(() => { tryInstall(); if (installed) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }
})();

/* ══════════════════════════════════════════════════════
   UI — Modal بـ tabs
   ══════════════════════════════════════════════════════ */
let _saActiveTab = 'perms';

function showSuperAdminModal() {
    closeSuperAdminModal();
    if (!isSuperAdmin()) {
        alert('صلاحية غير متاحة.');
        return;
    }
    const overlay = document.createElement('div');
    overlay.id = '_saOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100002;display:flex;align-items:center;justify-content:center;font-family:"Cairo";padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeSuperAdminModal(); };

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:18px;width:820px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,0.6);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#4a148c,#1a237e);color:#fff;border-radius:18px 18px 0 0;">
                <h3 style="margin:0;font-size:17px;">🛡️ لوحة السوبر ادمن</h3>
                <button onclick="closeSuperAdminModal()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;">✕</button>
            </div>

            <!-- Tabs -->
            <div style="display:flex;border-bottom:1px solid var(--border);padding:0 12px;gap:4px;">
                <button id="_saTabPerms" onclick="_saSwitchTab('perms')" style="padding:11px 18px;border:none;background:none;color:var(--text-dim);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;border-bottom:3px solid transparent;">🔑 تجاوز الصلاحيات</button>
                <button id="_saTabBulk"  onclick="_saSwitchTab('bulk')"  style="padding:11px 18px;border:none;background:none;color:var(--text-dim);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;border-bottom:3px solid transparent;">🗑️ حذف جماعي بالتاريخ</button>
            </div>

            <!-- Body -->
            <div id="_saBody" style="flex:1;overflow-y:auto;padding:18px 22px;"></div>
        </div>`;
    document.body.appendChild(overlay);
    _saSwitchTab(_saActiveTab);
}

function closeSuperAdminModal() {
    const o = document.getElementById('_saOverlay');
    if (o) o.remove();
}

function _saSwitchTab(tab) {
    _saActiveTab = tab;
    const tabPerms = document.getElementById('_saTabPerms');
    const tabBulk  = document.getElementById('_saTabBulk');
    const body     = document.getElementById('_saBody');
    if (!body) return;
    [tabPerms, tabBulk].forEach(b => { if (b) { b.style.color = 'var(--text-dim)'; b.style.borderBottomColor = 'transparent'; } });
    if (tab === 'perms') {
        if (tabPerms) { tabPerms.style.color = 'var(--text-main)'; tabPerms.style.borderBottomColor = '#7e57c2'; }
        body.innerHTML = _saRenderPermsTab();
    } else {
        if (tabBulk)  { tabBulk.style.color  = 'var(--text-main)'; tabBulk.style.borderBottomColor = '#7e57c2'; }
        body.innerHTML = _saRenderBulkTab();
    }
}

/* ══════════════════════════════════════════════════════
   Tab A — Permission Overrides
   ══════════════════════════════════════════════════════ */
function _saRenderPermsTab() {
    const ov = _saGetOverrides();
    let html = `
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.7;background:rgba(126,87,194,0.1);padding:11px 14px;border-radius:10px;border:1px solid rgba(126,87,194,0.3);">
            <b style="color:var(--text-main);">كيف يعمل:</b><br>
            • <b>التبويبات</b>: "إظهار" يفرض الظهور حتى لو الدور لا يراه افتراضياً، "إخفاء" يفرض الإخفاء حتى لو الدور يراه افتراضياً، "الافتراضي" يترك السلوك الأصلي.<br>
            • <b>الصلاحيات</b>: تُضاف فوق الصلاحيات الأصلية للدور (لا تستطيع إزالة صلاحية أصلية، فقط إضافة).<br>
            • التعديلات تُحفَظ على السيرفر فوراً ويراها كل مستخدم بعد إعادة تسجيل الدخول.
        </div>
    `;

    for (const role of _SA_ROLES) {
        const roleOv = ov[role.id] || {};
        const tabsOv = roleOv.tabs  || {};
        const permsOv= roleOv.perms || [];
        html += `
            <details style="border:1px solid var(--border);border-radius:12px;margin-bottom:10px;background:var(--bg-input);">
                <summary style="padding:11px 14px;cursor:pointer;font-weight:700;color:var(--text-main);font-size:14px;list-style:none;display:flex;align-items:center;justify-content:space-between;">
                    <span>👤 ${role.label} <span style="color:var(--text-dim);font-size:11px;font-weight:400;">(${role.id})</span></span>
                    <span style="font-size:11px;color:#81d4fa;">
                        ${Object.keys(tabsOv).length} تبويب · ${permsOv.length} صلاحية
                    </span>
                </summary>
                <div style="padding:14px;border-top:1px solid var(--border);">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:700;">📂 التبويبات</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;margin-bottom:14px;">
                        ${_SA_TABS.map(t => {
                            const cur = tabsOv[t.id] || 'default';
                            return `
                                <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg-card);border-radius:8px;font-size:12px;">
                                    <span style="flex:1;color:var(--text-main);">${t.label}</span>
                                    <select onchange="_saSetTabOv('${role.id}','${t.id}',this.value)" style="font-size:11px;padding:3px 6px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:6px;font-family:'Cairo';">
                                        <option value="default" ${cur==='default'?'selected':''}>افتراضي</option>
                                        <option value="show"    ${cur==='show'   ?'selected':''}>إظهار</option>
                                        <option value="hide"    ${cur==='hide'   ?'selected':''}>إخفاء</option>
                                    </select>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:700;">🔧 الصلاحيات الإضافية</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:5px;">
                        ${_SA_PERMS.map(p => `
                            <label style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg-card);border-radius:8px;font-size:12px;color:var(--text-main);cursor:pointer;">
                                <input type="checkbox" ${permsOv.indexOf(p.id)!==-1?'checked':''} onchange="_saTogglePerm('${role.id}','${p.id}',this.checked)">
                                <span>${p.label}</span>
                                <span style="color:var(--text-dim);font-size:10px;">${p.id}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </details>
        `;
    }

    html += `
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
            <button onclick="_saResetAllOverrides()" style="padding:9px 14px;border:none;border-radius:10px;background:rgba(211,47,47,0.18);color:#ef9a9a;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">إلغاء كل التجاوزات</button>
        </div>
    `;
    return html;
}

function _saSetTabOv(roleId, tabId, action) {
    const ov = _saGetOverrides();
    if (!ov[roleId]) ov[roleId] = {};
    if (!ov[roleId].tabs) ov[roleId].tabs = {};
    if (action === 'default') delete ov[roleId].tabs[tabId];
    else ov[roleId].tabs[tabId] = action;
    if (Object.keys(ov[roleId].tabs).length === 0) delete ov[roleId].tabs;
    if (Object.keys(ov[roleId]).length === 0) delete ov[roleId];
    _saSaveOverrides(ov);
}

function _saTogglePerm(roleId, permId, on) {
    const ov = _saGetOverrides();
    if (!ov[roleId]) ov[roleId] = {};
    if (!ov[roleId].perms) ov[roleId].perms = [];
    const list = ov[roleId].perms;
    const idx  = list.indexOf(permId);
    if (on && idx === -1) list.push(permId);
    if (!on && idx !== -1) list.splice(idx, 1);
    if (list.length === 0) delete ov[roleId].perms;
    if (Object.keys(ov[roleId]).length === 0) delete ov[roleId];
    _saSaveOverrides(ov);
}

function _saResetAllOverrides() {
    if (!confirm('هل أنت متأكد؟ سيُعاد كل دور إلى صلاحياته الأصلية فقط.')) return;
    _saSaveOverrides({});
    _saSwitchTab('perms');
}

/* ══════════════════════════════════════════════════════
   Tab B — Bulk Delete by Date
   ══════════════════════════════════════════════════════ */
function _saRenderBulkTab() {
    return `
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.7;background:rgba(244,67,54,0.08);padding:11px 14px;border-radius:10px;border:1px solid rgba(244,67,54,0.3);">
            <b style="color:#ef9a9a;">⚠️ تحذير:</b> الحذف <b>soft-delete</b> يعني أن العناصر تذهب لسلة المحذوفات (قابلة للاسترجاع 30 يوماً ثم تُمحى نهائياً تلقائياً).
            استعمل زر <b>"معاينة"</b> دائماً قبل التأكيد.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;cursor:pointer;">
                <input type="checkbox" id="_saBulkType_montasiat" checked>
                <span style="color:var(--text-main);font-weight:700;">المنتسيات</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;cursor:pointer;">
                <input type="checkbox" id="_saBulkType_inquiries">
                <span style="color:var(--text-main);font-weight:700;">الاستفسارات</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;cursor:pointer;">
                <input type="checkbox" id="_saBulkType_complaints">
                <span style="color:var(--text-main);font-weight:700;">الشكاوى</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;cursor:pointer;">
                <input type="checkbox" id="_saBulkOnlyDelivered">
                <span style="color:var(--text-main);">المُسلَّمة فقط</span>
            </label>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
                <label style="font-size:12px;color:var(--text-dim);margin-bottom:4px;display:block;">من تاريخ:</label>
                <input type="date" id="_saBulkFrom" style="width:100%;padding:9px 12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:10px;font-family:'Cairo';">
            </div>
            <div>
                <label style="font-size:12px;color:var(--text-dim);margin-bottom:4px;display:block;">إلى تاريخ:</label>
                <input type="date" id="_saBulkTo" style="width:100%;padding:9px 12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:10px;font-family:'Cairo';">
            </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <button onclick="_saBulkSetRange('today')"     style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-size:12px;">اليوم</button>
            <button onclick="_saBulkSetRange('yesterday')" style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-size:12px;">أمس</button>
            <button onclick="_saBulkSetRange('week')"      style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-size:12px;">آخر 7 أيام</button>
            <button onclick="_saBulkSetRange('month')"     style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-size:12px;">آخر 30 يوم</button>
            <button onclick="_saBulkSetRange('year')"      style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:'Cairo';font-size:12px;">آخر سنة</button>
            <button onclick="_saBulkSetRange('all')"       style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:rgba(255,152,0,0.15);color:#ffb74d;cursor:pointer;font-family:'Cairo';font-size:12px;">كل البيانات</button>
        </div>

        <div id="_saBulkPreview" style="background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;font-size:13px;color:var(--text-dim);">
            اضغط "معاينة" لرؤية عدد العناصر قبل الحذف.
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="_saBulkPreview()" style="padding:10px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">🔍 معاينة</button>
            <button onclick="_saBulkDelete()"  style="padding:10px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#c62828,#b71c1c);color:#fff;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;">🗑️ حذف الآن</button>
        </div>
    `;
}

function _saBulkSetRange(preset) {
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0,10);
    const from = document.getElementById('_saBulkFrom');
    const to   = document.getElementById('_saBulkTo');
    if (!from || !to) return;
    if (preset === 'today')      { from.value = fmt(now); to.value = fmt(now); }
    if (preset === 'yesterday')  { const y = new Date(now); y.setDate(y.getDate()-1); from.value = fmt(y); to.value = fmt(y); }
    if (preset === 'week')       { const s = new Date(now); s.setDate(s.getDate()-6); from.value = fmt(s); to.value = fmt(now); }
    if (preset === 'month')      { const s = new Date(now); s.setDate(s.getDate()-29); from.value = fmt(s); to.value = fmt(now); }
    if (preset === 'year')       { const s = new Date(now); s.setFullYear(s.getFullYear()-1); from.value = fmt(s); to.value = fmt(now); }
    if (preset === 'all')        { from.value = ''; to.value = ''; }
}

function _saBulkCollect() {
    const types = [];
    if (document.getElementById('_saBulkType_montasiat')?.checked)  types.push('montasiat');
    if (document.getElementById('_saBulkType_inquiries')?.checked)  types.push('inquiries');
    if (document.getElementById('_saBulkType_complaints')?.checked) types.push('complaints');
    const fromVal = document.getElementById('_saBulkFrom')?.value || '';
    const toVal   = document.getElementById('_saBulkTo')?.value   || '';
    const onlyDelivered = !!document.getElementById('_saBulkOnlyDelivered')?.checked;
    return { types, fromVal, toVal, onlyDelivered };
}

function _saItemDateMs(item) {
    // يجرّب عدة أسماء حقول للتاريخ ويُرجع timestamp ms أو null
    const cands = [item.date, item.createdAt, item.createdAtTs, item.iso, item.dateIso, item.ts];
    for (const c of cands) {
        if (c == null) continue;
        if (typeof c === 'number') return c;
        const d = new Date(c);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    return null;
}

function _saMatchItem(item, fromMs, toMs, onlyDelivered) {
    if (item.deleted) return false; // لا نعيد حذف المحذوف
    if (onlyDelivered && item.status !== 'delivered' && !item.delivered) return false;
    if (fromMs == null && toMs == null) return true;
    const ts = _saItemDateMs(item);
    if (ts == null) return false; // لا تاريخ → استبعاد للأمان
    if (fromMs != null && ts < fromMs) return false;
    if (toMs   != null && ts > toMs)   return false;
    return true;
}

function _saBulkPreview() {
    const { types, fromVal, toVal, onlyDelivered } = _saBulkCollect();
    if (types.length === 0) {
        document.getElementById('_saBulkPreview').innerHTML = '<span style="color:#ef9a9a;">⚠️ اختر نوعاً واحداً على الأقل.</span>';
        return;
    }
    const fromMs = fromVal ? new Date(fromVal + 'T00:00:00').getTime() : null;
    const toMs   = toVal   ? new Date(toVal   + 'T23:59:59').getTime() : null;
    let html = '';
    let total = 0;
    for (const t of types) {
        const arr = (typeof db !== 'undefined' && db && Array.isArray(db[t])) ? db[t] : [];
        const matches = arr.filter(it => _saMatchItem(it, fromMs, toMs, onlyDelivered));
        total += matches.length;
        const label = t === 'montasiat' ? 'منتسيات' : (t === 'inquiries' ? 'استفسارات' : 'شكاوى');
        html += `<div>📌 ${label}: <b style="color:var(--text-main);">${matches.length}</b> من أصل ${arr.length}</div>`;
    }
    const rangeStr = (fromVal || toVal) ? `${fromVal || '∞'} → ${toVal || '∞'}` : 'الكل';
    html = `<div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">النطاق: ${rangeStr} ${onlyDelivered?'· المُسلَّمة فقط':''}</div>${html}<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-weight:700;color:#ffb74d;">المجموع: ${total} عنصر سيُحذَف (soft-delete)</div>`;
    document.getElementById('_saBulkPreview').innerHTML = html;
}

function _saBulkDelete() {
    const { types, fromVal, toVal, onlyDelivered } = _saBulkCollect();
    if (types.length === 0) { alert('اختر نوعاً واحداً على الأقل.'); return; }
    if (typeof db === 'undefined' || !db) { alert('قاعدة البيانات غير محمّلة.'); return; }

    const fromMs = fromVal ? new Date(fromVal + 'T00:00:00').getTime() : null;
    const toMs   = toVal   ? new Date(toVal   + 'T23:59:59').getTime() : null;

    let total = 0;
    const counts = {};
    for (const t of types) {
        const arr = Array.isArray(db[t]) ? db[t] : [];
        counts[t] = arr.filter(it => _saMatchItem(it, fromMs, toMs, onlyDelivered)).length;
        total += counts[t];
    }
    if (total === 0) { alert('لا توجد عناصر مطابقة للنطاق المحدّد.'); return; }

    const labels = { montasiat: 'منتسيات', inquiries: 'استفسارات', complaints: 'شكاوى' };
    const breakdown = types.map(t => `• ${labels[t]}: ${counts[t]}`).join('\n');
    const typed = prompt(
        `سيُحذَف ${total} عنصر (soft-delete، قابل للاسترجاع 30 يوماً):\n\n${breakdown}\n\n` +
        'اكتب كلمة "حذف" بالضبط للتأكيد:'
    );
    if (typed !== 'حذف') { alert('أُلغي الحذف.'); return; }

    const nowTs = Date.now();
    const byEmp = (typeof currentUser !== 'undefined' && currentUser && currentUser.empId) ? currentUser.empId : 'super-admin';
    let actuallyDeleted = 0;
    for (const t of types) {
        const arr = Array.isArray(db[t]) ? db[t] : [];
        for (const it of arr) {
            if (_saMatchItem(it, fromMs, toMs, onlyDelivered)) {
                it.deleted     = true;
                it.deletedAtTs = nowTs;
                it.deletedBy   = byEmp;
                actuallyDeleted++;
            }
        }
    }

    // log في الـ audit إن وُجد
    if (typeof _logAudit === 'function') {
        try { _logAudit('bulk-delete', `${types.join(',')}`, `${actuallyDeleted} عنصر · ${fromVal || '∞'}→${toVal || '∞'}`); } catch {}
    }

    if (typeof save === 'function') save();
    alert(`✓ تمّ حذف ${actuallyDeleted} عنصر (soft-delete). يمكنك استرجاعها من سلة المحذوفات.`);
    _saBulkPreview();
}

/* ══════════════════════════════════════════════════════
   حقن الزر العائم للسوبر ادمن
   ══════════════════════════════════════════════════════ */
(function _saInjectButton() {
    function tryInject() {
        if (!isSuperAdmin()) return;
        if (document.getElementById('_saFloatBtn')) return;
        const btn = document.createElement('button');
        btn.id = '_saFloatBtn';
        btn.title = 'لوحة السوبر ادمن';
        btn.innerText = '🛡️';
        btn.style.cssText = 'position:fixed;bottom:74px;left:18px;z-index:9998;width:46px;height:46px;border-radius:50%;border:1px solid #7e57c2;background:linear-gradient(135deg,#4a148c,#1a237e);color:#fff;cursor:pointer;font-size:20px;box-shadow:0 4px 14px rgba(74,20,140,0.55);transition:transform 0.18s;';
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.08)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = showSuperAdminModal;
        document.body.appendChild(btn);
    }
    const t = setInterval(() => {
        tryInject();
        if (document.getElementById('_saFloatBtn')) clearInterval(t);
    }, 1000);
    setTimeout(() => clearInterval(t), 120000);
})();
