/* ══════════════════════════════════════════════════════════════════
   ملاحظات مدراء مناطق (Regional-Managers Notes)
   ──────────────────────────────────────────────────────────────────
   - تبويب يظهر فقط لموظفي الكول سنتر ومدير الكول سنتر (gating في auth.js)
   - تُحفظ في جدول مستقل /api/managerNotes (data.js) — خارج الـ Master_DB blob
   - كل ملاحظة: الفرع + تاريخ الملاحظة + الشخص المُبلَّغ + النص
   - مفتوحة → خط جانبي أحمر رفيع | مغلقة → خط جانبي أخضر رفيع (مثل ملاحظات السيطرة)
   - الإغلاق يتطلّب كتابة "ملاحظة إغلاق" عبر رسالة منبثقة مميّزة قبل الإغلاق
   ══════════════════════════════════════════════════════════════════ */

function _rmnVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function _rmnEsc(s)  { return (typeof sanitize === 'function') ? sanitize(s) : String(s == null ? '' : s); }
function _rmnCanDelete() { return !!(currentUser && (currentUser.isAdmin || currentUser.role === 'cc_manager')); }

/* ── عرض قائمة الملاحظات حسب الفلاتر ── */
function renderManagerNotes() {
    const container = document.getElementById('managerNotesContainer');
    if (!container) return;

    // تهيئة تاريخ الإضافة الافتراضي (اليوم) أول مرّة
    const _addDateHidden = document.getElementById('rmnAddDate');
    if (_addDateHidden && !_addDateHidden.value) {
        _addDateHidden.value = (typeof iso === 'function') ? iso() : new Date().toISOString().slice(0, 10);
        const disp = document.getElementById('rmnAddDate-display');
        if (disp) disp.textContent = '📅 ' + _addDateHidden.value + ' (اليوم)';
    }

    const fBranch  = _rmnVal('rmnSrchBranch');
    const fCity    = _rmnVal('rmnSrchCity');
    const fDate    = _rmnVal('rmnSrchDate');
    const fText    = (_rmnVal('rmnSrchText') || '').trim().toLowerCase();
    const fStatus  = _rmnVal('rmnSrchStatus'); // '' | 'open' | 'closed'

    let notes = (db.managerNotes || []).filter(n => n && !n.deleted);
    if (fBranch)            notes = notes.filter(n => (n.branch || '') === fBranch);
    else if (fCity && typeof branches !== 'undefined' && branches[fCity])
                            notes = notes.filter(n => branches[fCity].includes(n.branch));
    if (fDate)              notes = notes.filter(n => (n.noteDate || '') === fDate);
    if (fStatus === 'open')   notes = notes.filter(n => !n.closed);
    if (fStatus === 'closed') notes = notes.filter(n =>  n.closed);
    if (fText) notes = notes.filter(n =>
        ((n.text || '') + ' ' + (n.notifiedPerson || '') + ' ' + (n.branch || '') + ' ' +
         (n.closeNote || '') + ' ' + (n.addedBy || '')).toLowerCase().includes(fText));

    notes.sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const _openCount   = (db.managerNotes || []).filter(n => n && !n.deleted && !n.closed).length;
    const _closedCount = (db.managerNotes || []).filter(n => n && !n.deleted &&  n.closed).length;
    const counter = document.getElementById('rmnCounter');
    if (counter) counter.innerHTML =
        `<span style="color:#ef5350;font-weight:700;">🔴 مفتوحة: ${_openCount}</span> &nbsp;·&nbsp; ` +
        `<span style="color:#66bb6a;font-weight:700;">🟢 مغلقة: ${_closedCount}</span>`;

    if (!notes.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-dim);">
                <div style="font-size:48px;margin-bottom:12px;opacity:0.4;">🗺️</div>
                <div style="font-size:14px;font-weight:700;">لا توجد ملاحظات مطابقة</div>
                <div style="font-size:12px;margin-top:6px;opacity:0.7;">أضِف ملاحظة جديدة من الأعلى، أو غيّر فلاتر البحث</div>
            </div>`;
        return;
    }

    const canDelete = _rmnCanDelete();
    container.innerHTML = notes.map(n => {
        const open      = !n.closed;
        const lineColor = open ? '#c62828' : '#2e7d32';
        const bg        = open ? 'linear-gradient(90deg,rgba(198,40,40,0.06),rgba(198,40,40,0.01))'
                               : 'linear-gradient(90deg,rgba(46,125,50,0.07),rgba(46,125,50,0.01))';
        const closedBlock = n.closed ? `
            <div style="margin-top:10px;padding:9px 12px;background:rgba(46,125,50,0.10);border-right:3px solid rgba(46,125,50,0.6);border-radius:6px;font-size:12.5px;color:var(--text-main);line-height:1.6;">
                <b style="color:#66bb6a;">✓ ملاحظة الإغلاق:</b> ${_rmnEsc(n.closeNote || '—')}
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">أغلقها: <b style="color:#a5d6a7;">${_rmnEsc(n.closedBy || '—')}</b></div>
            </div>` : '';

        const actions = open
            ? `<button onclick="openCloseNoteModal(${n.id})" style="background:#2e7d32;color:#fff;border:none;cursor:pointer;font-family:Cairo;font-weight:700;padding:6px 12px;font-size:12px;border-radius:7px;">✓ إغلاق الملاحظة</button>`
            : `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(46,125,50,0.15);color:#66bb6a;font-weight:700;padding:6px 12px;font-size:12px;border-radius:7px;">✅ مغلقة</span>`;
        const delBtn = canDelete
            ? `<button onclick="deleteManagerNote(${n.id})" style="background:rgba(198,40,40,0.12);color:#ef5350;border:1px solid rgba(198,40,40,0.4);cursor:pointer;font-family:Cairo;font-weight:700;padding:6px 10px;font-size:12px;border-radius:7px;">🗑️ حذف</button>`
            : '';

        return `
        <div style="background:${bg};border:1px solid var(--border);border-right:4px solid ${lineColor};border-radius:12px;padding:14px 16px;margin-bottom:12px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:240px;">
                    <div style="font-size:14px;font-weight:800;color:var(--text-main);">
                        🏪 ${_rmnEsc(n.branch || '—')}
                        <span style="color:var(--text-dim);font-weight:500;font-size:12px;">— 📅 ${_rmnEsc(n.noteDate || '—')}</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-dim);margin-top:3px;">
                        👤 المُبلَّغ: <b style="color:#90caf9;">${_rmnEsc(n.notifiedPerson || '—')}</b> · سجّلها: ${_rmnEsc(n.addedBy || '—')}
                    </div>
                    <div style="margin-top:8px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:13px;color:var(--text-main);line-height:1.7;white-space:pre-wrap;">${_rmnEsc(n.text || '')}</div>
                    ${closedBlock}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;">
                    ${actions}
                    ${delBtn}
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ── إضافة ملاحظة جديدة ── */
function addManagerNote() {
    const branch         = _rmnVal('rmnAddBranch');
    const noteDate       = _rmnVal('rmnAddDate') || ((typeof iso === 'function') ? iso() : new Date().toISOString().slice(0, 10));
    const notifiedPerson = _rmnVal('rmnAddNotified').trim();
    const text           = _rmnVal('rmnAddText').trim();

    if (!branch)            return alert('يرجى اختيار الفرع');
    if (!text)              return alert('يرجى كتابة نص الملاحظة');

    const _now = Date.now();
    const note = {
        id:             _now * 1000 + Math.floor(Math.random() * 1000),
        branch, noteDate, notifiedPerson, text,
        closed: false, closeNote: '', closedBy: '', closedAt: 0,
        addedBy: currentUser ? currentUser.name : '—',
        ts: _now, deleted: false
    };

    if (!db.managerNotes) db.managerNotes = [];
    db.managerNotes.unshift(note);
    if (typeof _postManagerNote === 'function') _postManagerNote(note);
    if (typeof _logAudit === 'function') _logAudit('addManagerNote', branch, (text || '').substring(0, 80), 'managerNote', note.id);

    // تفريغ الحقول النصيّة (نُبقي الفرع/التاريخ لتسهيل إدخال عدّة ملاحظات)
    const t = document.getElementById('rmnAddText');     if (t) t.value = '';
    const p = document.getElementById('rmnAddNotified'); if (p) p.value = '';
    renderManagerNotes();
}

/* ── حذف ملاحظة (soft delete) — لمدير الكول سنتر/الأدمن فقط ── */
function deleteManagerNote(id) {
    if (!_rmnCanDelete()) return alert('لا تملك صلاحية حذف الملاحظات');
    const n = (db.managerNotes || []).find(x => x.id == id);
    if (!n) return;
    if (!confirm('هل أنت متأكد من حذف هذه الملاحظة؟')) return;
    n.deleted = true;
    if (typeof _patchManagerNote === 'function') _patchManagerNote(id, { deleted: true });
    if (typeof _logAudit === 'function') _logAudit('deleteManagerNote', n.branch || '—', (n.text || '').substring(0, 80), 'managerNote', id);
    renderManagerNotes();
}

/* ══ مودال الإغلاق المميّز — يلزم كتابة ملاحظة إغلاق قبل الإغلاق ══ */
function openCloseNoteModal(id) {
    const n = (db.managerNotes || []).find(x => x.id == id);
    if (!n || n.closed) return;

    let host = document.getElementById('rmnCloseModal');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'rmnCloseModal';
    host.setAttribute('data-note-id', String(id));
    host.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,18,0.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;animation:rmnFade 0.2s ease;';
    host.innerHTML = `
        <div style="background:linear-gradient(180deg,#1e1e2e 0%,#15151f 100%);color:#fff;border:1px solid rgba(255,255,255,0.08);border-radius:18px;width:540px;max-width:94vw;box-shadow:0 30px 120px rgba(0,0,0,0.7);overflow:hidden;animation:rmnPop 0.25s cubic-bezier(0.2,0.9,0.3,1.2);">
            <div style="display:flex;align-items:center;gap:10px;padding:16px 20px;background:linear-gradient(135deg,#2e7d32 0%,#1b5e20 100%);">
                <span style="font-size:22px;">✓</span>
                <h2 style="margin:0;font-size:17px;font-weight:800;color:#fff;">إغلاق ملاحظة منطقة</h2>
            </div>
            <div style="padding:18px 20px;">
                <div style="font-size:12.5px;color:#b9c2d0;margin-bottom:6px;line-height:1.7;">
                    🏪 <b style="color:#fff;">${_rmnEsc(n.branch || '—')}</b> · 📅 ${_rmnEsc(n.noteDate || '—')}
                </div>
                <div style="font-size:13px;color:#dfe5ee;background:rgba(255,255,255,0.04);border-radius:8px;padding:9px 12px;margin-bottom:14px;line-height:1.7;white-space:pre-wrap;">${_rmnEsc(n.text || '')}</div>
                <label style="display:block;font-size:13px;font-weight:700;color:#a5d6a7;margin-bottom:7px;">📝 ملاحظة الإغلاق <span style="color:#ef5350;">(إجباري)</span></label>
                <textarea id="rmnCloseText" rows="4" placeholder="اكتب ماذا تم بخصوص هذه الملاحظة قبل إغلاقها..." style="width:100%;box-sizing:border-box;background:#0f0f17;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-family:Cairo;font-size:13px;padding:11px 13px;resize:vertical;line-height:1.7;"></textarea>
                <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
                    <button onclick="_rmnCloseModalDismiss()" style="background:rgba(255,255,255,0.08);color:#cfd6e2;border:none;cursor:pointer;font-family:Cairo;font-weight:700;padding:9px 18px;font-size:13px;border-radius:9px;">إلغاء</button>
                    <button onclick="confirmCloseManagerNote()" style="background:linear-gradient(135deg,#2e7d32,#1b5e20);color:#fff;border:none;cursor:pointer;font-family:Cairo;font-weight:800;padding:9px 22px;font-size:13px;border-radius:9px;box-shadow:0 6px 20px rgba(46,125,50,0.4);">✓ تأكيد الإغلاق</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(host);
    host.addEventListener('mousedown', e => { if (e.target === host) _rmnCloseModalDismiss(); });
    setTimeout(() => { const ta = document.getElementById('rmnCloseText'); if (ta) ta.focus(); }, 60);
}

function _rmnCloseModalDismiss() {
    const host = document.getElementById('rmnCloseModal');
    if (host) host.remove();
}

function confirmCloseManagerNote() {
    const host = document.getElementById('rmnCloseModal');
    if (!host) return;
    const id = host.getAttribute('data-note-id');
    const closeNote = (_rmnVal('rmnCloseText') || '').trim();
    if (!closeNote) { alert('يرجى كتابة ملاحظة الإغلاق'); const ta = document.getElementById('rmnCloseText'); if (ta) ta.focus(); return; }

    const n = (db.managerNotes || []).find(x => x.id == id);
    if (!n) { _rmnCloseModalDismiss(); return; }

    const _now = Date.now();
    n.closed   = true;
    n.closeNote = closeNote;
    n.closedBy = currentUser ? currentUser.name : '—';
    n.closedAt = _now;

    /* أرسِل الملاحظة كاملة (لا أعلام الإغلاق فقط): لو ضاع POST الأصلي (نشر/شبكة) يُنشئها
       الخادم مغلقةً عبر upsert بدل إسقاط الإغلاق بصمت. */
    if (typeof _patchManagerNote === 'function')
        _patchManagerNote(n.id, {
            id: n.id, branch: n.branch, noteDate: n.noteDate, notifiedPerson: n.notifiedPerson,
            text: n.text, addedBy: n.addedBy, ts: n.ts,
            closed: true, closeNote, closedBy: n.closedBy, closedAt: _now
        });
    if (typeof _logAudit === 'function')
        _logAudit('closeManagerNote', n.branch || '—', (closeNote || '').substring(0, 80), 'managerNote', n.id);

    _rmnCloseModalDismiss();
    renderManagerNotes();
}

/* ── أنماط الحركة للمودال ── */
(function _rmnEnsureStyles() {
    if (document.getElementById('rmnStyles')) return;
    const st = document.createElement('style');
    st.id = 'rmnStyles';
    st.textContent = `
        @keyframes rmnFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rmnPop  { from { transform: translateY(14px) scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }`;
    (document.head || document.documentElement).appendChild(st);
})();

// ── تصدير عام ──
window.renderManagerNotes      = renderManagerNotes;
window.addManagerNote          = addManagerNote;
window.deleteManagerNote       = deleteManagerNote;
window.openCloseNoteModal      = openCloseNoteModal;
window.confirmCloseManagerNote = confirmCloseManagerNote;
window._rmnCloseModalDismiss   = _rmnCloseModalDismiss;
