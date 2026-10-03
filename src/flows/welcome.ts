import { getWelcomeContent } from "../content/welcome-service.js";
import { env } from "../config/env.js";
import { buildWelcomeCard } from "../layouts/welcome-card.js";
import { MetaApiRequestError, sendCtaUrl, sendText } from "../meta/messages.js";
import { sendWelcomeTemplate } from "../meta/templates.js";
import { sendImage } from "../meta/media.js";
import { sendMainMenu } from "./main-menu.js";

export type WelcomeFlowDependencies = {
  sendImage: typeof sendImage;
  sendCtaUrl: typeof sendCtaUrl;
  sendText: typeof sendText;
  sendMainMenu: typeof sendMainMenu;
  sendWelcomeTemplate: typeof sendWelcomeTemplate;
};

const defaultDependencies: WelcomeFlowDependencies = {
  sendImage,
  sendCtaUrl,
  sendText,
  sendMainMenu,
  sendWelcomeTemplate
};

export async function sendWelcomeFlow(
  to: string,
  dependencies: WelcomeFlowDependencies = defaultDependencies
): Promise<void> {
  console.info("[FLOW] WELCOME STARTED");
  const card = buildWelcomeCard(getWelcomeContent());

  if (await tryWelcomeTemplate(to, card, dependencies)) {
    return;
  }

  await sendWelcomeFreeform(to, card, dependencies);
}

async function tryWelcomeTemplate(
  to: string,
  card: ReturnType<typeof buildWelcomeCard>,
  dependencies: WelcomeFlowDependencies
): Promise<boolean> {
  if (!env.welcomeTemplateName) {
    console.info("[TEMPLATE] WELCOME TEMPLATE UNAVAILABLE — FALLBACK");
    return false;
  }

  try {
    await dependencies.sendWelcomeTemplate(to, env.welcomeTemplateName, card);
    console.info("[TEMPLATE] WELCOME TEMPLATE SENT");
    return true;
  } catch {
    console.info("[TEMPLATE] WELCOME TEMPLATE UNAVAILABLE — FALLBACK");
    return false;
  }
}

export type LocationHighlightsDependencies = {
  sendText: typeof sendText;
  sendCtaUrl: typeof sendCtaUrl;
};

const defaultLocationHighlightsDependencies: LocationHighlightsDependencies = {
  sendText,
  sendCtaUrl
};

export async function sendLocationHighlights(
  to: string,
  dependencies: LocationHighlightsDependencies = defaultLocationHighlightsDependencies
): Promise<void> {
  const card = buildWelcomeCard(getWelcomeContent());

  if (card.video) {
    const video = card.video;
    await runWelcomeStage(
      "[FLOW] SENDING LOCATION HIGHLIGHTS WITH VIDEO CTA",
      "[FLOW] LOCATION HIGHLIGHTS WITH VIDEO CTA SUCCESS",
      "[FLOW] LOCATION HIGHLIGHTS WITH VIDEO CTA FAILED",
      () => dependencies.sendCtaUrl(to, card.locationHighlightsMessage, "▶ Watch Area Video", video.url)
    );
  } else {
    await runWelcomeStage(
      "[FLOW] SENDING LOCATION HIGHLIGHTS",
      "[FLOW] LOCATION HIGHLIGHTS API SUCCESS",
      "[FLOW] LOCATION HIGHLIGHTS API FAILED",
      () => dependencies.sendText(to, card.locationHighlightsMessage)
    );
  }
}

async function sendWelcomeFreeform(
  to: string,
  card: ReturnType<typeof buildWelcomeCard>,
  dependencies: WelcomeFlowDependencies
): Promise<void> {
  // 1. Welcome banner image sent alone
  if (card.imagePath) {
    await runWelcomeStage(
      "[IMAGE] UPLOAD STARTED",
      "[IMAGE] UPLOAD SUCCESS\n[IMAGE] SEND API SUCCESS",
      "[IMAGE] SEND API FAILED",
      () => dependencies.sendImage(to, card.imagePath)
    );
  }

  // 2. Welcome message card with Open Location CTA button directly attached to the message
  if (card.location) {
    const location = card.location;
    await runWelcomeStage(
      "[FLOW] SENDING WELCOME MESSAGE WITH LOCATION CTA",
      "[FLOW] WELCOME MESSAGE WITH LOCATION CTA SUCCESS",
      "[FLOW] WELCOME MESSAGE WITH LOCATION CTA FAILED",
      () => dependencies.sendCtaUrl(to, card.message, location.buttonText, location.url)
    );
  } else {
    await runWelcomeStage(
      "[FLOW] SENDING WELCOME MESSAGE",
      "[FLOW] WELCOME MESSAGE API SUCCESS",
      "[FLOW] WELCOME MESSAGE API FAILED",
      () => dependencies.sendText(to, card.message)
    );
  }

  // 3. Then auto send location highlight msg, in location highlight msg last add video button
  if (card.video) {
    const video = card.video;
    await runWelcomeStage(
      "[FLOW] SENDING LOCATION HIGHLIGHTS WITH VIDEO CTA",
      "[FLOW] LOCATION HIGHLIGHTS WITH VIDEO CTA SUCCESS",
      "[FLOW] LOCATION HIGHLIGHTS WITH VIDEO CTA FAILED",
      () => dependencies.sendCtaUrl(to, card.locationHighlightsMessage, "▶ Watch Area Video", video.url)
    );
  } else {
    await runWelcomeStage(
      "[FLOW] SENDING LOCATION HIGHLIGHTS",
      "[FLOW] LOCATION HIGHLIGHTS API SUCCESS",
      "[FLOW] LOCATION HIGHLIGHTS API FAILED",
      () => dependencies.sendText(to, card.locationHighlightsMessage)
    );
  }

  // 4. Send Main Menu (View Projects, Chat, Call)
  await runWelcomeStage(
    "[FLOW] SENDING MAIN MENU",
    "[FLOW] MAIN MENU API SUCCESS",
    "[FLOW] MAIN MENU API FAILED",
    () => dependencies.sendMainMenu(to)
  );
}

async function runWelcomeStage(
  sendingLog: string,
  successLog: string,
  failedLog: string,
  operation: () => Promise<unknown>
): Promise<boolean> {
  console.info(sendingLog);

  try {
    await operation();
    console.info(successLog);
    return true;
  } catch (error: unknown) {
    console.info(failedLog);
    logSafeMetaFailure(error);
    return false;
  }
}

function logSafeMetaFailure(error: unknown): void {
  if (error instanceof MetaApiRequestError) {
    console.info(`HTTP STATUS: ${error.httpStatus}`);
    console.info(`META ERROR CODE: ${error.metaErrorCode}`);
    console.info(`META ERROR MESSAGE: ${error.message}`);
    return;
  }

  console.info("HTTP STATUS: UNAVAILABLE");
  console.info("META ERROR CODE: UNAVAILABLE");
  console.info("META ERROR MESSAGE: Welcome flow stage did not receive a Meta API response.");
}
