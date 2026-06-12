/* ══════════════════════════════════════════════════════════════════
   searchable-select.js — قوائم منسدلة قابلة للبحث بنمط Google Sheets
   ──────────────────────────────────────────────────────────────────
   - يحوّل أي <select> إلى قائمة قابلة للبحث (مُشغّل + لوحة بحث + خيارات مُفلترة).
   - الـ<select> الأصلي يبقى في DOM كمصدر للحقيقة: القيمة و onchange تعملان كما هي
     (نُرسل حدث 'change' عند الاختيار فتعمل updateBranches / renderManagerNotes ... إلخ).
   - يتزامن تلقائياً مع التعبئة الديناميكية (updateBranches تستبدل innerHTML) عبر MutationObserver.
   - صندوق البحث يظهر فقط للقوائم الطويلة (≥ SEARCH_MIN خياراً)؛ القصيرة تبقى منسدلة عادية.
   - على الجوال (pointer:coarse) نُبقي القوائم الأصلية (أفضل لمسياً).
   - استثناء قائمة: أضِف data-no-search أو class="no-search".
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const SEARCH_MIN = 7; // أظهر صندوق البحث فقط لو عدد الخيارات ≥ هذا الحد
    const IS_COARSE = (() => {
        try { return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches); }
        catch { return false; }
    })();

    /* تطبيع عربي للبحث: إزالة التشكيل وتوحيد الألف/الهمزة/التاء المربوطة/الألف المقصورة */
    function norm(s) {
        return String(s == null ? '' : s)
            .toLowerCase()
            .replace(/[ً-ْٰ]/g, '')
            .replace(/[أإآ]/g, 'ا') // أ إ آ → ا
            .replace(/ى/g, 'ي')               // ى → ي
            .replace(/ئ/g, 'ي')               // ئ → ي
            .replace(/ؤ/g, 'و')               // ؤ → و
            .replace(/ة/g, 'ه')               // ة → ه
            .replace(/\s+/g, ' ')
            .trim();
    }

    let openCtl = null;
    function closeOpen() { if (openCtl) openCtl.close(); }

    function shouldSkip(sel) {
        return !sel || sel.multiple || sel.dataset.ss === '1' ||
            sel.hasAttribute('data-no-search') || sel.classList.contains('no-search');
    }

    function enhance(sel) {
        if (shouldSkip(sel)) return;
        if (IS_COARSE) return;
        if (!sel.parentNode) return;
        sel.dataset.ss = '1';

        const wrap = document.createElement('span');
        wrap.className = 'ss-wrap';
        sel.parentNode.insertBefore(wrap, sel);
        wrap.appendChild(sel);
        sel.classList.add('ss-native');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'ss-trigger';
        if (sel.style.cssText) trigger.style.cssText = sel.style.cssText; // طابِق أي عرض/تنسيق سطري
        wrap.appendChild(trigger);

        function placeholderText() {
            const o0 = sel.options[0];
            return (o0 && o0.value === '') ? (o0.textContent || '').trim() : '';
        }
        function syncTrigger() {
            const o = sel.options[sel.selectedIndex];
            const t = o ? (o.textContent || '').trim() : '';
            trigger.textContent = t || placeholderText() || '—';
            trigger.classList.toggle('ss-empty', !sel.value);
            trigger.disabled = sel.disabled;
        }
        syncTrigger();

        // راقب استبدال الخيارات (cascade) وتغيّر التعطيل لتحديث عنوان المُشغّل
        const mo = new MutationObserver(syncTrigger);
        mo.observe(sel, { childList: true, attributes: true, attributeFilter: ['disabled'] });
        wrap._ssMo = mo;
        sel.addEventListener('change', syncTrigger);

        let panel = null, listEl = null, searchEl = null, items = [], hi = -1;

        function buildItems(filter) {
            const f = norm(filter);
            items = []; hi = -1;
            listEl.innerHTML = '';
            Array.from(sel.options).forEach((o, idx) => {
                const label = (o.textContent || '').trim();
                if (f && !norm(label).includes(f)) return;
                const row = document.createElement('div');
                row.className = 'ss-opt' + (idx === sel.selectedIndex ? ' ss-sel' : '');
                row.textContent = label || '—';
                row.dataset.idx = String(idx);
                row.addEventListener('mousedown', (e) => { e.preventDefault(); pick(idx); });
                row.addEventListener('mousemove', () => setHi(items.indexOf(row)));
                listEl.appendChild(row);
                items.push(row);
            });
            if (!items.length) {
                const none = document.createElement('div');
                none.className = 'ss-none';
                none.textContent = 'لا نتائج مطابقة';
                listEl.appendChild(none);
            }
            hi = items.findIndex(r => r.classList.contains('ss-sel'));
            if (hi < 0 && items.length) hi = 0;
            paintHi();
        }
        function setHi(i) { if (i >= 0 && i < items.length) { hi = i; paintHi(); } }
        function paintHi() {
            items.forEach((r, i) => r.classList.toggle('ss-hi', i === hi));
            const r = items[hi]; if (r) r.scrollIntoView({ block: 'nearest' });
        }
        function pick(idx) {
            if (idx < 0 || idx >= sel.options.length) return;
            if (sel.selectedIndex !== idx) {
                sel.selectedIndex = idx;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
            syncTrigger();
            close();
        }

        function position() {
            const r = trigger.getBoundingClientRect();
            panel.style.position = 'fixed';
            panel.style.left = r.left + 'px';
            panel.style.width = r.width + 'px';
            const maxH = 300;
            const below = window.innerHeight - r.bottom;
            if (below < maxH && r.top > below) {
                panel.style.bottom = (window.innerHeight - r.top + 4) + 'px';
                panel.style.top = 'auto';
            } else {
                panel.style.top = (r.bottom + 4) + 'px';
                panel.style.bottom = 'auto';
            }
        }
        function onKey(e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(hi + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hi - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); const r = items[hi]; if (r) pick(parseInt(r.dataset.idx, 10)); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
        }
        function onDocDown(e) { if (panel && !panel.contains(e.target) && e.target !== trigger) close(); }

        function open() {
            if (sel.disabled) return;
            closeOpen();
            openCtl = ctl;
            panel = document.createElement('div');
            panel.className = 'ss-panel';
            const showSearch = sel.options.length >= SEARCH_MIN;
            panel.innerHTML =
                (showSearch ? '<div class="ss-search-wrap"><input type="text" class="ss-search" placeholder="🔍 بحث..." dir="auto"></div>' : '') +
                '<div class="ss-list"></div>';
            document.body.appendChild(panel);
            listEl = panel.querySelector('.ss-list');
            searchEl = panel.querySelector('.ss-search');
            position();
            buildItems('');
            trigger.classList.add('ss-open');
            if (searchEl) {
                searchEl.addEventListener('input', () => buildItems(searchEl.value));
                searchEl.addEventListener('keydown', onKey);
                setTimeout(() => { try { searchEl.focus(); } catch {} }, 0);
            } else {
                panel.tabIndex = -1;
                panel.addEventListener('keydown', onKey);
                setTimeout(() => { try { panel.focus(); } catch {} }, 0);
            }
            setTimeout(() => {
                document.addEventListener('mousedown', onDocDown, true);
                window.addEventListener('resize', close, true);
                document.addEventListener('scroll', close, true);
            }, 0);
        }
        function close() {
            if (!panel) return;
            document.removeEventListener('mousedown', onDocDown, true);
            window.removeEventListener('resize', close, true);
            document.removeEventListener('scroll', close, true);
            panel.remove();
            panel = null; listEl = null; searchEl = null; items = []; hi = -1;
            trigger.classList.remove('ss-open');
            if (openCtl === ctl) openCtl = null;
        }

        const ctl = { open, close, sel, trigger };
        trigger.addEventListener('click', (e) => { e.preventDefault(); if (panel) close(); else open(); });
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
        });
    }

    function scan(root) { (root || document).querySelectorAll('select').forEach(enhance); }

    /* مراقبة الإضافات الديناميكية (الصفحات تُبنى عبر innerHTML) + تنظيف المراقبين عند الإزالة */
    const docMo = new MutationObserver((muts) => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.tagName === 'SELECT') enhance(n);
                else if (n.querySelectorAll) n.querySelectorAll('select').forEach(enhance);
            }
            for (const n of m.removedNodes) {
                if (n.nodeType !== 1) continue;
                const wraps = n.classList && n.classList.contains('ss-wrap')
                    ? [n] : (n.querySelectorAll ? Array.from(n.querySelectorAll('.ss-wrap')) : []);
                wraps.forEach(w => { if (w._ssMo) { try { w._ssMo.disconnect(); } catch {} w._ssMo = null; } });
            }
        }
    });

    function start() {
        scan(document);
        if (document.body) docMo.observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    /* ── الأنماط ── */
    const css = `
        .ss-wrap { display:block; position:relative; width:100%; }
        select.ss-native { display:none !important; }
        .ss-trigger {
            width:100%; padding:12px; border-radius:12px; border:1px solid var(--border);
            background:var(--bg-input); color:var(--text-main); font-family:'Cairo'; font-size:14px;
            text-align:right; cursor:pointer; display:flex; align-items:center; justify-content:space-between;
            gap:8px; line-height:1.25; transition:border-color .22s ease, box-shadow .22s ease;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .ss-trigger::after { content:'▾'; color:var(--text-dim); font-size:11px; flex-shrink:0; }
        .ss-trigger.ss-empty { color:var(--text-dim); }
        .ss-trigger:disabled { opacity:.55; cursor:not-allowed; }
        .ss-trigger.ss-open, .ss-trigger:focus {
            border-color:var(--accent-red) !important; box-shadow:0 0 0 3px rgba(211,47,47,0.12); outline:none;
        }
        [data-theme="coffee"] .ss-trigger.ss-open, [data-theme="coffee"] .ss-trigger:focus { border-color:#c0935d !important; }
        .ss-panel {
            z-index:100000; background:var(--bg-card); border:1px solid var(--border); border-radius:12px;
            box-shadow:0 18px 50px rgba(0,0,0,0.45); overflow:hidden; display:flex; flex-direction:column;
            max-height:300px; animation:ssPop .12s ease;
        }
        @keyframes ssPop { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
        .ss-search-wrap { padding:8px; border-bottom:1px solid var(--border); background:var(--bg-card); }
        .ss-search {
            width:100%; box-sizing:border-box; padding:9px 11px; border-radius:9px; border:1px solid var(--border);
            background:var(--bg-input); color:var(--text-main); font-family:'Cairo'; font-size:13px; text-align:right;
        }
        .ss-search:focus { border-color:var(--accent-red); outline:none; }
        .ss-list { overflow-y:auto; max-height:244px; }
        .ss-opt {
            padding:9px 13px; cursor:pointer; color:var(--text-main); font-size:13.5px; font-family:'Cairo';
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;
        }
        .ss-opt.ss-hi { background:rgba(211,47,47,0.12); }
        .ss-opt.ss-sel { color:var(--accent-red); font-weight:700; }
        .ss-none { padding:14px; text-align:center; color:var(--text-dim); font-size:12.5px; font-family:'Cairo'; }`;
    const st = document.createElement('style');
    st.id = 'ssStyles';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);

    window._enhanceSelect = enhance;
})();
