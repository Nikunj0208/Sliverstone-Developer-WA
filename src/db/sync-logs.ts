import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AnalyticsRepository } from "./repository.js";

type BroadcastLogItem = {
  phone: string;
  name?: string;
  status: "SENT" | "FAILED";
  messageId?: string;
  error?: string;
};

export async function syncBroadcastLogsToRepository(repo: AnalyticsRepository): Promise<{
  totalFiles: number;
  totalSynced: number;
  batches: Array<{ filename: string; date: string; count: number }>;
}> {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    return { totalFiles: 0, totalSynced: 0, batches: [] };
  }

  const allFiles = await readdir(logsDir);
  const logFiles = allFiles
    .filter((f) => f.startsWith("broadcast-") && f.endsWith(".json"))
    .sort();

  let totalSynced = 0;
  const batches: Array<{ filename: string; date: string; count: number }> = [];

  for (const file of logFiles) {
    const filePath = join(logsDir, file);
    const match = /broadcast-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json/.exec(file);
    if (!match) continue;

    const iso = match[1].replace(/-/g, (m, offset) => (offset > 10 ? ":" : "-")).replace(/:(\d{3}Z)$/, ".$1");
    const batchDate = new Date(iso);
    if (isNaN(batchDate.getTime())) continue;

    try {
      const raw = await readFile(filePath, "utf-8");
      const items: BroadcastLogItem[] = JSON.parse(raw);
      const sentItems = items.filter((item) => item.status === "SENT");

      if (sentItems.length === 0) continue;

      let batchCount = 0;
      for (const item of sentItems) {
        const cleanPhone = item.phone.trim();
        if (!cleanPhone) continue;

        let contact = await repo.findContactByPhone(cleanPhone);
        if (!contact) {
          contact = await repo.createContact({
            wa_id: cleanPhone,
            phone: cleanPhone,
            name: item.name ? item.name.trim() : undefined,
            lead_source: "broadcast_invitation",
            source_detail: file,
            first_seen_at: batchDate,
            last_seen_at: batchDate,
            last_activity_at: batchDate,
            created_at: batchDate,
            updated_at: batchDate
          });
        }

        let conversation = await repo.findOpenConversationByContactId(contact.id);
        if (!conversation) {
          conversation = await repo.createConversation({
            contact_id: contact.id,
            status: "OPEN",
            campaign_id: file.replace(".json", ""),
            opened_at: batchDate,
            last_message_at: batchDate,
            last_outbound_at: batchDate,
            created_at: batchDate,
            updated_at: batchDate
          });
        }

        if (item.messageId) {
          const existingMessage = await repo.findMessageByWaMessageId(item.messageId);
          if (!existingMessage) {
            const message = await repo.createMessage({
              contact_id: contact.id,
              conversation_id: conversation.id,
              wa_message_id: item.messageId,
              direction: "outbound",
              message_type: "template",
              template_name: "silverstone_invitation",
              template_language: "en_US",
              body_text: `Silverstone Invitation sent to ${item.name || "Lead"}`,
              created_at: batchDate
            });

            await repo.createStatusEvent({
              message_id: message.id,
              status: "sent",
              event_timestamp: batchDate
            });
          }
        }

        batchCount++;
        totalSynced++;
      }

      batches.push({
        filename: file,
        date: batchDate.toISOString(),
        count: batchCount
      });
    } catch (err) {
      console.error(`[SYNC] Failed to parse log file ${file}:`, err);
    }
  }

  console.info(`[SYNC] Completed broadcast log import: ${totalSynced} messages across ${batches.length} batches.`);
  return {
    totalFiles: logFiles.length,
    totalSynced,
    batches
  };
}
