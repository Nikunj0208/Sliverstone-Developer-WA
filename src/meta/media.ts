import { basename, extname } from "node:path";
import { readFile } from "node:fs/promises";

import { env } from "../config/env.js";
import { createMetaClient } from "./client.js";
import { toSafeMetaError, type SendTextResult } from "./messages.js";

type MetaClient = Pick<ReturnType<typeof createMetaClient>, "post">;

type MediaUploadResponse = {
  id?: string;
};

const mediaMimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp"
};

const mediaCache = new Map<string, string>();

export async function sendImage(
  to: string,
  imagePath: string,
  caption?: string,
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  if (caption && caption.length > 1_024) {
    throw new Error("WhatsApp image captions must not exceed 1,024 characters.");
  }

  const mediaId = await uploadMedia(imagePath, client);
  return sendMediaMessage(to, "image", { id: mediaId, ...(caption ? { caption } : {}) }, client);
}

export async function sendDocument(
  to: string,
  documentPath: string,
  filename: string,
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  const mediaId = await uploadMedia(documentPath, client);
  return sendMediaMessage(to, "document", { id: mediaId, filename }, client);
}

export async function uploadMedia(
  filePath: string,
  client: MetaClient = createMetaClient()
): Promise<string> {
  const cached = mediaCache.get(filePath);
  if (cached) {
    return cached;
  }

  const mimeType = mediaMimeTypes[extname(filePath).toLowerCase()];
  if (!mimeType) {
    throw new Error("Unsupported local media type.");
  }

  const file = await readFile(filePath);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([file], { type: mimeType }), basename(filePath));

  try {
    const response = await client.post<MediaUploadResponse>(
      `/${env.whatsappPhoneNumberId}/media`,
      form,
      {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    );
    if (!response.data.id) {
      throw new Error("Meta did not return a media ID.");
    }

    mediaCache.set(filePath, response.data.id);
    return response.data.id;
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

export const uploadImage = uploadMedia;
export const uploadDocument = uploadMedia;
export const uploadVideo = uploadMedia;

import { analyticsService } from "../services/analytics-service.js";

async function sendMediaMessage(
  to: string,
  type: "image" | "document",
  media: { id: string; filename?: string; caption?: string },
  client: MetaClient
): Promise<SendTextResult> {
  try {
    const response = await client.post<{ messages?: Array<{ id?: string }> }>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type,
        [type]: media
      }
    );

    const metaMessageId = response.data.messages?.[0]?.id;
    if (metaMessageId) {
      await analyticsService.trackOutboundMessage({
        to,
        waMessageId: metaMessageId,
        messageType: type,
        bodyText: media.filename || media.caption,
        mediaId: media.id
      });
    }

    return {
      httpStatus: response.status,
      metaMessageId
    };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}
