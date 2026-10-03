export type NormalizedWebhookEvent =
  | {
      type: "TEXT";
      waId: string;
      messageId: string;
      text: string;
    }
  | {
      type: "BUTTON_REPLY";
      waId: string;
      messageId: string;
      buttonId: string;
    }
  | {
      type: "LIST_REPLY";
      waId: string;
      messageId: string;
      rowId: string;
    }
  | {
      type: "STATUS";
      messageId: string;
      status: string;
    };

type RecordValue = Record<string, unknown>;

export function parseWebhookEvents(payload: unknown): NormalizedWebhookEvent[] {
  if (!isRecord(payload) || !Array.isArray(payload.entry)) {
    return [];
  }

  const events: NormalizedWebhookEvent[] = [];

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) {
      continue;
    }

    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) {
        continue;
      }

      parseMessages(change.value, events);
      parseStatuses(change.value, events);
    }
  }

  return events;
}

function parseMessages(value: RecordValue, events: NormalizedWebhookEvent[]): void {
  if (!Array.isArray(value.messages)) {
    return;
  }

  for (const message of value.messages) {
    if (!isRecord(message)) {
      continue;
    }

    const waId = stringValue(message.from);
    const messageId = stringValue(message.id);
    if (!waId || !messageId) {
      continue;
    }

    if (message.type === "text" && isRecord(message.text)) {
      const text = stringValue(message.text.body);
      if (text) {
        events.push({ type: "TEXT", waId, messageId, text });
      }
      continue;
    }

    if (message.type === "button" && isRecord(message.button)) {
      const buttonId = stringValue(message.button.payload) || stringValue(message.button.text);
      if (buttonId) {
        events.push({ type: "BUTTON_REPLY", waId, messageId, buttonId });
      }
      continue;
    }

    if (message.type !== "interactive" || !isRecord(message.interactive)) {
      continue;
    }

    const interactiveType = message.interactive.type;
    if (interactiveType === "button_reply" && isRecord(message.interactive.button_reply)) {
      const buttonId = stringValue(message.interactive.button_reply.id);
      if (buttonId) {
        events.push({ type: "BUTTON_REPLY", waId, messageId, buttonId });
      }
    }

    if (interactiveType === "list_reply" && isRecord(message.interactive.list_reply)) {
      const rowId = stringValue(message.interactive.list_reply.id);
      if (rowId) {
        events.push({ type: "LIST_REPLY", waId, messageId, rowId });
      }
    }
  }
}

function parseStatuses(value: RecordValue, events: NormalizedWebhookEvent[]): void {
  if (!Array.isArray(value.statuses)) {
    return;
  }

  for (const statusEvent of value.statuses) {
    if (!isRecord(statusEvent)) {
      continue;
    }

    const messageId = stringValue(statusEvent.id);
    const status = stringValue(statusEvent.status);
    if (messageId && status) {
      events.push({ type: "STATUS", messageId, status });
    }
  }
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
