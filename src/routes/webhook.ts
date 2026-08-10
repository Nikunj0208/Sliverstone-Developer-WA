import { Router } from "express";

import { env } from "../config/env.js";
import { parseWebhookEvent } from "../webhooks/parser.js";
import { isValidWebhookSignature } from "../webhooks/signature.js";

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

webhookRouter.post("/webhook", (request, response) => {
  const rawBody = Buffer.isBuffer(request.body)
    ? request.body
    : Buffer.from(JSON.stringify(request.body ?? {}));
  const signature = request.header("x-hub-signature-256");

  if (!isValidWebhookSignature(rawBody, signature, env.metaAppSecret)) {
    response.sendStatus(401);
    return;
  }

  parseWebhookEvent(request.body);
  response.sendStatus(200);
});
