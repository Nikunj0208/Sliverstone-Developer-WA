import crypto from "node:crypto";
import axios from "axios";
import { env, assertEnvironment } from "../src/config/env.js";

assertEnvironment();

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function createSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf-8");
  return `sha256=${hmac.digest("hex")}`;
}

async function main() {
  console.log("=== Testing WhatsApp Webhook Automation End-to-End ===");
  console.log(`Target: ${BASE_URL}/webhook`);

  // 1. Test Button Reply ("More Details" from silverstone_invitation)
  const testWaId = "919979064646";
  const buttonPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: env.whatsappWabaId,
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "919924986666",
                phone_number_id: env.whatsappPhoneNumberId
              },
              contacts: [
                {
                  profile: { name: "Ankit Koshiya" },
                  wa_id: testWaId
                }
              ],
              messages: [
                {
                  from: testWaId,
                  id: `wamid.test_reply_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: "button",
                  button: {
                    payload: "More Details",
                    text: "More Details"
                  }
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  const bodyStr = JSON.stringify(buttonPayload);
  const signature = createSignature(bodyStr, env.metaAppSecret);

  console.log("\n[1] Sending Webhook for BUTTON_REPLY: 'More Details'...");
  try {
    const res = await axios.post(`${BASE_URL}/webhook`, buttonPayload, {
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature
      }
    });
    console.log(`✅ Webhook Response: HTTP ${res.status}`);
  } catch (err: any) {
    console.error("❌ Webhook Error:", err.response?.data || err.message);
  }

  // 2. Query CRM API to verify that Ankit Koshiya's button click and reply was logged!
  console.log("\n[2] Verifying CRM record for Ankit Koshiya...");
  try {
    const crmRes = await axios.get(`${BASE_URL}/api/contacts?search=919979064646`);
    const contact = crmRes.data.contacts?.[0];
    if (contact) {
      console.log(`✅ Contact Name: ${contact.name}`);
      console.log(`✅ Phone: ${contact.phone}`);
      console.log(`✅ Has Replied: ${contact.hasReplied}`);
      console.log(`✅ Button Clicked: ${contact.buttonClicked}`);
      console.log(`✅ Last Button Clicked: ${contact.lastButtonClicked}`);
      console.log(`✅ Last Reply Text: ${contact.lastReplyText}`);
    } else {
      console.log("Contact not found in CRM query");
    }
  } catch (err: any) {
    console.error("❌ CRM Query Error:", err.response?.data || err.message);
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
