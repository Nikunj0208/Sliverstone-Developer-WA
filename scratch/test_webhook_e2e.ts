import crypto from "crypto";
import axios from "axios";
import { env } from "../src/config/env.js";
import { initDatabase } from "../src/db/index.js";

async function run() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;
  const appSecret = env.metaAppSecret;
  const testWaId = "919428450250";
  const testWamid = "wamid.HBgMOTE5NDI4NDUwMjUwFQIAERgSRDI3N0YyMTcwQThDMTA0QkU0AA==";

  console.log("=== 1. TESTING WEBHOOK STATUS UPDATE ===");
  // Test updating the status of testWamid to 'read'
  const statusPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1649908446554160",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "918866752222",
                phone_number_id: "1270395312834397"
              },
              statuses: [
                {
                  id: testWamid,
                  status: "read",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  recipient_id: testWaId
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  const statusRaw = JSON.stringify(statusPayload);
  const statusSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(statusRaw).digest("hex");

  const startT = Date.now();
  const res = await axios.post("http://localhost:3000/webhook", statusPayload, {
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": statusSig
    }
  });
  const duration = Date.now() - startT;
  console.log(`Webhook responded in ${duration}ms with status: ${res.status}`);

  // Wait 1.5 seconds for async processing
  await new Promise(r => setTimeout(r, 1500));

  // Check if chat_messages was updated
  const checkMsg = await pool.query("SELECT wamid, wa_id, status, official_timestamp FROM chat_messages WHERE wamid = $1", [testWamid]);
  console.log("Updated message record in chat_messages:", checkMsg.rows[0]);

  console.log("=== 2. TESTING WEBHOOK INBOUND CUSTOMER MESSAGE ===");
  const inboundWamid = `wamid.HBgM${Date.now()}_INBOUND_TEST`;
  const inboundPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1649908446554160",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "918866752222",
                phone_number_id: "1270395312834397"
              },
              contacts: [
                {
                  profile: { name: "Jenish Modi Inbound" },
                  wa_id: testWaId
                }
              ],
              messages: [
                {
                  from: testWaId,
                  id: inboundWamid,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "I am interested in Rajmahal luxury bungalows" }
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  const inboundRaw = JSON.stringify(inboundPayload);
  const inboundSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(inboundRaw).digest("hex");

  const startInbound = Date.now();
  const resInbound = await axios.post("http://localhost:3000/webhook", inboundPayload, {
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": inboundSig
    }
  });
  const inboundDuration = Date.now() - startInbound;
  console.log(`Inbound webhook responded in ${inboundDuration}ms with status: ${resInbound.status}`);

  await new Promise(r => setTimeout(r, 2000));

  const checkInboundMsg = await pool.query("SELECT wamid, wa_id, direction, content_body, status FROM chat_messages WHERE wamid = $1", [inboundWamid]);
  console.log("Inbound message inserted into chat_messages:", checkInboundMsg.rows[0]);

  const checkContact = await pool.query("SELECT wa_id, profile_name, window_24h_open, latest_message_preview, unread_count FROM contacts WHERE wa_id = $1", [testWaId]);
  console.log("Contact updated in contacts table:", checkContact.rows[0]);

  process.exit(0);
}

run().catch(e => {
  console.error("Test failed:", e.response?.data || e.message);
  process.exit(1);
});

