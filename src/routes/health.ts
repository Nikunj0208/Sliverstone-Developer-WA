import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    version: "2026-11-17-crm-mobile-suite",
    commit: process.env.RENDER_GIT_COMMIT || "latest",
    environment: process.env.NODE_ENV || "production"
  });
});
