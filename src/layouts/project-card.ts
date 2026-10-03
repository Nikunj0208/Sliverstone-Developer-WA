import type { ProjectContent } from "../content/project-service.js";

export type ProjectCard = {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  brochurePath: string;
  location: { bodyText: string; buttonText: string; url: string } | null;
  video: { bodyText: string; buttonText: string; url: string } | null;
};

export function buildProjectCard(project: ProjectContent): ProjectCard {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    imagePath: project.imagePath,
    brochurePath: project.brochurePath,
    location: project.locationUrl
      ? { bodyText: "📍 Project Location", buttonText: "Open Location", url: project.locationUrl }
      : null,
    video: project.videoUrl
      ? { bodyText: "▶ Project Video", buttonText: "Watch Video", url: project.videoUrl }
      : null
  };
}
