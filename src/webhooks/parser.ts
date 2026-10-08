export type NormalizedWebhookEvent =
  | {
      type: "TEXT";
      waId: string;
      messageId: string;
      text: string;
      from?: string;
      timestamp?: number;
      profileName?: string;
    }
  | {
      type: "BUTTON_REPLY";
      waId: string;
      messageId: string;
      buttonId: string;
      from?: string;
      timestamp?: number;
      profileName?: string;
    }
  | {
      type: "LIST_REPLY";
      waId: string;
      messageId: string;
      rowId: string;
      from?: string;
      timestamp?: number;
      profileName?: string;
    }
  | {
      type: "STATUS";
      messageId: string;
      status: string;
      recipientId?: string;
      timestamp?: number;
      errorCode?: string;
      errorMessage?: string;
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

  const contactsMap = new Map<string, string>();
  if (Array.isArray(value.contacts)) {
    for (const c of value.contacts) {
      if (isRecord(c) && typeof c.wa_id === "string" && isRecord(c.profile) && typeof c.profile.name === "string") {
        contactsMap.set(c.wa_id, c.profile.name);
      }
    }
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

    const profileName = contactsMap.get(waId);
    const rawTimestamp = message.timestamp;
    const parsedTs =
      typeof rawTimestamp === "string"
        ? parseInt(rawTimestamp, 10)
        : typeof rawTimestamp === "number"
          ? rawTimestamp
          : undefined;
    const timestamp = parsedTs !== undefined && !isNaN(parsedTs) ? parsedTs : undefined;

    const extra: { from?: string; timestamp?: number; profileName?: string } = {};
    if (timestamp !== undefined) extra.timestamp = timestamp;
    if (profileName) extra.profileName = profileName;

    if (message.type === "text" && isRecord(message.text)) {
      const text = stringValue(message.text.body);
      if (text) {
        events.push({ type: "TEXT", waId, messageId, text, ...extra });
      }
      continue;
    }

    if (message.type === "button" && isRecord(message.button)) {
      const buttonId = stringValue(message.button.payload) || stringValue(message.button.text);
      if (buttonId) {
        events.push({ type: "BUTTON_REPLY", waId, messageId, buttonId, ...extra });
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
        events.push({ type: "BUTTON_REPLY", waId, messageId, buttonId, ...extra });
      }
    }

    if (interactiveType === "list_reply" && isRecord(message.interactive.list_reply)) {
      const rowId = stringValue(message.interactive.list_reply.id);
      if (rowId) {
        events.push({ type: "LIST_REPLY", waId, messageId, rowId, ...extra });
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
    if (!messageId || !status) {
      continue;
    }

    const recipientId = stringValue(statusEvent.recipient_id);
    const rawTimestamp = statusEvent.timestamp;
    const parsedTs =
      typeof rawTimestamp === "string"
        ? parseInt(rawTimestamp, 10)
        : typeof rawTimestamp === "number"
          ? rawTimestamp
          : undefined;
    const timestamp = parsedTs !== undefined && !isNaN(parsedTs) ? parsedTs : undefined;

    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    if (Array.isArray(statusEvent.errors) && statusEvent.errors.length > 0 && isRecord(statusEvent.errors[0])) {
      const err = statusEvent.errors[0];
      errorCode = err.code !== undefined ? String(err.code) : undefined;
      errorMessage = stringValue(err.message) || stringValue(err.title);
    }

    const statusObj: NormalizedWebhookEvent = {
      type: "STATUS",
      messageId,
      status,
      ...(recipientId ? { recipientId } : {}),
      ...(timestamp !== undefined ? { timestamp } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(errorMessage ? { errorMessage } : {})
    };
    events.push(statusObj);
  }
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
