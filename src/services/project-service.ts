import projects from "../../data/projects.json" with { type: "json" };

export type Project = (typeof projects)[number];

export function listActiveProjects(): Project[] {
  return projects
    .filter((project) => project.active)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function findProjectById(id: string): Project | undefined {
  return projects.find((project) => project.id === id);
}
