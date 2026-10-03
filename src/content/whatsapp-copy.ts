import type { ProjectContent } from "./project-service.js";
import welcome from "../../data/welcome.json" with { type: "json" };

/**
 * Reusable Mobile-First WhatsApp Content Layer for Silverstone Developers.
 * Preserves 100% exact wording and emojis from source marketing documents
 * with formatting optimized for mobile WhatsApp screens.
 */

export type WelcomeCopy = {
  canonicalWelcome: string;
  companyIntro: string;
  locationHighlights: string;
};

export type BrochureCopy = {
  beforePdf: string;
  afterPdf: string;
  unavailable: string;
};

export type PlanCopy = {
  chooseRequirement: string;
  chooseBhk: string;
  beforePdf: (projectName: string, sizeLabel: string, bhkLabel: string) => string;
  afterPdf: string;
  unavailable: string;
};

export type FallbackCopy = {
  genericMissing: string;
  videoUnavailable: string;
  brochureUnavailable: string;
  planUnavailable: string;
};

export function getWelcomeCopy(): WelcomeCopy {
  return {
    canonicalWelcome:
      "🏡 *WELCOME TO SILVERSTONE DEVELOPERS*\n\nThank you for connecting with us.\n\nHow can we help you today?",
    companyIntro: welcome.message,
    locationHighlights: welcome.locationHighlightsMessage
  };
}

export function getProjectIntroCopy(project: ProjectContent): string {
  return project.description;
}

export function getLocationCopy(project: ProjectContent): string {
  const address = project.location?.address || `${project.name}, Surat`;
  return `📍 *PROJECT LOCATION*\n\n${address}`.trim();
}

export function getVideoCopy(project: ProjectContent): string {
  return `🎥 *PROJECT WALKTHROUGH*\n\nTake a look at the project walkthrough for *${project.name}*.`;
}

export function getBrochureCopy(project: ProjectContent): BrochureCopy {
  return {
    beforePdf: `📄 *PROJECT BROCHURE*\n\nHere is the brochure for *${project.name}*.`,
    afterPdf: "✅ *Brochure sent.*\n\nWhat would you like to do next?",
    unavailable: "Brochure is currently unavailable. Please contact our sales team."
  };
}

export function getPlanCopy(): PlanCopy {
  return {
    chooseRequirement: "📐 *CHOOSE YOUR REQUIREMENT*\n\nSelect your preferred size.",
    chooseBhk: "🏠 *CHOOSE YOUR HOME PLAN*\n\nSelect your preferred plan:",
    beforePdf: (projectName: string, sizeLabel: string, bhkLabel: string) =>
      `📐 *${projectName}*\n\n*${sizeLabel} — ${bhkLabel}*\n\nHere is your selected floor plan.`,
    afterPdf: "✅ *Plan sent.*\n\nWhat would you like to do next?",
    unavailable: "This plan is currently unavailable. Please contact our sales team."
  };
}

export function getFallbackCopy(): FallbackCopy {
  return {
    genericMissing: "Project details are currently unavailable. Please contact our sales team.",
    videoUnavailable:
      "🎥 *Project video currently unavailable.*\n\nPlease contact our sales team for the latest walkthrough.",
    brochureUnavailable: "Brochure is currently unavailable. Please contact our sales team.",
    planUnavailable: "This plan is currently unavailable. Please contact our sales team."
  };
}
