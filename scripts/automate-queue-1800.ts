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

interface BatchConfig {
  batchNumber: number;
  offset: number;
  limit: number;
  dateStr: string;
}

const BATCHES_QUEUE: BatchConfig[] = [
  { batchNumber: 24, offset: 4600, limit: 200, dateStr: "2026-10-27" },
  { batchNumber: 25, offset: 4800, limit: 200, dateStr: "2026-10-28" },
  { batchNumber: 26, offset: 5000, limit: 200, dateStr: "2026-10-29" },
  { batchNumber: 27, offset: 5200, limit: 200, dateStr: "2026-10-30" },
  { batchNumber: 28, offset: 5400, limit: 200, dateStr: "2026-10-31" },
  { batchNumber: 29, offset: 5600, limit: 200, dateStr: "2026-11-01" },
  { batchNumber: 30, offset: 5800, limit: 200, dateStr: "2026-11-02" },
  { batchNumber: 31, offset: 6000, limit: 200, dateStr: "2026-11-03" },
  { batchNumber: 32, offset: 6200, limit: 200, dateStr: "2026-11-04" },
];

async function runBatch(batch: BatchConfig): Promise<void> {
  const startContact = batch.offset + 1;
  const endContact = batch.offset + batch.limit;
  console.log("\n==================================================================");
  console.log(` 🚀 STARTING BATCH ${batch.batchNumber}: CONTACTS #${startContact} TO #${endContact}`);
  console.log(` Scheduled Date: ${batch.dateStr} | Anti-ban Pacing: 1.5s - 2.5s jittered`);
  console.log(" Safeguard: Autonomous wait until rolling 24-hr Meta window clears");
  console.log("==================================================================\n");

  const startTime = Date.now();

  // 1. Run broadcast with --wait-safeguard
  console.log(`[STEP 1/3] Discarding rate limits safely with --wait-safeguard for Batch ${batch.batchNumber}...`);
  const broadcastProcess = spawn("npx", [
    "tsx",
    "scripts/broadcast.ts",
    `--offset=${batch.offset}`,
    `--limit=${batch.limit}`,
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
    console.error(`\n❌ Batch ${batch.batchNumber} failed or exited with code ${exitCode}`);
    throw new Error(`Broadcast failed for Batch ${batch.batchNumber} with exit code ${exitCode}`);
  }

  // 2. Identify log file and commit to GitHub
  console.log(`\n[STEP 2/3] Batch ${batch.batchNumber} dispatched! Locating broadcast log...`);
  const files = readdirSync("data/broadcasts")
    .filter((f) => f.startsWith("broadcast-") && f.endsWith(".json"))
    .sort();
  const latestLog = files[files.length - 1];
  console.log(`Latest broadcast log: data/broadcasts/${latestLog}`);

  console.log(`\n[STEP 3/3] Committing and pushing Batch ${batch.batchNumber} to GitHub main for Render deployment...`);
  try {
    runCommand(`git add data/broadcasts/${latestLog}`);
    runCommand(`git commit -m "feat(broadcast): add Batch ${batch.batchNumber} broadcast log (contacts #${startContact} to #${endContact})"`);
    runCommand(`git push origin main`);
    console.log(`✅ Pushed Batch ${batch.batchNumber} to GitHub main successfully!`);
  } catch (err: any) {
    console.warn("⚠️ Git commit/push note:", err.message);
  }

  // 3. Trigger Render CRM sync
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

  // 4. Verify in CRM
  console.log(`\nVerifying Batch ${batch.batchNumber} contacts in Render CRM...`);
  try {
    const verifyRes = await axios.get(`${RENDER_BASE}/api/contacts?batch=${batch.batchNumber}&limit=5`, { timeout: 15000 });
    console.log(`✅ Total Batch ${batch.batchNumber} contacts in CRM: ${verifyRes.data?.total || 0}`);
  } catch (err: any) {
    console.warn("⚠️ Verification warning:", err.message);
  }

  const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n🎉 BATCH ${batch.batchNumber} COMPLETED in ${durationMin} minutes!`);
}

async function main() {
  console.log("==================================================================");
  console.log(" 🌟 SILVERSTONE 1,800 CONTACTS MULTI-BATCH AUTONOMOUS PIPELINE    ");
  console.log("==================================================================");
  console.log("Total Queue: 9 Batches (Batches 24 to 32) = 1,800 Contacts");
  console.log("Meta Tier: TIER_250 Safeguarded (200 contacts per 24-hour cycle)");
  console.log("Anti-ban Jitter: 1.5s - 2.5s per recipient");
  console.log("Real-time telemetry: Synced directly via Meta official APIs");
  console.log("==================================================================\n");

  for (let i = 0; i < BATCHES_QUEUE.length; i++) {
    const batch = BATCHES_QUEUE[i];
    console.log(`\n>>> [QUEUE PROGRESS] Processing Batch ${batch.batchNumber} (${i + 1}/${BATCHES_QUEUE.length}) <<<`);
    await runBatch(batch);
    if (i < BATCHES_QUEUE.length - 1) {
      console.log(`\n😴 Batch ${batch.batchNumber} finished. The runner will automatically wait until the 24-hr window clears for Batch ${BATCHES_QUEUE[i + 1].batchNumber}...`);
    }
  }

  console.log("\n==================================================================");
  console.log(" 🏆 ALL 1,800 CONTACTS ACROSS 9 BATCHES COMPLETED SUCCESSFULLY!  ");
  console.log("==================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal queue runner error:", err);
  process.exit(1);
});
