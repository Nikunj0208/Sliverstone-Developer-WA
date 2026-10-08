import {
  MetaApiRequestError,
  sendCtaUrl,
  sendList,
  sendReplyButtons,
  sendText,
  type ReplyButton
} from "../meta/messages.js";
import { sendDocument, sendImage } from "../meta/media.js";
import { getActiveProjects, getProject, type ProjectContent } from "../content/project-service.js";
import { env } from "../config/env.js";
import { buildProjectCard } from "../layouts/project-card.js";
import { buildProjectList } from "../layouts/project-list.js";
import { sendProjectTemplate } from "../meta/templates.js";
import { analyticsService } from "../services/analytics-service.js";

function nextActions(projectId: string): ReplyButton[] {
  return [
    { id: "MAIN_VIEW_PROJECTS", title: "View Projects" },
    { id: "MAIN_CHAT", title: "Chat" },
    { id: `BOOK_SITE_VISIT:${projectId}`, title: "Book Site Visit" }
  ];
}

function rajmahalPrimaryActions(hasAvailableBuildPlans: boolean): ReplyButton[] {
  return [
    { id: "DOWNLOAD_BROCHURE:rajmahel", title: "📄 Brochure" },
    ...(hasAvailableBuildPlans ? [{ id: "BUILD_PLAN:rajmahel", title: "🏗 Build Plan" }] : []),
    { id: "MAIN_CHAT", title: "💬 Chat" }
  ];
}

const rajmahalCallAction: ReplyButton[] = [{ id: "MAIN_CALL", title: "📞 Call" }];

function springHillPrimaryActions(hasAvailableBuildPlans: boolean): ReplyButton[] {
  return [
    { id: "DOWNLOAD_BROCHURE:spring-hill", title: "📄 Brochure" },
    ...(hasAvailableBuildPlans ? [{ id: "BUILD_PLAN:spring-hill", title: "🏗 Build Plan" }] : []),
    { id: "MAIN_CHAT", title: "💬 Chat" }
  ];
}

const springHillCallAction: ReplyButton[] = [{ id: "MAIN_CALL", title: "📞 Call" }];

export async function sendProjectList(to: string): Promise<void> {
  const projects = getActiveProjects();
  await sendList(
    to,
    "Our Projects",
    "Choose a project to explore.",
    "View Projects",
    "Projects",
    buildProjectList(projects)
  );
}

export type ProjectDetailsDependencies = {
  sendImage: typeof sendImage;
  sendText: typeof sendText;
  sendCtaUrl: typeof sendCtaUrl;
  sendDocument: typeof sendDocument;
  sendReplyButtons: typeof sendReplyButtons;
  sendProjectTemplate: typeof sendProjectTemplate;
  logMissing: (projectId: string, contentType: string) => void;
};

const defaultDependencies: ProjectDetailsDependencies = {
  sendImage,
  sendText,
  sendCtaUrl,
  sendDocument,
  sendReplyButtons,
  sendProjectTemplate,
  logMissing: (projectId, contentType) => {
    console.info("Project detail content missing", { projectId, contentType });
  }
};

import {
  handleProjectSelection,
  sendProjectImage,
  sendProjectDescription,
  sendProjectLocation,
  sendProjectVideo,
  sendProjectLinks,
  sendProjectActionButtons,
  sendProjectInfoSequence,
  handleProjectBrochure,
  handleProjectPlans,
  sendSquareFeetOptions,
  sendBhkOptions,
  handleSquareFeetSelection,
  handleBhkSelection,
  handleMainMenuAction,
  handleProjectAction,
  type ProjectFlowDependencies
} from "./project-flow.js";

export {
  sendProjectImage,
  sendProjectDescription,
  sendProjectLocation,
  sendProjectVideo,
  sendProjectLinks,
  sendProjectActionButtons,
  sendProjectInfoSequence,
  handleProjectSelection,
  handleProjectBrochure,
  handleProjectPlans,
  sendSquareFeetOptions,
  sendBhkOptions,
  handleSquareFeetSelection,
  handleBhkSelection,
  handleMainMenuAction,
  handleProjectAction,
  type ProjectFlowDependencies
};

export function projectIdFromTrigger(text: string): string | null {
  const match = /^PROJECT:([a-z0-9-]+)$/i.exec(text.trim());
  return match ? match[1].toLowerCase() : null;
}

export async function sendProjectDetails(
  to: string,
  projectId: string,
  dependencies: ProjectDetailsDependencies = defaultDependencies
): Promise<boolean> {
  const project = getProject(projectId);
  if (!project || !project.active) {
    dependencies.logMissing(projectId, "project");
    return false;
  }

  if (dependencies === defaultDependencies) {
    return handleProjectSelection(to, projectId);
  }

  const card = buildProjectCard(project);
  if (await tryProjectTemplate(to, card, dependencies)) {
    return true;
  }

  if (project.id === "rajmahal") {
    await sendRajmahalProjectContent(to, project, dependencies, card);
    return true;
  }

  if (project.id === "spring-hill") {
    await sendSpringHillProjectContent(to, project, dependencies, card);
    return true;
  }

  await sendProjectContent(to, project, dependencies, card);
  return true;
}

async function sendSpringHillProjectContent(
  to: string,
  project: ProjectContent,
  dependencies: ProjectDetailsDependencies,
  card: ReturnType<typeof buildProjectCard>
): Promise<void> {
  console.info("[SPRING_HILL] PROJECT_OPENED");

  let imageSent = false;
  if (card.imagePath) {
    imageSent = await runOptionalProjectStage(project.id, "image", () =>
      dependencies.sendImage(to, card.imagePath, card.description)
    );
  } else {
    dependencies.logMissing(project.id, "image");
  }

  if (!imageSent) {
    if (card.description) {
      await runOptionalProjectStage(project.id, "description", () => dependencies.sendText(to, card.description));
    } else {
      dependencies.logMissing(project.id, "description");
    }
  }

  const availableBuildPlans = project.buildPlans.filter((plan) => plan.filePath);
  if (availableBuildPlans.length !== project.buildPlans.length) {
    dependencies.logMissing(project.id, "build-plans");
  }

  await runOptionalProjectStage(project.id, "primary-actions", () =>
    dependencies.sendReplyButtons(to, project.name, springHillPrimaryActions(availableBuildPlans.length === 3))
  );

  if (card.location) {
    const location = card.location;
    await runOptionalProjectStage(project.id, "location", () =>
      dependencies.sendCtaUrl(to, "📍 Project Location", "📍 Open Location", location.url)
    );
  } else {
    dependencies.logMissing(project.id, "location");
  }

  if (card.video) {
    const video = card.video;
    await runOptionalProjectStage(project.id, "video", () =>
      dependencies.sendCtaUrl(to, "▶ Project Video", "▶ Watch Project Video", video.url)
    );
  } else {
    dependencies.logMissing(project.id, "video");
  }

  await runOptionalProjectStage(project.id, "call-action", () =>
    dependencies.sendReplyButtons(to, "👇", springHillCallAction)
  );
}

async function sendRajmahalProjectContent(
  to: string,
  project: ProjectContent,
  dependencies: ProjectDetailsDependencies,
  card: ReturnType<typeof buildProjectCard>
): Promise<void> {
  let imageSent = false;
  if (card.imagePath) {
    imageSent = await runOptionalProjectStage(project.id, "image", () =>
      dependencies.sendImage(to, card.imagePath, card.description)
    );
  } else {
    dependencies.logMissing(project.id, "image");
  }

  if (!imageSent) {
    if (card.description) {
      await runOptionalProjectStage(project.id, "description", () => dependencies.sendText(to, card.description));
    } else {
      dependencies.logMissing(project.id, "description");
    }
  }

  const availableBuildPlans = project.buildPlans.filter((plan) => plan.filePath);
  if (availableBuildPlans.length !== project.buildPlans.length) {
    dependencies.logMissing(project.id, "build-plans");
  }

  await runOptionalProjectStage(project.id, "primary-actions", () =>
    dependencies.sendReplyButtons(to, project.name, rajmahalPrimaryActions(availableBuildPlans.length === 6))
  );

  if (card.location) {
    const location = card.location;
    await runOptionalProjectStage(project.id, "location", () =>
      dependencies.sendCtaUrl(to, "📍 Project Location", "📍 Open Location", location.url)
    );
  } else {
    dependencies.logMissing(project.id, "location");
  }

  if (card.video) {
    const video = card.video;
    await runOptionalProjectStage(project.id, "video", () =>
      dependencies.sendCtaUrl(to, "▶ Project Video", "▶ Watch Project Video", video.url)
    );
  } else {
    dependencies.logMissing(project.id, "video");
  }

  await runOptionalProjectStage(project.id, "call-action", () =>
    dependencies.sendReplyButtons(to, "👇", rajmahalCallAction)
  );
}

async function sendProjectContent(
  to: string,
  project: ProjectContent,
  dependencies: ProjectDetailsDependencies,
  card: ReturnType<typeof buildProjectCard>
): Promise<void> {
  let imageSent = false;
  if (card.imagePath) {
    imageSent = await runOptionalProjectStage(project.id, "image", () =>
      dependencies.sendImage(to, card.imagePath, card.description)
    );
  } else {
    dependencies.logMissing(project.id, "image");
  }

  if (!imageSent) {
    if (card.description) {
      await runOptionalProjectStage(project.id, "description", () =>
        dependencies.sendText(to, card.description)
      );
    } else {
      dependencies.logMissing(project.id, "description");
    }
  }

  if (card.location) {
    const location = card.location;
    await runOptionalProjectStage(project.id, "location", () =>
      dependencies.sendCtaUrl(to, location.bodyText, location.buttonText, location.url)
    );
  } else {
    dependencies.logMissing(project.id, "location");
  }

  if (card.video) {
    const video = card.video;
    await runOptionalProjectStage(project.id, "video", () =>
      dependencies.sendCtaUrl(to, video.bodyText, video.buttonText, video.url)
    );
  } else {
    dependencies.logMissing(project.id, "video");
  }

  if (card.brochurePath) {
    await runOptionalProjectStage(project.id, "brochure", () =>
      sendBrochure(to, card.name, card.brochurePath, dependencies.sendDocument)
    );
  } else {
    dependencies.logMissing(project.id, "brochure");
  }

  await runOptionalProjectStage(project.id, "follow-up-menu", () =>
    dependencies.sendReplyButtons(to, project.name, nextActions(project.id))
  );
}

async function tryProjectTemplate(
  to: string,
  card: ReturnType<typeof buildProjectCard>,
  dependencies: ProjectDetailsDependencies
): Promise<boolean> {
  if (!env.projectTemplateName) {
    console.info("[TEMPLATE] PROJECT TEMPLATE UNAVAILABLE — FALLBACK");
    return false;
  }

  try {
    await dependencies.sendProjectTemplate(to, env.projectTemplateName, card);
    console.info("[TEMPLATE] PROJECT TEMPLATE SENT");
    return true;
  } catch {
    console.info("[TEMPLATE] PROJECT TEMPLATE UNAVAILABLE — FALLBACK");
    return false;
  }
}

export async function sendBrochure(
  to: string,
  projectName: string,
  brochurePath: string,
  send: typeof sendDocument = sendDocument
): Promise<void> {
  await send(to, brochurePath, `${projectName}-Brochure.pdf`);
}

export async function sendProjectBrochure(to: string, projectId: string): Promise<boolean> {
  const project = getProject(projectId);
  if (!project || !project.active || !project.brochurePath) {
    return false;
  }

  if (project.id !== "rajmahal") {
    if (project.id !== "spring-hill") {
      await sendBrochure(to, project.name, project.brochurePath);
      return true;
    }
  }

  if (project.id === "spring-hill") {
    console.info("[SPRING_HILL] BROCHURE_CLICKED");
    console.info("[SPRING_HILL] BROCHURE SEND STARTED");
    try {
      await sendBrochure(to, "Spring-Hill", project.brochurePath);
      console.info("[SPRING_HILL] BROCHURE SEND SUCCESS");
      await sendSpringHillFollowUp(to);
      return true;
    } catch (error: unknown) {
      console.info("[SPRING_HILL] BROCHURE SEND FAILED");
      logSafeProjectDocumentFailure("Spring Hill", error);
      return false;
    }
  }

  if (project.id === "rajmahal") {
    console.info("[ACTION] RAJMAHEL_BROCHURE");
    console.info("[BROCHURE] RAJMAHEL SEND STARTED");
    try {
      await sendBrochure(to, project.name, project.brochurePath);
      console.info("[BROCHURE] RAJMAHEL SEND SUCCESS");
      await sendRajmahalFollowUp(to);
      return true;
    } catch (error: unknown) {
      console.info("[BROCHURE] RAJMAHEL SEND FAILED");
      logSafeProjectDocumentFailure("Rajmahel", error);
      return false;
    }
  }

  return false;
}

export async function sendSpringHillBuildPlanList(to: string): Promise<boolean> {
  const project = getProject("spring-hill");
  if (!project || project.buildPlans.length !== 3 || project.buildPlans.some((plan) => !plan.filePath)) {
    console.info("[SPRING_HILL] BUILD_PLAN_OPENED");
    console.info("[SPRING_HILL] BUILD PLAN UNAVAILABLE");
    return false;
  }

  console.info("[SPRING_HILL] BUILD_PLAN_OPENED");
  await sendList(
    to,
    "Choose Build Plan",
    "Select a Spring Hill build plan.",
    "Build Plan",
    "Spring Hill",
    project.buildPlans.map((plan) => ({
      id: `BUILD_PLAN:${project.id}:${plan.id}`,
      title: plan.label
    }))
  );
  return true;
}

export async function sendSpringHillBuildPlan(to: string, planId: string): Promise<boolean> {
  const project = getProject("spring-hill");
  if (!project) {
    return false;
  }
  const plan = project.buildPlans.find((item) => item.id === planId);
  if (!plan?.filePath) {
    console.info("[SPRING_HILL] BUILD_PLAN_SELECTED");
    console.info("[SPRING_HILL] PLAN SEND FAILED");
    return false;
  }

  console.info("[SPRING_HILL] BUILD_PLAN_SELECTED");
  try {
    await sendDocument(to, plan.filePath, `Spring-Hill-${plan.label}.pdf`);
    console.info("[SPRING_HILL] PLAN_SEND_SUCCESS");
    analyticsService.recordEventByWaId(to, "PLAN_SENT", plan.label, "spring-hill").catch(() => {});
    await sendSpringHillFollowUp(to);
    return true;
  } catch (error: unknown) {
    console.info("[SPRING_HILL] PLAN SEND FAILED");
    logSafeProjectDocumentFailure("Spring Hill", error);
    return false;
  }
}

export async function sendRajmahalBuildPlanList(to: string): Promise<boolean> {
  const project = getProject("rajmahal");
  if (!project || project.buildPlans.length !== 6 || project.buildPlans.some((plan) => !plan.filePath)) {
    console.info("[ACTION] RAJMAHEL_BUILD_PLAN");
    console.info("[PLAN] BUILD PLANS UNAVAILABLE");
    return false;
  }

  console.info("[ACTION] RAJMAHEL_BUILD_PLAN");
  await sendList(
    to,
    "Choose Build Plan",
    "Select a Rajmahel build plan.",
    "Build Plan",
    "Rajmahel",
    project.buildPlans.map((plan) => ({
      id: `BUILD_PLAN:${project.id}:${plan.id}`,
      title: plan.label
    }))
  );
  return true;
}

export async function sendRajmahalBuildPlan(to: string, planId: string): Promise<boolean> {
  const project = getProject("rajmahal");
  if (!project) {
    return false;
  }
  const plan = project?.buildPlans.find((item) => item.id === planId);
  if (!plan?.filePath) {
    console.info("[ACTION] RAJMAHEL_BUILD_PLAN");
    console.info(`[PLAN] ${planId || "UNAVAILABLE"}`);
    console.info("[PLAN] SEND FAILED");
    return false;
  }

  console.info("[ACTION] RAJMAHEL_BUILD_PLAN");
  console.info(`[PLAN] ${plan.id}`);
  try {
    await sendDocument(to, plan.filePath, `${project.name}-${plan.label}.pdf`);
    console.info("[PLAN] SEND SUCCESS");
    analyticsService.recordEventByWaId(to, "PLAN_SENT", plan.label, "rajmahal").catch(() => {});
    await sendRajmahalFollowUp(to);
    return true;
  } catch (error: unknown) {
    console.info("[PLAN] SEND FAILED");
    logSafeProjectDocumentFailure("Rajmahel", error);
    return false;
  }
}

async function sendRajmahalFollowUp(to: string): Promise<void> {
  await sendReplyButtons(to, "👇", nextActions("rajmahal"));
}

async function sendSpringHillFollowUp(to: string): Promise<void> {
  await sendReplyButtons(to, "👇", nextActions("spring-hill"));
}

function logSafeProjectDocumentFailure(projectName: string, error: unknown): void {
  if (error instanceof MetaApiRequestError) {
    console.info(`HTTP STATUS: ${error.httpStatus}`);
    console.info(`META ERROR CODE: ${error.metaErrorCode}`);
    console.info(`META ERROR MESSAGE: ${error.message}`);
    return;
  }

  console.info("HTTP STATUS: UNAVAILABLE");
  console.info("META ERROR CODE: UNAVAILABLE");
  console.info(`META ERROR MESSAGE: ${projectName} document delivery did not receive a Meta API response.`);
}

async function runOptionalProjectStage(
  projectId: string,
  contentType: string,
  operation: () => Promise<unknown>
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch {
    console.error("Project detail component failed", { projectId, contentType });
    return false;
  }
}
