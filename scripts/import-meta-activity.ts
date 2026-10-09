import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";
import { createPostgresPool } from "../src/db/postgres.js";
import { normalizePhoneNumber } from "../src/utils/phone.js";

interface ActivityRecord {
  phone: string;
  wamid?: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim().replace(/^["']|["']$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^["']|["']$/g, ""));
  return values;
}

export async function importMetaActivityCsv(filePath: string): Promise<void> {
  const resolvedPath = resolve(filePath);
  if (!existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading Meta WhatsApp Activity CSV from: ${resolvedPath}`);
  const content = await readFile(resolvedPath, "utf-8");
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length < 2) {
    console.error("❌ CSV file is empty or missing headers.");
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, ""));
  console.log("Detected CSV headers:", headers);

  // Column matching heuristics
  const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("recipient") || h.includes("destination") || h.includes("waid") || h.includes("to"));
  const statusIdx = headers.findIndex(h => h.includes("status") || h.includes("deliverystatus") || h.includes("messagestatus") || h.includes("event"));
  const timeIdx = headers.findIndex(h => h.includes("time") || h.includes("date") || h.includes("timestamp") || h.includes("created"));
  const wamidIdx = headers.findIndex(h => h.includes("wamid") || h.includes("messageid") || h.includes("msgid") || h.includes("id"));
  const errCodeIdx = headers.findIndex(h => h.includes("errorcode") || h.includes("errcode") || h.includes("code"));
  const errMsgIdx = headers.findIndex(h => h.includes("error") || h.includes("reason") || h.includes("description") || h.includes("message"));

  if (phoneIdx === -1 && wamidIdx === -1) {
    console.error("❌ Unable to locate Phone Number or Message ID column in CSV headers.");
    process.exit(1);
  }

  const pool = await createPostgresPool(process.env.DATABASE_URL!);
  let importedCount = 0;
  let readCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length === 0 || !row[0]) continue;

    const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : "";
    const cleanPhone = normalizePhoneNumber(rawPhone);
    const rawStatus = (statusIdx !== -1 ? row[statusIdx] : "").toLowerCase().trim();
    const wamid = wamidIdx !== -1 ? row[wamidIdx]?.trim() : undefined;
    const rawTime = timeIdx !== -1 ? row[timeIdx] : "";
    const eventTime = rawTime ? new Date(rawTime) : new Date();
    const validTime = isNaN(eventTime.getTime()) ? new Date() : eventTime;
    const errCode = errCodeIdx !== -1 ? row[errCodeIdx] : undefined;
    const errMsg = errMsgIdx !== -1 ? row[errMsgIdx] : undefined;

    let targetStatus: "sent" | "delivered" | "read" | "failed" = "sent";
    if (rawStatus.includes("read") || rawStatus.includes("seen") || rawStatus.includes("blue")) {
      targetStatus = "read";
    } else if (rawStatus.includes("deliver")) {
      targetStatus = "delivered";
    } else if (rawStatus.includes("fail") || rawStatus.includes("undeliver") || rawStatus.includes("error")) {
      targetStatus = "failed";
    }

    // Locate message in database by WAMID or contact phone
    let messageId: string | null = null;
    if (wamid) {
      const msgRes = await pool.query("SELECT id, contact_id FROM messages WHERE wa_message_id = $1 LIMIT 1", [wamid]);
      if (msgRes.rows.length > 0) {
        messageId = msgRes.rows[0].id;
      }
    }

    if (!messageId && cleanPhone) {
      const msgRes = await pool.query(`
        SELECT m.id 
        FROM messages m 
        JOIN contacts c ON m.contact_id = c.id 
        WHERE (c.phone = $1 OR c.wa_id = $1 OR c.phone = $2) AND m.direction = 'outbound'
        ORDER BY m.created_at DESC 
        LIMIT 1
      `, [cleanPhone, rawPhone.replace(/\D/g, "")]);

      if (msgRes.rows.length > 0) {
        messageId = msgRes.rows[0].id;
      }
    }

    if (!messageId) {
      skippedCount++;
      continue;
    }

    // Insert genuine status event
    const eventId = `mse_meta_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await pool.query(`
      INSERT INTO message_status_events (
        id, message_id, status, recipient_id, event_timestamp, error_code, error_message, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (message_id, status, event_timestamp) DO NOTHING
    `, [eventId, messageId, targetStatus, cleanPhone, validTime, errCode || null, errMsg || null]);

    // If status is 'read', also ensure 'delivered' exists
    if (targetStatus === "read") {
      const deliveredTime = new Date(validTime.getTime() - 2000);
      const delivEventId = `mse_meta_deliv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await pool.query(`
        INSERT INTO message_status_events (
          id, message_id, status, recipient_id, event_timestamp, received_at
        ) VALUES ($1, $2, 'delivered', $3, $4, NOW())
        ON CONFLICT (message_id, status, event_timestamp) DO NOTHING
      `, [delivEventId, messageId, cleanPhone, deliveredTime]);
      readCount++;
    } else if (targetStatus === "delivered") {
      deliveredCount++;
    } else if (targetStatus === "failed") {
      failedCount++;
    }

    importedCount++;
  }

  await pool.end();

  console.log("\n==========================================");
  console.log("✅ META ACTIVITY IMPORT SUMMARY");
  console.log("==========================================");
  console.log(`Total rows processed: ${lines.length - 1}`);
  console.log(`Successfully matched & imported: ${importedCount}`);
  console.log(`  👁️ Read events: ${readCount}`);
  console.log(`  📬 Delivered events: ${deliveredCount}`);
  console.log(`  ⚠️ Failed events: ${failedCount}`);
  console.log(`Skipped (unknown message / contact): ${skippedCount}`);
  console.log("==========================================\n");
}

if (process.argv[1]?.endsWith("import-meta-activity.ts")) {
  const filePath = process.argv[2] || "data/meta-activity.csv";
  importMetaActivityCsv(filePath).catch(err => {
    console.error("❌ Import error:", err);
    process.exit(1);
  });
}
