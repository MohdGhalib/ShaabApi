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

        /* ──────── Wrap ──────── */
        #anModal .an-wrap {
            max-width:720px; width:100%; max-height:92vh;
            display:flex; flex-direction:column;
            animation:_anSlideUp 0.45s cubic-bezier(0.34,1.3,0.64,1);
        }

        /* ──────── الشريط العلوي الأخضر (مطابق لـ c360) ──────── */
        #anModal .an-instruction {
            background:linear-gradient(135deg,#25d366 0%,#128c7e 50%,#075e54 100%);
            color:#fff; padding:14px 22px; border-radius:18px 18px 0 0;
            display:flex; align-items:center; gap:14px;
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
            width:38px; height:38px; background:rgba(255,255,255,0.22);
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            font-size:19px; flex-shrink:0; border:1.5px solid rgba(255,255,255,0.35);
        }
        #anModal .an-instruction-text {
            font-size:13.5px; font-weight:800; line-height:1.55; letter-spacing:0.2px;
            text-shadow:0 1px 2px rgba(0,0,0,0.25);
            flex:1;
        }

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

        /* ──────── رأس الإيصال (مطابق لـ c360) ──────── */
        #anModal .an-receipt-head {
            padding:24px 28px 18px; text-align:center;
            border-bottom:2px dashed rgba(139,69,19,0.22);
            position:relative;
        }
        #anModal .an-brand {
            font-size:10.5px; font-weight:800; color:#8b6f47;
            letter-spacing:4px; margin-bottom:8px; text-transform:uppercase;
        }
        #anModal .an-receipt-title {
            font-size:20px; font-weight:900; color:#3a2818;
            letter-spacing:0.3px; line-height:1.4;
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

        /* ──────── جسم الفورم ──────── */
        #anModal .an-body {
            overflow-y:auto; padding:14px 28px 20px; flex:1; min-height:0;
            position:relative;
        }
        #anModal .an-section { margin-top:14px; }
        #anModal .an-section-title {
            font-size:13.5px; font-weight:900; color:#5c3919;
            margin-bottom:10px;
            display:flex; align-items:center; gap:8px;
            letter-spacing:0.3px;
        }

        /* صفوف الحقول */
        #anModal .an-row {
            display:grid; gap:10px 12px;
            background:#fff;
            border:1.5px solid rgba(139,69,19,0.18);
            border-radius:12px; padding:12px;
            box-shadow:0 2px 6px rgba(139,69,19,0.05);
        }
        #anModal .an-row-5 { grid-template-columns:repeat(5, minmax(0,1fr)); }
        #anModal .an-row-4 { grid-template-columns:repeat(4, minmax(0,1fr)); }
        #anModal .an-field { display:flex; flex-direction:column; gap:5px; }

        #anModal .an-field label {
            font-size:11.5px; font-weight:800; color:#5c3919;
            display:flex; align-items:center; gap:5px;
            letter-spacing:0.2px;
        }
        #anModal .an-field label .req { color:#c62828; font-size:13px; line-height:0; }
        #anModal .an-field input,
        #anModal .an-field textarea,
        #anModal .an-field select {
            font-family:'Cairo','Tajawal',sans-serif;
            font-size:13px; padding:9px 12px;
            border:1.5px solid rgba(139,69,19,0.22);
            border-radius:10px;
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

        /* منطقة الكتابة الكبيرة (تشبه شريط الملخّص في c360 لكن للكتابة) */
        #anModal .an-notes-area {
            background:linear-gradient(135deg, #fff5dc 0%, #ffe9c2 100%);
            border:1.5px solid rgba(192,147,93,0.45);
            border-radius:14px;
            padding:14px 16px;
            box-shadow:0 1px 3px rgba(139,69,19,0.08);
        }
        #anModal .an-notes-label {
            font-size:12.5px; font-weight:800; color:#5c3919;
            margin-bottom:8px; letter-spacing:0.3px;
            display:flex; align-items:center; gap:5px;
        }
        #anModal .an-notes-label .req { color:#c62828; font-size:13px; line-height:0; }
        #anModal .an-notes-pad {
            width:100%; box-sizing:border-box;
            min-height:140px; resize:vertical;
            padding:11px 14px;
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

        /* قسم المدقق */
        #anModal .an-auditor-section {
            text-align:center;
            padding:18px 16px 8px;
            border-top:2px dashed rgba(139,69,19,0.22);
            margin-top:8px;
        }
        #anModal .an-auditor-label {
            font-size:11px; font-weight:800; color:#8b6f47;
            letter-spacing:5px; margin-bottom:10px;
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

        /* الأزرار السفلية */
        #anModal .an-footer {
            padding:16px 28px 18px;
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

    const v = (k, def='') => existing ? (existing[k] ?? def) : def;
    const readonly = (mode === 'view') ? 'readonly' : '';
    const isView = (mode === 'view');
    const isEdit = (mode === 'edit');

    const modal = document.createElement('div');
    modal.id = 'anModal';
    if (isEdit) modal.classList.add('an-mode-edit');
    modal.innerHTML = `
        <div class="an-wrap">
            <div class="an-instruction">
                <div class="an-instruction-icon">${isView ? '📋' : (isEdit ? '✏️' : '✍️')}</div>
                <div class="an-instruction-text">
                    ${isView
                        ? 'نموذج تدقيق مُرسَل — اطلاعك على المحتوى فقط'
                        : (isEdit
                            ? 'تعديل نموذج التدقيق — مدير قسم السيطرة'
                            : 'نموذج تدقيق السيطرة — املأ التفاصيل بدقة')}
                </div>
            </div>
            <div class="an-receipt">
                <button class="an-close" onclick="closeAuditNoteModal()" title="إغلاق">✕</button>
                <span class="an-bean an-b1">☕</span>
                <span class="an-bean an-b2">☕</span>

                <div class="an-receipt-head">
                    <div class="an-brand">شركة محامص الشعب</div>
                    <div class="an-receipt-title">نموذج تدقيق سيطرة</div>
                    <div class="an-stamp">تدقيق رسمي</div>
                </div>

                <div class="an-body">
                    <!-- الصف الأول: 5 حقول -->
                    <div class="an-section">
                        <div class="an-section-title">📅 بيانات الفاتورة</div>
                        <div class="an-row an-row-5">
                            <div class="an-field">
                                <label>اليوم <span class="req">*</span></label>
                                <input type="date" id="anDate" ${readonly} value="${v('date', dateStr)}">
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
                        </div>
                    </div>

                    <!-- الصف الثاني: 4 حقول -->
                    <div class="an-section">
                        <div class="an-section-title">🏪 بيانات الفرع والإرجاع</div>
                        <div class="an-row an-row-4">
                            <div class="an-field">
                                <label>الكاشير <span class="req">*</span></label>
                                <input type="text" id="anCashier" ${readonly} value="${sanitize(v('cashier'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>الفرع <span class="req">*</span></label>
                                <input type="text" id="anBranch" ${readonly} value="${sanitize(v('branch', complaint.branch || ''))}">
                            </div>
                            <div class="an-field">
                                <label>مقدار الإرجاع <span class="req">*</span></label>
                                <input type="text" id="anReturnAmt" ${readonly} value="${sanitize(v('returnAmount'))}" placeholder="—">
                            </div>
                            <div class="an-field">
                                <label>سبب الإرجاع <span class="req">*</span></label>
                                <input type="text" id="anReturnReason" ${readonly} value="${sanitize(v('returnReason'))}" placeholder="—">
                            </div>
                        </div>
                    </div>

                    <!-- منطقة الكتابة الكبيرة -->
                    <div class="an-section">
                        <div class="an-section-title">📝 ملاحظات التدقيق التفصيلية</div>
                        <div class="an-notes-area">
                            <div class="an-notes-label">اكتب التفاصيل الكاملة <span class="req">*</span></div>
                            <textarea id="anDetails" class="an-notes-pad" ${readonly} rows="6" placeholder="اكتب هنا ملاحظات السيطرة بالتفصيل ...">${sanitize(v('details'))}</textarea>
                        </div>
                    </div>

                    <!-- توقيع المدقق -->
                    <div class="an-auditor-section">
                        <div class="an-auditor-label">المدقق</div>
                        <input type="text" id="anAuditor" ${readonly} value="${sanitize(v('auditor'))}" placeholder="اسم المدقق">
                    </div>
                </div>

                <div class="an-err" id="anErr"></div>

                <div class="an-footer">
                    ${isView
                        ? `<button class="an-btn an-btn-cancel" onclick="closeAuditNoteModal()">إغلاق</button>
                           <button class="an-btn an-btn-print" onclick="printAuditNote(${complaint.id})">🖨️ تصدير وطباعة</button>
                           <button class="an-btn an-btn-submit" onclick="jumpToComplaintFromAudit(${complaint.id})">🔙 الانتقال للشكوى</button>`
                        : (isEdit
                            ? `<button class="an-btn an-btn-cancel" onclick="closeAuditNoteModal()">إلغاء</button>
                               <button class="an-btn an-btn-print" onclick="printAuditNote(${complaint.id})">🖨️ تصدير وطباعة</button>
                               <button class="an-btn an-btn-submit" onclick="submitAuditNote(${complaint.id}, 'edit')">💾 حفظ التعديلات</button>`
                            : `<button class="an-btn an-btn-cancel" onclick="closeAuditNoteModal()">إلغاء</button>
                               <button class="an-btn an-btn-submit" onclick="submitAuditNote(${complaint.id})">📤 إرسال إلى مدير السيطرة</button>`)
                    }
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // إغلاق بالضغط خارج المحتوى
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAuditNoteModal();
    });
}

function closeAuditNoteModal() {
    const m = document.getElementById('anModal');
    if (m) m.remove();
}

/* ══════════════════════════════════════════════════════
   إرسال النموذج — التحقق من الحقول وحفظه
   ══════════════════════════════════════════════════════ */
function submitAuditNote(complaintId, mode) {
    const errEl = document.getElementById('anErr');
    const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); } };

    const fields = {
        date:           document.getElementById('anDate').value.trim(),
        time:           document.getElementById('anTime').value.trim(),
        invoiceNumber:  document.getElementById('anInvNum').value.trim(),
        invoiceValue:   document.getElementById('anInvValue').value.trim(),
        user:           document.getElementById('anUser').value.trim(),
        cashier:        document.getElementById('anCashier').value.trim(),
        branch:         document.getElementById('anBranch').value.trim(),
        returnAmount:   document.getElementById('anReturnAmt').value.trim(),
        returnReason:   document.getElementById('anReturnReason').value.trim(),
        details:        document.getElementById('anDetails').value.trim(),
        auditor:        document.getElementById('anAuditor').value.trim()
    };

    const missing = Object.entries(fields).find(([k, v]) => !v);
    if (missing) {
        showErr('⚠️ يرجى تعبئة جميع الحقول — حقل "' + _anFieldLabel(missing[0]) + '" مفقود');
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
        if (typeof save === 'function') save();
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
    if (typeof save === 'function') save();
    if (typeof _logAudit === 'function') _logAudit('addAuditNote', fields.branch, `تدقيق فاتورة #${fields.invoiceNumber}`, 'auditNote', note.id);

    closeAuditNoteModal();
    alert('✅ تم إرسال نموذج التدقيق إلى مدير السيطرة');
}

function _anFieldLabel(key) {
    const map = {
        date:'اليوم', time:'الوقت', invoiceNumber:'رقم الفاتورة', invoiceValue:'قيمة الفاتورة',
        user:'اليوزر', cashier:'الكاشير', branch:'الفرع',
        returnAmount:'مقدار الإرجاع', returnReason:'سبب الإرجاع',
        details:'ملاحظات التدقيق التفصيلية', auditor:'المدقق'
    };
    return map[key] || key;
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

    const editedLine = note.editedBy
        ? `<div class="meta-line"><b>آخر تعديل:</b> ${sanitize(note.editedBy)} — ${sanitize(new Date(note.editedAt).toLocaleString('ar-EG'))}</div>`
        : '';

    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) { alert('المتصفح يمنع فتح نوافذ — يرجى السماح بـ popups لهذا الموقع'); return; }

    w.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>نموذج تدقيق — فاتورة ${sanitize(note.invoiceNumber)}</title>
<style>
    @page { size:A4; margin:15mm 12mm 18mm 12mm; }
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
    .stamp {
        position:absolute; top:6px; right:10px;
        transform:rotate(-12deg);
        border:2.5px solid #c62828; color:#c62828;
        padding:4px 12px; border-radius:6px;
        font-size:11px; font-weight:900; letter-spacing:1.5px;
        background:rgba(198,40,40,0.04);
    }
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
        width:30%; white-space:nowrap;
    }
    .notes-area {
        margin-top:18px;
        background:#fff5dc; border:1.5px solid rgba(192,147,93,0.45);
        border-radius:10px; padding:14px 16px;
    }
    .notes-title { font-size:12.5px; font-weight:800; color:#5c3919; margin-bottom:8px; letter-spacing:0.3px; }
    .notes-body {
        background:#fff; border:1.5px solid rgba(139,69,19,0.22); border-radius:8px;
        padding:12px 14px;
        min-height:120px;
        font-size:13.5px; line-height:1.8; color:#3a2818;
        white-space:pre-wrap;
    }
    .auditor {
        margin-top:26px; padding-top:18px;
        border-top:2px dashed rgba(139,69,19,0.30);
        text-align:center;
    }
    .auditor-label {
        font-size:11.5px; font-weight:800; color:#8b6f47;
        letter-spacing:5px; margin-bottom:8px; text-transform:uppercase;
    }
    .auditor-name {
        display:inline-block;
        font-size:17px; font-weight:800;
        padding:6px 24px 4px;
        border-bottom:1.5px solid #5c3919;
        color:#3a2818;
    }
    .footer-meta {
        margin-top:18px; font-size:11px; color:#8b6f47;
        text-align:center; letter-spacing:0.3px;
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
        body { padding:0; }
        .controls { display:none; }
        .receipt { box-shadow:none; border:1px solid #999; }
        .stamp { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    }
</style>
</head>
<body>
    <div class="receipt">
        <div class="head">
            <div class="brand">شركة محامص الشعب</div>
            <div class="title">نموذج تدقيق سيطرة</div>
            <div class="stamp">تدقيق رسمي</div>
        </div>

        <div class="meta-block">
            <div class="meta-line"><b>${complaintLine}</b></div>
            <div class="meta-line"><b>أرسل النموذج:</b> ${sanitize(note.addedBy || '—')} — ${sanitize(new Date(note.addedAt).toLocaleString('ar-EG'))}</div>
            ${editedLine}
        </div>

        <table class="fields">
            <tr><td class="label">📅 اليوم</td><td>${sanitize(note.date)}</td>
                <td class="label">⏰ الوقت</td><td>${sanitize(note.time)}</td></tr>
            <tr><td class="label">🧾 رقم الفاتورة</td><td>${sanitize(note.invoiceNumber)}</td>
                <td class="label">💰 قيمة الفاتورة</td><td>${sanitize(note.invoiceValue)}</td></tr>
            <tr><td class="label">👤 اليوزر</td><td>${sanitize(note.user)}</td>
                <td class="label">💼 الكاشير</td><td>${sanitize(note.cashier)}</td></tr>
            <tr><td class="label">🏪 الفرع</td><td colspan="3">${sanitize(note.branch)}</td></tr>
            <tr><td class="label">💵 مقدار الإرجاع</td><td>${sanitize(note.returnAmount)}</td>
                <td class="label">📝 سبب الإرجاع</td><td>${sanitize(note.returnReason)}</td></tr>
        </table>

        <div class="notes-area">
            <div class="notes-title">📝 ملاحظات التدقيق التفصيلية</div>
            <div class="notes-body">${sanitize(note.details || '—')}</div>
        </div>

        <div class="auditor">
            <div class="auditor-label">━━ المدقق ━━</div>
            <div class="auditor-name">${sanitize(note.auditor)}</div>
        </div>

        <div class="footer-meta">طُبع في: ${sanitize(new Date().toLocaleString('ar-EG'))}</div>
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
