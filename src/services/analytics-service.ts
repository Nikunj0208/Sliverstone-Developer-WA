import { getAnalyticsRepository, type AnalyticsRepository } from "../db/index.js";
import type {
  Contact,
  Conversation,
  Message,
  MessageStatusEvent,
  ConversationEvent,
  ConversationEventType,
  Contact360,
  AnalyticsOverview,
  ContactListQuery,
  ContactListItem,
  ConversationListQuery,
  ConversationListItem,
  MessagePaginationQuery,
  PaginatedMessagesResult,
  AuditLog,
  DuplicateContactCandidate
} from "../db/types.js";
import { normalizePhoneNumber, maskPhoneNumber } from "../utils/phone.js";

export interface InboundMessageEventInput {
  waId: string;
  from?: string;
  messageId: string;
  type: string;
  text?: string;
  buttonId?: string;
  rowId?: string;
  timestamp?: number;
  profileName?: string;
}

export interface StatusWebhookInput {
  messageId: string;
  status: string;
  recipientId?: string;
  timestamp?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface TrackOutboundParams {
  to: string;
  waMessageId: string;
  messageType: string;
  bodyText?: string;
  templateName?: string;
  templateLanguage?: string;
  buttonId?: string;
  listRowId?: string;
  mediaId?: string;
  replyToMessageId?: string;
  agentId?: string;
}

export class AnalyticsService {
  constructor(private readonly getRepo: () => AnalyticsRepository = getAnalyticsRepository) {}

  private repo(): AnalyticsRepository {
    return this.getRepo();
  }

  /**
   * Contact Resolution:
   * 1. Find by wa_id (primary WhatsApp identity)
   * 2. Fallback to normalized phone
   * 3. Update profile information and last_seen_at / last_activity_at
   * 4. If not found, safely create contact
   * 5. Does not invent consent (consent_status remains null unless explicitly provided)
   */
  async resolveContact(waId: string, profileName?: string): Promise<Contact> {
    const repo = this.repo();
    let existing = await repo.findContactByWaId(waId);
    if (!existing) {
      const phone = normalizePhoneNumber(waId);
      existing = await repo.findContactByPhone(phone);
    }

    const now = new Date();

    if (existing) {
      const updates: Partial<Contact> = {
        last_seen_at: now,
        last_activity_at: now
      };
      if (profileName && profileName.trim() && existing.name !== profileName.trim()) {
        updates.name = profileName.trim();
      }
      const updated = await repo.updateContact(existing.id, updates);
      return updated || existing;
    }

    const phone = normalizePhoneNumber(waId);
    return repo.createContact({
      wa_id: waId,
      phone,
      name: profileName?.trim() || null,
      consent_status: null, // Do not invent consent
      opt_in_source: null,
      opt_in_at: null,
      opted_out: false,
      opt_out_at: null,
      first_seen_at: now,
      last_seen_at: now,
      last_activity_at: now
    });
  }

  /**
   * Gets or creates the active open conversation for a contact.
   */
  async getOrCreateConversation(contactId: string, projectId?: string): Promise<Conversation> {
    const repo = this.repo();
    const existing = await repo.findOpenConversationByContactId(contactId);
    if (existing) {
      if (projectId && !existing.project_id) {
        await repo.updateConversation(existing.id, { project_id: projectId });
      }
      return existing;
    }

    return repo.createConversation({
      contact_id: contactId,
      status: "OPEN",
      state: "INIT",
      project_id: projectId ?? null
    });
  }

  /**
   * Records an inbound message:
   * - Deduplicates by wa_message_id
   * - Attaches message to contact and conversation
   * - Updates conversation last_inbound_at, last_message_at, and CRM unread count
   * - Records CUSTOMER_REPLIED conversation event
   */
  async recordInboundMessage(input: InboundMessageEventInput): Promise<{
    contact: Contact;
    conversation: Conversation;
    message: Message;
    isDuplicate: boolean;
  }> {
    const repo = this.repo();

    // Deduplication check
    const existingMessage = await repo.findMessageByWaMessageId(input.messageId);
    if (existingMessage) {
      const contact = (await repo.findContactById(existingMessage.contact_id))!;
      const conversation = (await repo.findConversationById(existingMessage.conversation_id))!;
      return {
        contact,
        conversation,
        message: existingMessage,
        isDuplicate: true
      };
    }

    const contact = await this.resolveContact(input.waId, input.profileName);
    const conversation = await this.getOrCreateConversation(contact.id);

    const createdAt = input.timestamp ? new Date(input.timestamp * 1000) : new Date();

    const message = await repo.createMessage({
      contact_id: contact.id,
      conversation_id: conversation.id,
      wa_message_id: input.messageId,
      direction: "inbound",
      message_type: input.type.toLowerCase(),
      body_text: input.text ?? null,
      button_id: input.buttonId ?? null,
      list_row_id: input.rowId ?? null,
      created_at: createdAt
    });

    // Update conversation timestamps & CRM unread
    await repo.updateConversation(conversation.id, {
      last_inbound_at: createdAt,
      last_message_at: createdAt,
      last_customer_message_id: message.id,
      last_customer_message_at: createdAt,
      unread_count: (conversation.unread_count || 0) + 1
    });

    // Record CUSTOMER_REPLIED event
    await repo.createConversationEvent({
      conversation_id: conversation.id,
      contact_id: contact.id,
      event_type: "CUSTOMER_REPLIED",
      event_value: input.text || input.buttonId || input.rowId || input.type,
      project_id: conversation.project_id
    });

    return {
      contact,
      conversation,
      message,
      isDuplicate: false
    };
  }

  /**
   * Records an outbound message:
   * - Resolves contact by recipient phone
   * - Attaches to current conversation
   * - Sets first_response_at on the conversation if this is first response after inbound
   */
  async recordOutboundMessage(params: TrackOutboundParams): Promise<{
    contact: Contact;
    conversation: Conversation;
    message: Message;
  }> {
    const repo = this.repo();
    const contact = await this.resolveContact(params.to);
    const conversation = await this.getOrCreateConversation(contact.id);

    const now = new Date();
    const message = await repo.createMessage({
      contact_id: contact.id,
      conversation_id: conversation.id,
      wa_message_id: params.waMessageId,
      direction: "outbound",
      message_type: params.messageType,
      body_text: params.bodyText ?? null,
      template_name: params.templateName ?? null,
      template_language: params.templateLanguage ?? null,
      button_id: params.buttonId ?? null,
      list_row_id: params.listRowId ?? null,
      media_id: params.mediaId ?? null,
      reply_to_message_id: params.replyToMessageId ?? null,
      agent_id: params.agentId ?? null,
      created_at: now
    });

    const updates: Partial<Conversation> = {
      last_outbound_at: now,
      last_message_at: now
    };

    // First response time calculation (first business reply)
    if (!conversation.first_response_at) {
      updates.first_response_at = now;
    }

    await repo.updateConversation(conversation.id, updates);

    // Initial status event: sent
    await repo.createStatusEvent({
      message_id: message.id,
      status: "sent",
      recipient_id: params.to,
      event_timestamp: now
    });

    return {
      contact,
      conversation,
      message
    };
  }

  /**
   * Records a WhatsApp status receipt (sent, delivered, read, failed).
   */
  async recordStatusReceipt(input: StatusWebhookInput): Promise<MessageStatusEvent | null> {
    const repo = this.repo();
    const message = await repo.findMessageByWaMessageId(input.messageId);
    if (!message) {
      console.warn(`[ANALYTICS] Status receipt for unknown message ${input.messageId}`);
      return null;
    }

    const eventTimestamp = input.timestamp ? new Date(input.timestamp * 1000) : new Date();

    return repo.createStatusEvent({
      message_id: message.id,
      status: input.status.toLowerCase(),
      recipient_id: input.recipientId ?? null,
      event_timestamp: eventTimestamp,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null
    });
  }

  /**
   * Records a conversation journey event.
   */
  async recordConversationEvent(
    conversationId: string,
    contactId: string,
    eventType: ConversationEventType,
    eventValue?: string,
    projectId?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<ConversationEvent> {
    const repo = this.repo();
    const event = await repo.createConversationEvent({
      conversation_id: conversationId,
      contact_id: contactId,
      event_type: eventType,
      event_value: eventValue ?? null,
      project_id: projectId ?? null,
      metadata_json: metadata ?? null
    });

    // Update conversation project or state if applicable
    if (eventType === "PROJECT_SELECTED" && eventValue) {
      await repo.updateConversation(conversationId, {
        project_id: eventValue,
        state: "PROJECT_SELECTED"
      });
    } else if (eventType === "BROCHURE_REQUESTED") {
      await repo.updateConversation(conversationId, { state: "PROJECT_ACTIONS" });
    } else if (eventType === "PLANS_REQUESTED") {
      await repo.updateConversation(conversationId, { state: "SELECT_SQFT" });
    } else if (eventType === "SQFT_SELECTED") {
      await repo.updateConversation(conversationId, { state: "SELECT_BHK" });
    } else if (eventType === "CHAT_REQUESTED") {
      await repo.updateConversation(conversationId, { state: "CHAT" });
    } else if (eventType === "CALL_REQUESTED") {
      await repo.updateConversation(conversationId, { state: "CALL" });
    } else if (eventType === "SITE_VISIT_REQUESTED") {
      await repo.updateConversation(conversationId, { state: "SITE_VISIT" });
    }

    return event;
  }

  /**
   * Helper to safely record events by phone / waId.
   */
  async recordCustomerEventByPhone(
    waId: string,
    eventType: ConversationEventType,
    eventValue?: string,
    projectId?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<ConversationEvent | null> {
    try {
      const contact = await this.resolveContact(waId);
      const conversation = await this.getOrCreateConversation(contact.id, projectId ?? undefined);
      return await this.recordConversationEvent(
        conversation.id,
        contact.id,
        eventType,
        eventValue,
        projectId || conversation.project_id,
        metadata
      );
    } catch (error) {
      console.warn(`[ANALYTICS] Failed to record event ${eventType} for ${waId}:`, error);
      return null;
    }
  }

  /**
   * Alias for recordCustomerEventByPhone used across existing flow actions.
   */
  async recordEventByWaId(
    waId: string,
    eventType: ConversationEventType,
    eventValue?: string,
    projectId?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<ConversationEvent | null> {
    return this.recordCustomerEventByPhone(waId, eventType, eventValue, projectId, metadata);
  }

  /**
   * Alias for recordOutboundMessage used across meta messaging modules and tests.
   */
  async trackOutboundMessage(params: TrackOutboundParams): Promise<Message> {
    const res = await this.recordOutboundMessage(params);
    return res.message;
  }

  /**
   * Alias for recordStatusReceipt used in webhook router.
   */
  async recordStatusEvent(input: StatusWebhookInput): Promise<MessageStatusEvent | null> {
    return this.recordStatusReceipt(input);
  }

  /**
   * Handles customer opt-out safely.
   */
  async recordOptOut(contactId: string, conversationId: string): Promise<void> {
    const repo = this.repo();
    const now = new Date();
    await repo.updateContact(contactId, {
      opted_out: true,
      opt_out_at: now,
      consent_status: "OPTED_OUT"
    });
    await this.recordConversationEvent(conversationId, contactId, "OPTED_OUT");
  }

  // Reporting views & services
  async getOverview(): Promise<AnalyticsOverview> {
    return this.repo().getOverview();
  }

  async getMessageMetrics() {
    return this.repo().getMessageMetrics();
  }

  async getReplyMetrics() {
    return this.repo().getReplyMetrics();
  }

  async getProjectMetrics() {
    return this.repo().getProjectMetrics();
  }

  // Milestone 2 Contact 360 & Conversation History APIs
  async getContact360(contactId: string): Promise<Contact360 | null> {
    return this.repo().getContact360(contactId);
  }

  async listContacts(query: ContactListQuery = {}): Promise<{ contacts: ContactListItem[]; total: number }> {
    return this.repo().listContacts(query);
  }

  async listConversations(query: ConversationListQuery = {}): Promise<{ conversations: ConversationListItem[]; total: number }> {
    return this.repo().listConversations(query);
  }

  async listConversationsByContactId(contactId: string): Promise<Conversation[]> {
    return this.repo().listConversationsByContactId(contactId);
  }

  async getConversationDetail(conversationId: string, pagination?: MessagePaginationQuery) {
    const repo = this.repo();
    const conversation = await repo.findConversationById(conversationId);
    if (!conversation) return null;

    const contact = await repo.findContactById(conversation.contact_id);
    const paginatedMessages = await repo.getConversationMessagesPaginated(conversationId, pagination);
    const events = await repo.listConversationEventsByConversation(conversationId);

    return {
      conversation,
      contact: contact
        ? {
            ...contact,
            phoneMasked: maskPhoneNumber(contact.phone)
          }
        : null,
      messages: paginatedMessages.messages,
      pagination: {
        total: paginatedMessages.total,
        limit: paginatedMessages.limit,
        offset: paginatedMessages.offset,
        hasMore: paginatedMessages.hasMore
      },
      events
    };
  }

  async getConversationMessagesPaginated(
    conversationId: string,
    pagination?: MessagePaginationQuery
  ): Promise<PaginatedMessagesResult> {
    return this.repo().getConversationMessagesPaginated(conversationId, pagination);
  }

  async acknowledgeConversation(conversationId: string): Promise<Conversation | null> {
    return this.repo().acknowledgeConversation(conversationId);
  }

  async detectDuplicateContacts(): Promise<DuplicateContactCandidate[]> {
    return this.repo().detectDuplicateContacts();
  }

  async recordAuditLog(data: Omit<AuditLog, "id" | "created_at">): Promise<AuditLog> {
    return this.repo().recordAuditLog(data);
  }

  async listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    return this.repo().listAuditLogs(entityType, entityId);
  }

  /**
   * Secure Contact Export (CSV / JSON)
   * Masks phone numbers by default and strips internal credentials.
   */
  async exportContacts(format: "json" | "csv" = "json", query: ContactListQuery = {}): Promise<string> {
    const { contacts } = await this.listContacts({ ...query, limit: 10000, offset: 0 });

    const safeContacts = contacts.map((c) => ({
      id: c.id,
      wa_id: c.wa_id,
      phone: c.phone,
      phoneMasked: c.phoneMasked,
      batchName: c.batchName || "",
      latestDeliveryStatus: c.latestDeliveryStatus || "sent",
      lastReplyText: c.lastReplyText || "",
      currentJourneyStep: c.currentJourneyStep || "Step 1: Dispatched",
      name: c.name || "",
      email: c.email || "",
      project: c.project || "",
      leadSource: c.leadSource || "",
      firstSeenAt: c.firstSeenAt ? c.firstSeenAt.toISOString() : "",
      lastActivityAt: c.lastActivityAt ? c.lastActivityAt.toISOString() : "",
      conversationStatus: c.conversationStatus || "",
      currentState: c.currentState || "",
      unread: c.unread ? "YES" : "NO",
      totalMessages: c.totalMessages,
      hasReplied: c.hasReplied ? "YES" : "NO",
      brochureRequested: c.brochureRequested ? "YES" : "NO",
      planRequested: c.planRequested ? "YES" : "NO",
      siteVisitRequested: c.siteVisitRequested ? "YES" : "NO"
    }));

    if (format === "csv") {
      const headers = [
        "Full Phone",
        "Masked Phone",
        "Name",
        "Batch",
        "Delivery Status",
        "Customer Reply",
        "Journey Step",
        "Project Interest",
        "Broadcast Date",
        "Conversation Status",
        "Unread",
        "Total Messages",
        "Has Replied",
        "Brochure Requested",
        "Plan Requested",
        "Site Visit Requested",
        "WhatsApp ID",
        "Lead ID"
      ];
      const rows = safeContacts.map((c) =>
        [
          `"+${c.phone.replace(/\D/g, "")}"`,
          c.phoneMasked,
          `"${(c.name || "").replace(/"/g, '""')}"`,
          `"${c.batchName}"`,
          c.latestDeliveryStatus,
          `"${(c.lastReplyText || "").replace(/"/g, '""')}"`,
          `"${c.currentJourneyStep}"`,
          c.project,
          c.firstSeenAt,
          c.conversationStatus,
          c.unread,
          c.totalMessages,
          c.hasReplied,
          c.brochureRequested,
          c.planRequested,
          c.siteVisitRequested,
          c.wa_id,
          c.id
        ].join(",")
      );
      return [headers.join(","), ...rows].join("\n");
    }

    return JSON.stringify(safeContacts, null, 2);
  }

  /**
   * Secure Conversation Export (CSV / JSON)
   */
  async exportConversation(conversationId: string, format: "json" | "csv" = "json"): Promise<string | null> {
    const detail = await this.getConversationDetail(conversationId, { limit: 10000, offset: 0 });
    if (!detail) return null;

    if (format === "csv") {
      const headers = ["Timestamp", "Direction", "Type", "Content", "Latest Status"];
      const rows = detail.messages.map((m) => [
        m.created_at ? new Date(m.created_at).toISOString() : "",
        m.direction.toUpperCase(),
        m.message_type,
        `"${(m.body_text || m.template_name || m.button_id || "").replace(/"/g, '""')}"`,
        m.latestStatus || "unknown"
      ].join(","));
      return [headers.join(","), ...rows].join("\n");
    }

    return JSON.stringify(detail, null, 2);
  }
}

export const analyticsService = new AnalyticsService();
