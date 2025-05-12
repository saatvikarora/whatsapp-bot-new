const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const P = require('pino');
const cors = require('cors');

const app = express();
const PORT = 3000;

const groupMapping = {
    "918035737871": "120363417593372864@g.us", // LBC AVE
    "918035738536": "120363399914666049@g.us", // SC AMBIGGN
    "918035738457": "120363421408872674@g.us", // LBC CHB
    "918035738147": "120363417607311484@g.us"  // LBC GK-2
};

const defaultGroupId = "120363418466979028@g.us"; // Unknown Group

let sock;

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, qr }) => {
        if (qr) {
            console.log('🔵 Scan this QR Code:\n');
            console.log(qr);
            console.log('\n📱 Open WhatsApp → Linked Devices → Scan QR Code\n');
        }
        if (connection === 'close') {
            console.log('Connection closed. Reconnecting...');
            startSock();
        } else if (connection === 'open') {
            console.log('Bot connected ✅');
        }
    });
}

startSock();

app.use(cors());
app.use(express.json());

app.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        const called_number = payload?.data?.conversation_initiation_client_data?.dynamic_variables?.called_number || "Unknown";
        const caller_number = payload?.data?.conversation_initiation_client_data?.dynamic_variables?.caller_number || "Unknown";
        const session_start = payload?.data?.conversation_initiation_client_data?.dynamic_variables?.session_start || "Unknown";
        const summary = payload?.data?.analysis?.transcript_summary || "No summary available.";
        const transcriptArray = payload?.data?.transcript || [];

        const outlet = {
            "918035737871": "LBC AVE",
            "918035738536": "SC AMBIGGN",
            "918035738457": "LBC CHB",
            "918035738147": "LBC GK-2"
        }[called_number] || "Unknown";

        let formattedTranscript = '';
        for (let turn of transcriptArray) {
            if (turn.role === 'agent') {
                formattedTranscript += `*Agent:*🟦 ${turn.message} `;
            } else if (turn.role === 'user') {
                formattedTranscript += `*User:*🟥 ${turn.message} `;
            }
        }

        const finalMessage = `📲☎️📞 New AI Answered Call Alert 🚨⚠️✅

*Outlet:* ${outlet}
*Called Number:* ${called_number}

Summary: ${summary}

Transcript: ${formattedTranscript}

Time: ${session_start}

Guest Number: ${caller_number}

*Please immediately call the guest back if required.*`;

        const groupId = groupMapping[called_number] || defaultGroupId;
        await sock.sendMessage(groupId, { text: finalMessage });

        console.log(`✅ Message sent to group for ${called_number}`);
        res.send('Message sent!');
    } catch (error) {
        console.error('❌ Error handling webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`🚀 Webhook server running at http://localhost:${PORT}`);
});

