import { initDatabase } from "../src/db/index.js";

async function run() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'contacts'
    ORDER BY ordinal_position;
  `);
  console.log("Columns in contacts:", res.rows.map((r: any) => `${r.column_name} (${r.data_type})`));
  
  const res2 = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'chat_messages'
    ORDER BY ordinal_position;
  `);
  console.log("Columns in chat_messages:", res2.rows.map((r: any) => `${r.column_name} (${r.data_type})`));
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

