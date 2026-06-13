require('dotenv').config();
const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

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
        // Delete old auth info to force fresh QR code
        const authPath = 'auth_info';
        if (fs.existsSync(authPath)) {
            console.log('🗑️  Clearing old authentication data...');
            fs.rmSync(authPath, { recursive: true, force: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'info' }),
            mobile: false,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;

            // Handle QR Code
            if (qr) {
                console.log('\n' + '='.repeat(50));
                console.log('📱 SCAN THIS QR CODE:');
                console.log('='.repeat(50));
                console.log(qr);
                console.log('='.repeat(50));
                console.log(' Open WhatsApp → Settings → Linked Devices → Link a Device');
                console.log('⚠️  QR code expires in 30 seconds!');
                console.log('='.repeat(50) + '\n');
            }

            if (connection === 'open') {
                console.log('✅ Bot is successfully connected and running 24/7!');
                console.log(' Phone number:', sock.user?.id?.split('@')[0]);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('❌ Connection closed.');
                console.log('Status code:', statusCode);
                
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Device logged out. Please scan QR code again.');
                }
                
                if (shouldReconnect) {
                    console.log('🔄 Reconnecting in 5 seconds...');
                    setTimeout(connectToWhatsApp, 5000);
                }
            }

            if (receivedPendingNotifications) {
                console.log('📬 Received pending notifications');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                console.log('📨 New message received');
            }
        });

    } catch (err) {
        console.error("❌ Error:", err.message);
        console.error(err.stack);
        setTimeout(connectToWhatsApp, 10000);
    }
}

connectToWhatsApp();
