import { Router, type Request, type Response } from "express";
import { getAnalyticsRepository } from "../db/index.js";
import { metaSyncService } from "../services/meta-sync-service.js";
import { realtimeHub } from "../services/realtime-hub.js";
import { sendText } from "../meta/messages.js";
import { sendTemplate } from "../meta/templates.js";
import { env } from "../config/env.js";

export const crmRouter = Router();

/**
 * GET /api/crm/contacts
 * Returns list of contacts with 24-hr window status, latest message preview, and status.
 */
crmRouter.get("/contacts", async (req: Request, res: Response) => {
  try {
    const repo = getAnalyticsRepository();
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const batch = typeof req.query.batch === "string" ? req.query.batch : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await repo.listCrmContacts({ search, batch, limit, offset });
    res.json({
      success: true,
      total: result.total,
      contacts: result.contacts
    });
  } catch (err: any) {
    console.error("[CRM] Error listing contacts:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/crm/chats/:wa_id
 * Returns full chronological chat history, 24-hr window countdown status, and approved templates.
 */
crmRouter.get("/chats/:wa_id", async (req: Request, res: Response) => {
  try {
    const repo = getAnalyticsRepository();
    const waId = req.params.wa_id;
    const cleanWaId = String(Array.isArray(waId) ? waId[0] : waId || "").replace(/\D/g, "");

    const [contact, messages, syncSnapshot] = await Promise.all([
      repo.getCrmContact(cleanWaId),
      repo.listChatMessagesByWaId(cleanWaId),
      repo.getLatestMetaSyncSnapshot()
    ]);

    if (!contact) {
      res.status(404).json({ success: false, error: "Contact not found" });
      return;
    }

    const lastInbound = contact.last_inbound_at ? new Date(contact.last_inbound_at) : null;
    let isOpen = false;
    let expiresAt: string | null = null;
    let remainingHours = 0;
    let remainingMinutes = 0;
    let badgeText = "24h Window Closed — Template Only";
    let badgeType: "open" | "closed" = "closed";

    if (lastInbound) {
      const expiresTime = lastInbound.getTime() + 24 * 3600 * 1000;
      const remainingMs = expiresTime - Date.now();
      if (remainingMs > 0) {
        isOpen = true;
        expiresAt = new Date(expiresTime).toISOString();
        remainingHours = Math.floor(remainingMs / (3600 * 1000));
        remainingMinutes = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
        badgeText = `24h Window Open — ${remainingHours}h ${remainingMinutes}m left`;
        badgeType = "open";
      }
    }

    const approvedTemplates = syncSnapshot?.templates?.filter(t => t.status === "APPROVED") || [];

    res.json({
      success: true,
      contact,
      window24h: {
        isOpen,
        expiresAt,
        remainingHours,
        remainingMinutes,
        badgeText,
        badgeType
      },
      messages,
      approvedTemplates
    });
  } catch (err: any) {
    console.error("[CRM] Error loading chat history:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/crm/send-text
 * Sends a live free-form text message via Meta Cloud API.
 * STRICT SAFETY CHECK: Only allowed if the contact's 24-hr window is OPEN.
 */
crmRouter.post("/send-text", async (req: Request, res: Response) => {
  try {
    const { wa_id, text } = req.body;
    if (!wa_id || !text || !text.trim()) {
      res.status(400).json({ success: false, error: "wa_id and non-empty text are required" });
      return;
    }

    const repo = getAnalyticsRepository();
    const cleanWaId = String(wa_id).replace(/\D/g, "");
    const contact = await repo.getCrmContact(cleanWaId);

    if (!contact) {
      res.status(404).json({ success: false, error: "Contact not found" });
      return;
    }

    // Verify 24-hour customer care window is open
    const lastInbound = contact.last_inbound_at ? new Date(contact.last_inbound_at) : null;
    const isWindowOpen = Boolean(lastInbound && (Date.now() - lastInbound.getTime()) < 24 * 3600 * 1000);

    if (!isWindowOpen) {
      res.status(400).json({
        success: false,
        code: "WINDOW_CLOSED",
        error: "24-Hour Customer Care Window is CLOSED. Meta prohibits sending free-form text outside the 24-hour window (Error 131047). Please send an approved Meta Template instead."
      });
      return;
    }

    // Send real message via Meta Cloud API
    const metaRes = await sendText(cleanWaId, text.trim());
    const wamid = metaRes.metaMessageId || `wamid.HBgM${Date.now()}_CRM`;

    // Persist into chat_messages
    const savedMsg = await repo.saveChatMessage({
      wamid,
      wa_id: cleanWaId,
      direction: "outbound",
      message_type: "text",
      content_body: text.trim(),
      status: "sent",
      official_timestamp: new Date()
    });

    // Broadcast SSE update
    realtimeHub.broadcast("crm_message", {
      waId: cleanWaId,
      message: savedMsg
    });

    res.json({
      success: true,
      message: savedMsg,
      wamid
    });
  } catch (err: any) {
    console.error("[CRM] Error sending text message:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/crm/send-template
 * Sends an approved Meta template message. Permitted even when 24-hr window is closed.
 */
crmRouter.post("/send-template", async (req: Request, res: Response) => {
  try {
    const { wa_id, template_name, language } = req.body;
    if (!wa_id || !template_name) {
      res.status(400).json({ success: false, error: "wa_id and template_name are required" });
      return;
    }

    const repo = getAnalyticsRepository();
    const cleanWaId = String(wa_id).replace(/\D/g, "");
    const contact = await repo.getCrmContact(cleanWaId);

    if (!contact) {
      res.status(404).json({ success: false, error: "Contact not found" });
      return;
    }

    // Verify template is approved
    const syncSnapshot = await repo.getLatestMetaSyncSnapshot();
    const matched = syncSnapshot?.templates?.find(t => t.name === template_name && t.status === "APPROVED");
    const langCode = language || (matched?.language === "en" ? "en" : "en_US");

    // Send template via Meta Cloud API
    const metaRes = await sendTemplate(cleanWaId, template_name, [], undefined, langCode);
    const wamid = metaRes.metaMessageId || `wamid.HBgM${Date.now()}_TEMPLATE`;

    // Determine preview body text
    let bodyText = `Template: ${template_name}`;
    if (template_name === "silverstone_invitation") {
      bodyText = `⚜️ *SILVERSTONE DEVELOPERS* ⚜️\nHello ${contact.profile_name || "Valued Client"},\n\nWe invite you to explore Surat’s most prestigious residential & commercial landmarks.\n\nType *More Details* to browse luxury floor plans, brochures, and book an exclusive site visit.`;
    } else if (template_name === "silverstone_call") {
      bodyText = `📞 *SILVERSTONE DEVELOPERS SALES DESK*\nHello ${contact.profile_name || "Valued Client"}, our senior relationship manager is available to assist you.`;
    }

    // Persist into chat_messages
    const savedMsg = await repo.saveChatMessage({
      wamid,
      wa_id: cleanWaId,
      direction: "outbound",
      message_type: "template",
      template_name,
      content_body: bodyText,
      status: "sent",
      official_timestamp: new Date()
    });

    // Broadcast SSE update
    realtimeHub.broadcast("crm_message", {
      waId: cleanWaId,
      message: savedMsg
    });

    res.json({
      success: true,
      message: savedMsg,
      wamid
    });
  } catch (err: any) {
    console.error("[CRM] Error sending template message:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/crm/stream
 * Real-time Server-Sent Events stream for CRM chat updates.
 */
crmRouter.get("/stream", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  res.write("event: connected\ndata: {\"status\":\"connected\",\"timestamp\":\"" + new Date().toISOString() + "\"}\n\n");

  const unregister = realtimeHub.registerClient(res);

  req.on("close", () => {
    unregister();
  });
});

/**
 * POST /api/crm/backfill
 * Triggers backfill of historical messages and contacts into chat_messages.
 */
crmRouter.post("/backfill", async (_req: Request, res: Response) => {
  try {
    const repo = getAnalyticsRepository();
    const result = await repo.backfillChatMessages();
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[CRM] Error running backfill:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
