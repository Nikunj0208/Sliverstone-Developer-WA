import { readFile, writeFile, mkdir, appendFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import axios from "axios";
import { env } from "../src/config/env.js";
import { uploadMedia } from "../src/meta/media.js";

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
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 200;
  const offset = offsetArg ? parseInt(offsetArg.split("=")[1], 10) : 0;

  const targetContacts = contacts.slice(offset, offset + limit);
  console.log(`Target batch: ${targetContacts.length} contacts (from #${offset + 1} to #${offset + targetContacts.length} of ${contacts.length} total).`);

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

  if (isDryRun) {
    console.log(`\n[DRY RUN MODE] Previewing batch of ${targetContacts.length} contacts (showing first 5):`);
    console.table(targetContacts.slice(0, 5));
    console.log(`\nTotal to be sent in this batch: ${targetContacts.length} messages.`);
    console.log(`To send for real, run: npm run broadcast -- --offset=${offset} --limit=${limit}`);
    return;
  }

  // 3. Prepare Header Media
  console.log("\n[3/4] Uploading header banner image for template...");
  const bannerPath = "client-assets/organized/welcome/Welcome image.jpeg";
  let headerMediaId = "";
  try {
    headerMediaId = await uploadMedia(bannerPath);
    console.log(`Header banner uploaded. Media ID: ${headerMediaId}`);
  } catch (error: any) {
    console.error("Failed to upload header banner:", error.message);
    process.exit(1);
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
  console.log("Applying Meta anti-ban pacing: 1.5s - 2.5s randomized interval per message.\n");
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
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      const errCode = err.response?.data?.error?.code;
      console.error(`${progress} -> FAILED: ${errMsg}`);
      results.push({ phone: contact.phone, name: contact.name, status: "FAILED", error: errMsg });

      // Automatically blacklist failed / non-existent numbers
      try {
        await appendFile(inactivePath, `${contact.phone}\n`);
        inactiveSet.add(contact.phone);
      } catch {}

      // Circuit breaker: halt immediately if rate limit or tier limit is hit
      if (errCode === 131056 || errCode === 131048 || errCode === 130429) {
        console.error("\n🚨 [SAFETY HALT] Meta 24-hour tier limit reached!");
        console.error("Stopping broadcast immediately to protect phone number health.");
        break;
      }
    }

    // Pacing delay (1.5s - 2.5s) to comply with Meta anti-ban safety guidelines
    const delay = 1500 + Math.floor(Math.random() * 1000);
    await sleep(delay);
  }

  // Save results log
  if (!existsSync("logs")) {
    await mkdir("logs", { recursive: true });
  }
  const logFile = `logs/broadcast-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(logFile, JSON.stringify(results, null, 2));
  console.log(`\nBroadcast complete! Detailed log saved to: ${logFile}`);

  const sentCount = results.filter((r) => r.status === "SENT").length;
  const failCount = results.filter((r) => r.status === "FAILED").length;
  console.log(`Summary: ${sentCount} sent successfully, ${failCount} failed.`);
}

main();
