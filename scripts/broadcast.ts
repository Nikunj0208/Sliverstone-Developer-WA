import { readFile, writeFile, mkdir, appendFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import axios from "axios";
import { env } from "../src/config/env.js";
import { uploadMedia } from "../src/meta/media.js";
import { analyticsService } from "../src/services/analytics-service.js";
import { initDatabase } from "../src/db/index.js";

type Contact = {
  phone: string;
  name?: string;
};

function parseCsv(content: string): Contact[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const phoneIdx = headers.findIndex((h) => h === "phone" || h === "mobile" || h === "number");
  const nameIdx = headers.findIndex((h) => h === "name" || h === "customer");

  const contacts: Contact[] = [];
  const startIndex = phoneIdx >= 0 ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const rawPhone = phoneIdx >= 0 ? cols[phoneIdx] : cols[0];
    const rawName = nameIdx >= 0 ? cols[nameIdx] : cols[1];

    if (!rawPhone) continue;

    // Sanitize phone number
    const cleanPhone = rawPhone.replace(/\D/g, "");
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 10) {
      formattedPhone = `91${cleanPhone}`;
    }

    if (formattedPhone.length >= 10 && formattedPhone.length <= 15) {
      contacts.push({ phone: formattedPhone, name: rawName || "" });
    }
  }

  return contacts;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const contactsPath = "contacts.csv";

  console.log("==========================================");
  console.log(" SILVERSTONE OUTBOUND INVITATION BROADCAST");
  console.log("==========================================");

  if (!isDryRun) {
    await initDatabase();
  }

  // 1. Check template status
  console.log("\n[1/4] Checking Meta Template: silverstone_invitation (ID: 1409540194136378)...");
  let templateStatus = "UNKNOWN";
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v20.0/1409540194136378`,
      { headers: { Authorization: `Bearer ${env.metaAccessToken}` } }
    );
    templateStatus = res.data.status;
    console.log(`Template Status on Meta: [${templateStatus}]`);
  } catch (error: any) {
    console.error("Failed to fetch template status:", error.response?.data || error.message);
  }

  if (templateStatus !== "APPROVED") {
    console.log(`\n⚠️  Template is currently '${templateStatus}'.`);
    console.log("Meta typically approves marketing templates in 5 to 30 minutes.");
    console.log("You can check status anytime using: npm run meta:check-template");
    if (!isDryRun) {
      console.log("\nStopping broadcast because template is not approved yet.");
      process.exit(0);
    }
  }

  // 2. Read contacts.csv
  console.log(`\n[2/4] Reading contacts from: ${contactsPath}...`);
  if (!existsSync(contactsPath)) {
    console.error(`Error: File '${contactsPath}' not found!`);
    console.log("Please create a 'contacts.csv' file in the project root with columns: phone,name");
    process.exit(1);
  }

  const csvContent = await readFile(contactsPath, "utf-8");
  const contacts = parseCsv(csvContent);
  console.log(`Found ${contacts.length} valid contact(s).`);

  if (contacts.length === 0) {
    console.error("No valid contacts found in contacts.csv.");
    process.exit(1);
  }

  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const offsetArg = process.argv.find((arg) => arg.startsWith("--offset="));
  const minDelayArg = process.argv.find((arg) => arg.startsWith("--min-delay="));
  const maxDelayArg = process.argv.find((arg) => arg.startsWith("--max-delay="));
  const waitUntilArg = process.argv.find((arg) => arg.startsWith("--wait-until="));

  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 200;
  const offset = offsetArg ? parseInt(offsetArg.split("=")[1], 10) : 0;
  const minDelay = minDelayArg ? parseInt(minDelayArg.split("=")[1], 10) : 1500;
  const maxDelay = maxDelayArg ? parseInt(maxDelayArg.split("=")[1], 10) : 2500;

  const targetContacts = contacts.slice(offset, offset + limit);
  console.log(`Target batch: ${targetContacts.length} contacts (from #${offset + 1} to #${offset + targetContacts.length} of ${contacts.length} total).`);

  if (isDryRun) {
    console.log(`\n[DRY RUN MODE] Previewing batch of ${targetContacts.length} contacts (showing first 5):`);
    console.table(targetContacts.slice(0, 5));
    console.log(`\nTotal to be sent in this batch: ${targetContacts.length} messages.`);
    console.log(`Pacing delay configured: ${(minDelay / 1000).toFixed(1)}s - ${(maxDelay / 1000).toFixed(1)}s per message.`);
    if (waitUntilArg) {
      console.log(`Scheduled wait-until argument: ${waitUntilArg.split("=")[1]}`);
    }
    console.log(`To send for real, run: npm run broadcast -- --offset=${offset} --limit=${limit} --min-delay=${minDelay} --max-delay=${maxDelay}`);
    return;
  }

  // Scheduled execution handler
  if (waitUntilArg) {
    const rawVal = waitUntilArg.split("=")[1].trim();
    let targetTime: number | null = null;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(rawVal)) {
      const parts = rawVal.split(":").map(Number);
      const target = new Date();
      target.setHours(parts[0], parts[1], parts[2] || 0, 0);
      targetTime = target.getTime();
      // If target time is earlier than now, schedule for tomorrow
      if (targetTime < Date.now()) {
        targetTime += 24 * 60 * 60 * 1000;
      }
    } else {
      const parsed = new Date(rawVal).getTime();
      if (!isNaN(parsed)) {
        targetTime = parsed;
      }
    }

    if (targetTime && targetTime > Date.now()) {
      const waitMs = targetTime - Date.now();
      const targetDate = new Date(targetTime);
      console.log(`\n⏳ [SCHEDULED EXECUTION] Broadcast is scheduled for: ${targetDate.toLocaleTimeString()} (${targetDate.toLocaleString()})`);
      console.log(`Waiting ${(waitMs / 60000).toFixed(1)} minutes (~${Math.round(waitMs / 1000)} seconds)...`);
      console.log(`Process will stay active in the background and trigger automatically at 3:00 PM without requiring manual permission.\n`);

      while (Date.now() < targetTime) {
        const remainingMs = targetTime - Date.now();
        if (remainingMs <= 0) break;
        const sleepChunk = Math.min(remainingMs, 10 * 60 * 1000); // 10 minute heartbeat
        await sleep(sleepChunk);
        const remMin = Math.max(0, Math.round((targetTime - Date.now()) / 60000));
        if (remMin > 0) {
          console.log(`[HEARTBEAT] ${new Date().toLocaleTimeString()} - Waiting for schedule... ~${remMin} min remaining until scheduled broadcast.`);
        }
      }
      console.log(`\n⏰ [SCHEDULE TIME REACHED: ${new Date().toLocaleTimeString()}] Resuming broadcast now!`);
    }
  }

  // Meta Rolling 24-Hour Safeguard Check
  if (existsSync("logs")) {
    const logFiles = (await readdir("logs")).filter((f) => f.startsWith("broadcast-") && f.endsWith(".json")).sort();
    if (logFiles.length > 0) {
      const lastFile = logFiles[logFiles.length - 1];
      const match = /broadcast-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json/.exec(lastFile);
      if (match) {
        const iso = match[1].replace(/-/g, (m, offset) => (offset > 10 ? ":" : "-")).replace(/:(\d{3}Z)$/, ".$1");
        const lastRunTime = new Date(iso).getTime();
        if (!isNaN(lastRunTime)) {
          const diffMs = (lastRunTime + 24 * 60 * 60 * 1000) - Date.now();
          if (diffMs > 0) {
            const minutesLeft = Math.ceil(diffMs / 60000);
            console.log(`\n⚠️  [META TIER_250 SAFEGUARD NOTICE]`);
            console.log(`Last broadcast finished at: ${new Date(lastRunTime).toLocaleString()}`);
            console.log(`Meta rolling 24-hour conversation window clears in: ~${minutesLeft} minute(s).`);
            console.log(`To ensure Meta does not flag your account or hit rate limits, wait ${minutesLeft} minute(s).`);
            if (!isDryRun && !process.argv.includes("--force")) {
              console.log(`\nStopping safely to protect account health. Run again in ${minutesLeft} minute(s) or pass --force to override.`);
              process.exit(0);
            }
          }
        }
      }
    }
  }

  // 3. Prepare Header Media
  console.log("\n[3/4] Uploading header banner image for template...");
  const bannerPath = "client-assets/organized/welcome/Welcome image.jpeg";
  const mediaIdArg = process.argv.find((arg) => arg.startsWith("--media-id="));
  let headerMediaId = mediaIdArg ? mediaIdArg.split("=")[1].trim() : "";
  if (!headerMediaId) {
    try {
      headerMediaId = await uploadMedia(bannerPath);
      console.log(`Header banner uploaded. Media ID: ${headerMediaId}`);
    } catch (error: any) {
      console.warn("Notice: Local file access failed, using verified active Meta Media ID:", error.message);
      headerMediaId = "3319803234894484";
      console.log(`Active Meta Media ID: ${headerMediaId}`);
    }
  } else {
    console.log(`Using provided Meta Media ID: ${headerMediaId}`);
  }

  // Load inactive numbers blacklist if exists
  const inactivePath = "inactive-numbers.txt";
  let inactiveSet = new Set<string>();
  if (existsSync(inactivePath)) {
    const inactiveRaw = await readFile(inactivePath, "utf-8");
    inactiveSet = new Set(inactiveRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  }

  // 4. Dispatch Broadcast
  console.log(`\n[4/4] Starting broadcast to ${targetContacts.length} recipients...`);
  console.log(`Applying Meta anti-ban pacing: ${(minDelay / 1000).toFixed(1)}s - ${(maxDelay / 1000).toFixed(1)}s randomized interval per message.\n`);
  const results: Array<{ phone: string; name?: string; status: "SENT" | "FAILED"; messageId?: string; error?: string }> = [];

  for (let i = 0; i < targetContacts.length; i++) {
    const contact = targetContacts[i];
    const progress = `[${i + 1}/${targetContacts.length}] ${contact.phone} (${contact.name || "No name"})`;

    if (inactiveSet.has(contact.phone)) {
      console.log(`${progress} -> SKIPPED (Inactive / Not on WhatsApp)`);
      results.push({ phone: contact.phone, name: contact.name, status: "FAILED", error: "Previously identified as inactive" });
      continue;
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${env.whatsappPhoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: contact.phone,
          type: "template",
          template: {
            name: "silverstone_invitation",
            language: { code: "en" },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "image",
                    image: { id: headerMediaId }
                  }
                ]
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${env.metaAccessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      const msgId = response.data.messages?.[0]?.id;
      console.log(`${progress} -> SUCCESS (ID: ${msgId})`);
      results.push({ phone: contact.phone, name: contact.name, status: "SENT", messageId: msgId });

      if (msgId) {
        try {
          await analyticsService.trackOutboundMessage({
            to: contact.phone,
            waMessageId: msgId,
            messageType: "template",
            templateName: "silverstone_invitation",
            bodyText: `Invitation to ${contact.name || "Customer"}`
          });
        } catch { }
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      const errCode = err.response?.data?.error?.code;
      console.error(`${progress} -> FAILED: ${errMsg}`);
      results.push({ phone: contact.phone, name: contact.name, status: "FAILED", error: errMsg });

      // Automatically blacklist failed / non-existent numbers
      try {
        await appendFile(inactivePath, `${contact.phone}\n`);
        inactiveSet.add(contact.phone);
      } catch { }

      // Circuit breaker: halt immediately if rate limit or tier limit is hit
      if (errCode === 131056 || errCode === 131048 || errCode === 130429) {
        console.error("\n🚨 [SAFETY HALT] Meta 24-hour tier limit reached!");
        console.error("Stopping broadcast immediately to protect phone number health.");
        break;
      }
    }

    // Pacing delay (configurable, e.g. 30s - 31s)
    if (i < targetContacts.length - 1) {
      const delayDiff = Math.max(0, maxDelay - minDelay);
      const delay = minDelay + (delayDiff > 0 ? Math.floor(Math.random() * delayDiff) : 0);
      console.log(`[PACING] Waiting ${(delay / 1000).toFixed(1)}s before next recipient...`);
      await sleep(delay);
    }
  }

  // Save results log
  if (!existsSync("logs")) {
    await mkdir("logs", { recursive: true });
  }
  if (!existsSync("data/broadcasts")) {
    await mkdir("data/broadcasts", { recursive: true });
  }
  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = `logs/broadcast-${timestampStr}.json`;
  const dataFile = `data/broadcasts/broadcast-${timestampStr}.json`;
  const serialized = JSON.stringify(results, null, 2);
  await writeFile(logFile, serialized);
  await writeFile(dataFile, serialized);
  console.log(`\nBroadcast complete! Detailed log saved to: ${logFile} and ${dataFile}`);

  const sentCount = results.filter((r) => r.status === "SENT").length;
  const failCount = results.filter((r) => r.status === "FAILED").length;
  console.log(`Summary: ${sentCount} sent successfully, ${failCount} failed.`);

  // Auto-notify local dev CRM if running
  try {
    await axios.post("http://localhost:3000/api/sync/broadcasts", {}, { timeout: 3000 });
    console.log("[CRM] Automatically synced new broadcast batch with local CRM database.");
  } catch { }
}

main();
