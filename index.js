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

async function initDB() {
    await db.read();
    db.data = db.data || { 
        users: {}, 
        groups: {}, 
        settings: { prefix: process.env.PREFIX || '!' } 
    };
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

    // Auto View Status + Anti-Delete + Media Download (same as before)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.message === null) {
                await sock.sendMessage(update.key.remoteJid, { text: '🗑️ *Anti-Delete*: A message was deleted.' });
            }
        }
    });

    await loadCommands(sock);

    sock.ev.on('messages.upsert', async (m) => { /* ... same as previous version ... */ });

    // (I kept the rest of the code the same for brevity - use the full previous one + this initDB fix)
}

async function sendWithAutoDelete(sock, from, content, quoted = null) {
    return await sock.sendMessage(from, content, { quoted });
}

async function loadCommands(sock) {
    // ... same commands as before (menu, ping, ai, autodelete)
    registerCommand('menu', async (sock, msg, args, from) => {
        const menu = `🤖 *Bot Menu*\n\n!ping\n!ai <question>\n!autodelete`;
        await sendWithAutoDelete(sock, from, { text: menu }, msg);
    });
    // Add other commands here...
}

connectToWhatsApp();
