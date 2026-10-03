import { readFile, writeFile, mkdir } from "node:fs/promises";
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

  // Safety check for Tier 1
  if (contacts.length > 1000) {
    console.warn(`⚠️ Warning: You have ${contacts.length} contacts. Meta Tier-1 daily limit is 1,000.`);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN MODE] Previewing first 5 contacts:");
    console.table(contacts.slice(0, 5));
    console.log(`\nTotal to be sent: ${contacts.length} messages.`);
    console.log("To send for real, run: npm run broadcast");
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

  // 4. Dispatch Broadcast
  console.log(`\n[4/4] Starting broadcast to ${contacts.length} recipients...`);
  const results: Array<{ phone: string; name?: string; status: "SENT" | "FAILED"; messageId?: string; error?: string }> = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const progress = `[${i + 1}/${contacts.length}] ${contact.phone}`;

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
      console.error(`${progress} -> FAILED: ${errMsg}`);
      results.push({ phone: contact.phone, name: contact.name, status: "FAILED", error: errMsg });
    }

    // 50ms pause between sends (20 msg/sec)
    await sleep(50);
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
