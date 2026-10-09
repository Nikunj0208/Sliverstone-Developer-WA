import { Router, type Request, type Response, type NextFunction } from "express";
import { analyticsService } from "../services/analytics-service.js";
import type { ContactListQuery, ConversationListQuery, MessagePaginationQuery } from "../db/types.js";

export const analyticsRouter = Router();

/**
 * Authentication middleware for internal analytics & CRM endpoints.
 * Protects customer data by validating against configured API key if defined.
 */
function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.INTERNAL_API_KEY || process.env.CRM_API_KEY;
  if (expectedKey) {
    const providedKey =
      req.header("x-api-key") ||
      req.header("authorization")?.replace(/^Bearer\s+/i, "");

    if (!providedKey || providedKey !== expectedKey) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
      return;
    }
  }

  next();
}

analyticsRouter.use("/api", internalAuth);

/**
 * POST /api/sync/live
 * Pulls any new live customer replies and webhook events from Render deployment
 */
analyticsRouter.post("/api/sync/live", async (_req: Request, res: Response) => {
  try {
    const { getAnalyticsRepository } = await import("../db/index.js");
    const { syncFromLiveRender } = await import("../services/live-sync.js");
    const repo = getAnalyticsRepository();
    const result = await syncFromLiveRender(repo);
    res.json(result);
  } catch (error: any) {
    console.error("[API] Failed to run live sync:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sync/broadcasts
 * Re-reads and synchronizes all broadcast log JSON files datewise
 */
analyticsRouter.post("/api/sync/broadcasts", async (_req: Request, res: Response) => {
  try {
    const { getAnalyticsRepository } = await import("../db/index.js");
    const { syncBroadcastLogsToRepository } = await import("../db/sync-logs.js");
    const repo = getAnalyticsRepository();
    const result = await syncBroadcastLogsToRepository(repo);
    res.json(result);
  } catch (error: any) {
    console.error("[API] Failed to run broadcast sync:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sync/meta
 * Pulls latest official metrics directly from Meta WhatsApp Business Platform
 */
analyticsRouter.post("/api/sync/meta", async (_req: Request, res: Response) => {
  try {
    const { getAnalyticsRepository } = await import("../db/index.js");
    const { metaInsightsService } = await import("../services/meta-insights-service.js");
    const repo = getAnalyticsRepository();
    const result = await metaInsightsService.syncToDatabase(repo);
    res.json(result);
  } catch (error: any) {
    console.error("[API] Failed to run Meta sync:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/meta-insights
 * Returns official verified Meta WhatsApp Business Platform analytics
 */
analyticsRouter.get("/api/analytics/meta-insights", async (_req: Request, res: Response) => {
  try {
    const { getAnalyticsRepository } = await import("../db/index.js");
    const repo = getAnalyticsRepository();
    const overview = await repo.getMetaCampaignOverview();
    res.json(overview);
  } catch (error: any) {
    console.error("[API] Failed to get Meta insights:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/meta-insights/:dateOrBatch
 * Returns official Meta insights for a specific day (YYYY-MM-DD) or batch (1..5)
 */
analyticsRouter.get("/api/analytics/meta-insights/:dateOrBatch", async (req: Request, res: Response) => {
  try {
    const { getAnalyticsRepository } = await import("../db/index.js");
    const repo = getAnalyticsRepository();
    const metric = await repo.getMetaMetricForDateOrBatch(String(req.params.dateOrBatch));
    if (!metric) {
      res.status(404).json({ error: "Meta metrics not found for specified date or batch" });
      return;
    }
    res.json(metric);
  } catch (error: any) {
    console.error("[API] Failed to get Meta metric for date/batch:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/contacts/import-meta-activity
 * Imports Meta WhatsApp Manager Activity CSV to sync genuine row-level delivery and read timestamps
 */
analyticsRouter.post("/api/contacts/import-meta-activity", async (req: Request, res: Response) => {
  try {
    const csvContent = req.body?.csvText || (typeof req.body === "string" ? req.body : null);
    if (!csvContent || typeof csvContent !== "string") {
      res.status(400).json({ error: "Missing csvText in request body" });
      return;
    }

    const { getAnalyticsRepository } = await import("../db/index.js");
    const repo = getAnalyticsRepository();
    const pool = (repo as any).pool;

    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      res.status(400).json({ error: "CSV has no data rows" });
      return;
    }

    function parseCsvLine(line: string): string[] {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ""));
      return values;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, ""));
    const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("recipient") || h.includes("destination") || h.includes("waid") || h.includes("to"));
    const statusIdx = headers.findIndex(h => h.includes("status") || h.includes("deliverystatus") || h.includes("messagestatus") || h.includes("event"));
    const timeIdx = headers.findIndex(h => h.includes("time") || h.includes("date") || h.includes("timestamp") || h.includes("created"));
    const wamidIdx = headers.findIndex(h => h.includes("wamid") || h.includes("messageid") || h.includes("msgid") || h.includes("id"));
    const errCodeIdx = headers.findIndex(h => h.includes("errorcode") || h.includes("errcode") || h.includes("code"));
    const errMsgIdx = headers.findIndex(h => h.includes("error") || h.includes("reason") || h.includes("description") || h.includes("message"));

    let importedCount = 0;
    let readCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const { normalizePhoneNumber } = await import("../utils/phone.js");

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length === 0 || !row[0]) continue;

      const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : "";
      const cleanPhone = normalizePhoneNumber(rawPhone);
      const rawStatus = (statusIdx !== -1 ? row[statusIdx] : "").toLowerCase().trim();
      const wamid = wamidIdx !== -1 ? row[wamidIdx]?.trim() : undefined;
      const rawTime = timeIdx !== -1 ? row[timeIdx] : "";
      const eventTime = rawTime ? new Date(rawTime) : new Date();
      const validTime = isNaN(eventTime.getTime()) ? new Date() : eventTime;
      const errCode = errCodeIdx !== -1 ? row[errCodeIdx] : undefined;
      const errMsg = errMsgIdx !== -1 ? row[errMsgIdx] : undefined;

      let targetStatus: "sent" | "delivered" | "read" | "failed" = "sent";
      if (rawStatus.includes("read") || rawStatus.includes("seen") || rawStatus.includes("blue")) {
        targetStatus = "read";
      } else if (rawStatus.includes("deliver")) {
        targetStatus = "delivered";
      } else if (rawStatus.includes("fail") || rawStatus.includes("undeliver") || rawStatus.includes("error")) {
        targetStatus = "failed";
      }

      let messageId: string | null = null;
      if (wamid) {
        const msgRes = await pool.query("SELECT id, contact_id FROM messages WHERE wa_message_id = $1 LIMIT 1", [wamid]);
        if (msgRes.rows.length > 0) messageId = msgRes.rows[0].id;
      }

      if (!messageId && cleanPhone) {
        const msgRes = await pool.query(`
          SELECT m.id 
          FROM messages m 
          JOIN contacts c ON m.contact_id = c.id 
          WHERE (c.phone = $1 OR c.wa_id = $1 OR c.phone = $2) AND m.direction = 'outbound'
          ORDER BY m.created_at DESC 
          LIMIT 1
        `, [cleanPhone, rawPhone.replace(/\D/g, "")]);
        if (msgRes.rows.length > 0) messageId = msgRes.rows[0].id;
      }

      if (!messageId) {
        skippedCount++;
        continue;
      }

      const eventId = `mse_meta_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await pool.query(`
        INSERT INTO message_status_events (
          id, message_id, status, recipient_id, event_timestamp, error_code, error_message, received_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (message_id, status, event_timestamp) DO NOTHING
      `, [eventId, messageId, targetStatus, cleanPhone, validTime, errCode || null, errMsg || null]);

      if (targetStatus === "read") {
        const delivTime = new Date(validTime.getTime() - 2000);
        const delivEventId = `mse_meta_deliv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await pool.query(`
          INSERT INTO message_status_events (
            id, message_id, status, recipient_id, event_timestamp, received_at
          ) VALUES ($1, $2, 'delivered', $3, $4, NOW())
          ON CONFLICT (message_id, status, event_timestamp) DO NOTHING
        `, [delivEventId, messageId, cleanPhone, delivTime]);
        readCount++;
      } else if (targetStatus === "delivered") {
        deliveredCount++;
      } else if (targetStatus === "failed") {
        failedCount++;
      }
      importedCount++;
    }

    res.json({
      success: true,
      totalRows: lines.length - 1,
      importedCount,
      readCount,
      deliveredCount,
      failedCount,
      skippedCount
    });
  } catch (err: any) {
    console.error("[API] Failed to import Meta activity CSV:", err);
    res.status(500).json({ error: err.message || "Failed to import activity CSV" });
  }
});

/**
 * GET /api/analytics/overview
 */
analyticsRouter.get("/api/analytics/overview", async (_req: Request, res: Response) => {
  try {
    const overview = await analyticsService.getOverview();
    res.json(overview);
  } catch (error) {
    console.error("[API] Failed to get analytics overview:", error);
    res.status(500).json({ error: "Failed to retrieve analytics overview" });
  }
});

/**
 * GET /api/analytics/messages
 */
analyticsRouter.get("/api/analytics/messages", async (_req: Request, res: Response) => {
  try {
    const metrics = await analyticsService.getMessageMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[API] Failed to get message metrics:", error);
    res.status(500).json({ error: "Failed to retrieve message metrics" });
  }
});

/**
 * GET /api/analytics/replies
 */
analyticsRouter.get("/api/analytics/replies", async (_req: Request, res: Response) => {
  try {
    const metrics = await analyticsService.getReplyMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[API] Failed to get reply metrics:", error);
    res.status(500).json({ error: "Failed to retrieve reply metrics" });
  }
});

/**
 * GET /api/analytics/projects
 */
analyticsRouter.get("/api/analytics/projects", async (_req: Request, res: Response) => {
  try {
    const metrics = await analyticsService.getProjectMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[API] Failed to get project metrics:", error);
    res.status(500).json({ error: "Failed to retrieve project metrics" });
  }
});

/**
 * GET /api/contacts
 * Search, filter, sort, and paginate contacts.
 */
analyticsRouter.get("/api/contacts", async (req: Request, res: Response) => {
  try {
    const query: ContactListQuery = {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      project: typeof req.query.project === "string" ? req.query.project : undefined,
      leadSource: typeof req.query.leadSource === "string" ? req.query.leadSource : undefined,
      consentStatus: typeof req.query.consentStatus === "string" ? req.query.consentStatus : undefined,
      optedOut: req.query.optedOut === "true" ? true : req.query.optedOut === "false" ? false : undefined,
      conversationStatus: typeof req.query.conversationStatus === "string" ? req.query.conversationStatus : undefined,
      currentState: typeof req.query.currentState === "string" ? req.query.currentState : undefined,
      lastActivityRange: typeof req.query.lastActivityRange === "string" ? req.query.lastActivityRange : undefined,
      date: typeof req.query.date === "string" ? req.query.date : undefined,
      batch: typeof req.query.batch === "string" ? req.query.batch : undefined,
      deliveryStatus: typeof req.query.deliveryStatus === "string" ? req.query.deliveryStatus : undefined,
      unread: req.query.unread === "true" ? true : req.query.unread === "false" ? false : undefined,
      replied: req.query.replied === "true" ? true : req.query.replied === "false" ? false : undefined,
      buttonClicks: req.query.buttonClicks === "true" ? true : req.query.buttonClicks === "false" ? false : undefined,
      brochureRequested: req.query.brochureRequested === "true" ? true : undefined,
      planRequested: req.query.planRequested === "true" ? true : undefined,
      siteVisitRequested: req.query.siteVisitRequested === "true" ? true : undefined,
      sortBy: typeof req.query.sortBy === "string" ? (req.query.sortBy as ContactListQuery["sortBy"]) : "latest_activity",
      sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
      limit: req.query.limit ? Math.min(1000, Math.max(1, parseInt(req.query.limit as string, 10))) : 50,
      offset: req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10)) : 0
    };

    const result = await analyticsService.listContacts(query);
    res.json({
      contacts: result.contacts,
      total: result.total,
      limit: query.limit,
      offset: query.offset
    });
  } catch (error) {
    console.error("[API] Failed to list contacts:", error);
    res.status(500).json({ error: "Failed to retrieve contacts list" });
  }
});

/**
 * GET /api/contacts/export
 * Secure CSV / JSON export of contacts for internal authorized users.
 */
analyticsRouter.get("/api/contacts/export", async (req: Request, res: Response) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "json";
    const exportData = await analyticsService.exportContacts(format);

    // Record audit log
    await analyticsService.recordAuditLog({
      action: "CONTACT_EXPORTED",
      entity_type: "contact",
      entity_id: "all",
      user_id: req.header("x-user-id") || null,
      metadata_json: { format }
    });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="silverstone_contacts.csv"');
      res.send(exportData);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.send(exportData);
    }
  } catch (error) {
    console.error("[API] Failed to export contacts:", error);
    res.status(500).json({ error: "Failed to export contacts" });
  }
});

/**
 * GET /api/contacts/:id
 * Full Contact 360 payload with masked phone numbers.
 */
analyticsRouter.get("/api/contacts/:id", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const contactId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!contactId || typeof contactId !== "string") {
      res.status(400).json({ error: "Contact ID is required" });
      return;
    }

    const contact360 = await analyticsService.getContact360(contactId);
    if (!contact360) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    // Record audit log
    await analyticsService.recordAuditLog({
      action: "CONTACT_VIEWED",
      entity_type: "contact",
      entity_id: contactId,
      user_id: req.header("x-user-id") || null,
      metadata_json: { ip: req.ip }
    });

    res.json(contact360);
  } catch (error) {
    console.error("[API] Failed to get contact 360:", error);
    res.status(500).json({ error: "Failed to retrieve contact details" });
  }
});

/**
 * POST /api/contacts/:id/send-invitation
 * Sends official Meta WhatsApp marketing invitation template to a contact.
 */
analyticsRouter.post("/api/contacts/:id/send-invitation", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const contactId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!contactId || typeof contactId !== "string") {
      res.status(400).json({ error: "Contact ID is required" });
      return;
    }

    const { getAnalyticsRepository } = await import("../db/index.js");
    const repo = getAnalyticsRepository();
    const contact = await repo.findContactById(contactId);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const cleanPhone = (contact.phone || contact.wa_id).replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    // Send official template via Meta API
    const { uploadMedia } = await import("../meta/media.js");
    let headerMediaId = "2128096154765337";
    try {
      headerMediaId = await uploadMedia("client-assets/organized/welcome/Welcome image.jpeg");
    } catch {}

    const axios = (await import("axios")).default;
    const { env } = await import("../config/env.js");

    const metaRes = await axios.post(
      `https://graph.facebook.com/v20.0/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
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

    const waMessageId = metaRes.data.messages?.[0]?.id || `wamid.inv_${Date.now()}`;

    // Track outbound message in CRM
    await analyticsService.trackOutboundMessage({
      to: formattedPhone,
      waMessageId,
      messageType: "template",
      templateName: "silverstone_invitation",
      bodyText: `Silverstone Invitation sent to ${contact.name || "Lead"}`
    });

    const msg = await repo.findMessageByWaMessageId(waMessageId);
    if (msg) {
      await repo.createStatusEvent({
        message_id: msg.id,
        status: "sent",
        event_timestamp: new Date()
      });
    }

    await repo.updateContact(contact.id, {
      last_activity_at: new Date()
    });

    res.json({
      success: true,
      contactId: contact.id,
      name: contact.name,
      phone: formattedPhone,
      waMessageId,
      metaResponse: metaRes.data
    });
  } catch (error: any) {
    console.error("[API] Failed to send invitation:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.error?.message || error.message || "Failed to send invitation"
    });
  }
});

/**
 * GET /api/contacts/:id/conversations
 * List conversation sessions for a specific contact.
 */
analyticsRouter.get("/api/contacts/:id/conversations", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const contactId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!contactId || typeof contactId !== "string") {
      res.status(400).json({ error: "Contact ID is required" });
      return;
    }

    const conversations = await analyticsService.listConversationsByContactId(contactId);
    res.json(conversations);
  } catch (error) {
    console.error("[API] Failed to get contact conversations:", error);
    res.status(500).json({ error: "Failed to retrieve conversations for contact" });
  }
});

/**
 * GET /api/conversations
 * Search, filter, and paginate conversation sessions.
 */
analyticsRouter.get("/api/conversations", async (req: Request, res: Response) => {
  try {
    const query: ConversationListQuery = {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      unread: req.query.unread === "true" ? true : req.query.unread === "false" ? false : undefined,
      needsReply: req.query.needsReply === "true" ? true : req.query.needsReply === "false" ? false : undefined,
      replied: req.query.replied === "true" ? true : req.query.replied === "false" ? false : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      project: typeof req.query.project === "string" ? req.query.project : undefined,
      campaign: typeof req.query.campaign === "string" ? req.query.campaign : undefined,
      currentState: typeof req.query.currentState === "string" ? req.query.currentState : undefined,
      dateRange: typeof req.query.dateRange === "string" ? req.query.dateRange : undefined,
      limit: req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 50,
      offset: req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10)) : 0
    };

    const result = await analyticsService.listConversations(query);
    res.json({
      conversations: result.conversations,
      total: result.total,
      limit: query.limit,
      offset: query.offset
    });
  } catch (error) {
    console.error("[API] Failed to list conversations:", error);
    res.status(500).json({ error: "Failed to retrieve conversations" });
  }
});

/**
 * GET /api/conversations/:id
 * Conversation detail with paginated messages and events.
 */
analyticsRouter.get("/api/conversations/:id", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const conversationId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!conversationId || typeof conversationId !== "string") {
      res.status(400).json({ error: "Conversation ID is required" });
      return;
    }

    const pagination: MessagePaginationQuery = {
      limit: req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 50,
      offset: req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10)) : 0
    };

    const detail = await analyticsService.getConversationDetail(conversationId, pagination);
    if (!detail) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Automatically acknowledge conversation when opened internally by authorized user
    await analyticsService.acknowledgeConversation(conversationId);

    // Record audit log
    await analyticsService.recordAuditLog({
      action: "CONVERSATION_VIEWED",
      entity_type: "conversation",
      entity_id: conversationId,
      user_id: req.header("x-user-id") || null,
      metadata_json: { ip: req.ip }
    });

    res.json(detail);
  } catch (error) {
    console.error("[API] Failed to get conversation details:", error);
    res.status(500).json({ error: "Failed to retrieve conversation details" });
  }
});

/**
 * POST /api/conversations/:id/acknowledge
 * Explicit CRM internal read acknowledgment.
 */
analyticsRouter.post("/api/conversations/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const conversationId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!conversationId || typeof conversationId !== "string") {
      res.status(400).json({ error: "Conversation ID is required" });
      return;
    }

    const updated = await analyticsService.acknowledgeConversation(conversationId);
    if (!updated) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({ success: true, conversation: updated });
  } catch (error) {
    console.error("[API] Failed to acknowledge conversation:", error);
    res.status(500).json({ error: "Failed to acknowledge conversation" });
  }
});

/**
 * GET /api/conversations/:id/export
 */
analyticsRouter.get("/api/conversations/:id/export", async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const conversationId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!conversationId || typeof conversationId !== "string") {
      res.status(400).json({ error: "Conversation ID is required" });
      return;
    }

    const format = req.query.format === "csv" ? "csv" : "json";
    const exportData = await analyticsService.exportConversation(conversationId, format);
    if (!exportData) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="conversation_${conversationId}.csv"`);
      res.send(exportData);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.send(exportData);
    }
  } catch (error) {
    console.error("[API] Failed to export conversation:", error);
    res.status(500).json({ error: "Failed to export conversation" });
  }
});

/**
 * GET /api/duplicates
 * Read-only passive duplicate contact detection report.
 */
analyticsRouter.get("/api/duplicates", async (_req: Request, res: Response) => {
  try {
    const duplicates = await analyticsService.detectDuplicateContacts();
    res.json({
      count: duplicates.length,
      duplicates
    });
  } catch (error) {
    console.error("[API] Failed to detect duplicate contacts:", error);
    res.status(500).json({ error: "Failed to detect duplicates" });
  }
});

/**
 * GET /api/audit-logs
 */
analyticsRouter.get("/api/audit-logs", async (req: Request, res: Response) => {
  try {
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const logs = await analyticsService.listAuditLogs(entityType, entityId);
    res.json(logs);
  } catch (error) {
    console.error("[API] Failed to get audit logs:", error);
    res.status(500).json({ error: "Failed to retrieve audit logs" });
  }
});
