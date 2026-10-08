import axios from "axios";
import { env, assertEnvironment } from "../src/config/env.js";
import { uploadMedia } from "../src/meta/media.js";

assertEnvironment();

const numbers = [
  { phone: "919979064646", name: "Ankit Koshiya (1)" },
  { phone: "919924986666", name: "Ankit Koshiya (2)" }
];

async function main() {
  console.log("=== Testing Sending Template to Ankit Koshiya ===");

  // 1. Upload header image
  let mediaId = "";
  try {
    mediaId = await uploadMedia("client-assets/organized/welcome/Welcome image.jpeg");
    console.log("Uploaded media ID:", mediaId);
  } catch (err: any) {
    console.error("Failed to upload media:", err.message);
    mediaId = "3319803234894484";
  }

  for (const item of numbers) {
    console.log(`\nAttempting to send to ${item.name} (${item.phone})...`);
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${env.whatsappPhoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: item.phone,
          type: "template",
          template: {
            name: "silverstone_invitation",
            language: { code: "en" },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "image",
                    image: { id: mediaId }
                  }
                ]
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${env.metaAccessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(`✅ SUCCESS for ${item.phone}:`, JSON.stringify(response.data));
    } catch (err: any) {
      console.error(`❌ FAILED for ${item.phone}:`, err.response?.data || err.message);
    }
  }
}

main().catch(console.error);
