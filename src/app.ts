import express from "express";
import type { Request } from "express";

import { healthRouter } from "./routes/health.js";
import { webhookRouter } from "./routes/webhook.js";
import { callRouter } from "./routes/call.js";
import { analyticsRouter } from "./routes/analytics.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { crmRouter } from "./routes/crm.js";

export function createApp() {
  const app = express();

  app.use(
    express.json({
      verify: (request, _response, buffer) => {
        (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      }
    })
  );
  app.use(healthRouter);
  app.use(webhookRouter);
  app.use(callRouter);
  app.use(analyticsRouter);
  app.use(dashboardRouter);
  app.use("/api/crm", crmRouter);

  return app;
}
