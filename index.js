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
            mobile: false,
            // Remove printQRInTerminal - we'll handle it manually
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR Code manually (new way)
            if (qr) {
                console.log('\n📱 SCAN THIS QR CODE:\n');
                console.log(qr);
                console.log('\n Open WhatsApp → Settings → Linked Devices → Link a Device');
                console.log('⚠️ QR code expires in 30 seconds\n');
            }

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

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

connectToWhatsApp();
