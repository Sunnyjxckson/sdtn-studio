import { del, get, set } from 'idb-keyval';
import type { Doc } from './model/doc';
import { normalizeProject, projectFromLegacy, type Project } from './model/project';

const LEGACY_KEY = 'sdtn-studio:doc:v1';
const INDEX_KEY = 'sdtn-studio:index:v2';
const projectKey = (id: string) => `sdtn-studio:project:${id}`;

/** What the project list shows. The full project is stored under its own key. */
export interface Summary {
  id: string;
  name: string;
  season: string;
  updated: number;
  looks: number;
  thumb?: string;
}

export interface Index {
  v: 2;
  current: string | null;
  projects: Summary[];
}

interface SavedProject {
  v: 2;
  project: Project;
  selectedId: string | null;
}

interface LegacySaved {
  v: 1;
  doc: Doc;
  selectedId: string | null;
}

export const summaryOf = (p: Project, thumb?: string): Summary => ({
  id: p.id,
  name: p.name,
  season: p.season,
  updated: p.updated,
  looks: p.looks.length,
  thumb,
});

export async function saveIndex(idx: Index): Promise<void> {
  try {
    await set(INDEX_KEY, idx);
  } catch {
    // ignore quota or private mode errors
  }
}

export async function saveProject(project: Project, selectedId: string | null): Promise<void> {
  try {
    await set(projectKey(project.id), { v: 2, project, selectedId } satisfies SavedProject);
  } catch {
    // ignore quota or private mode errors
  }
}

export async function loadProject(id: string): Promise<{ project: Project; selectedId: string | null } | null> {
  try {
    const s = await get<SavedProject>(projectKey(id));
    if (s && s.v === 2 && s.project && Array.isArray(s.project.looks)) return { project: normalizeProject(s.project), selectedId: s.selectedId ?? null };
  } catch {
    // storage unavailable
  }
  return null;
}

export async function deleteProjectData(id: string): Promise<void> {
  try {
    await del(projectKey(id));
  } catch {
    // ignore
  }
}

/** Read the project list. A pre collection save becomes the first project (the old key is left in place). */
export async function loadIndex(): Promise<{ index: Index; selectedId: string | null; migrated: Project | null }> {
  try {
    const idx = await get<Index>(INDEX_KEY);
    if (idx && idx.v === 2 && Array.isArray(idx.projects)) return { index: idx, selectedId: null, migrated: null };
    const old = await get<LegacySaved>(LEGACY_KEY);
    if (old && old.v === 1 && old.doc && Array.isArray(old.doc.garments)) {
      const project = projectFromLegacy(old.doc);
      await saveProject(project, old.selectedId);
      const index: Index = { v: 2, current: project.id, projects: [summaryOf(project)] };
      await saveIndex(index);
      return { index, selectedId: old.selectedId, migrated: project };
    }
  } catch {
    // storage unavailable, start fresh
  }
  return { index: { v: 2, current: null, projects: [] }, selectedId: null, migrated: null };
}
