import axios from "axios";

import { env } from "../config/env.js";
import { createMetaClient } from "./client.js";

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

function toSafeMetaError(error: unknown): MetaApiRequestError {
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
