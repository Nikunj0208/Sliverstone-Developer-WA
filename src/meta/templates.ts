import type { ProjectCard } from "../layouts/project-card.js";
import type { WelcomeCard } from "../layouts/welcome-card.js";

import { env } from "../config/env.js";
import { createMetaClient } from "./client.js";
import { uploadMedia } from "./media.js";
import { toSafeMetaError, type SendTextResult } from "./messages.js";

type MetaClient = Pick<ReturnType<typeof createMetaClient>, "post">;

type TemplateResponse = {
  messages?: Array<{ id?: string }>;
};

export type TemplateComponent = Record<string, unknown>;

export async function sendTemplate(
  to: string,
  name: string,
  components: TemplateComponent[],
  client: MetaClient = createMetaClient()
): Promise<SendTextResult> {
  try {
    const response = await client.post<TemplateResponse>(
      `/${env.whatsappPhoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name,
          language: { code: "en_US" },
          components
        }
      }
    );

    return { httpStatus: response.status, metaMessageId: response.data.messages?.[0]?.id };
  } catch (error: unknown) {
    throw toSafeMetaError(error);
  }
}

/**
 * Requires an approved template with an image header, one body variable, static
 * Watch Video/Open Location and a native PHONE_NUMBER Call button. The approved
 * template definition must use the configured CLIENT_PHONE_NUMBER; phone buttons
 * do not accept a runtime message parameter. Quick replies are at indices 3 and 4.
 */
export async function sendWelcomeTemplate(
  to: string,
  templateName: string,
  card: WelcomeCard
): Promise<SendTextResult> {
  if (!card.video || !card.location) {
    throw new Error("Welcome template requires configured video and location URLs.");
  }

  const mediaId = await uploadMedia(card.imagePath);
  return sendTemplate(to, templateName, [
    {
      type: "header",
      parameters: [{ type: "image", image: { id: mediaId } }]
    },
    {
      type: "body",
      parameters: [{ type: "text", text: card.message }]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "3",
      parameters: [{ type: "payload", payload: "MAIN_CHAT" }]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "4",
      parameters: [{ type: "payload", payload: "MAIN_VIEW_PROJECTS" }]
    }
  ]);
}

export function buildProjectTemplateComponents(card: ProjectCard): TemplateComponent[] {
  if (!card.imagePath || !card.description || !card.location || !card.video || !card.brochurePath) {
    throw new Error("Project template requires image, description, location, video, and brochure.");
  }

  return [
    {
      type: "body",
      parameters: [{ type: "text", text: card.description }]
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: card.location.url }]
    },
    {
      type: "button",
      sub_type: "url",
      index: "1",
      parameters: [{ type: "text", text: card.video.url }]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "2",
      parameters: [{ type: "payload", payload: `DOWNLOAD_BROCHURE:${card.id}` }]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "3",
      parameters: [{ type: "payload", payload: "MAIN_CHAT" }]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "4",
      parameters: [{ type: "payload", payload: `BOOK_SITE_VISIT:${card.id}` }]
    },
    {
      type: "button",
      sub_type: "quick_reply",
      index: "5",
      parameters: [{ type: "payload", payload: "MAIN_VIEW_PROJECTS" }]
    }
  ];
}

export async function sendProjectTemplate(
  to: string,
  templateName: string,
  card: ProjectCard
): Promise<SendTextResult> {
  const components = buildProjectTemplateComponents(card);
  const mediaId = await uploadMedia(card.imagePath);
  components.unshift({
    type: "header",
    parameters: [{ type: "image", image: { id: mediaId } }]
  });
  return sendTemplate(to, templateName, components);
}
