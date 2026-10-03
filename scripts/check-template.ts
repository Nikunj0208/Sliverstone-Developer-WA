import axios from "axios";
import { env } from "../src/config/env.js";

async function main() {
  const templateId = "1409540194136378";
  console.log(`Checking Template ID: ${templateId}...`);

  try {
    const res = await axios.get(
      `https://graph.facebook.com/v20.0/${templateId}`,
      {
        headers: { Authorization: `Bearer ${env.metaAccessToken}` }
      }
    );
    console.log("Template details by ID:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    console.error("Fetch by ID error:", error.response?.status, error.response?.data || error.message);
  }

  try {
    console.log(`\nQuerying WABA (${env.whatsappWabaId}) templates for name: silverstone_invitation...`);
    const res2 = await axios.get(
      `https://graph.facebook.com/v20.0/${env.whatsappWabaId}/message_templates?name=silverstone_invitation`,
      {
        headers: { Authorization: `Bearer ${env.metaAccessToken}` }
      }
    );
    console.log("WABA template search results:");
    console.log(JSON.stringify(res2.data, null, 2));
  } catch (error: any) {
    console.error("WABA query error:", error.response?.status, error.response?.data || error.message);
  }
}

main();
