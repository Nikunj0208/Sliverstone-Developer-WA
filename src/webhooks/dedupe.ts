const processedMessageIds = new Map<string, number>();
const messageTtlMs = 10 * 60 * 1000;

/** Returns true only for the first delivery of an inbound WhatsApp message ID. */
export function acceptIncomingMessage(messageId: string, now = Date.now()): boolean {
  for (const [id, receivedAt] of processedMessageIds) {
    if (now - receivedAt > messageTtlMs) {
      processedMessageIds.delete(id);
    }
  }

  if (processedMessageIds.has(messageId)) {
    return false;
  }

  processedMessageIds.set(messageId, now);
  return true;
}
