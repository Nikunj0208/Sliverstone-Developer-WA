import { initDatabase } from "../src/db/index.js";

async function run() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;
  
  const cCount = await pool.query("SELECT COUNT(*) FROM contacts");
  const cmCount = await pool.query("SELECT COUNT(*) FROM chat_messages");
  const uniqueWaId = await pool.query("SELECT COUNT(DISTINCT wa_id) FROM chat_messages");
  
  console.log(`Contacts total: ${cCount.rows[0].count}`);
  console.log(`Chat messages total: ${cmCount.rows[0].count}`);
  console.log(`Unique wa_id in chat_messages: ${uniqueWaId.rows[0].count}`);

  const sampleChats = await pool.query(`
    SELECT wa_id, direction, message_type, content_body, template_name, status, official_timestamp, wamid
    FROM chat_messages
    ORDER BY official_timestamp DESC
    LIMIT 5
  `);
  console.log("Recent chat_messages:", sampleChats.rows);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

