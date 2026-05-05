/* ══════════════════════════════════════════════════════
   EMERGENCY MESSAGE  (v1)
   - cc_manager (و super admin) يرسل تنبيه طارئ لموظف أو للجميع
   - لا يُحفَظ في رسائل الموظف العادية — يُخزَّن في db.emergencyMessages
   - عند المستلم: نافذة منبثقة + صوت متكرّر، تختفي عند "موافق"
   - التوصيل لحظي عبر SSE/polling الموجود (يستفيد من hook على loadAllData)
   ══════════════════════════════════════════════════════ */

const _EM_AUDIO_LOOP_MS = 2500;
const _EM_PURGE_DAYS    = 7; // حذف الرسائل المؤكَّدة الأقدم من 7 أيام

let _emShowingMsgId = null;
let _emSoundTimer  = null;

function _emIsManager() {
    return typeof currentUser !== 'undefined' && currentUser &&
           (currentUser.isAdmin || currentUser.role === 'cc_manager');
}

function _emEnsureField() {
    if (typeof db !== 'undefined' && db && !Array.isArray(db.emergencyMessages)) {
        db.emergencyMessages = [];
    }
}

function _emEscape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function _emPlayBeep() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const t = ctx.currentTime;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(440, t + 0.15);
        osc.frequency.setValueAtTime(880, t + 0.30);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.55);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.55);
        setTimeout(() => { try { ctx.close(); } catch {} }, 800);
    } catch {}
}

function _emPurgeOld() {
    _emEnsureField();
    if (!Array.isArray(db.emergencyMessages) || db.emergencyMessages.length === 0) return false;
    const cutoff = Date.now() - _EM_PURGE_DAYS * 24 * 60 * 60 * 1000;
    const before = db.emergencyMessages.length;
    db.emergencyMessages = db.emergencyMessages.filter(m => {
        const ts = new Date(m.createdAt || 0).getTime();
        const fullyOld = ts && ts < cutoff;
        return !fullyOld;
    });
    return db.emergencyMessages.length !== before;
}

/* ══════════════════════════════════════════════════════
   جانب الإرسال (cc_manager / admin)
   ══════════════════════════════════════════════════════ */
function showEmergencyComposeModal() {
    if (!_emIsManager()) { alert('غير متاح.'); return; }
    closeEmergencyComposeModal();

    const eligible = (typeof employees !== 'undefined' && Array.isArray(employees) ? employees : [])
        .filter(e => !['مدير منطقة','مدير فرع','موظف فرع'].includes(e.title || ''));
    const optsHtml = eligible.map(e =>
        `<option value="${_emEscape(e.empId)}">${_emEscape(e.name)} — ${_emEscape(e.title || '')}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = '_emComposeOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100003;display:flex;align-items:center;justify-content:center;font-family:Cairo;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeEmergencyComposeModal(); };

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:2px solid #d32f2f;border-radius:18px;width:520px;max-width:96vw;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(211,47,47,0.45);">
            <div style="padding:16px 22px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#c62828,#b71c1c);color:#fff;border-radius:18px 18px 0 0;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:17px;">🚨 إرسال تنبيه طارئ</h3>
                <button onclick="closeEmergencyComposeModal()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="padding:18px 22px;">
                <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-dim);">المستلم:</label>
                <select id="_emRecipient" style="width:100%;padding:10px 12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:10px;font-family:Cairo;margin-bottom:14px;">
                    <option value="*">📢 الكل (جميع الموظفين على الويب)</option>
                    ${optsHtml}
                </select>
                <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-dim);">نص التنبيه:</label>
                <textarea id="_emText" rows="4" placeholder="اكتب التنبيه المختصر هنا..." style="width:100%;padding:10px 12px;background:var(--bg-input);color:var(--text-main);border:1px solid var(--border);border-radius:10px;font-family:Cairo;resize:vertical;font-size:14px;"></textarea>
                <div style="font-size:11px;color:#ffb74d;margin-top:8px;line-height:1.6;">
                    ⚠️ سيُعرض كنافذة منبثقة <b>تمنع التفاعل مع الموقع</b> مع صوت تحذيري متكرّر، حتى يضغط الموظف "موافق".<br>
                    التنبيه <b>لا يُحفَظ</b> في رسائل الموظف.
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button onclick="closeEmergencyComposeModal()" style="padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-input);color:var(--text-main);cursor:pointer;font-family:Cairo;font-weight:700;font-size:13px;">إلغاء</button>
                    <button onclick="_emSend()" style="padding:9px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#c62828,#b71c1c);color:#fff;cursor:pointer;font-family:Cairo;font-weight:800;font-size:13px;">🚨 إرسال الآن</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { try { document.getElementById('_emText').focus(); } catch {} }, 50);
}

function closeEmergencyComposeModal() {
    const o = document.getElementById('_emComposeOverlay');
    if (o) o.remove();
}

function _emSend() {
    if (!_emIsManager()) return;
    _emEnsureField();
    const toEmpId = document.getElementById('_emRecipient').value;
    const text    = (document.getElementById('_emText').value || '').trim();
    if (!text) { alert('اكتب نص التنبيه.'); return; }

    const recipientLabel = toEmpId === '*' ? 'جميع الموظفين'
        : ((employees || []).find(e => String(e.empId) === String(toEmpId)) || {}).name || toEmpId;
    if (!confirm('إرسال التنبيه إلى ' + recipientLabel + '؟\n\nسيُعرض فوراً كنافذة منبثقة مع صوت تحذيري.')) return;

    const msg = {
        id:        Date.now() + ':' + Math.random().toString(36).slice(2, 8),
        fromEmpId: (currentUser && currentUser.empId) || 'admin',
        fromName:  (currentUser && currentUser.name)  || '—',
        toEmpId:   toEmpId, // empId محدد أو '*' للكل
        text:      text,
        createdAt: new Date().toISOString(),
        acknowledgedBy: {}
    };
    db.emergencyMessages.push(msg);
    _emPurgeOld();
    console.log('[emergency] 📤 sending msg:', msg, '· total in db:', db.emergencyMessages.length);
    if (typeof save === 'function') {
        save();
        console.log('[emergency] ✓ save() called → db pushed to server');
    } else {
        console.warn('[emergency] ⚠ save() غير معرَّفة!');
    }
    closeEmergencyComposeModal();
    if (typeof showEmergencySentModal === 'function') showEmergencySentModal();
    else alert('✓ أُرسل التنبيه.');
}

/* ══════════════════════════════════════════════════════
   جانب الاستقبال
   ══════════════════════════════════════════════════════ */
function _emCheckPending() {
    if (typeof currentUser === 'undefined' || !currentUser || !currentUser.empId) {
        console.log('[emergency] check skipped — no currentUser.empId');
        return;
    }
    if (_emShowingMsgId) { console.log('[emergency] already showing msg', _emShowingMsgId); return; }
    _emEnsureField();
    const list = Array.isArray(db && db.emergencyMessages) ? db.emergencyMessages : [];
    console.log('[emergency] 🔍 check — myId="' + String(currentUser.empId) + '" total msgs=' + list.length);

    const myId   = String(currentUser.empId);
    const sender = currentUser.isAdmin || currentUser.role === 'cc_manager';
    const pending = list.find(m => {
        if (sender && String(m.fromEmpId) === myId) return false; // not own broadcast
        const isMine = m.toEmpId === '*' || String(m.toEmpId) === myId;
        if (!isMine) return false;
        return !(m.acknowledgedBy && m.acknowledgedBy[myId]);
    });
    if (!pending) {
        if (list.length > 0) {
            const summary = list.map(m => ({
                id: m.id,
                to: m.toEmpId,
                from: m.fromEmpId,
                ackd_by_me: !!(m.acknowledgedBy && m.acknowledgedBy[myId]),
                ack_count:  Object.keys(m.acknowledgedBy || {}).length
            }));
            console.log('[emergency] no pending for me. messages JSON:', JSON.stringify(summary));
        }
        return;
    }
    console.log('[emergency] 🚨 pending FOUND:', pending);
    _emShowAlertModal(pending);
}

function _emShowAlertModal(msg) {
    _emShowingMsgId = msg.id;
    const overlay = document.createElement('div');
    overlay.id = '_emAlertOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(120,0,0,0.6);z-index:100099;display:flex;align-items:center;justify-content:center;font-family:Cairo;padding:16px;backdrop-filter:blur(3px);';
    overlay.innerHTML = `
        <style>
            @keyframes _emPulse { 0%,100%{transform:scale(1);box-shadow:0 24px 100px rgba(255,82,82,0.6);} 50%{transform:scale(1.015);box-shadow:0 24px 120px rgba(255,82,82,0.9);} }
            @keyframes _emShake { 0%,100%{transform:rotate(-15deg);} 50%{transform:rotate(15deg);} }
        </style>
        <div style="background:#1a0000;color:#fff;border:3px solid #ff5252;border-radius:18px;width:560px;max-width:96vw;animation:_emPulse 1.2s infinite;">
            <div style="padding:18px 22px;border-bottom:1px solid #ff5252;display:flex;align-items:center;gap:12px;">
                <span style="font-size:36px;display:inline-block;animation:_emShake 0.6s infinite;">🚨</span>
                <h3 style="margin:0;font-size:19px;">تنبيه طارئ</h3>
            </div>
            <div style="padding:22px;">
                <div style="font-size:12px;color:#ffcdd2;margin-bottom:12px;">من: <b style="color:#fff;">${_emEscape(msg.fromName || '—')}</b> · ${new Date(msg.createdAt).toLocaleString('ar-EG')}</div>
                <div style="font-size:17px;line-height:1.8;background:rgba(255,82,82,0.18);padding:16px 18px;border-radius:10px;border-right:4px solid #ff5252;white-space:pre-wrap;font-weight:600;">${_emEscape(msg.text)}</div>
                <div style="display:flex;justify-content:center;margin-top:24px;">
                    <button onclick="acknowledgeEmergency('${_emEscape(msg.id)}')" style="padding:14px 44px;border:none;border-radius:12px;background:linear-gradient(135deg,#fff,#eeeeee);color:#b71c1c;cursor:pointer;font-family:Cairo;font-weight:800;font-size:17px;box-shadow:0 4px 20px rgba(0,0,0,0.4);">✓ موافق</button>
                </div>
                <div style="text-align:center;font-size:11px;color:#ff8a80;margin-top:14px;">سيستمر الصوت حتى تضغط "موافق"</div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    _emPlayBeep();
    if (_emSoundTimer) clearInterval(_emSoundTimer);
    _emSoundTimer = setInterval(_emPlayBeep, _EM_AUDIO_LOOP_MS);
}

function acknowledgeEmergency(msgId) {
    _emEnsureField();
    if (typeof currentUser === 'undefined' || !currentUser) return;
    const myId = String(currentUser.empId);
    const m = (db.emergencyMessages || []).find(x => x.id === msgId);
    if (m) {
        if (!m.acknowledgedBy) m.acknowledgedBy = {};
        m.acknowledgedBy[myId] = new Date().toISOString();
        if (typeof save === 'function') save();
    }
    const o = document.getElementById('_emAlertOverlay');
    if (o) o.remove();
    if (_emSoundTimer) { clearInterval(_emSoundTimer); _emSoundTimer = null; }
    _emShowingMsgId = null;
    setTimeout(_emCheckPending, 200); // تنبيه آخر إن وُجد
}

/* ══════════════════════════════════════════════════════
   نافذة تأكيد للمرسِل (مع قائمة من قرأ)
   ══════════════════════════════════════════════════════ */
function showEmergencySentModal() {
    const overlay = document.createElement('div');
    overlay.id = '_emSentOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100004;display:flex;align-items:center;justify-content:center;font-family:Cairo;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    _emEnsureField();
    const last = db.emergencyMessages && db.emergencyMessages.length > 0
        ? db.emergencyMessages[db.emergencyMessages.length - 1] : null;
    let body = '<div style="color:var(--text-dim);">لا يوجد تنبيه أخير.</div>';
    if (last) {
        const ackCount = Object.keys(last.acknowledgedBy || {}).length;
        body = `
            <div style="font-size:13px;color:var(--text-main);background:var(--bg-input);padding:14px 16px;border-radius:10px;border-right:4px solid #c62828;">
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;">آخر تنبيه — ${new Date(last.createdAt).toLocaleString('ar-EG')}</div>
                <div style="white-space:pre-wrap;">${_emEscape(last.text)}</div>
                <div style="margin-top:10px;font-size:11px;color:#81c784;">✓ أكَّده ${ackCount} موظف</div>
            </div>`;
    }

    overlay.innerHTML = `
        <div style="background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:18px;width:480px;max-width:96vw;">
            <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:15px;">✓ أُرسل التنبيه</h3>
                <button onclick="document.getElementById('_emSentOverlay').remove()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="padding:18px 20px;">${body}
                <div style="display:flex;justify-content:flex-end;margin-top:14px;">
                    <button onclick="document.getElementById('_emSentOverlay').remove()" style="padding:8px 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#1976d2,#0d47a1);color:#fff;cursor:pointer;font-family:Cairo;font-weight:700;font-size:13px;">حسناً</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

/* ══════════════════════════════════════════════════════
   ربط على loadAllData + شبكة أمان دورية
   ══════════════════════════════════════════════════════ */
(function _emInstallLoadHook() {
    let installed = false;
    const tryInstall = () => {
        if (installed) return;
        if (typeof window.loadAllData !== 'function') return;
        const orig = window.loadAllData;
        window.loadAllData = async function() {
            const r = await orig.apply(this, arguments);
            try { _emCheckPending(); } catch {}
            return r;
        };
        installed = true;
    };
    if (typeof window.loadAllData === 'function') tryInstall();
    else {
        const t = setInterval(() => { tryInstall(); if (installed) clearInterval(t); }, 500);
        setTimeout(() => clearInterval(t), 30000);
    }

    // شبكة أمان: فحص بعد 6 ثوانٍ من تحميل الصفحة (يلتقط ما فات الـ hook)
    setTimeout(() => { try { _emCheckPending(); } catch {} }, 6000);

    // فحص دوري كل 30 ثانية كاحتياط إن فشل SSE/polling لأي سبب
    setInterval(() => { try { _emCheckPending(); } catch {} }, 30000);
})();

/* ══════════════════════════════════════════════════════
   أدوات تشخيص قابلة للاستدعاء من الكونسول
   ══════════════════════════════════════════════════════ */
window._emDiag = function() {
    console.log('=== EMERGENCY DIAGNOSTIC ===');
    console.log('currentUser:', typeof currentUser !== 'undefined' ? currentUser : 'UNDEFINED');
    console.log('db.emergencyMessages:', typeof db !== 'undefined' && db ? db.emergencyMessages : 'NO DB');
    console.log('loadAllData wrapped:', typeof window.loadAllData === 'function');
    console.log('Now running _emCheckPending()...');
    try { _emCheckPending(); } catch (e) { console.error('check failed:', e); }
    console.log('=== END DIAG ===');
};

/* ══════════════════════════════════════════════════════
   حقن الزر العائم 🚨 (cc_manager + admin فقط)
   ══════════════════════════════════════════════════════ */
(function _emInjectButton() {
    function tryInject() {
        if (!_emIsManager()) return;
        if (document.getElementById('_emFloatBtn')) return;
        const btn = document.createElement('button');
        btn.id = '_emFloatBtn';
        btn.title = 'إرسال تنبيه طارئ';
        btn.innerText = '🚨';
        // اختيار الموقع: بعد أزرار super-admin إن كانت ظاهرة، وإلا فوق زر النسخ مباشرة
        const isSA = (typeof currentUser !== 'undefined' && currentUser && currentUser.isAdmin);
        const bottomPx = isSA ? 186 : 74;
        btn.style.cssText = `position:fixed;bottom:${bottomPx}px;left:18px;z-index:9998;width:46px;height:46px;border-radius:50%;border:1px solid #ff5252;background:linear-gradient(135deg,#c62828,#b71c1c);color:#fff;cursor:pointer;font-size:20px;box-shadow:0 4px 14px rgba(211,47,47,0.55);transition:transform 0.18s;`;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.08)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = showEmergencyComposeModal;
        document.body.appendChild(btn);
    }
    const t = setInterval(() => {
        tryInject();
        if (document.getElementById('_emFloatBtn')) clearInterval(t);
    }, 1000);
    setTimeout(() => clearInterval(t), 120000);
})();
