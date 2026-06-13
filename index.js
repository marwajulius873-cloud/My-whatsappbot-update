require('dotenv').config();
const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

console.log("🚀 Starting WhatsApp Bot...");

// Add HTTP server for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('✅ WhatsApp Bot is running!');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
});

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            markRead: true,
            printQRInTerminal: false,
            mobile: false,
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

        sock.ev.on('connection.update', async (update) => {
            if (update.qr) {
                console.log("QR still received, trying pairing code instead...");
            }
        });

        // Use Pairing Code
        const phoneNumber = "254113123471"; // ← Change this to your number
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
