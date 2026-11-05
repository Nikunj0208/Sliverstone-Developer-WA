import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    version: "2026-11-05-bot-silence",
    commit: "5ce65c5",
    environment: process.env.NODE_ENV || "production"
  });
});
