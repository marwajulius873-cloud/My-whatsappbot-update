require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

console.log("Starting bot...");

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            markRead: true,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log('✅ Bot is LIVE 24/7!');
            }
            if (connection === 'close') {
                console.log('Connection closed, reconnecting...');
                connectToWhatsApp();
            }
        });

        console.log("✅ Baileys socket created successfully. Waiting for QR code...");

    } catch (error) {
        console.error("❌ ERROR:", error.message);
        console.error(error);
    }
}

connectToWhatsApp();
