import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import axios from "axios";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand(cmd: string) {
  console.log(`[CMD] ${cmd}`);
  return execSync(cmd, { stdio: "inherit" });
}

async function main() {
  console.log("==================================================================");
  console.log(" 🚀 SILVERSTONE BATCH 18 AUTOMATION: 24-HOUR SAFEGUARD & CRM SYNC ");
  console.log("==================================================================");
  console.log("Batch Range: Contacts #3,401 to #3,600 (offset=3400, limit=200)");
  console.log("Anti-ban delay: 1.5s - 2.5s jittered pacing");
  console.log("Target safeguard: Wait until rolling 24-hour Meta window clears");
  console.log("==================================================================\n");

  const startTime = Date.now();

  // 1. Run broadcast with --wait-safeguard
  console.log("[STEP 1/3] Starting Broadcast Process with 24h safeguard handler...");
  const broadcastProcess = spawn("npx", [
    "tsx",
    "scripts/broadcast.ts",
    "--offset=3400",
    "--limit=200",
    "--min-delay=1500",
    "--max-delay=2500",
    "--wait-safeguard"
  ], {
    stdio: "inherit",
    env: process.env
  });

  const exitCode = await new Promise<number>((resolve) => {
    broadcastProcess.on("close", resolve);
  });

  if (exitCode !== 0) {
    console.error(`\n❌ Broadcast failed or exited with code ${exitCode}`);
    process.exit(exitCode);
  }

  console.log("\n[STEP 2/3] Broadcast dispatched successfully! Finding new log file...");
  const files = readdirSync("data/broadcasts")
    .filter((f) => f.startsWith("broadcast-") && f.endsWith(".json"))
    .sort();
  const latestLog = files[files.length - 1];
  console.log(`Latest broadcast log: data/broadcasts/${latestLog}`);

  // 2. Commit and push log to GitHub so Render gets it
  console.log("\n[STEP 3/3] Committing and pushing Batch 18 to GitHub main for Render deployment...");
  try {
    runCommand(`git add data/broadcasts/${latestLog}`);
    runCommand(`git commit -m "feat(broadcast): add Batch 18 broadcast log (contacts #3401 to #3600)"`);
    runCommand(`git push origin main`);
    console.log("✅ Pushed Batch 18 to GitHub main successfully!");
  } catch (err: any) {
    console.warn("⚠️ Git commit/push note:", err.message);
  }

  // 3. Wait for Render deployment & trigger sync
  console.log("\n⏳ Waiting 30s for Render production container to rebuild...");
  await sleep(30000);

  const RENDER_BASE = "https://sliverstone-developer-wa1.onrender.com";
  console.log(`\nTriggering CRM sync on Render: ${RENDER_BASE}...`);
  try {
    const syncRes = await axios.post(`${RENDER_BASE}/api/sync/broadcasts`, {}, { timeout: 30000 });
    console.log("✅ Render Broadcast Sync Response:", JSON.stringify(syncRes.data));
  } catch (err: any) {
    console.warn("⚠️ Render broadcast sync warning:", err.response?.data || err.message);
  }

  try {
    const metaRes = await axios.post(`${RENDER_BASE}/api/sync/meta`, {}, { timeout: 30000 });
    console.log("✅ Render Meta Insights Sync Response:", JSON.stringify(metaRes.data?.summary || metaRes.data?.length || "OK"));
  } catch (err: any) {
    console.warn("⚠️ Render meta sync warning:", err.response?.data || err.message);
  }

  // 4. Verify Batch 18 in CRM
  console.log("\nVerifying Batch 18 contacts in Render production CRM...");
  try {
    const verifyRes = await axios.get(`${RENDER_BASE}/api/contacts?batch=18&limit=5`, { timeout: 15000 });
    console.log(`✅ Total Batch 18 contacts in CRM: ${verifyRes.data?.total || 0}`);
    console.log("Sample contacts in Batch 18:", (verifyRes.data?.contacts || []).map((c: any) => ({
      name: c.name,
      phone: c.phoneMasked,
      batch: c.batchName
    })));
  } catch (err: any) {
    console.warn("⚠️ Verification warning:", err.message);
  }

  const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n🎉 BATCH 18 AUTOMATION FULLY COMPLETE in ${durationMin} minutes!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
