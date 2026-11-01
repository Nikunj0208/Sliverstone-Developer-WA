import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import axios from "axios";
import { initDatabase, getAnalyticsRepository } from "../src/db/index.js";
import { syncBroadcastLogsToRepository } from "../src/db/sync-logs.js";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(cmd: string) {
  console.log(`[CMD] ${cmd}`);
  return execSync(cmd, { stdio: "inherit" });
}

export interface DailyBatchConfig {
  dateStr: string;
  batchName: string;
  offset: number;
  limit: number;
}

// 01 Nov 2026: Single Date-Wise Batch (No 200-contact splitting)
// Contacts #5401 - #5600 (200) were already sent and merged into 01 Nov 2026.
// Contacts #5601 - #7200 (1,600) complete today's 1,800 dispatch under Meta TIER_2K.
export const TODAY_DATE_BATCH: DailyBatchConfig = {
  dateStr: "2026-11-01",
  batchName: "01 Nov 2026",
  offset: 5600,
  limit: 1600
};

async function runDateBatch(batch: DailyBatchConfig, isDryRun: boolean): Promise<void> {
  const startContact = batch.offset + 1;
  const endContact = batch.offset + batch.limit;
  console.log("\n==================================================================");
  console.log(` 🚀 DISPATCHING UNIFIED DATE BATCH: ${batch.batchName}`);
  console.log(` Contacts #${startContact} to #${endContact} (${batch.limit} recipients)`);
  console.log(` Target Date: ${batch.dateStr} (IST) | Anti-ban Pacing: 1.2s - 2.0s jittered`);
  console.log(` Meta Capacity: TIER_2K (Single unified batch for the entire day)`);
  console.log("==================================================================\n");

  const startTime = Date.now();
  const args = [
    "node_modules/.bin/tsx",
    "scripts/broadcast.ts",
    `--offset=${batch.offset}`,
    `--limit=${batch.limit}`,
    "--min-delay=1200",
    "--max-delay=2000"
  ];
  if (isDryRun) {
    args.push("--dry-run");
  }

  const broadcastProcess = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env
  });

  const exitCode = await new Promise<number>((resolve) => {
    broadcastProcess.on("close", resolve);
  });

  if (exitCode !== 0) {
    console.error(`\n❌ Date batch ${batch.batchName} exited with code ${exitCode}`);
    throw new Error(`Broadcast failed for ${batch.batchName} with code ${exitCode}`);
  }

  if (isDryRun) {
    console.log(`✅ [DRY RUN] Date batch ${batch.batchName} validated successfully.`);
    return;
  }

  // 1. Locate newly generated broadcast log
  const files = readdirSync("data/broadcasts")
    .filter((f) => f.startsWith("broadcast-") && f.endsWith(".json"))
    .sort();
  const latestLog = files[files.length - 1];
  console.log(`\n[STEP 1/3] Latest broadcast log: data/broadcasts/${latestLog}`);

  // 2. Direct database sync & merge into single date batch
  console.log("[STEP 2/3] Syncing batch directly to PostgreSQL CRM database...");
  try {
    await initDatabase();
    const repo = getAnalyticsRepository();
    if (repo) {
      await syncBroadcastLogsToRepository(repo);
      const pool = (repo as any).pool;
      await pool.query(`
        UPDATE contacts
        SET 
          campaign_day = $1,
          source_detail = COALESCE(source_detail, 'broadcast-' || $2 || '.json')
        WHERE (first_seen_at AT TIME ZONE 'Asia/Kolkata')::date = $2::date
           OR (created_at AT TIME ZONE 'Asia/Kolkata')::date = $2::date
      `, [batch.batchName, batch.dateStr]);
      console.log(`✅ Synced and consolidated all contacts for ${batch.batchName} into single batch.`);
    }
  } catch (err: any) {
    console.warn("⚠️ Direct DB sync notice:", err.message);
  }

  // 3. Commit to GitHub and push for Render auto-deploy
  console.log("[STEP 3/3] Committing and pushing to GitHub main...");
  try {
    runCommand(`git add data/broadcasts/ logs/`);
    runCommand(`git commit -m "feat(broadcast): dispatch unified Date Batch ${batch.batchName} (contacts #${startContact} to #${endContact})"`);
    runCommand(`git push origin main`);
    console.log(`✅ Pushed ${batch.batchName} to GitHub main!`);
  } catch (err: any) {
    console.warn("⚠️ Git commit/push note:", err.message);
  }

  // 4. Notify Render
  const RENDER_BASE = "https://sliverstone-developer-wa1.onrender.com";
  console.log(`Notifying Render CRM at ${RENDER_BASE}...`);
  try {
    await axios.post(`${RENDER_BASE}/api/sync/broadcasts`, {}, { timeout: 15000 });
    console.log("✅ Render sync triggered.");
  } catch (err: any) {
    console.warn("⚠️ Render sync note:", err.message);
  }

  const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n🎉 UNIFIED DATE BATCH ${batch.batchName} COMPLETED in ${durationMin} minutes!`);
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("==================================================================");
  console.log(" 🌟 SILVERSTONE 1,800 CONTACTS DISPATCH PIPELINE (META TIER_2K)  ");
  console.log("==================================================================");
  console.log(`Date Batch: ${TODAY_DATE_BATCH.batchName} (${TODAY_DATE_BATCH.dateStr})`);
  console.log(`Recipient Range: Contact #${TODAY_DATE_BATCH.offset + 1} to #${TODAY_DATE_BATCH.offset + TODAY_DATE_BATCH.limit} in contacts.csv`);
  console.log(`Meta Capacity: TIER_2K (Unified single date batch)`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (Preview Only)" : "LIVE SENDING VIA META CLOUD API"}`);
  console.log("==================================================================\n");

  await runDateBatch(TODAY_DATE_BATCH, isDryRun);

  console.log("\n==================================================================");
  console.log(" 🏆 DATE BATCH COMPLETED SUCCESSFULLY!                            ");
  console.log("==================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal dispatch error:", err);
  process.exit(1);
});

