import { env } from "../config/env.js";
import { sendContact, sendText } from "../meta/messages.js";
import { sendTemplate } from "../meta/templates.js";

export async function sendCallFallback(to: string): Promise<void> {
  if (env.callTemplateName) {
    try {
      // The native phone number is configured in Meta when the template is
      // approved; it must never be passed or exposed in this payload.
      await sendTemplate(to, env.callTemplateName, []);
      console.info("[ACTION] NATIVE CALL TEMPLATE SENT");
      return;
    } catch {
      console.info("[ACTION] NATIVE CALL TEMPLATE UNAVAILABLE — FALLBACK");
    }
  }

  const rawNumber = env.clientPhoneNumber.trim();
  const formattedNumber = rawNumber.startsWith("+") ? rawNumber : `+${rawNumber}`;

  try {
    await sendContact(
      to,
      env.clientName || "Silverstone Developers",
      formattedNumber,
      "Silverstone Developers"
    );
  } catch {
    // Graceful fallback if contact card cannot be dispatched
  }

  await sendText(
    to,
    `📞 *Silverstone Developers Sales Desk*\n\nTap the contact card above or tap the phone number below to open your phone's dial pad directly:\n\n👉 *${formattedNumber}*`
  );
}
