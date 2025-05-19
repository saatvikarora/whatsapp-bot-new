const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const P = require('pino');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Group mappings for AI call alerts
const groupMapping = {
  "918035737871": "120363417593372864@g.us", // LBC AVE
  "918035738536": "120363399914666049@g.us", // SC AMBIGGN
  "918035738457": "120363421408872674@g.us", // LBC CHB
  "918035738147": "120363417607311484@g.us"  // LBC GK-2
};

// Group mappings for outlet-based feedback alerts
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

const fallbackGroupId = "120363418466979028@g.us";

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

    // 🔁 Handle Feedback Alerts
    if (payload?.needs_manager_attention === true) {
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
      return res.send('Feedback message sent!');
    }

    // 🔁 Handle AI Call Transcripts
    const called_number = payload?.data?.conversation_initiation_client_data?.dynamic_variables?.called_number;
    const caller_number = payload?.data?.conversation_initiation_client_data?.dynamic_variables?.caller_number;
    const session_start = payload?.data?.conversation_initiation_client_data?.dynamic_variables?.session_start;
    const summary = payload?.data?.analysis?.transcript_summary;
    const transcriptArray = payload?.data?.transcript;

    if (called_number && caller_number && summary && transcriptArray) {
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

      const finalMessage = `📲☎️📞 *New AI Answered Call Alert* 🚨⚠️✅

*Outlet:* ${outlet}
*Called Number:* ${called_number}

Summary: ${summary}

Transcript: ${formattedTranscript}

Time: ${session_start}

Guest Number: ${caller_number}

*Please immediately call the guest back if required.*`;

      const groupId = groupMapping[called_number] || fallbackGroupId;
      await sock.sendMessage(groupId, { text: finalMessage });
      console.log(`✅ Call alert sent to group for ${called_number}`);
      return res.send('Call alert sent!');
    }

    // If neither type matches
    return res.send('Ignored: Not a feedback or call alert');

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

