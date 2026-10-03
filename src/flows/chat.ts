import { env } from "../config/env.js";
import { sendCtaUrl } from "../meta/messages.js";
import { markChatHandoff } from "./conversation-state.js";

export function salesTeamChatUrl(): string {
  const digits = env.clientPhoneNumber.replace(/\D/g, "");
  if (digits.length < 8) {
    throw new Error("Configured sales chat number is invalid.");
  }

  return `https://wa.me/${digits}`;
}

export async function sendChat(to: string): Promise<void> {
  markChatHandoff(to);
  console.info("[HANDOFF] CHAT MARKED FOR FUTURE HUMAN HANDLING");
  const result = await sendCtaUrl(to, "Chat", "Chat", salesTeamChatUrl());
  if (!result) {
    throw new Error("Configured chat link is invalid.");
  }
}
