import { initDatabase } from "../src/db/index.js";

async function run() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;
  const res = await pool.query("SELECT COUNT(*) as msg_count FROM messages");
  console.log("Total messages in messages table:", res.rows[0].msg_count);
  
  const sample = await pool.query(`
    SELECT m.id, m.contact_id, c.wa_id, c.phone, c.name, m.direction, m.message_type, m.body_text, m.template_name, m.wa_message_id, m.created_at 
    FROM messages m
    JOIN contacts c ON c.id = m.contact_id
    ORDER BY m.created_at DESC 
    LIMIT 3
  `);
  console.log("Sample messages with contacts:", sample.rows);

  const statusSample = await pool.query(`
    SELECT mse.id, mse.message_id, mse.status, mse.event_timestamp, mse.error_code, mse.error_message
    FROM message_status_events mse
    ORDER BY mse.event_timestamp DESC
    LIMIT 3
  `);
  console.log("Sample status events:", statusSample.rows);

  process.exit(0);
}

run();
