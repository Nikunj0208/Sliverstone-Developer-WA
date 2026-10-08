import { Router, type Request } from "express";

import { env } from "../config/env.js";
import { routeButtonAction } from "../flows/actions.js";
import { enqueueConversationAction } from "../flows/conversation-queue.js";
import { projectIdFromTrigger, sendProjectDetails } from "../flows/projects.js";
import { continueSiteVisitBooking } from "../flows/site-visit.js";
import { acceptIncomingMessage } from "../webhooks/dedupe.js";
import { sendWelcomeFlow } from "../flows/welcome.js";
import { parseWebhookEvents } from "../webhooks/parser.js";
import { isValidWebhookSignature } from "../webhooks/signature.js";
import { analyticsService } from "../services/analytics-service.js";

export const webhookRouter = Router();

webhookRouter.get("/webhook", (request, response) => {
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === env.webhookVerifyToken &&
    typeof challenge === "string"
  ) {
    response.status(200).send(challenge);
    return;
  }

  response.sendStatus(403);
});

webhookRouter.post("/webhook", async (request, response) => {
  const signature = request.header("x-hub-signature-256");
  console.info("[WEBHOOK] POST RECEIVED");
  console.info(`timestamp: ${new Date().toISOString()}`);
  console.info(`content-type: ${request.header("content-type") ?? "MISSING"}`);
  console.info(`content-length: ${request.header("content-length") ?? "MISSING"}`);
  console.info(`x-hub-signature-256: ${signature ? "PRESENT" : "MISSING"}`);

  const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody || !isValidWebhookSignature(rawBody, signature, env.metaAppSecret)) {
    console.info("[WEBHOOK] SIGNATURE INVALID");
    response.sendStatus(401);
    return;
  }

  console.info("[WEBHOOK] SIGNATURE VALID");
  const events = parseWebhookEvents(request.body);

  for (const event of events) {
    console.info(`WHATSAPP EVENT TYPE: ${event.type}`);

    if (event.type === "STATUS") {
      try {
        await analyticsService.recordStatusEvent(event);
      } catch (err) {
        console.error("Failed to record status event", err);
      }
      continue;
    }

    if (!acceptIncomingMessage(event.messageId)) {
      console.info("[WEBHOOK] DUPLICATE MESSAGE IGNORED");
      continue;
    }

    let inboundData: Awaited<ReturnType<typeof analyticsService.recordInboundMessage>> | undefined;
    try {
      inboundData = await analyticsService.recordInboundMessage({
        waId: event.waId,
        from: event.from || event.waId,
        messageId: event.messageId,
        type: event.type,
        text: event.type === "TEXT" ? event.text : undefined,
        buttonId: event.type === "BUTTON_REPLY" ? event.buttonId : undefined,
        rowId: event.type === "LIST_REPLY" ? event.rowId : undefined,
        timestamp: event.timestamp,
        profileName: event.profileName
      });
    } catch (err) {
      console.error("Failed to record inbound message", err);
    }

    if (inboundData?.isDuplicate) {
      console.info("[WEBHOOK] DUPLICATE MESSAGE IGNORED");
      continue;
    }

    if (event.type === "TEXT") {
      console.info("[WEBHOOK] TEXT EVENT RECEIVED");
      console.info("[FLOW] TEXT ROUTED");

      const trimmedText = event.text.trim().toUpperCase();
      if (trimmedText === "STOP" || trimmedText === "UNSUBSCRIBE" || trimmedText === "OPT OUT") {
        if (inboundData) {
          await analyticsService.recordOptOut(inboundData.contact.id, inboundData.conversation.id);
        }
      }

      try {
        if (await enqueueConversationAction(event.waId, () => continueSiteVisitBooking(event.waId, event.text))) {
          continue;
        }
      } catch {
        console.error("Site visit form response failed");
        continue;
      }
      const projectId = projectIdFromTrigger(event.text);
      if (projectId) {
        console.info("[ACTION] PROJECT SELECTED");
        console.info(`[ACTION] PROJECT:${projectId}`);
        if (inboundData) {
          await analyticsService.recordConversationEvent(
            inboundData.conversation.id,
            inboundData.contact.id,
            "PROJECT_SELECTED",
            projectId,
            projectId
          );
        }
        try {
          await enqueueConversationAction(event.waId, () => sendProjectDetails(event.waId, projectId));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown project flow error.";
          console.error("Project details flow failed", message);
        }
      } else {
        if (inboundData) {
          await analyticsService.recordConversationEvent(
            inboundData.conversation.id,
            inboundData.contact.id,
            "MAIN_MENU_VIEWED"
          );
        }
        try {
          await enqueueConversationAction(event.waId, () => sendWelcomeFlow(event.waId));
        } catch {
          console.error("Welcome flow failed");
        }
      }
      continue;
    }

    if (event.type === "BUTTON_REPLY") {
      console.info("[WEBHOOK] BUTTON_REPLY RECEIVED");
      console.info(`[LIVE] BUTTON ID: ${event.buttonId}`);
      try {
        await enqueueConversationAction(event.waId, () => routeButtonAction(event.waId, event.buttonId));
      } catch {
        console.error("Button action failed");
      }
      continue;
    }

    if (event.type === "LIST_REPLY") {
      console.info("[WEBHOOK] LIST_REPLY RECEIVED");
      console.info("[LIVE] PROJECT ACTION RECEIVED");
      const projectId = projectIdFromTrigger(event.rowId);
      if (projectId) {
        console.info("[ACTION] PROJECT SELECTED");
        console.info(`[ACTION] PROJECT:${projectId}`);
        if (inboundData) {
          await analyticsService.recordConversationEvent(
            inboundData.conversation.id,
            inboundData.contact.id,
            "PROJECT_SELECTED",
            projectId,
            projectId
          );
        }
        try {
          await enqueueConversationAction(event.waId, () => sendProjectDetails(event.waId, projectId));
        } catch {
          console.error("Project list action failed");
        }
      } else {
        try {
          await enqueueConversationAction(event.waId, () => routeButtonAction(event.waId, event.rowId));
        } catch {
          console.error("List action failed");
        }
      }
    }
  }

  response.sendStatus(200);
});
