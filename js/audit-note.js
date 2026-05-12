/* ══════════════════════════════════════════════════════
   AUDIT NOTE — ملاحظات السيطرة (نموذج تدقيق)
   - يُفتح من جانب «عرض المرفق» في شكاوى السيطرة
   - يحفظ في db.auditNotes
   - يظهر لمدير السيطرة في تاب "متابعات موظفي السيطرة"
   ══════════════════════════════════════════════════════ */

/* ── حقن CSS مرّة واحدة فقط ── */
function _anEnsureStyles() {
    if (document.getElementById('_anStyles')) return;

    // ── خطوط مميّزة من Google Fonts (تحميل ذكي، مرّة واحدة) ──
    if (!document.getElementById('_anFonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = '_anFonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;700&family=Amiri:wght@400;700&display=swap';
        document.head.appendChild(fontLink);
    }

    const st = document.createElement('style');
    st.id = '_anStyles';
    st.textContent = `
        /* ──────── Keyframes ──────── */
        @keyframes _anEnter   { 0% { opacity:0; transform:translateY(40px) scale(0.92) rotateX(8deg); } 100% { opacity:1; transform:translateY(0) scale(1) rotateX(0); } }
        @keyframes _anStampIn { 0% { opacity:0; transform:rotate(-25deg) scale(2.4); filter:blur(4px); } 60% { opacity:1; transform:rotate(-14deg) scale(0.92); filter:blur(0); } 100% { opacity:0.95; transform:rotate(-14deg) scale(1); filter:blur(0); } }
        @keyframes _anFieldIn { 0% { opacity:0; transform:translateX(-18px); } 100% { opacity:1; transform:translateX(0); } }
        @keyframes _anBeanFloat { 0%,100% { transform:translateY(0) rotate(0); } 50% { transform:translateY(-3px) rotate(8deg); } }
        @keyframes _anShimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }

        /* ──────── Backdrop ──────── */
        #anModal {
            position:fixed; inset:0; z-index:10000;
            background:radial-gradient(circle at 50% 30%, rgba(45,28,18,0.72), rgba(12,8,6,0.88));
            backdrop-filter:blur(8px) saturate(140%);
            display:flex; align-items:center; justify-content:center;
            padding:20px; overflow-y:auto;
            perspective:1400px;
        }
        #anModal.hidden { display:none; }

        /* ──────── Container ──────── */
        #anModal .an-wrap {
            max-width:700px; width:100%; max-height:94vh;
            display:flex; flex-direction:column;
            animation:_anEnter 0.55s cubic-bezier(0.22,1.18,0.36,1);
            transform-origin:center top;
            filter:drop-shadow(0 24px 38px rgba(0,0,0,0.45));
        }

        /* ──────── Header strip (Coffee-bar deep tone) ──────── */
        #anModal .an-instruction {
            background:
                linear-gradient(135deg, #3a2418 0%, #5d3a24 45%, #2e1810 100%);
            color:#f8e9c8; padding:16px 24px;
            border-radius:14px 14px 0 0;
            display:flex; align-items:center; gap:14px;
            box-shadow:inset 0 -2px 0 rgba(212,170,90,0.4), 0 6px 18px rgba(46,24,16,0.5);
            position:relative; overflow:hidden;
            border:1px solid rgba(212,170,90,0.28);
            border-bottom:none;
        }
        #anModal .an-instruction::before {
            content:''; position:absolute; inset:0;
            background:
                repeating-linear-gradient(45deg, transparent 0 14px, rgba(212,170,90,0.06) 14px 16px),
                radial-gradient(circle at 10% 20%, rgba(212,170,90,0.12) 0%, transparent 50%);
            pointer-events:none;
        }
        #anModal .an-instruction-icon {
            width:42px; height:42px;
            background:linear-gradient(135deg,#d4aa5a,#a07838);
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:20px; flex-shrink:0; position:relative; z-index:1;
            box-shadow:0 0 0 3px rgba(212,170,90,0.18), inset 0 -2px 4px rgba(0,0,0,0.18);
        }
        #anModal .an-instruction-text {
            font-family:'Reem Kufi', 'Cairo', sans-serif;
            font-size:15px; font-weight:700; line-height:1.5; letter-spacing:0.4px;
            text-shadow:0 1px 2px rgba(0,0,0,0.4);
            position:relative; z-index:1;
        }
        #anModal .an-instruction-close {
            margin-inline-start:auto; position:relative; z-index:1;
            background:rgba(248,233,200,0.12); color:#f8e9c8;
            border:1px solid rgba(248,233,200,0.20);
            width:34px; height:34px; border-radius:50%;
            font-size:15px; font-weight:700; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            transition:background 0.22s, transform 0.18s;
        }
        #anModal .an-instruction-close:hover { background:rgba(248,233,200,0.22); transform:rotate(90deg); }

        /* ──────── Aged paper receipt ──────── */
        #anModal .an-receipt {
            background:
                /* paper noise texture (SVG) */
                url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.42, 0 0 0 0 0.28, 0 0 0 0 0.16, 0 0 0 0.08 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"),
                radial-gradient(ellipse at 15% 0%, rgba(160,120,56,0.16) 0%, transparent 40%),
                radial-gradient(ellipse at 85% 100%, rgba(160,120,56,0.14) 0%, transparent 40%),
                linear-gradient(180deg, #fbf3df 0%, #f5ead0 100%);
            border:1.5px solid rgba(139,89,40,0.30);
            border-top:none;
            border-radius:0 0 14px 14px;
            padding:32px 36px 28px 36px;
            box-shadow:
                inset 0 2px 0 rgba(212,170,90,0.4),
                inset 0 0 0 2px rgba(255,255,255,0.30),
                0 6px 14px rgba(74,40,18,0.20);
            overflow-y:auto;
            position:relative;
            font-family:'Cairo', sans-serif;
            color:#3a2418;
        }
        /* خاتم شمعي في الزاوية */
        #anModal .an-receipt::before {
            content:'تدقيق'; position:absolute; top:14px; left:24px;
            font-family:'Reem Kufi', sans-serif;
            font-size:11px; font-weight:700; letter-spacing:3px;
            color:#7a3d1f;
            background:radial-gradient(circle, #c1572b 0%, #8a3617 70%);
            color:#f8e9c8;
            width:64px; height:64px; border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            transform:rotate(-14deg);
            box-shadow:
                inset 0 -2px 6px rgba(0,0,0,0.32),
                inset 0 2px 6px rgba(255,255,255,0.22),
                0 3px 8px rgba(122,61,31,0.5);
            border:2px dashed rgba(248,233,200,0.5);
            opacity:0;
            animation:_anStampIn 0.7s 0.4s cubic-bezier(0.4,1.6,0.6,1) forwards;
            pointer-events:none;
        }
        /* حبات بُن متناثرة (زخرفية) */
        #anModal .an-receipt::after {
            content:'';
            position:absolute; bottom:0; left:0; right:0; height:14px;
            background:
                radial-gradient(ellipse 6px 8px at 8% 50%, #6b3a1a 0%, transparent 60%),
                radial-gradient(ellipse 6px 8px at 22% 50%, #6b3a1a 0%, transparent 60%),
                radial-gradient(ellipse 6px 8px at 36% 50%, #6b3a1a 0%, transparent 60%),
                radial-gradient(ellipse 6px 8px at 50% 50%, #6b3a1a 0%, transparent 60%),
                radial-gradient(ellipse 6px 8px at 64% 50%, #6b3a1a 0%, transparent 60%),
                radial-gradient(ellipse 6px 8px at 78% 50%, #6b3a1a 0%, transparent 60%),
                radial-gradient(ellipse 6px 8px at 92% 50%, #6b3a1a 0%, transparent 60%);
            opacity:0.16;
            pointer-events:none;
        }

        /* ──────── Title with calligraphic flourishes ──────── */
        #anModal .an-title {
            font-family:'Reem Kufi', 'Cairo', serif;
            text-align:center; font-size:30px; font-weight:700;
            color:#2e1810; letter-spacing:2px;
            padding:6px 0 16px; margin-bottom:6px;
            position:relative;
            text-shadow:0 1px 0 rgba(255,255,255,0.6);
        }
        #anModal .an-title::before, #anModal .an-title::after {
            content:'❖'; color:#a07838; font-size:14px;
            position:relative; top:-6px; margin:0 12px;
            animation:_anBeanFloat 3s ease-in-out infinite;
        }
        #anModal .an-title-sub {
            text-align:center;
            font-family:'Amiri', serif;
            font-size:13px; color:#7a4a26;
            letter-spacing:5px; font-style:italic;
            margin-bottom:24px;
        }
        #anModal .an-title-sub::before, #anModal .an-title-sub::after {
            content:'•'; margin:0 10px; color:#a07838;
        }

        /* ──────── Rows (مطابقة لجدول الورد الأصلي) ──────── */
        #anModal .an-row {
            display:grid; gap:12px 14px;
            margin-bottom:14px;
            padding:14px 14px 12px;
            background:rgba(255,253,247,0.36);
            border:1px solid rgba(139,89,40,0.18);
            border-radius:8px;
            box-shadow:inset 0 1px 0 rgba(255,255,255,0.5);
        }
        #anModal .an-row-5 { grid-template-columns:repeat(5, minmax(0,1fr)); }
        #anModal .an-row-4 { grid-template-columns:repeat(4, minmax(0,1fr)); }
        #anModal .an-field { display:flex; flex-direction:column; gap:5px; opacity:0; animation:_anFieldIn 0.45s cubic-bezier(0.3,1.1,0.5,1) forwards; }
        #anModal .an-row-5 .an-field:nth-child(1) { animation-delay:0.10s; }
        #anModal .an-row-5 .an-field:nth-child(2) { animation-delay:0.15s; }
        #anModal .an-row-5 .an-field:nth-child(3) { animation-delay:0.20s; }
        #anModal .an-row-5 .an-field:nth-child(4) { animation-delay:0.25s; }
        #anModal .an-row-5 .an-field:nth-child(5) { animation-delay:0.30s; }
        #anModal .an-row-4 .an-field:nth-child(1) { animation-delay:0.36s; }
        #anModal .an-row-4 .an-field:nth-child(2) { animation-delay:0.41s; }
        #anModal .an-row-4 .an-field:nth-child(3) { animation-delay:0.46s; }
        #anModal .an-row-4 .an-field:nth-child(4) { animation-delay:0.51s; }

        /* ──────── Big notes pad (ورق مسطّر — الصف الفارغ بالأصل) ──────── */
        #anModal .an-notes-area {
            margin-top:6px; margin-bottom:6px;
            opacity:0; animation:_anFieldIn 0.5s 0.58s cubic-bezier(0.3,1.1,0.5,1) forwards;
        }
        #anModal .an-notes-label {
            font-family:'Reem Kufi', 'Cairo', sans-serif;
            font-size:13px; font-weight:700; color:#5d3a20;
            letter-spacing:0.5px;
            margin-bottom:8px;
            display:flex; align-items:center; gap:6px;
        }
        #anModal .an-notes-label .req { color:#c1572b; font-size:14px; line-height:0; }
        #anModal .an-notes-pad {
            width:100%; box-sizing:border-box;
            min-height:170px; resize:vertical;
            padding:14px 16px;
            font-family:'Amiri', 'Cairo', serif;
            font-size:15px; line-height:30px;
            color:#2e1810;
            background:
                linear-gradient(180deg, transparent 0, transparent 29px, rgba(139,89,40,0.22) 30px),
                linear-gradient(180deg, #fdf8e9 0%, #f8f0d6 100%);
            background-size:100% 30px;
            background-attachment:local;
            border:1.5px solid rgba(139,89,40,0.32);
            border-radius:8px;
            box-shadow:
                inset 0 2px 4px rgba(139,89,40,0.08),
                inset 4px 0 0 rgba(193,87,43,0.45);   /* margin line on right (RTL) */
            outline:none;
            transition:border-color 0.25s, box-shadow 0.25s;
        }
        #anModal .an-notes-pad:focus {
            border-color:#a07838;
            box-shadow:
                0 0 0 3px rgba(160,120,56,0.18),
                inset 0 2px 4px rgba(139,89,40,0.08),
                inset 4px 0 0 rgba(193,87,43,0.65);
        }
        #anModal .an-notes-pad::placeholder {
            color:rgba(122,74,38,0.40); font-style:italic;
        }

        #anModal .an-field label {
            font-family:'Reem Kufi', 'Cairo', sans-serif;
            font-size:12.5px; font-weight:500; color:#5d3a20;
            letter-spacing:0.5px;
            display:flex; align-items:center; gap:6px;
        }
        #anModal .an-field label .req { color:#c1572b; font-size:14px; line-height:0; }
        #anModal .an-field input,
        #anModal .an-field textarea,
        #anModal .an-field select {
            font-family:'Cairo', sans-serif;
            font-size:14px; padding:10px 14px;
            border:1.5px solid rgba(139,89,40,0.22);
            border-radius:6px;
            background:linear-gradient(180deg, rgba(255,253,247,0.82), rgba(252,247,232,0.82));
            color:#2e1810;
            outline:none;
            transition:border-color 0.25s, background 0.25s, box-shadow 0.25s, transform 0.18s;
            box-shadow:inset 0 1px 3px rgba(139,89,40,0.06);
        }
        #anModal .an-field input:focus,
        #anModal .an-field textarea:focus,
        #anModal .an-field select:focus {
            border-color:#a07838;
            background:#fffef8;
            box-shadow:0 0 0 3px rgba(160,120,56,0.18), inset 0 1px 3px rgba(139,89,40,0.10);
            transform:translateY(-1px);
        }
        #anModal .an-field input[readonly] {
            background:rgba(245,237,217,0.6);
            color:#5d3a20;
            cursor:default;
        }
        #anModal .an-field textarea { resize:vertical; min-height:64px; }

        /* ──────── Auditor signature section (gold-leaf accent) ──────── */
        #anModal .an-auditor-section {
            margin-top:28px; padding-top:22px;
            text-align:center;
            position:relative;
            opacity:0; animation:_anFieldIn 0.5s 0.66s cubic-bezier(0.3,1.1,0.5,1) forwards;
        }
        #anModal .an-auditor-section::before {
            content:'';
            position:absolute; top:0; left:50%; transform:translateX(-50%);
            width:60%; height:1px;
            background:linear-gradient(90deg, transparent, rgba(160,120,56,0.55), transparent);
        }
        #anModal .an-auditor-section::after {
            content:'';
            position:absolute; top:-4px; left:50%; transform:translateX(-50%);
            width:8px; height:8px; border-radius:50%;
            background:radial-gradient(circle, #d4aa5a, #7a4a26);
            box-shadow:0 0 0 2px rgba(212,170,90,0.25);
        }
        #anModal .an-auditor-section .an-auditor-label {
            font-family:'Reem Kufi', 'Cairo', sans-serif;
            font-size:11.5px;
            background:linear-gradient(90deg, transparent, #a07838 20%, #d4aa5a 50%, #a07838 80%, transparent);
            -webkit-background-clip:text; background-clip:text;
            -webkit-text-fill-color:transparent;
            font-weight:700; letter-spacing:6px;
            margin-bottom:10px;
        }
        #anModal .an-auditor-section input {
            font-family:'Amiri', 'Cairo', serif;
            text-align:center;
            font-size:18px; font-weight:700;
            padding:8px 14px 4px;
            border:none;
            border-bottom:1.5px dotted rgba(122,74,38,0.55);
            background:transparent;
            color:#2e1810;
            min-width:280px;
            outline:none;
            transition:border-color 0.25s;
            letter-spacing:1px;
        }
        #anModal .an-auditor-section input:focus {
            border-bottom:1.5px solid #a07838;
            border-bottom-style:solid;
        }
        #anModal .an-auditor-section input::placeholder {
            color:rgba(122,74,38,0.4); font-style:italic;
        }

        /* ──────── Footer buttons ──────── */
        #anModal .an-footer {
            margin-top:28px; padding-top:18px;
            display:flex; gap:14px; justify-content:center; flex-wrap:wrap;
            border-top:1px dashed rgba(139,89,40,0.28);
            opacity:0; animation:_anFieldIn 0.5s 0.72s cubic-bezier(0.3,1.1,0.5,1) forwards;
        }
        #anModal .an-btn {
            font-family:'Reem Kufi', 'Cairo', sans-serif;
            font-size:13.5px; font-weight:700; letter-spacing:0.5px;
            padding:12px 30px; border:none; border-radius:8px;
            cursor:pointer;
            transition:transform 0.18s, box-shadow 0.22s, filter 0.22s;
            position:relative; overflow:hidden;
        }
        #anModal .an-btn-submit {
            background:linear-gradient(135deg, #4a8b3c 0%, #2e6e23 50%, #1a4515 100%);
            color:#fffef8;
            box-shadow:
                0 5px 12px rgba(27,94,32,0.36),
                inset 0 1px 0 rgba(255,255,255,0.20);
            text-shadow:0 1px 1px rgba(0,0,0,0.3);
        }
        #anModal .an-btn-submit::before {
            content:''; position:absolute; inset:0;
            background:linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.22) 50%, transparent 75%);
            background-size:200% 100%;
            animation:_anShimmer 3s linear infinite;
        }
        #anModal .an-btn-submit:hover {
            filter:brightness(1.10);
            transform:translateY(-2px);
            box-shadow:0 8px 18px rgba(27,94,32,0.48), inset 0 1px 0 rgba(255,255,255,0.24);
        }
        #anModal .an-btn-submit:active { transform:translateY(0) scale(0.97); }
        #anModal .an-btn-cancel {
            background:linear-gradient(135deg, rgba(139,89,40,0.10), rgba(139,89,40,0.04));
            color:#5d3a20;
            border:1.5px solid rgba(139,89,40,0.35);
        }
        #anModal .an-btn-cancel:hover {
            background:linear-gradient(135deg, rgba(139,89,40,0.18), rgba(139,89,40,0.10));
            transform:translateY(-1px);
        }

        /* ──────── Error toast ──────── */
        #anModal .an-err {
            background:linear-gradient(135deg, rgba(193,87,43,0.12), rgba(193,87,43,0.06));
            color:#7a3d1f; font-size:13px; font-weight:700;
            padding:11px 16px; border-radius:8px;
            border:1px solid rgba(193,87,43,0.32);
            margin-top:16px; text-align:center;
            display:none;
        }
        #anModal .an-err.show {
            display:block;
            animation:_anFieldIn 0.3s cubic-bezier(0.3,1.4,0.6,1);
        }

        /* ──────── Trigger button in complaint card (green coffee-stamp) ──────── */
        .btn-audit-note {
            background:linear-gradient(135deg, #4a8b3c 0%, #2e6e23 60%, #1a4515 100%) !important;
            color:#fffef8 !important;
            border:1px solid rgba(212,170,90,0.4) !important;
            cursor:pointer;
            font-family:'Reem Kufi', 'Cairo', sans-serif;
            font-weight:700; letter-spacing:0.4px;
            padding:5px 12px; font-size:12px;
            border-radius:6px;
            box-shadow:0 2px 5px rgba(27,94,32,0.32), inset 0 1px 0 rgba(255,255,255,0.18);
            transition:filter 0.18s, transform 0.18s, box-shadow 0.22s;
            display:inline-flex; align-items:center; gap:4px;
            text-shadow:0 1px 1px rgba(0,0,0,0.22);
        }
        .btn-audit-note:hover {
            filter:brightness(1.12);
            transform:translateY(-1px);
            box-shadow:0 4px 8px rgba(27,94,32,0.42), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .btn-audit-note.has-note {
            background:linear-gradient(135deg, #2e1810 0%, #5d3a20 60%, #2e1810 100%) !important;
            box-shadow:0 0 0 2px rgba(212,170,90,0.55), 0 2px 5px rgba(0,0,0,0.32) !important;
            color:#f8e9c8 !important;
        }
        .btn-audit-note.has-note::before {
            content:'✓'; margin-left:4px; color:#d4aa5a; font-weight:900;
        }

        @media (max-width:760px) {
            #anModal .an-row-5 { grid-template-columns:repeat(2, 1fr); }
            #anModal .an-row-4 { grid-template-columns:repeat(2, 1fr); }
        }
        @media (max-width:480px) {
            #anModal .an-row-5, #anModal .an-row-4 { grid-template-columns:1fr; }
            #anModal .an-receipt { padding:26px 18px 22px 18px; }
            #anModal .an-title { font-size:24px; letter-spacing:1px; }
            #anModal .an-receipt::before { width:52px; height:52px; font-size:9px; top:10px; left:14px; }
            #anModal .an-auditor-section input { min-width:0; width:100%; max-width:280px; }
            #anModal .an-notes-pad { font-size:14px; line-height:28px; background-size:100% 28px; }
        }
    `;
    document.head.appendChild(st);
}

/* ══════════════════════════════════════════════════════
   فتح المودال — مع تعبئة الفرع تلقائياً من الشكوى
   ══════════════════════════════════════════════════════ */
function openAuditNoteModal(complaintId) {
    _anEnsureStyles();

    const complaint = (db.complaints || []).find(c => c.id == complaintId);
    if (!complaint) { alert('الشكوى غير موجودة'); return; }

    // إذا كان عند الشكوى ملاحظة سيطرة سابقة، اعرضها للقراءة بدل التعبئة الجديدة
    const existing = (db.auditNotes || []).find(n => !n.deleted && n.complaintId == complaintId);

    // أزل أي مودال سابق
    const old = document.getElementById('anModal');
    if (old) old.remove();

    const today = new Date();
    const dateStr = today.toISOString().substring(0, 10);
    const timeStr = today.toTimeString().substring(0, 5);

    const v = (k, def='') => existing ? (existing[k] ?? def) : def;
    const readonly = existing ? 'readonly' : '';
    const isView = !!existing;

    const modal = document.createElement('div');
    modal.id = 'anModal';
    modal.innerHTML = `
        <div class="an-wrap">
            <div class="an-instruction">
                <div class="an-instruction-icon">${isView ? '📋' : '✍️'}</div>
                <div class="an-instruction-text">
                    ${isView ? 'ملاحظة سيطرة مرسلة — اطلاعك على المحتوى فقط' : 'نموذج تدقيق السيطرة — املأ التفاصيل بدقة'}
                </div>
                <button class="an-instruction-close" onclick="closeAuditNoteModal()" title="إغلاق">✕</button>
            </div>
            <div class="an-receipt">
                <div class="an-title">تدقيق</div>
                <div class="an-title-sub">وثيقة سيطرة داخلية</div>

                <!-- ── الصف الأول: 5 حقول (اليوم • الوقت • رقم الفاتورة • قيمة الفاتورة • اليوزر) ── -->
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

                <!-- ── الصف الثاني: 4 حقول (الكاشير • الفرع • مقدار الإرجاع • سبب الإرجاع) ── -->
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

                <!-- ── المنطقة الكبيرة للكتابة (الصف الفارغ في الأصل) ── -->
                <div class="an-notes-area">
                    <div class="an-notes-label">ملاحظات التدقيق التفصيلية <span class="req">*</span></div>
                    <textarea id="anDetails" class="an-notes-pad" ${readonly} rows="7" placeholder="اكتب هنا ملاحظات السيطرة بالتفصيل ...">${sanitize(v('details'))}</textarea>
                </div>

                <div class="an-auditor-section">
                    <div class="an-auditor-label">المدقق</div>
                    <input type="text" id="anAuditor" ${readonly} value="${sanitize(v('auditor'))}" placeholder="اسم المدقق">
                </div>

                <div class="an-err" id="anErr"></div>

                <div class="an-footer">
                    ${isView
                        ? `<button class="an-btn an-btn-cancel" onclick="closeAuditNoteModal()">إغلاق</button>
                           <button class="an-btn an-btn-submit" onclick="jumpToComplaintFromAudit(${complaint.id})">🔙 الانتقال للشكوى</button>`
                        : `<button class="an-btn an-btn-cancel" onclick="closeAuditNoteModal()">إلغاء</button>
                           <button class="an-btn an-btn-submit" onclick="submitAuditNote(${complaint.id})">📤 إرسال إلى مدير السيطرة</button>`
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
function submitAuditNote(complaintId) {
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
   تحقّق إن كان لشكوى ملاحظة سيطرة سابقة (للزر has-note)
   ══════════════════════════════════════════════════════ */
function hasAuditNote(complaintId) {
    return (db.auditNotes || []).some(n => !n.deleted && n.complaintId == complaintId);
}

/* ══════════════════════════════════════════════════════
   الانتقال من ملاحظة سيطرة إلى الشكوى المرتبطة
   ══════════════════════════════════════════════════════ */
function jumpToComplaintFromAudit(complaintId) {
    closeAuditNoteModal();
    // افتح تاب متابعات السيطرة
    if (typeof toggleTabC === 'function') toggleTabC();
    // مرّر إلى الشكوى
    setTimeout(() => {
        const row = document.querySelector(`[data-complaint-id="${complaintId}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.transition = 'background 0.3s';
            const oldBg = row.style.background;
            row.style.background = 'rgba(46,125,50,0.18)';
            setTimeout(() => { row.style.background = oldBg; }, 1800);
        }
    }, 300);
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
        <div style="background:linear-gradient(180deg,rgba(46,125,50,0.05),rgba(46,125,50,0.02));border:1px solid rgba(46,125,50,0.22);border-radius:12px;padding:14px 16px;margin-bottom:12px;">
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
