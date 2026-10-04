import { env } from "../config/env.js";
import { sendContact, sendCtaUrl, sendText } from "../meta/messages.js";
import { sendTemplate } from "../meta/templates.js";

export const CALL_PHONE_NUMBER = "918866751322";

export async function sendCallFallback(to: string): Promise<void> {
  const callTemplate = env.callTemplateName || "silverstone_call";
  try {
    // The native phone number is configured in Meta when the template is
    // approved; tapping it directly triggers the Android/iOS "Open with" dialer sheet.
    await sendTemplate(to, callTemplate, []);
    console.info("[ACTION] NATIVE CALL TEMPLATE SENT");
    return;
  } catch {
    console.info("[ACTION] NATIVE CALL TEMPLATE UNAVAILABLE — FALLBACK");
  }

  const rawNumber = env.clientPhoneNumber && env.clientPhoneNumber !== "918866752222"
    ? env.clientPhoneNumber.trim()
    : CALL_PHONE_NUMBER;
  const formattedNumber = rawNumber.startsWith("+") ? rawNumber : `+${rawNumber}`;

  // Interactive Call Button: Redirects directly to tel: intent for "Open with" dialer
  const callUrl = "https://sliverstone-developer-wa1.onrender.com/call";
  try {
    const ctaSent = await sendCtaUrl(
      to,
      `📞 *Silverstone Developers Sales Desk*\n\nTap *Call Now* below to connect directly with our sales team:`,
      "Call Now",
      callUrl
    );
    if (ctaSent) {
      console.info("[ACTION] CALL CTA URL BUTTON SENT");
      return;
    }
  } catch {
    // Graceful fallback if CTA URL message fails
  }

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
