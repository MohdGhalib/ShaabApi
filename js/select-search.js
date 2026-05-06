/* ══════════════════════════════════════════════════════
   SELECT-SEARCH  (v1)
   - يحوِّل كل <select> إلى combobox قابل للبحث بالكتابة المباشرة
   - يحتفظ بـ <select> الأصلي مخفياً ليعمل (selectEl.value, onchange, إلخ)
   - يُطبَّق تلقائياً على الـ selects الموجودة + التي تُنشأ ديناميكياً
   - تخطٍّ: data-no-search="1"، class="_no-search"، multiple، أقل من MIN_OPTS
   ══════════════════════════════════════════════════════ */
(function() {
    const MIN_OPTS = 6;

    function _ssShouldSkip(sel) {
        if (!sel || sel.tagName !== 'SELECT') return true;
        if (sel.dataset.ssDone === '1') return true;
        if (sel.dataset.noSearch === '1') return true;
        if (sel.classList.contains('_no-search')) return true;
        if (sel.multiple) return true;
        if ((sel.options || []).length < MIN_OPTS) return true;
        return false;
    }

    function _ssEnhance(sel) {
        if (_ssShouldSkip(sel)) return;
        sel.dataset.ssDone = '1';

        // wrapper inline-block — يأخذ نفس مساحة الـ select الأصلي
        const wrap = document.createElement('div');
        wrap.className = '_ssWrap';
        const cs = window.getComputedStyle(sel);
        const w  = sel.offsetWidth || parseInt(cs.width) || 200;
        wrap.style.cssText = 'position:relative;display:inline-block;width:' + w + 'px;max-width:100%;vertical-align:middle;';

        // ضع الـ wrapper في موضع الـ select ثم انقل الـ select داخله
        sel.parentNode.insertBefore(wrap, sel);
        wrap.appendChild(sel);
        // أخفِ الـ select لكنه يبقى في الـ DOM ويعمل
        sel.style.cssText += ';position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;left:0;top:0;';

        // input الظاهر
        const input = document.createElement('input');
        input.type = 'text';
        input.className = '_ssInput';
        input.autocomplete = 'off';
        input.spellcheck = false;
        // انقل خصائص بصرية من الـ select لينسجم مع التصميم
        input.style.cssText =
            'width:100%;box-sizing:border-box;' +
            'padding:' + (cs.padding || '8px 10px') + ';' +
            'background:' + cs.backgroundColor + ';' +
            'color:' + cs.color + ';' +
            'border:' + cs.border + ';' +
            'border-radius:' + cs.borderRadius + ';' +
            'font-family:' + cs.fontFamily + ';' +
            'font-size:' + cs.fontSize + ';' +
            'text-align:' + (cs.direction === 'rtl' ? 'right' : cs.textAlign || 'right') + ';' +
            'cursor:pointer;outline:none;';
        input.placeholder = sel.getAttribute('placeholder') || '— ابحث / اختر —';
        wrap.appendChild(input);

        // chevron
        const chev = document.createElement('span');
        chev.textContent = '▾';
        chev.style.cssText = 'position:absolute;left:8px;top:50%;transform:translateY(-50%);pointer-events:none;color:#888;font-size:11px;';
        wrap.appendChild(chev);

        // قائمة النتائج
        const list = document.createElement('div');
        list.className = '_ssList';
        list.style.cssText =
            'position:absolute;top:calc(100% + 2px);left:0;right:0;background:#1e1e1e;' +
            'border:1px solid #444;border-radius:8px;max-height:260px;overflow-y:auto;' +
            'z-index:100050;display:none;font-family:inherit;font-size:13px;' +
            'box-shadow:0 8px 24px rgba(0,0,0,0.5);';
        wrap.appendChild(list);

        function syncInputFromSelect() {
            const opt = sel.options[sel.selectedIndex];
            input.value = opt && opt.value !== '' ? (opt.text || '') : '';
        }
        function rebuildList(filterText) {
            const f = (filterText || '').trim().toLowerCase();
            list.innerHTML = '';
            let count = 0;
            for (let i = 0; i < sel.options.length; i++) {
                const opt = sel.options[i];
                const txt = opt.text || '';
                if (f && txt.toLowerCase().indexOf(f) === -1) continue;
                const row = document.createElement('div');
                row.textContent = txt;
                row.style.cssText = 'padding:8px 12px;cursor:pointer;color:#eee;border-bottom:1px solid rgba(255,255,255,0.05);';
                if (i === sel.selectedIndex) row.style.background = 'rgba(33,150,243,0.18)';
                row.onmouseenter = () => row.style.background = 'rgba(33,150,243,0.28)';
                row.onmouseleave = () => row.style.background = (i === sel.selectedIndex ? 'rgba(33,150,243,0.18)' : '');
                row.onmousedown  = (e) => {
                    e.preventDefault(); // قبل الـ blur
                    sel.value = opt.value;
                    syncInputFromSelect();
                    closeList();
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                };
                list.appendChild(row);
                count++;
            }
            if (count === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'لا نتائج';
                empty.style.cssText = 'padding:10px 12px;color:#888;font-size:12px;text-align:center;';
                list.appendChild(empty);
            }
        }
        function openList()  { rebuildList(''); list.style.display = 'block'; input.select(); }
        function closeList() { list.style.display = 'none'; }

        input.addEventListener('focus', openList);
        input.addEventListener('click', openList);
        input.addEventListener('input', () => {
            rebuildList(input.value);
            list.style.display = 'block';
        });
        input.addEventListener('blur', () => setTimeout(closeList, 150));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { closeList(); input.blur(); }
            if (e.key === 'Enter') {
                e.preventDefault();
                const first = list.querySelector('div[style*="cursor:pointer"]');
                if (first) first.dispatchEvent(new MouseEvent('mousedown'));
            }
        });

        // مزامنة الإدخال عند تغيير القيمة من الخارج (مثل updateBranches)
        sel.addEventListener('change', syncInputFromSelect);
        // مراقبة تغيير الخيارات (إعادة بناء diccionary بعد update)
        new MutationObserver(() => {
            syncInputFromSelect();
            if (list.style.display === 'block') rebuildList(input.value);
        }).observe(sel, { childList: true, attributes: true, attributeFilter: ['value'] });

        // المزامنة الأولية
        syncInputFromSelect();

        // اعرض/أخفِ القائمة عند الضغط خارجها
        document.addEventListener('mousedown', (e) => {
            if (!wrap.contains(e.target)) closeList();
        });
    }

    function _ssScan(root) {
        const node = root || document;
        if (!node.querySelectorAll) return;
        node.querySelectorAll('select:not([data-ss-done="1"])').forEach(_ssEnhance);
    }

    // اعمل scan مبدئي
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => _ssScan(document));
    } else {
        _ssScan(document);
    }

    // راقب الـ DOM للـ selects التي تُنشأ ديناميكياً
    new MutationObserver(muts => {
        muts.forEach(m => {
            m.addedNodes.forEach(n => {
                if (n.nodeType !== 1) return;
                if (n.tagName === 'SELECT') _ssEnhance(n);
                else _ssScan(n);
            });
        });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
