import express from "express";

import { healthRouter } from "./routes/health.js";
import { webhookRouter } from "./routes/webhook.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(webhookRouter);

  return app;
}
