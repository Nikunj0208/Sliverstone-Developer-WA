import { initDatabase } from "../src/db/index.js";

async function run() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;

  // Pick a contact with messages
  const contactRes = await pool.query(`
    SELECT c.wa_id, c.phone, c.name, COUNT(cm.id) as msg_count
    FROM contacts c
    JOIN chat_messages cm ON cm.wa_id = c.wa_id
    GROUP BY c.wa_id, c.phone, c.name
    ORDER BY msg_count DESC
    LIMIT 3
  `);
  console.log("Contacts with messages:", contactRes.rows);

  const sampleWaId = contactRes.rows[0].wa_id;
  const crmContact = await repo.getCrmContact(sampleWaId);
  const messages = await repo.listChatMessagesByWaId(sampleWaId);
  const syncSnapshot = await repo.getLatestMetaSyncSnapshot();

  console.log("getCrmContact result:", crmContact);
  console.log(`Found ${messages.length} messages for ${sampleWaId}`);
  console.log("First message:", messages[0]);
  console.log("Latest message:", messages[messages.length - 1]);
  console.log("Sync snapshot templates:", syncSnapshot?.templates?.length);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

