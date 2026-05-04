/* ══════════════════════════════════════════════════════
   MESSAGING — internal employee messages with attachments
   - cc_employee → cc_employees + cc_manager
   - cc_manager  → all employees
   - Inbox panel + compose modal + reply
   - Attachments stored as base64 in db.messages
══════════════════════════════════════════════════════ */

const _MSG_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB per attachment

function _ensureMessages() {
    if (!db.messages) db.messages = [];
}

function _canMessage(targetName) {
    if (!currentUser || !targetName || targetName === currentUser?.name) return false;
    const role = currentUser.role;
    // أدوار السيطرة لا تستخدم نظام الرسائل إطلاقًا
    if (role === 'control' || role === 'control_employee' || role === 'control_sub') return false;
    const target = (employees || []).find(e => e.name === targetName);
    if (!target) return false;
    if (currentUser.isAdmin || role === 'cc_manager') return true;       // المدير يراسل الجميع
    if (role === 'cc_employee') {
        // موظف الكول سنتر يراسل زملاءه + المدير فقط
        return target.title === 'موظف كول سنتر' || target.title === 'مدير الكول سنتر';
    }
    return false;
}

function _myMessages() {
    _ensureMessages();
    const myName = currentUser?.name;
    return (db.messages || []).filter(m => !m.deleted && (m.to === myName || m.from === myName));
}

function _unreadMessagesCount() {
    const myName = currentUser?.name;
    return _myMessages().filter(m => m.to === myName && !m.readByMe).length;
}

/* ══ Compose modal ══════════════════════════════════════ */
function _openComposeMessage(encName, replyToId = null) {
    const name = decodeURIComponent(encName);
    if (!_canMessage(name)) return alert('غير مصرح بإرسال رسالة لهذا الموظف');
    closeEmpCard();
    _closeComposeModal();
    const overlay = document.createElement('div');
    overlay.id = '_msgComposeOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100001;display:flex;align-items:center;justify-content:center;font-family:"Cairo";';
    overlay.onclick = (e) => { if (e.target === overlay) _closeComposeModal(); };
    let replyBlock = '';
    if (replyToId) {
        const orig = (db.messages || []).find(m => m.id === replyToId);
        if (orig) {
            replyBlock = `<div style="background:rgba(21,101,192,0.08);border-right:3px solid #64b5f6;border-radius:8px;padding:9px 12px;margin-bottom:10px;font-size:12px;color:var(--text-dim);">
                ↩ ردًا على: <b style="color:var(--text-main);">${sanitize((orig.text||'').slice(0,80))}${orig.text?.length>80?'...':''}</b>
            </div>`;
        }
    }
    overlay.innerHTML = `
        <div style="background:var(--bg-main);border:1px solid var(--border);border-radius:16px;padding:22px;width:480px;max-width:94vw;text-align:right;box-shadow:0 12px 40px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="margin:0;color:var(--text-main);font-size:16px;">💬 رسالة إلى: <span style="color:#81d4fa;">${sanitize(name)}</span></h3>
                <button onclick="_closeComposeModal()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            ${replyBlock}
            <textarea id="_msgComposeText" placeholder="اكتب رسالتك..." rows="4" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;background:var(--bg-input);border:1px solid var(--border);color:var(--text-main);font-family:'Cairo';font-size:14px;resize:vertical;margin-bottom:10px;" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_sendComposedMessage('${encodeURIComponent(name)}','${replyToId||''}');}"></textarea>
            <div id="_msgAttachList" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>
            <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;">
                <label style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:8px 14px;cursor:pointer;color:var(--text-dim);font-size:13px;font-weight:700;">
                    📎 إرفاق ملفات
                    <input type="file" multiple id="_msgComposeFiles" style="display:none;" onchange="_msgRenderAttachList(this.files)">
                </label>
                <div style="display:flex;gap:6px;">
                    <button onclick="_closeComposeModal()" style="padding:9px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-dim);font-family:'Cairo';font-weight:700;cursor:pointer;">إلغاء</button>
                    <button onclick="_sendComposedMessage('${encodeURIComponent(name)}','${replyToId||''}')" style="padding:9px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,rgba(46,125,50,0.95),rgba(46,125,50,0.85));color:#fff;font-family:'Cairo';font-weight:700;cursor:pointer;">📤 إرسال</button>
                </div>
            </div>
            <div style="margin-top:8px;font-size:11px;color:var(--text-dim);text-align:center;">⌨️ Enter للإرسال — Shift+Enter لسطر جديد</div>
        </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('_msgComposeText')?.focus(), 50);
}

function _closeComposeModal() {
    const o = document.getElementById('_msgComposeOverlay');
    if (o) o.remove();
}

let _pendingAttachments = [];
function _msgRenderAttachList(files) {
    _pendingAttachments = [];
    const list = document.getElementById('_msgAttachList');
    if (!list) return;
    list.innerHTML = '';
    Array.from(files || []).forEach((f, idx) => {
        if (f.size > _MSG_MAX_FILE_SIZE) {
            alert(`الملف "${f.name}" تجاوز الحد الأقصى (2MB) ولن يُرفَق`);
            return;
        }
        _pendingAttachments.push(f);
        const isImg = (f.type || '').startsWith('image/');
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--text-main);max-width:180px;';
        chip.innerHTML = `${isImg?'🖼️':'📄'} <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitize(f.name)}</span>`;
        list.appendChild(chip);
    });
}

async function _sendComposedMessage(encName, replyToId) {
    const name = decodeURIComponent(encName);
    if (!_canMessage(name)) return alert('غير مصرح');
    const text = (document.getElementById('_msgComposeText')?.value || '').trim();
    if (!text && !_pendingAttachments.length) return alert('اكتب رسالة أو أضف مرفقًا');
    const attachments = [];
    for (const f of _pendingAttachments) {
        try {
            const dataUrl = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(f);
            });
            attachments.push({ name: f.name, type: f.type, size: f.size, dataUrl });
        } catch {}
    }
    _ensureMessages();
    const target = (employees || []).find(e => e.name === name);
    db.messages.unshift({
        id: Date.now() + Math.floor(Math.random()*1000),
        from: currentUser.name,
        fromEmpId: currentUser.empId || '',
        to: name,
        toEmpId: target?.empId || '',
        text,
        attachments,
        replyToId: replyToId || null,
        time: now(),
        iso: iso(),
        ts: Date.now(),
        readByMe: false,        // الـ flag يعكس قراءة المستلم — false عند الإرسال
    });
    if (typeof _logAudit === 'function') _logAudit('sendMessage', name, text.slice(0,40));
    save();
    _pendingAttachments = [];
    _closeComposeModal();
    // إن كانت لوحة الإشعارات مفتوحة، أعد رسمها
    _renderInboxIfOpen();
}

/* ══ Inbox modal ════════════════════════════════════════ */
function openInbox() {
    _ensureMessages();
    _closeInbox();
    const overlay = document.createElement('div');
    overlay.id = '_msgInboxOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:"Cairo";';
    overlay.onclick = (e) => { if (e.target === overlay) _closeInbox(); };
    overlay.innerHTML = `
        <div id="_msgInboxBox" style="background:var(--bg-main);border:1px solid var(--border);border-radius:16px;padding:18px;width:560px;max-width:96vw;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;color:var(--text-main);">📬 الرسائل</h3>
                <button onclick="_closeInbox()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div id="_msgInboxBody" style="overflow-y:auto;flex:1;"></div>
        </div>`;
    document.body.appendChild(overlay);
    _renderInboxBody();
}
function _closeInbox() {
    const o = document.getElementById('_msgInboxOverlay');
    if (o) o.remove();
}
function _renderInboxIfOpen() {
    if (document.getElementById('_msgInboxOverlay')) _renderInboxBody();
    _renderUnreadMsgBadge();
}

function _renderInboxBody() {
    const box = document.getElementById('_msgInboxBody');
    if (!box) return;
    const myName = currentUser?.name;
    const list = _myMessages().sort((a,b) => (b.ts||0) - (a.ts||0));
    if (!list.length) {
        box.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-dim);">لا توجد رسائل</div>';
        return;
    }
    box.innerHTML = list.map(m => {
        const incoming = m.to === myName;
        const other    = incoming ? m.from : m.to;
        const unread   = incoming && !m.readByMe;
        const bgRow    = unread ? 'rgba(21,101,192,0.10)' : 'transparent';
        const dot      = unread ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#64b5f6;margin-left:6px;"></span>' : '';
        const dirIcon  = incoming ? '⬇' : '⬆';
        const dirLabel = incoming ? 'من' : 'إلى';
        const attachN  = (m.attachments||[]).length;
        const replyBtn = incoming ? `<button onclick="event.stopPropagation();_openComposeMessage('${encodeURIComponent(other)}','${m.id}')" style="margin-right:6px;padding:4px 10px;font-size:11px;border-radius:7px;border:1px solid rgba(46,125,50,0.4);background:rgba(46,125,50,0.12);color:#a5d6a7;cursor:pointer;font-family:'Cairo';font-weight:700;">↩ رد</button>` : '';
        return `
            <div onclick="_openMessageDetail('${m.id}')" style="cursor:pointer;background:${bgRow};border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;transition:background 0.15s;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <div style="font-size:12px;color:var(--text-dim);">${dirIcon} ${dirLabel}: <b style="color:var(--text-main);">${sanitize(other)}</b>${dot}</div>
                    <small style="color:var(--text-dim);">${sanitize(m.time||'')}</small>
                </div>
                <div style="font-size:13px;color:var(--text-main);line-height:1.5;">${sanitize((m.text||'').slice(0,120))}${(m.text||'').length>120?'...':''}</div>
                <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;">
                    <small style="color:var(--text-dim);">${attachN ? `📎 ${attachN} مرفق` : ''}</small>
                    ${replyBtn}
                </div>
            </div>`;
    }).join('');
}

/* ══ Single message detail ═════════════════════════════ */
function _openMessageDetail(id) {
    const msg = (db.messages || []).find(m => m.id == id);
    if (!msg) return;
    const myName = currentUser?.name;
    const incoming = msg.to === myName;
    if (incoming && !msg.readByMe) {
        msg.readByMe = true;
        save();
        _renderUnreadMsgBadge();
    }
    const other = incoming ? msg.from : msg.to;
    let attachHtml = '';
    if ((msg.attachments||[]).length) {
        attachHtml = '<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">' +
            msg.attachments.map(a => {
                const isImg = (a.type||'').startsWith('image/');
                if (isImg) {
                    return `<a href="${a.dataUrl}" target="_blank" style="display:inline-block;"><img src="${a.dataUrl}" style="max-width:100%;max-height:240px;border-radius:8px;border:1px solid var(--border);"></a>`;
                }
                return `<a href="${a.dataUrl}" download="${sanitize(a.name)}" style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:#64b5f6;font-size:12px;text-decoration:none;font-weight:700;">📄 ${sanitize(a.name)}</a>`;
            }).join('') + '</div>';
    }
    let replyHtml = '';
    if (msg.replyToId) {
        const orig = (db.messages||[]).find(m => m.id == msg.replyToId);
        if (orig) replyHtml = `<div style="background:rgba(21,101,192,0.08);border-right:3px solid #64b5f6;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:var(--text-dim);">↩ <b style="color:var(--text-main);">${sanitize((orig.text||'').slice(0,80))}${orig.text?.length>80?'...':''}</b></div>`;
    }
    _closeMessageDetail();
    const overlay = document.createElement('div');
    overlay.id = '_msgDetailOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100002;display:flex;align-items:center;justify-content:center;font-family:"Cairo";';
    overlay.onclick = (e) => { if (e.target === overlay) _closeMessageDetail(); };
    const replyBtn = incoming ? `<button onclick="_closeMessageDetail();_openComposeMessage('${encodeURIComponent(other)}','${msg.id}')" style="padding:9px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,rgba(46,125,50,0.95),rgba(46,125,50,0.85));color:#fff;font-family:'Cairo';font-weight:700;cursor:pointer;">↩ رد</button>` : '';
    overlay.innerHTML = `
        <div style="background:var(--bg-main);border:1px solid var(--border);border-radius:16px;padding:22px;width:520px;max-width:94vw;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;color:var(--text-main);font-size:15px;">💬 ${incoming?'من':'إلى'}: <span style="color:#81d4fa;">${sanitize(other)}</span></h3>
                <button onclick="_closeMessageDetail()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="overflow-y:auto;flex:1;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px;">
                ${replyHtml}
                <div style="font-size:14px;color:var(--text-main);line-height:1.7;white-space:pre-wrap;">${sanitize(msg.text||'')}</div>
                ${attachHtml}
                <div style="margin-top:10px;font-size:11px;color:var(--text-dim);">${sanitize(msg.time||'')}</div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:6px;">
                <button onclick="_closeMessageDetail()" style="padding:9px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-dim);font-family:'Cairo';font-weight:700;cursor:pointer;">إغلاق</button>
                ${replyBtn}
            </div>
        </div>`;
    document.body.appendChild(overlay);
    _renderInboxBody();
}
function _closeMessageDetail() {
    const o = document.getElementById('_msgDetailOverlay');
    if (o) o.remove();
}

/* ══ Bell badge integration + new-message toast ════════ */
let _seenMessageIds = new Set();
function _renderUnreadMsgBadge() {
    const badge = document.getElementById('notifBellBadge');
    if (!badge) return;
    const cnt = _unreadMessagesCount();
    if (cnt > 0) {
        badge.textContent = cnt;
        badge.style.display = 'flex';
    } else {
        badge.textContent = '';
        badge.style.display = 'none';
    }
}

function _checkNewMessages() {
    if (!currentUser) return;
    const role = currentUser.role;
    if (role === 'control' || role === 'control_employee' || role === 'control_sub') return;
    _ensureMessages();
    const myName = currentUser.name;
    const incoming = (db.messages || []).filter(m => !m.deleted && m.to === myName);
    if (_seenMessageIds.size === 0 && incoming.length) {
        // الإطلاق الأول: علِّم كل الموجود حتى لا يحدث ضجيج
        incoming.forEach(m => _seenMessageIds.add(m.id));
    } else {
        incoming.forEach(m => {
            if (!_seenMessageIds.has(m.id)) {
                _seenMessageIds.add(m.id);
                if (!m.readByMe) _showNewMessageToast(m);
            }
        });
    }
    _renderUnreadMsgBadge();
}

/* ══ صفحة الرسائل (تصميم WhatsApp Web) ═════════════════════════ */
let _msgPageView = 'mine';        // 'mine' أو 'all'
let _selectedConv = null;          // اسم الطرف الآخر (mine) أو مفتاح المحادثة (all)
let _msgComposeAttachments = [];   // مرفقات شريط الإدخال السفلي

function renderMessagesPage() {
    const root = document.getElementById('messagesPageContainer');
    if (!root) return;
    _ensureMessages();
    const isMgr = (currentUser?.role === 'cc_manager') || currentUser?.isAdmin;
    if (!isMgr) _msgPageView = 'mine';
    const myName = currentUser?.name;
    const isAllView = isMgr && _msgPageView === 'all';

    // ── جمع المحادثات ──
    const all = (db.messages || []).filter(m => !m.deleted);
    const convs = new Map();
    const eligible = isAllView ? all : all.filter(m => m.from === myName || m.to === myName);
    eligible.forEach(m => {
        const key = [m.from, m.to].sort((a,b) => a.localeCompare(b, 'ar')).join('|');
        if (!convs.has(key)) convs.set(key, { key, parties:[m.from, m.to].sort((a,b)=>a.localeCompare(b,'ar')), messages:[], lastTs:0, lastMsg:null, unread:0 });
        const c = convs.get(key);
        c.messages.push(m);
        if ((m.ts||0) > c.lastTs) { c.lastTs = m.ts||0; c.lastMsg = m; }
        if (m.to === myName && !m.readByMe) c.unread++;
    });

    // أضف جهات الاتصال (موظفين يمكن مراسلتهم) حتى لو لم توجد محادثة معهم — في عرض mine فقط
    if (!isAllView) {
        (employees || []).forEach(e => {
            if (e.name === myName) return;
            if (!_canMessage(e.name)) return;
            const key = [myName, e.name].sort((a,b) => a.localeCompare(b, 'ar')).join('|');
            if (!convs.has(key)) convs.set(key, { key, parties:[myName, e.name], messages:[], lastTs:0, lastMsg:null, unread:0, isNew:true });
        });
    }

    const convList = Array.from(convs.values()).sort((a,b) => {
        // محادثات لها رسائل تتقدّم على الفارغة، ثم الأحدث أولاً
        if (!!a.lastMsg !== !!b.lastMsg) return a.lastMsg ? -1 : 1;
        return (b.lastTs||0) - (a.lastTs||0);
    });

    // اختر محادثة افتراضية إذا لم يكن هناك اختيار حالي صالح
    if (!convList.find(c => _convKeyOf(c, myName, isAllView) === _selectedConv) && convList.length) {
        _selectedConv = _convKeyOf(convList[0], myName, isAllView);
    }
    const selected = convList.find(c => _convKeyOf(c, myName, isAllView) === _selectedConv) || null;

    const sectionTitle = isAllView ? '📋 جميع المراسلات' : '💬 مراسلاتي';

    root.innerHTML = `
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:var(--text-main);font-size:15px;">${sectionTitle}</h3>
                <small style="color:var(--text-dim);">${convList.length} محادثة</small>
            </div>
            <div style="display:grid;grid-template-columns:300px 1fr;height:560px;">
                <!-- قائمة جهات الاتصال (يمين في RTL) -->
                <div id="msgContactsList" style="border-left:1px solid var(--border);overflow-y:auto;background:rgba(0,0,0,0.12);">
                    ${_renderContactsList(convList, myName, isAllView)}
                </div>
                <!-- منطقة المحادثة (يسار في RTL) -->
                <div id="msgChatPane" style="display:flex;flex-direction:column;background:rgba(0,0,0,0.04);">
                    ${_renderChatPane(selected, myName, isAllView)}
                </div>
            </div>
        </div>`;
}

function _convKeyOf(conv, myName, isAllView) {
    if (isAllView) return conv.key;
    return conv.parties[0] === myName ? conv.parties[1] : conv.parties[0];
}

function _renderContactsList(convList, myName, isAllView) {
    if (!convList.length) {
        return '<div style="padding:30px 16px;text-align:center;color:var(--text-dim);font-size:13px;">لا توجد جهات اتصال</div>';
    }
    return convList.map(c => {
        const otherName = isAllView ? null : (c.parties[0] === myName ? c.parties[1] : c.parties[0]);
        const title = isAllView ? `${sanitize(c.parties[0])} ↔ ${sanitize(c.parties[1])}` : sanitize(otherName);
        const online = !isAllView && otherName && (sessions || []).some(s => s.empName === otherName && (typeof _isSessionAlive==='function'?_isSessionAlive(s):!s.logoutIso));
        const dotColor = online ? '#4caf50' : '#e53935';
        const preview = c.lastMsg
            ? sanitize((c.lastMsg.text || (c.lastMsg.attachments?.length ? `📎 ${c.lastMsg.attachments.length} مرفق` : '')).slice(0,40))
            : '<i style="color:var(--text-dim);">لا توجد رسائل بعد — اضغط لبدء محادثة</i>';
        const ts = c.lastMsg ? sanitize(c.lastMsg.time||'').split('،').pop().trim() : '';
        const key = _convKeyOf(c, myName, isAllView);
        const isSelected = key === _selectedConv;
        const bg = isSelected ? 'rgba(46,125,50,0.18)' : 'transparent';
        const unreadBadge = c.unread > 0 ? `<span style="background:#1976d2;color:#fff;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;min-width:18px;display:inline-block;text-align:center;">${c.unread}</span>` : '';
        const dot = !isAllView ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};animation:emp-pulse 1.3s ease-in-out infinite;flex-shrink:0;"></span>` : '';
        return `
            <div onclick="_selectConv('${encodeURIComponent(key)}')"
                 style="cursor:pointer;padding:11px 14px;border-bottom:1px solid var(--border);background:${bg};display:flex;align-items:center;gap:10px;transition:background 0.12s;"
                 onmouseover="if(this.style.background==='transparent')this.style.background='rgba(255,255,255,0.04)';"
                 onmouseout="this.style.background='${bg}';">
                ${(typeof _empAvatarHTML==='function') ? _empAvatarHTML(isAllView?c.parties[0]:otherName, 38) : `<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#37474f,#263238);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:14px;">${sanitize((isAllView?c.parties[0]:otherName||'?').charAt(0))}</div>`}
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <span style="font-size:13px;font-weight:700;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
                        <small style="color:var(--text-dim);font-size:10px;flex-shrink:0;">${ts}</small>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:3px;">
                        <span style="font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${preview}</span>
                        ${unreadBadge}
                    </div>
                </div>
                ${dot}
            </div>`;
    }).join('');
}

function _renderChatPane(conv, myName, isAllView) {
    if (!conv) {
        return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:14px;">📬 اختر محادثة من القائمة</div>';
    }
    const otherName = isAllView ? null : (conv.parties[0] === myName ? conv.parties[1] : conv.parties[0]);
    const headerTitle = isAllView ? `${sanitize(conv.parties[0])} ↔ ${sanitize(conv.parties[1])}` : sanitize(otherName);
    const online = !isAllView && otherName && (sessions || []).some(s => s.empName === otherName && (typeof _isSessionAlive==='function'?_isSessionAlive(s):!s.logoutIso));
    const statusTxt = isAllView ? '' : (online ? '🟢 متصل الآن' : '⚫ غير متصل');

    // علّم الواردة كمقروءة عند فتح المحادثة
    if (!isAllView) {
        let changed = false;
        conv.messages.forEach(m => {
            if (m.to === myName && !m.readByMe) { m.readByMe = true; changed = true; }
        });
        if (changed) { save(); if (typeof _renderUnreadMsgBadge === 'function') _renderUnreadMsgBadge(); }
    }

    const ordered = conv.messages.slice().sort((a,b) => (a.ts||0) - (b.ts||0));
    const bubbles = ordered.length
        ? ordered.map(m => _renderChatBubble(m, myName, isAllView)).join('')
        : '<div style="text-align:center;padding:40px 20px;color:var(--text-dim);font-size:13px;">لا توجد رسائل بعد — ابدأ المحادثة</div>';

    const isMgr = (currentUser?.role === 'cc_manager') || currentUser?.isAdmin;
    let inputBar = '';
    if (!isAllView && otherName && _canMessage(otherName)) {
        inputBar = _renderChatInput(otherName);
    } else if (isAllView && isMgr) {
        // المدير يستطيع التدخّل في محادثات المراقبة
        inputBar = _renderInterventionInput(conv);
    } else if (isAllView) {
        inputBar = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:11px;border-top:1px solid var(--border);">عرض المراقبة فقط</div>';
    }

    return `
        <div style="padding:11px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.18);display:flex;align-items:center;gap:10px;">
            ${(typeof _empAvatarHTML==='function') ? _empAvatarHTML(isAllView?conv.parties[0]:otherName, 34) : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#37474f,#263238);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${sanitize((isAllView?conv.parties[0]:otherName||'?').charAt(0))}</div>`}
            <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;color:var(--text-main);">${headerTitle}</div>
                <small style="color:${online?'#a5d6a7':'var(--text-dim)'};font-size:11px;">${statusTxt}</small>
            </div>
        </div>
        <div id="msgChatScroll" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:6px;">
            ${bubbles}
        </div>
        ${inputBar}`;
}

function _renderChatBubble(m, myName, isAllView) {
    const mineSent = m.from === myName;
    const align = isAllView ? 'flex-start' : (mineSent ? 'flex-start' : 'flex-end');
    let bg, border;
    if (m.isIntervention) {
        bg = 'linear-gradient(135deg,rgba(245,124,0,0.30),rgba(245,124,0,0.18))';
        border = '1px solid rgba(245,124,0,0.55)';
    } else if (isAllView) {
        bg = 'rgba(255,255,255,0.05)';
        border = '1px solid var(--border)';
    } else if (mineSent) {
        bg = 'linear-gradient(135deg,rgba(46,125,50,0.30),rgba(46,125,50,0.18))';
        border = '1px solid rgba(46,125,50,0.4)';
    } else {
        bg = 'linear-gradient(135deg,rgba(38,50,56,0.65),rgba(38,50,56,0.50))';
        border = '1px solid rgba(255,255,255,0.08)';
    }
    const interventionBadge = m.isIntervention
        ? `<div style="font-size:10px;color:#ffb74d;margin-bottom:4px;font-weight:700;background:rgba(245,124,0,0.15);padding:3px 7px;border-radius:6px;display:inline-block;">⚠️ تدخّل من المدير</div>`
        : '';
    const senderLine = isAllView
        ? `<div style="font-size:10px;color:var(--text-dim);margin-bottom:3px;"><b>${sanitize(m.from)}</b> → <b>${sanitize(m.to)}</b></div>`
        : (mineSent ? '' : `<div style="font-size:10px;color:#90caf9;margin-bottom:3px;font-weight:700;">${sanitize(m.from)}</div>`);
    let attachHtml = '';
    if ((m.attachments||[]).length) {
        attachHtml = '<div style="margin-top:6px;display:flex;flex-direction:column;gap:5px;">' +
            m.attachments.map(a => {
                const isImg = (a.type||'').startsWith('image/');
                if (isImg) return `<a href="${a.dataUrl}" target="_blank"><img src="${a.dataUrl}" style="max-width:240px;max-height:180px;border-radius:8px;border:1px solid var(--border);"></a>`;
                return `<a href="${a.dataUrl}" download="${sanitize(a.name)}" style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,0.18);border:1px solid var(--border);border-radius:8px;padding:5px 9px;color:#64b5f6;font-size:11px;text-decoration:none;font-weight:700;">📄 ${sanitize(a.name)}</a>`;
            }).join('') + '</div>';
    }
    const time = sanitize((m.time||'').split('،').pop().trim());
    // علامات صح: ✓ مرسلة | ✓✓ مقروءة (للمرسل فقط في عرض mine)
    let ticks = '';
    if (mineSent && !isAllView) {
        ticks = m.readByMe
            ? `<span title="قُرئت" style="color:#42a5f5;font-weight:700;letter-spacing:-2px;">✓✓</span>`
            : `<span title="مُرسلة" style="color:rgba(255,255,255,0.45);font-weight:700;">✓</span>`;
    }
    return `
        <div style="display:flex;justify-content:${align};">
            <div style="background:${bg};border:${border};border-radius:12px;padding:7px 11px;max-width:75%;min-width:80px;">
                ${interventionBadge}
                ${senderLine}
                <div style="font-size:13px;color:var(--text-main);line-height:1.55;white-space:pre-wrap;word-break:break-word;">${sanitize(m.text||'')}</div>
                ${attachHtml}
                <div style="font-size:9px;color:var(--text-dim);text-align:left;margin-top:3px;display:flex;gap:5px;align-items:center;justify-content:flex-end;">${ticks}<span>${time}</span></div>
            </div>
        </div>`;
}

function _renderInterventionInput(conv) {
    const a = conv.parties[0];
    const b = conv.parties[1];
    const encA = encodeURIComponent(a);
    const encB = encodeURIComponent(b);
    return `
        <div style="border-top:1px solid var(--border);padding:10px 14px;background:rgba(255,152,0,0.05);">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;color:#ffb74d;font-size:11px;font-weight:700;">
                ⚠️ تدخّل إداري — سيُرسَل إلى الطرفين مع إشارة "تدخّل من المدير"
            </div>
            <div style="display:flex;align-items:flex-end;gap:8px;">
                <textarea id="msgChatInput" rows="1" placeholder="اكتب رد المدير..." style="flex:1;padding:9px 12px;border-radius:18px;border:1px solid rgba(255,152,0,0.4);background:var(--bg-input);color:var(--text-main);font-family:'Cairo';font-size:13px;resize:none;line-height:1.5;max-height:120px;" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_sendInterventionMessage('${encA}','${encB}');}"></textarea>
                <button onclick="_sendInterventionMessage('${encA}','${encB}')" style="background:linear-gradient(135deg,rgba(245,124,0,0.95),rgba(245,124,0,0.85));border:none;border-radius:50%;width:42px;height:42px;color:#fff;cursor:pointer;font-size:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center;" title="إرسال تدخّل إداري">⚠</button>
            </div>
        </div>`;
}

async function _sendInterventionMessage(encA, encB) {
    const isMgr = (currentUser?.role === 'cc_manager') || currentUser?.isAdmin;
    if (!isMgr) return;
    const a = decodeURIComponent(encA);
    const b = decodeURIComponent(encB);
    const ta = document.getElementById('msgChatInput');
    const text = (ta?.value || '').trim();
    if (!text) return;
    if (!confirm(`سيتم إرسال هذا الرد إلى الطرفين:\n• ${a}\n• ${b}\n\nستظهر الرسالة لهم بإشارة "تدخّل من المدير".\n\nهل تريد المتابعة؟`)) return;
    _ensureMessages();
    const baseTs = Date.now();
    const targets = [a, b].filter(n => n !== currentUser.name);  // لا ترسل لنفسك
    targets.forEach((target, i) => {
        const tEmp = (employees || []).find(e => e.name === target);
        db.messages.unshift({
            id: baseTs + i,
            from: currentUser.name, fromEmpId: currentUser.empId || '',
            to: target, toEmpId: tEmp?.empId || '',
            text, attachments: [], replyToId: null,
            time: now(), iso: iso(), ts: baseTs, readByMe: false,
            isIntervention: true,
            interventionPair: [a, b]
        });
    });
    if (typeof _logAudit === 'function') _logAudit('interventionMessage', '—', `للطرفين: ${a} + ${b} — ${text.slice(0,40)}`);
    save();
    if (ta) ta.value = '';
    renderMessagesPage();
    setTimeout(() => {
        const sc = document.getElementById('msgChatScroll');
        if (sc) sc.scrollTop = sc.scrollHeight;
    }, 30);
}

function _renderChatInput(targetName) {
    const enc = encodeURIComponent(targetName);
    const chips = _msgComposeAttachments.map((f,i) => {
        const isImg = (f.type||'').startsWith('image/');
        return `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg-input);border:1px solid var(--border);border-radius:7px;padding:3px 9px;font-size:11px;max-width:160px;">
            ${isImg?'🖼️':'📄'} <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitize(f.name)}</span>
            <button onclick="_removeChatAttach(${i})" style="background:none;border:none;color:#ef9a9a;cursor:pointer;font-size:11px;padding:0 2px;">✕</button>
        </span>`;
    }).join('');
    return `
        <div style="border-top:1px solid var(--border);padding:10px 14px;background:rgba(0,0,0,0.18);">
            ${_msgComposeAttachments.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px;">${chips}</div>` : ''}
            <div style="display:flex;align-items:flex-end;gap:8px;">
                <label style="cursor:pointer;background:var(--bg-input);border:1px solid var(--border);border-radius:9px;padding:8px 11px;color:var(--text-dim);font-size:14px;flex-shrink:0;" title="إرفاق">
                    📎
                    <input type="file" multiple style="display:none;" onchange="_pickChatAttachments(this.files)">
                </label>
                <textarea id="msgChatInput" rows="1" placeholder="اكتب رسالة..." style="flex:1;padding:9px 12px;border-radius:18px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-main);font-family:'Cairo';font-size:13px;resize:none;line-height:1.5;max-height:120px;" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_sendChatMessage('${enc}');}"></textarea>
                <button onclick="_sendChatMessage('${enc}')" style="background:linear-gradient(135deg,rgba(46,125,50,0.95),rgba(46,125,50,0.85));border:none;border-radius:50%;width:42px;height:42px;color:#fff;cursor:pointer;font-size:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">↩</button>
            </div>
        </div>`;
}

function _selectConv(encKey) {
    _selectedConv = decodeURIComponent(encKey);
    _msgComposeAttachments = [];
    renderMessagesPage();
    // مرّر إلى أسفل المحادثة
    setTimeout(() => {
        const sc = document.getElementById('msgChatScroll');
        if (sc) sc.scrollTop = sc.scrollHeight;
    }, 30);
}

function _pickChatAttachments(files) {
    Array.from(files || []).forEach(f => {
        if (f.size > _MSG_MAX_FILE_SIZE) { alert(`الملف "${f.name}" أكبر من 2MB`); return; }
        _msgComposeAttachments.push(f);
    });
    renderMessagesPage();
}

function _removeChatAttach(i) {
    _msgComposeAttachments.splice(i, 1);
    renderMessagesPage();
}

async function _sendChatMessage(encName) {
    const name = decodeURIComponent(encName);
    if (!_canMessage(name)) return alert('غير مصرح');
    const ta = document.getElementById('msgChatInput');
    const text = (ta?.value || '').trim();
    if (!text && !_msgComposeAttachments.length) return;
    const attachments = [];
    for (const f of _msgComposeAttachments) {
        try {
            const dataUrl = await new Promise((res, rej) => {
                const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
            });
            attachments.push({ name: f.name, type: f.type, size: f.size, dataUrl });
        } catch {}
    }
    _ensureMessages();
    const target = (employees || []).find(e => e.name === name);
    db.messages.unshift({
        id: Date.now() + Math.floor(Math.random()*1000),
        from: currentUser.name, fromEmpId: currentUser.empId || '',
        to: name, toEmpId: target?.empId || '',
        text, attachments, replyToId: null,
        time: now(), iso: iso(), ts: Date.now(), readByMe: false,
    });
    if (typeof _logAudit === 'function') _logAudit('sendMessage', name, text.slice(0,40));
    save();
    _msgComposeAttachments = [];
    if (ta) ta.value = '';
    renderMessagesPage();
    setTimeout(() => {
        const sc = document.getElementById('msgChatScroll');
        if (sc) sc.scrollTop = sc.scrollHeight;
    }, 30);
}

function _renderQuickContactsSection() {
    if (!currentUser) return '';
    const myName = currentUser.name;
    // جمع كل من يمكن مراسلته
    const recipients = (employees || [])
        .filter(e => e.name !== myName && _canMessage(e.name));
    if (!recipients.length) return '';
    // المدير في الأعلى للموظفين
    recipients.sort((a,b) => {
        const aIsMgr = a.title === 'مدير الكول سنتر' ? 0 : 1;
        const bIsMgr = b.title === 'مدير الكول سنتر' ? 0 : 1;
        if (aIsMgr !== bIsMgr) return aIsMgr - bIsMgr;
        return (a.name||'').localeCompare(b.name||'', 'ar');
    });
    const chips = recipients.map(e => {
        const online = (sessions || []).some(s => s.empName === e.name && (typeof _isSessionAlive === 'function' ? _isSessionAlive(s) : !s.logoutIso));
        const dotColor = online ? '#4caf50' : '#e53935';
        const tip = online ? 'مسجّل دخول' : 'خارج النظام';
        const isMgr = e.title === 'مدير الكول سنتر';
        const bg = isMgr ? 'linear-gradient(135deg,rgba(21,101,192,0.18),rgba(21,101,192,0.08))' : 'var(--bg-input)';
        const border = isMgr ? '1px solid rgba(21,101,192,0.45)' : '1px solid var(--border)';
        const titleHint = isMgr ? '<span style="font-size:10px;color:#90caf9;margin-right:4px;">(مدير)</span>' : '';
        return `<button onclick="_openComposeMessage('${encodeURIComponent(e.name)}','')" title="إرسال رسالة لـ ${sanitize(e.name)} — ${tip}" style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:${bg};border:${border};color:var(--text-main);cursor:pointer;font-family:'Cairo';font-weight:700;font-size:13px;transition:transform 0.12s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            <span>${sanitize(e.name)}</span>${titleHint}
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dotColor};box-shadow:0 0 7px ${dotColor};animation:emp-pulse 1.3s ease-in-out infinite;flex-shrink:0;"></span>
        </button>`;
    }).join('');
    return `
        <div class="card" style="margin-bottom:14px;">
            <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <h3 style="margin:0;color:var(--text-main);font-size:15px;">✉️ بدء محادثة جديدة</h3>
                <small style="color:var(--text-dim);">— اضغط على اسم لإرسال رسالة</small>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">${chips}</div>
        </div>`;
}

function _renderConversationCard(conv, myName, isAllView) {
    // عنوان المحادثة
    const title = isAllView
        ? `<b>${sanitize(conv.parties[0])}</b> ↔ <b>${sanitize(conv.parties[1])}</b>`
        : (() => {
            const other = conv.parties[0] === myName ? conv.parties[1] : conv.parties[0];
            return `💬 محادثة مع: <b style="color:#81d4fa;">${sanitize(other)}</b>`;
          })();
    // رتّب الرسائل من الأقدم إلى الأحدث (ترتيب محادثة)
    const ordered = conv.messages.slice().sort((a,b) => (a.ts||0) - (b.ts||0));
    const bubbles = ordered.map(m => _renderBubble(m, myName, isAllView)).join('');
    const unreadBadge = conv.unread > 0
        ? `<span style="background:#1976d2;color:#fff;border-radius:20px;padding:2px 9px;font-size:11px;font-weight:700;margin-right:8px;">${conv.unread} جديد</span>`
        : '';
    // زر الرد السريع للطرف الآخر (في عرض "مراسلاتي" فقط)
    let replyBar = '';
    if (!isAllView) {
        const other = conv.parties[0] === myName ? conv.parties[1] : conv.parties[0];
        if (typeof _canMessage === 'function' && _canMessage(other)) {
            const enc = encodeURIComponent(other);
            replyBar = `<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:6px;display:flex;justify-content:flex-end;">
                <button onclick="_openComposeMessage('${enc}','')" style="padding:7px 18px;border-radius:9px;border:none;background:linear-gradient(135deg,rgba(46,125,50,0.95),rgba(46,125,50,0.85));color:#fff;font-family:'Cairo';font-weight:700;cursor:pointer;font-size:13px;">↩ رد</button>
            </div>`;
        }
    }

    return `
        <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:14px;color:var(--text-main);">${title}${unreadBadge}</div>
                <small style="color:var(--text-dim);">${conv.messages.length} رسالة</small>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                ${bubbles}
            </div>
            ${replyBar}
        </div>`;
}

function _renderBubble(m, myName, isAllView) {
    const mineSent = m.from === myName;
    // اللون: الصادر مني → أخضر مائل لليمين | الوارد → أزرق مائل لليسار
    // في عرض "جميع المراسلات": لا يوجد "أنا"، لذا لون موحّد
    const bg = isAllView
        ? 'rgba(255,255,255,0.04)'
        : (mineSent
            ? 'linear-gradient(135deg,rgba(46,125,50,0.18),rgba(46,125,50,0.10))'
            : 'linear-gradient(135deg,rgba(21,101,192,0.18),rgba(21,101,192,0.10))');
    const align = isAllView ? 'flex-start' : (mineSent ? 'flex-start' : 'flex-end');
    const border = isAllView
        ? '1px solid var(--border)'
        : (mineSent ? '1px solid rgba(46,125,50,0.4)' : '1px solid rgba(21,101,192,0.4)');
    const unread = !isAllView && m.to === myName && !m.readByMe;
    const unreadDot = unread ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#64b5f6;margin-right:6px;animation:emp-pulse 1.3s ease-in-out infinite;"></span>' : '';
    const onClick = `onclick="_openMessageDetail('${m.id}')"`;
    const sender = isAllView ? `<b style="color:var(--text-main);">${sanitize(m.from)}</b> → <b style="color:var(--text-main);">${sanitize(m.to)}</b>` : (mineSent ? '— أنا —' : `<b style="color:#90caf9;">${sanitize(m.from)}</b>`);
    const attachN = (m.attachments||[]).length;
    const attachStrip = attachN ? `<div style="margin-top:5px;font-size:11px;color:var(--text-dim);">📎 ${attachN} مرفق</div>` : '';
    const replyMark = m.replyToId ? '<span title="رد على رسالة سابقة" style="font-size:11px;color:var(--text-dim);margin-left:5px;">↩</span>' : '';
    return `
        <div style="display:flex;justify-content:${align};">
            <div ${onClick} style="cursor:pointer;background:${bg};border:${border};border-radius:12px;padding:9px 13px;max-width:78%;min-width:120px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11px;color:var(--text-dim);margin-bottom:4px;">
                    <span>${unreadDot}${sender}${replyMark}</span>
                    <span>${sanitize(m.time||'')}</span>
                </div>
                <div style="font-size:13px;color:var(--text-main);line-height:1.6;white-space:pre-wrap;word-break:break-word;">${sanitize(m.text||'')}</div>
                ${attachStrip}
            </div>
        </div>`;
}

function _setMsgPageView(v) {
    _msgPageView = v;
    // ارسم فقط إذا الحاوية موجودة (تجنّب الرسم قبل تحميل PAGES['msg'])
    if (document.getElementById('messagesPageContainer')) renderMessagesPage();
}

function _showNewMessageToast(m) {
    // الإشعارات تظهر داخل لوحة الجرس فقط — لا توست تلقائي
    // نشغّل صوتًا خفيفًا لإعلام المستخدم بوصول رسالة جديدة
    if (typeof _playNotifSound === 'function') _playNotifSound();
}

/* ── لوحة إشعارات الرسائل (تُفتح من الجرس) ─────────────── */
function openMessagesNotifPanel() {
    _ensureMessages();
    const myName = currentUser?.name;
    const unread = (db.messages || []).filter(m => !m.deleted && m.to === myName && !m.readByMe);
    closeMessagesNotifPanel();
    const overlay = document.createElement('div');
    overlay.id = '_msgNotifOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding-top:90px;font-family:"Cairo";';
    overlay.onclick = (e) => { if (e.target === overlay) closeMessagesNotifPanel(); };
    let body = '';
    if (!unread.length) {
        body = `<div style="padding:30px 20px;text-align:center;color:var(--text-dim);font-size:13px;">لا توجد رسائل جديدة<br><button onclick="closeMessagesNotifPanel();openInbox();" style="margin-top:12px;padding:8px 18px;border-radius:9px;border:none;background:rgba(21,101,192,0.18);color:#90caf9;font-family:'Cairo';font-weight:700;cursor:pointer;">📬 فتح صندوق الرسائل</button></div>`;
    } else {
        body = unread.map(m => {
            const enc = encodeURIComponent(m.from);
            return `
                <div onclick="closeMessagesNotifPanel();_openMessageDetail('${m.id}')"
                     style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border);transition:background 0.15s;"
                     onmouseover="this.style.background='rgba(46,125,50,0.08)'" onmouseout="this.style.background='transparent'">
                    <span style="background:linear-gradient(135deg,rgba(46,125,50,0.95),rgba(46,125,50,0.85));color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">💬</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;color:var(--text-main);font-weight:700;line-height:1.5;">وصلتك رسالة من ${sanitize(m.from)} — اضغط للأطلاع والرد عليها</div>
                        <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${sanitize(m.time||'')}</div>
                    </div>
                </div>`;
        }).join('') + `<div style="padding:10px;text-align:center;border-top:1px solid var(--border);"><button onclick="closeMessagesNotifPanel();openInbox();" style="padding:6px 16px;border-radius:8px;border:none;background:rgba(21,101,192,0.15);color:#90caf9;font-family:'Cairo';font-weight:700;cursor:pointer;font-size:12px;">📬 عرض كل الرسائل</button></div>`;
    }
    overlay.innerHTML = `
        <div style="background:var(--bg-main);border:1px solid var(--border);border-radius:14px;width:380px;max-width:94vw;max-height:70vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.55);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);">
                <h3 style="margin:0;color:var(--text-main);font-size:15px;">🔔 الإشعارات</h3>
                <button onclick="closeMessagesNotifPanel()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="overflow-y:auto;">${body}</div>
        </div>`;
    document.body.appendChild(overlay);
}

function closeMessagesNotifPanel() {
    const o = document.getElementById('_msgNotifOverlay');
    if (o) o.remove();
}
