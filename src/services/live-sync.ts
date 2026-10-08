import { type AnalyticsRepository } from "../db/repository.js";

export async function syncFromLiveRender(repo: AnalyticsRepository): Promise<{
  synced: boolean;
  importedContacts: number;
  importedMessages: number;
  message?: string;
}> {
  const liveUrl = process.env.LIVE_RENDER_URL || "https://sliverstone-developer-wa1.onrender.com";
  try {
    const res = await fetch(`${liveUrl}/api/contacts?limit=100`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      return { synced: false, importedContacts: 0, importedMessages: 0, message: `Status ${res.status}` };
    }

    const data = await res.json();
    let importedContacts = 0;
    let importedMessages = 0;

    for (const c of data.contacts || []) {
      // Check if contact has replied or has unread messages or has multiple messages
      if (c.hasReplied || c.unread || c.totalMessages > 1) {
        const detailRes = await fetch(`${liveUrl}/api/contacts/${c.id}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000)
        });
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();

        // Find or merge contact
        let existingContact = await repo.findContactByPhone(detail.contact.phone);
        if (!existingContact && detail.contact.wa_id) {
          existingContact = await repo.findContactByWaId(detail.contact.wa_id);
        }

        let contactId: string;
        if (!existingContact) {
          const created = await repo.createContact({
            ...detail.contact,
            first_seen_at: new Date(detail.contact.first_seen_at),
            last_seen_at: new Date(detail.contact.last_seen_at || detail.contact.first_seen_at),
            last_activity_at: new Date(detail.contact.last_activity_at || detail.contact.first_seen_at),
            created_at: new Date(detail.contact.created_at || detail.contact.first_seen_at),
            updated_at: new Date(detail.contact.updated_at || detail.contact.first_seen_at)
          });
          contactId = created.id;
          importedContacts++;
        } else {
          contactId = existingContact.id;
          await repo.updateContact(contactId, {
            name: detail.contact.name || existingContact.name,
            last_activity_at: new Date(detail.contact.last_activity_at || Date.now()),
            last_seen_at: new Date(detail.contact.last_seen_at || Date.now())
          });
        }

        // Find or create conversation
        let conv = await repo.findOpenConversationByContactId(contactId);
        if (!conv) {
          const remoteConv = detail.conversations?.[0] || detail.conversation;
          conv = await repo.createConversation({
            contact_id: contactId,
            status: "OPEN",
            opened_at: new Date(remoteConv?.opened_at || Date.now()),
            last_message_at: new Date(remoteConv?.last_message_at || Date.now()),
            last_inbound_at: remoteConv?.last_inbound_at ? new Date(remoteConv.last_inbound_at) : undefined,
            last_customer_message_at: remoteConv?.last_customer_message_at ? new Date(remoteConv.last_customer_message_at) : undefined,
            created_at: new Date(remoteConv?.created_at || Date.now()),
            updated_at: new Date(remoteConv?.updated_at || Date.now())
          });
        }

        if (conv) {
          // Merge messages
          for (const msg of detail.messages || []) {
            let existingMsg = msg.wa_message_id ? await repo.findMessageByWaMessageId(msg.wa_message_id) : null;
            if (!existingMsg) {
              existingMsg = await repo.createMessage({
                contact_id: contactId,
                conversation_id: conv.id,
                wa_message_id: msg.wa_message_id,
                direction: msg.direction,
                message_type: msg.message_type,
                template_name: msg.template_name,
                template_language: msg.template_language,
                body_text: msg.body_text,
                button_id: msg.button_id,
                list_row_id: msg.list_row_id,
                media_id: msg.media_id,
                created_at: new Date(msg.created_at)
              });
              importedMessages++;
            }
          }

          // Merge statuses
          for (const st of detail.statuses || []) {
            await repo.createStatusEvent({
              message_id: st.message_id,
              status: st.status,
              recipient_id: st.recipient_id,
              event_timestamp: new Date(st.event_timestamp),
              error_code: st.error_code,
              error_message: st.error_message,
              received_at: new Date(st.received_at)
            });
          }

          // Merge events
          for (const ev of detail.events || detail.projectEvents || []) {
            await repo.createConversationEvent({
              conversation_id: conv.id,
              contact_id: contactId,
              event_type: ev.event_type,
              event_value: ev.event_value,
              project_id: ev.project_id,
              metadata_json: ev.metadata_json,
              created_at: new Date(ev.created_at)
            });
          }
        }
      }
    }

    return { synced: true, importedContacts, importedMessages };
  } catch (err: any) {
    return { synced: false, importedContacts: 0, importedMessages: 0, message: err.message };
  }
}
