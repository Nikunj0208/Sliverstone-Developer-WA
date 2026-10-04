import { Router } from "express";
import { env } from "../config/env.js";

export const callRouter = Router();

callRouter.get("/call", (_request, response) => {
  const number = (env.clientPhoneNumber || "918866751322").trim();
  const formatted = number.startsWith("+") ? number : `+${number}`;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Call Silverstone Developers</title>
  <meta http-equiv="refresh" content="0; url=tel:${formatted}">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 20px; background: #f0f2f5;">
  <div style="max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="font-size: 48px; margin-bottom: 16px;">📞</div>
    <h2 style="color: #128c7e; margin-bottom: 8px;">Silverstone Developers</h2>
    <p style="color: #667781; margin-bottom: 24px;">Connecting to our sales desk...</p>
    <a href="tel:${formatted}" style="display: inline-block; background: #25d366; color: white; text-decoration: none; padding: 14px 28px; border-radius: 24px; font-weight: bold; font-size: 18px;">
      Call ${formatted}
    </a>
  </div>
  <script>
    window.location.href = "tel:${formatted}";
  </script>
</body>
</html>`;

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.status(200).send(html);
});
