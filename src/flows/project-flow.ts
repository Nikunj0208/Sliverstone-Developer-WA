import { existsSync } from "node:fs";

import {
  type ProjectContent,
  getProject,
  getActiveProjects,
  getBrochure,
  getSquareFeetOptions,
  hasProjectPlans,
  getBhkOptions,
  getPlan
} from "../content/project-service.js";
import {
  MetaApiRequestError,
  sendText,
  sendLocation,
  sendVideo,
  sendReplyButtons,
  sendList,
  sendCtaUrl,
  type ReplyButton,
  type ListRow
} from "../meta/messages.js";
import { sendImage, sendDocument } from "../meta/media.js";
import { setConversationState, getConversationState } from "./conversation-state.js";
import { showMainWelcomeMenu } from "./main-menu.js";
import { sendChat } from "./chat.js";
import { sendCallFallback } from "./call.js";
import { sendProjectList } from "./projects.js";
import { analyticsService } from "../services/analytics-service.js";

export type ProjectFlowDependencies = {
  sendImage: typeof sendImage;
  sendText: typeof sendText;
  sendLocation: typeof sendLocation;
  sendVideo: typeof sendVideo;
  sendDocument: typeof sendDocument;
  sendReplyButtons: typeof sendReplyButtons;
  sendList: typeof sendList;
  showMainWelcomeMenu: typeof showMainWelcomeMenu;
  handleChat: (to: string) => Promise<void>;
  handleCall: (to: string) => Promise<void>;
  sendProjectList: typeof sendProjectList;
  sendCtaUrl?: typeof sendCtaUrl;
};

export const defaultProjectFlowDependencies: ProjectFlowDependencies = {
  sendImage,
  sendText,
  sendLocation,
  sendVideo,
  sendDocument,
  sendReplyButtons,
  sendList,
  showMainWelcomeMenu,
  handleChat: sendChat,
  handleCall: sendCallFallback,
  sendProjectList,
  sendCtaUrl
};

const recentUserActions = new Map<string, { actionKey: string; timestamp: number }>();

export function isDuplicateAction(waId: string, actionKey: string, cooldownMs = 2000): boolean {
  const now = Date.now();
  const last = recentUserActions.get(waId);
  if (last && last.actionKey === actionKey && now - last.timestamp < cooldownMs) {
    return true;
  }
  recentUserActions.set(waId, { actionKey, timestamp: now });
  return false;
}

export function logSafeMetaFailure(context: string, error: unknown): void {
  if (error instanceof MetaApiRequestError) {
    console.info(`[ERROR] ${context} - HTTP STATUS: ${error.httpStatus}`);
    console.info(`[ERROR] ${context} - META ERROR CODE: ${error.metaErrorCode}`);
    console.info(`[ERROR] ${context} - META ERROR MESSAGE: ${error.message}`);
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown error occurred.";
  console.info(`[ERROR] ${context} - ${message}`);
}

/**
 * MESSAGE 1: Send Project Image
 */
export async function sendProjectImage(
  to: string,
  project: ProjectContent,
  send: typeof sendImage = sendImage,
  caption?: string
): Promise<boolean> {
  const imagePath = project.mainImage || project.imagePath;
  if (!imagePath || !existsSync(imagePath)) {
    console.info(`[PROJECT] Image missing for ${project.id}`);
    return false;
  }

  try {
    await send(to, imagePath, caption);
    return true;
  } catch (error: unknown) {
    logSafeMetaFailure(`Project image for ${project.name}`, error);
    return false;
  }
}

/**
 * MESSAGE 2: Send Project Description
 */
export async function sendProjectDescription(
  to: string,
  project: ProjectContent,
  send: typeof sendText = sendText
): Promise<boolean> {
  if (!project.description || !project.description.trim()) {
    console.info(`[PROJECT] Description missing for ${project.id}`);
    return false;
  }

  try {
    await send(to, project.description);
    return true;
  } catch (error: unknown) {
    logSafeMetaFailure(`Project description for ${project.name}`, error);
    return false;
  }
}

/**
 * MESSAGE 3: Send Project Location
 */
export async function sendProjectLocation(
  to: string,
  project: ProjectContent,
  sendLoc: typeof sendLocation = sendLocation,
  sendTxt: typeof sendText = sendText,
  sendCta?: typeof sendCtaUrl
): Promise<boolean> {
  if (project.location && "latitude" in project.location && "longitude" in project.location) {
    const loc = project.location as { latitude?: string; longitude?: string; name?: string; address?: string };
    const lat = loc.latitude ? parseFloat(loc.latitude) : NaN;
    const lng = loc.longitude ? parseFloat(loc.longitude) : NaN;
    if (!isNaN(lat) && !isNaN(lng)) {
      try {
        await sendLoc(to, lat, lng, loc.name, loc.address);
        return true;
      } catch (error: unknown) {
        logSafeMetaFailure(`Native location for ${project.name}`, error);
      }
    }
  }

  const locationUrl = project.location?.googleMapsUrl || project.locationUrl || project.links?.location;
  if (locationUrl && isValidHttpUrl(locationUrl)) {
    try {
      if (sendCta) {
        const result = await sendCta(to, `📍 Project Location`, "Open Location", locationUrl);
        if (result) return true;
      }
      await sendTxt(to, `📍 Location:\n${locationUrl}`);
      return true;
    } catch (error: unknown) {
      logSafeMetaFailure(`Location URL for ${project.name}`, error);
      return false;
    }
  }

  console.info(`[PROJECT] Location missing for ${project.id}`);
  return false;
}

/**
 * MESSAGE 4: Send Project Video
 */
export async function sendProjectVideo(
  to: string,
  project: ProjectContent,
  sendVid: typeof sendVideo = sendVideo,
  sendTxt: typeof sendText = sendText,
  sendCta?: typeof sendCtaUrl
): Promise<boolean> {
  if (project.video && "file" in project.video && typeof project.video.file === "string" && project.video.file) {
    if (existsSync(project.video.file)) {
      try {
        await sendVid(to, project.video.file, project.video.caption);
        return true;
      } catch (error: unknown) {
        logSafeMetaFailure(`Video file for ${project.name}`, error);
      }
    }
  }

  const videoUrl = project.video?.shortUrl || project.video?.url || project.videoUrl || project.links?.video;
  if (videoUrl && isValidHttpUrl(videoUrl)) {
    try {
      if (sendCta) {
        const result = await sendCta(to, `▶ Project Video`, "Watch Video", videoUrl);
        if (result) return true;
      }
      await sendTxt(to, `🎥 Project Video:\n${videoUrl}`);
      return true;
    } catch (error: unknown) {
      logSafeMetaFailure(`Video link for ${project.name}`, error);
      return false;
    }
  }

  console.info(`[PROJECT] Video missing for ${project.id}`);
  return false;
}

/**
 * MESSAGE 5: Send Short Links
 */
export async function sendProjectLinks(
  to: string,
  project: ProjectContent,
  sendTxt: typeof sendText = sendText,
  sendCta?: typeof sendCtaUrl
): Promise<boolean> {
  const links = project.links as Record<string, string | undefined> | undefined;
  const websiteUrl = links?.website;

  if (sendCta) {
    if (websiteUrl && isValidHttpUrl(websiteUrl)) {
      try {
        await sendCta(to, `🌐 Project Website`, "Visit Website", websiteUrl);
        return true;
      } catch (error: unknown) {
        logSafeMetaFailure(`Website link for ${project.name}`, error);
        return false;
      }
    }
    return false;
  }

  const lines: string[] = [];
  const videoUrl = links?.video || project.video?.shortUrl || project.video?.url || project.videoUrl;
  const locationUrl = links?.location || project.location?.googleMapsUrl || project.locationUrl;

  if (videoUrl && isValidHttpUrl(videoUrl)) {
    lines.push(`🎥 Project Video:\n${videoUrl}`);
  }
  if (locationUrl && isValidHttpUrl(locationUrl)) {
    lines.push(`📍 Project Location:\n${locationUrl}`);
  }
  if (websiteUrl && isValidHttpUrl(websiteUrl)) {
    lines.push(`🌐 Website:\n${websiteUrl}`);
  }

  if (lines.length === 0) {
    return false;
  }

  try {
    await sendTxt(to, lines.join("\n\n"));
    return true;
  } catch (error: unknown) {
    logSafeMetaFailure(`Project links for ${project.name}`, error);
    return false;
  }
}

const lastViewedProject = new Map<string, string>();

/**
 * MESSAGE 6: Send Project Action Buttons (Download Brochure, View Plans)
 */
export async function sendProjectActionButtons(
  to: string,
  project: ProjectContent,
  sendButtons: typeof sendReplyButtons = sendReplyButtons
): Promise<boolean> {
  const buttons: ReplyButton[] = [
    { id: "PROJECT_BROCHURE", title: "Download Brochure" }
  ];

  if (hasProjectPlans(project.id)) {
    buttons.push({ id: "PROJECT_PLANS", title: "View Plans" });
  }

  try {
    await sendButtons(to, `Explore options for ${project.name}:`, buttons);
    lastViewedProject.set(to, project.id);
    setConversationState(to, "PROJECT_ACTIONS", { projectId: project.id });
    return true;
  } catch (error: unknown) {
    logSafeMetaFailure(`Project action buttons for ${project.name}`, error);
    return false;
  }
}

/**
 * Sends the full 6-message sequence for a project
 */
export async function sendProjectInfoSequence(
  to: string,
  project: ProjectContent,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  lastViewedProject.set(to, project.id);
  setConversationState(to, "PROJECT_INFO", { projectId: project.id });

  // MESSAGE 1: Send Image with Description attached as caption (Single standalone card in one go)
  const imageSent = await sendProjectImage(to, project, dependencies.sendImage, project.description);

  // If image was missing or failed, send description as standalone text fallback
  if (!imageSent) {
    await sendProjectDescription(to, project, dependencies.sendText);
  }

  // MESSAGE 3: Location (Uses native action button if sendCtaUrl is available)
  await sendProjectLocation(to, project, dependencies.sendLocation, dependencies.sendText, dependencies.sendCtaUrl);

  // MESSAGE 4: Video (Uses native action button if sendCtaUrl is available)
  await sendProjectVideo(to, project, dependencies.sendVideo, dependencies.sendText, dependencies.sendCtaUrl);

  // MESSAGE 5: Short links
  await sendProjectLinks(to, project, dependencies.sendText, dependencies.sendCtaUrl);

  // MESSAGE 6: Action buttons
  await sendProjectActionButtons(to, project, dependencies.sendReplyButtons);

  return true;
}

/**
 * Handles PROJECT:<project-id> selection
 */
export async function handleProjectSelection(
  to: string,
  projectId: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  if (isDuplicateAction(to, `PROJECT:${projectId}`)) {
    console.info(`[PROJECT] Duplicate selection ignored for ${projectId}`);
    return true;
  }

  const project = getProject(projectId);
  if (!project || !project.active) {
    console.info(`[PROJECT] Unknown or inactive project: ${projectId}`);
    await dependencies.sendText(
      to,
      "Project details are currently unavailable. Please choose another project or contact our sales team."
    );
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  lastViewedProject.set(to, project.id);
  console.info(`[PROJECT] Selected: ${project.name} (${project.id})`);
  analyticsService.recordEventByWaId(to, "PROJECT_SELECTED", project.id, project.id).catch(() => {});
  return sendProjectInfoSequence(to, project, dependencies);
}

/**
 * Handles PROJECT_BROCHURE action
 */
export async function handleProjectBrochure(
  to: string,
  projectId?: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  const targetProjectId = projectId || getConversationState(to)?.projectId || lastViewedProject.get(to);
  if (!targetProjectId) {
    console.info("[BROCHURE] No project selected in state");
    await dependencies.sendText(to, "Brochure is currently unavailable. Please contact our sales team.");
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  analyticsService.recordEventByWaId(to, "BROCHURE_REQUESTED", targetProjectId, targetProjectId).catch(() => {});

  if (isDuplicateAction(to, `BROCHURE:${targetProjectId}`)) {
    console.info(`[BROCHURE] Duplicate request ignored for ${targetProjectId}`);
    return true;
  }

  const project = getProject(targetProjectId);
  const brochure = getBrochure(targetProjectId);

  if (!project || !brochure || !brochure.file || !existsSync(brochure.file)) {
    console.info(`[BROCHURE] Brochure missing or unmapped for ${targetProjectId}`);
    await dependencies.sendText(to, "Brochure is currently unavailable. Please contact our sales team.");
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  console.info(`[BROCHURE] SEND STARTED for ${project.name}`);
  try {
    await dependencies.sendDocument(to, brochure.file, brochure.filename);
    console.info(`[BROCHURE] SEND SUCCESS for ${project.name}`);
    analyticsService.recordEventByWaId(to, "BROCHURE_SENT", brochure.filename, project.id).catch(() => {});
    setConversationState(to, "BROCHURE_SENT", { projectId: project.id });
    await dependencies.sendText(to, "Here are the main options again.");
    await dependencies.showMainWelcomeMenu(to);
    return true;
  } catch (error: unknown) {
    logSafeMetaFailure(`Brochure delivery for ${project.name}`, error);
    await dependencies.sendText(to, "Brochure delivery could not be completed. Please contact our sales team.");
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }
}

/**
 * Sends square-feet options (Reply buttons if <= 3, list if > 3)
 */
export async function sendSquareFeetOptions(
  to: string,
  project: ProjectContent,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  const options = getSquareFeetOptions(project.id);
  if (!options || options.length === 0) {
    console.info(`[PLANS] No square feet options configured for ${project.id}`);
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  lastViewedProject.set(to, project.id);
  setConversationState(to, "SELECT_SQFT", { projectId: project.id });

  if (options.length <= 3) {
    const buttons: ReplyButton[] = options.map((opt) => ({
      id: `PLAN_SQFT:${project.id}:${opt.id}`,
      title: opt.label.slice(0, 20)
    }));
    await dependencies.sendReplyButtons(to, `Choose a plan for ${project.name}:`, buttons);
    return true;
  }

  const rows: ListRow[] = options.map((opt) => ({
    id: `PLAN_SQFT:${project.id}:${opt.id}`,
    title: opt.label.slice(0, 24)
  }));
  await dependencies.sendList(
    to,
    "Choose Plan",
    `Select a plan for ${project.name}:`,
    "View Plans",
    "Floor Plans",
    rows
  );
  return true;
}

/**
 * Handles PROJECT_PLANS action
 */
export async function handleProjectPlans(
  to: string,
  projectId?: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  const targetProjectId = projectId || getConversationState(to)?.projectId || lastViewedProject.get(to);
  if (!targetProjectId) {
    console.info("[PLANS] No project selected in state, prompting choice");
    const activeWithPlans = getActiveProjects().filter((p) => hasProjectPlans(p.id));
    if (activeWithPlans.length > 0) {
      await dependencies.sendReplyButtons(
        to,
        "Select a project to view its plans:",
        activeWithPlans.slice(0, 3).map((p) => ({
          id: `PROJECT_PLANS:${p.id}`,
          title: p.name.slice(0, 20)
        }))
      );
      return true;
    }
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  const project = getProject(targetProjectId);
  if (!project || !hasProjectPlans(project.id)) {
    console.info(`[PLANS] Plans unavailable for ${targetProjectId}`);
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  lastViewedProject.set(to, project.id);
  console.info(`[PLANS] Requested for ${project.name}`);
  analyticsService.recordEventByWaId(to, "PLANS_REQUESTED", targetProjectId, targetProjectId).catch(() => {});
  return sendSquareFeetOptions(to, project, dependencies);
}

/**
 * Sends BHK options (3 BHK, 4 BHK, 5 BHK) for the selected square-foot option
 */
export async function sendBhkOptions(
  to: string,
  project: ProjectContent,
  sqftId: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  const bhkOptions = getBhkOptions(project.id, sqftId);

  // Show only up to 3 BHK options as reply buttons
  const availableBhk = bhkOptions.length > 0 ? bhkOptions.slice(0, 3) : [];
  if (availableBhk.length === 0) {
    console.info(`[PLANS] No BHK options found for ${project.id} ${sqftId}`);
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  setConversationState(to, "SELECT_BHK", { projectId: project.id, squareFeetId: sqftId });

  const buttons: ReplyButton[] = availableBhk.map((item) => ({
    id: `PLAN_BHK:${project.id}:${sqftId}:${item.id.toUpperCase()}`,
    title: item.label.slice(0, 20)
  }));

  await dependencies.sendReplyButtons(to, `Choose BHK Option for ${project.name}:`, buttons);
  return true;
}

/**
 * Handles PLAN_SQFT:<project-id>:<sqft-id> selection
 */
export async function handleSquareFeetSelection(
  to: string,
  projectId: string,
  sqftId: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  const project = getProject(projectId);
  if (!project) {
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }

  lastViewedProject.set(to, project.id);
  analyticsService.recordEventByWaId(to, "SQFT_SELECTED", sqftId, project.id).catch(() => {});

  if (isDuplicateAction(to, `PLAN_SQFT:${projectId}:${sqftId}`)) {
    console.info(`[PLANS] Duplicate sqft selection ignored for ${projectId}:${sqftId}`);
    return true;
  }

  // Direct delivery for Mahal and Rajmahal (bungalow plots with given plan files)
  if (projectId === "mahal" || projectId === "rajmahal") {
    const bhkOptions = getBhkOptions(projectId, sqftId);
    if (bhkOptions.length === 1) {
      return handleBhkSelection(to, projectId, sqftId, bhkOptions[0].id, dependencies);
    }
  }

  console.info(`[PLANS] SqFt selected: ${sqftId} for ${project.name}`);
  return sendBhkOptions(to, project, sqftId, dependencies);
}

/**
 * Handles PLAN_BHK:<project-id>:<sqft-id>:<bhk> selection and PDF delivery
 */
export async function handleBhkSelection(
  to: string,
  projectId: string,
  sqftId: string,
  bhk: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  analyticsService.recordEventByWaId(to, "BHK_SELECTED", bhk, projectId).catch(() => {});

  if (isDuplicateAction(to, `PLAN_BHK:${projectId}:${sqftId}:${bhk}`)) {
    console.info(`[PLANS] Duplicate BHK selection ignored for ${projectId}:${sqftId}:${bhk}`);
    return true;
  }

  const project = getProject(projectId);
  const plan = getPlan(projectId, sqftId, bhk);

  if (!project) {
    return false;
  }

  if (!plan || !plan.file || !existsSync(plan.file)) {
    console.info(`[PLANS] Floor plan file missing on disk for ${projectId} ${sqftId} ${bhk}`);
    await dependencies.showMainWelcomeMenu(to);
    return true;
  }

  console.info(`[PLANS] SENDING FLOOR PLAN: ${plan.filename}`);
  try {
    try {
      await dependencies.sendDocument(to, plan.file, plan.filename);
    } catch (docErr) {
      console.warn(`[PLANS] sendDocument failed for ${plan.filename}, falling back to sendImage:`, docErr);
      await dependencies.sendImage(to, plan.file, plan.filename);
    }
    console.info(`[PLANS] SEND SUCCESS: ${plan.filename}`);
    analyticsService.recordEventByWaId(to, "PLAN_SENT", plan.filename, project.id).catch(() => {});
    setConversationState(to, "PLAN_SENT", { projectId: project.id, squareFeetId: sqftId, bhk });
    await dependencies.showMainWelcomeMenu(to);
    return true;
  } catch (error: unknown) {
    logSafeMetaFailure(`Floor plan delivery for ${plan.filename}`, error);
    await dependencies.showMainWelcomeMenu(to);
    return false;
  }
}

/**
 * Handles Main Menu Actions: MAIN_VIEW_PROJECTS, MAIN_CHAT, MAIN_CALL
 */
export async function handleMainMenuAction(
  to: string,
  actionId: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  switch (actionId) {
    case "MAIN_VIEW_PROJECTS":
      console.info("[ACTION] MAIN_VIEW_PROJECTS");
      setConversationState(to, "PROJECT_LIST");
      analyticsService.recordEventByWaId(to, "VIEW_PROJECTS_CLICKED").catch(() => {});
      await dependencies.sendProjectList(to);
      return true;
    case "MAIN_CHAT":
      console.info("[ACTION] MAIN_CHAT");
      setConversationState(to, "CHAT");
      analyticsService.recordEventByWaId(to, "CHAT_REQUESTED").catch(() => {});
      await dependencies.handleChat(to);
      return true;
    case "MAIN_CALL":
      console.info("[ACTION] MAIN_CALL");
      setConversationState(to, "CALL");
      analyticsService.recordEventByWaId(to, "CALL_REQUESTED").catch(() => {});
      await dependencies.handleCall(to);
      return true;
    default:
      return false;
  }
}

/**
 * Handles Project Actions: PROJECT_BROCHURE, PROJECT_PLANS
 */
export async function handleProjectAction(
  to: string,
  actionId: string,
  dependencies: ProjectFlowDependencies = defaultProjectFlowDependencies
): Promise<boolean> {
  if (actionId === "PROJECT_BROCHURE" || actionId.startsWith("PROJECT_BROCHURE:")) {
    const projectId = actionId.startsWith("PROJECT_BROCHURE:") ? actionId.slice("PROJECT_BROCHURE:".length) : undefined;
    return handleProjectBrochure(to, projectId, dependencies);
  }

  if (actionId === "PROJECT_PLANS" || actionId.startsWith("PROJECT_PLANS:")) {
    const projectId = actionId.startsWith("PROJECT_PLANS:") ? actionId.slice("PROJECT_PLANS:".length) : undefined;
    return handleProjectPlans(to, projectId, dependencies);
  }

  return false;
}

function isValidHttpUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
