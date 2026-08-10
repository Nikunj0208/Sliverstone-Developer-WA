export type TextMessage = {
  to: string;
  body: string;
};

/**
 * Reserved for a later milestone. This project intentionally does not send
 * WhatsApp messages yet.
 */
export function sendTextMessage(_message: TextMessage): never {
  throw new Error("WhatsApp message sending is not implemented in Milestone 1.");
}
