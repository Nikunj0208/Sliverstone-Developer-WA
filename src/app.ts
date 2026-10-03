import express from "express";
import type { Request } from "express";

import { healthRouter } from "./routes/health.js";
import { webhookRouter } from "./routes/webhook.js";

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

  return app;
}
