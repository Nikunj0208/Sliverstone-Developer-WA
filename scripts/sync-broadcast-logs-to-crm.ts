import { initDatabase } from "../src/db/index.js";
import { syncBroadcastLogsToRepository } from "../src/db/sync-logs.js";

async function main() {
  console.log("==========================================");
  console.log(" SYNCING BROADCAST LOGS TO CRM DATABASE   ");
  console.log("==========================================");

  const repo = await initDatabase();
  const result = await syncBroadcastLogsToRepository(repo);

  console.log("\nSync Summary:");
  console.log(`- Files processed: ${result.totalFiles}`);
  console.log(`- Total records imported: ${result.totalSynced}`);
  console.log("\nBatches detail:");
  for (const b of result.batches) {
    const formattedDate = new Date(b.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    console.log(`  • ${formattedDate}: ${b.count} contacts (${b.filename})`);
  }

  const { total } = await repo.listContacts({ limit: 1 });
  console.log(`\nCRM Total Contacts Now: ${total}`);
  console.log("==========================================");
}

main().catch(console.error);
