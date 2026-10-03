import axios from "axios";
import { writeFile } from "node:fs/promises";
import { env } from "../src/config/env.js";

async function main() {
  console.log("==========================================");
  console.log(" CREATING OFFICIAL WHATSAPP DEEP LINK QR  ");
  console.log("==========================================");

  const prefilled = process.argv[2] || "Hello Silverstone Developers! I would like to explore your projects.";

  console.log(`Phone ID: ${env.whatsappPhoneNumberId}`);
  console.log(`Pre-filled message: "${prefilled}"\n`);

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v20.0/${env.whatsappPhoneNumberId}/message_qrdls`,
      {
        prefilled_message: prefilled,
        generate_qr_image: "PNG"
      },
      {
        headers: {
          Authorization: `Bearer ${env.metaAccessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const { code, deep_link_url, qr_image_url } = res.data;
    console.log(`✅ QR Code Generated!`);
    console.log(`Code: ${code}`);
    console.log(`Direct Link: ${deep_link_url}`);

    // Download image
    const imgRes = await axios.get(qr_image_url, { responseType: "arraybuffer" });
    await writeFile("silverstone-whatsapp-qr.png", Buffer.from(imgRes.data));
    console.log(`Saved image to: silverstone-whatsapp-qr.png`);
  } catch (error: any) {
    console.error("Failed to generate QR code:", error.response?.data || error.message);
  }
}

main();
