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
      unread: req.query.unread === "true" ? true : req.query.unread === "false" ? false : undefined,
      replied: req.query.replied === "true" ? true : req.query.replied === "false" ? false : undefined,
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
