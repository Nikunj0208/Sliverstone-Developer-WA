import axios from "axios";
import { env } from "../src/config/env.js";

async function run() {
  const token = env.metaAccessToken;
  const phoneId = env.whatsappPhoneNumberId;
  const wabaId = env.whatsappWabaId;
  const headers = { Authorization: `Bearer ${token}` };

  const nowUnix = Math.floor(Date.now() / 1000);
  const sevenDaysAgoUnix = nowUnix - 7 * 86400;

  // 1. Phone details v23.0
  const phoneUrl = `https://graph.facebook.com/v23.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating,status`;
  const phoneRes = await axios.get(phoneUrl, { headers });
  console.log("Phone v23.0:", phoneRes.data);

  // 2. WABA Limit & 7-day Analytics v23.0
  const wabaUrl = `https://graph.facebook.com/v23.0/${wabaId}?fields=whatsapp_business_manager_messaging_limit,analytics.start(${sevenDaysAgoUnix}).end(${nowUnix}).granularity(DAY)`;
  const wabaRes = await axios.get(wabaUrl, { headers });
  console.log("WABA v23.0:", {
    limit: wabaRes.data.whatsapp_business_manager_messaging_limit,
    analytics_points: wabaRes.data.analytics?.data_points?.length
  });

  // 3. Message templates v23.0
  const tplUrl = `https://graph.facebook.com/v23.0/${wabaId}/message_templates?fields=name,status,language,components`;
  const tplRes = await axios.get(tplUrl, { headers });
  console.log("Templates v23.0 full components:", JSON.stringify(tplRes.data.data, null, 2));

  process.exit(0);
}

run().catch(e => {
  console.error("Test failed:", e.response?.data || e.message);
  process.exit(1);
});
