import { env } from "../config/env.js";
import { sendCtaUrl } from "../meta/messages.js";
import { markChatHandoff } from "./conversation-state.js";

export const CHAT_WHATSAPP_NUMBER = "918866751322";

export function salesTeamChatUrl(): string {
  const digits = (env.clientPhoneNumber || CHAT_WHATSAPP_NUMBER).replace(/\D/g, "");
  const chatDigits = digits && digits !== "918866752222" ? digits : CHAT_WHATSAPP_NUMBER;
  if (chatDigits.length < 8) {
    throw new Error("Configured sales chat number is invalid.");
  }

  return `https://wa.me/${chatDigits}`;
}

export async function sendChat(to: string): Promise<void> {
  markChatHandoff(to);
  console.info("[HANDOFF] CHAT MARKED FOR FUTURE HUMAN HANDLING");
  const result = await sendCtaUrl(to, "Chat", "Chat", salesTeamChatUrl());
  if (!result) {
    throw new Error("Configured chat link is invalid.");
  }
}
