const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const P = require('pino');
const cors = require('cors');

const app = express();
const PORT = 3000;

const outletToGroup = {
  "ARE01": "120363400027905325@g.us",
  "BD0C2": "120363401767752917@g.us",
  "CG0E3": "120363417774089784@g.us",
  "DL0Y4": "120363418953801864@g.us",
  "HO0A5": "120363419638327366@g.us",
  "WQ0P6": "120363418938459771@g.us",
  "RJ0K7": "120363417837280995@g.us",
  "CA0S8": "120363418297847488@g.us",
  "IA0G9": "120363417891395077@g.us",
  "S00AMG10GN": "120363400059489014@g.us"
};

const fallbackGroupId = "120363418466979028@g.us"; // Default group if outlet_id doesn't match

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

    // Only process flagged feedback
    if (payload?.needs_manager_attention !== true) {
      return res.send('Feedback not flagged. Ignored.');
    }

    const {
      comment,
      ambience,
      food,
      service,
      recommend_score,
      first_name,
      last_name,
      guest_number,
      outlet_id,
      response_id
    } = payload;

    const groupId = outletToGroup[outlet_id] || fallbackGroupId;

    const message = `⚠️ *New Feedback Alert* ⚠️

*Comment:* ${comment}

*Ambience:* ${ambience}
*Food:* ${food}
*Service:* ${service}
*Recommend Score:* ${recommend_score}

*First Name:* ${first_name}
*Last Name:* ${last_name}
*Guest Number:* ${guest_number}

*Outlet ID:* ${outlet_id}
*Response ID:* ${response_id}
`;

    await sock.sendMessage(groupId, { text: message });
    console.log(`✅ Feedback sent to group for outlet ${outlet_id}`);
    res.send('Feedback message sent!');
  } catch (error) {
    console.error('❌ Error handling feedback webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/', (req, res) => {
  res.send('Feedback bot is running!');
});

app.listen(PORT, () => {
  console.log(`🚀 Feedback webhook server running at http://localhost:${PORT}`);
});

