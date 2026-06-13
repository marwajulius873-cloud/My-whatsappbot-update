require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

console.log("🚀 Starting WhatsApp Bot on Render...");

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            markRead: true,
            printQRInTerminal: false,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n🔥 === SCAN THIS QR CODE ===\n');
                qrcode.generate(qr, { small: true });
                console.log('\nScan with WhatsApp → Linked Devices\n');
            }

            if (connection === 'open') {
                console.log('✅ SUCCESS! Bot is connected and running 24/7');
            }

            if (connection === 'close') {
                console.log('Connection closed...');
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log('Reconnecting in 10 seconds...');
                    setTimeout(connectToWhatsApp, 10000);
                }
            }
        });

    } catch (err) {
        console.error('❌ Critical Error:', err.message);
    }
}

connectToWhatsApp();
