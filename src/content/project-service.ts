import projects from "../../data/projects.json" with { type: "json" };

import { normalizeCustomerCopy } from "./copy-normalizer.js";

export type BuildPlanContent = {
  id: string;
  label: string;
  filePath: string;
};

export type ProjectContent = (typeof projects)[number] & {
  description: string;
  buildPlans: BuildPlanContent[];
};

function normalizeProject(project: (typeof projects)[number]): ProjectContent {
  const buildPlans = "buildPlans" in project && Array.isArray(project.buildPlans)
    ? project.buildPlans.map((plan) => ({ ...plan }))
    : [];

  return {
    ...project,
    description: normalizeCustomerCopy(project.description),
    buildPlans
  } as ProjectContent;
}

export type SquareFeetOption = {
  id: string;
  label: string;
  bhkOptions: BhkOption[];
};

export type BhkOption = {
  id: string;
  label: string;
  file: string;
  filename: string;
};

export function getProject(id: string): ProjectContent | undefined {
  const cleanId = id.trim().toLowerCase();
  const normalizedId = cleanId === "rajmahel" ? "rajmahal" : cleanId === "springhill" ? "spring-hill" : cleanId;
  const project = projects.find(
    (item) => item.id.toLowerCase() === normalizedId || item.id.toLowerCase().replace(/-/g, "") === cleanId.replace(/-/g, "")
  );
  return project ? normalizeProject(project) : undefined;
}

export function getActiveProjects(): ProjectContent[] {
  return projects
    .filter((project) => project.active)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(normalizeProject);
}

export const getAllProjects = getActiveProjects;
export const getProjectById = getProject;

import { existsSync } from "node:fs";

export function getSquareFeetOptions(projectId: string): SquareFeetOption[] {
  const project = getProject(projectId);
  if (!project || !("plans" in project) || !project.plans || !Array.isArray(project.plans.squareFeetOptions)) {
    return [];
  }
  return project.plans.squareFeetOptions as SquareFeetOption[];
}

export function hasProjectPlans(projectId: string): boolean {
  const sqftOptions = getSquareFeetOptions(projectId);
  if (!sqftOptions || sqftOptions.length === 0) return false;
  return sqftOptions.some((sq) =>
    Array.isArray(sq.bhkOptions) &&
    sq.bhkOptions.some((bhk) => Boolean(bhk.file && existsSync(bhk.file)))
  );
}

export function getBhkOptions(projectId: string, sqftId: string): BhkOption[] {
  const sqftOptions = getSquareFeetOptions(projectId);
  const cleanSqft = sqftId.toLowerCase();
  const matchedSqft = sqftOptions.find((sq) => sq.id.toLowerCase() === cleanSqft)
    || (cleanSqft === "sqft-bhk" ? sqftOptions[0] : undefined);
  return matchedSqft ? matchedSqft.bhkOptions : [];
}

export function getBrochure(projectId: string): { file: string; filename: string; caption?: string } | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;
  if ("brochure" in project && project.brochure && project.brochure.file) {
    return project.brochure;
  }
  if (project.brochurePath) {
    return {
      file: project.brochurePath,
      filename: `${project.name.replace(/\s+/g, "-")}-Brochure.pdf`,
      caption: `${project.name} Brochure`
    };
  }
  return undefined;
}

export function getPlan(projectId: string, sqftId: string, bhk: string): BhkOption | undefined {
  const bhkOptions = getBhkOptions(projectId, sqftId);
  const normalizedBhk = bhk.replace(/[\s-_]+/g, "").toLowerCase();
  const match = bhkOptions.find(
    (item) =>
      item.id.replace(/[\s-_]+/g, "").toLowerCase() === normalizedBhk ||
      item.label.replace(/[\s-_]+/g, "").toLowerCase() === normalizedBhk
  );
  if (match) return match;
  if (bhkOptions.length === 1) return bhkOptions[0];

  const allSqft = getSquareFeetOptions(projectId);
  for (const sq of allSqft) {
    const found = sq.bhkOptions.find(
      (item) =>
        item.id.replace(/[\s-_]+/g, "").toLowerCase() === normalizedBhk ||
        item.label.replace(/[\s-_]+/g, "").toLowerCase() === normalizedBhk
    );
    if (found) return found;
  }

  const project = getProject(projectId);
  if (project) {
    const cleanBhk = bhk.toUpperCase();
    return {
      id: bhk.toLowerCase(),
      label: `${cleanBhk.replace("BHK", "")} BHK`,
      file: "",
      filename: `${project.name.replace(/\s+/g, "-")}-${sqftId}-${cleanBhk}-Plan.pdf`
    };
  }
  return undefined;
}
