require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, getContentType, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { OpenAI } = require('openai');
const fs = require('fs-extra');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const file = new JSONFile('db.json');
const db = new Low(file);

const messageCount = new Map();

async function initDB() {
    await db.read();
    db.data ||= { users: {}, groups: {}, settings: { prefix: process.env.PREFIX || '!' } };
    await db.write();
}

const commands = new Map();

function registerCommand(name, handler) {
    commands.set(name.toLowerCase(), handler);
}

const greetings = {
    'hi': 'Hello! 👋 How can I help you today?',
    'hello': 'Hey there! 😊',
    'gm': 'Good morning! 🌅',
    'gn': 'Good night! 🌙',
};

async function connectToWhatsApp() {
    await initDB();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        markRead: true,
        markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot is LIVE 24/7!');
            setInterval(() => sock.sendPresenceUpdate('available'), 30000);
        }
    });

    // Auto View Status
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
        }
    });

    // Anti-Delete
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.message === null) {
                await sock.sendMessage(update.key.remoteJid, { text: '🗑️ *Anti-Delete*: A message was deleted.' });
            }
        }
    });

    await loadCommands(sock);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            const from = msg.key.remoteJid;
            const now = Date.now();
            const user = messageCount.get(from) || { count: 0, last: now };
            if (now - user.last < 1500 && user.count > 4) return;
            user.count++;
            user.last = now;
            messageCount.set(from, user);

            let text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();

            // Greetings
            for (const [greet, reply] of Object.entries(greetings)) {
                if (text.includes(greet)) {
                    await sendWithAutoDelete(sock, from, { text: reply }, msg);
                    return;
                }
            }

            // Commands
            const prefix = db.data.settings.prefix;
            if (text.startsWith(prefix)) {
                const args = text.slice(prefix.length).trim().split(/ +/);
                const cmd = args.shift().toLowerCase();
                const handler = commands.get(cmd);
                if (handler) await handler(sock, msg, args, from);
            }

            // Auto Media Download
            const type = getContentType(msg.message);
            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                try {
                    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
                    await fs.ensureDir('./downloads');
                    const ext = type === 'imageMessage' ? 'jpg' : type === 'videoMessage' ? 'mp4' : 'mp3';
                    await fs.writeFile(`./downloads/${Date.now()}.${ext}`, buffer);
                } catch (e) {}
            }
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            await sock.sendMessage(update.id, { 
                text: `👋 Welcome @${update.participants[0].split('@')[0]}!`, 
                mentions: update.participants 
            });
        }
    });
}

async function sendWithAutoDelete(sock, from, content, quoted = null) {
    const res = await sock.sendMessage(from, content, { quoted });
    return res;
}

async function loadCommands(sock) {
    registerCommand('menu', async (sock, msg, args, from) => {
        const menu = `🤖 *WhatsApp Bot Menu*\n\n` +
            `!ping • !ai <text> • !download (reply to media)\n` +
            `!statusdl • !autodelete`;
        await sendWithAutoDelete(sock, from, { text: menu }, msg);
    });

    registerCommand('ping', async (sock, msg, args, from) => {
        await sendWithAutoDelete(sock, from, { text: '🏓 Pong! Bot is running 24/7' }, msg);
    });

    registerCommand('ai', async (sock, msg, args, from) => {
        if (!args.length) return sendWithAutoDelete(sock, from, { text: 'Usage: !ai your question' }, msg);
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: args.join(' ') }]
            });
            await sendWithAutoDelete(sock, from, { text: `🤖 ${completion.choices[0].message.content}` }, msg);
        } catch (e) {
            await sendWithAutoDelete(sock, from, { text: '❌ AI unavailable.' }, msg);
        }
    });

    registerCommand('autodelete', async (sock, msg, args, from) => {
        db.data.settings.autoDelete = !db.data.settings.autoDelete;
        await db.write();
        await sendWithAutoDelete(sock, from, { text: `🗑️ Auto-delete is now ${db.data.settings.autoDelete ? 'ON' : 'OFF'}` }, msg);
    });
}

connectToWhatsApp();
