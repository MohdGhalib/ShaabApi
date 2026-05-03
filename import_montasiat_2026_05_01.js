/* ════════════════════════════════════════════════════════════
   استيراد منتسيات 1/5/2026 (24 منتسية)
   التشغيل: افتح الموقع وسجّل دخولك، ثم افتح Console (F12)،
            انسخ كل المحتوى أدناه والصقه واضغط Enter.
════════════════════════════════════════════════════════════ */
(function _importMontasiat_20260501() {
    if (typeof db === 'undefined' || !db || !Array.isArray(db.montasiat)) {
        return alert('⚠️ افتح صفحة المنتسيات بعد تسجيل الدخول ثم أعد التشغيل');
    }
    if (!confirm('سيتم إدخال 24 منتسية بتاريخ 1/5/2026. متابعة؟')) return;

    const records = [
        // 1) المشاغل / مهند 4:01PM → سُلِّمت 4:58PM
        { city:'عمان', branch:'المشاغل', branchEmp:'مهند', notes:'2د قهوة خصوصي', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 4:01 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 4:58 PM', deliveredBy:'رامي' },

        // 2) الوحدات / محمد 4:02PM (قيد الانتظار)
        { city:'عمان', branch:'الوحدات', branchEmp:'محمد', notes:'1د مفقودات', type:'نقدي',
          addedBy:'يوسف', time:'1/5/2026، 4:02 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 3) مادبا الشرقي / علي 4:09PM (قيد الانتظار)
        { city:'مادبا', branch:'مادبا الشرقي', branchEmp:'علي', notes:'كيس اصفر فيه بجامة', type:'أخرى',
          addedBy:'يوسف', time:'1/5/2026، 4:09 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 4) العقبة الرابع / سعيد 4:14PM (قيد الانتظار)
        { city:'العقبة', branch:'الرابع', branchEmp:'سعيد', notes:'1د باقي حساب', type:'نقدي',
          addedBy:'يوسف', time:'1/5/2026، 4:14 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 5) وادي الرمم / محمد 4:25PM (قيد الانتظار)
        { city:'عمان', branch:'وادي الرمم', branchEmp:'محمد', notes:'مفك تست لونه سكني', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 4:25 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 6) صويلح / عيسى 5:30PM → سُلِّمت 5:41PM
        { city:'عمان', branch:'صويلح', branchEmp:'عيسى', notes:'2.12د قهوة خصوصي', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 5:30 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 5:41 PM', deliveredBy:'رامي' },

        // 7) المنورة / محمد 5:36PM (قيد الانتظار)
        { city:'عمان', branch:'المنورة', branchEmp:'محمد', notes:'1د مفقودات', type:'نقدي',
          addedBy:'رامي', time:'1/5/2026، 5:36 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 8) اربد ش.شارع 30 / كمال 5:43PM → سُلِّمت 7:22PM
        { city:'اربد', branch:'شارع ال30', branchEmp:'كمال', notes:'نظارة لون اسود', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 5:43 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 7:22 PM', deliveredBy:'رامي' },

        // 9) الرئيسي / عمر 5:45PM → سُلِّمت 6:24PM في فرع المفرق
        { city:'عمان', branch:'الرئيسي', branchEmp:'عمر', notes:'2.25د المن والسلوى 400غ', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 5:45 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 6:24 PM', deliveredBy:'رامي',
          deliveryCountry:'الأردن', deliveryCity:'محافظات بفرع واحد', deliveryBranch:'المفرق',
          deliverNotes:'علما ان التسليم كان في المفرق', deliverNotesAddedAt:'1/5/2026، 6:24 PM' },

        // 10) المنورة / محمود 5:52PM (قيد الانتظار)
        { city:'عمان', branch:'المنورة', branchEmp:'محمود', notes:'10د منتسيات باقي حساب', type:'نقدي',
          addedBy:'رامي', time:'1/5/2026، 5:52 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 11) المشاغل / خالد 6:21PM → سُلِّمت 6:49PM
        { city:'عمان', branch:'المشاغل', branchEmp:'خالد', notes:'5.25د قهوة ملوكي عليها اضافة هيل ب 66قرش', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 6:21 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 6:49 PM', deliveredBy:'رامي' },

        // 12) مادبا الغربي / خليل 7:06PM (قيد الانتظار)
        { city:'مادبا', branch:'مادبا الغربي', branchEmp:'خليل', notes:'1د مفقودات', type:'نقدي',
          addedBy:'رامي', time:'1/5/2026، 7:06 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 13) المفرق / معتز 7:24PM (قيد الانتظار)
        { city:'محافظات بفرع واحد', branch:'المفرق', branchEmp:'معتز', notes:'3.5ك رز تايجر + 3.5ك رز تايجر', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 7:24 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 14) اربد الطيارة / عمران 7:50PM (قيد الانتظار)
        { city:'اربد', branch:'الطيارة', branchEmp:'عمران', notes:'5د قهوة خصوصي', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 7:50 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 15) المنورة / محمود 9:03PM → سُلِّمت 9:12PM
        { city:'عمان', branch:'المنورة', branchEmp:'محمود', notes:'عدد 3 وزن 0.5ك شوكلاتة دراجيه + 0.25ك شوكلاتة دراجية + 1.25د شوكلاتة الشعب +1.20د شوكولاتة انجليزي + 0.75د شوكولاتة انجليزي + 2ك مخلوطة سوبر الشعب', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 9:03 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 9:12 PM', deliveredBy:'رامي' },

        // 16) العقبة الثامن / محمود 9:27PM (قيد الانتظار)
        { city:'العقبة', branch:'الثامن', branchEmp:'محمود', notes:'1د مفقودات', type:'نقدي',
          addedBy:'رامي', time:'1/5/2026، 9:27 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 17) العقبة السابع / رعد 10:27PM → سُلِّمت 10:30PM
        { city:'العقبة', branch:'السابع', branchEmp:'رعد', notes:'1د بهارات مشكلة', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 10:27 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'1/5/2026، 10:30 PM', deliveredBy:'رامي' },

        // 18) المنورة / محمد 10:46PM (قيد الانتظار)
        { city:'عمان', branch:'المنورة', branchEmp:'محمد', notes:'تلفون لونه اخضر هونور', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 10:46 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 19) جرش / محمد 11:06PM → سُلِّمت 2/5 10:05PM (تأخير)
        { city:'محافظات بفرع واحد', branch:'جرش', branchEmp:'محمد', notes:'2.88د شوكولاتة الشعب لموظف', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 11:06 PM', iso:'2026-05-01',
          status:'تم التسليم', dt:'2/5/2026، 10:05 PM', deliveredBy:'رامي', isLateDelivery:true },

        // 20) المفرق / مجدي 11:58PM (قيد الانتظار)
        { city:'محافظات بفرع واحد', branch:'المفرق', branchEmp:'مجدي', notes:'العاب اطفال', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 11:58 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 21) المفرق / مجدي 11:59PM (قيد الانتظار)
        { city:'محافظات بفرع واحد', branch:'المفرق', branchEmp:'مجدي', notes:'كيس بداخله اواعي اطفال', type:'أخرى',
          addedBy:'رامي', time:'1/5/2026، 11:59 PM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' },

        // 22) طبربور / رامي 12:42AM → سُلِّمت 2/5 4:40PM (تأخير)
        { city:'عمان', branch:'طبربور', branchEmp:'رامي', notes:'كيلو خبز', type:'أخرى',
          addedBy:'محمد غالب', time:'1/5/2026، 12:42 AM', iso:'2026-05-01',
          status:'تم التسليم', dt:'2/5/2026، 4:40 PM', deliveredBy:'محمد غالب', isLateDelivery:true },

        // 23) الوحدات / محمد النهاري 12:58AM → سُلِّمت 3/5 11:59AM (تأخير)
        { city:'عمان', branch:'الوحدات', branchEmp:'محمد النهاري', notes:'كيس فيه دواء + لفات شاش + نظارة + بلوزة', type:'أخرى',
          addedBy:'محمد غالب', time:'1/5/2026، 12:58 AM', iso:'2026-05-01',
          status:'تم التسليم', dt:'3/5/2026، 11:59 AM', deliveredBy:'محمد غالب', isLateDelivery:true },

        // 24) الوحدات / محمد النهاري 12:58AM (قيد الانتظار)
        { city:'عمان', branch:'الوحدات', branchEmp:'محمد النهاري', notes:'كيس فيه بلوزتين', type:'أخرى',
          addedBy:'محمد غالب', time:'1/5/2026، 12:58 AM', iso:'2026-05-01',
          status:'قيد الانتظار', dt:'', deliveredBy:'' }
    ];

    const base = Date.now();
    let added = 0;
    records.forEach((r, i) => {
        const rec = Object.assign({ id: base + i*100, country:'الأردن' }, r);
        db.montasiat.unshift(rec);
        added++;
    });

    if (typeof _skipMontasiaNotif !== 'undefined') _skipMontasiaNotif = true;
    save();
    if (typeof renderAll === 'function') renderAll();
    console.log(`✅ تم إدخال ${added} منتسية بنجاح (${records.filter(r=>r.status==='تم التسليم').length} مُسلَّمة، ${records.filter(r=>r.status==='قيد الانتظار').length} قيد الانتظار)`);
    alert(`✅ تم إدخال ${added} منتسية بنجاح`);
})();
