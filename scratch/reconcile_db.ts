import { initDatabase, getAnalyticsRepository } from "../src/db/index.js";
import { readFileSync } from "node:fs";

async function main() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;

  // 1. CRM Contacts count
  const contactRes = await pool.query("SELECT COUNT(*) FROM contacts");
  const totalContactsInDb = Number(contactRes.rows[0].count);

  // 2. CSV Contacts count
  const csvContent = readFileSync("contacts.csv", "utf-8");
  const csvLines = csvContent.split("\n").filter((l) => l.trim().length > 0);
  const totalContactsInCsv = csvLines.length - 1; // subtract header

  const queued = totalContactsInCsv - totalContactsInDb;

  // 3. Message status breakdown
  const statusRes = await pool.query(`
    SELECT status, COUNT(*) as count 
    FROM message_status_events 
    GROUP BY status
  `);
  
  // 4. Inbound replies
  const inboundRes = await pool.query(`
    SELECT COUNT(*) FROM messages WHERE direction = 'inbound'
  `);
  const inboundCount = Number(inboundRes.rows[0].count);

  // 5. Contacts with replied status or inbound message
  const repliedContactsRes = await pool.query(`
    SELECT COUNT(DISTINCT contact_id) FROM messages WHERE direction = 'inbound'
  `);
  const repliedContacts = Number(repliedContactsRes.rows[0].count);

  // 6. Distinct batches from contacts table
  const batchRes = await pool.query(`
    SELECT 
      source_detail, 
      COUNT(*) as count, 
      MIN(first_seen_at) as min_date, 
      MAX(first_seen_at) as max_date 
    FROM contacts 
    GROUP BY source_detail 
    ORDER BY min_date ASC
  `);

  console.log("=== CONTACT RECONCILIATION ===");
  console.log(`Total In CSV: ${totalContactsInCsv}`);
  console.log(`Already Sent / In CRM DB: ${totalContactsInDb}`);
  console.log(`Queued to Send: ${queued}`);
  console.log(`Inbound Messages: ${inboundCount}`);
  console.log(`Replied Contacts: ${repliedContacts}`);

  console.log("\n=== MESSAGE STATUS BREAKDOWN ===");
  for (const row of statusRes.rows) {
    console.log(`- ${row.status}: ${row.count}`);
  }

  console.log("\n=== BATCHES IN DB ===");
  for (const b of batchRes.rows) {
    console.log(`- ${b.source_detail}: ${b.count} contacts (${b.min_date})`);
  }

  process.exit(0);
}

main().catch(console.error);
