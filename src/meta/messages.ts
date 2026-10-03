import axios from "axios";

import { env } from "../config/env.js";
import { createMetaClient } from "./client.js";

type MetaClient = Pick<ReturnType<typeof createMetaClient>, "post">;

type MetaErrorResponse = {
  error?: {
    code?: number;
    message?: string;
  };
};

type SendTextResponse = {
  messages?: Array<{
    id?: string;
  }>;
};

export type SendTextResult = {
  httpStatus: number;
  metaMessageId?: string;
};

export type SendCtaUrlResult = {
  httpStatus: number;
  metaMessageId?: string;
};

export type ReplyButton = {
  id: string;
  title: string;
};

export type ListRow = {
  id: string;
  title: string;
  description?: string;
};

export class MetaApiRequestError extends Error {
  constructor(
    public readonly httpStatus: number | "NO_RESPONSE",
    public readonly metaErrorCode: number | "unavailable",
    message: string
  ) {
    super(message);
    this.name = "MetaApiRequestError";
  }
}

export async function sendText(to: string, text: string): Promise<SendTextResult> {
  try {
    const response = await createMetaClient().post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          body: text
        }
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export async function sendReplyButtons(
  to: string,
  bodyText: string,
  buttons: ReplyButton[],
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  if (buttons.length === 0 || buttons.length > 3) {
    throw new Error("WhatsApp reply buttons require between one and three actions.");
  }

  try {
    const response = await client.post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: bodyText
          },
          action: {
            buttons: buttons.map((button) => ({
              type: "reply",
              reply: button
            }))
          }
        }
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export async function sendList(
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  sectionTitle: string,
  rows: ListRow[],
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  if (rows.length === 0 || rows.length > 10) {
    throw new Error("WhatsApp list messages require between one and ten rows.");
  }

  try {
    const response = await client.post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: headerText },
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: [{ title: sectionTitle, rows }]
          }
        }
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

/**
 * Sends Meta's interactive CTA URL message. The supplied URL is validated but
 * never shortened, rewritten, or included in the visible message body.
 */
export async function sendCtaUrl(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
  client: MetaClient = createMetaClient()
): Promise<SendCtaUrlResult | null> {
  if (!isValidHttpUrl(url)) {
    return null;
  }

  try {
    const response = await client.post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: {
            text: bodyText
          },
          action: {
            name: "cta_url",
            parameters: {
              display_text: buttonText,
              url
            }
          }
        }
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export async function sendLocation(
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  try {
    const response = await client.post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "location",
        location: {
          latitude,
          longitude,
          ...(name ? { name } : {}),
          ...(address ? { address } : {})
        }
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export async function sendVideo(
  to: string,
  videoUrlOrId: string,
  caption?: string,
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  const isUrl = isValidHttpUrl(videoUrlOrId);
  try {
    const response = await client.post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "video",
        video: isUrl
          ? { link: videoUrlOrId, ...(caption ? { caption } : {}) }
          : { id: videoUrlOrId, ...(caption ? { caption } : {}) }
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export async function sendContact(
  to: string,
  formattedName: string,
  phoneNumber: string,
  organization?: string,
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  try {
    const response = await client.post<SendTextResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "contacts",
        contacts: [
          {
            name: {
              formatted_name: formattedName,
              first_name: formattedName
            },
            phones: [
              {
                phone: phoneNumber,
                type: "WORK"
              }
            ],
            ...(organization ? { org: { company: organization } } : {})
          }
        ]
      }
    );

    return {
      httpStatus: response.status,
      metaMessageId: response.data.messages?.[0]?.id
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export const sendListMessage = sendList;

function isValidHttpUrl(url: string): boolean {
  if (!url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function toSafeMetaError(error: unknown): MetaApiRequestError {
  if (!axios.isAxiosError<MetaErrorResponse>(error) || !error.response) {
    return new MetaApiRequestError(
      "NO_RESPONSE",
      "unavailable",
      "No Meta error response was received."
    );
  }

  const { status, data } = error.response;
  const metaCode = data?.error?.code ?? "unavailable";
  const message = data?.error?.message ?? "No Meta error message returned.";

  return new MetaApiRequestError(status, metaCode, message);
}
