require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

console.log("🚀 Starting WhatsApp Bot...");

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            markRead: true,
            printQRInTerminal: false,
            mobile: false, // Use pairing code (not mobile)
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log('✅ Bot is successfully connected and running 24/7!');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed. Reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 10000);
                }
            }
        });

        // Request Pairing Code
        sock.ev.on('connection.update', async (update) => {
            if (update.qr) {
                console.log("QR still received, trying pairing code instead...");
            }
        });

        // Use Pairing Code (Better for servers)
        const phoneNumber = "254113123471"; // ← Change this
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("\n🔥 YOUR PAIRING CODE:");
        console.log(code);
        console.log("\nOn WhatsApp → Linked Devices → Link with Phone Number");
        console.log("Enter this code:", code);

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

connectToWhatsApp();
