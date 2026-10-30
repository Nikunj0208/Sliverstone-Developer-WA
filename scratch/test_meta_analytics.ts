111import axios from "axios";
import { env } from "../src/config/env.js";

async function main() {
  const baseUrl = `https://graph.facebook.com/${env.metaGraphApiVersion}`;
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 86400;

  console.log("Checking Meta analytics for WABA ID:", env.whatsappWabaId);

  // 1. Check conversation analytics
  try {
    const convUrl = `${baseUrl}/${env.whatsappWabaId}?fields=conversation_analytics.start(${sevenDaysAgo}).end(${now}).granularity(DAILY)`;
    const convRes = await axios.get(convUrl, {
      headers: { Authorization: `Bearer ${env.metaAccessToken}` }
    });
    console.log("Conversation Analytics:", JSON.stringify(convRes.data, null, 2));
  } catch (err: any) {
    console.log("Conv Error:", err.response?.status, err.response?.data?.error?.message);
  }

  // 2. Check template analytics
  try {
    const tplUrl = `${baseUrl}/${env.whatsappWabaId}?fields=template_analytics.start(${sevenDaysAgo}).end(${now}).granularity(DAILY)`;
    const tplRes = await axios.get(tplUrl, {
      headers: { Authorization: `Bearer ${env.metaAccessToken}` }
    });
    console.log("Template Analytics:", JSON.stringify(tplRes.data, null, 2));
  } catch (err: any) {
    console.log("Template Error:", err.response?.status, err.response?.data?.error?.message);
  }

  // 3. Check general analytics
  try {
    const genUrl = `${baseUrl}/${env.whatsappWabaId}?fields=analytics.start(${sevenDaysAgo}).end(${now}).granularity(DAY)`;
    const genRes = await axios.get(genUrl, {
      headers: { Authorization: `Bearer ${env.metaAccessToken}` }
    });
    console.log("General Analytics:", JSON.stringify(genRes.data, null, 2));
  } catch (err: any) {
    console.log("General Error:", err.response?.status, err.response?.data?.error?.message);
  }
}

main().catch(console.error);
