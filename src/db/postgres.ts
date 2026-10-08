import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Pool, QueryResult } from "pg";

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
import type { AnalyticsRepository } from "./repository.js";
import { normalizePhoneNumber, maskPhoneNumber } from "../utils/phone.js";

const { Pool: PgPool } = pg;

export async function createPostgresPool(connectionString: string): Promise<Pool> {
  const pool = new PgPool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  return pool;
}

export async function runPostgresMigrations(pool: Pool): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  let schemaPath = join(__dirname, "schema.sql");
  try {
    let schemaSql: string;
    try {
      schemaSql = await readFile(schemaPath, "utf-8");
    } catch {
      schemaPath = join(process.cwd(), "src/db/schema.sql");
      schemaSql = await readFile(schemaPath, "utf-8");
    }
    await pool.query(schemaSql);
    console.info("[POSTGRES] Database migrations applied successfully");
  } catch (error) {
    console.error("[POSTGRES] Migration schema execution failed:", error);
    throw error;
  }
}

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  // Contacts
  async findContactById(id: string): Promise<Contact | null> {
    const res: QueryResult<Contact> = await this.pool.query(
      "SELECT * FROM contacts WHERE id = $1 LIMIT 1",
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findContactByWaId(waId: string): Promise<Contact | null> {
    const res: QueryResult<Contact> = await this.pool.query(
      "SELECT * FROM contacts WHERE wa_id = $1 LIMIT 1",
      [waId]
    );
    return res.rows[0] ?? null;
  }

  async findContactByPhone(phone: string): Promise<Contact | null> {
    const normalized = normalizePhoneNumber(phone);
    const res: QueryResult<Contact> = await this.pool.query(
      "SELECT * FROM contacts WHERE phone = $1 OR phone = $2 LIMIT 1",
      [normalized, phone]
    );
    return res.rows[0] ?? null;
  }

  async createContact(data: Partial<Contact> & { wa_id: string; phone: string }): Promise<Contact> {
    const id = data.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res: QueryResult<Contact> = await this.pool.query(
      `INSERT INTO contacts (
        id, wa_id, phone, name, email, project_id, lead_source, source_detail,
        consent_status, opt_in_source, opt_in_at, opted_out, opt_out_at,
        first_seen_at, last_seen_at, last_activity_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW(), NOW(), NOW())
      RETURNING *`,
      [
        id,
        data.wa_id,
        data.phone,
        data.name ?? null,
        data.email ?? null,
        data.project_id ?? null,
        data.lead_source ?? null,
        data.source_detail ?? null,
        data.consent_status ?? null,
        data.opt_in_source ?? null,
        data.opt_in_at ?? null,
        data.opted_out ?? false,
        data.opt_out_at ?? null
      ]
    );
    return res.rows[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (key !== "id" && key !== "created_at") {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) {
      return this.findContactById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE contacts SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
    const res: QueryResult<Contact> = await this.pool.query(query, values);
    return res.rows[0] ?? null;
  }

  async detectDuplicateContacts(): Promise<DuplicateContactCandidate[]> {
    const query = `
      SELECT a.*, b.*
      FROM contacts a
      JOIN contacts b ON a.id < b.id
      WHERE a.wa_id = b.wa_id
         OR a.phone = b.phone
         OR (a.email IS NOT NULL AND b.email IS NOT NULL AND LOWER(a.email) = LOWER(b.email))
    `;
    const res = await this.pool.query(query);
    const candidates: DuplicateContactCandidate[] = [];
    for (const row of res.rows) {
      const contactA: Contact = {
        id: row.a_id || row.id,
        wa_id: row.a_wa_id || row.wa_id,
        phone: row.a_phone || row.phone,
        name: row.a_name || row.name,
        email: row.a_email || row.email,
        project_id: row.a_project_id || row.project_id,
        lead_source: row.a_lead_source || row.lead_source,
        consent_status: row.a_consent_status || row.consent_status,
        opt_in_source: row.a_opt_in_source || row.opt_in_source,
        opt_in_at: row.a_opt_in_at || row.opt_in_at,
        opted_out: row.a_opted_out || row.opted_out,
        opt_out_at: row.a_opt_out_at || row.opt_out_at,
        created_at: row.a_created_at || row.created_at,
        updated_at: row.a_updated_at || row.updated_at
      };
      const contactB = contactA; // placeholder mapping for row
      candidates.push({
        contactA,
        contactB,
        matchType: "phone",
        matchValue: contactA.phone
      });
    }
    return candidates;
  }

  async listContacts(query: ContactListQuery = {}): Promise<{ contacts: ContactListItem[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    if (query.project) {
      conditions.push(`(LOWER(c.project_id) = $${idx} OR LOWER(conv.project_id) = $${idx})`);
      values.push(query.project.toLowerCase());
      idx++;
    }

    if (query.leadSource) {
      conditions.push(`LOWER(c.lead_source) = $${idx}`);
      values.push(query.leadSource.toLowerCase());
      idx++;
    }

    if (query.consentStatus) {
      conditions.push(`LOWER(c.consent_status) = $${idx}`);
      values.push(query.consentStatus.toLowerCase());
      idx++;
    }

    if (typeof query.optedOut === "boolean") {
      conditions.push(`c.opted_out = $${idx}`);
      values.push(query.optedOut);
      idx++;
    }

    if (query.conversationStatus) {
      conditions.push(`LOWER(conv.status) = $${idx}`);
      values.push(query.conversationStatus.toLowerCase());
      idx++;
    }

    if (query.currentState) {
      conditions.push(`LOWER(conv.state) = $${idx}`);
      values.push(query.currentState.toLowerCase());
      idx++;
    }

    if (query.date) {
      conditions.push(`(
        (c.first_seen_at AT TIME ZONE 'Asia/Kolkata')::date = $${idx}::date OR
        c.first_seen_at::date = $${idx}::date OR
        (c.created_at AT TIME ZONE 'Asia/Kolkata')::date = $${idx}::date OR
        c.created_at::date = $${idx}::date
      )`);
      values.push(query.date.trim());
      idx++;
    }

    if (query.batch) {
      const batchNum = query.batch.trim();
      const batchDateMap: Record<string, string> = {
        "5": "2026-10-08",
        "4": "2026-10-06",
        "3": "2026-10-05",
        "2": "2026-10-04",
        "1": "2026-10-03"
      };
      const targetDate = batchDateMap[batchNum];
      if (targetDate) {
        conditions.push(`(
          (c.first_seen_at AT TIME ZONE 'Asia/Kolkata')::date = $${idx}::date OR
          c.first_seen_at::date = $${idx}::date OR
          c.source_detail LIKE $${idx + 1}
        )`);
        values.push(targetDate);
        values.push(`%${targetDate}%`);
        idx += 2;
      }
    }

    if (query.deliveryStatus) {
      conditions.push(`EXISTS (
        SELECT 1 FROM message_status_events mse
        JOIN messages m ON mse.message_id = m.id
        WHERE m.contact_id = c.id AND LOWER(mse.status) = $${idx}
      )`);
      values.push(query.deliveryStatus.toLowerCase());
      idx++;
    }

    if (typeof query.replied === "boolean") {
      if (query.replied) {
        conditions.push(`EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = c.id AND m.direction = 'inbound')`);
      } else {
        conditions.push(`NOT EXISTS (SELECT 1 FROM messages m WHERE m.contact_id = c.id AND m.direction = 'inbound')`);
      }
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(c.name) LIKE $${idx} OR
        LOWER(c.email) LIKE $${idx} OR
        c.wa_id LIKE $${idx} OR
        c.phone LIKE $${idx} OR
        LOWER(c.project_id) LIKE $${idx} OR
        LOWER(c.lead_source) LIKE $${idx}
      )`);
      values.push(term);
      idx++;
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as count
      FROM contacts c
      LEFT JOIN conversations conv ON conv.contact_id = c.id AND conv.status = 'OPEN'
      WHERE ${whereClause}
    `;
    const countRes = await this.pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const selectQuery = `
      SELECT 
        c.id, c.wa_id, c.phone, c.name, c.email, c.project_id, c.lead_source, c.source_detail,
        c.first_seen_at, c.last_activity_at, c.created_at,
        conv.status as conv_status, conv.state as conv_state, conv.unread_count, conv.assigned_agent_id,
        (SELECT COUNT(*) FROM messages m WHERE m.contact_id = c.id) as total_messages,
        (SELECT COUNT(*) FROM messages m WHERE m.contact_id = c.id AND m.direction = 'inbound') as inbound_count,
        (SELECT m.body_text FROM messages m WHERE m.contact_id = c.id AND m.direction = 'inbound' ORDER BY m.created_at DESC LIMIT 1) as last_reply_text,
        (SELECT m.created_at FROM messages m WHERE m.contact_id = c.id AND m.direction = 'inbound' ORDER BY m.created_at DESC LIMIT 1) as last_reply_at,
        (SELECT mse.status FROM message_status_events mse JOIN messages m ON mse.message_id = m.id WHERE m.contact_id = c.id ORDER BY mse.event_timestamp DESC LIMIT 1) as latest_delivery_status,
        (SELECT mse.event_timestamp FROM message_status_events mse JOIN messages m ON mse.message_id = m.id WHERE m.contact_id = c.id AND LOWER(mse.status) = 'read' ORDER BY mse.event_timestamp DESC LIMIT 1) as seen_at
      FROM contacts c
      LEFT JOIN conversations conv ON conv.contact_id = c.id AND conv.status = 'OPEN'
      WHERE ${whereClause}
      ORDER BY COALESCE(c.last_activity_at, c.created_at) DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(selectQuery, values);
    const items: ContactListItem[] = res.rows.map((row) => {
      const inboundCount = parseInt(row.inbound_count || "0", 10);
      const totalMessages = parseInt(row.total_messages || "0", 10);
      const hasReplied = inboundCount > 0;

      let batchName = "Batch 1";
      const firstSeenStr = row.first_seen_at ? new Date(row.first_seen_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : "");
      const sourceStr = row.source_detail || "";
      if (sourceStr.includes("2026-10-08") || firstSeenStr.startsWith("2026-10-08")) {
        batchName = "Batch 5";
      } else if (sourceStr.includes("2026-10-06") || firstSeenStr.startsWith("2026-10-06")) {
        batchName = "Batch 4";
      } else if (sourceStr.includes("2026-10-05") || firstSeenStr.startsWith("2026-10-05")) {
        batchName = "Batch 3";
      } else if (sourceStr.includes("2026-10-04") || firstSeenStr.startsWith("2026-10-04")) {
        batchName = "Batch 2";
      } else if (sourceStr.includes("2026-10-03") || firstSeenStr.startsWith("2026-10-03")) {
        batchName = "Batch 1";
      }

      return {
        id: row.id,
        wa_id: row.wa_id,
        phone: row.phone,
        phoneMasked: maskPhoneNumber(row.phone),
        name: row.name,
        email: row.email,
        project: row.project_id,
        leadSource: row.lead_source,
        batchName,
        latestDeliveryStatus: row.latest_delivery_status || "sent",
        seenAt: row.seen_at ? new Date(row.seen_at) : null,
        firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at) : (row.created_at ? new Date(row.created_at) : null),
        lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : null,
        lastMessageDirection: null,
        lastReplyAt: row.last_reply_at ? new Date(row.last_reply_at) : null,
        lastReplyText: row.last_reply_text || null,
        lastReplyType: row.last_reply_text ? "text" : null,
        currentJourneyStep: hasReplied ? "Step 2: Replied to Bot" : (totalMessages > 0 ? "Step 1: Broadcast Sent" : "Step 0: Lead Registered"),
        conversationStatus: row.conv_status || null,
        currentState: row.conv_state || null,
        unread: (row.unread_count || 0) > 0,
        unreadCount: row.unread_count || 0,
        assignedAgentId: row.assigned_agent_id || null,
        totalMessages,
        hasReplied,
        brochureRequested: false,
        planRequested: false,
        siteVisitRequested: false
      };
    });

    return { contacts: items, total };
  }

  // Conversations
  async findConversationById(id: string): Promise<Conversation | null> {
    const res: QueryResult<Conversation> = await this.pool.query(
      "SELECT * FROM conversations WHERE id = $1 LIMIT 1",
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findOpenConversationByContactId(contactId: string): Promise<Conversation | null> {
    const res: QueryResult<Conversation> = await this.pool.query(
      "SELECT * FROM conversations WHERE contact_id = $1 AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1",
      [contactId]
    );
    return res.rows[0] ?? null;
  }

  async listConversationsByContactId(contactId: string): Promise<Conversation[]> {
    const res: QueryResult<Conversation> = await this.pool.query(
      "SELECT * FROM conversations WHERE contact_id = $1 ORDER BY opened_at DESC",
      [contactId]
    );
    return res.rows;
  }

  async createConversation(data: Partial<Conversation> & { contact_id: string }): Promise<Conversation> {
    const id = data.id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res: QueryResult<Conversation> = await this.pool.query(
      `INSERT INTO conversations (
        id, contact_id, status, state, assigned_agent_id, campaign_id, project_id,
        opened_at, last_message_at, last_inbound_at, last_outbound_at, first_response_at,
        last_customer_message_id, last_customer_message_at, last_internal_read_at, unread_count,
        closed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *`,
      [
        id,
        data.contact_id,
        data.status || "OPEN",
        data.state ?? null,
        data.assigned_agent_id ?? null,
        data.campaign_id ?? null,
        data.project_id ?? null,
        data.last_message_at ?? null,
        data.last_inbound_at ?? null,
        data.last_outbound_at ?? null,
        data.first_response_at ?? null,
        data.last_customer_message_id ?? null,
        data.last_customer_message_at ?? null,
        data.last_internal_read_at ?? null,
        data.unread_count ?? 0,
        data.closed_at ?? null
      ]
    );
    return res.rows[0];
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (key !== "id" && key !== "created_at") {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) {
      return this.findConversationById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE conversations SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
    const res: QueryResult<Conversation> = await this.pool.query(query, values);
    return res.rows[0] ?? null;
  }

  async closeConversation(id: string): Promise<Conversation | null> {
    const res: QueryResult<Conversation> = await this.pool.query(
      "UPDATE conversations SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return res.rows[0] ?? null;
  }

  async acknowledgeConversation(id: string): Promise<Conversation | null> {
    const res: QueryResult<Conversation> = await this.pool.query(
      "UPDATE conversations SET unread_count = 0, last_internal_read_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return res.rows[0] ?? null;
  }

  async listConversations(query: ConversationListQuery = {}): Promise<{ conversations: ConversationListItem[]; total: number }> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    if (query.status) {
      conditions.push(`LOWER(conv.status) = $${idx}`);
      values.push(query.status.toLowerCase());
      idx++;
    }

    if (query.project) {
      conditions.push(`LOWER(conv.project_id) = $${idx}`);
      values.push(query.project.toLowerCase());
      idx++;
    }

    if (query.campaign) {
      conditions.push(`LOWER(conv.campaign_id) = $${idx}`);
      values.push(query.campaign.toLowerCase());
      idx++;
    }

    if (query.currentState) {
      conditions.push(`LOWER(conv.state) = $${idx}`);
      values.push(query.currentState.toLowerCase());
      idx++;
    }

    if (typeof query.unread === "boolean") {
      conditions.push(query.unread ? "conv.unread_count > 0" : "conv.unread_count = 0");
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(c.name) LIKE $${idx} OR
        c.phone LIKE $${idx} OR
        c.wa_id LIKE $${idx} OR
        LOWER(conv.project_id) LIKE $${idx} OR
        LOWER(conv.campaign_id) LIKE $${idx}
      )`);
      values.push(term);
      idx++;
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.pool.query(
      `SELECT COUNT(*) as count FROM conversations conv LEFT JOIN contacts c ON c.id = conv.contact_id WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const selectQuery = `
      SELECT 
        conv.id, conv.contact_id, conv.status, conv.state, conv.project_id, conv.unread_count,
        conv.last_message_at, conv.opened_at, conv.last_inbound_at, conv.last_outbound_at,
        c.name as contact_name, c.phone as contact_phone
      FROM conversations conv
      LEFT JOIN contacts c ON c.id = conv.contact_id
      WHERE ${whereClause}
      ORDER BY COALESCE(conv.last_message_at, conv.opened_at) DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const res = await this.pool.query(selectQuery, values);
    const items: ConversationListItem[] = res.rows.map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      contactName: row.contact_name,
      phone: row.contact_phone || "",
      phoneMasked: maskPhoneNumber(row.contact_phone),
      latestMessageText: null,
      latestMessageDirection: null,
      lastActivityAt: row.last_message_at ? new Date(row.last_message_at) : new Date(row.opened_at),
      project: row.project_id,
      currentState: row.state,
      status: row.status,
      unread: (row.unread_count || 0) > 0,
      unreadCount: row.unread_count || 0,
      needsReply: row.status === "OPEN" && !!row.last_inbound_at && (!row.last_outbound_at || new Date(row.last_inbound_at) > new Date(row.last_outbound_at))
    }));

    return { conversations: items, total };
  }

  // Messages
  async findMessageById(id: string): Promise<Message | null> {
    const res: QueryResult<Message> = await this.pool.query(
      "SELECT * FROM messages WHERE id = $1 LIMIT 1",
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findMessageByWaMessageId(waMessageId: string): Promise<Message | null> {
    if (!waMessageId) return null;
    const res: QueryResult<Message> = await this.pool.query(
      "SELECT * FROM messages WHERE wa_message_id = $1 LIMIT 1",
      [waMessageId]
    );
    return res.rows[0] ?? null;
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

    const id = data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res: QueryResult<Message> = await this.pool.query(
      `INSERT INTO messages (
        id, contact_id, conversation_id, campaign_id, wa_message_id,
        direction, message_type, body_text, template_name, template_language,
        button_id, list_row_id, media_id, reply_to_message_id, agent_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING *`,
      [
        id,
        data.contact_id,
        data.conversation_id,
        data.campaign_id ?? null,
        data.wa_message_id ?? null,
        data.direction,
        data.message_type,
        data.body_text ?? null,
        data.template_name ?? null,
        data.template_language ?? null,
        data.button_id ?? null,
        data.list_row_id ?? null,
        data.media_id ?? null,
        data.reply_to_message_id ?? null,
        data.agent_id ?? null
      ]
    );

    // Update conversation & contact activity
    const messageTime = data.created_at || new Date();
    if (data.direction === "inbound") {
      await this.pool.query(
        "UPDATE conversations SET last_message_at = $1, last_inbound_at = $1, last_customer_message_id = $2, last_customer_message_at = $1, unread_count = unread_count + 1 WHERE id = $3",
        [messageTime, id, data.conversation_id]
      );
    } else {
      await this.pool.query(
        "UPDATE conversations SET last_message_at = $1, last_outbound_at = $1 WHERE id = $2",
        [messageTime, data.conversation_id]
      );
    }
    await this.pool.query(
      "UPDATE contacts SET last_seen_at = $1, last_activity_at = $1 WHERE id = $2",
      [messageTime, data.contact_id]
    );

    return res.rows[0];
  }

  async listMessagesByConversation(conversationId: string): Promise<Message[]> {
    const res: QueryResult<Message> = await this.pool.query(
      "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId]
    );
    return res.rows;
  }

  async listMessagesByContact(contactId: string): Promise<Message[]> {
    const res: QueryResult<Message> = await this.pool.query(
      "SELECT * FROM messages WHERE contact_id = $1 ORDER BY created_at ASC",
      [contactId]
    );
    return res.rows;
  }

  async getConversationMessagesPaginated(
    conversationId: string,
    pagination: MessagePaginationQuery = {}
  ): Promise<PaginatedMessagesResult> {
    const countRes = await this.pool.query(
      "SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1",
      [conversationId]
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);
    const limit = Math.min(100, Math.max(1, pagination.limit || 50));
    const offset = Math.max(0, pagination.offset || 0);

    const res: QueryResult<Message> = await this.pool.query(
      "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3",
      [conversationId, limit, offset]
    );

    const messageIds = res.rows.map((m) => m.id);
    const statuses = await this.listStatusEventsByMessageIds(messageIds);

    const latestStatusMap = new Map<string, string>();
    for (const st of statuses) {
      latestStatusMap.set(st.message_id, st.status);
    }

    const messagesWithStatus = res.rows.map((m) => ({
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
    const id = data.id || `mse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res: QueryResult<MessageStatusEvent> = await this.pool.query(
      `INSERT INTO message_status_events (
        id, message_id, status, recipient_id, event_timestamp, error_code, error_message, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (message_id, status, event_timestamp) DO UPDATE SET received_at = NOW()
      RETURNING *`,
      [
        id,
        data.message_id,
        data.status,
        data.recipient_id ?? null,
        data.event_timestamp,
        data.error_code ?? null,
        data.error_message ?? null
      ]
    );
    return res.rows[0];
  }

  async listStatusEventsByMessageId(messageId: string): Promise<MessageStatusEvent[]> {
    const res: QueryResult<MessageStatusEvent> = await this.pool.query(
      "SELECT * FROM message_status_events WHERE message_id = $1 ORDER BY event_timestamp ASC",
      [messageId]
    );
    return res.rows;
  }

  async listStatusEventsByMessageIds(messageIds: string[]): Promise<MessageStatusEvent[]> {
    if (messageIds.length === 0) return [];
    const res: QueryResult<MessageStatusEvent> = await this.pool.query(
      "SELECT * FROM message_status_events WHERE message_id = ANY($1) ORDER BY event_timestamp ASC",
      [messageIds]
    );
    return res.rows;
  }

  async getLatestStatusForMessage(messageId: string): Promise<string | null> {
    const res = await this.pool.query(
      "SELECT status FROM message_status_events WHERE message_id = $1 ORDER BY event_timestamp DESC LIMIT 1",
      [messageId]
    );
    return res.rows[0]?.status ?? null;
  }

  // Conversation events
  async createConversationEvent(
    data: Partial<ConversationEvent> & {
      conversation_id: string;
      contact_id: string;
      event_type: string;
    }
  ): Promise<ConversationEvent> {
    const id = data.id || `ce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res: QueryResult<ConversationEvent> = await this.pool.query(
      `INSERT INTO conversation_events (
        id, conversation_id, contact_id, campaign_id, agent_id,
        event_type, event_value, project_id, metadata_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        id,
        data.conversation_id,
        data.contact_id,
        data.campaign_id ?? null,
        data.agent_id ?? null,
        data.event_type,
        data.event_value ?? null,
        data.project_id ?? null,
        data.metadata_json ? JSON.stringify(data.metadata_json) : null
      ]
    );

    await this.pool.query(
      "UPDATE contacts SET last_activity_at = NOW() WHERE id = $1",
      [data.contact_id]
    );

    return res.rows[0];
  }

  async listConversationEventsByConversation(conversationId: string): Promise<ConversationEvent[]> {
    const res: QueryResult<ConversationEvent> = await this.pool.query(
      "SELECT * FROM conversation_events WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId]
    );
    return res.rows;
  }

  async listConversationEventsByContact(contactId: string): Promise<ConversationEvent[]> {
    const res: QueryResult<ConversationEvent> = await this.pool.query(
      "SELECT * FROM conversation_events WHERE contact_id = $1 ORDER BY created_at ASC",
      [contactId]
    );
    return res.rows;
  }

  // Audit Logs
  async recordAuditLog(data: Omit<AuditLog, "id" | "created_at">): Promise<AuditLog> {
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const res = await this.pool.query(
      `INSERT INTO audit_logs (id, action, entity_type, entity_id, user_id, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [
        id,
        data.action,
        data.entity_type,
        data.entity_id,
        data.user_id ?? null,
        data.metadata_json ? JSON.stringify(data.metadata_json) : null
      ]
    );
    return res.rows[0];
  }

  async listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    if (entityType) {
      conditions.push(`entity_type = $${idx++}`);
      values.push(entityType);
    }
    if (entityId) {
      conditions.push(`entity_id = $${idx++}`);
      values.push(entityId);
    }

    const res = await this.pool.query(
      `SELECT * FROM audit_logs WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      values
    );
    return res.rows;
  }

  // Analytics Overview
  async getOverview(): Promise<AnalyticsOverview> {
    const msgStatsRes = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as messages_today,
        COUNT(*) FILTER (WHERE direction = 'inbound' AND created_at >= CURRENT_DATE) as replies_today
      FROM messages
    `);

    const statusStatsRes = await this.pool.query(`
      WITH latest_statuses AS (
        SELECT DISTINCT ON (message_id) message_id, LOWER(status) as status
        FROM message_status_events
        ORDER BY message_id, event_timestamp DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM latest_statuses
    `);

    const unreadRes = await this.pool.query(`
      SELECT COUNT(*) as unread
      FROM conversations
      WHERE status != 'CLOSED' AND (unread_count > 0 OR (last_inbound_at IS NOT NULL AND (last_outbound_at IS NULL OR last_inbound_at > last_outbound_at)))
    `);

    const eventsRes = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'BROCHURE_REQUESTED') as brochures,
        COUNT(*) FILTER (WHERE event_type = 'PLANS_REQUESTED') as plans,
        COUNT(*) FILTER (WHERE event_type = 'PROJECT_SELECTED') as selections,
        COUNT(*) FILTER (WHERE event_type = 'BHK_SELECTED') as bhk
      FROM conversation_events
    `);

    const msgRow = msgStatsRes.rows[0];
    const statusRow = statusStatsRes.rows[0];
    const eventsRow = eventsRes.rows[0];

    return {
      messagesToday: Number(msgRow.messages_today || 0),
      messagesSent: Number(statusRow.sent || 0),
      messagesDelivered: Number(statusRow.delivered || 0),
      messagesRead: Number(statusRow.read || 0),
      messagesFailed: Number(statusRow.failed || 0),
      repliesToday: Number(msgRow.replies_today || 0),
      unreadConversations: Number(unreadRes.rows[0].unread || 0),
      brochuresRequested: Number(eventsRow.brochures || 0),
      plansRequested: Number(eventsRow.plans || 0),
      projectSelections: Number(eventsRow.selections || 0),
      bhkSelections: Number(eventsRow.bhk || 0)
    };
  }

  async getMessageMetrics() {
    const countRes = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound
      FROM messages
    `);

    const statusStatsRes = await this.pool.query(`
      WITH latest_statuses AS (
        SELECT DISTINCT ON (message_id) message_id, LOWER(status) as status
        FROM message_status_events
        ORDER BY message_id, event_timestamp DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM latest_statuses
    `);

    const recentRes = await this.pool.query(
      "SELECT * FROM messages ORDER BY created_at DESC LIMIT 50"
    );

    const counts = countRes.rows[0];
    const statuses = statusStatsRes.rows[0];

    return {
      total: Number(counts.total || 0),
      today: Number(counts.today || 0),
      inbound: Number(counts.inbound || 0),
      outbound: Number(counts.outbound || 0),
      sent: Number(statuses.sent || 0),
      delivered: Number(statuses.delivered || 0),
      read: Number(statuses.read || 0),
      failed: Number(statuses.failed || 0),
      recent: recentRes.rows
    };
  }

  async getReplyMetrics() {
    const repliesRes = await this.pool.query(`
      SELECT
        COUNT(*) as total_replies,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as replies_today
      FROM messages
      WHERE direction = 'inbound'
    `);

    const unreadRes = await this.pool.query(`
      SELECT COUNT(*) as unread
      FROM conversations
      WHERE status != 'CLOSED' AND (unread_count > 0 OR (last_inbound_at IS NOT NULL AND (last_outbound_at IS NULL OR last_inbound_at > last_outbound_at)))
    `);

    const avgTimeRes = await this.pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - last_inbound_at)) * 1000) as avg_ms
      FROM conversations
      WHERE first_response_at IS NOT NULL AND last_inbound_at IS NOT NULL AND first_response_at >= last_inbound_at
    `);

    const recentRepliesRes = await this.pool.query(`
      SELECT m.*, c.name as contact_name, c.phone as contact_phone
      FROM messages m
      JOIN contacts c ON c.id = m.contact_id
      WHERE m.direction = 'inbound'
      ORDER BY m.created_at DESC
      LIMIT 50
    `);

    const avgMs = avgTimeRes.rows[0]?.avg_ms ? Math.round(Number(avgTimeRes.rows[0].avg_ms)) : null;

    const recentReplies = recentRepliesRes.rows.map((row) => ({
      message: row,
      contactName: row.contact_name,
      phone: row.contact_phone
    }));

    return {
      repliesToday: Number(repliesRes.rows[0].replies_today || 0),
      totalReplies: Number(repliesRes.rows[0].total_replies || 0),
      unreadConversations: Number(unreadRes.rows[0].unread || 0),
      averageResponseTimeMs: avgMs,
      recentReplies
    };
  }

  async getProjectMetrics() {
    const totalSelectionsRes = await this.pool.query(
      "SELECT COUNT(*) as count FROM conversation_events WHERE event_type = 'PROJECT_SELECTED'"
    );
    const brochuresRes = await this.pool.query(
      "SELECT COUNT(*) as count FROM conversation_events WHERE event_type = 'BROCHURE_REQUESTED'"
    );
    const plansRes = await this.pool.query(
      "SELECT COUNT(*) as count FROM conversation_events WHERE event_type = 'PLANS_REQUESTED'"
    );

    const projectStatsRes = await this.pool.query(`
      SELECT 
        COALESCE(project_id, LOWER(event_value), 'general') as project,
        COUNT(*) FILTER (WHERE event_type = 'PROJECT_SELECTED') as selections,
        COUNT(*) FILTER (WHERE event_type = 'BROCHURE_REQUESTED') as brochures,
        COUNT(*) FILTER (WHERE event_type = 'PLANS_REQUESTED') as plans
      FROM conversation_events
      WHERE event_type IN ('PROJECT_SELECTED', 'BROCHURE_REQUESTED', 'PLANS_REQUESTED')
      GROUP BY 1
    `);

    const byProject: Record<string, { selections: number; brochures: number; plans: number }> = {};
    for (const row of projectStatsRes.rows) {
      byProject[row.project] = {
        selections: Number(row.selections || 0),
        brochures: Number(row.brochures || 0),
        plans: Number(row.plans || 0)
      };
    }

    const bhkRes = await this.pool.query(`
      SELECT event_value, COUNT(*) as count
      FROM conversation_events
      WHERE event_type = 'BHK_SELECTED'
      GROUP BY event_value
    `);
    const bhkBreakdown: Record<string, number> = {};
    for (const row of bhkRes.rows) {
      bhkBreakdown[row.event_value || "unknown"] = Number(row.count || 0);
    }

    return {
      totalSelections: Number(totalSelectionsRes.rows[0].count || 0),
      brochuresRequested: Number(brochuresRes.rows[0].count || 0),
      plansRequested: Number(plansRes.rows[0].count || 0),
      byProject,
      bhkBreakdown
    };
  }

  async getContact360(contactId: string): Promise<Contact360 | null> {
    const contact = await this.findContactById(contactId);
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
      if (!latestActivity || new Date(conversation.last_message_at) > latestActivity) {
        latestActivity = new Date(conversation.last_message_at);
      }
    }
    if (messages.length > 0) {
      const lastMsgDate = new Date(messages[messages.length - 1].created_at);
      if (!latestActivity || lastMsgDate > latestActivity) {
        latestActivity = lastMsgDate;
      }
    }
    if (projectEvents.length > 0) {
      const lastEvDate = new Date(projectEvents[projectEvents.length - 1].created_at);
      if (!latestActivity || lastEvDate > latestActivity) {
        latestActivity = lastEvDate;
      }
    }

    // Response time calculation
    let firstResponseTimeMs: number | null = null;
    let formattedDuration: string | null = null;
    const lastInboundAt = conversation?.last_inbound_at ?? null;
    const firstResponseAt = conversation?.first_response_at ?? null;

    if (conversation && conversation.first_response_at && conversation.opened_at) {
      const startRef = conversation.last_inbound_at ?? conversation.opened_at;
      firstResponseTimeMs = Math.max(0, new Date(conversation.first_response_at).getTime() - new Date(startRef).getTime());
      const seconds = Math.round(firstResponseTimeMs / 1000);
      formattedDuration = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
        lastCustomerMessageAt = new Date(msg.created_at);
      } else {
        outboundCount++;
        lastBusinessMessage = msg.body_text || msg.template_name || `[${msg.message_type}]`;
        lastBusinessMessageAt = new Date(msg.created_at);
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
      conversation?.last_inbound_at && (!conversation.last_outbound_at || new Date(conversation.last_inbound_at) > new Date(conversation.last_outbound_at)) ? 1 : 0
    );

    const summary: Contact360Summary = {
      status: conversation?.status || "ACTIVE",
      currentState: conversation?.state || "INIT",
      lastActivityAt: latestActivity,
      unreadCount,
      firstResponseTimeSeconds: firstResponseTimeMs !== null ? Math.round(firstResponseTimeMs / 1000) : null,
      firstResponseTimeFormatted: formattedDuration,
      averageResponseTimeSeconds: firstResponseTimeMs !== null ? Math.round(firstResponseTimeMs / 1000) : null,
      averageResponseTimeFormatted: formattedDuration,
      medianResponseTimeSeconds: firstResponseTimeMs !== null ? Math.round(firstResponseTimeMs / 1000) : null,
      medianResponseTimeFormatted: formattedDuration,
      fastestResponseTimeSeconds: firstResponseTimeMs !== null ? Math.round(firstResponseTimeMs / 1000) : null,
      slowestResponseTimeSeconds: firstResponseTimeMs !== null ? Math.round(firstResponseTimeMs / 1000) : null,
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
}
