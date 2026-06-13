require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

console.log("Starting WhatsApp Bot...");

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            markRead: true,
            printQRInTerminal: false,   // Disabled because deprecated
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('🔥 SCAN THIS QR CODE WITH WHATSAPP:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'open') {
                console.log('✅ Bot is successfully connected and LIVE 24/7!');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed. Reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 5000);
                }
            }
        });

    } catch (error) {
        console.error("❌ Critical Error:", error.message);
    }
}

connectToWhatsApp();
