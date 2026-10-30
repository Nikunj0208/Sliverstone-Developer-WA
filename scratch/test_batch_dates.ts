import { initDatabase } from "../src/db/index.js";

async function main() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;

  const res = await pool.query(`
    SELECT 
      (first_seen_at AT TIME ZONE 'Asia/Kolkata')::date as batch_date,
      COUNT(*) as count
    FROM contacts
    GROUP BY batch_date
    ORDER BY batch_date ASC
  `);

  console.log("Datewise Contacts Breakdown:");
  for (const row of res.rows) {
    console.log(`${row.batch_date.toISOString().slice(0, 10)}: ${row.count} contacts`);
  }

  process.exit(0);
}

main().catch(console.error);
