import axios from "axios";
import { initDatabase, getAnalyticsRepository } from "../src/db/index.js";
import { env } from "../src/config/env.js";

async function run() {
  console.log("=== 1. DATABASE CONNECTION HEALTH ===");
  const repo = await initDatabase();
  const contactStats = await repo.listContacts({ limit: 1 });
  console.log(`Connected to DB successfully! Total Contacts in CRM: ${contactStats.total}`);

  console.log("\n=== 2. LIVE CALLS TO META GRAPH API ===");
  const token = env.metaAccessToken;
  const phoneId = env.whatsappPhoneNumberId;
  const wabaId = env.whatsappWabaId;
  const version = env.metaGraphApiVersion || "v20.0";

  console.log(`Using Graph API Version: ${version}`);
  console.log(`Phone ID: ${phoneId}, WABA ID: ${wabaId}`);

  // (a) Phone Number Health & Quality
  try {
    const phoneRes = await axios.get(`https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("✅ (a) Phone Health & Quality:", phoneRes.data);
  } catch (err: any) {
    console.error("❌ (a) Phone Health failed:", err.response?.data || err.message);
  }

  // (b) Messaging Limit Tier & WABA Health
  try {
    const wabaRes = await axios.get(`https://graph.facebook.com/${version}/${wabaId}?fields=name,whatsapp_business_manager_messaging_limit,health_status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("✅ (b) WABA Messaging Limit & Health:", wabaRes.data);
  } catch (err: any) {
    console.error("❌ (b) WABA Health failed:", err.response?.data || err.message);
  }

  // (c) Official Daily Analytics (Last 30 Days)
  const nowUnix = Math.floor(Date.now() / 1000);
  const thirtyDaysAgoUnix = nowUnix - 30 * 86400;

  try {
    const analyticsRes = await axios.get(`https://graph.facebook.com/${version}/${wabaId}?fields=analytics.start(${thirtyDaysAgoUnix}).end(${nowUnix}).granularity(DAY)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("✅ (c1) WABA Account Analytics (30 days):", JSON.stringify(analyticsRes.data));
  } catch (err: any) {
    console.error("❌ (c1) WABA Analytics failed:", err.response?.data || err.message);
  }

  try {
    const templateAnalyticsRes = await axios.get(`https://graph.facebook.com/${version}/${wabaId}?fields=template_analytics.start(${thirtyDaysAgoUnix}).end(${nowUnix}).granularity(DAILY).template_ids([1409540194136378])`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dp = templateAnalyticsRes.data?.template_analytics?.data?.[0]?.data_points;
    console.log(`✅ (c2) Template Analytics returned ${dp ? dp.length : 0} data points.`);
    if (dp && dp.length > 0) {
      console.log("Sample data point:", dp[dp.length - 1]);
    }
  } catch (err: any) {
    console.error("❌ (c2) Template Analytics failed:", err.response?.data || err.message);
  }

  // (d) Official Message Templates
  try {
    const tplRes = await axios.get(`https://graph.facebook.com/${version}/${wabaId}/message_templates?fields=id,name,language,status,category,quality_score&limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ (d) Message Templates: Found ${tplRes.data?.data?.length || 0} templates`);
    for (const tpl of tplRes.data?.data || []) {
      console.log(`  - ${tpl.name} [${tpl.language}]: Status=${tpl.status}, Category=${tpl.category}, Quality=${tpl.quality_score?.score || "N/A"}`);
    }
  } catch (err: any) {
    console.error("❌ (d) Message Templates failed:", err.response?.data || err.message);
  }

  console.log("\n=== 3. WEBHOOK ENDPOINT TEST ===");
  try {
    const webhookUrl = "https://sliverstone-developer-wa1.onrender.com/webhook";
    const testChallenge = "test_challenge_12345";
    const verifyToken = env.webhookVerifyToken;
    const challengeRes = await axios.get(`${webhookUrl}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${testChallenge}`, {
      timeout: 10000
    });
    console.log(`✅ Webhook Handshake: Status ${challengeRes.status}, Body=${challengeRes.data}`);
  } catch (err: any) {
    console.error("❌ Webhook Handshake failed:", err.response?.data || err.message);
  }

  process.exit(0);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
