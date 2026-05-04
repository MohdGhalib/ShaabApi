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
    const target = (employees || []).find(e => e.name === targetName);
    if (!target) return false;
    const role = currentUser.role;
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
        readByMe: true,        // المرسل قرأها بطبيعة الحال
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

function _showNewMessageToast(m) {
    if (typeof _ensureNotifStack !== 'function') return;
    const stack = _ensureNotifStack();
    const item = document.createElement('div');
    const bg = 'linear-gradient(135deg,rgba(21,101,192,0.96),rgba(21,101,192,0.86))';
    item.style.cssText = (typeof _NOTIF_BASE_CSS === 'string' ? _NOTIF_BASE_CSS : '') + `background:${bg};cursor:pointer;`;
    item.innerHTML = `<span style="flex:1;">💬 رسالة جديدة من ${sanitize(m.from)}</span>`;
    item.onclick = () => { openInbox(); item.remove(); };
    stack.appendChild(item);
    if (typeof _animateIn === 'function') _animateIn(item);
    if (typeof _playNotifSound === 'function') _playNotifSound();
    setTimeout(() => { if (typeof _animateOut === 'function') _animateOut(item); else item.remove(); }, 5000);
}
