import { StoryProject } from '../types';

const STORAGE_KEY = 'scriptweaver.projects.v1';

export function loadProjects(): StoryProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoryProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: StoryProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
