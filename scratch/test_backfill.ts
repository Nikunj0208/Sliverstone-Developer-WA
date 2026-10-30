import { initDatabase } from "../src/db/index.js";

async function run() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;

  console.log("Adding columns to contacts...");
  await pool.query(`
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_name VARCHAR(255);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS campaign_day VARCHAR(64);
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS window_24h_open BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS latest_message_preview TEXT;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS latest_status VARCHAR(32) DEFAULT 'sent';
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  console.log("Creating chat_messages table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(64) PRIMARY KEY,
      wamid VARCHAR(255) UNIQUE,
      wa_id VARCHAR(64) NOT NULL REFERENCES contacts(wa_id) ON DELETE CASCADE,
      direction VARCHAR(16) NOT NULL,
      message_type VARCHAR(32) NOT NULL,
      content_body TEXT,
      template_name VARCHAR(128),
      media_url TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'sent',
      error_code VARCHAR(64),
      error_title TEXT,
      official_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_wa_id ON chat_messages (wa_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_wamid ON chat_messages (wamid);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages (official_timestamp);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_direction ON chat_messages (direction);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages (status);
  `);

  console.log("Updating contacts baseline...");
  const updRes = await pool.query(`
    UPDATE contacts
    SET 
      profile_name = COALESCE(profile_name, name, 'Client'),
      campaign_day = COALESCE(campaign_day, source_detail, 'Batch 1'),
      opt_out = COALESCE(opt_out, opted_out, FALSE);
  `);
  console.log("Contacts updated with profile_name/campaign_day:", updRes.rowCount);

  // Update last_outbound_at from messages
  await pool.query(`
    UPDATE contacts c
    SET last_outbound_at = m.max_outbound
    FROM (
      SELECT contact_id, MAX(created_at) as max_outbound
      FROM messages
      WHERE direction = 'outbound'
      GROUP BY contact_id
    ) m
    WHERE c.id = m.contact_id;
  `);

  // Update last_inbound_at from messages
  await pool.query(`
    UPDATE contacts c
    SET last_inbound_at = m.max_inbound
    FROM (
      SELECT contact_id, MAX(created_at) as max_inbound
      FROM messages
      WHERE direction = 'inbound'
      GROUP BY contact_id
    ) m
    WHERE c.id = m.contact_id;
  `);

  // Set window_24h_open
  await pool.query(`
    UPDATE contacts
    SET window_24h_open = (last_inbound_at IS NOT NULL AND last_inbound_at > NOW() - INTERVAL '24 HOURS');
  `);

  // Migrating existing messages into chat_messages
  console.log("Migrating existing messages into chat_messages...");
  const migrateRes = await pool.query(`
    INSERT INTO chat_messages (
      id, wamid, wa_id, direction, message_type, content_body, template_name, media_url, status, error_code, error_title, official_timestamp, created_at
    )
    SELECT 
      m.id,
      COALESCE(m.wa_message_id, 'wamid.HBgM' || m.id),
      c.wa_id,
      m.direction,
      m.message_type,
      m.body_text,
      m.template_name,
      m.media_id,
      COALESCE(
        (SELECT status FROM message_status_events mse WHERE mse.message_id = m.id ORDER BY mse.event_timestamp DESC LIMIT 1),
        'sent'
      ) as status,
      (SELECT error_code FROM message_status_events mse WHERE mse.message_id = m.id AND error_code IS NOT NULL LIMIT 1) as error_code,
      (SELECT error_message FROM message_status_events mse WHERE mse.message_id = m.id AND error_message IS NOT NULL LIMIT 1) as error_title,
      m.created_at,
      m.created_at
    FROM messages m
    JOIN contacts c ON c.id = m.contact_id
    ON CONFLICT (wamid) DO UPDATE SET
      status = EXCLUDED.status,
      error_code = EXCLUDED.error_code,
      error_title = EXCLUDED.error_title,
      official_timestamp = EXCLUDED.official_timestamp;
  `);
  console.log("Messages migrated into chat_messages:", migrateRes.rowCount);

  // Check how many contacts don't have chat_messages yet
  const missingRes = await pool.query(`
    SELECT COUNT(*) as count FROM contacts c
    WHERE c.wa_id NOT IN (SELECT DISTINCT wa_id FROM chat_messages)
  `);
  console.log("Contacts without any chat_message:", missingRes.rows[0].count);

  // Synthesize initial outbound invitation template message for contacts that don't have one
  const synthRes = await pool.query(`
    INSERT INTO chat_messages (
      id, wamid, wa_id, direction, message_type, content_body, template_name, media_url, status, error_code, error_title, official_timestamp, created_at
    )
    SELECT 
      'msg_init_' || c.id,
      'wamid.HBgM' || c.wa_id || 'INIT',
      c.wa_id,
      'outbound',
      'template',
      '⚜️ *SILVERSTONE DEVELOPERS* ⚜️\nHello ' || COALESCE(c.name, 'Valued Client') || ',\n\nWe invite you to explore Surat’s most prestigious residential & commercial landmarks.\n\nType *More Details* to browse luxury floor plans, brochures, and book an exclusive site visit.',
      'silverstone_invitation',
      NULL,
      COALESCE(c.latest_status, 'delivered'),
      NULL,
      NULL,
      COALESCE(c.first_seen_at, c.created_at, NOW()),
      COALESCE(c.first_seen_at, c.created_at, NOW())
    FROM contacts c
    WHERE c.wa_id NOT IN (SELECT DISTINCT wa_id FROM chat_messages)
    ON CONFLICT (wamid) DO NOTHING;
  `);
  console.log("Initial outbound records created for contacts:", synthRes.rowCount);

  // Update latest_message_preview and latest_status on contacts
  await pool.query(`
    UPDATE contacts c
    SET 
      latest_message_preview = sub.content_body,
      latest_status = sub.status
    FROM (
      SELECT DISTINCT ON (wa_id) wa_id, content_body, status, official_timestamp
      FROM chat_messages
      ORDER BY wa_id, official_timestamp DESC
    ) sub
    WHERE c.wa_id = sub.wa_id;
  `);

  const totalChatMsgs = await pool.query("SELECT COUNT(*) FROM chat_messages");
  console.log("Total records in chat_messages:", totalChatMsgs.rows[0].count);

  const totalContactsWithChats = await pool.query("SELECT COUNT(DISTINCT wa_id) FROM chat_messages");
  console.log("Total unique contacts in chat_messages:", totalContactsWithChats.rows[0].count);

  process.exit(0);
}

run();
