import { join } from "node:path";
import { InMemoryAnalyticsRepository } from "../src/db/repository.js";
import { setAnalyticsRepository } from "../src/db/index.js";
import { analyticsService } from "../src/services/analytics-service.js";

async function main() {
  const repo = new InMemoryAnalyticsRepository();
  const storePath = join(process.cwd(), "data", "crm-store.json");
  repo.setPersistentFilePath(storePath);
  await repo.loadFromFile();
  setAnalyticsRepository(repo);

  console.log("Loaded CRM store. Recording real outbound messages for Ankit Koshiya...");

  const updates = [
    {
      phone: "919979064646",
      name: "Ankit Koshiya",
      waMessageId: "wamid.HBgMOTE5OTc5MDY0NjQ2FQIAERgSMTE1NTE5MTFGMTJDMzlEQUY1AA=="
    },
    {
      phone: "919924986666",
      name: "Ankit Koshiya",
      waMessageId: "wamid.HBgMOTE5OTI0OTg2NjY2FQIAERgSQkJBN0U4NTA1QTgxNzM4QjlFAA=="
    }
  ];

  for (const item of updates) {
    const contact = await repo.findContactByPhone(item.phone);
    if (!contact) {
      console.log(`Contact not found for ${item.phone}`);
      continue;
    }

    const conv = await analyticsService.getOrCreateConversation(contact.id);
    
    // Check if message already recorded
    const existing = await repo.findMessageByWaMessageId(item.waMessageId);
    let msgId = existing?.id;
    if (!existing) {
      const msg = await repo.createMessage({
        contact_id: contact.id,
        conversation_id: conv.id,
        wa_message_id: item.waMessageId,
        direction: "outbound",
        message_type: "template",
        template_name: "silverstone_invitation",
        template_language: "en",
        body_text: `Silverstone Invitation sent to ${item.name}`,
        created_at: new Date()
      });
      msgId = msg.id;
      console.log(`Created outbound message ${msgId} for ${item.name} (${item.phone})`);
    }

    if (msgId) {
      await repo.createStatusEvent({
        message_id: msgId,
        status: "sent",
        event_timestamp: new Date()
      });
    }

    await repo.updateContact(contact.id, {
      last_activity_at: new Date()
    });

    await repo.updateConversation(conv.id, {
      last_outbound_at: new Date(),
      last_message_at: new Date()
    });
  }

  await repo.saveToFile();
  console.log("Successfully saved updated store to data/crm-store.json!");
  process.exit(0);
}

main().catch(console.error);
