import { sendChat } from "./chat.js";
import { sendCallFallback } from "./call.js";
import { sendLocationHighlights, sendWelcomeFlow } from "./welcome.js";
import {
  sendProjectBrochure,
  sendProjectDetails,
  sendProjectList,
  sendRajmahalBuildPlan,
  sendRajmahalBuildPlanList,
  sendSpringHillBuildPlan,
  sendSpringHillBuildPlanList,
  handleProjectSelection,
  handleProjectBrochure,
  handleProjectPlans,
  handleSquareFeetSelection,
  handleBhkSelection,
  handleMainMenuAction,
  handleProjectAction
} from "./projects.js";
import { startSiteVisitBooking } from "./site-visit.js";
import { setConversationState } from "./conversation-state.js";

export {
  handleMainMenuAction,
  handleProjectSelection,
  handleProjectAction,
  handleSquareFeetSelection,
  handleBhkSelection,
  handleProjectBrochure,
  handleProjectPlans
};

export type ActionDependencies = {
  handleChat: typeof handleChat;
  handleCall: typeof handleCall;
  handleSiteVisit: typeof handleSiteVisit;
  handleLocationHighlights: typeof handleLocationHighlights;
  sendWelcomeFlow?: typeof sendWelcomeFlow;
  sendProjectList: typeof sendProjectList;
  sendProjectBrochure: typeof sendProjectBrochure;
  sendProjectDetails: typeof sendProjectDetails;
  sendRajmahalBuildPlanList: typeof sendRajmahalBuildPlanList;
  sendRajmahalBuildPlan: typeof sendRajmahalBuildPlan;
  sendSpringHillBuildPlanList: typeof sendSpringHillBuildPlanList;
  sendSpringHillBuildPlan: typeof sendSpringHillBuildPlan;
  handleProjectSelection: typeof handleProjectSelection;
  handleProjectBrochure: typeof handleProjectBrochure;
  handleProjectPlans: typeof handleProjectPlans;
  handleSquareFeetSelection: typeof handleSquareFeetSelection;
  handleBhkSelection: typeof handleBhkSelection;
};

export async function handleChat(to: string): Promise<void> {
  await sendChat(to);
}

export async function handleCall(to: string): Promise<void> {
  await sendCallFallback(to);
}

export async function handleLocationHighlights(to: string): Promise<void> {
  await sendLocationHighlights(to);
}

export async function handleSiteVisit(to: string, projectId?: string): Promise<boolean> {
  return startSiteVisitBooking(to, projectId);
}

const defaultDependencies: ActionDependencies = {
  handleChat,
  handleCall,
  handleSiteVisit,
  handleLocationHighlights,
  sendWelcomeFlow,
  sendProjectList,
  sendProjectBrochure,
  sendProjectDetails,
  sendRajmahalBuildPlanList,
  sendRajmahalBuildPlan,
  sendSpringHillBuildPlanList,
  sendSpringHillBuildPlan,
  handleProjectSelection,
  handleProjectBrochure,
  handleProjectPlans,
  handleSquareFeetSelection,
  handleBhkSelection
};

export async function routeButtonAction(
  to: string,
  buttonId: string,
  dependencies: ActionDependencies = defaultDependencies
): Promise<boolean> {
  const normalizedId = buttonId.trim().toUpperCase();
  if (
    normalizedId === "MORE_DETAILS" ||
    normalizedId === "MORE DETAILS" ||
    normalizedId === "VIEW_DETAILS" ||
    normalizedId === "VIEW DETAILS" ||
    normalizedId === "MAIN_WELCOME" ||
    normalizedId === "START"
  ) {
    console.info("[ACTION] MORE_DETAILS -> SEND WELCOME FLOW");
    return runAction(async () => {
      const fn = dependencies.sendWelcomeFlow ?? defaultDependencies.sendWelcomeFlow;
      if (fn) {
        await fn(to);
        return true;
      }
      return false;
    });
  }

  const buildPlan = buildPlanAction(buttonId);
  if (buildPlan) {
    if (!buildPlan.planId) {
      return runAction(() => dependencies.sendRajmahalBuildPlanList(to));
    }
    const planId = buildPlan.planId;
    return runAction(() => dependencies.sendRajmahalBuildPlan(to, planId));
  }

  const springHillBuildPlan = springHillBuildPlanAction(buttonId);
  if (springHillBuildPlan) {
    if (!springHillBuildPlan.planId) {
      return runAction(() => dependencies.sendSpringHillBuildPlanList(to));
    }
    const planId = springHillBuildPlan.planId;
    return runAction(() => dependencies.sendSpringHillBuildPlan(to, planId));
  }

  const projectId = actionProjectId(buttonId, "PROJECT:");
  if (projectId) {
    console.info(`[ACTION] PROJECT:${projectId}`);
    return runAction(() => dependencies.sendProjectDetails(to, projectId));
  }

  const brochureProjectId = actionProjectId(buttonId, "DOWNLOAD_BROCHURE:");
  if (brochureProjectId) {
    console.info("[ACTION] DOWNLOAD_BROCHURE");
    try {
      const sent = await dependencies.sendProjectBrochure(to, brochureProjectId);
      if (sent) {
        console.info("[BROCHURE] SEND SUCCESS");
      } else {
        console.error("[BROCHURE] SEND FAILED");
      }
      return sent;
    } catch {
      console.error("[BROCHURE] SEND FAILED");
      return false;
    }
  }

  const bhkAction = planBhkAction(buttonId);
  if (bhkAction) {
    console.info(`[ACTION] PLAN_BHK:${bhkAction.projectId}:${bhkAction.sqftId}:${bhkAction.bhk}`);
    return runAction(() => dependencies.handleBhkSelection(to, bhkAction.projectId, bhkAction.sqftId, bhkAction.bhk));
  }

  const sqftAction = planSqftAction(buttonId);
  if (sqftAction) {
    console.info(`[ACTION] PLAN_SQFT:${sqftAction.projectId}:${sqftAction.sqftId}`);
    return runAction(() => dependencies.handleSquareFeetSelection(to, sqftAction.projectId, sqftAction.sqftId));
  }

  if (buttonId === "PROJECT_BROCHURE" || buttonId.startsWith("PROJECT_BROCHURE:")) {
    const projectId = buttonId.startsWith("PROJECT_BROCHURE:") ? buttonId.slice("PROJECT_BROCHURE:".length) : undefined;
    console.info("[ACTION] PROJECT_BROCHURE");
    return runAction(() => dependencies.handleProjectBrochure(to, projectId));
  }

  if (buttonId === "PROJECT_PLANS" || buttonId.startsWith("PROJECT_PLANS:")) {
    const projectId = buttonId.startsWith("PROJECT_PLANS:") ? buttonId.slice("PROJECT_PLANS:".length) : undefined;
    console.info("[ACTION] PROJECT_PLANS");
    return runAction(() => dependencies.handleProjectPlans(to, projectId));
  }

  const siteVisitProjectId = actionProjectId(buttonId, "BOOK_SITE_VISIT:");
  if (siteVisitProjectId) {
    console.info("[ACTION] BOOK_SITE_VISIT");
    return runAction(() => dependencies.handleSiteVisit(to, siteVisitProjectId));
  }

  switch (buttonId) {
    case "MAIN_LOCATION_HIGHLIGHTS":
      console.info("[ACTION] MAIN_LOCATION_HIGHLIGHTS");
      return runAction(async () => {
        await dependencies.handleLocationHighlights(to);
        return true;
      });
    case "MAIN_CHAT":
      console.info("[ACTION] MAIN_CHAT");
      setConversationState(to, "CHAT");
      return runAction(async () => {
        await dependencies.handleChat(to);
        return true;
      });
    case "MAIN_CALL":
      console.info("[ACTION] MAIN_CALL");
      setConversationState(to, "CALL");
      return runAction(async () => {
        await dependencies.handleCall(to);
        console.info("[ACTION] CALL HANDLER SUCCESS");
        return true;
      });
    case "MAIN_VIEW_PROJECTS":
      console.info("[ACTION] MAIN_VIEW_PROJECTS");
      setConversationState(to, "PROJECT_LIST");
      return runAction(async () => {
        await dependencies.sendProjectList(to);
        return true;
      });
    case "BOOK_SITE_VISIT":
      console.info("[ACTION] BOOK_SITE_VISIT");
      return runAction(() => dependencies.handleSiteVisit(to));
    default:
      return false;
  }
}

function buildPlanAction(actionId: string): { planId?: string } | null {
  const match = /^BUILD_PLAN:rajmah[ae]l(?::([a-z0-9-]+))?$/i.exec(actionId.trim());
  if (!match) {
    return null;
  }

  return match[1] ? { planId: match[1].toLowerCase() } : {};
}

function springHillBuildPlanAction(actionId: string): { planId?: string } | null {
  const match = /^BUILD_PLAN:spring-hill(?::([a-z0-9-]+))?$/i.exec(actionId.trim());
  if (!match) {
    return null;
  }

  return match[1] ? { planId: match[1].toLowerCase() } : {};
}

function planSqftAction(actionId: string): { projectId: string; sqftId: string } | null {
  const match = /^PLAN_SQFT:([a-z0-9-]+):([a-z0-9-]+)$/i.exec(actionId.trim());
  if (!match) {
    return null;
  }

  return { projectId: match[1].toLowerCase(), sqftId: match[2].toLowerCase() };
}

function planBhkAction(actionId: string): { projectId: string; sqftId: string; bhk: string } | null {
  const match = /^PLAN_BHK:([a-z0-9-]+):([a-z0-9-]+):([a-z0-9-]+)$/i.exec(actionId.trim());
  if (!match) {
    return null;
  }

  return { projectId: match[1].toLowerCase(), sqftId: match[2].toLowerCase(), bhk: match[3] };
}

async function runAction(operation: () => Promise<boolean>): Promise<boolean> {
  try {
    return await operation();
  } catch {
    console.error("[ACTION] HANDLER FAILED");
    return false;
  }
}

function actionProjectId(actionId: string, prefix: string): string | null {
  if (!actionId.startsWith(prefix)) {
    return null;
  }

  const projectId = actionId.slice(prefix.length);
  return /^[a-z0-9-]+$/i.test(projectId) ? projectId.toLowerCase() : null;
}
