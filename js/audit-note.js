/* ══════════════════════════════════════════════════════
   AUDIT NOTE — ملاحظات السيطرة (نموذج تدقيق)
   - يُفتح من جانب «عرض المرفق» في شكاوى السيطرة
   - يحفظ في db.auditNotes
   - يظهر لمدير السيطرة في تاب "متابعات موظفي السيطرة"
   ══════════════════════════════════════════════════════ */

/* ── حقن CSS مرّة واحدة فقط — مطابق لتصميم c360 ── */
function _anEnsureStyles() {
    if (document.getElementById('_anStyles')) return;

    const st = document.createElement('style');
    st.id = '_anStyles';
    st.textContent = `
        /* ──────── Keyframes (مطابقة لـ c360) ──────── */
        @keyframes _anSlideUp   { from { opacity:0; transform:translateY(28px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes _anStampLand { 0% { opacity:0; transform:rotate(-12deg) scale(1.5); } 60% { opacity:1; transform:rotate(-12deg) scale(0.92); } 100% { opacity:1; transform:rotate(-12deg) scale(1); } }

        /* ──────── Backdrop (مطابق لـ c360) ──────── */
        #anModal {
            position:fixed; inset:0;
            background:radial-gradient(ellipse at center, rgba(60,30,8,0.92) 0%, rgba(15,8,2,0.96) 100%);
            backdrop-filter:blur(8px);
            z-index:99998; display:flex; align-items:center; justify-content:center;
            padding:20px; direction:rtl;
            font-family:'Cairo','Tajawal',sans-serif;
        }
        #anModal.hidden { display:none; }

        /* ──────── Wrap — بالعرض (landscape) من شاشة التعبئة ──────── */
        #anModal .an-wrap {
            max-width:1100px; width:100%; max-height:94vh;
            display:flex; flex-direction:column;
            animation:_anSlideUp 0.45s cubic-bezier(0.34,1.3,0.64,1);
        }

        /* ──────── الشريط العلوي الأخضر — مضغوط ──────── */
        #anModal .an-instruction {
            background:linear-gradient(135deg,#25d366 0%,#128c7e 50%,#075e54 100%);
            color:#fff; padding:9px 20px; border-radius:14px 14px 0 0;
            display:flex; align-items:center; gap:12px;
            border:1.5px solid rgba(37,211,102,0.5); border-bottom:0;
            box-shadow:0 -6px 26px rgba(7,94,84,0.45);
            position:relative; overflow:hidden;
        }
        #anModal .an-instruction::before {
            content:''; position:absolute; inset:0;
            background:repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 14px);
            pointer-events:none;
        }
        #anModal .an-instruction-icon {
            width:30px; height:30px; background:rgba(255,255,255,0.22);
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            font-size:15px; flex-shrink:0; border:1.5px solid rgba(255,255,255,0.35);
        }
        #anModal .an-instruction-text {
            font-size:13.5px; font-weight:800; line-height:1.55; letter-spacing:0.2px;
            text-shadow:0 1px 2px rgba(0,0,0,0.25);
            flex:1;
        }
        /* زر العمل في الترويسة (إرسال / حفظ / طباعة) — على اليسار بصرياً */
        #anModal .an-header-action {
            margin-inline-start:auto; position:relative; z-index:1;
            font-family:'Cairo','Tajawal',sans-serif;
            font-weight:900; letter-spacing:0.4px;
            font-size:13px;
            padding:7px 18px;
            border:1.5px solid rgba(255,255,255,0.4);
            border-radius:10px;
            cursor:pointer;
            color:#fff; background:linear-gradient(135deg,#2e7d32,#1b5e20);
            box-shadow:0 4px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.25);
            transition:filter 0.18s, transform 0.18s;
            display:inline-flex; align-items:center; gap:5px;
            text-shadow:0 1px 1px rgba(0,0,0,0.32);
            white-space:nowrap;
        }
        #anModal .an-header-action:hover { filter:brightness(1.10); transform:translateY(-1px); }
        #anModal .an-header-action:active { transform:translateY(0) scale(0.97); }
        #anModal .an-header-save  { background:linear-gradient(135deg,#a07838,#7a4a26) !important; }
        #anModal .an-header-print { background:linear-gradient(135deg,#1565c0,#0d47a1) !important; }

        /* ضوابط الخط في الترويسة */
        #anModal .an-font-controls {
            display:inline-flex; align-items:center; gap:5px;
            background:rgba(0,0,0,0.18);
            border:1px solid rgba(255,255,255,0.18);
            border-radius:8px;
            padding:3px 6px;
            margin-inline-start:auto;
            position:relative; z-index:1;
        }
        #anModal .an-fc-select {
            font-family:'Cairo', sans-serif;
            font-size:11.5px; font-weight:700;
            padding:3px 6px;
            border:1px solid rgba(255,255,255,0.25);
            border-radius:6px;
            background:rgba(255,255,255,0.92);
            color:#3a2818;
            outline:none; cursor:pointer;
        }
        #anModal .an-fc-save {
            font-size:13px; font-weight:900;
            padding:3px 9px;
            border:1px solid rgba(255,255,255,0.32);
            border-radius:6px;
            background:linear-gradient(135deg,#2e7d32,#1b5e20);
            color:#fff;
            cursor:pointer;
            transition:filter 0.18s;
        }
        #anModal .an-fc-save:hover { filter:brightness(1.10); }
        #anModal .an-fc-save:disabled { cursor:default; opacity:0.7; }

        /* ──────── مربع المسودة قبل الإغلاق ──────── */
        #anDraftDialog {
            position:fixed; inset:0; z-index:99999;
            background:rgba(15,10,8,0.74); backdrop-filter:blur(6px);
            display:flex; align-items:center; justify-content:center;
            padding:20px; direction:rtl;
            font-family:'Cairo','Tajawal',sans-serif;
            animation:_anSlideUp 0.25s ease-out;
        }
        #anDraftDialog .an-dd-box {
            background:linear-gradient(180deg,#fdf8ef 0%,#faf2e3 100%);
            border:1.5px solid rgba(139,69,19,0.30);
            border-radius:16px;
            padding:26px 30px 22px;
            max-width:480px; width:100%;
            box-shadow:0 30px 80px rgba(0,0,0,0.55);
            text-align:center;
        }
        #anDraftDialog .an-dd-icon {
            font-size:42px; margin-bottom:6px;
        }
        #anDraftDialog .an-dd-title {
            font-size:18px; font-weight:900; color:#3a2818;
            margin-bottom:6px;
        }
        #anDraftDialog .an-dd-msg {
            font-size:13.5px; color:#5c3919; margin-bottom:18px; line-height:1.6;
        }
        #anDraftDialog .an-dd-actions {
            display:flex; flex-direction:column; gap:9px;
        }
        #anDraftDialog .an-dd-btn {
            font-family:'Cairo','Tajawal',sans-serif;
            font-weight:900; font-size:13.5px;
            padding:11px 18px;
            border:1.5px solid transparent;
            border-radius:10px;
            cursor:pointer;
            transition:filter 0.18s, transform 0.18s;
            color:#fff;
            box-shadow:0 3px 8px rgba(0,0,0,0.18);
        }
        #anDraftDialog .an-dd-btn:hover { filter:brightness(1.10); transform:translateY(-1px); }
        #anDraftDialog .an-dd-send {
            background:linear-gradient(135deg,#2e7d32,#1b5e20);
        }
        #anDraftDialog .an-dd-save {
            background:linear-gradient(135deg,#1565c0,#0d47a1);
        }
        #anDraftDialog .an-dd-discard {
            background:linear-gradient(135deg,#8a3617,#5d1f0d);
        }
        #anDraftDialog .an-dd-hint {
            margin-top:14px;
            font-size:11.5px; color:#8b6f47;
            font-style:italic;
        }

        /* بادج «مسودة» في الترويسة عند استرجاع مسودة */
        #anModal .an-draft-badge {
            display:inline-flex; align-items:center; gap:4px;
            background:linear-gradient(135deg,#1565c0,#0d47a1);
            color:#fff;
            font-size:11px; font-weight:900;
            padding:3px 9px;
            border-radius:8px;
            margin-inline-end:6px;
            border:1px solid rgba(255,255,255,0.32);
            box-shadow:0 2px 5px rgba(13,71,161,0.32);
        }
        /* عند وجود ضوابط الخط، زر العمل لا يدفع تلقائياً ولكن يبقى بجانبها */
        #anModal .an-font-controls ~ .an-header-action { margin-inline-start:6px; }

        /* ──────── الإيصال الكريمي (مطابق لـ c360) ──────── */
        #anModal .an-receipt {
            background:linear-gradient(180deg, #fdf8ef 0%, #faf2e3 100%);
            border:1.5px solid rgba(139,69,19,0.25);
            border-radius:0 0 18px 18px;
            box-shadow:0 36px 90px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.85);
            position:relative; overflow:hidden;
            display:flex; flex-direction:column;
            flex:1; min-height:0;
        }
        #anModal .an-receipt::before {
            content:''; position:absolute; inset:0;
            background-image:
                radial-gradient(circle at 14% 18%, rgba(139,69,19,0.04) 0, transparent 12%),
                radial-gradient(circle at 86% 78%, rgba(120,53,15,0.05) 0, transparent 14%);
            pointer-events:none;
        }
        #anModal .an-bean {
            position:absolute; font-size:18px; opacity:0.18;
            user-select:none; pointer-events:none;
        }
        #anModal .an-bean.an-b1 { top:8px; right:14px; transform:rotate(35deg); }
        #anModal .an-bean.an-b2 { bottom:80px; left:18px; transform:rotate(-22deg); font-size:14px; }

        #anModal .an-close {
            position:absolute; top:12px; left:14px; z-index:5;
            width:30px; height:30px; border-radius:50%;
            background:rgba(58,40,24,0.08); color:#5c3919;
            border:1px solid rgba(58,40,24,0.18);
            font-size:14px; font-weight:800; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            transition:background 0.18s, transform 0.18s;
            font-family:'Cairo';
        }
        #anModal .an-close:hover { background:rgba(198,40,40,0.12); color:#c62828; transform:rotate(90deg); }

        /* ──────── رأس الإيصال — مضغوط ──────── */
        #anModal .an-receipt-head {
            padding:10px 24px 8px; text-align:center;
            border-bottom:2px dashed rgba(139,69,19,0.22);
            position:relative;
        }
        #anModal .an-brand {
            font-size:9px; font-weight:800; color:#8b6f47;
            letter-spacing:3px; margin-bottom:3px; text-transform:uppercase;
        }
        #anModal .an-receipt-title {
            font-size:16px; font-weight:900; color:#3a2818;
            letter-spacing:0.3px; line-height:1.3;
        }
        #anModal .an-stamp {
            position:absolute; top:16px; right:22px;
            transform:rotate(-12deg);
            border:2.5px solid #c62828; color:#c62828;
            padding:4px 12px; border-radius:6px;
            font-size:11px; font-weight:900; letter-spacing:1.5px;
            background:rgba(198,40,40,0.04);
            animation:_anStampLand 0.7s 0.35s cubic-bezier(0.5,1.6,0.4,1) both;
            opacity:0;
        }

        /* ──────── جسم الفورم — تباعد مضغوط ──────── */
        #anModal .an-body {
            overflow-y:auto; padding:8px 24px 14px; flex:1; min-height:0;
            position:relative;
        }
        #anModal .an-section { margin-top:8px; }
        #anModal .an-section-title {
            font-size:12.5px; font-weight:900; color:#5c3919;
            margin-bottom:6px;
            display:flex; align-items:center; gap:6px;
            letter-spacing:0.3px;
        }

        /* صفوف الحقول — مضغوطة */
        #anModal .an-row {
            display:grid; gap:7px 10px;
            background:#fff;
            border:1.5px solid rgba(139,69,19,0.18);
            border-radius:10px; padding:8px 10px;
            box-shadow:0 2px 6px rgba(139,69,19,0.05);
        }
        #anModal .an-row-5 { grid-template-columns:repeat(5, minmax(0,1fr)); }
        #anModal .an-row-4 { grid-template-columns:repeat(4, minmax(0,1fr)); }
        #anModal .an-row-6 { grid-template-columns:repeat(6, minmax(0,1fr)); }
        /* الأعمدة 8 — أحجام مخصصة: الوقت ورقم الفاتورة أضيق، اليوم أعرض */
        #anModal .an-row-8 {
            grid-template-columns:
                1.5fr   /* اليوم (يحوي تاريخ + اسم اليوم) */
                0.75fr  /* الوقت */
                0.95fr  /* رقم الفاتورة */
                1fr     /* قيمة الفاتورة */
                0.95fr  /* اليوزر */
                1.1fr   /* اسم الكاشير */
                0.95fr  /* رقم الكاميرا */
                0.85fr; /* وقت الكاميرا */
            gap:5px 6px; padding:6px 8px;
        }
        #anModal .an-row-8 .an-field label {
            font-size:13.5px;
            font-weight:900;
            letter-spacing:0.3px;
            text-align:center;
            justify-content:center;
            color:#3a2818;
            margin-bottom:4px;
            white-space:nowrap;   /* منع كلمة "وقت الكاميرا" من النزول لسطر ثانٍ */
        }
        #anModal .an-row-8 .an-field input {
            font-size:11px; padding:4px 6px;
            border-radius:6px;
            text-align:center;
        }
        /* صف داخلي: التاريخ + اسم اليوم جنباً إلى جنب */
        #anModal .an-date-inline {
            display:flex; align-items:center; gap:4px;
        }
        #anModal .an-date-inline input {
            flex:1 1 auto; min-width:0;
        }
        #anModal .an-date-inline .an-day-name {
            font-size:10px; font-weight:800; color:#7a4a26;
            background:rgba(192,147,93,0.15);
            border-radius:5px; padding:2px 6px;
            white-space:nowrap; flex-shrink:0;
            margin:0;
        }


        /* خطّ معلومات الشكوى المرتبطة */
        #anModal .an-linked-info {
            background:linear-gradient(135deg, rgba(25,118,210,0.05), rgba(25,118,210,0.02));
            border:1px solid rgba(25,118,210,0.30);
            border-radius:10px;
            padding:8px 14px;
            font-size:12.5px; color:#3a2818;
            margin-bottom:8px; line-height:1.6;
        }
        #anModal .an-linked-info b { color:#1565c0; }
        #anModal .an-linked-text { color:#3a2818; }
        #anModal .an-linked-sep {
            color:#a07838; font-weight:900; margin:0 6px;
        }
        #anModal .an-linked-branch { color:#5c3919; font-weight:800; }
        #anModal .an-field { display:flex; flex-direction:column; gap:3px; }

        #anModal .an-field label {
            font-size:10.5px; font-weight:800; color:#5c3919;
            display:flex; align-items:center; gap:4px;
            letter-spacing:0.1px;
            line-height:1.2;
        }
        #anModal .an-field label .req { color:#c62828; font-size:11px; line-height:0; }
        #anModal .an-field input,
        #anModal .an-field textarea,
        #anModal .an-field select {
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:12px; padding:6px 10px;
            border:1.2px solid rgba(139,69,19,0.22);
            border-radius:7px;
            background:#fff;
            color:#3a2818;
            font-weight:600;
            outline:none;
            transition:border-color 0.18s, box-shadow 0.18s;
            direction:rtl;
        }
        #anModal .an-field input:focus,
        #anModal .an-field textarea:focus,
        #anModal .an-field select:focus {
            border-color:#c0935d;
            box-shadow:0 0 0 3px rgba(192,147,93,0.18);
        }
        #anModal .an-field input::placeholder,
        #anModal .an-field textarea::placeholder { color:#a08770; font-weight:600; }
        #anModal .an-field input[readonly] {
            background:rgba(255,245,220,0.5);
            color:#5c3919;
            cursor:default;
        }

        /* منطقة الكتابة الكبيرة — تشغل ثلثَي الصفحة */
        #anModal .an-notes-area {
            background:linear-gradient(135deg, #fff5dc 0%, #ffe9c2 100%);
            border:1.5px solid rgba(192,147,93,0.45);
            border-radius:14px;
            padding:10px 14px 10px;
            margin-top:6px;
            box-shadow:0 1px 3px rgba(139,69,19,0.08);
            display:flex; flex-direction:column; gap:8px;
            flex:1 1 auto;
        }
        /* البوكس الأبيض الكبير (يحوي البيانات + الكتابة) */
        #anModal .an-notes-box {
            background:#fff;
            border:1.5px solid rgba(139,69,19,0.30);
            border-radius:10px;
            padding:10px 14px 12px;
            display:flex; flex-direction:column; gap:6px;
            flex:1 1 auto; min-height:340px;
            box-shadow:0 1px 3px rgba(139,69,19,0.06);
            position:relative;   /* لتثبيت المدقق في الزاوية */
        }
        /* العبارة الثابتة "بعد المتابعة والتدقيق :" — تظهر إنلاين قبل النص مباشرة */
        #anModal .an-notes-pad::before {
            content: 'بعد المتابعة والتدقيق : ';
            font-family: Arial, 'Tahoma', sans-serif;
            font-weight: 900;
            color:#075e54;
            display:inline;
            pointer-events:none;
            -webkit-user-modify: read-only;
            user-modify: read-only;
        }
        #anModal .an-notes-pad.an-readonly { cursor:default; }
        #anModal .an-notes-top {
            display:flex; align-items:center; gap:8px;
            flex-wrap:wrap;
            padding-bottom:8px;
            border-bottom:1.5px dashed rgba(139,69,19,0.25);
            font-size:12px;
        }
        #anModal .an-seps {
            font-weight:900; color:#a07838; letter-spacing:1px;
            font-size:13px;
        }
        /* رأس داخلي قديم — احتفاظ لتوافق سابق */
        #anModal .an-notes-header {
            display:flex; align-items:center; gap:12px;
            flex-wrap:wrap;
            padding:6px 10px;
            background:rgba(255,255,255,0.6);
            border:1px solid rgba(192,147,93,0.45);
            border-radius:9px;
        }
        #anModal .an-cam-cell {
            display:inline-flex; align-items:center; gap:5px;
            font-size:11.5px;
        }
        #anModal .an-cam-mini { color:#5c3919; font-weight:800; white-space:nowrap; }
        #anModal .an-cam-cell input {
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:12px; font-weight:700;
            padding:3px 8px;
            border:1.2px solid rgba(139,69,19,0.30);
            border-radius:6px;
            background:#fff; color:#3a2818;
            outline:none; width:90px; direction:rtl;
            transition:border-color 0.18s, box-shadow 0.18s;
        }
        #anModal .an-cam-cell input[type=time] { width:110px; }
        #anModal .an-cam-cell input:focus {
            border-color:#c0935d;
            box-shadow:0 0 0 2px rgba(192,147,93,0.18);
        }
        #anModal .an-cam-cell input[readonly] {
            background:rgba(255,245,220,0.5); color:#5c3919; cursor:default;
        }
        #anModal .an-prefix-label {
            margin-inline-start:auto;
            font-size:13px; font-weight:900;
            color:#075e54;
            background:linear-gradient(135deg, rgba(37,211,102,0.16), rgba(37,211,102,0.06));
            border:1.2px solid rgba(37,211,102,0.45);
            padding:4px 12px;
            border-radius:8px;
            letter-spacing:0.3px;
        }
        /* المدقق — pill عائم في الزاوية السفلى اليسرى بصرياً (لا يحجز سطراً) */
        #anModal .an-auditor-bottom {
            position:absolute;
            bottom:8px; left:10px;
            z-index:3;
        }
        /* إجراء المسؤول — يمتدّ من اليمين حتى قبل بوكس المدقق على اليسار */
        #anModal .an-supervisor-bottom {
            position:absolute;
            bottom:8px; right:10px;
            left:240px;   /* يحجز ~240px لبوكس المدقق على الجهة اليسرى */
            z-index:3;
        }
        #anModal .an-supervisor-inline {
            background:rgba(21,101,192,0.10) !important;
            border-color:rgba(21,101,192,0.30) !important;
            display:flex !important;
            width:100%;
            box-sizing:border-box;
        }
        #anModal .an-supervisor-inline .an-auditor-label {
            color:#1565c0 !important;
            flex-shrink:0;
        }
        #anModal .an-supervisor-inline input {
            flex:1 1 auto !important;
            min-width:0 !important;
            width:auto !important;
        }
        @media (max-width:760px) {
            #anModal .an-supervisor-bottom { left:200px; }
        }
        /* توقيع المدقق — inline داخل شريط الـ top الأبيض */
        #anModal .an-auditor-inline {
            display:inline-flex; align-items:center; gap:6px;
            padding:4px 12px;
            background:rgba(212,170,90,0.10);
            border:1px solid rgba(139,69,19,0.25);
            border-radius:8px;
        }
        #anModal .an-auditor-inline .an-auditor-label {
            font-family:'Reem Kufi','Cairo',sans-serif;
            font-size:12.5px; font-weight:900; color:#5c3919;
            letter-spacing:0.5px;
            background:none !important; -webkit-text-fill-color:initial !important; color:#5c3919 !important;
            margin:0 !important;
            white-space:nowrap;
        }
        #anModal .an-auditor-inline input {
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:12.5px; font-weight:800;
            padding:2px 8px;
            border:none;
            border-bottom:1.5px solid #5c3919;
            background:transparent;
            color:#3a2818;
            min-width:140px;
            outline:none; text-align:start;
            transition:border-color 0.18s;
        }
        #anModal .an-auditor-inline input:focus { border-bottom-color:#c0935d; }
        #anModal .an-auditor-inline input::placeholder { color:#a08770; font-style:italic; }
        #anModal .an-notes-label {
            font-size:12.5px; font-weight:800; color:#5c3919;
            margin-bottom:8px; letter-spacing:0.3px;
            display:flex; align-items:center; gap:12px; flex-wrap:wrap;
        }
        #anModal .an-notes-label .req { color:#c62828; font-size:13px; line-height:0; }
        #anModal .an-notes-label .an-notes-label-text { flex-shrink:0; }
        #anModal .an-camera-inline {
            display:inline-flex; align-items:center; gap:6px;
            background:rgba(255,255,255,0.6);
            border:1px solid rgba(139,69,19,0.30);
            border-radius:8px;
            padding:4px 8px;
            font-size:11.5px;
        }
        #anModal .an-camera-inline .an-cam-mini {
            color:#5c3919; font-weight:800; white-space:nowrap;
        }
        #anModal .an-camera-inline input {
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:12px; font-weight:700;
            padding:3px 8px;
            border:1px solid rgba(139,69,19,0.22);
            border-radius:6px;
            background:#fff;
            color:#3a2818;
            outline:none;
            width:90px;
            direction:rtl;
            transition:border-color 0.18s, box-shadow 0.18s;
        }
        #anModal .an-camera-inline input[type=time] { width:110px; }
        #anModal .an-camera-inline input:focus {
            border-color:#c0935d;
            box-shadow:0 0 0 2px rgba(192,147,93,0.18);
        }
        #anModal .an-camera-inline input[readonly] {
            background:rgba(255,245,220,0.5); color:#5c3919; cursor:default;
        }
        #anModal .an-notes-pad {
            width:100%; box-sizing:border-box;
            min-height:360px;
            padding:8px 6px 50px;   /* مساحة سفلى لتجنّب تغطية المدقق */
            flex:1 1 auto;
            /* خط افتراضي Arial Bold — قابل للتغيير عبر تفضيلات الخط */
            font-family: Arial, 'Tahoma', sans-serif;
            font-weight: bold;
            font-size:15px;
            line-height:1.75;
            color:#3a2818;
            outline:none;
            direction:rtl;
            overflow-y:auto;
            /* إلغاء الإطار لأن البوكس الخارجي an-notes-box هو الذي يحويه */
            border:none !important;
            box-shadow:none !important;
            background:transparent !important;
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:13px; line-height:1.7;
            color:#3a2818;
            background:#fff;
            border:1.5px solid rgba(139,69,19,0.22);
            border-radius:10px;
            outline:none;
            transition:border-color 0.18s, box-shadow 0.18s;
            direction:rtl;
        }
        #anModal .an-notes-pad:focus {
            border-color:#c0935d;
            box-shadow:0 0 0 3px rgba(192,147,93,0.18);
        }
        #anModal .an-notes-pad::placeholder { color:#a08770; font-weight:600; }
        #anModal .an-notes-pad[readonly] { background:rgba(255,245,220,0.5); }

        /* قسم المدقق — مضغوط */
        #anModal .an-auditor-section {
            text-align:center;
            padding:10px 16px 4px;
            border-top:2px dashed rgba(139,69,19,0.22);
            margin-top:6px;
        }
        #anModal .an-auditor-label {
            font-size:11px; font-weight:800; color:#8b6f47;
            letter-spacing:5px; margin-bottom:6px;
            text-transform:uppercase;
        }
        #anModal .an-auditor-section input {
            font-family:'Cairo','Tajawal',sans-serif;
            text-align:center;
            font-size:15px; font-weight:800;
            padding:6px 14px 4px;
            border:none;
            border-bottom:1.5px solid #5c3919;
            background:transparent;
            color:#3a2818;
            min-width:260px;
            outline:none;
            transition:border-color 0.18s;
            direction:rtl;
        }
        #anModal .an-auditor-section input:focus { border-bottom-color:#c0935d; }
        #anModal .an-auditor-section input::placeholder { color:#a08770; font-style:italic; font-weight:600; }

        /* الأزرار السفلية — مضغوط */
        #anModal .an-footer {
            padding:10px 24px 12px;
            display:flex; gap:10px; justify-content:center; flex-wrap:wrap;
            border-top:1px solid rgba(139,69,19,0.12);
            background:rgba(255,245,220,0.30);
        }
        #anModal .an-btn {
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:13.5px; font-weight:800;
            padding:10px 24px; border:none; border-radius:10px;
            cursor:pointer;
            transition:transform 0.15s, filter 0.18s, box-shadow 0.2s;
        }
        #anModal .an-btn-submit {
            background:linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
            color:#fff;
            box-shadow:0 4px 10px rgba(46,125,50,0.32);
        }
        #anModal .an-btn-submit:hover { filter:brightness(1.10); transform:translateY(-1px); }
        #anModal .an-btn-cancel {
            background:#fff;
            color:#5c3919;
            border:1.5px solid rgba(139,69,19,0.30);
        }
        #anModal .an-btn-cancel:hover { background:rgba(255,245,220,0.6); }

        #anModal .an-btn-print {
            background:linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
            color:#fff;
            box-shadow:0 4px 10px rgba(13,71,161,0.32), inset 0 1px 0 rgba(255,255,255,0.20);
            text-shadow:0 1px 1px rgba(0,0,0,0.22);
            border:1px solid rgba(255,255,255,0.22);
        }
        #anModal .an-btn-print:hover { filter:brightness(1.10); transform:translateY(-1px); }
        #anModal .an-btn-print:active { transform:translateY(0) scale(0.97); }

        /* رسالة الخطأ */
        #anModal .an-err {
            background:rgba(198,40,40,0.10);
            color:#c62828; font-size:12.5px; font-weight:700;
            padding:9px 14px; border-radius:8px;
            border:1px solid rgba(198,40,40,0.28);
            margin:0 28px 8px; text-align:center;
            display:none;
        }
        #anModal .an-err.show { display:block; }

        /* ──────── Toast كملصق إيصال صغير ──────── */
        @keyframes _anToastEnter {
            0%   { opacity:0; transform:translateY(-6px) rotate(-2deg) scale(0.92); }
            60%  { opacity:1; transform:translateY(2px)  rotate(0.4deg) scale(1.02); }
            100% { opacity:1; transform:translateY(0)    rotate(-1deg)  scale(1); }
        }
        @keyframes _anToastPulse {
            0%,100% { box-shadow:0 8px 22px rgba(46,24,16,0.32), 0 0 0 1px rgba(192,147,93,0.45); }
            50%     { box-shadow:0 10px 26px rgba(46,24,16,0.42), 0 0 0 2px rgba(192,147,93,0.7); }
        }
        .an-toast {
            position:absolute;
            z-index:99999;
            background:
                linear-gradient(135deg, #fff5dc 0%, #ffe9c2 100%);
            color:#3a2818;
            padding:10px 14px 10px 16px;
            border-radius:10px;
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:12px; font-weight:800;
            line-height:1.4;
            box-shadow:0 8px 22px rgba(46,24,16,0.32), 0 0 0 1px rgba(192,147,93,0.45);
            opacity:0;
            transform:translateY(-6px) rotate(-2deg) scale(0.92);
            transition:opacity 0.28s, transform 0.32s;
            pointer-events:none;
            direction:rtl; text-align:right;
            max-width:260px;
            border:1px solid rgba(192,147,93,0.55);
            border-right:4px solid #c1572b;
            transform-origin:top right;
        }
        .an-toast::after {
            /* perforated edge feel at the bottom */
            content:'';
            position:absolute; left:0; right:0; bottom:-1px; height:6px;
            background:
                radial-gradient(circle at 6px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 18px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 30px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 42px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 54px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 66px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 78px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 90px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 102px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 114px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 126px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 138px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 150px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 162px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 174px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 186px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 198px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 210px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 222px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 234px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 246px 6px, #fff5dc 4.5px, transparent 5px),
                radial-gradient(circle at 258px 6px, #fff5dc 4.5px, transparent 5px);
        }
        .an-toast .an-toast-icon {
            display:inline-flex; align-items:center; justify-content:center;
            width:22px; height:22px;
            background:radial-gradient(circle, #c1572b 0%, #8a3617 100%);
            border-radius:50%;
            color:#fff5dc;
            font-size:12px; font-weight:900;
            margin-left:6px;
            box-shadow:inset 0 1px 2px rgba(255,255,255,0.25), 0 1px 3px rgba(122,61,31,0.5);
            vertical-align:-5px;
        }
        .an-toast.show {
            opacity:1;
            transform:translateY(0) rotate(-1deg) scale(1);
            animation:_anToastEnter 0.5s cubic-bezier(0.34,1.36,0.56,1) forwards, _anToastPulse 2.2s 0.5s ease-in-out infinite;
        }

        /* ──────── زر القلم — نحاسي ذهبي (ينسجم مع لوحة الإيصال) ──────── */
        @keyframes _anEditBreathe {
            0%,100% { box-shadow:0 2px 5px rgba(122,74,38,0.35), 0 0 0 0 rgba(212,170,90,0.45); }
            50%     { box-shadow:0 3px 7px rgba(122,74,38,0.45), 0 0 0 4px rgba(212,170,90,0); }
        }
        .btn-audit-edit {
            background:linear-gradient(135deg, #d4aa5a 0%, #a07838 55%, #7a4a26 100%) !important;
            color:#fff5dc !important;
            border:1px solid rgba(255,245,220,0.32) !important;
            cursor:pointer;
            font-family:'Cairo','Tajawal',sans-serif;
            font-weight:800;
            padding:4px 9px; font-size:13px;
            border-radius:8px;
            box-shadow:0 2px 5px rgba(122,74,38,0.35), inset 0 1px 0 rgba(255,245,220,0.25);
            text-shadow:0 1px 1px rgba(0,0,0,0.22);
            transition:filter 0.18s, transform 0.18s, box-shadow 0.22s;
            display:inline-flex; align-items:center; gap:3px;
            min-width:30px;
            animation:_anEditBreathe 2.6s ease-in-out infinite;
            position:relative;
        }
        .btn-audit-edit::after {
            /* tiny corner shine */
            content:''; position:absolute; top:2px; right:4px;
            width:6px; height:6px; border-radius:50%;
            background:radial-gradient(circle, rgba(255,245,220,0.7), transparent 70%);
            pointer-events:none;
        }
        .btn-audit-edit:hover {
            filter:brightness(1.10);
            transform:translateY(-1px) rotate(-4deg);
            box-shadow:0 5px 12px rgba(122,74,38,0.5), inset 0 1px 0 rgba(255,245,220,0.3);
        }
        .btn-audit-edit:active { transform:translateY(0) scale(0.95) rotate(0); }

        /* ──────── زر «📂 المتابعة المرتبطة» — أزرق للتنقّل لتاب المتابعة ──────── */
        .btn-audit-link {
            background:linear-gradient(135deg, #1565c0 0%, #0d47a1 100%) !important;
            color:#fff !important;
            border:1px solid rgba(255,255,255,0.22) !important;
            cursor:pointer;
            font-family:'Cairo','Tajawal',sans-serif;
            font-weight:700; letter-spacing:0.2px;
            padding:4px 11px; font-size:12px;
            border-radius:8px;
            box-shadow:0 2px 5px rgba(13,71,161,0.35), inset 0 1px 0 rgba(255,255,255,0.20);
            text-shadow:0 1px 1px rgba(0,0,0,0.22);
            transition:filter 0.15s, transform 0.15s, box-shadow 0.18s;
            display:inline-flex; align-items:center; gap:3px;
        }
        .btn-audit-link:hover {
            filter:brightness(1.10);
            transform:translateY(-1px);
            box-shadow:0 5px 12px rgba(13,71,161,0.5);
        }
        .btn-audit-link:active { transform:translateY(0) scale(0.97); }

        /* ──────── وضع التعديل — إطار ذهبي حول الإيصال + شريط علوي مختلف ──────── */
        #anModal.an-mode-edit .an-receipt {
            border:1.5px solid #c0935d;
            box-shadow:
                0 36px 90px rgba(0,0,0,0.6),
                inset 0 1px 0 rgba(255,255,255,0.85),
                0 0 0 2px rgba(212,170,90,0.35);
        }
        #anModal.an-mode-edit .an-instruction {
            background:linear-gradient(135deg, #d4aa5a 0%, #a07838 50%, #7a4a26 100%);
            border-color:rgba(255,245,220,0.4);
        }
        #anModal.an-mode-edit .an-stamp {
            border-color:#a07838; color:#7a4a26;
            background:rgba(212,170,90,0.10);
        }
        #anModal.an-mode-edit .an-stamp::before {
            content:'تعديل · '; font-size:10px; opacity:0.85;
        }

        /* ──────── زر "📋 ملاحظات السيطرة" — تصميم لافت كامل ──────── */
        @keyframes _anBtnBreathe {
            0%,100% {
                box-shadow:
                    0 3px 8px rgba(7,94,84,0.42),
                    0 0 0 0 rgba(37,211,102,0.55),
                    inset 0 1px 0 rgba(255,255,255,0.30);
            }
            50% {
                box-shadow:
                    0 5px 14px rgba(7,94,84,0.55),
                    0 0 0 6px rgba(37,211,102,0),
                    inset 0 1px 0 rgba(255,255,255,0.35);
            }
        }
        @keyframes _anBtnShimmer {
            0%   { background-position:200% 0; }
            100% { background-position:-200% 0; }
        }
        @keyframes _anBadgeBounce {
            0%,100% { transform:translate(-50%,0) scale(1); }
            50%     { transform:translate(-50%,-2px) scale(1.08); }
        }
        .btn-audit-note {
            position:relative;
            background:
                linear-gradient(110deg,
                    #25d366 0%,
                    #128c7e 35%,
                    #34c98a 50%,
                    #128c7e 65%,
                    #075e54 100%) !important;
            background-size:220% 100% !important;
            color:#fff !important;
            border:1.5px solid rgba(255,255,255,0.32) !important;
            cursor:pointer;
            font-family:'Cairo','Tajawal',sans-serif;
            font-weight:800; letter-spacing:0.4px;
            padding:6px 14px 6px 13px;
            font-size:12.5px;
            border-radius:10px;
            text-shadow:0 1px 1px rgba(0,0,0,0.30);
            box-shadow:
                0 3px 8px rgba(7,94,84,0.42),
                0 0 0 0 rgba(37,211,102,0.55),
                inset 0 1px 0 rgba(255,255,255,0.30);
            transition:filter 0.18s, transform 0.18s;
            display:inline-flex; align-items:center; gap:5px;
            animation:_anBtnBreathe 2.4s ease-in-out infinite, _anBtnShimmer 4.8s linear infinite;
        }
        .btn-audit-note::before {
            content:''; position:absolute; inset:0;
            background:linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.32) 50%, transparent 65%);
            background-size:220% 100%;
            animation:_anBtnShimmer 4.8s linear infinite;
            border-radius:inherit;
            pointer-events:none;
            mix-blend-mode:overlay;
            opacity:0.55;
        }
        .btn-audit-note::after {
            content:'جديد';
            position:absolute; top:-8px; left:50%;
            transform:translate(-50%, 0);
            background:linear-gradient(135deg, #c1572b 0%, #8a3617 100%);
            color:#fff5dc;
            font-size:8.5px; font-weight:900;
            padding:2px 7px 1px;
            border-radius:10px;
            letter-spacing:0.8px;
            box-shadow:0 2px 5px rgba(122,61,31,0.5), inset 0 1px 0 rgba(255,245,220,0.30);
            border:1px solid rgba(255,245,220,0.35);
            animation:_anBadgeBounce 1.6s ease-in-out infinite;
            white-space:nowrap;
            pointer-events:none;
        }
        .btn-audit-note:hover {
            filter:brightness(1.10) saturate(1.15);
            transform:translateY(-1.5px);
        }
        .btn-audit-note:active { transform:translateY(0) scale(0.97); }

        .btn-audit-note.has-note {
            background:
                linear-gradient(135deg, #075e54 0%, #128c7e 60%, #075e54 100%) !important;
            background-size:100% 100% !important;
            box-shadow:
                0 0 0 2px rgba(37,211,102,0.40),
                0 2px 5px rgba(7,94,84,0.5),
                inset 0 1px 0 rgba(255,255,255,0.18) !important;
            animation:none;
            border-color:rgba(165,214,167,0.4) !important;
        }
        .btn-audit-note.has-note::before {
            display:none;
        }
        .btn-audit-note.has-note::after {
            content:'تم ✓';
            background:linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
            animation:none;
            top:-7px;
            font-size:8.5px;
        }

        @media (max-width:760px) {
            #anModal .an-row-5 { grid-template-columns:repeat(2, 1fr); }
            #anModal .an-row-4 { grid-template-columns:repeat(2, 1fr); }
        }
        @media (max-width:480px) {
            #anModal .an-row-5, #anModal .an-row-4 { grid-template-columns:1fr; }
            #anModal .an-body { padding:12px 18px 16px; }
            #anModal .an-receipt-head { padding:20px 18px 14px; }
            #anModal .an-stamp { top:10px; right:14px; font-size:9px; padding:3px 9px; }
            #anModal .an-auditor-section input { min-width:0; width:100%; max-width:280px; }
        }
    `;
    document.head.appendChild(st);
}

/* ══════════════════════════════════════════════════════
   Toast — رسالة بجانب زر «📋 ملاحظة السيطرة» المعبأ مسبقاً
   ══════════════════════════════════════════════════════ */
function _anNotifyAlreadyFilled(btn) {
    _anEnsureStyles();
    document.querySelectorAll('.an-toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'an-toast';
    toast.innerHTML = '<span class="an-toast-icon">!</span> تم تعبئة هذا النموذج مسبقاً — لا يمكن فتحه مجدداً';
    const r = btn.getBoundingClientRect();
    const top = Math.max(8, r.top - 56 + window.scrollY);
    const left = Math.min(window.innerWidth - 280, Math.max(8, r.left - 30 + window.scrollX));
    toast.style.top = top + 'px';
    toast.style.left = left + 'px';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 360);
    }, 2800);
}

/* ══════════════════════════════════════════════════════
   فتح المودال — مع تعبئة الفرع تلقائياً من الشكوى
   mode: 'new' (افتراضي) | 'edit' (مدير السيطرة فقط) | 'view'
   ══════════════════════════════════════════════════════ */
function openAuditNoteModal(complaintId, mode) {
    _anEnsureStyles();

    const complaint = (db.complaints || []).find(c => c.id == complaintId);
    if (!complaint) { alert('الشكوى غير موجودة'); return; }

    const existing = (db.auditNotes || []).find(n => !n.deleted && n.complaintId == complaintId);

    // تحديد الوضع
    if (!mode) mode = existing ? 'view' : 'new';
    if (mode === 'edit' && !existing) mode = 'new';

    // التحقق من صلاحية وضع التعديل (مدير السيطرة فقط)
    const _isCtrlMgr = currentUser && (currentUser.title === 'مدير قسم السيطرة' || currentUser.empId === '1111');
    if (mode === 'edit' && !_isCtrlMgr) {
        alert('ليس لديك صلاحية تعديل هذا النموذج');
        return;
    }

    // أزل أي مودال سابق
    const old = document.getElementById('anModal');
    if (old) old.remove();

    const today = new Date();
    const dateStr = today.toISOString().substring(0, 10);
    const timeStr = today.toTimeString().substring(0, 5);

    // إذا كان وضعاً جديداً وتوجد مسودة لهذه الشكوى — استرجعها
    const draft = (mode === 'new') ? _anLoadDraft(complaintId) : null;

    const v = (k, def='') => {
        if (draft && draft[k] != null && draft[k] !== '') return draft[k];
        return existing ? (existing[k] ?? def) : def;
    };
    const readonly = (mode === 'view') ? 'readonly' : '';
    const isView = (mode === 'view');
    const isEdit = (mode === 'edit');

    // تتبّع الحالة الحالية لاستخدامها عند الإغلاق
    _anCurrentComplaintId = complaintId;
    _anCurrentMode = mode;

    const modal = document.createElement('div');
    modal.id = 'anModal';
    if (isEdit) modal.classList.add('an-mode-edit');
    modal.innerHTML = `
        <div class="an-wrap">
            <div class="an-instruction">
                <div class="an-instruction-icon">${isView ? '📋' : (isEdit ? '✏️' : '✍️')}</div>
                <div class="an-instruction-text">
                    ${draft ? '<span class="an-draft-badge">📝 مسودة</span>' : ''}
                    ${isView
                        ? 'نموذج تدقيق مُرسَل — اطلاعك على المحتوى فقط'
                        : (isEdit
                            ? 'تعديل نموذج التدقيق — مدير قسم السيطرة'
                            : (draft ? 'نموذج تدقيق السيطرة — تم استرجاع مسودتك السابقة' : 'نموذج تدقيق السيطرة'))}
                </div>
                ${isView ? '' : `
                <span class="an-font-controls">
                    <select id="anFontFamily" class="an-fc-select" title="نوع الخط" onchange="_anApplyFontPrefs()">
                        <option value="Arial">Arial</option>
                        <option value="Tahoma">Tahoma</option>
                        <option value="'Times New Roman'">Times</option>
                        <option value="'Courier New'">Courier</option>
                        <option value="Cairo">Cairo</option>
                    </select>
                    <select id="anFontSize" class="an-fc-select" title="حجم الخط" onchange="_anApplyFontPrefs()">
                        <option value="12">12</option>
                        <option value="13">13</option>
                        <option value="14">14</option>
                        <option value="15" selected>15</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="22">22</option>
                    </select>
                    <button type="button" class="an-fc-save" title="حفظ الإعدادات لجميع موظفي السيطرة" onclick="_anSavePrefs(this)">💾</button>
                </span>`}
                ${isView
                    ? `<button class="an-header-action an-header-print" onclick="printAuditNote(${complaint.id})" title="تصدير وطباعة">🖨️ طباعة</button>`
                    : (isEdit
                        ? `<button class="an-header-action an-header-save" onclick="submitAuditNote(${complaint.id}, 'edit')" title="حفظ التعديلات">💾 حفظ التعديلات</button>`
                        : `<button class="an-header-action an-header-send" onclick="submitAuditNote(${complaint.id})" title="إرسال إلى مدير السيطرة">📤 إرسال</button>`)}
            </div>
            <div class="an-receipt">
                <button class="an-close" onclick="closeAuditNoteModal()" title="إغلاق">✕</button>
                <span class="an-bean an-b1">☕</span>
                <span class="an-bean an-b2">☕</span>

                <div class="an-receipt-head">
                    <div class="an-brand">🙦 شركة برافو لصناعة المكسرات والشوكولاتة. 🙤</div>
                    <div class="an-receipt-title">تدقيق</div>
                    <div class="an-stamp">تدقيق رسمي</div>
                </div>

                <div class="an-body">
                    <!-- معلومات الشكوى المرتبطة (عرض فقط) -->
                    <div class="an-linked-info">
                        🔗 <b>شكوى السيطرة المرتبطة:</b>
                        <span class="an-linked-text">${sanitize((complaint.notes || '').substring(0, 140))}${(complaint.notes || '').length > 140 ? '…' : ''}</span>
                        <span class="an-linked-sep">//</span>
                        <b>الفرع:</b> <span class="an-linked-branch">${sanitize(complaint.branch || '—')}</span>
                    </div>

                    <!-- صف واحد: 8 حقول (اليوم • الوقت • رقم الفاتورة • قيمة الفاتورة • اليوزر • اسم الكاشير • رقم الكاميرا • وقت الكاميرا) -->
                    <div class="an-section">
                        <div class="an-row an-row-8">
                            <div class="an-field">
                                <label>اليوم <span class="req">*</span></label>
                                <div class="an-date-inline">
                                    <input type="date" id="anDate" ${readonly} value="${v('date', dateStr)}" onchange="_anSyncDayName()">
                                    <span class="an-day-name" id="anDayName">—</span>
                                </div>
                            </div>
                            <div class="an-field">
                                <label>الوقت <span class="req">*</span></label>
                                <input type="time" id="anTime" ${readonly} value="${v('time', timeStr)}">
                            </div>
                            <div class="an-field">
                                <label>رقم الفاتورة <span class="req">*</span></label>
                                <input type="text" id="anInvNum" ${readonly} value="${sanitize(v('invoiceNumber'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>قيمة الفاتورة <span class="req">*</span></label>
                                <input type="text" id="anInvValue" ${readonly} value="${sanitize(v('invoiceValue'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>اليوزر <span class="req">*</span></label>
                                <input type="text" id="anUser" ${readonly} value="${sanitize(v('user'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>اسم الكاشير <span class="req">*</span></label>
                                <input type="text" id="anCashier" ${readonly} value="${sanitize(v('cashier'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>📷 رقم الكاميرا <span class="req">*</span></label>
                                <input type="text" id="anCameraNum" ${readonly} value="${sanitize(v('cameraNum'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>⏰ وقت الكاميرا <span class="req">*</span></label>
                                <input type="time" id="anCameraTime" ${readonly} value="${v('cameraTime')}">
                            </div>
                        </div>
                    </div>

                    <!-- البوكس الأبيض الكبير — كتابة غنية + توقيع المدقق في الأسفل -->
                    <div class="an-notes-area">
                        <div class="an-notes-box">
                            <div id="anDetails" class="an-notes-pad${isView ? ' an-readonly' : ''}" ${isView ? '' : 'contenteditable="true"'} data-placeholder="اكتب التفاصيل ...">${(v('details') || '').replace(/^بعد المتابعة والتدقيق\s*:\s*/, '').trim()}</div>
                            <div class="an-auditor-bottom">
                                <span class="an-auditor-inline">
                                    <span class="an-auditor-label">المدقق :</span>
                                    <input type="text" id="anAuditor" ${readonly} value="${sanitize(v('auditor'))}" placeholder="اسم المدقق">
                                </span>
                            </div>
                            <div class="an-supervisor-bottom">
                                <span class="an-auditor-inline an-supervisor-inline">
                                    <span class="an-auditor-label">إجراء المسؤول :</span>
                                    <input type="text" id="anSupervisorAction" ${readonly} value="${sanitize(v('supervisorAction'))}" placeholder="إجراء المسؤول">
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- الفرع المخفي (يُحفظ تلقائياً من الشكوى) -->
                    <input type="hidden" id="anBranch" value="${sanitize(v('branch', complaint.branch || ''))}">
                </div>

                <div class="an-err" id="anErr"></div>

                ${isView
                    ? `<div class="an-footer">
                         <button class="an-btn an-btn-submit" onclick="jumpToComplaintFromAudit(${complaint.id})">🔙 الانتقال للشكوى</button>
                       </div>`
                    : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // إغلاق بالضغط خارج المحتوى
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAuditNoteModal();
    });

    // اعرض اسم اليوم بناءً على التاريخ الحالي
    _anSyncDayName();

    // ركّز على بوكس الكتابة الغنية + اربط سكرول الماوس لتكبير النص المحدّد + حمّل تفضيلات الخط
    if (!isView) {
        requestAnimationFrame(() => {
            _anLoadPrefs();
            const ed = document.getElementById('anDetails');
            if (ed) ed.focus();
            _anBindZoomWheel();
        });
    }
}

/* ── تطبيق إعدادات الخط على بوكس الكتابة ── */
function _anApplyFontPrefs() {
    const ed = document.getElementById('anDetails');
    const fam = document.getElementById('anFontFamily');
    const sz  = document.getElementById('anFontSize');
    if (!ed) return;
    if (fam && fam.value) {
        ed.style.setProperty('font-family', fam.value + ", 'Tahoma', sans-serif", 'important');
    }
    if (sz && sz.value) {
        ed.style.setProperty('font-size', sz.value + 'px', 'important');
    }
}

/* ── حفظ إعدادات الخط مشتركاً لجميع موظفي السيطرة ── */
function _anSavePrefs(btn) {
    const fam = document.getElementById('anFontFamily');
    const sz  = document.getElementById('anFontSize');
    if (!db.auditSettings || typeof db.auditSettings !== 'object') db.auditSettings = {};
    db.auditSettings.fontFamily = fam ? fam.value : 'Arial';
    db.auditSettings.fontSize   = sz  ? sz.value  : '15';
    db.auditSettings.updatedAt  = Date.now();
    db.auditSettings.updatedBy  = (currentUser && currentUser.name) || '—';
    if (typeof saveAuditSettings === 'function') saveAuditSettings();
    if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
    }
}

/* ── تحميل إعدادات الخط المحفوظة وتطبيقها ── */
function _anLoadPrefs() {
    const s = (db && db.auditSettings) || {};
    const fam = document.getElementById('anFontFamily');
    const sz  = document.getElementById('anFontSize');
    if (fam && s.fontFamily) {
        // إن لم يكن خياراً قياسياً أضفه
        let found = false;
        for (let i = 0; i < fam.options.length; i++) if (fam.options[i].value === s.fontFamily) { found = true; break; }
        if (found) fam.value = s.fontFamily;
    }
    if (sz && s.fontSize) {
        let found = false;
        for (let i = 0; i < sz.options.length; i++) if (sz.options[i].value === s.fontSize) { found = true; break; }
        if (found) sz.value = s.fontSize;
    }
    _anApplyFontPrefs();
}

/* ── تكبير/تصغير النص المحدّد بعجلة الماوس داخل بوكس الكتابة ── */
function _anZoomSelection(delta) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const ed = document.getElementById('anDetails');
    if (!ed || !ed.contains(range.commonAncestorContainer)) return false;

    // احصل على الحجم الحالي عند بداية التحديد
    const startNode = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const cs = window.getComputedStyle(startNode);
    const cur = parseFloat(cs.fontSize) || 16;
    const next = Math.max(10, Math.min(56, cur + delta));

    const span = document.createElement('span');
    span.style.fontSize = next + 'px';
    try {
        range.surroundContents(span);
    } catch (e) {
        // التحديد يعبر عدة عناصر — استخدم استخراج + تغليف
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
    }
    // أعد تحديد المحتوى بداخل الـ span
    sel.removeAllRanges();
    const r2 = document.createRange();
    r2.selectNodeContents(span);
    sel.addRange(r2);
    return true;
}

function _anBindZoomWheel() {
    const ed = document.getElementById('anDetails');
    if (!ed || ed._anWheelBound) return;
    ed._anWheelBound = true;
    ed.addEventListener('wheel', (e) => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) return;
        if (!ed.contains(sel.anchorNode)) return;
        // سكرول لأعلى = تكبير، لأسفل = تصغير
        const delta = (e.deltaY < 0) ? 2 : -2;
        if (_anZoomSelection(delta)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, { passive: false });
}

/* ── حساب اسم اليوم بالعربية وعرضه تحت حقل التاريخ ── */
function _anSyncDayName() {
    const dEl = document.getElementById('anDate');
    const spn = document.getElementById('anDayName');
    if (!dEl || !spn) return;
    const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const val = dEl.value;
    if (!val) { spn.textContent = '—'; return; }
    try {
        const d = new Date(val + 'T00:00:00');
        if (!isNaN(d)) spn.textContent = days[d.getDay()];
        else spn.textContent = '—';
    } catch { spn.textContent = '—'; }
}

function closeAuditNoteModal(forceClose) {
    // إن كان وضعاً جديداً وأدخل المستخدم شيئاً، اعرض رسالة المسودة
    if (!forceClose && _anCurrentMode === 'new' && _anIsDirty()) {
        _anShowDraftDialog(_anCurrentComplaintId);
        return;
    }
    const m = document.getElementById('anModal');
    if (m) m.remove();
    _anCurrentComplaintId = null;
    _anCurrentMode = null;
}

/* ══════════════════════════════════════════════════════
   نظام المسودات: حفظ / استعادة محلياً
   ══════════════════════════════════════════════════════ */
let _anCurrentComplaintId = null;
let _anCurrentMode = null;
const _AN_DRAFT_KEY = 'Shaab_AuditDrafts_Local';

function _anIsDirty() {
    const ids = ['anInvNum','anInvValue','anUser','anCashier','anCameraNum','anCameraTime','anAuditor','anSupervisorAction'];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.value && el.value.trim()) return true;
    }
    const ed = document.getElementById('anDetails');
    if (ed) {
        const txt = (ed.innerText || ed.textContent || '').trim();
        if (txt) return true;
    }
    return false;
}

function _anReadCurrentForm() {
    return {
        date:               document.getElementById('anDate')?.value || '',
        time:               document.getElementById('anTime')?.value || '',
        invoiceNumber:      document.getElementById('anInvNum')?.value || '',
        invoiceValue:       document.getElementById('anInvValue')?.value || '',
        user:               document.getElementById('anUser')?.value || '',
        cashier:            document.getElementById('anCashier')?.value || '',
        branch:             document.getElementById('anBranch')?.value || '',
        details:            document.getElementById('anDetails')?.innerHTML || '',
        cameraNum:          document.getElementById('anCameraNum')?.value || '',
        cameraTime:         document.getElementById('anCameraTime')?.value || '',
        auditor:            document.getElementById('anAuditor')?.value || '',
        supervisorAction:   document.getElementById('anSupervisorAction')?.value || ''
    };
}

function _anSaveDraft(complaintId) {
    try {
        const map = JSON.parse(localStorage.getItem(_AN_DRAFT_KEY) || '{}');
        map[complaintId] = {
            ..._anReadCurrentForm(),
            complaintId: complaintId,
            savedAt: Date.now(),
            savedBy: (currentUser && currentUser.name) || '—'
        };
        localStorage.setItem(_AN_DRAFT_KEY, JSON.stringify(map));
        return true;
    } catch (e) { console.warn('[audit-note] save draft failed:', e); return false; }
}

function _anLoadDraft(complaintId) {
    try {
        const map = JSON.parse(localStorage.getItem(_AN_DRAFT_KEY) || '{}');
        return map[complaintId] || null;
    } catch { return null; }
}

function _anClearDraft(complaintId) {
    try {
        const map = JSON.parse(localStorage.getItem(_AN_DRAFT_KEY) || '{}');
        delete map[complaintId];
        localStorage.setItem(_AN_DRAFT_KEY, JSON.stringify(map));
    } catch {}
}

function _anShowDraftDialog(complaintId) {
    // أزل أي رسالة سابقة
    const old = document.getElementById('anDraftDialog');
    if (old) old.remove();

    const dlg = document.createElement('div');
    dlg.id = 'anDraftDialog';
    dlg.innerHTML = `
        <div class="an-dd-box">
            <div class="an-dd-icon">📝</div>
            <div class="an-dd-title">لديك بيانات لم تُرسَل بعد</div>
            <div class="an-dd-msg">ماذا تريد أن تفعل قبل الخروج؟</div>
            <div class="an-dd-actions">
                <button class="an-dd-btn an-dd-send" onclick="_anDraftSend(${complaintId})">📤 إرسال الرد</button>
                <button class="an-dd-btn an-dd-save" onclick="_anDraftSave(${complaintId})">💾 حفظ كمسودة</button>
                <button class="an-dd-btn an-dd-discard" onclick="_anDraftDiscard(${complaintId})">❌ إلغاء وخروج</button>
            </div>
            <div class="an-dd-hint">المسودة تُحفظ على جهازك ويمكنك العودة لها لاحقاً.</div>
        </div>
    `;
    document.body.appendChild(dlg);
}

function _anDraftSend(complaintId) {
    const dlg = document.getElementById('anDraftDialog'); if (dlg) dlg.remove();
    if (typeof submitAuditNote === 'function') submitAuditNote(complaintId);
}
function _anDraftSave(complaintId) {
    if (_anSaveDraft(complaintId)) {
        const dlg = document.getElementById('anDraftDialog'); if (dlg) dlg.remove();
        closeAuditNoteModal(true);
        alert('💾 تم حفظ المسودة — يمكنك العودة لها لاحقاً عند فتح النموذج لنفس الشكوى.');
    } else {
        alert('⚠️ تعذّر حفظ المسودة');
    }
}
function _anDraftDiscard(complaintId) {
    _anClearDraft(complaintId);
    const dlg = document.getElementById('anDraftDialog'); if (dlg) dlg.remove();
    closeAuditNoteModal(true);
}

/* ══════════════════════════════════════════════════════
   إرسال النموذج — التحقق من الحقول وحفظه
   ══════════════════════════════════════════════════════ */
function submitAuditNote(complaintId, mode) {
    const errEl = document.getElementById('anErr');
    const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); } };

    const _detEl = document.getElementById('anDetails');
    const _detHtml = _detEl ? _detEl.innerHTML.trim() : '';
    const _detText = _detEl ? (_detEl.innerText || _detEl.textContent || '').trim() : '';

    const fields = {
        date:               document.getElementById('anDate').value.trim(),
        time:               document.getElementById('anTime').value.trim(),
        invoiceNumber:      document.getElementById('anInvNum').value.trim(),
        invoiceValue:       document.getElementById('anInvValue').value.trim(),
        user:               document.getElementById('anUser').value.trim(),
        cashier:            document.getElementById('anCashier').value.trim(),
        branch:             document.getElementById('anBranch').value.trim(),
        details:            _detHtml,
        cameraNum:          document.getElementById('anCameraNum').value.trim(),
        cameraTime:         document.getElementById('anCameraTime').value.trim(),
        auditor:            document.getElementById('anAuditor').value.trim(),
        supervisorAction:   (document.getElementById('anSupervisorAction')?.value || '').trim()
    };

    const requiredKeys = ['date','time','invoiceNumber','invoiceValue','user','cashier','cameraNum','cameraTime','auditor'];
    const missing = requiredKeys.find(k => !fields[k]);
    if (missing) {
        showErr('⚠️ يرجى تعبئة جميع الحقول — حقل "' + _anFieldLabel(missing) + '" مفقود');
        return;
    }
    if (!_detText) {
        showErr('⚠️ يرجى كتابة تفاصيل التدقيق');
        return;
    }

    if (!db.auditNotes) db.auditNotes = [];

    if (mode === 'edit') {
        // تعديل سجل موجود (لمدير قسم السيطرة فقط)
        const _isCtrlMgr = currentUser && (currentUser.title === 'مدير قسم السيطرة' || currentUser.empId === '1111');
        if (!_isCtrlMgr) { alert('ليس لديك صلاحية تعديل'); return; }
        const existing = db.auditNotes.find(n => !n.deleted && n.complaintId == complaintId);
        if (!existing) { alert('السجل الأصلي لم يعد موجوداً'); return; }
        Object.assign(existing, fields);
        existing.editedBy   = (currentUser && currentUser.name)  || '—';
        existing.editedByEmpId = (currentUser && currentUser.empId) || '—';
        existing.editedAt   = Date.now();
        existing.editedIso  = new Date().toISOString();
        // 🛡️ نحفظ في مفتاح مستقلّ (Shaab_AuditNotes_DB) لتفادي تعارض إصدار master_DB
        if (typeof saveAuditNotes === 'function') saveAuditNotes();
        else if (typeof save === 'function') save();
        if (typeof _logAudit === 'function') _logAudit('editAuditNote', fields.branch, `تعديل تدقيق #${fields.invoiceNumber}`, 'auditNote', existing.id);
        closeAuditNoteModal();
        alert('✅ تم حفظ التعديلات على النموذج');
        return;
    }

    // إنشاء جديد
    const note = {
        id: Date.now(),
        complaintId: complaintId,
        ...fields,
        addedBy: (currentUser && currentUser.name) || '—',
        addedByEmpId: (currentUser && currentUser.empId) || '—',
        addedAt: Date.now(),
        iso: new Date().toISOString(),
        deleted: false
    };

    db.auditNotes.unshift(note);
    // 🛡️ نحفظ في مفتاح مستقلّ (Shaab_AuditNotes_DB) لتفادي تعارض إصدار master_DB
    if (typeof saveAuditNotes === 'function') saveAuditNotes();
    else if (typeof save === 'function') save();
    if (typeof _logAudit === 'function') _logAudit('addAuditNote', fields.branch, `تدقيق فاتورة #${fields.invoiceNumber}`, 'auditNote', note.id);

    // نجاح الإرسال — امسح المسودة المحلية إن وُجدت
    _anClearDraft(complaintId);

    closeAuditNoteModal(true);  // إغلاق إجباري بدون مربع المسودة
    alert('✅ تم إرسال نموذج التدقيق إلى مدير السيطرة');
}

function _anFieldLabel(key) {
    const map = {
        date:'اليوم', time:'الوقت', invoiceNumber:'رقم الفاتورة', invoiceValue:'قيمة الفاتورة',
        user:'اليوزر', cashier:'اسم الكاشير', branch:'الفرع',
        details:'تفاصيل التدقيق',
        cameraNum:'رقم الكاميرا', cameraTime:'وقت الكاميرا',
        auditor:'المدقق'
    };
    return map[key] || key;
}

/* ── حساب اسم اليوم بالعربية (للطباعة) ── */
function _anPrintDay(dateStr) {
    const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        if (!isNaN(d)) return days[d.getDay()];
    } catch {}
    return '—';
}

/* ══════════════════════════════════════════════════════
   طباعة / تصدير النموذج — نافذة منفصلة مهيّأة للطابعة
   ══════════════════════════════════════════════════════ */
function printAuditNote(complaintId) {
    const note = (db.auditNotes || []).find(n => !n.deleted && n.complaintId == complaintId);
    if (!note) { alert('لا توجد ملاحظة للطباعة'); return; }

    const linkedC = (db.complaints || []).find(c => c.id == complaintId);
    const complaintLine = linkedC
        ? `شكوى السيطرة المرتبطة: ${sanitize((linkedC.notes || '').substring(0, 100))}`
        : 'شكوى السيطرة المرتبطة: —';

    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) { alert('المتصفح يمنع فتح نوافذ — يرجى السماح بـ popups لهذا الموقع'); return; }

    w.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title> </title>
<style>
    @page { size:A4 landscape; margin:12mm 14mm; }
    * { box-sizing:border-box; }
    body {
        margin:0; padding:24px;
        font-family:'Cairo','Tajawal','Segoe UI', Tahoma, sans-serif;
        color:#3a2818; background:#fff;
        direction:rtl;
    }
    .receipt {
        max-width:760px; margin:0 auto;
        background:linear-gradient(180deg, #fdf8ef 0%, #faf2e3 100%);
        border:1.5px solid rgba(139,69,19,0.30);
        border-radius:14px;
        padding:28px 32px;
        box-shadow:0 4px 12px rgba(74,40,18,0.16);
        position:relative;
    }
    .head { text-align:center; padding-bottom:18px; border-bottom:2px dashed rgba(139,69,19,0.30); position:relative; }
    .brand { font-size:11px; font-weight:800; color:#8b6f47; letter-spacing:4px; margin-bottom:6px; text-transform:uppercase; }
    .title { font-size:22px; font-weight:900; color:#3a2818; letter-spacing:0.5px; }
    .meta-block {
        margin:14px 0 18px;
        padding:10px 14px;
        background:rgba(192,147,93,0.10);
        border:1px solid rgba(192,147,93,0.40);
        border-radius:8px;
        font-size:12px; color:#5c3919;
        line-height:1.7;
    }
    .meta-line { margin:2px 0; }
    .meta-line b { color:#3a2818; }
    table.fields {
        width:100%; border-collapse:collapse; margin-top:14px;
        font-size:13px;
    }
    table.fields td {
        border:1px solid rgba(139,69,19,0.25);
        padding:9px 12px;
        background:#fff;
    }
    table.fields td.label {
        background:#fbf3df;
        font-weight:800; color:#5c3919;
        white-space:nowrap;
        text-align:center;
    }
    table.fields-6 td.label {
        font-size:12px; width:16.66%;
    }
    table.fields-6 td:not(.label) {
        text-align:center; font-weight:700; font-size:13px;
    }
    /* أعمدة 8 — أحجام مخصصة: الوقت أضيق، اليوم أعرض */
    table.fields-8 col.col-day      { width:16%; }
    table.fields-8 col.col-time     { width:9%; }
    table.fields-8 col.col-invnum   { width:11%; }
    table.fields-8 col.col-invval   { width:12%; }
    table.fields-8 col.col-user     { width:11%; }
    table.fields-8 col.col-cashier  { width:13%; }
    table.fields-8 col.col-camnum   { width:11%; }
    table.fields-8 col.col-camtime  { width:9%; }
    table.fields-8 td.label {
        font-size:13px; padding:6px 4px; font-weight:900;
    }
    table.fields-8 td:not(.label) {
        text-align:center; font-weight:700; font-size:11.5px; padding:6px 4px;
    }
    .notes-area {
        margin-top:12px;
        background:linear-gradient(135deg, #fff5dc 0%, #ffe9c2 100%);
        border:1.5px solid rgba(192,147,93,0.45);
        border-radius:10px; padding:8px;
        display:flex; flex-direction:column;
        flex:1 1 auto;
    }
    /* البوكس الأبيض الكبير الذي يحوي البيانات + الكتابة */
    .notes-box {
        background:#fff;
        border:1.5px solid rgba(139,69,19,0.30);
        border-radius:8px;
        padding:8px 12px 10px;
        display:flex; flex-direction:column;
        flex:1 1 auto;
    }
    .notes-top {
        display:flex; gap:8px; flex-wrap:wrap; align-items:center;
        padding-bottom:8px;
        border-bottom:1.5px dashed rgba(139,69,19,0.25);
        font-size:12px; margin-bottom:8px;
    }
    .auditor-bottom {
        display:flex; justify-content:flex-end;
        margin-top:8px; padding-top:8px;
        border-top:1.5px dashed rgba(139,69,19,0.25);
    }
    .notes-top .cam-cell { color:#3a2818; font-weight:700; }
    .notes-top .cam-cell b { color:#5c3919; }
    .notes-top .seps {
        font-weight:900; color:#a07838; letter-spacing:1px; font-size:13px;
    }
    .prefix-label {
        font-size:13px; font-weight:900;
        color:#075e54;
        background:linear-gradient(135deg, rgba(37,211,102,0.16), rgba(37,211,102,0.06));
        border:1.2px solid rgba(37,211,102,0.45);
        padding:3px 10px; border-radius:8px;
        letter-spacing:0.3px;
    }
    .auditor-inline {
        display:inline-flex; align-items:center; gap:6px;
        margin-inline-start:auto;
        padding:3px 10px;
        background:rgba(212,170,90,0.10);
        border:1px solid rgba(139,69,19,0.25);
        border-radius:8px;
    }
    .auditor-inline-label {
        font-size:12.5px; font-weight:900; color:#5c3919;
        letter-spacing:0.5px;
    }
    .auditor-inline-name {
        font-size:12.5px; font-weight:800; color:#3a2818;
        border-bottom:1.5px solid #5c3919;
        padding:1px 10px;
        min-width:160px;
        display:inline-block;
    }
    .notes-box {
        position:relative;
    }
    .notes-body::before {
        content: 'بعد المتابعة والتدقيق : ';
        font-family: Arial, 'Tahoma', sans-serif;
        font-weight: 900;
        color:#075e54;
        display:inline;
    }
    .notes-body {
        padding:8px 6px 50px;
        min-height:60mm;
        font-family: Arial, 'Tahoma', sans-serif;
        font-weight: bold;
        font-size:14px; line-height:1.9; color:#3a2818;
        flex:1 1 auto;
        background:transparent;
    }
    /* المدقق pill عائم في الزاوية السفلى اليسرى بصرياً */
    .auditor-bottom {
        position:absolute;
        bottom:8px; left:10px;
    }
    /* إجراء المسؤول pill عائم في الزاوية السفلى اليمنى */
    .supervisor-bottom {
        position:absolute;
        bottom:8px; right:10px;
    }
    .supervisor-inline {
        background:rgba(21,101,192,0.10) !important;
        border-color:rgba(21,101,192,0.30) !important;
    }
    .supervisor-inline .auditor-inline-label {
        color:#1565c0 !important;
    }
    .controls {
        max-width:760px; margin:14px auto 0; text-align:center;
    }
    .controls button {
        font-family:'Cairo', sans-serif; font-size:13.5px; font-weight:800;
        padding:9px 24px; border:none; border-radius:8px;
        cursor:pointer; margin:0 4px;
        transition:filter 0.15s;
    }
    .btn-print {
        background:linear-gradient(135deg, #2e7d32, #1b5e20);
        color:#fff; box-shadow:0 3px 8px rgba(46,125,50,0.32);
    }
    .btn-print:hover { filter:brightness(1.10); }
    .btn-close {
        background:#fff; color:#5c3919;
        border:1.5px solid rgba(139,69,19,0.30) !important;
    }
    @media print {
        @page {
            /* أفقي على A4 (297 × 210 mm) — landscape بهوامش صفر */
            size:A4 landscape;
            margin:0;
        }
        *, *::before, *::after {
            -webkit-print-color-adjust:exact !important;
            print-color-adjust:exact !important;
            color-adjust:exact !important;
        }
        html, body {
            margin:0; padding:0; background:#fff;
            -webkit-print-color-adjust:exact;
            print-color-adjust:exact;
            width:297mm; height:210mm;
            overflow:hidden;   /* امنع تجاوز الصفحة */
        }
        body {
            padding:4mm 5mm !important;
            box-sizing:border-box;
            width:297mm; height:210mm;
        }
        .controls { display:none !important; }
        .receipt {
            box-shadow:none !important;
            border:1.5px solid rgba(139,69,19,0.40) !important;
            /* يملأ الصفحة A4 landscape (210 - 8 = 202 mm) */
            height:calc(210mm - 8mm) !important;
            max-height:calc(210mm - 8mm) !important;
            width:calc(297mm - 10mm) !important;
            max-width:none !important;
            margin:0 !important;
            padding:5mm 8mm 5mm 8mm !important;
            display:flex; flex-direction:column;
            page-break-inside:avoid;
            overflow:hidden;
        }
        /* الترويسة مضغوطة */
        .head { padding-bottom:4mm !important; }
        .brand { font-size:9px !important; letter-spacing:3px !important; margin-bottom:2px !important; }
        .title { font-size:18px !important; }
        .meta-block { margin:3mm 0 3mm !important; padding:4px 10px !important; font-size:11px !important; }
        /* الجدول مضغوط */
        table.fields { margin-top:2mm !important; }
        table.fields-8 td.label { font-size:11px !important; padding:3px 3px !important; }
        table.fields-8 td:not(.label) { font-size:11px !important; padding:4px 3px !important; }
        /* منطقة الملاحظات تأخذ كل الباقي */
        .notes-area {
            flex:1 1 auto !important;
            margin-top:3mm !important;
            padding:5px !important;
            display:flex; flex-direction:column;
            min-height:0;
        }
        .notes-box {
            flex:1 1 auto !important;
            padding:6px 10px 26px 10px !important;
            display:flex; flex-direction:column;
            min-height:0; overflow:hidden;
        }
        .notes-body {
            flex:1 1 auto !important;
            min-height:0 !important;
            padding:4px 4px 4px 4px !important;
            font-size:13px !important;
            line-height:1.7 !important;
            overflow:hidden;
        }
        .auditor-bottom { bottom:4px !important; left:6px !important; }
        .supervisor-bottom { bottom:4px !important; right:6px !important; }
        .auditor-inline { padding:2px 8px !important; }
        .auditor-inline-name { padding:1px 8px !important; font-size:11.5px !important; min-width:130px !important; }
        .auditor-inline-label { font-size:11.5px !important; }
    }
</style>
</head>
<body>
    <div class="receipt">
        <div class="head">
            <div class="brand">🙦 شركة برافو لصناعة المكسرات والشوكولاتة. 🙤</div>
            <div class="title">تدقيق</div>
        </div>

        <div class="meta-block">
            <div class="meta-line">
                <b>🔗 شكوى السيطرة المرتبطة:</b>
                ${sanitize((linkedC && linkedC.notes) ? linkedC.notes.substring(0, 140) + ((linkedC.notes.length > 140) ? '…' : '') : '—')}
                <span style="color:#a07838;font-weight:900;margin:0 6px;">//</span>
                <b>الفرع:</b> ${sanitize(note.branch || (linkedC && linkedC.branch) || '—')}
            </div>
        </div>

        <table class="fields fields-8">
            <colgroup>
                <col class="col-day"><col class="col-time"><col class="col-invnum"><col class="col-invval">
                <col class="col-user"><col class="col-cashier"><col class="col-camnum"><col class="col-camtime">
            </colgroup>
            <tr>
                <td class="label">اليوم</td>
                <td class="label">الوقت</td>
                <td class="label">رقم الفاتورة</td>
                <td class="label">قيمة الفاتورة</td>
                <td class="label">اليوزر</td>
                <td class="label">اسم الكاشير</td>
                <td class="label">📷 رقم الكاميرا</td>
                <td class="label">⏰ وقت الكاميرا</td>
            </tr>
            <tr>
                <td>
                    <span style="font-size:11px;color:#7a4a26;font-weight:700;background:rgba(192,147,93,0.15);padding:1px 6px;border-radius:5px;margin-left:6px;">${sanitize(_anPrintDay(note.date))}</span>
                    ${sanitize(note.date)}
                </td>
                <td>${sanitize(note.time)}</td>
                <td>${sanitize(note.invoiceNumber)}</td>
                <td>${sanitize(note.invoiceValue)}</td>
                <td>${sanitize(note.user)}</td>
                <td>${sanitize(note.cashier)}</td>
                <td>${sanitize(note.cameraNum || '—')}</td>
                <td>${sanitize(note.cameraTime || '—')}</td>
            </tr>
        </table>

        <div class="notes-area">
            <div class="notes-box">
                <div class="notes-body">${(note.details || '—').replace(/^بعد المتابعة والتدقيق\s*:\s*/, '')}</div>
                <div class="auditor-bottom">
                    <span class="auditor-inline">
                        <b class="auditor-inline-label">المدقق :</b>
                        <span class="auditor-inline-name">${sanitize(note.auditor)}</span>
                    </span>
                </div>
                <div class="supervisor-bottom">
                    <span class="auditor-inline supervisor-inline">
                        <b class="auditor-inline-label">إجراء المسؤول :</b>
                        <span class="auditor-inline-name">${sanitize(note.supervisorAction || '—')}</span>
                    </span>
                </div>
            </div>
        </div>
    </div>

    <div class="controls">
        <button class="btn-print" onclick="window.print()">🖨️ طباعة</button>
        <button class="btn-close" onclick="window.close()">إغلاق</button>
    </div>

    <script>
        // افتح حوار الطباعة تلقائياً بعد لحظات (يتيح للنظام أن يحضّر الخطوط أولاً)
        setTimeout(() => { window.print(); }, 300);
    </script>
</body>
</html>`);
    w.document.close();
    w.focus();
}

/* ══════════════════════════════════════════════════════
   تحقّق إن كان لشكوى ملاحظة سيطرة سابقة (للزر has-note)
   ══════════════════════════════════════════════════════ */
function hasAuditNote(complaintId) {
    return (db.auditNotes || []).some(n => !n.deleted && n.complaintId == complaintId);
}

/* ══════════════════════════════════════════════════════
   الانتقال من شكوى سيطرة إلى ملاحظتها في تاب «متابعات موظفي السيطرة»
   ══════════════════════════════════════════════════════ */
function jumpToAuditNoteFromComplaint(complaintId) {
    if (typeof switchTab !== 'function') return;
    switchTab('an');
    setTimeout(() => {
        const card = document.querySelector(`[data-an-cid="${complaintId}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const prevShadow = card.style.boxShadow;
        const prevBg     = card.style.background;
        card.style.boxShadow  = '0 0 0 3px #2e7d32, 0 8px 18px rgba(46,125,50,0.32)';
        card.style.background = 'linear-gradient(180deg,rgba(46,125,50,0.18),rgba(46,125,50,0.06))';
        setTimeout(() => {
            card.style.boxShadow  = prevShadow;
            card.style.background = prevBg;
        }, 2400);
    }, 320);
}

/* ══════════════════════════════════════════════════════
   الانتقال من ملاحظة سيطرة إلى الشكوى المرتبطة
   ══════════════════════════════════════════════════════ */
function jumpToComplaintFromAudit(complaintId) {
    closeAuditNoteModal();
    // استخدم الدالة الموجودة في control.js — تنتقل وتُبرز الصف
    if (typeof jumpToComplaint === 'function') {
        jumpToComplaint(complaintId);
    } else if (typeof switchTab === 'function') {
        // fallback آمن
        switchTab('c');
        setTimeout(() => {
            const row = document.querySelector(`#tableC tbody tr[data-id="${complaintId}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.boxShadow = 'inset 0 0 0 3px #2e7d32';
                setTimeout(() => { row.style.boxShadow = ''; }, 2500);
            }
        }, 300);
    }
}

/* ══════════════════════════════════════════════════════
   تاب «متابعات موظفي السيطرة» — لمدير السيطرة فقط
   ══════════════════════════════════════════════════════ */
function renderAuditNotes() {
    const container = document.getElementById('auditNotesContainer');
    if (!container) return;

    const notes = (db.auditNotes || []).filter(n => !n.deleted);
    if (!notes.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-dim);">
                <div style="font-size:48px;margin-bottom:12px;opacity:0.4;">📋</div>
                <div style="font-size:14px;font-weight:700;">لا توجد ملاحظات سيطرة بعد</div>
                <div style="font-size:12px;margin-top:6px;opacity:0.7;">عندما يُرسل موظف سيطرة نموذج تدقيق، سيظهر هنا</div>
            </div>`;
        return;
    }

    container.innerHTML = notes.map(n => {
        const linkedC = (db.complaints || []).find(c => c.id == n.complaintId);
        const complaintInfo = linkedC
            ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:4px;">🔗 شكوى السيطرة: <b style="color:#90caf9;">${sanitize((linkedC.notes || '').substring(0, 60))}${(linkedC.notes || '').length > 60 ? '…' : ''}</b></div>`
            : `<div style="font-size:11.5px;color:#ef9a9a;margin-top:4px;">⚠️ الشكوى المرتبطة لم تعد موجودة</div>`;
        const detailsPreview = n.details
            ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(212,170,90,0.08);border-right:3px solid rgba(212,170,90,0.5);border-radius:6px;font-size:12.5px;color:var(--text-main);line-height:1.6;">
                <b style="color:#d4aa5a;">📝 الملاحظات:</b> ${sanitize((n.details || '').substring(0, 200))}${(n.details || '').length > 200 ? '…' : ''}
              </div>` : '';
        return `
        <div data-an-cid="${n.complaintId}" style="background:linear-gradient(180deg,rgba(46,125,50,0.05),rgba(46,125,50,0.02));border:1px solid rgba(46,125,50,0.22);border-radius:12px;padding:14px 16px;margin-bottom:12px;transition:box-shadow 0.4s, background 0.4s;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:220px;">
                    <div style="font-size:14px;font-weight:800;color:var(--text-main);">
                        🏪 ${sanitize(n.branch)} <span style="color:var(--text-dim);font-weight:500;font-size:12px;">— فاتورة #${sanitize(n.invoiceNumber)}</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-dim);margin-top:3px;">
                        📅 ${sanitize(n.date)} ${sanitize(n.time)} · المدقق: <b style="color:#a5d6a7;">${sanitize(n.auditor)}</b> · أرسلها: ${sanitize(n.addedBy)}
                    </div>
                    ${complaintInfo}
                    ${detailsPreview}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="openAuditNoteModal(${n.complaintId})" style="background:#2e7d32;color:#fff;border:none;cursor:pointer;font-family:Cairo;font-weight:700;padding:6px 12px;font-size:12px;border-radius:7px;">📋 عرض النموذج</button>
                    ${linkedC ? `<button onclick="jumpToComplaintFromAudit(${n.complaintId})" style="background:#1565c0;color:#fff;border:none;cursor:pointer;font-family:Cairo;font-weight:700;padding:6px 12px;font-size:12px;border-radius:7px;">🔙 الشكوى المرتبطة</button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ══════════════════════════════════════════════════════
   شرط الوصول لتاب «متابعات موظفي السيطرة»:
   فقط مدير السيطرة (cc_manager) و admin
   ══════════════════════════════════════════════════════ */
function canSeeAuditNotesTab() {
    if (!currentUser) return false;
    if (currentUser.title === 'مدير قسم السيطرة') return true;
    if (currentUser.empId === '1111') return true;
    return false;
}

/* ── تنسيق آمن للنصوص إن لم تكن sanitize موجودة ── */
if (typeof sanitize !== 'function') {
    window.sanitize = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── تصدير عام ──
window.openAuditNoteModal       = openAuditNoteModal;
window.closeAuditNoteModal      = closeAuditNoteModal;
window.submitAuditNote          = submitAuditNote;
window.hasAuditNote             = hasAuditNote;
window.jumpToComplaintFromAudit = jumpToComplaintFromAudit;
window.renderAuditNotes         = renderAuditNotes;
window.canSeeAuditNotesTab      = canSeeAuditNotesTab;
window._anNotifyAlreadyFilled   = _anNotifyAlreadyFilled;
window.printAuditNote           = printAuditNote;
window.jumpToAuditNoteFromComplaint = jumpToAuditNoteFromComplaint;
window._anSyncDayName = _anSyncDayName;
window._anZoomSelection = _anZoomSelection;
window._anBindZoomWheel = _anBindZoomWheel;
window._anApplyFontPrefs = _anApplyFontPrefs;
window._anSavePrefs = _anSavePrefs;
window._anLoadPrefs = _anLoadPrefs;
window._anDraftSend    = _anDraftSend;
window._anDraftSave    = _anDraftSave;
window._anDraftDiscard = _anDraftDiscard;

/* ══════════════════════════════════════════════════════
   حقن CSS فور تحميل الملف — لكي يحصل زر «📋 ملاحظات السيطرة»
   على تصميمه الكامل (shimmer + breathing + badge) من اللحظة
   التي يُرسم فيها بواسطة render.js، لا فقط بعد فتح المودال.
   ══════════════════════════════════════════════════════ */
(function _anInjectStylesEarly() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _anEnsureStyles, { once: true });
    } else {
        _anEnsureStyles();
    }
})();
