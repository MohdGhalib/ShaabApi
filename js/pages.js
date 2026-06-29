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
        <select id="mType" onchange="toggleMontasiaTypeFields()">
            <option value="">-- نوع المنتسية --</option>
            <option value="نقدي">نقدي</option>
            <option value="اصناف محمص الشعب">🌰 اصناف محمص الشعب</option>
            <option value="أخرى">أخرى</option>
        </select>
        <input id="mBranchEmp" type="text" placeholder="اسم موظف الفرع *">
    </div>
    <div id="mTypeExtraBox" style="display:none;margin-bottom:15px;background:rgba(255,193,7,0.05);border:1px dashed rgba(255,193,7,0.4);border-radius:12px;padding:14px;">
        <div id="mCashFields" style="display:none;">
            <label style="font-size:13px;color:#ffd54f;font-weight:700;display:block;margin-bottom:8px;">💰 القيمة المالية المفقودة *</label>
            <input id="mMissingValue" type="text" inputmode="decimal" placeholder="مثال: 5.5">
        </div>
        <div id="mRoastFields" style="display:none;">
            <label style="font-size:13px;color:#90caf9;font-weight:700;display:block;margin-bottom:8px;">🌰 طريقة التسجيل *</label>
            <div style="display:flex;gap:18px;margin-bottom:12px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main);">
                    <input type="radio" name="mRoastSub" value="وزن" onchange="toggleRoastSubMode()"> ⚖️ وزن
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main);">
                    <input type="radio" name="mRoastSub" value="قيمة" onchange="toggleRoastSubMode()"> 💵 قيمة
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text-main);">
                    <input type="radio" name="mRoastSub" value="وزن وقيمة" onchange="toggleRoastSubMode()"> 🌰 وزن وقيمة
                </label>
            </div>
            <div id="mRoastFreeWrap" style="display:none;">
                <textarea id="mRoastFreeText" rows="3" placeholder="اكتب التفاصيل بحرية (الصنف / الوزن / القيمة / أي ملاحظات)..." style="width:100%;font-size:13px;padding:8px;font-family:'Cairo';box-sizing:border-box;resize:vertical;"></textarea>
            </div>
        </div>
    </div>
    <div id="mMultiFieldsWrap" style="display:none;margin-bottom:15px;background:rgba(76,175,80,0.05);border:1px dashed rgba(76,175,80,0.4);border-radius:12px;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <label style="font-size:13px;color:#a5d6a7;font-weight:700;">📋 الأصناف</label>
            <button type="button" onclick="_addMultiItemRow()" style="background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;border:none;border-radius:10px;padding:7px 14px;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:12px;">+ إضافة صنف</button>
        </div>
        <div id="mMultiItemsList"></div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">يمكنك إضافة عدة أصناف من أنواع مختلفة في منتسية واحدة (مثلاً: قهوة بالوزن + 5د نقدي + علبة شوكولاته).</div>
    </div>
    <div id="mNotesWrap" style="display:none;"><textarea id="mNotes" placeholder="تفاصيل المنتسية..." rows="3"></textarea></div>
    <button class="btn btn-main" style="margin-top:15px" onclick="addMontasia()">حفظ البيانات</button>
</div>
<div class="search-bar search-bar-m">
    <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
    <div><label>الدولة</label><select id="searchCountryM" onchange="updateCities('searchCountryM','searchCityM','searchBranchM');filterTable();"></select></div>
    <div><label data-region-label-for="searchCityM">المحافظة</label><select id="searchCityM" onchange="updateBranches('searchCityM','searchBranchM');filterTable();"></select></div>
    <div><label>الفرع</label><select id="searchBranchM" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>وقت التبليغ</label><div class="date-picker-wrap" onclick="openDatePicker('searchDateM')"><span class="date-display" id="searchDateM-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateM"></div></div>
    <div><label>وقت التسليم</label><div class="date-picker-wrap" onclick="openDatePicker('searchDeliverDateM')"><span class="date-display" id="searchDeliverDateM-display">📅 اختر التاريخ</span><input type="hidden" id="searchDeliverDateM"></div></div>
    <div><label>بحث بالنص</label><input type="text" id="searchTextM" placeholder="بحث في التفاصيل..." oninput="filterTable()"></div>
    <div><label>رقم المنتسية</label><input type="text" id="searchSerialM" placeholder="مثلاً: 26001" oninput="filterTable()" style="font-family:monospace;letter-spacing:1px;"></div>
    <div><label>نوع المنتسية</label><select id="searchTypeM" onchange="filterTable();_toggleRoastSubFilter('M')"><option value="">الكل</option><option value="نقدي">نقدي</option><option value="اصناف محمص الشعب">أصناف محامص الشعب</option><option value="أخرى">أخرى</option><option value="متعدد الأصناف">📋 متعدد الأصناف</option></select></div>
    <div id="searchRoastSubMWrap" style="display:none;"><label>طريقة التسجيل</label><select id="searchRoastSubM" onchange="filterTable()"><option value="">الكل</option><option value="وزن">وزن</option><option value="قيمة">قيمة</option></select></div>
    <div><label>تصفية خاصة</label><select id="searchReservedM" onchange="filterTable()"><option value="">— الكل —</option><option value="1">👤 منتسيات مسجلة لزبائن (غير مسلّمة)</option></select></div>
    <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('M')">تفريغ</button>
    <button class="btn" style="background:linear-gradient(135deg,rgba(21,101,192,0.18),rgba(21,101,192,0.08));border:1px solid rgba(21,101,192,0.5);color:#90caf9;align-self:end;font-weight:700;" onclick="reloadTable(this)" title="إعادة تحميل الجدول من السيرفر">🔄 تحديث</button>
</div>
<div id="mCtrlMgrFilters" class="search-bar search-bar-m" style="display:none;margin-bottom:18px;background:linear-gradient(135deg,rgba(106,27,154,0.10),rgba(21,101,192,0.06));border:1px dashed rgba(156,39,176,0.40);">
    <div style="grid-column:1/-1;" class="search-section-title">🛡️ فلاتر مدير قسم السيطرة</div>
    <div>
        <label>قسم الفرع</label>
        <select id="searchSectionM" onchange="_onSectionChangeM()">
            <option value="">— كل الأقسام —</option>
            <option value="الشرقية">قسم الشرقية</option>
            <option value="الجنوبية">قسم الجنوبية</option>
            <option value="الغربية">قسم الغربية</option>
            <option value="المحافظات">قسم المحافظات</option>
            <option value="فروع العقبة">قسم فروع العقبة</option>
            <option value="الفروع الدولية">الفروع الدولية</option>
        </select>
    </div>
    <div id="mSectionBranchWrap" style="grid-column:1/-1;display:none;">
        <label style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span>فروع <span id="mSectionBranchTitle" style="color:#ce93d8;font-weight:700;"></span> (تحديد متعدد بـ ✓)</span>
            <span style="font-size:11px;">
                <a href="javascript:void(0)" onclick="_toggleAllSectionBranchesM(true)" style="color:#64b5f6;text-decoration:none;margin-left:10px;">✓ تحديد الكل</a>
                <a href="javascript:void(0)" onclick="_toggleAllSectionBranchesM(false)" style="color:#ef9a9a;text-decoration:none;">✗ إلغاء</a>
            </span>
        </label>
        <div id="mSectionBranchPicker" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;max-height:180px;overflow-y:auto;"></div>
    </div>
</div>
<div id="mExportImportBar" style="display:none;margin-bottom:16px;">
    <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed var(--border);">
        <span style="font-size:12px;color:var(--text-dim);font-weight:700;align-self:center;">⚙️ خيارات التصدير:</span>
        <div style="display:flex;flex-direction:column;gap:3px;">
            <label style="font-size:10px;color:var(--text-dim);">المنطقة</label>
            <select id="exportRegionM" data-no-search style="padding:7px 12px;border-radius:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-main);font-family:'Cairo';font-size:12px;">
                <option value="">كل المناطق</option>
                <option value="الشرقية">الشرقية</option>
                <option value="الجنوبية">الجنوبية</option>
                <option value="الغربية">الغربية</option>
                <option value="المحافظات">المحافظات</option>
                <option value="فروع العقبة">فروع العقبة</option>
                <option value="أخرى">أخرى</option>
            </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
            <label style="font-size:10px;color:var(--text-dim);">حالة التسليم</label>
            <select id="exportStatusM" data-no-search style="padding:7px 12px;border-radius:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-main);font-family:'Cairo';font-size:12px;">
                <option value="">الكل</option>
                <option value="تم التسليم">✅ تم التسليم</option>
                <option value="لم يتم التسليم">⏳ لم يتم التسليم</option>
            </select>
        </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button id="btnExportMontasiat" onclick="exportMontasiat()"
            style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,rgba(46,125,50,0.15),rgba(46,125,50,0.08));
                   border:1px solid rgba(46,125,50,0.4);border-radius:10px;padding:9px 18px;cursor:pointer;
                   color:#81c784;font-family:'Cairo';font-size:13px;font-weight:700;">
            ⬇️ تصدير Excel
        </button>
        <button id="btnExportMontasiatPDF" onclick="exportMontasiatPDF()"
            style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,rgba(198,40,40,0.15),rgba(198,40,40,0.08));
                   border:1px solid rgba(198,40,40,0.4);border-radius:10px;padding:9px 18px;cursor:pointer;
                   color:#ef9a9a;font-family:'Cairo';font-size:13px;font-weight:700;" title="تصدير تقرير منسّق بمقاس A4 قابل للطباعة">
            🖨️ تصدير PDF
        </button>
        <label id="lblImportMontasiat" style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,rgba(21,101,192,0.15),rgba(21,101,192,0.08));
                      border:1px solid rgba(21,101,192,0.4);border-radius:10px;padding:9px 18px;cursor:pointer;
                      color:#64b5f6;font-family:'Cairo';font-size:13px;font-weight:700;">
            ⬆️ استيراد Excel
            <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="importMontasiat(this)">
        </label>
        <span id="hintImportMontasiat" style="font-size:12px;color:var(--text-dim);">الأعمدة المطلوبة عند الاستيراد: المحافظة، الفرع، التفاصيل</span>
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
        <div><label>نوع المنتسية</label><select id="searchTypeO" onchange="filterTable();_toggleRoastSubFilter('O')"><option value="">الكل</option><option value="نقدي">نقدي</option><option value="اصناف محمص الشعب">أصناف محامص الشعب</option><option value="أخرى">أخرى</option></select></div>
        <div id="searchRoastSubOWrap" style="display:none;"><label>طريقة التسجيل</label><select id="searchRoastSubO" onchange="filterTable()"><option value="">الكل</option><option value="وزن">وزن</option><option value="قيمة">قيمة</option></select></div>
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
        <input type="text" id="iPhone" placeholder="رقم الهاتف" oninput="_iLivePhoneSearch(this.value);if(typeof _validatePhoneLive==='function')_validatePhoneLive('iPhone','iPhoneErr')">
        <select id="iCountryAdd" onchange="updateCities('iCountryAdd','iCityAdd','iBranchAdd');toggleUnspecifiedBranch();_updateBranchInfoPanel()"></select>
        <div id="iPhoneErr" style="display:none;grid-column:1;margin-top:-10px;font-size:11.5px;color:#ef5350;font-weight:700;"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
        <select id="iCityAdd" onchange="updateBranches('iCityAdd','iBranchAdd');toggleUnspecifiedBranch();_updateBranchInfoPanel()"></select>
        <select id="iBranchAdd" onchange="_updateBranchInfoPanel()"></select>
    </div>
    <div style="margin-bottom:15px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">نوع الاستفسار</label>
        <select id="iType" onchange="toggleInquiryNotes();toggleUnspecifiedBranch()">
            <option value="">اختر نوع الاستفسار</option>
            <option value="شكوى">شكوى</option>
            <option value="استفسار عن أصناف">استفسار عن أصناف</option>
            <option value="استفسار عن منتسيات">استفسار عن منتسيات</option>
            <option value="استفسار عن عروض">استفسار عن عروض</option>
            <option value="موظفين شركات توصيل">موظفين شركات توصيل</option>
            <option value="موظف محامص الشعب">موظف محامص الشعب</option>
            <option value="أوقات الدوام">أوقات الدوام</option>
            <option value="تحويل اقسام داخلي">تحويل اقسام داخلي</option>
            <option value="توظيف وشؤون موظفين">توظيف وشؤون موظفين</option>
            <option value="طلبية">طلبية</option>
            <option value="تحويل لمولات او بوابة الشعب">تحويل لمولات او بوابة الشعب</option>
            <option value="أخرى">أخرى</option>
        </select>
    </div>
    <div id="iComplaintTypeBox" style="display:none;margin-bottom:15px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">🏷️ نوع الشكوى</label>
        <select id="iComplaintType" onchange="toggleComplaintFinancialBox()">
            <option value="">— اختر نوع الشكوى —</option>
            <option value="جودة صنف">جودة صنف</option>
            <option value="مالية">💰 مالية</option>
            <option value="سوء تعامل">سوء تعامل</option>
            <option value="أخرى">🏷️ أخرى</option>
        </select>
    </div>
    <div id="iQualityPhotoBox" style="display:none;margin-bottom:15px;background:rgba(33,150,243,0.05);border:1px dashed rgba(100,181,246,0.35);border-radius:12px;padding:14px;">
        <label style="font-size:13px;color:#90caf9;display:block;margin-bottom:8px;font-weight:700;">📷 صورة الصنف <span style="color:#ce93d8;font-size:10px;font-weight:400;">(اختياري — حد أقصى 5MB)</span></label>
        <input type="file" id="iQualityPhoto" accept="image/*" style="display:none;" onchange="(function(i){var d=document.getElementById('iQualityPhotoLabel');if(d){if(i.files[0]){if(i.files[0].size>5*1024*1024){alert('الصورة أكبر من 5MB — اختر صورة أصغر');i.value='';d.textContent='لم تُختر صورة';d.style.color='var(--text-dim)';}else{d.textContent=i.files[0].name;d.style.color='#81c784';}}else{d.textContent='لم تُختر صورة';d.style.color='var(--text-dim)';}}})(this)">
        <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="btn" style="padding:6px 14px;font-size:12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;white-space:nowrap;" onclick="document.getElementById('iQualityPhoto').click()">📷 اختر صورة</button>
            <span id="iQualityPhotoLabel" style="font-size:12px;color:var(--text-dim);">لم تُختر صورة</span>
        </div>
    </div>
    <div id="iFinancialBox" style="display:none;margin-bottom:15px;background:rgba(198,40,40,0.05);border:1px dashed rgba(239,83,80,0.35);border-radius:12px;padding:14px;">
        <div style="font-size:13px;color:#ef9a9a;font-weight:700;margin-bottom:10px;">💰 بيانات الشكوى المالية</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px;">📅 تاريخ الملاحظة</label>
                <div class="date-picker-wrap" onclick="openDatePicker('iNoteDate')">
                    <span class="date-display" id="iNoteDate-display">📅 اختر التاريخ</span>
                    <input type="hidden" id="iNoteDate">
                </div>
            </div>
            <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px;">🔢 رقم الحركة</label>
                <input type="text" id="iMoveNumber" placeholder="رقم الحركة">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end;">
            <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px;">💰 قيمة الفاتورة</label>
                <input type="text" id="iInvoiceValue" placeholder="قيمة الفاتورة">
            </div>
            <div>
                <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px;">📎 إرفاق فاتورة <span style="color:#ce93d8;font-size:10px;">(اختياري)</span></label>
                <input type="file" id="iFile" style="display:none;" onchange="(function(i){var d=document.getElementById('iFileLabel');if(d)d.textContent=i.files[0]?i.files[0].name:'لم يُختر ملف';})(this)">
                <div style="display:flex;align-items:center;gap:8px;">
                    <button type="button" class="btn" style="padding:6px 14px;font-size:12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;white-space:nowrap;" onclick="document.getElementById('iFile').click()">📎 اختر ملف</button>
                    <span id="iFileLabel" style="font-size:12px;color:var(--text-dim);">لم يُختر ملف</span>
                </div>
            </div>
        </div>
    </div>
    <div id="iVideoBox" style="display:none;margin-bottom:15px;background:rgba(156,39,176,0.05);border:1px dashed rgba(186,104,200,0.35);border-radius:12px;padding:14px;">
        <label style="font-size:13px;color:#ce93d8;display:block;margin-bottom:8px;font-weight:700;">🎥 فيديو</label>
        <input type="file" id="iVideo" accept="video/*" style="display:none;" onchange="(function(i){var d=document.getElementById('iVideoLabel');if(d)d.textContent=i.files[0]?i.files[0].name:'لم يُختر فيديو';})(this)">
        <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="btn" style="padding:6px 14px;font-size:12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:8px;white-space:nowrap;" onclick="document.getElementById('iVideo').click()">🎥 اختر فيديو</button>
            <span id="iVideoLabel" style="font-size:12px;color:var(--text-dim);">لم يُختر فيديو</span>
        </div>
    </div>
    <div id="iItemNameBox" style="display:none;margin-bottom:15px;">
        <label style="font-size:13px;color:#90caf9;font-weight:700;display:block;margin-bottom:5px;">📦 اسم الصنف *</label>
        <input type="text" id="iItemName" placeholder="اكتب اسم الصنف...">
    </div>
    <div id="iMontasiaExistsBox" style="display:none;margin-bottom:15px;background:rgba(33,150,243,0.05);border:1px dashed rgba(100,181,246,0.35);border-radius:12px;padding:14px;">
        <label style="font-size:13px;color:#90caf9;font-weight:700;display:block;margin-bottom:8px;">📦 هل المنتسية موجودة في النظام؟</label>
        <div style="display:flex;gap:14px;align-items:center;font-size:13px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#a5d6a7;font-weight:700;">
                <input type="radio" name="iMontasiaExists" id="iMontasiaExistsYes" value="yes" onchange="_toggleMontasiaSerialBox()" style="accent-color:#2e7d32;cursor:pointer;"> ✓ نعم
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#ef9a9a;font-weight:700;">
                <input type="radio" name="iMontasiaExists" id="iMontasiaExistsNo" value="no" onchange="_toggleMontasiaSerialBox()" style="accent-color:#c62828;cursor:pointer;"> ✗ لا
            </label>
        </div>
        <div id="iMontasiaSerialBox" style="display:none;margin-top:12px;">
            <label style="font-size:12px;color:var(--text-dim);display:block;margin-bottom:5px;">رقم المنتسية (مثلاً 26001)</label>
            <div style="display:flex;gap:8px;align-items:stretch;">
                <input type="text" id="iMontasiaSerial" placeholder="مثلاً: 26001"
                    style="flex:1;font-family:monospace;letter-spacing:1px;"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();_searchMontasiaBySerialFromInquiry();}">
                <button type="button" onclick="_searchMontasiaBySerialFromInquiry()"
                    style="padding:0 16px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;white-space:nowrap;">
                    🔍 بحث
                </button>
            </div>
            <div id="iMontasiaPreview" style="display:none;margin-top:10px;"></div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:6px;">💡 اضغط 🔍 للتحقق من رقم المنتسية وعرض تفاصيلها — سيتم تثبيت فرع المنتسية على الاستفسار تلقائياً.</div>
        </div>
    </div>
    <div id="iNotesBox" style="display:none;margin-bottom:15px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">التفاصيل</label>
        <textarea id="iNotes" placeholder="اكتب التفاصيل هنا..." rows="3"></textarea>
    </div>
    <div style="display:flex;gap:14px;align-items:flex-start;margin-top:5px;flex-wrap:wrap;">
        <button class="btn btn-main" style="flex:0 0 auto;align-self:stretch;" onclick="addInquiry()">حفظ الاستفسار</button>
        <div id="iBranchInfoPanel" style="flex:0 0 33%;display:none;min-width:380px;max-width:100%;margin-inline-start:auto;"></div>
    </div>
</div>
<div class="search-bar search-bar-i">
    <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
    <div><label>الدولة</label><select id="searchCountryI" onchange="updateCities('searchCountryI','searchCityI','searchBranchI');filterTable();"></select></div>
    <div><label data-region-label-for="searchCityI">المحافظة</label><select id="searchCityI" onchange="updateBranches('searchCityI','searchBranchI');filterTable();"></select></div>
    <div><label>الفرع</label><select id="searchBranchI" onchange="filterTable()"><option value="">الكل</option></select></div>
    <div><label>التاريخ</label><div class="date-picker-wrap" onclick="openDatePicker('searchDateI')"><span class="date-display" id="searchDateI-display">📅 اختر التاريخ</span><input type="hidden" id="searchDateI"></div></div>
    <div><label>نوع الاستفسار</label>
        <select id="searchTypeI" onchange="_toggleComplaintTypeFilterI();filterTable()">
            <option value="">الكل</option>
            <option value="شكوى">شكوى</option>
            <option value="استفسار عن أصناف">استفسار عن أصناف</option>
            <option value="استفسار عن منتسيات">استفسار عن منتسيات</option>
            <option value="استفسار عن عروض">استفسار عن عروض</option>
            <option value="موظفين شركات توصيل">موظفين شركات توصيل</option>
            <option value="موظف محامص الشعب">موظف محامص الشعب</option>
            <option value="أوقات الدوام">أوقات الدوام</option>
            <option value="تحويل اقسام داخلي">تحويل اقسام داخلي</option>
            <option value="توظيف وشؤون موظفين">توظيف وشؤون موظفين</option>
            <option value="طلبية">طلبية</option>
            <option value="تحويل لمولات او بوابة الشعب">تحويل لمولات او بوابة الشعب</option>
            <option value="أخرى">أخرى</option>
        </select>
    </div>
    <div id="searchComplaintTypeIWrap" style="display:none;"><label>نوع الشكوى</label>
        <select id="searchComplaintTypeI" onchange="filterTable()">
            <option value="">الكل</option>
            <option value="جودة صنف">جودة صنف</option>
            <option value="مالية">💰 مالية</option>
            <option value="سوء تعامل">سوء تعامل</option>
            <option value="أخرى">أخرى</option>
        </select>
    </div>
    <div><label>موظف الاستفسار</label><select id="searchAddedByI" onchange="filterTable()"><option value="">الكل</option></select></div>
    <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="resetSearch('I')">تفريغ</button>
    <button class="btn" style="background:linear-gradient(135deg,rgba(21,101,192,0.18),rgba(21,101,192,0.08));border:1px solid rgba(21,101,192,0.5);color:#90caf9;align-self:end;font-weight:700;" onclick="reloadTable(this)" title="إعادة تحميل الجدول من السيرفر">🔄 تحديث</button>
    <button id="btnExportInquiriesI" class="btn" style="display:none;background:linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.08));border:1px solid rgba(46,125,50,0.5);color:#81c784;align-self:end;font-weight:700;" onclick="exportInquiriesExcel()" title="تصدير الاستفسارات المعروضة بالفلتر الحالي إلى Excel">⬇️ تصدير Excel</button>
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
    <!-- التحويلة الداخلية بالمقسم (Caller-ID) — اختيارية، لتوجيه رقم المتصل لشاشة الموظف -->
    <div style="margin-bottom:15px;max-width:260px;">
        <label style="font-size:13px;color:var(--text-dim);display:block;margin-bottom:5px;">📞 التحويلة الداخلية بالمقسم (اختياري)</label>
        <input type="text" id="eExt" placeholder="مثال: 102" inputmode="numeric">
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
    <div id="empSearchBar" class="search-bar" style="display:none;margin-bottom:18px;">
        <div style="grid-column:1/-1;" class="search-section-title">🔍 خيارات البحث</div>
        <div><label>المسمى الوظيفي</label>
            <select id="empSearchTitle" onchange="renderEmployees()">
                <option value="">الكل</option>
                <option value="مدير الكول سنتر">مدير الكول سنتر</option>
                <option value="موظف كول سنتر">موظف كول سنتر</option>
                <option value="موظف فرع">موظف فرع</option>
                <option value="مدير فرع">مدير فرع</option>
                <option value="مدير منطقة">مدير منطقة</option>
            </select>
        </div>
        <div><label>حالة الحساب</label>
            <select id="empSearchStatus" onchange="renderEmployees()">
                <option value="">الكل</option>
                <option value="online">🟢 داخل النظام</option>
                <option value="offline">⚫ خارج النظام</option>
            </select>
        </div>
        <button class="btn" style="background:var(--bg-input);color:var(--text-dim);align-self:end;" onclick="document.getElementById('empSearchTitle').value='';document.getElementById('empSearchStatus').value='';renderEmployees();">تفريغ</button>
    </div>
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
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button id="btnTogglePriceAdd" onclick="togglePriceAddForm()"
                style="display:none;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border:none;border-radius:10px;
                       padding:9px 16px;cursor:pointer;font-family:'Cairo';font-size:13px;font-weight:700;">
                ➕ إضافة صنف
            </button>
            <input type="text" id="priceSearchInput" placeholder="🔍 ابحث عن صنف..." oninput="filterPrices()"
                style="padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input);
                       color:var(--text-main);font-family:'Cairo';font-size:14px;width:260px;outline:none;">
        </div>
    </div>
    <div id="priceAddForm" style="display:none;background:rgba(46,125,50,0.06);border:1px dashed rgba(46,125,50,0.45);border-radius:12px;padding:14px;margin-bottom:16px;">
        <div style="font-size:13px;color:#a5d6a7;font-weight:700;margin-bottom:10px;">➕ صنف جديد</div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto auto;gap:8px;align-items:end;">
            <div>
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:3px;">اسم الصنف *</label>
                <input id="newPriceName" type="text" placeholder="مثلاً: قهوة اكسترا" style="width:100%;padding:7px 10px;font-size:13px;font-family:'Cairo';box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:3px;">الوزن / الوحدة *</label>
                <input id="newPriceWeight" type="text" placeholder="مثلاً: 1 كيلو" style="width:100%;padding:7px 10px;font-size:13px;font-family:'Cairo';box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:3px;">السعر (د.أ) *</label>
                <input id="newPricePrice" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;padding:7px 10px;font-size:13px;font-family:'Cairo';box-sizing:border-box;">
            </div>
            <button onclick="addPriceItem()"
                style="padding:8px 16px;background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:'Cairo';font-size:12px;font-weight:700;height:36px;">
                💾 حفظ
            </button>
            <button onclick="togglePriceAddForm(false)"
                style="padding:8px 14px;background:rgba(120,120,120,0.1);color:var(--text-dim);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:'Cairo';font-size:12px;height:36px;">
                ✗ إلغاء
            </button>
        </div>
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

ti: `
<div style="padding:4px 0 20px;">
    <div id="adminAuditContainer"></div>
</div>`,

msg: `
<div style="padding:4px 0 20px;">
    <h2 style="margin:0 0 6px;color:var(--accent-red);">📬 الرسائل</h2>
    <p style="color:var(--text-dim);font-size:13px;margin:0 0 20px;">المراسلات الداخلية بين الموظفين</p>
    <div id="messagesPageContainer"></div>
</div>`,

t: `
<div style="padding:4px 0 20px;">
    <h2 style="margin:0 0 6px;color:var(--accent-red);">🗑️ سلة المحذوفات</h2>
    <p style="color:var(--text-dim);font-size:13px;margin:0 0 20px;">العناصر المحذوفة — تُحذف نهائياً بعد 30 يوماً</p>
    <div id="trashContainer"></div>
</div>`,


};
