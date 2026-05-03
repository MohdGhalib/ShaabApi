/* ══════════════════════════════════════════════════════
   PAGES — HTML templates for each tab
   (avoids fetch so the app works via file://)
══════════════════════════════════════════════════════ */
const PAGES = {

m: `
<div class="card" id="addMontasiaCard">
    <h3>تسجيل منتسية جديدة</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin-bottom:15px;">
        <select id="mCountryAdd" onchange="updateCities('mCountryAdd','mCityAdd','mBranchAdd')"></select>
        <select id="mCityAdd" onchange="updateBranches('mCityAdd','mBranchAdd')"></select>
        <select id="mBranchAdd"></select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
        <select id="mType">
            <option value="">-- نوع المنتسية --</option>
            <option value="نقدي">نقدي</option>
            <option value="أخرى">أخرى</option>
        </select>
        <input id="mBranchEmp" type="text" placeholder="اسم موظف الفرع *">
    </div>
    <textarea id="mNotes" placeholder="تفاصيل المنتسية..." rows="3"></textarea>
    <button class="btn btn-main" style="margin-top:15px" onclick="addMontasia()">حفظ البيانات</button>
</div>
<div class="search-bar search-bar-m">
    <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
    <div><label>الدولة</label><select id="searchCountryM" onchange="updateCities('searchCountryM','searchCityM','searchBranchM');filterTable();"></select></div>
    <div><label data-region-label-for="searchCityM">المحافظة</label><select id="searchCityM" onchange="updateBranches('searchCityM','searchBranchM');filterTable();"></select></div>
    <div><label>الفرع</label><select id="searchBranchM" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>التاريخ</label><div class="date-picker-wrap" onclick="openDatePicker('searchDateM')"><span class="date-display" id="searchDateM-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateM"></div></div>
    <div><label>بحث بالنص</label><input type="text" id="searchTextM" placeholder="بحث في التفاصيل..." oninput="filterTable()"></div>
    <div><label>موظف الاستلام</label><select id="searchAddedByM" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>موظف التسليم</label><select id="searchDeliveredByM" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>نوع المنتسية</label><select id="searchTypeM" onchange="filterTable()"><option value="">الكل</option><option value="نقدي">نقدي</option><option value="أخرى">أخرى</option></select></div>
    <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('M')">تفريغ</button>
</div>
<div id="mExportImportBar" style="display:none;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button onclick="exportMontasiat()"
            style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,rgba(46,125,50,0.15),rgba(46,125,50,0.08));
                   border:1px solid rgba(46,125,50,0.4);border-radius:10px;padding:9px 18px;cursor:pointer;
                   color:#81c784;font-family:'Cairo';font-size:13px;font-weight:700;">
            ⬇️ تصدير Excel
        </button>
        <label style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,rgba(21,101,192,0.15),rgba(21,101,192,0.08));
                      border:1px solid rgba(21,101,192,0.4);border-radius:10px;padding:9px 18px;cursor:pointer;
                      color:#64b5f6;font-family:'Cairo';font-size:13px;font-weight:700;">
            ⬆️ استيراد Excel
            <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importMontasiat(this)">
        </label>
        <span style="font-size:12px;color:var(--text-dim);">الأعمدة المطلوبة عند الاستيراد: المحافظة، الفرع، التفاصيل</span>
    </div>
</div>
<div class="card">
    <table id="tableM">
        <thead><tr>
            <th style="width:14%">الفرع</th>
            <th style="width:8%">النوع</th>
            <th>التفاصيل</th>
            <th style="width:11%">الحالة</th>
            <th style="width:15%">وقت التبليغ</th>
            <th style="width:17%">وقت التسليم</th>
            <th style="width:13%">إجراء</th>
        </tr></thead>
        <tbody></tbody>
    </table>
    <div id="paginationM"></div>
</div>`,

o: `
<div class="card">
    <h3>📂 الطلبات - لم يتم التسليم</h3>
    <div class="search-bar search-bar-o" style="margin-bottom:20px;">
        <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
        <div><label>الدولة</label><select id="searchCountryO" onchange="updateCities('searchCountryO','searchCityO','searchBranchO');filterTable();"></select></div>
        <div><label data-region-label-for="searchCityO">المحافظة</label><select id="searchCityO" onchange="updateBranches('searchCityO','searchBranchO');filterTable();"></select></div>
        <div><label>الفرع</label><select id="searchBranchO" onchange="filterTable()"><option value="">الكل</option></select></div>
        <div><label>التاريخ</label><div class="date-picker-wrap" onclick="openDatePicker('searchDateO')"><span class="date-display" id="searchDateO-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateO"></div></div>
        <div><label>بحث بالنص</label><input type="text" id="searchTextO" placeholder="بحث في التفاصيل..." oninput="filterTable()"></div>
        <div><label>موظف الاستلام</label><select id="searchAddedByO" onchange="filterTable()"><option value="">الكل</option></select></div>
        <div><label>نوع المنتسية</label><select id="searchTypeO" onchange="filterTable()"><option value="">الكل</option><option value="نقدي">نقدي</option><option value="أخرى">أخرى</option></select></div>
        <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('O')">تفريغ</button>
    </div>
    <table id="tableO">
        <thead><tr>
            <th style="width:18%">الفرع</th>
            <th>التفاصيل</th>
            <th style="width:13%">أضافه</th>
            <th style="width:18%">وقت الطلب</th>
            <th style="width:14%">إجراء</th>
        </tr></thead>
        <tbody></tbody>
    </table>
    <div id="paginationO"></div>
</div>`,

i: `
<div class="card" id="addInquiryCard">
    <h3>تسجيل استفسار عميل</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
        <input type="text" id="iPhone" placeholder="رقم الهاتف">
        <select id="iCountryAdd" onchange="updateCities('iCountryAdd','iCityAdd','iBranchAdd');toggleUnspecifiedBranch()"></select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
        <select id="iCityAdd" onchange="updateBranches('iCityAdd','iBranchAdd');toggleUnspecifiedBranch()"></select>
        <select id="iBranchAdd"></select>
    </div>
    <div style="margin-bottom:15px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">نوع الاستفسار</label>
        <select id="iType" onchange="toggleInquiryNotes();toggleUnspecifiedBranch()">
            <option value="">اختر نوع الاستفسار</option>
            <option value="شكوى">شكوى</option>
            <option value="استفسار عن توفر منتج">استفسار عن توفر منتج</option>
            <option value="استفسار عن سعر منتج">استفسار عن سعر منتج</option>
            <option value="توظيف">توظيف</option>
            <option value="طلبية">طلبية</option>
            <option value="تحويل لمولات او بوابة الشعب">تحويل لمولات او بوابة الشعب</option>
            <option value="أخرى">أخرى</option>
        </select>
    </div>
    <div id="iNotesBox" style="display:none;margin-bottom:15px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">التفاصيل</label>
        <textarea id="iNotes" placeholder="اكتب التفاصيل هنا..." rows="3"></textarea>
    </div>
    <button class="btn btn-main" style="margin-top:5px" onclick="addInquiry()">حفظ الاستفسار</button>
</div>
<div class="search-bar search-bar-i">
    <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
    <div><label>الدولة</label><select id="searchCountryI" onchange="updateCities('searchCountryI','searchCityI','searchBranchI');filterTable();"></select></div>
    <div><label data-region-label-for="searchCityI">المحافظة</label><select id="searchCityI" onchange="updateBranches('searchCityI','searchBranchI');filterTable();"></select></div>
    <div><label>الفرع</label><select id="searchBranchI" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>التاريخ</label><div class="date-picker-wrap" onclick="openDatePicker('searchDateI')"><span class="date-display" id="searchDateI-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateI"></div></div>
    <div><label>نوع الاستفسار</label>
        <select id="searchTypeI" onchange="filterTable()">
            <option value="">الكل</option>
            <option value="شكوى">شكوى</option>
            <option value="استفسار عن توفر منتج">استفسار عن توفر منتج</option>
            <option value="استفسار عن سعر منتج">استفسار عن سعر منتج</option>
            <option value="توظيف">توظيف</option>
            <option value="طلبية">طلبية</option>
            <option value="تحويل لمولات او بوابة الشعب">تحويل لمولات او بوابة الشعب</option>
            <option value="أخرى">أخرى</option>
        </select>
    </div>
    <div><label>موظف الاستفسار</label><select id="searchAddedByI" onchange="filterTable()"><option value="">الكل</option></select></div>
    <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('I')">تفريغ</button>
</div>
<div class="card">
    <table id="tableI">
        <thead><tr>
            <th style="width:6%">#</th>
            <th style="width:14%">الفرع</th>
            <th style="width:14%">الهاتف</th>
            <th>الموضوع</th>
            <th style="width:12%">أضافه</th>
            <th style="width:16%">الوقت</th>
        </tr></thead>
        <tbody></tbody>
    </table>
    <div id="paginationI"></div>
</div>`,

c: `
<div class="card" id="addControlCard">
    <h3>تسجيل شكوى سيطرة</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin-bottom:15px;">
        <select id="cCountryAdd" onchange="updateCities('cCountryAdd','cCityAdd','cBranchAdd')"></select>
        <select id="cCityAdd" onchange="updateBranches('cCityAdd','cBranchAdd')"></select>
        <select id="cBranchAdd"></select>
    </div>
    <div style="background:rgba(25,118,210,0.07);border:1px solid rgba(25,118,210,0.2);border-radius:14px;padding:16px;margin-bottom:15px;">
        <div style="font-size:13px;color:#64b5f6;font-weight:700;margin-bottom:10px;">👤 معلومات الزبون (اختياري)</div>
        <input type="text" id="cCustomerPhone" placeholder="رقم الهاتف">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">🕐 وقت تلقي الاتصال</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
                <div class="date-picker-wrap" onclick="openDatePicker('cCallDate')">
                    <span class="date-display" id="cCallDate-display">📅 اختر التاريخ</span>
                    <input type="hidden" id="cCallDate">
                </div>
                <input type="time" id="cCallTimeOnly" style="width:115px;">
            </div>
        </div>
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">📅 تاريخ الملاحظة</label>
            <div class="date-picker-wrap" onclick="openDatePicker('cNoteDate')">
                <span class="date-display" id="cNoteDate-display">📅 اختر التاريخ</span>
                <input type="hidden" id="cNoteDate">
            </div>
        </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">🔢 رقم الحركة</label>
            <input type="text" id="cMoveNumber" placeholder="رقم الحركة">
        </div>
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">💰 قيمة الفاتورة</label>
            <input type="text" id="cInvoiceValue" placeholder="قيمة الفاتورة">
        </div>
    </div>
    <div id="cLinkedInquiryRow" style="margin-bottom:15px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">🔗 ربط بشكوى في الاستفسارات (اختياري)</label>
        <select id="cLinkedInquiry" style="width:100%;" onchange="onLinkedInquiryChange()">
            <option value="">— بدون ربط —</option>
        </select>
        <div id="linkedInqPreview" style="display:none;margin-top:8px;padding:10px 14px;background:rgba(156,39,176,0.1);border:1px solid rgba(156,39,176,0.3);border-radius:10px;font-size:12px;color:#ce93d8;">
            🔗 <span id="linkedInqPreviewText"></span>
        </div>
    </div>
    <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:6px;">المرفقات (صور أو ملفات):</label>
    <input type="file" id="cFile" style="display:none;" onchange="(function(i){var d=document.getElementById('cFileLabel');if(d)d.textContent=i.files[0]?i.files[0].name:'لم يُختر ملف';})(this)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
        <button type="button" class="btn" style="padding:7px 16px;font-size:13px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:10px;cursor:pointer;white-space:nowrap;" onclick="document.getElementById('cFile').click()">📎 اختر ملف</button>
        <span id="cFileLabel" style="font-size:13px;color:var(--text-dim);">لم يُختر ملف</span>
    </div>
    <textarea id="cNotes" placeholder="نص الملاحظة الواردة من السيطرة..." rows="3"></textarea>
    <div style="margin-top:16px;">
        <label style="font-size:12px;font-weight:700;color:var(--text-dim);letter-spacing:0.5px;display:block;margin-bottom:10px;">🏷️ نوع الشكوى</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label for="cTypeOther" style="cursor:pointer;position:relative;">
                <input type="radio" name="cComplaintType" id="cTypeOther" value="أخرى" checked
                    style="position:absolute;opacity:0;width:0;height:0;"
                    onchange="document.getElementById('cTypeLabelOther').setAttribute('data-checked','1');document.getElementById('cTypeLabelFin').removeAttribute('data-checked');">
                <div id="cTypeLabelOther" data-checked="1"
                    style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border-radius:14px;border:2px solid rgba(100,181,246,0.5);background:rgba(100,181,246,0.1);transition:all 0.2s;user-select:none;"
                    onclick="document.getElementById('cTypeOther').checked=true;this.setAttribute('data-checked','1');document.getElementById('cTypeLabelFin').removeAttribute('data-checked');">
                    <span id="checkOther" style="position:absolute;top:7px;left:9px;width:28px;height:28px;background:#fff;border-radius:6px;display:none;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.15);"><span style="font-size:22px;font-weight:900;color:#2e7d32;line-height:1;">✓</span></span>
                    <span style="font-size:22px;">📋</span>
                    <span style="font-weight:800;font-size:14px;color:#90caf9;">أخرى</span>
                    <span style="font-size:10px;color:var(--text-dim);">شكوى عامة</span>
                </div>
            </label>
            <label for="cTypeFinancial" style="cursor:pointer;position:relative;">
                <input type="radio" name="cComplaintType" id="cTypeFinancial" value="مالية"
                    style="position:absolute;opacity:0;width:0;height:0;"
                    onchange="document.getElementById('cTypeLabelFin').setAttribute('data-checked','1');document.getElementById('cTypeLabelOther').removeAttribute('data-checked');">
                <div id="cTypeLabelFin"
                    style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border-radius:14px;border:2px solid rgba(198,40,40,0.3);background:rgba(198,40,40,0.06);transition:all 0.2s;user-select:none;"
                    onclick="document.getElementById('cTypeFinancial').checked=true;this.setAttribute('data-checked','1');document.getElementById('cTypeLabelOther').removeAttribute('data-checked');">
                    <span id="checkFin" style="position:absolute;top:7px;left:9px;width:28px;height:28px;background:#fff;border-radius:6px;display:none;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.15);"><span style="font-size:22px;font-weight:900;color:#2e7d32;line-height:1;">✓</span></span>
                    <span style="font-size:22px;">💰</span>
                    <span style="font-weight:800;font-size:14px;color:#ef9a9a;">مالية</span>
                    <span style="font-size:10px;color:var(--text-dim);">تستوجب تعويض</span>
                </div>
            </label>
        </div>
        <style>
            #cTypeLabelOther[data-checked] { border-color:#42a5f5 !important; background:rgba(66,165,245,0.18) !important; box-shadow:0 0 0 3px rgba(66,165,245,0.15); }
            #cTypeLabelFin[data-checked]   { border-color:#ef5350 !important; background:rgba(239,83,80,0.18)  !important; box-shadow:0 0 0 3px rgba(239,83,80,0.15);  }
            #cTypeLabelOther[data-checked] #checkOther { display:flex !important; }
            #cTypeLabelFin[data-checked]   #checkFin   { display:flex !important; }
        </style>
    </div>
    <button class="btn btn-main" style="margin-top:15px" onclick="addControl()">إرسال الشكوى</button>
</div>
<div class="search-bar search-bar-c">
    <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
    <div><label>الدولة</label><select id="searchCountryC" onchange="updateCities('searchCountryC','searchCityC','searchBranchC');filterTable();"></select></div>
    <div><label data-region-label-for="searchCityC">المحافظة</label><select id="searchCityC" onchange="updateBranches('searchCityC','searchBranchC');filterTable();"></select></div>
    <div><label>الفرع</label><select id="searchBranchC" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>التاريخ</label><div class="date-picker-wrap" onclick="openDatePicker('searchDateC')"><span class="date-display" id="searchDateC-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateC"></div></div>
    <div><label>نص الشكوى</label><input type="text" id="searchTextC" placeholder="بحث..." oninput="filterTable()"></div>
    <div><label>نوع الشكوى</label><select id="searchTypeC" onchange="filterTable()"><option value="">الكل</option><option value="مالية">💰 مالية</option><option value="أخرى">أخرى</option></select></div>
    <div><label>الحالة المالية</label><select id="searchFinStatusC" onchange="filterTable()"><option value="">الكل</option><option value="مفتوحة">🔴 مفتوحة (غير محجوزة)</option><option value="مغلقة">🟢 مغلقة (محجوزة)</option></select></div>
    <div><label>اسم الموظف</label><select id="searchAddedByC" onchange="filterTable()"><option value="">الكل</option></select></div>
    <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('C')">تفريغ</button>
</div>
<div class="card">
    <table id="tableC">
        <thead><tr>
            <th style="width:14%">الفرع</th>
            <th>الشكوى والمرفق</th>
            <th style="width:12%">الموظف</th>
            <th style="width:16%">وقت الإرسال</th>
            <th style="width:16%">إجراء المدير</th>
        </tr></thead>
        <tbody></tbody>
    </table>
    <div id="paginationC"></div>
</div>`,

b: `
<div class="card">
    <h3>☕ استراحة / اجتماع</h3>
    <p style="color:var(--text-dim);font-size:13px;margin-top:-10px;">اختر نوع الغياب لبدء تسجيل الوقت</p>
    <div class="break-grid">
        <div class="break-btn-card" onclick="startBreak('استراحة')"><span class="break-icon">☕</span>استراحة</div>
        <div class="break-btn-card" onclick="startBreak('اجتماع')"><span class="break-icon">🤝</span>اجتماع</div>
    </div>
</div>
<div class="card" id="breakHistoryCard">
    <h3 style="margin-bottom:20px;">سجل الاستراحات اليوم</h3>
    <table id="tableBreak">
        <thead><tr>
            <th style="width:25%">النوع</th>
            <th style="width:30%">وقت البدء</th>
            <th style="width:20%">المدة</th>
            <th style="width:25%">وقت الانتهاء</th>
        </tr></thead>
        <tbody></tbody>
    </table>
</div>`,

e: `
<div class="card">
    <h3>👤 إضافة موظف جديد</h3>
    <p style="color:var(--text-dim);font-size:13px;margin-top:-10px;">الرقم الوظيفي يُستخدم كباسوورد دخول للنظام</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin-bottom:15px;">
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">الاسم الكامل</label>
            <input type="text" id="eName" placeholder="اسم الموظف">
        </div>
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">المسمى الوظيفي</label>
            <select id="eTitle" onchange="onEmployeeTitleChange()">
                <option value="">اختر المسمى الوظيفي</option>
                <option value="مدير الكول سنتر">مدير الكول سنتر</option>
                <option value="موظف كول سنتر">موظف كول سنتر</option>
                <option value="موظف ميديا">موظف ميديا</option>
                <option value="مدير قسم السيطرة">مدير قسم السيطرة</option>
                <option value="موظف فرع">موظف فرع</option>
                <option value="مدير فرع">مدير فرع</option>
                <option value="مدير منطقة">مدير منطقة</option>
            </select>
        </div>
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">الرقم الوظيفي (باسوورد الدخول)</label>
            <input type="text" id="eId" placeholder="مثال: 1234">
        </div>
    </div>
    <!-- اختيار الفرع: موظف فرع / مدير فرع (فرع واحد) -->
    <div id="eSingleBranchSection" style="display:none;margin-top:12px;padding:14px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border);">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:8px;">📍 الفرع المسؤول عنه / التابع له</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <select id="eBranchCity" onchange="updateBranches('eBranchCity','eBranchName')">
                <option value="">المحافظة</option>
            </select>
            <select id="eBranchName"><option value="">الفرع</option></select>
        </div>
    </div>
    <!-- اختيار الأفرع: مدير منطقة (متعدد) -->
    <div id="eMultiBranchSection" style="display:none;margin-top:14px;padding:16px;background:rgba(255,255,255,0.03);border-radius:14px;border:1px solid rgba(255,255,255,0.09);">
        <label style="font-size:13px;color:var(--text-dim);display:flex;align-items:center;gap:8px;margin-bottom:12px;font-weight:700;">📍 الأفرع المسؤول عنها (يمكن تحديد أكثر من فرع)</label>
        <div id="eMultiBranchList"></div>
    </div>
    <div style="margin-top:15px;">
        <button class="btn btn-main" onclick="addEmployee()">➕ إضافة الموظف</button>
    </div>
</div>
<div class="card">
    <h3 style="margin-bottom:20px;">قائمة الموظفين المسجلين</h3>
    <table id="tableE">
        <thead><tr>
            <th style="width:5%">#</th>
            <th style="width:30%">الاسم الكامل</th>
            <th style="width:30%">المسمى الوظيفي</th>
            <th style="width:20%">الرقم الوظيفي</th>
            <th style="width:15%">حذف</th>
        </tr></thead>
        <tbody></tbody>
    </table>
</div>`,

f: `
<div class="card">
    <h3>🏪 تقييم الفروع</h3>
    <div class="search-bar" style="grid-template-columns:1fr 1fr 1fr auto;margin-bottom:24px;">
        <div>
            <label>المحافظة</label>
            <select id="branchCitySearch" onchange="updateBranches('branchCitySearch','branchBranchSearch');renderBranches();"></select>
        </div>
        <div>
            <label>الفرع</label>
            <select id="branchBranchSearch" onchange="renderBranches()"><option value="">الكل</option></select>
        </div>
        <div>
            <label>📅 تصفية بالتاريخ</label>
            <div class="date-picker-wrap" onclick="calOnSelect=renderBranches;openDatePicker('branchDate')">
                <span class="date-display" id="branchDate-display">📅 الكل</span>
                <input type="hidden" id="branchDate">
            </div>
        </div>
        <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetBranchSearch()">تفريغ</button>
        <button class="btn" style="background:rgba(46,125,50,0.15);color:#81c784;border:1px solid rgba(46,125,50,0.35);align-self:end;" onclick="exportBranchEvaluation()">📸 تصدير</button>
    </div>
    <div id="branchStatsResult"></div>
</div>`,

p: `
<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <h3 style="margin:0;">💰 قائمة الأسعار</h3>
        <input type="text" id="priceSearchInput" placeholder="🔍 ابحث عن صنف..." oninput="filterPrices()"
            style="padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input);
                   color:var(--text-main);font-family:'Cairo';font-size:14px;width:260px;outline:none;">
    </div>
    <div id="priceListContainer"></div>
</div>`,

s: `
<div class="card">
    <h3>📊 إحصائية الموظفين</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">اختر الموظف</label>
            <select id="statEmpSelect" onchange="renderStats()"><option value="">اختر موظفاً</option></select>
        </div>
        <div>
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">اليوم</label>
            <div class="date-picker-wrap" onclick="calOnSelect=renderStats;openDatePicker('statDate')">
                <span class="date-display" id="statDate-display">📅 اختر التاريخ</span>
                <input type="hidden" id="statDate">
            </div>
        </div>
    </div>
    <div id="statsResult"></div>
</div>`,

h: `
<div style="padding:4px 0 20px;">
    <h2 style="margin:0 0 6px;color:var(--accent-red);">🏠 لوحة التحكم</h2>
    <p style="color:var(--text-dim);font-size:13px;margin:0 0 20px;">نظرة عامة على النظام</p>
    <div id="dashboardContainer"></div>
</div>`,

l: `
<div style="padding:4px 0 20px;">
    <h2 style="margin:0 0 6px;color:var(--accent-red);">📋 سجل التدقيق</h2>
    <p style="color:var(--text-dim);font-size:13px;margin:0 0 20px;">سجل العمليات الأخيرة (حذف، استعادة)</p>
    <div id="auditLogContainer"></div>
</div>`,

t: `
<div style="padding:4px 0 20px;">
    <h2 style="margin:0 0 6px;color:var(--accent-red);">🗑️ سلة المحذوفات</h2>
    <p style="color:var(--text-dim);font-size:13px;margin:0 0 20px;">العناصر المحذوفة — تُحذف نهائياً بعد 30 يوماً</p>
    <div id="trashContainer"></div>
</div>`,

comp: `
<div class="card">
    <h3 style="color:#81c784;">💰 تعويض الفروع</h3>
    <p style="color:var(--text-dim);font-size:13px;margin:-10px 0 18px;">تسجيل تعويضات الفروع بناءً على شكاوي السيطرة</p>

    <div id="addCompCard">
        <h4 style="margin:0 0 16px;color:var(--text-main);">➕ تسجيل تعويض جديد</h4>

        <div style="margin-bottom:16px;padding:14px;background:rgba(21,101,192,0.08);border:1px solid rgba(21,101,192,0.25);border-radius:12px;">
            <label style="display:block;margin-bottom:8px;font-size:13px;font-weight:700;color:#64b5f6;">🔗 ربط بشكوى سيطرة مالية <span style="color:#ef5350;font-size:11px;">(إجباري)</span></label>
            <select id="compLinkedComplaint" style="width:100%;" onchange="onCompComplaintSelect()"></select>
            <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">عند الاختيار يُملأ الفرع والنص تلقائياً</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">الدولة</label><select id="compCountry" onchange="updateCities('compCountry','compCity','compBranch')"><option value="">اختيار الدولة</option></select></div>
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;" data-region-label-for="compCity">المحافظة</label><select id="compCity" onchange="updateBranches('compCity','compBranch')"><option value="">اختر المحافظة</option></select></div>
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">الفرع</label><select id="compBranch"><option value="">اختر الفرع</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">اسم الموظف</label><input type="text" id="compEmployeeName" placeholder="اسم موظف الفرع"></div>
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">💰 المبلغ المالي (د.أ)</label><input type="number" id="compAmount" placeholder="0.00" min="0" step="0.01"></div>
        </div>
        <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-dim);">الملاحظة</label>
            <textarea id="compNotes" rows="3" placeholder="تفاصيل التعويض..." style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);font-family:Cairo;font-size:14px;resize:vertical;"></textarea>
        </div>
        <div style="margin-bottom:16px;padding:14px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.3);border-radius:12px;">
            <label style="display:flex;align-items:center;gap:7px;margin-bottom:8px;font-size:13px;font-weight:700;color:#fbbf24;">
                ✏️ ملاحظة المسؤول
                <span style="font-size:11px;font-weight:400;color:var(--text-dim);">(قابلة للتعديل دائماً)</span>
            </label>
            <textarea id="compAdminNote" rows="2" placeholder="أضف ملاحظتك هنا..." style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);color:var(--text-main);font-family:Cairo;font-size:14px;resize:vertical;"></textarea>
        </div>
        <button class="btn" style="background:#2e7d32;color:#fff;" onclick="addCompensation()">💾 حفظ التعويض</button>
    </div>

    <hr style="border-color:rgba(255,255,255,0.07);margin:24px 0;">

    <div class="search-bar search-bar-c" style="margin-bottom:16px;">
        <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
        <div><label>الدولة</label><select id="searchCountryComp" onchange="updateCities('searchCountryComp','compSearchCity','compSearchBranch');renderCompensations();"></select></div>
        <div><label data-region-label-for="compSearchCity">المحافظة</label><select id="compSearchCity" onchange="updateBranches('compSearchCity','compSearchBranch');renderCompensations();"></select></div>
        <div><label>الفرع</label><select id="compSearchBranch" onchange="renderCompensations()"><option value="">الكل</option></select></div>
        <div><label>التاريخ</label><div class="date-picker-wrap" onclick="calOnSelect=renderCompensations;openDatePicker('compSearchDate')"><span class="date-display" id="compSearchDate-display">📅 الكل</span><input type="hidden" id="compSearchDate"></div></div>
        <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="document.getElementById('searchCountryComp').value='';if(typeof updateCities==='function')updateCities('searchCountryComp','compSearchCity','compSearchBranch');document.getElementById('compSearchDate').value='';document.getElementById('compSearchDate-display').textContent='📅 الكل';renderCompensations();">تفريغ</button>
    </div>

    <table id="tableComp">
        <thead><tr>
            <th style="width:15%">الفرع</th>
            <th>الملاحظة / الربط</th>
            <th style="width:14%">الموظف</th>
            <th style="width:11%">القيمة</th>
            <th style="width:16%">أضافه / الوقت</th>
            <th style="width:6%"></th>
        </tr></thead>
        <tbody></tbody>
    </table>
</div>`,

mn: `
<div class="card">
    <h3 style="color:#ce93d8;">📝 ملاحظات الزبائن</h3>
    <p style="color:var(--text-dim);font-size:13px;margin:-10px 0 18px;">تسجيل شكاوي الزبائن وربطها بنظام السيطرة</p>

    <div id="addMnCard">
        <h4 style="margin:0 0 14px;color:var(--text-main);">➕ تسجيل ملاحظة جديدة</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">المحافظة</label><select id="mnCity" onchange="updateBranches('mnCity','mnBranch')"><option value="">اختر المحافظة</option></select></div>
            <div><label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">الفرع</label><select id="mnBranch"><option value="">اختر الفرع</option></select></div>
        </div>
        <div style="margin-bottom:14px;">
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">رقم هاتف الزبون</label>
            <input type="text" id="mnPhone" placeholder="07xxxxxxxx">
        </div>
        <div style="margin-bottom:16px;">
            <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">نص الملاحظة / الشكوى</label>
            <textarea id="mnNotes" rows="3" placeholder="اكتب تفاصيل شكوى الزبون..." style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);font-family:Cairo;font-size:14px;resize:vertical;"></textarea>
        </div>
        <button class="btn" style="background:#7b1fa2;color:#fff;" onclick="addMediaNote()">💾 حفظ الملاحظة</button>
    </div>

    <hr style="border-color:rgba(255,255,255,0.07);margin:22px 0;">

    <div class="search-bar search-bar-c" style="margin-bottom:16px;">
        <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
        <div><label>المحافظة</label><select id="mnSearchCity" onchange="updateBranches('mnSearchCity','mnSearchBranch');renderMediaNotes();"></select></div>
        <div><label>الفرع</label><select id="mnSearchBranch" onchange="renderMediaNotes()"><option value="">الكل</option></select></div>
        <div><label>التاريخ</label><div class="date-picker-wrap" onclick="calOnSelect=renderMediaNotes;openDatePicker('mnSearchDate')"><span class="date-display" id="mnSearchDate-display">📅 الكل</span><input type="hidden" id="mnSearchDate"></div></div>
        <div><label>الهاتف / النص</label><input type="text" id="mnSearchText" placeholder="بحث..." oninput="renderMediaNotes()"></div>
        <div><label>الحالة</label><select id="mnSearchStatus" onchange="renderMediaNotes()"><option value="">الكل</option><option value="مرتبطة">🔗 مرتبطة بسيطرة</option><option value="بانتظار">⏳ بانتظار الربط</option></select></div>
        <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="document.getElementById('mnSearchCity').value='';document.getElementById('mnSearchBranch').innerHTML='<option value=\\'\\'>الكل</option>';document.getElementById('mnSearchText').value='';document.getElementById('mnSearchDate').value='';document.getElementById('mnSearchDate-display').textContent='📅 الكل';document.getElementById('mnSearchStatus').value='';renderMediaNotes();">تفريغ</button>
    </div>

    <table id="tableMN">
        <thead><tr>
            <th style="width:6%">#</th>
            <th style="width:16%">الفرع</th>
            <th style="width:14%">الهاتف</th>
            <th>الملاحظة</th>
            <th style="width:14%">الحالة</th>
            <th style="width:16%">الوقت</th>
        </tr></thead>
        <tbody></tbody>
    </table>
</div>`,

cu: `
<div class="card">
    <h3 style="color:var(--accent-red);">🔴 متابعات السيطرة المفتوحة</h3>
    <p style="color:var(--text-dim);font-size:13px;margin:-10px 0 18px;">الشكاوي التي لم يتم الرد عليها من قسم السيطرة بعد</p>
    <div class="search-bar search-bar-c" style="margin-bottom:20px;">
        <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
        <div><label>الدولة</label><select id="searchCountryCU" onchange="updateCities('searchCountryCU','searchCityCU','searchBranchCU');renderControlOpen();"></select></div>
        <div><label data-region-label-for="searchCityCU">المحافظة</label><select id="searchCityCU" onchange="updateBranches('searchCityCU','searchBranchCU');renderControlOpen();"></select></div>
        <div><label>الفرع</label><select id="searchBranchCU" onchange="renderControlOpen()"><option value="">الكل</option></select></div>
        <div><label>التاريخ</label><div class="date-picker-wrap" onclick="calOnSelect=renderControlOpen;openDatePicker('searchDateCU')"><span class="date-display" id="searchDateCU-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateCU"></div></div>
        <div><label>بحث بالنص</label><input type="text" id="searchTextCU" placeholder="بحث في التفاصيل..." oninput="renderControlOpen()"></div>
        <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('CU')">تفريغ</button>
    </div>
    <table id="tableCU">
        <thead><tr>
            <th style="width:18%">الفرع</th>
            <th>التفاصيل والرد</th>
            <th style="width:14%">أضافه</th>
            <th style="width:16%">وقت الطلب</th>
        </tr></thead>
        <tbody></tbody>
    </table>
    <div id="paginationCU"></div>
</div>`

};
