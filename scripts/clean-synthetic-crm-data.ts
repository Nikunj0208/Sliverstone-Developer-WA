import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const storePath = join(process.cwd(), "data", "crm-store.json");
  console.log("Loading", storePath);

  const raw = await readFile(storePath, "utf-8");
  const data = JSON.parse(raw);

  console.log(`Initial Stats:`);
  console.log(`- Contacts: ${data.contacts.length}`);
  console.log(`- Messages: ${data.messages.length}`);
  console.log(`- Status Events: ${data.statusEvents.length}`);
  console.log(`- Conversation Events: ${data.conversationEvents.length}`);

  // 1. Identify and remove synthetic messages (wamid.reply_... and wamid.btn_...)
  const syntheticMsgIds = new Set<string>();
  const cleanMessages = data.messages.filter((m: any) => {
    const isSynthetic = m.wa_message_id && (
      m.wa_message_id.startsWith("wamid.reply_") ||
      m.wa_message_id.startsWith("wamid.btn_")
    );
    if (isSynthetic) {
      syntheticMsgIds.add(m.id);
      return false;
    }
    return true;
  });

  console.log(`Removed ${syntheticMsgIds.size} synthetic messages.`);
  data.messages = cleanMessages;

  // 2. Identify real inbound message contact IDs
  const contactsWithRealInbound = new Set<string>();
  const latestInboundPerContact = new Map<string, any>();
  for (const m of cleanMessages) {
    if (m.direction === "inbound") {
      contactsWithRealInbound.add(m.contact_id);
      const curr = latestInboundPerContact.get(m.contact_id);
      if (!curr || new Date(m.created_at) > new Date(curr.created_at)) {
        latestInboundPerContact.set(m.contact_id, m);
      }
    }
  }
  console.log(`Contacts with real inbound messages: ${contactsWithRealInbound.size}`);

  // 3. Clean up status events
  // Keep status events for existing messages. Remove synthetic status events from sync-logs
  const validMsgIds = new Set(cleanMessages.map((m: any) => m.id));
  const cleanStatusEvents = data.statusEvents.filter((se: any) => {
    if (!validMsgIds.has(se.message_id)) return false;
    // Keep real Meta webhooks (e.g. error 131049, or real timestamped events)
    return true;
  });
  data.statusEvents = cleanStatusEvents;

  // 4. Clean conversation events
  const seenEventKeys = new Set<string>();
  const cleanConvEvents = data.conversationEvents.filter((ce: any) => {
    if (ce.event_type === "CUSTOMER_REPLIED" || ce.event_type === "BUTTON_CLICKED") {
      // Keep only if contact actually has real inbound activity
      if (!contactsWithRealInbound.has(ce.contact_id)) return false;
    }
    // Deduplicate repetitive events
    const key = `${ce.conversation_id}_${ce.event_type}_${ce.event_value || ""}`;
    if (seenEventKeys.has(key)) return false;
    seenEventKeys.add(key);
    return true;
  });
  data.conversationEvents = cleanConvEvents;

  // 5. Update conversations to accurately reflect real activity
  for (const conv of data.conversations) {
    const realInbound = latestInboundPerContact.get(conv.contact_id);
    if (!realInbound) {
      conv.last_inbound_at = null;
      conv.last_customer_message_id = null;
      conv.last_customer_message_at = null;
      conv.last_customer_reply_at = null;
      conv.unread_count = 0;
    } else {
      conv.last_inbound_at = realInbound.created_at;
      conv.last_customer_message_id = realInbound.id;
      conv.last_customer_message_at = realInbound.created_at;
      conv.last_customer_reply_at = realInbound.created_at;
    }
  }

  // 6. Update contacts
  for (const contact of data.contacts) {
    const realInbound = latestInboundPerContact.get(contact.id);
    if (!realInbound) {
      // Revert last_activity_at to creation/broadcast date
      contact.last_activity_at = contact.first_seen_at || contact.created_at;
    }
  }

  console.log(`\nCleaned Stats:`);
  console.log(`- Contacts: ${data.contacts.length}`);
  console.log(`- Messages: ${data.messages.length}`);
  console.log(`- Status Events: ${data.statusEvents.length}`);
  console.log(`- Conversation Events: ${data.conversationEvents.length}`);

  await writeFile(storePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\n✅ Successfully saved 100% clean, authentic CRM store to ${storePath}!`);
}

main().catch(console.error);
