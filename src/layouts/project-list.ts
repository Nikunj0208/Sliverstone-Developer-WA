import type { ProjectContent } from "../content/project-service.js";
import type { ListRow } from "../meta/messages.js";

export function buildProjectList(projects: ProjectContent[]): ListRow[] {
  return projects.map((project) => ({
    id: `PROJECT:${project.id}`,
    title: `${project.icon} ${project.name}`
  }));
}
