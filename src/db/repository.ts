import type {
  Contact,
  Conversation,
  Message,
  MessageStatusEvent,
  ConversationEvent,
  Contact360,
  Contact360Summary,
  Contact360Engagement,
  Contact360MessageSummary,
  Contact360CampaignSummary,
  ProjectEngagementMatrixItem,
  AnalyticsOverview,
  ContactListQuery,
  ContactListItem,
  ConversationListQuery,
  ConversationListItem,
  MessagePaginationQuery,
  PaginatedMessagesResult,
  AuditLog,
  DuplicateContactCandidate
} from "./types.js";
import { normalizePhoneNumber, maskPhoneNumber } from "../utils/phone.js";

export interface AnalyticsRepository {
  // Contacts
  findContactById(id: string): Promise<Contact | null>;
  findContactByWaId(waId: string): Promise<Contact | null>;
  findContactByPhone(phone: string): Promise<Contact | null>;
  createContact(data: Partial<Contact> & { wa_id: string; phone: string }): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null>;
  listContacts(query?: ContactListQuery): Promise<{ contacts: ContactListItem[]; total: number }>;
  detectDuplicateContacts(): Promise<DuplicateContactCandidate[]>;

  // Conversations
  findConversationById(id: string): Promise<Conversation | null>;
  findOpenConversationByContactId(contactId: string): Promise<Conversation | null>;
  listConversationsByContactId(contactId: string): Promise<Conversation[]>;
  createConversation(data: Partial<Conversation> & { contact_id: string }): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null>;
  closeConversation(id: string): Promise<Conversation | null>;
  acknowledgeConversation(id: string): Promise<Conversation | null>;
  listConversations(query?: ConversationListQuery): Promise<{ conversations: ConversationListItem[]; total: number }>;

  // Messages
  findMessageById(id: string): Promise<Message | null>;
  findMessageByWaMessageId(waMessageId: string): Promise<Message | null>;
  createMessage(
    data: Partial<Message> & {
      contact_id: string;
      conversation_id: string;
      direction: "inbound" | "outbound";
      message_type: string;
    }
  ): Promise<Message>;
  listMessagesByConversation(conversationId: string): Promise<Message[]>;
  listMessagesByContact(contactId: string): Promise<Message[]>;
  getConversationMessagesPaginated(
    conversationId: string,
    pagination?: MessagePaginationQuery
  ): Promise<PaginatedMessagesResult>;

  // Message status events
  createStatusEvent(
    data: Partial<MessageStatusEvent> & {
      message_id: string;
      status: string;
      event_timestamp: Date;
    }
  ): Promise<MessageStatusEvent>;
  listStatusEventsByMessageId(messageId: string): Promise<MessageStatusEvent[]>;
  listStatusEventsByMessageIds(messageIds: string[]): Promise<MessageStatusEvent[]>;
  getLatestStatusForMessage(messageId: string): Promise<string | null>;

  // Conversation events
  createConversationEvent(
    data: Partial<ConversationEvent> & {
      conversation_id: string;
      contact_id: string;
      event_type: string;
    }
  ): Promise<ConversationEvent>;
  listConversationEventsByConversation(conversationId: string): Promise<ConversationEvent[]>;
  listConversationEventsByContact(contactId: string): Promise<ConversationEvent[]>;

  // Audit logs
  recordAuditLog(data: Omit<AuditLog, "id" | "created_at">): Promise<AuditLog>;
  listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]>;

  // Reporting views & services
  getOverview(): Promise<AnalyticsOverview>;
  getMessageMetrics(): Promise<{
    total: number;
    today: number;
    inbound: number;
    outbound: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    recent: Message[];
  }>;
  getReplyMetrics(): Promise<{
    repliesToday: number;
    totalReplies: number;
    unreadConversations: number;
    averageResponseTimeMs: number | null;
    recentReplies: Array<{ message: Message; contactName?: string | null; phone: string }>;
  }>;
  getProjectMetrics(): Promise<{
    totalSelections: number;
    brochuresRequested: number;
    plansRequested: number;
    byProject: Record<string, { selections: number; brochures: number; plans: number }>;
    bhkBreakdown: Record<string, number>;
  }>;
  getContact360(contactId: string): Promise<Contact360 | null>;
}

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private contacts = new Map<string, Contact>();
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, Message>();
  private statusEvents = new Map<string, MessageStatusEvent>();
  private conversationEvents = new Map<string, ConversationEvent>();
  private auditLogs: AuditLog[] = [];

  // Contacts
  async findContactById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) ?? null;
  }

  async findContactByWaId(waId: string): Promise<Contact | null> {
    for (const contact of this.contacts.values()) {
      if (contact.wa_id === waId) {
        return contact;
      }
    }
    return null;
  }

  async findContactByPhone(phone: string): Promise<Contact | null> {
    const normalized = normalizePhoneNumber(phone);
    for (const contact of this.contacts.values()) {
      if (normalizePhoneNumber(contact.phone) === normalized || contact.phone === phone) {
        return contact;
      }
    }
    return null;
  }

  async createContact(data: Partial<Contact> & { wa_id: string; phone: string }): Promise<Contact> {
    const now = new Date();
    const id = data.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const contact: Contact = {
      id,
      wa_id: data.wa_id,
      phone: data.phone,
      name: data.name ?? null,
      email: data.email ?? null,
      project_id: data.project_id ?? null,
      lead_source: data.lead_source ?? null,
      source_detail: data.source_detail ?? null,
      consent_status: data.consent_status ?? null,
      opt_in_source: data.opt_in_source ?? null,
      opt_in_at: data.opt_in_at ?? null,
      opted_out: data.opted_out ?? false,
      opt_out_at: data.opt_out_at ?? null,
      first_seen_at: data.first_seen_at ?? now,
      last_seen_at: data.last_seen_at ?? now,
      last_activity_at: data.last_activity_at ?? now,
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    const existing = this.contacts.get(id);
    if (!existing) return null;
    const updated: Contact = {
      ...existing,
      ...updates,
      updated_at: new Date()
    };
    this.contacts.set(id, updated);
    return updated;
  }

  async detectDuplicateContacts(): Promise<DuplicateContactCandidate[]> {
    const candidates: DuplicateContactCandidate[] = [];
    const contactList = Array.from(this.contacts.values());

    for (let i = 0; i < contactList.length; i++) {
      for (let j = i + 1; j < contactList.length; j++) {
        const a = contactList[i];
        const b = contactList[j];

        if (a.wa_id === b.wa_id) {
          candidates.push({ contactA: a, contactB: b, matchType: "wa_id", matchValue: a.wa_id });
        } else if (normalizePhoneNumber(a.phone) === normalizePhoneNumber(b.phone)) {
          candidates.push({ contactA: a, contactB: b, matchType: "phone", matchValue: a.phone });
        } else if (a.email && b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) {
          candidates.push({ contactA: a, contactB: b, matchType: "email", matchValue: a.email });
        }
      }
    }

    return candidates;
  }

  async listContacts(query: ContactListQuery = {}): Promise<{ contacts: ContactListItem[]; total: number }> {
    const result: ContactListItem[] = [];

    for (const contact of this.contacts.values()) {
      // Find open conversation
      let openConv: Conversation | null = null;
      let latestConv: Conversation | null = null;
      for (const conv of this.conversations.values()) {
        if (conv.contact_id === contact.id) {
          if (!latestConv || conv.opened_at > latestConv.opened_at) {
            latestConv = conv;
          }
          if (conv.status === "OPEN") {
            if (!openConv || conv.opened_at > openConv.opened_at) {
              openConv = conv;
            }
          }
        }
      }

      const activeConv = openConv || latestConv;
      const contactMsgs = await this.listMessagesByContact(contact.id);
      const contactEvents = await this.listConversationEventsByContact(contact.id);

      // Latest message
      const latestMsg = contactMsgs.length > 0 ? contactMsgs[contactMsgs.length - 1] : null;

      // Derived activity
      let lastActivityAt: Date | null = contact.last_activity_at || contact.updated_at;
      if (latestMsg && (!lastActivityAt || latestMsg.created_at > lastActivityAt)) {
        lastActivityAt = latestMsg.created_at;
      }
      if (contactEvents.length > 0) {
        const lastEv = contactEvents[contactEvents.length - 1];
        if (!lastActivityAt || lastEv.created_at > lastActivityAt) {
          lastActivityAt = lastEv.created_at;
        }
      }

      // Check reply & event flags
      const hasReplied = contactMsgs.some((m) => m.direction === "inbound");
      const brochureRequested = contactEvents.some((e) => e.event_type === "BROCHURE_REQUESTED");
      const planRequested = contactEvents.some((e) => e.event_type === "PLANS_REQUESTED");
      const siteVisitRequested = contactEvents.some((e) => e.event_type === "SITE_VISIT_REQUESTED");

      const unreadCount = activeConv?.unread_count ?? (
        activeConv?.last_inbound_at && (!activeConv.last_outbound_at || activeConv.last_inbound_at > activeConv.last_outbound_at) ? 1 : 0
      );
      const unread = unreadCount > 0;

      // Apply Filters
      if (query.project) {
        const targetProj = query.project.toLowerCase();
        const contactProj = (contact.project_id || "").toLowerCase();
        const convProj = (activeConv?.project_id || "").toLowerCase();
        if (contactProj !== targetProj && convProj !== targetProj) continue;
      }

      if (query.leadSource && (contact.lead_source || "").toLowerCase() !== query.leadSource.toLowerCase()) {
        continue;
      }

      if (query.consentStatus && (contact.consent_status || "").toLowerCase() !== query.consentStatus.toLowerCase()) {
        continue;
      }

      if (typeof query.optedOut === "boolean" && contact.opted_out !== query.optedOut) {
        continue;
      }

      if (query.conversationStatus) {
        const status = activeConv?.status || "NONE";
        if (status.toLowerCase() !== query.conversationStatus.toLowerCase()) continue;
      }

      if (query.currentState) {
        const state = activeConv?.state || "";
        if (state.toLowerCase() !== query.currentState.toLowerCase()) continue;
      }

      if (typeof query.unread === "boolean" && unread !== query.unread) {
        continue;
      }

      if (typeof query.replied === "boolean" && hasReplied !== query.replied) {
        continue;
      }

      if (typeof query.brochureRequested === "boolean" && brochureRequested !== query.brochureRequested) {
        continue;
      }

      if (typeof query.planRequested === "boolean" && planRequested !== query.planRequested) {
        continue;
      }

      if (typeof query.siteVisitRequested === "boolean" && siteVisitRequested !== query.siteVisitRequested) {
        continue;
      }

      // Date Range Filter
      if (query.lastActivityRange && lastActivityAt) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (query.lastActivityRange === "today") {
          if (lastActivityAt < todayStart) continue;
        } else if (query.lastActivityRange === "yesterday") {
          const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
          if (lastActivityAt < yesterdayStart || lastActivityAt >= todayStart) continue;
        } else if (query.lastActivityRange === "7d") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (lastActivityAt < sevenDaysAgo) continue;
        } else if (query.lastActivityRange === "30d") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (lastActivityAt < thirtyDaysAgo) continue;
        } else if (query.lastActivityRange === "custom") {
          if (query.startDate && lastActivityAt < query.startDate) continue;
          if (query.endDate && lastActivityAt > query.endDate) continue;
        }
      }

      // Search matching (name, phone, wa_id, email, project, lead_source)
      if (query.search && query.search.trim()) {
        const term = query.search.trim().toLowerCase();
        const termDigits = term.replace(/\D/g, "");
        const nameMatch = (contact.name || "").toLowerCase().includes(term);
        const emailMatch = (contact.email || "").toLowerCase().includes(term);
        const waMatch = contact.wa_id.toLowerCase().includes(term);
        const projectMatch = (contact.project_id || "").toLowerCase().includes(term);
        const sourceMatch = (contact.lead_source || "").toLowerCase().includes(term);
        const phoneMatch = contact.phone.includes(term) || (termDigits.length >= 3 && contact.phone.replace(/\D/g, "").includes(termDigits));

        if (!nameMatch && !emailMatch && !waMatch && !projectMatch && !sourceMatch && !phoneMatch) {
          continue;
        }
      }

      result.push({
        id: contact.id,
        wa_id: contact.wa_id,
        phone: contact.phone,
        phoneMasked: maskPhoneNumber(contact.phone),
        name: contact.name,
        email: contact.email,
        project: contact.project_id || activeConv?.project_id || null,
        leadSource: contact.lead_source,
        lastActivityAt,
        lastMessageDirection: latestMsg?.direction || null,
        conversationStatus: activeConv?.status || null,
        currentState: activeConv?.state || null,
        unread,
        unreadCount,
        assignedAgentId: activeConv?.assigned_agent_id || null,
        totalMessages: contactMsgs.length,
        hasReplied,
        brochureRequested,
        planRequested,
        siteVisitRequested
      });
    }

    // Sorting
    const sortBy = query.sortBy || "latest_activity";
    const sortOrder = query.sortOrder || "desc";
    const orderMult = sortOrder === "asc" ? 1 : -1;

    result.sort((a, b) => {
      if (sortBy === "latest_activity" || sortBy === "oldest_activity") {
        const aTime = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
        const bTime = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
        return (aTime - bTime) * (sortBy === "oldest_activity" ? 1 : -1);
      }
      if (sortBy === "newest" || sortBy === "oldest") {
        const aContact = this.contacts.get(a.id);
        const bContact = this.contacts.get(b.id);
        const aTime = aContact ? aContact.created_at.getTime() : 0;
        const bTime = bContact ? bContact.created_at.getTime() : 0;
        return (aTime - bTime) * (sortBy === "oldest" ? 1 : -1);
      }
      if (sortBy === "most_messages") {
        return (a.totalMessages - b.totalMessages) * orderMult;
      }
      if (sortBy === "most_engagement") {
        const aEng = (a.hasReplied ? 1 : 0) + (a.brochureRequested ? 1 : 0) + (a.planRequested ? 1 : 0) + (a.siteVisitRequested ? 1 : 0);
        const bEng = (b.hasReplied ? 1 : 0) + (b.brochureRequested ? 1 : 0) + (b.planRequested ? 1 : 0) + (b.siteVisitRequested ? 1 : 0);
        return (aEng - bEng) * orderMult;
      }
      return 0;
    });

    const total = result.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paged = result.slice(offset, offset + limit);

    return { contacts: paged, total };
  }

  // Conversations
  async findConversationById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }

  async findOpenConversationByContactId(contactId: string): Promise<Conversation | null> {
    const convs: Conversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.contact_id === contactId && conv.status === "OPEN") {
        convs.push(conv);
      }
    }
    convs.sort((a, b) => b.opened_at.getTime() - a.opened_at.getTime());
    return convs[0] ?? null;
  }

  async listConversationsByContactId(contactId: string): Promise<Conversation[]> {
    const convs: Conversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.contact_id === contactId) {
        convs.push(conv);
      }
    }
    return convs.sort((a, b) => b.opened_at.getTime() - a.opened_at.getTime());
  }

  async createConversation(data: Partial<Conversation> & { contact_id: string }): Promise<Conversation> {
    const now = new Date();
    const id = data.id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const conversation: Conversation = {
      id,
      contact_id: data.contact_id,
      status: data.status || "OPEN",
      state: data.state ?? null,
      assigned_agent_id: data.assigned_agent_id ?? null,
      campaign_id: data.campaign_id ?? null,
      project_id: data.project_id ?? null,
      opened_at: data.opened_at ?? now,
      last_message_at: data.last_message_at ?? null,
      last_inbound_at: data.last_inbound_at ?? null,
      last_outbound_at: data.last_outbound_at ?? null,
      first_response_at: data.first_response_at ?? null,
      last_customer_message_id: data.last_customer_message_id ?? null,
      last_customer_message_at: data.last_customer_message_at ?? null,
      last_internal_read_at: data.last_internal_read_at ?? null,
      unread_count: data.unread_count ?? 0,
      closed_at: data.closed_at ?? null,
      created_at: data.created_at ?? now,
      updated_at: data.updated_at ?? now
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const existing = this.conversations.get(id);
    if (!existing) return null;
    const updated: Conversation = {
      ...existing,
      ...updates,
      updated_at: new Date()
    };
    this.conversations.set(id, updated);
    return updated;
  }

  async closeConversation(id: string): Promise<Conversation | null> {
    const existing = this.conversations.get(id);
    if (!existing) return null;
    const updated: Conversation = {
      ...existing,
      status: "CLOSED",
      closed_at: new Date(),
      updated_at: new Date()
    };
    this.conversations.set(id, updated);
    return updated;
  }

  async acknowledgeConversation(id: string): Promise<Conversation | null> {
    const existing = this.conversations.get(id);
    if (!existing) return null;
    const updated: Conversation = {
      ...existing,
      unread_count: 0,
      last_internal_read_at: new Date(),
      updated_at: new Date()
    };
    this.conversations.set(id, updated);
    return updated;
  }

  async listConversations(query: ConversationListQuery = {}): Promise<{ conversations: ConversationListItem[]; total: number }> {
    const result: ConversationListItem[] = [];

    for (const conv of this.conversations.values()) {
      const contact = this.contacts.get(conv.contact_id);
      const messages = await this.listMessagesByConversation(conv.id);
      const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      // Unread state
      const unreadCount = conv.unread_count ?? (
        conv.last_inbound_at && (!conv.last_outbound_at || conv.last_inbound_at > conv.last_outbound_at) ? 1 : 0
      );
      const unread = unreadCount > 0;

      // Needs Reply: latest meaningful message is customer inbound AND no later business response
      const needsReply = !!latestMsg && latestMsg.direction === "inbound" && conv.status === "OPEN";

      // Has customer replied?
      const replied = messages.some((m) => m.direction === "inbound");

      // Last activity
      const lastActivityAt = latestMsg ? latestMsg.created_at : conv.last_message_at || conv.opened_at;

      // Filters
      if (typeof query.unread === "boolean" && unread !== query.unread) continue;
      if (typeof query.needsReply === "boolean" && needsReply !== query.needsReply) continue;
      if (typeof query.replied === "boolean" && replied !== query.replied) continue;

      if (query.status && conv.status.toLowerCase() !== query.status.toLowerCase()) continue;
      if (query.project && (conv.project_id || "").toLowerCase() !== query.project.toLowerCase()) continue;
      if (query.campaign && (conv.campaign_id || "").toLowerCase() !== query.campaign.toLowerCase()) continue;
      if (query.currentState && (conv.state || "").toLowerCase() !== query.currentState.toLowerCase()) continue;

      // Search matching (contact name, phone, wa_id, message text, project, campaign)
      if (query.search && query.search.trim()) {
        const term = query.search.trim().toLowerCase();
        const contactName = (contact?.name || "").toLowerCase();
        const contactPhone = (contact?.phone || "").toLowerCase();
        const waId = (contact?.wa_id || "").toLowerCase();
        const project = (conv.project_id || "").toLowerCase();
        const campaign = (conv.campaign_id || "").toLowerCase();
        const messageText = messages.some((m) => (m.body_text || "").toLowerCase().includes(term));

        if (
          !contactName.includes(term) &&
          !contactPhone.includes(term) &&
          !waId.includes(term) &&
          !project.includes(term) &&
          !campaign.includes(term) &&
          !messageText
        ) {
          continue;
        }
      }

      result.push({
        id: conv.id,
        contactId: conv.contact_id,
        contactName: contact?.name || null,
        phoneMasked: maskPhoneNumber(contact?.phone),
        latestMessageText: latestMsg ? (latestMsg.body_text || latestMsg.template_name || `[${latestMsg.message_type}]`) : null,
        latestMessageDirection: latestMsg ? latestMsg.direction : null,
        lastActivityAt,
        project: conv.project_id || contact?.project_id || null,
        currentState: conv.state || null,
        status: conv.status,
        unread,
        unreadCount,
        needsReply
      });
    }

    result.sort((a, b) => {
      const aTime = a.lastActivityAt ? a.lastActivityAt.getTime() : 0;
      const bTime = b.lastActivityAt ? b.lastActivityAt.getTime() : 0;
      return bTime - aTime;
    });

    const total = result.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paged = result.slice(offset, offset + limit);

    return { conversations: paged, total };
  }

  // Messages
  async findMessageById(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async findMessageByWaMessageId(waMessageId: string): Promise<Message | null> {
    if (!waMessageId) return null;
    for (const msg of this.messages.values()) {
      if (msg.wa_message_id === waMessageId) {
        return msg;
      }
    }
    return null;
  }

  async createMessage(
    data: Partial<Message> & {
      contact_id: string;
      conversation_id: string;
      direction: "inbound" | "outbound";
      message_type: string;
    }
  ): Promise<Message> {
    if (data.wa_message_id) {
      const existing = await this.findMessageByWaMessageId(data.wa_message_id);
      if (existing) {
        return existing;
      }
    }

    const now = new Date();
    const id = data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: Message = {
      id,
      contact_id: data.contact_id,
      conversation_id: data.conversation_id,
      campaign_id: data.campaign_id ?? null,
      wa_message_id: data.wa_message_id ?? null,
      direction: data.direction,
      message_type: data.message_type,
      body_text: data.body_text ?? null,
      template_name: data.template_name ?? null,
      template_language: data.template_language ?? null,
      button_id: data.button_id ?? null,
      list_row_id: data.list_row_id ?? null,
      media_id: data.media_id ?? null,
      reply_to_message_id: data.reply_to_message_id ?? null,
      agent_id: data.agent_id ?? null,
      created_at: data.created_at ?? now
    };
    this.messages.set(id, message);

    // Update conversation and contact last activity
    const conv = this.conversations.get(data.conversation_id);
    if (conv) {
      const convUpdates: Partial<Conversation> = {
        last_message_at: now
      };
      if (data.direction === "inbound") {
        convUpdates.last_inbound_at = now;
        convUpdates.last_customer_message_id = id;
        convUpdates.last_customer_message_at = now;
        convUpdates.unread_count = (conv.unread_count || 0) + 1;
      } else {
        convUpdates.last_outbound_at = now;
      }
      await this.updateConversation(conv.id, convUpdates);
    }

    const contact = this.contacts.get(data.contact_id);
    if (contact) {
      await this.updateContact(contact.id, {
        last_seen_at: now,
        last_activity_at: now
      });
    }

    return message;
  }

  async listMessagesByConversation(conversationId: string): Promise<Message[]> {
    const list: Message[] = [];
    for (const msg of this.messages.values()) {
      if (msg.conversation_id === conversationId) {
        list.push(msg);
      }
    }
    return list.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  async listMessagesByContact(contactId: string): Promise<Message[]> {
    const list: Message[] = [];
    for (const msg of this.messages.values()) {
      if (msg.contact_id === contactId) {
        list.push(msg);
      }
    }
    return list.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  async getConversationMessagesPaginated(
    conversationId: string,
    pagination: MessagePaginationQuery = {}
  ): Promise<PaginatedMessagesResult> {
    const all = await this.listMessagesByConversation(conversationId);
    const total = all.length;
    const limit = Math.min(100, Math.max(1, pagination.limit || 50));
    const offset = Math.max(0, pagination.offset || 0);

    const slice = all.slice(offset, offset + limit);
    const messageIds = slice.map((m) => m.id);
    const statuses = await this.listStatusEventsByMessageIds(messageIds);

    const latestStatusMap = new Map<string, string>();
    for (const st of statuses) {
      latestStatusMap.set(st.message_id, st.status);
    }

    const messagesWithStatus = slice.map((m) => ({
      ...m,
      latestStatus: latestStatusMap.get(m.id)
    }));

    return {
      messages: messagesWithStatus,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  // Status events
  async createStatusEvent(
    data: Partial<MessageStatusEvent> & {
      message_id: string;
      status: string;
      event_timestamp: Date;
    }
  ): Promise<MessageStatusEvent> {
    for (const ev of this.statusEvents.values()) {
      if (
        ev.message_id === data.message_id &&
        ev.status === data.status &&
        ev.event_timestamp.getTime() === data.event_timestamp.getTime()
      ) {
        return ev;
      }
    }

    const now = new Date();
    const id = data.id || `mse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const event: MessageStatusEvent = {
      id,
      message_id: data.message_id,
      status: data.status,
      recipient_id: data.recipient_id ?? null,
      event_timestamp: data.event_timestamp,
      error_code: data.error_code ?? null,
      error_message: data.error_message ?? null,
      received_at: data.received_at ?? now
    };
    this.statusEvents.set(id, event);
    return event;
  }

  async listStatusEventsByMessageId(messageId: string): Promise<MessageStatusEvent[]> {
    const list: MessageStatusEvent[] = [];
    for (const ev of this.statusEvents.values()) {
      if (ev.message_id === messageId) {
        list.push(ev);
      }
    }
    return list.sort((a, b) => {
      const diff = a.event_timestamp.getTime() - b.event_timestamp.getTime();
      if (diff !== 0) return diff;
      return a.received_at.getTime() - b.received_at.getTime();
    });
  }

  async listStatusEventsByMessageIds(messageIds: string[]): Promise<MessageStatusEvent[]> {
    const idSet = new Set(messageIds);
    const list: MessageStatusEvent[] = [];
    for (const ev of this.statusEvents.values()) {
      if (idSet.has(ev.message_id)) {
        list.push(ev);
      }
    }
    return list.sort((a, b) => {
      const diff = a.event_timestamp.getTime() - b.event_timestamp.getTime();
      if (diff !== 0) return diff;
      return a.received_at.getTime() - b.received_at.getTime();
    });
  }

  async getLatestStatusForMessage(messageId: string): Promise<string | null> {
    const events = await this.listStatusEventsByMessageId(messageId);
    if (events.length === 0) return null;
    return events[events.length - 1].status;
  }

  // Conversation events
  async createConversationEvent(
    data: Partial<ConversationEvent> & {
      conversation_id: string;
      contact_id: string;
      event_type: string;
    }
  ): Promise<ConversationEvent> {
    const nowTime = Date.now();
    for (const ev of this.conversationEvents.values()) {
      if (
        ev.conversation_id === data.conversation_id &&
        ev.event_type === data.event_type &&
        ev.event_value === (data.event_value ?? null) &&
        Math.abs(nowTime - ev.created_at.getTime()) < 3000
      ) {
        return ev;
      }
    }

    const now = new Date();
    const id = data.id || `ce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const event: ConversationEvent = {
      id,
      conversation_id: data.conversation_id,
      contact_id: data.contact_id,
      campaign_id: data.campaign_id ?? null,
      agent_id: data.agent_id ?? null,
      event_type: data.event_type,
      event_value: data.event_value ?? null,
      project_id: data.project_id ?? null,
      metadata_json: data.metadata_json ?? null,
      created_at: data.created_at ?? now
    };
    this.conversationEvents.set(id, event);

    // Update contact last_activity_at
    const contact = this.contacts.get(data.contact_id);
    if (contact) {
      await this.updateContact(contact.id, { last_activity_at: now });
    }

    return event;
  }

  async listConversationEventsByConversation(conversationId: string): Promise<ConversationEvent[]> {
    const list: ConversationEvent[] = [];
    for (const ev of this.conversationEvents.values()) {
      if (ev.conversation_id === conversationId) {
        list.push(ev);
      }
    }
    return list.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  async listConversationEventsByContact(contactId: string): Promise<ConversationEvent[]> {
    const list: ConversationEvent[] = [];
    for (const ev of this.conversationEvents.values()) {
      if (ev.contact_id === contactId) {
        list.push(ev);
      }
    }
    return list.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  // Audit logs
  async recordAuditLog(data: Omit<AuditLog, "id" | "created_at">): Promise<AuditLog> {
    const log: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      user_id: data.user_id ?? null,
      metadata_json: data.metadata_json ?? null,
      created_at: new Date()
    };
    this.auditLogs.push(log);
    return log;
  }

  async listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    let logs = this.auditLogs;
    if (entityType) {
      logs = logs.filter((l) => l.entity_type === entityType);
    }
    if (entityId) {
      logs = logs.filter((l) => l.entity_id === entityId);
    }
    return [...logs].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // Analytics Overview
  async getOverview(): Promise<AnalyticsOverview> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let messagesToday = 0;
    let repliesToday = 0;

    for (const msg of this.messages.values()) {
      if (msg.created_at >= today) {
        messagesToday++;
        if (msg.direction === "inbound") {
          repliesToday++;
        }
      }
    }

    const latestStatusByMessage = new Map<string, string>();
    for (const ev of this.statusEvents.values()) {
      latestStatusByMessage.set(ev.message_id, ev.status.toLowerCase());
    }

    let messagesSent = 0;
    let messagesDelivered = 0;
    let messagesRead = 0;
    let messagesFailed = 0;

    for (const status of latestStatusByMessage.values()) {
      if (status === "sent") messagesSent++;
      else if (status === "delivered") messagesDelivered++;
      else if (status === "read") messagesRead++;
      else if (status === "failed") messagesFailed++;
    }

    let unreadConversations = 0;
    for (const conv of this.conversations.values()) {
      if (conv.status !== "CLOSED") {
        const unreadCount = conv.unread_count ?? (
          conv.last_inbound_at && (!conv.last_outbound_at || conv.last_inbound_at > conv.last_outbound_at) ? 1 : 0
        );
        if (unreadCount > 0) {
          unreadConversations++;
        }
      }
    }

    let brochuresRequested = 0;
    let plansRequested = 0;
    let projectSelections = 0;
    let bhkSelections = 0;

    for (const ev of this.conversationEvents.values()) {
      if (ev.event_type === "BROCHURE_REQUESTED") brochuresRequested++;
      else if (ev.event_type === "PLANS_REQUESTED") plansRequested++;
      else if (ev.event_type === "PROJECT_SELECTED") projectSelections++;
      else if (ev.event_type === "BHK_SELECTED") bhkSelections++;
    }

    return {
      messagesToday,
      messagesSent,
      messagesDelivered,
      messagesRead,
      messagesFailed,
      repliesToday,
      unreadConversations,
      brochuresRequested,
      plansRequested,
      projectSelections,
      bhkSelections
    };
  }

  async getMessageMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = this.messages.size;
    let todayCount = 0;
    let inbound = 0;
    let outbound = 0;

    for (const msg of this.messages.values()) {
      if (msg.created_at >= today) todayCount++;
      if (msg.direction === "inbound") inbound++;
      if (msg.direction === "outbound") outbound++;
    }

    const latestStatusByMessage = new Map<string, string>();
    for (const ev of this.statusEvents.values()) {
      latestStatusByMessage.set(ev.message_id, ev.status.toLowerCase());
    }

    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;
    for (const status of latestStatusByMessage.values()) {
      if (status === "sent") sent++;
      else if (status === "delivered") delivered++;
      else if (status === "read") read++;
      else if (status === "failed") failed++;
    }

    const recent = Array.from(this.messages.values())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 50);

    return {
      total,
      today: todayCount,
      inbound,
      outbound,
      sent,
      delivered,
      read,
      failed,
      recent
    };
  }

  async getReplyMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let repliesToday = 0;
    let totalReplies = 0;
    const responseTimes: number[] = [];

    for (const conv of this.conversations.values()) {
      if (conv.last_inbound_at && conv.first_response_at) {
        const diff = conv.first_response_at.getTime() - conv.last_inbound_at.getTime();
        if (diff >= 0) {
          responseTimes.push(diff);
        }
      }
    }

    const recentReplies: Array<{ message: Message; contactName?: string | null; phone: string }> = [];

    for (const msg of this.messages.values()) {
      if (msg.direction === "inbound") {
        totalReplies++;
        if (msg.created_at >= today) {
          repliesToday++;
        }
        const contact = this.contacts.get(msg.contact_id);
        recentReplies.push({
          message: msg,
          contactName: contact?.name,
          phone: contact?.phone ?? ""
        });
      }
    }

    let unreadConversations = 0;
    for (const conv of this.conversations.values()) {
      if (conv.status !== "CLOSED") {
        const unreadCount = conv.unread_count ?? (
          conv.last_inbound_at && (!conv.last_outbound_at || conv.last_inbound_at > conv.last_outbound_at) ? 1 : 0
        );
        if (unreadCount > 0) {
          unreadConversations++;
        }
      }
    }

    const averageResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null;

    recentReplies.sort((a, b) => b.message.created_at.getTime() - a.message.created_at.getTime());

    return {
      repliesToday,
      totalReplies,
      unreadConversations,
      averageResponseTimeMs,
      recentReplies: recentReplies.slice(0, 50)
    };
  }

  async getProjectMetrics() {
    let totalSelections = 0;
    let brochuresRequested = 0;
    let plansRequested = 0;
    const byProject: Record<string, { selections: number; brochures: number; plans: number }> = {};
    const bhkBreakdown: Record<string, number> = {};

    for (const ev of this.conversationEvents.values()) {
      const pid = ev.project_id || (ev.event_value && ev.event_value.toLowerCase()) || "general";
      if (!byProject[pid]) {
        byProject[pid] = { selections: 0, brochures: 0, plans: 0 };
      }

      if (ev.event_type === "PROJECT_SELECTED") {
        totalSelections++;
        byProject[pid].selections++;
      } else if (ev.event_type === "BROCHURE_REQUESTED") {
        brochuresRequested++;
        byProject[pid].brochures++;
      } else if (ev.event_type === "PLANS_REQUESTED") {
        plansRequested++;
        byProject[pid].plans++;
      } else if (ev.event_type === "BHK_SELECTED") {
        const bhk = ev.event_value || "unknown";
        bhkBreakdown[bhk] = (bhkBreakdown[bhk] || 0) + 1;
      }
    }

    return {
      totalSelections,
      brochuresRequested,
      plansRequested,
      byProject,
      bhkBreakdown
    };
  }

  async getContact360(contactId: string): Promise<Contact360 | null> {
    const contact = this.contacts.get(contactId);
    if (!contact) return null;

    const conversations = await this.listConversationsByContactId(contactId);
    const conversation = await this.findOpenConversationByContactId(contactId) || conversations[0] || null;
    const messages = await this.listMessagesByContact(contactId);
    const messageIds = messages.map((m) => m.id);
    const statuses = await this.listStatusEventsByMessageIds(messageIds);

    const latestStatusMap = new Map<string, string>();
    for (const s of statuses) {
      latestStatusMap.set(s.message_id, s.status);
    }

    const messagesWithStatus = messages.map((m) => ({
      ...m,
      latestStatus: latestStatusMap.get(m.id)
    }));

    const projectEvents = await this.listConversationEventsByContact(contactId);

    // Latest activity
    let latestActivity: Date | null = contact.last_activity_at || contact.updated_at;
    if (conversation && conversation.last_message_at) {
      if (!latestActivity || conversation.last_message_at > latestActivity) {
        latestActivity = conversation.last_message_at;
      }
    }
    if (messages.length > 0) {
      const lastMsgDate = messages[messages.length - 1].created_at;
      if (!latestActivity || lastMsgDate > latestActivity) {
        latestActivity = lastMsgDate;
      }
    }
    if (projectEvents.length > 0) {
      const lastEvDate = projectEvents[projectEvents.length - 1].created_at;
      if (!latestActivity || lastEvDate > latestActivity) {
        latestActivity = lastEvDate;
      }
    }

    // Response times calculation across inbound-outbound pairs
    const responseTimesMs: number[] = [];
    let firstResponseTimeMs: number | null = null;
    let formattedDuration: string | null = null;
    const lastInboundAt = conversation?.last_inbound_at ?? null;
    const firstResponseAt = conversation?.first_response_at ?? null;

    if (conversation && conversation.first_response_at && conversation.opened_at) {
      const startRef = conversation.last_inbound_at ?? conversation.opened_at;
      firstResponseTimeMs = Math.max(0, conversation.first_response_at.getTime() - startRef.getTime());
      const seconds = Math.round(firstResponseTimeMs / 1000);
      formattedDuration = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      responseTimesMs.push(firstResponseTimeMs);
    }

    // Compute stats if response times exist
    let averageResponseTimeSeconds: number | null = null;
    let averageResponseTimeFormatted: string | null = null;
    let medianResponseTimeSeconds: number | null = null;
    let medianResponseTimeFormatted: string | null = null;
    let fastestResponseTimeSeconds: number | null = null;
    let slowestResponseTimeSeconds: number | null = null;

    if (responseTimesMs.length > 0) {
      const sorted = [...responseTimesMs].sort((a, b) => a - b);
      const avgMs = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      averageResponseTimeSeconds = Math.round(avgMs / 1000);
      averageResponseTimeFormatted = averageResponseTimeSeconds < 60
        ? `${averageResponseTimeSeconds}s`
        : `${Math.floor(averageResponseTimeSeconds / 60)}m ${averageResponseTimeSeconds % 60}s`;

      const mid = Math.floor(sorted.length / 2);
      const medianMs = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      medianResponseTimeSeconds = Math.round(medianMs / 1000);
      medianResponseTimeFormatted = medianResponseTimeSeconds < 60
        ? `${medianResponseTimeSeconds}s`
        : `${Math.floor(medianResponseTimeSeconds / 60)}m ${medianResponseTimeSeconds % 60}s`;

      fastestResponseTimeSeconds = Math.round(sorted[0] / 1000);
      slowestResponseTimeSeconds = Math.round(sorted[sorted.length - 1] / 1000);
    }

    // Engagement counters & Project Matrix
    let projectsViewed = 0;
    let projectsSelected = 0;
    let brochuresRequested = 0;
    let brochuresSent = 0;
    let plansRequested = 0;
    let plansSent = 0;
    let bhkSelected = 0;
    let sqftSelected = 0;
    let chatRequests = 0;
    let callRequests = 0;
    let siteVisitRequests = 0;

    const knownProjects = ["spring-hill", "applewood", "mahal", "rajmahal", "elements", "villas"];
    const projectMatrix: Record<string, ProjectEngagementMatrixItem> = {};
    for (const p of knownProjects) {
      const title = p.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      projectMatrix[p] = {
        name: title,
        viewed: false,
        selected: false,
        brochureRequested: false,
        brochureSent: false,
        plansRequested: false,
        plansSent: false,
        selectedSqft: null,
        selectedBhk: null
      };
    }

    const viewedProjectsSet = new Set<string>();

    for (const ev of projectEvents) {
      const rawPid = ev.project_id || (ev.event_value && ev.event_value.toLowerCase()) || "";
      const pid = knownProjects.find((kp) => rawPid.includes(kp)) || rawPid;

      if (ev.event_type === "VIEW_PROJECTS_CLICKED" || ev.event_type === "PROJECT_SELECTED") {
        if (pid && projectMatrix[pid]) projectMatrix[pid].viewed = true;
        if (pid) viewedProjectsSet.add(pid);
      }

      if (ev.event_type === "PROJECT_SELECTED") {
        projectsSelected++;
        if (pid && projectMatrix[pid]) {
          projectMatrix[pid].viewed = true;
          projectMatrix[pid].selected = true;
        }
      } else if (ev.event_type === "BROCHURE_REQUESTED") {
        brochuresRequested++;
        if (pid && projectMatrix[pid]) projectMatrix[pid].brochureRequested = true;
      } else if (ev.event_type === "BROCHURE_SENT") {
        brochuresSent++;
        if (pid && projectMatrix[pid]) projectMatrix[pid].brochureSent = true;
      } else if (ev.event_type === "PLANS_REQUESTED") {
        plansRequested++;
        if (pid && projectMatrix[pid]) projectMatrix[pid].plansRequested = true;
      } else if (ev.event_type === "PLAN_SENT") {
        plansSent++;
        if (pid && projectMatrix[pid]) projectMatrix[pid].plansSent = true;
      } else if (ev.event_type === "SQFT_SELECTED") {
        sqftSelected++;
        if (pid && projectMatrix[pid]) projectMatrix[pid].selectedSqft = ev.event_value;
      } else if (ev.event_type === "BHK_SELECTED") {
        bhkSelected++;
        if (pid && projectMatrix[pid]) projectMatrix[pid].selectedBhk = ev.event_value;
      } else if (ev.event_type === "CHAT_REQUESTED") {
        chatRequests++;
      } else if (ev.event_type === "CALL_REQUESTED") {
        callRequests++;
      } else if (ev.event_type === "SITE_VISIT_REQUESTED") {
        siteVisitRequests++;
      }
    }
    projectsViewed = viewedProjectsSet.size || (projectsSelected > 0 ? projectsSelected : 0);

    // Messages summary
    let inboundCount = 0;
    let outboundCount = 0;
    let sentCount = 0;
    let deliveredCount = 0;
    let readCount = 0;
    let failedCount = 0;

    let lastCustomerMessage: string | null = null;
    let lastCustomerMessageAt: Date | null = null;
    let lastBusinessMessage: string | null = null;
    let lastBusinessMessageAt: Date | null = null;

    for (const msg of messages) {
      if (msg.direction === "inbound") {
        inboundCount++;
        lastCustomerMessage = msg.body_text || msg.button_id || msg.list_row_id || `[${msg.message_type}]`;
        lastCustomerMessageAt = msg.created_at;
      } else {
        outboundCount++;
        lastBusinessMessage = msg.body_text || msg.template_name || `[${msg.message_type}]`;
        lastBusinessMessageAt = msg.created_at;
      }

      const st = latestStatusMap.get(msg.id)?.toLowerCase();
      if (st === "sent") sentCount++;
      else if (st === "delivered") deliveredCount++;
      else if (st === "read") readCount++;
      else if (st === "failed") failedCount++;
    }

    // Campaign summary
    const campaignsReceived: string[] = [];
    let lastCampaign: string | null = null;
    let lastCampaignStatus: string | null = null;
    let lastTemplate: string | null = null;

    for (const msg of messages) {
      if (msg.campaign_id) {
        if (!campaignsReceived.includes(msg.campaign_id)) {
          campaignsReceived.push(msg.campaign_id);
        }
        lastCampaign = msg.campaign_id;
        lastCampaignStatus = latestStatusMap.get(msg.id) || null;
      }
      if (msg.template_name) {
        lastTemplate = msg.template_name;
      }
    }

    // Deterministic Next Logical Action
    let nextLogicalAction = "No action currently recorded.";
    if (contact.opted_out) {
      nextLogicalAction = "Customer opted out — do not contact";
    } else if (siteVisitRequests > 0) {
      nextLogicalAction = "Confirm site visit appointment schedule with sales team";
    } else if (callRequests > 0) {
      nextLogicalAction = "Sales representative callback requested";
    } else if (chatRequests > 0) {
      nextLogicalAction = "Live human sales chat handoff pending";
    } else if (plansSent > 0) {
      nextLogicalAction = "Follow up on shared floor plan and gauge customer interest";
    } else if (plansRequested > 0) {
      nextLogicalAction = "Send floor plans for selected configuration";
    } else if (brochuresSent > 0) {
      nextLogicalAction = "Inquire about interest in specific floor plans or site visit";
    } else if (brochuresRequested > 0) {
      nextLogicalAction = "Share project brochure and highlight key amenities";
    } else if (projectsSelected > 0) {
      nextLogicalAction = "Offer project brochure and floor plans";
    } else if (conversation?.status === "CLOSED") {
      nextLogicalAction = "Conversation closed — archive or review";
    }

    const unreadCount = conversation?.unread_count ?? (
      conversation?.last_inbound_at && (!conversation.last_outbound_at || conversation.last_inbound_at > conversation.last_outbound_at) ? 1 : 0
    );

    const summary: Contact360Summary = {
      status: conversation?.status || "ACTIVE",
      currentState: conversation?.state || "INIT",
      lastActivityAt: latestActivity,
      unreadCount,
      firstResponseTimeSeconds: firstResponseTimeMs !== null ? Math.round(firstResponseTimeMs / 1000) : null,
      firstResponseTimeFormatted: formattedDuration,
      averageResponseTimeSeconds,
      averageResponseTimeFormatted,
      medianResponseTimeSeconds,
      medianResponseTimeFormatted,
      fastestResponseTimeSeconds,
      slowestResponseTimeSeconds,
      lastCustomerMessage,
      lastCustomerMessageAt,
      lastBusinessMessage,
      lastBusinessMessageAt,
      nextLogicalAction
    };

    const engagement: Contact360Engagement = {
      projectsViewed,
      projectsSelected,
      brochuresRequested,
      brochuresSent,
      plansRequested,
      plansSent,
      bhkSelected,
      sqftSelected,
      chatRequests,
      callRequests,
      siteVisitRequests,
      projectMatrix
    };

    const messagesSummary: Contact360MessageSummary = {
      totalMessages: messages.length,
      inboundCount,
      outboundCount,
      sentCount,
      deliveredCount,
      readCount,
      failedCount
    };

    const campaignSummary: Contact360CampaignSummary = {
      campaignsReceived,
      lastCampaign,
      lastCampaignStatus,
      lastTemplate
    };

    return {
      contact: {
        ...contact,
        phoneMasked: maskPhoneNumber(contact.phone)
      },
      conversation,
      conversations,
      messages: messagesWithStatus,
      statuses,
      projectEvents,
      events: projectEvents,
      latestActivity,
      responseTime: {
        firstResponseTimeMs,
        formattedDuration,
        lastInboundAt,
        firstResponseAt
      },
      summary,
      engagement,
      messagesSummary,
      campaignSummary
    };
  }

  // Cleanup
  clear(): void {
    this.contacts.clear();
    this.conversations.clear();
    this.messages.clear();
    this.statusEvents.clear();
    this.conversationEvents.clear();
    this.auditLogs = [];
  }
}
