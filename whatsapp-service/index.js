const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const express = require('express');
const path    = require('path');

// ── الإعدادات ──────────────────────────────────────────────
const PORT        = 3001;
const SECRET      = process.env.WA_SECRET || 'shaab-wa-secret';   // يطابق appsettings.json
const GROUP_ID    = process.env.WA_GROUP  || '';                   // يُعيَّن من appsettings.json أو هنا
// ───────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ── حماية بسيطة: Bearer token ──
function auth(req, res, next) {
    const header = req.headers['authorization'] || '';
    if (header !== `Bearer ${SECRET}`) {
        return res.status(401).json({ error: 'غير مصرّح' });
    }
    next();
}

// ── عميل الواتساب ──
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'wa-session') }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

let isReady = false;

client.on('qr', qr => {
    console.log('\n═══════════════════════════════════════');
    console.log('  امسح QR Code من تطبيق واتساب بزنس:');
    console.log('═══════════════════════════════════════\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    console.log('✅ واتساب متصل وجاهز للإرسال');
});

client.on('disconnected', reason => {
    isReady = false;
    console.log('⚠️  انقطع الاتصال:', reason);
    // إعادة المحاولة بعد 10 ثوان
    setTimeout(() => client.initialize(), 10_000);
});

client.initialize();

// ── GET /status ── حالة الخدمة ──
app.get('/status', auth, (req, res) => {
    res.json({ ready: isReady });
});

// ── GET /groups ── قائمة المجموعات (لمعرفة group ID) ──
app.get('/groups', auth, async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'واتساب غير متصل بعد' });
    const chats  = await client.getChats();
    const groups = chats
        .filter(c => c.isGroup)
        .map(c => ({ id: c.id._serialized, name: c.name }));
    res.json(groups);
});

// ── POST /send ── إرسال رسالة ──
app.post('/send', auth, async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'واتساب غير متصل بعد' });

    const groupId = req.body.groupId || GROUP_ID;
    const message = req.body.message;

    if (!groupId) return res.status(400).json({ error: 'groupId مطلوب' });
    if (!message) return res.status(400).json({ error: 'message مطلوب' });

    try {
        await client.sendMessage(groupId, message);
        res.json({ ok: true });
    } catch (err) {
        console.error('خطأ في الإرسال:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 خدمة الواتساب تعمل على المنفذ ${PORT}`);
    console.log('   في انتظار اتصال الواتساب...\n');
});
