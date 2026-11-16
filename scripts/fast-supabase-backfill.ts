import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { config } from "dotenv";
import { runPostgresMigrations } from "../src/db/postgres.js";
import { metaInsightsService } from "../src/services/meta-insights-service.js";
import { getAnalyticsRepository, initDatabase } from "../src/db/index.js";

config();

function formatBatchDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const year = parts[0];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = monthNames[parseInt(parts[1], 10) - 1];
  const day = parts[2];
  return `${day} ${month} ${year}`;
}

async function fastBackfill() {
  console.log("==========================================================");
  console.log(" ⚡ ULTRA-FAST SUPABASE BACKFILL & RESTORATION (BATCH MODE)");
  console.log("==========================================================");

  const startTime = Date.now();
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // 1. Run Migrations
  console.log("\n[1/5] Applying PostgreSQL Schema & Tables to Supabase...");
  await runPostgresMigrations(pool);
  console.log("✅ Schema applied successfully.");

  // 2. Read and parse all broadcast files
  console.log("\n[2/5] Reading all broadcast logs from data/broadcasts/...");
  const files = (await readdir("data/broadcasts"))
    .filter(f => f.startsWith("broadcast-") && f.endsWith(".json"))
    .sort();

  console.log(`Found ${files.length} broadcast log files.`);

  // In-memory collector for deduplication
  interface CollectedContact {
    waId: string;
    phone: string;
    name: string | null;
    campaignDay: string;
    sourceDetail: string;
    firstSeenAt: Date;
    latestStatus: string;
  }

  interface CollectedMessage {
    wamid: string;
    waId: string;
    bodyText: string;
    templateName: string;
    status: string;
    createdAt: Date;
  }

  const contactsMap = new Map<string, CollectedContact>();
  const messagesList: CollectedMessage[] = [];

  for (const file of files) {
    const filePath = join("data/broadcasts", file);
    const match = /broadcast-(\d{4}-\d{2}-\d{2})(?:T(\d{2}-\d{2}-\d{2}-\d{3}Z))?\.json/.exec(file);
    if (!match) continue;

    const dateStr = match[1];
    const timePart = match[2];
    let batchDate: Date;
    if (timePart) {
      const cleanTime = timePart.substring(0, 8).replace(/-/g, ":") + "." + timePart.substring(9);
      batchDate = new Date(`${dateStr}T${cleanTime}`);
    } else {
      batchDate = new Date(`${dateStr}T00:00:00.000Z`);
    }
    if (isNaN(batchDate.getTime())) {
      batchDate = new Date();
    }

    const isTodayOnwards = dateStr >= "2026-11-01";
    const campaignDay = isTodayOnwards ? formatBatchDate(dateStr) : file;

    try {
      const raw = await readFile(filePath, "utf-8");
      const items: Array<{ phone: string; name?: string; status?: string; messageId?: string }> = JSON.parse(raw);
      if (!Array.isArray(items)) continue;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const cleanPhone = (item.phone || "").replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) continue;

        const wamid = item.messageId || `wamid.out_${cleanPhone}_${dateStr}_${i}`;
        const name = item.name ? item.name.trim() : null;

        if (!contactsMap.has(cleanPhone)) {
          contactsMap.set(cleanPhone, {
            waId: cleanPhone,
            phone: cleanPhone,
            name,
            campaignDay,
            sourceDetail: file,
            firstSeenAt: batchDate,
            latestStatus: item.status?.toLowerCase() === "sent" ? "sent" : "delivered"
          });
        } else {
          const existing = contactsMap.get(cleanPhone)!;
          if (name && !existing.name) existing.name = name;
          if (isTodayOnwards) existing.campaignDay = campaignDay;
        }

        messagesList.push({
          wamid,
          waId: cleanPhone,
          bodyText: `Silverstone Invitation sent to ${name || "Lead"}`,
          templateName: "silverstone_invitation",
          status: item.status?.toLowerCase() === "failed" ? "failed" : "sent",
          createdAt: batchDate
        });
      }
    } catch (err: any) {
      console.warn(`Warning reading ${file}:`, err.message);
    }
  }

  const allContacts = Array.from(contactsMap.values());
  console.log(`Parsed ${allContacts.length} unique contacts and ${messagesList.length} messages.`);

  // 3. High-Speed Batch Insert Contacts (Chunks of 200)
  console.log("\n[3/5] Batch inserting contacts into Supabase...");
  const CHUNK_SIZE = 200;

  for (let i = 0; i < allContacts.length; i += CHUNK_SIZE) {
    const chunk = allContacts.slice(i, i + CHUNK_SIZE);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const c of chunk) {
      const id = `cnt_${c.waId}`;
      valuePlaceholders.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'broadcast_invitation', $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, false)`
      );
      params.push(
        id,
        c.waId,
        c.phone,
        c.name,
        c.name,
        c.campaignDay,
        c.sourceDetail,
        c.latestStatus,
        c.firstSeenAt,
        c.firstSeenAt,
        c.firstSeenAt,
        c.firstSeenAt
      );
    }

    const query = `
      INSERT INTO contacts (
        id, wa_id, phone, name, profile_name, campaign_day, source_detail, lead_source, latest_status,
        first_seen_at, last_seen_at, last_activity_at, created_at, opt_out
      ) VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT (wa_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, contacts.name),
        profile_name = COALESCE(EXCLUDED.profile_name, contacts.profile_name),
        campaign_day = COALESCE(EXCLUDED.campaign_day, contacts.campaign_day)
    `;

    await pool.query(query, params);
    process.stdout.write(`\rInserted contacts: ${Math.min(i + CHUNK_SIZE, allContacts.length)} / ${allContacts.length}`);
  }
  console.log("\n✅ All contacts inserted.");

  // Fetch mapped contact IDs
  const contactIdRows = await pool.query("SELECT id, wa_id FROM contacts");
  const contactIdMap = new Map<string, string>();
  for (const r of contactIdRows.rows) {
    contactIdMap.set(r.wa_id, r.id);
  }

  // 4. Batch Insert Conversations & Messages
  console.log("\n[4/5] Batch inserting conversations and messages into Supabase...");

  // Insert Conversations
  for (let i = 0; i < allContacts.length; i += CHUNK_SIZE) {
    const chunk = allContacts.slice(i, i + CHUNK_SIZE);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const c of chunk) {
      const contactId = contactIdMap.get(c.waId);
      if (!contactId) continue;
      const convId = `conv_${c.waId}`;
      valuePlaceholders.push(`($${pIdx++}, $${pIdx++}, 'OPEN', $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      params.push(convId, contactId, c.campaignDay, c.firstSeenAt, c.firstSeenAt);
    }

    if (valuePlaceholders.length > 0) {
      const query = `
        INSERT INTO conversations (id, contact_id, status, campaign_id, last_inbound_at, created_at)
        VALUES ${valuePlaceholders.join(", ")}
        ON CONFLICT (id) DO NOTHING
      `;
      await pool.query(query, params);
    }
  }

  // Deduplicate messagesList by wamid
  const seenWamids = new Set<string>();
  const uniqueMessagesList: CollectedMessage[] = [];
  for (const m of messagesList) {
    if (!seenWamids.has(m.wamid)) {
      seenWamids.add(m.wamid);
      uniqueMessagesList.push(m);
    }
  }

  // Insert chat_messages (used by WhatsApp Web Chat Drawer)
  console.log("Inserting chat_messages for WhatsApp Web Drawer...");
  const CM_CHUNK = 200;
  for (let i = 0; i < uniqueMessagesList.length; i += CM_CHUNK) {
    const chunk = uniqueMessagesList.slice(i, i + CM_CHUNK);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const m of chunk) {
      const cmId = `cm_${m.wamid.replace(/[^a-zA-Z0-9]/g, "").slice(-30)}`;
      valuePlaceholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, 'outbound', 'template', $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      params.push(cmId, m.wamid, m.waId, `Template: ${m.templateName}`, m.templateName, m.status, m.createdAt, m.createdAt);
    }

    if (valuePlaceholders.length > 0) {
      const query = `
        INSERT INTO chat_messages (id, wamid, wa_id, direction, message_type, content_body, template_name, status, official_timestamp, created_at)
        VALUES ${valuePlaceholders.join(", ")}
        ON CONFLICT (wamid) DO NOTHING
      `;
      await pool.query(query, params);
      process.stdout.write(`\rInserted chat messages: ${Math.min(i + CM_CHUNK, uniqueMessagesList.length)} / ${uniqueMessagesList.length}`);
    }
  }

  // Insert messages table
  console.log("\nInserting messages table...");
  for (let i = 0; i < uniqueMessagesList.length; i += CM_CHUNK) {
    const chunk = uniqueMessagesList.slice(i, i + CM_CHUNK);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const m of chunk) {
      const contactId = contactIdMap.get(m.waId);
      if (!contactId) continue;
      const convId = `conv_${m.waId}`;
      const msgId = `msg_${m.wamid.replace(/[^a-zA-Z0-9]/g, "").slice(-30)}`;
      valuePlaceholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, 'outbound', 'template', $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      params.push(msgId, contactId, convId, m.wamid, m.bodyText, m.templateName, m.createdAt);
    }

    if (valuePlaceholders.length > 0) {
      const query = `
        INSERT INTO messages (id, contact_id, conversation_id, wa_message_id, direction, message_type, body_text, template_name, created_at)
        VALUES ${valuePlaceholders.join(", ")}
        ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
      `;
      await pool.query(query, params);
      process.stdout.write(`\rInserted messages: ${Math.min(i + CM_CHUNK, uniqueMessagesList.length)} / ${uniqueMessagesList.length}`);
    }
  }

  // 5. Sync Live Meta Insights
  console.log("\n\n[5/5] Querying Meta Graph API v23.0 for official health, limit & templates...");
  try {
    const repo = await initDatabase();
    await metaInsightsService.syncToDatabase(repo);
    console.log("✅ Meta Graph API insights synced to Supabase.");
  } catch (err: any) {
    console.warn("⚠️ Meta insights sync notice:", err.message);
  }

  // Verification Audit
  console.log("\n==========================================================");
  console.log(" 📊 SUPABASE RESTORATION AUDIT & VERIFICATION");
  console.log("==========================================================");

  const contactsRes = await pool.query("SELECT COUNT(*) FROM contacts");
  console.log(`- Total Contacts in Supabase: ${contactsRes.rows[0].count}`);

  const chatMessagesRes = await pool.query("SELECT COUNT(*) FROM chat_messages");
  console.log(`- Total Chat Messages in Supabase: ${chatMessagesRes.rows[0].count}`);

  const breakdownRes = await pool.query(`
    SELECT campaign_day, COUNT(*) as lead_count
    FROM contacts
    GROUP BY campaign_day
    ORDER BY campaign_day
  `);
  console.log("\nCampaign Breakdown:");
  console.table(breakdownRes.rows);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 SUPABASE RESTORATION COMPLETED IN ${durationSec}s!`);
  await pool.end();
  process.exit(0);
}

fastBackfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
