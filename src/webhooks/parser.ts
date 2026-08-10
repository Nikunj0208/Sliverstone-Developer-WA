export type WebhookEvent = {
  object?: string;
  entry?: unknown[];
};

export function parseWebhookEvent(payload: unknown): WebhookEvent | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const event = payload as Record<string, unknown>;
  return {
    object: typeof event.object === "string" ? event.object : undefined,
    entry: Array.isArray(event.entry) ? event.entry : undefined
  };
}
