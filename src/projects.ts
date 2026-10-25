// Project level actions that touch both the store and storage: boot, save, open, create, duplicate, delete, backup.
import { downloadBlob, fileBase } from './download';
import { newId } from './model/garment';
import { newProject, normalizeProject, type Project } from './model/project';
import { deleteProjectData, loadIndex, loadProject, saveIndex, saveProject, summaryOf, type Summary } from './persist';
import { fullProject, useStore } from './store';

const st = () => useStore.getState();

// what was last written, so an unchanged project does not get a new timestamp
let lastDoc: unknown = null;
let lastProject: unknown = null;
let lastSel: string | null = null;
const markSaved = () => {
  const s = st();
  lastDoc = s.doc;
  lastProject = s.project;
  lastSel = s.selectedId;
};

async function persistIndex() {
  const s = st();
  await saveIndex({ v: 2, current: s.screen === 'studio' ? s.project.id : null, projects: s.projects });
}

function upsertSummary(sum: Summary) {
  const list = st().projects;
  const i = list.findIndex((x) => x.id === sum.id);
  const next = i < 0 ? [...list, sum] : list.map((x, j) => (j === i ? { ...sum, thumb: sum.thumb ?? x.thumb } : x));
  st().setProjects(next);
}

/** Write the open project to storage now. */
export async function saveNow() {
  const s = st();
  if (!s.ready || s.screen !== 'studio') return;
  if (s.doc === lastDoc && s.project === lastProject && s.selectedId === lastSel) return;
  const p: Project = { ...fullProject(s), updated: Date.now() };
  markSaved();
  await saveProject(p, s.selectedId);
  upsertSummary(summaryOf(p));
  await persistIndex();
}

let thumbDoc: unknown = null;
/** Refresh the open project's thumbnail from its first look. */
export async function refreshThumb() {
  const s = st();
  if (s.screen !== 'studio') return;
  const p = fullProject(s);
  const first = p.looks[0].doc;
  if (first === thumbDoc) return;
  thumbDoc = first;
  try {
    const { lookThumb } = await import('./lineup');
    const thumb = await lookThumb(first);
    upsertSummary({ ...summaryOf(p), thumb });
    await persistIndex();
  } catch {
    // no thumbnail is fine
  }
}

function open(p: Project, sel: string | null) {
  st().hydrate(p, sel);
  markSaved();
  thumbDoc = null;
}

let booting: Promise<void> | null = null;
/** Load the project list and open the last project. Safe to call twice (StrictMode). */
export function bootProjects(): Promise<void> {
  return (booting ??= boot());
}

async function boot() {
  const { index, selectedId, migrated } = await loadIndex();
  st().setProjects(index.projects);
  if (migrated) {
    open(migrated, selectedId);
    return;
  }
  if (index.current) {
    const l = await loadProject(index.current);
    if (l) {
      open(l.project, l.selectedId);
      return;
    }
  }
  if (index.projects.length) {
    st().showHome();
    return;
  }
  await createProject('My collection', 'FW27');
}

export async function createProject(name: string, season: string) {
  await saveNow();
  const p = newProject(name.trim() || 'Untitled collection', season.trim() || 'FW27');
  await saveProject(p, null);
  upsertSummary(summaryOf(p));
  open(p, null);
  await persistIndex();
}

export async function openProject(id: string) {
  await saveNow();
  const l = await loadProject(id);
  if (!l) return;
  open(l.project, l.selectedId);
  await persistIndex();
}

export async function goHome() {
  await saveNow();
  await refreshThumb();
  st().showHome();
  await persistIndex();
}

export async function duplicateProject(id: string) {
  await saveNow();
  const l = await loadProject(id);
  if (!l) return;
  const now = Date.now();
  const p: Project = { ...l.project, id: newId(), name: `${l.project.name} copy`, created: now, updated: now };
  await saveProject(p, l.selectedId);
  const thumb = st().projects.find((x) => x.id === id)?.thumb;
  upsertSummary(summaryOf(p, thumb));
  await persistIndex();
}

export async function removeProject(id: string) {
  await deleteProjectData(id);
  st().setProjects(st().projects.filter((x) => x.id !== id));
  await persistIndex();
}

/** Rename or change the season of any project from the project list. */
export async function updateProjectInfo(id: string, patch: { name?: string; season?: string }) {
  const l = await loadProject(id);
  if (!l) return;
  const p: Project = { ...l.project, ...patch, updated: Date.now() };
  await saveProject(p, l.selectedId);
  // the project list is only shown while no project is open, so the open copy can follow quietly
  if (id === st().project.id) {
    useStore.setState((x) => ({ project: { ...x.project, ...patch } }));
    markSaved();
  }
  upsertSummary(summaryOf(p));
  await persistIndex();
}

/** Backup: the whole open project as a .sdtn file. */
export function exportSdtn() {
  const p = fullProject(st());
  const body = JSON.stringify({ format: 'sdtn', version: 1, exported: new Date().toISOString(), project: p });
  downloadBlob(new Blob([body], { type: 'application/json' }), `${fileBase(p.name)}.sdtn`);
}

/** Read a .sdtn file back in as a new project and open it. */
export async function importSdtn(file: File): Promise<boolean> {
  try {
    const j = JSON.parse(await file.text());
    if (j?.format !== 'sdtn' || !j.project || !Array.isArray(j.project.looks)) return false;
    const now = Date.now();
    const p = normalizeProject({ ...j.project, id: newId(), updated: now });
    await saveNow();
    await saveProject(p, null);
    upsertSummary(summaryOf(p));
    open(p, null);
    await persistIndex();
    return true;
  } catch {
    return false;
  }
}
