import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current, type Draft } from 'immer';
import { emptyDoc, type Doc, type RenderMode } from './model/doc';
import { cloneDoc, docTitle, newLook, newProject, normalizeProject, styleKey, type MoodItem, type Project, type StyleInfo } from './model/project';
import type { Summary } from './persist';
import type { Note } from './model/note';
import type { Sex, SkinId, View } from './model/croquis';
import type { PoseId } from './model/figure';
import {
  applyMeasure,
  buildPoints,
  buildShortsPoints,
  buildSkirtPoints,
  createShorts,
  createSkirt,
  createPants,
  buildPantsPoints,
  pantsName,
  type PantsOpts,
  SHORTS_INSEAM,
  SKIRT_LEN,
  shortsName as shortsLabel,
  SHORTS_STYLE_NAME,
  type ShortsStyle,
  type HemKind,
  type ShortsLength,
  type SkirtLength,
  type SkirtShape,
  type FabricKind,
  type Measure,
  createJeans,
  createTop,
  HOLE_SIZES,
  MIN_POINTS,
  TEXT_SIZES,
  type Fit,
  type Garment,
  type GText,
  type HoleSize,
  type PocketKind,
  type Pt,
  type Rise,
  type WaistKind,
  type WashName,
} from './model/garment';
import { placeOnCroquis } from './model/placement';
import { createShoes, shoeName, type ShoeOpts } from './model/shoes';
import { BLOCK_LOOK, buildTopPoints, topName, type TopOpts } from './model/top';
import { newId, PANTS_LOOK } from './model/garment';
import { defaultStyle, type VectorDoc, type VStyle, findItem } from './model/vector';
import { makeProductionActions, syncColorway, type ProductionActions } from './productionStore';
import { brushById, MAX_DRAW_LAYERS, newDrawLayer, type BrushId, type DrawLayer, type Drawing, type Stroke } from './model/draw';

export type Tool = 'move' | 'add' | 'erase' | 'cut' | 'hole' | 'distress' | 'text' | 'note' | 'hand';
export type Tab = 'sketch' | 'draw' | 'vector' | 'flats' | 'pattern' | 'lineup' | 'linesheet' | 'mood';
export const COLLECTION_TABS: Tab[] = ['lineup', 'linesheet', 'mood'];

/** An undo entry for a look or project level edit: the whole project, with the open look's doc merged in. */
export interface Struct {
  __s: 1;
  project: Project;
}
export type Hist = Doc | Struct;
const isStruct = (h: Hist): h is Struct => (h as Struct).__s === 1;

/** The project with the open look's working doc written back into it. */
export const fullProject = (s: { project: Project; doc: Doc }): Project => ({
  ...s.project,
  looks: s.project.looks.map((l) => (l.id === s.project.activeLook ? { ...l, doc: s.doc } : l)),
});

/** A selected anchor in vector mode: path id, sub path, node index. */
export interface NodeRef {
  id: string;
  s: number;
  i: number;
}
export type DrawTool = 'brush' | 'smudge' | 'erase' | 'fill' | 'eyedrop' | 'hand';
export type PaintTool = 'brush' | 'smudge' | 'erase';

export interface DrawPrefs {
  color: string;
  recent: string[];
  /** Brush picked for each painting tool. */
  brush: Record<PaintTool, BrushId>;
  /** Size and opacity per tool and brush, keyed tool:brush. */
  size: Record<string, number>;
  opacity: Record<string, number>;
  fillTolerance: number;
}

const PREFS_KEY = 'sdtn-studio:drawprefs:v1';
const defaultPrefs = (): DrawPrefs => ({
  color: '#141414',
  recent: [],
  brush: { brush: 'pencil', smudge: 'airbrush', erase: 'airbrush' },
  size: {},
  opacity: {},
  fillTolerance: 0.28,
});
function loadPrefs(): DrawPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const d = defaultPrefs();
      return { ...d, ...p, brush: { ...d.brush, ...p.brush } };
    }
  } catch {
    // storage blocked
  }
  return defaultPrefs();
}
export function savePrefs(p: DrawPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // storage blocked
  }
}

/** Size and opacity of the current brush for a painting tool. */
export function toolBrush(p: DrawPrefs, t: PaintTool) {
  const b = brushById(p.brush[t]);
  const k = `${t}:${b.id}`;
  const size = p.size[k] ?? (t === 'erase' ? Math.max(b.size, 14) : b.size);
  const opacity = p.opacity[k] ?? (t === 'smudge' ? 0.7 : t === 'erase' ? 1 : b.opacity);
  return { brush: b, key: k, size, opacity };
}

export const HISTORY_LIMIT = 200;

export interface Viewport {
  x: number;
  y: number;
  k: number;
}

interface State extends ProductionActions {
  /** The open look's working doc. project.looks[active].doc is stale until fullProject merges it. */
  doc: Doc;
  project: Project;
  projects: Summary[];
  screen: 'home' | 'studio';
  past: Hist[];
  future: Hist[];
  /** Key of the last coalesced edit, so typing makes one undo step. */
  coalesceKey: string | null;
  ready: boolean;

  tool: Tool;
  tab: Tab;
  selectedId: string | null;
  selectedText: number | null;
  selectedNote: string | null;
  holeSize: HoleSize;
  view: Viewport;
  drawTool: DrawTool;
  drawPrefs: DrawPrefs;
  activeLayer: string | null;

  // vector mode
  vtool: string;
  /** Selected item ids. */
  vsel: string[];
  /** Selected anchors (Direct Selection). */
  vnodes: NodeRef[];
  /** Layer new vector items go into. */
  vlayer: string | null;
  /** Style new shapes get, and what the Appearance panel edits when nothing is selected. */
  vstyle: VStyle;
  setVTool: (t: string) => void;
  setVSel: (ids: string[]) => void;
  setVNodes: (n: NodeRef[]) => void;
  setVLayer: (id: string | null) => void;
  setVStyle: (fn: (s: Draft<VStyle>) => void) => void;
  /** One undo step on the vector document. */
  vstep: (fn: (v: Draft<VectorDoc>) => void, coalesce?: string) => void;
  /** Edit without an undo step, for drags (checkpoint once when the drag starts). */
  vedit: (fn: (v: Draft<VectorDoc>) => void) => void;

  // history
  checkpoint: (coalesce?: string) => void;
  undo: () => void;
  redo: () => void;

  // lifecycle
  hydrate: (project: Project, selectedId: string | null) => void;
  setProjects: (p: Summary[]) => void;
  showHome: () => void;
  ready0: () => void;

  // collection: looks and project (undoable)
  setActiveLook: (id: string) => void;
  addLook: () => void;
  duplicateLook: (id: string) => void;
  deleteLook: (id: string) => void;
  moveLook: (id: string, dir: 1 | -1) => void;
  renameLook: (id: string, name: string) => void;
  copyGarmentToLook: (garmentId: string, lookId: string) => void;
  setProjectInfo: (patch: { name?: string; season?: string }) => void;
  setStyleInfo: (key: string, patch: Partial<StyleInfo>) => void;
  addMood: (item: MoodItem) => void;
  removeMood: (id: string) => void;
  /** Start a mood drag: one undo step, then editMood moves freely. */
  beginMood: () => void;
  editMood: (id: string, patch: Partial<MoodItem>) => void;
  setMoodText: (id: string, text: string) => void;

  // ui
  setTool: (t: Tool) => void;
  setTab: (t: Tab) => void;
  select: (id: string | null) => void;
  selectText: (i: number | null) => void;
  selectNote: (id: string | null) => void;
  setHoleSize: (s: HoleSize) => void;
  setView: (v: Viewport) => void;

  setDrawTool: (t: DrawTool) => void;
  setDrawPrefs: (fn: (p: Draft<DrawPrefs>) => void) => void;
  setActiveLayer: (id: string) => void;

  // drawing layers
  addStroke: (layerId: string, s: Stroke) => void;
  addDrawLayer: () => void;
  removeDrawLayer: (id: string) => void;
  duplicateDrawLayer: (id: string) => void;
  clearDrawLayer: (id: string) => void;
  moveDrawLayer: (id: string, dir: 1 | -1) => void;
  setDrawLayer: (id: string, patch: Partial<Omit<DrawLayer, 'id' | 'strokes'>>, coalesce?: string) => void;
  setDrawing: (patch: Partial<Omit<Drawing, 'layers'>>, coalesce?: string) => void;

  // document edits that create their own undo step
  setBase: (b: { sex?: Sex; view?: View; skin?: SkinId; pose?: PoseId }) => void;
  setRender: (r: RenderMode) => void;
  setShading: (on: boolean) => void;
  setFabric: (id: string, f: FabricKind) => void;
  setFabricScale: (id: string, v: number) => void;
  setMeasure: (id: string, m: Measure, inches: number) => void;
  addNote: (x: number, y: number) => string;
  editNote: (id: string, fn: (n: Draft<Note>) => void) => void;
  setNoteText: (id: string, t: string) => void;
  removeNote: (id: string) => void;
  addJeans: (fit: Fit) => void;
  addShorts: (length: ShortsLength, style?: ShortsStyle, hem?: HemKind) => void;
  addSkirt: (shape: SkirtShape, length?: SkirtLength) => void;
  addPants: (o: PantsOpts) => void;
  setPants: (id: string, patch: Partial<PantsOpts>) => void;
  addShoes: (o: ShoeOpts) => void;
  setShoes: (id: string, patch: Partial<ShoeOpts>) => void;
  setShortsLength: (id: string, length: ShortsLength) => void;
  setHem: (id: string, hem: HemKind) => void;
  setSkirt: (id: string, patch: { shape?: SkirtShape; length?: SkirtLength }) => void;
  addTop: (o: TopOpts) => void;
  setTop: (id: string, patch: Partial<TopOpts>) => void;
  removeGarment: (id: string) => void;
  toggleVisible: (id: string) => void;
  moveLayer: (id: string, dir: 1 | -1) => void;
  setFit: (id: string, fit: Fit) => void;
  setRise: (id: string, rise: Rise) => void;
  setWaist: (id: string, w: WaistKind) => void;
  setPocket: (id: string, p: PocketKind) => void;
  setWash: (id: string, w: WashName) => void;
  setTextSize: (id: string, i: number, size: number) => void;
  setTextValue: (id: string, i: number, t: string) => void;
  clearCut: (id: string) => void;
  removeItem: (id: string, kind: 'holes' | 'distress' | 'texts', i: number) => void;
  removePoint: (id: string, i: number) => boolean;

  // low level edits used inside a drag (no checkpoint, caller checkpoints once)
  edit: (id: string, fn: (g: Draft<Garment>) => void) => void;
}

const findG = (doc: Draft<Doc>, id: string) => doc.garments.find((g) => g.id === id);
const activeIndex = (layers: DrawLayer[], id: string | null) => {
  const i = layers.findIndex((l) => l.id === id);
  return i < 0 ? layers.length - 1 : i;
};
/** The layer strokes go onto: the picked one, or the top layer if it is gone. */
export const activeDrawLayer = (s: { doc: Doc; activeLayer: string | null }): DrawLayer => {
  const ls = s.doc.drawing.layers;
  return ls[activeIndex(ls, s.activeLayer)];
};

/** Write the working doc back into the project, so structural edits see every look's current state. */
function syncIn(st: Draft<State>) {
  const l = st.project.looks.find((x) => x.id === st.project.activeLook);
  if (l) l.doc = st.doc;
}
/** After a structural edit: the open look may have changed, and the doc title follows the names. */
function afterStruct(st: Draft<State>) {
  for (const l of st.project.looks) {
    const t = docTitle(st.project.season, l.name);
    if (l.doc.name !== t) l.doc = { ...l.doc, name: t };
  }
  const act = st.project.looks.find((x) => x.id === st.project.activeLook) ?? st.project.looks[0];
  st.project.activeLook = act.id;
  st.doc = act.doc;
  resetSelection(st);
}
function resetSelection(st: Draft<State>) {
  if (st.selectedId && !st.doc.garments.some((g) => g.id === st.selectedId)) st.selectedId = null;
  st.selectedText = null;
  if (st.selectedNote && !st.doc.notes.some((n) => n.id === st.selectedNote)) st.selectedNote = null;
  st.vsel = [];
  st.vnodes = [];
  st.activeLayer = null;
}
function applyStruct(st: Draft<State>, snap: Struct) {
  st.project = snap.project;
  const act = snap.project.looks.find((x) => x.id === snap.project.activeLook) ?? snap.project.looks[0];
  st.doc = act.doc;
  st.coalesceKey = null;
  resetSelection(st);
}

export const useStore = create<State>()(
  immer((set, get) => {
    /** Run a discrete edit as one undo step. */
    const step = (fn: (d: Draft<Doc>) => void, coalesce?: string) => {
      get().checkpoint(coalesce);
      set((s) => {
        fn(s.doc);
      });
    };

    /** Run a look or project level edit as one undo step (a whole project snapshot). */
    const pstep = (fn: (p: Draft<Project>) => void, o: { coalesce?: string; clear?: boolean } = {}) => {
      const s0 = get();
      if (!(o.coalesce && s0.coalesceKey === o.coalesce)) {
        const snap: Struct = { __s: 1, project: fullProject(s0) };
        set((st) => {
          if (o.clear) st.past = [];
          st.past.push(snap);
          if (st.past.length > HISTORY_LIMIT) st.past.shift();
          st.future = [];
          st.coalesceKey = o.coalesce ?? null;
        });
      }
      set((st) => {
        syncIn(st);
        fn(st.project);
        afterStruct(st);
      });
    };
    const switchTo = (id: string) => {
      set((st) => {
        syncIn(st);
        st.project.activeLook = id;
        afterStruct(st);
        st.past = [];
        st.future = [];
        st.coalesceKey = null;
      });
    };

    return {
      ...makeProductionActions(step, set as never),
      doc: emptyDoc(),
      project: newProject(),
      projects: [],
      screen: 'studio',
      past: [],
      future: [],
      coalesceKey: null,
      ready: false,

      tool: 'move',
      tab: 'sketch',
      selectedId: null,
      selectedText: null,
      selectedNote: null,
      holeSize: 'M',
      view: { x: 0, y: 0, k: 1 },
      drawTool: 'brush',
      drawPrefs: loadPrefs(),
      activeLayer: null,

      vtool: 'select',
      vsel: [],
      vnodes: [],
      vlayer: null,
      vstyle: defaultStyle(),
      setVTool: (t) =>
        set((s) => {
          s.vtool = t;
        }),
      setVSel: (ids) =>
        set((s) => {
          s.vsel = ids;
          s.vnodes = s.vnodes.filter((n) => ids.includes(n.id));
        }),
      setVNodes: (n) =>
        set((s) => {
          s.vnodes = n;
        }),
      setVLayer: (id) =>
        set((s) => {
          s.vlayer = id;
        }),
      setVStyle: (fn) =>
        set((s) => {
          fn(s.vstyle);
        }),
      vstep: (fn, coalesce) => step((d) => fn(d.vector), coalesce),
      vedit: (fn) =>
        set((s) => {
          fn(s.doc.vector);
        }),

      checkpoint: (coalesce) => {
        const s = get();
        if (coalesce && s.coalesceKey === coalesce) return;
        set((st) => {
          st.past.push(st.doc);
          if (st.past.length > HISTORY_LIMIT) st.past.shift();
          st.future = [];
          st.coalesceKey = coalesce ?? null;
        });
      },
      undo: () =>
        set((s) => {
          const prev = s.past.pop();
          if (!prev) return;
          if (isStruct(prev)) {
            s.future.push({ __s: 1, project: fullProject(current(s)) });
            applyStruct(s, prev);
            return;
          }
          s.future.push(s.doc);
          s.doc = prev;
          s.coalesceKey = null;
          s.selectedText = null;
          if (s.selectedNote && !prev.notes.some((n) => n.id === s.selectedNote)) s.selectedNote = null;
          if (s.selectedId && !prev.garments.some((g) => g.id === s.selectedId)) s.selectedId = null;
          s.vsel = s.vsel.filter((id) => findItem(prev.vector, id));
          s.vnodes = s.vnodes.filter((n) => s.vsel.includes(n.id));
        }),
      redo: () =>
        set((s) => {
          const next = s.future.pop();
          if (!next) return;
          if (isStruct(next)) {
            s.past.push({ __s: 1, project: fullProject(current(s)) });
            applyStruct(s, next);
            return;
          }
          s.past.push(s.doc);
          s.doc = next;
          s.coalesceKey = null;
          s.selectedText = null;
          if (s.selectedNote && !next.notes.some((n) => n.id === s.selectedNote)) s.selectedNote = null;
          if (s.selectedId && !next.garments.some((g) => g.id === s.selectedId)) s.selectedId = null;
          s.vsel = s.vsel.filter((id) => findItem(next.vector, id));
          s.vnodes = s.vnodes.filter((n) => s.vsel.includes(n.id));
        }),

      hydrate: (project, selectedId) =>
        set((s) => {
          const p = normalizeProject(project);
          s.project = p;
          s.doc = p.looks.find((l) => l.id === p.activeLook)!.doc;
          s.selectedId = selectedId && s.doc.garments.some((g) => g.id === selectedId) ? selectedId : null;
          s.selectedText = null;
          s.selectedNote = null;
          s.past = [];
          s.future = [];
          s.coalesceKey = null;
          s.vsel = [];
          s.vnodes = [];
          s.activeLayer = null;
          s.screen = 'studio';
          s.ready = true;
        }),
      setProjects: (p) =>
        set((s) => {
          s.projects = p;
        }),
      showHome: () =>
        set((s) => {
          s.screen = 'home';
          s.ready = true;
        }),
      ready0: () =>
        set((s) => {
          s.ready = true;
        }),

      setActiveLook: (id) => {
        if (id === get().project.activeLook) return;
        switchTo(id);
      },
      addLook: () => {
        const p = fullProject(get());
        const n = Math.max(0, ...p.looks.map((l) => Number(/^Look (\d+)$/.exec(l.name)?.[1] ?? 0)), p.looks.length) + 1;
        const look = newLook(n, get().doc, p.season);
        pstep(
          (pr) => {
            pr.looks.push(look);
            pr.activeLook = look.id;
          },
          { clear: true },
        );
      },
      duplicateLook: (id) => {
        const p = fullProject(get());
        const i = p.looks.findIndex((l) => l.id === id);
        if (i < 0) return;
        const copy = { id: newId(), name: `${p.looks[i].name} copy`, doc: cloneDoc(p.looks[i].doc) };
        pstep(
          (pr) => {
            pr.looks.splice(i + 1, 0, copy);
            pr.activeLook = copy.id;
          },
          { clear: true },
        );
      },
      deleteLook: (id) => {
        const p = get().project;
        if (p.looks.length <= 1) return;
        const wasActive = p.activeLook === id;
        pstep(
          (pr) => {
            const i = pr.looks.findIndex((l) => l.id === id);
            if (i < 0) return;
            pr.looks.splice(i, 1);
            if (wasActive) pr.activeLook = pr.looks[Math.max(0, i - 1)].id;
          },
          { clear: wasActive },
        );
      },
      moveLook: (id, dir) => {
        const arr = get().project.looks;
        const i = arr.findIndex((l) => l.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return;
        pstep((pr) => {
          const [l] = pr.looks.splice(i, 1);
          pr.looks.splice(j, 0, l);
        });
      },
      renameLook: (id, name) =>
        pstep(
          (pr) => {
            const l = pr.looks.find((x) => x.id === id);
            if (l) l.name = name;
          },
          { coalesce: `lookname:${id}` },
        ),
      copyGarmentToLook: (garmentId, lookId) => {
        const p = fullProject(get());
        const src = p.looks.find((l) => l.id === p.activeLook)?.doc.garments.find((g) => g.id === garmentId);
        const dst = p.looks.find((l) => l.id === lookId);
        if (!src || !dst || dst.id === p.activeLook) return;
        const copy: Garment = JSON.parse(JSON.stringify(src));
        copy.id = newId();
        copy.src = styleKey(src);
        copy.visible = true;
        if (copy.type !== 'top') copy.transform = placeOnCroquis(copy, dst.doc.base.sex, dst.doc.base.view);
        pstep((pr) => {
          pr.looks.find((l) => l.id === lookId)?.doc.garments.push(copy);
        });
      },
      setProjectInfo: (patch) =>
        pstep(
          (pr) => {
            Object.assign(pr, patch);
          },
          { coalesce: 'projinfo' },
        ),
      setStyleInfo: (key, patch) =>
        pstep(
          (pr) => {
            pr.styles[key] = { ...pr.styles[key], ...patch };
          },
          { coalesce: `style:${key}:${Object.keys(patch).join(',')}` },
        ),
      addMood: (item) =>
        pstep((pr) => {
          pr.mood.push(item);
        }),
      removeMood: (id) =>
        pstep((pr) => {
          pr.mood = pr.mood.filter((m) => m.id !== id);
        }),
      beginMood: () => pstep(() => {}),
      editMood: (id, patch) =>
        set((s) => {
          const m = s.project.mood.find((x) => x.id === id);
          if (m) Object.assign(m, patch);
        }),
      setMoodText: (id, text) =>
        pstep(
          (pr) => {
            const m = pr.mood.find((x) => x.id === id);
            if (m && m.kind === 'note') m.text = text;
            else if (m && m.kind === 'chip') m.label = text;
          },
          { coalesce: `moodtext:${id}` },
        ),

      setTool: (t) =>
        set((s) => {
          s.tool = t;
        }),
      setTab: (t) =>
        set((s) => {
          s.tab = t;
        }),
      select: (id) =>
        set((s) => {
          if (s.selectedId !== id) {
            s.selectedText = null;
            s.selectedGraphic = null;
          }
          s.selectedId = id;
          if (id) s.selectedNote = null;
        }),
      selectText: (i) =>
        set((s) => {
          s.selectedText = i;
        }),
      selectNote: (id) =>
        set((s) => {
          s.selectedNote = id;
          if (id) {
            s.selectedId = null;
            s.selectedText = null;
          }
        }),
      setHoleSize: (h) =>
        set((s) => {
          s.holeSize = h;
        }),
      setView: (v) =>
        set((s) => {
          s.view = v;
        }),

      setDrawTool: (t) =>
        set((s) => {
          s.drawTool = t;
        }),
      setDrawPrefs: (fn) => {
        set((s) => {
          fn(s.drawPrefs);
        });
        savePrefs(get().drawPrefs);
      },
      setActiveLayer: (id) =>
        set((s) => {
          s.activeLayer = id;
        }),

      addStroke: (layerId, st) =>
        step((d) => {
          d.drawing.layers.find((l) => l.id === layerId)?.strokes.push(st);
        }),
      addDrawLayer: () => {
        const layers = get().doc.drawing.layers;
        if (layers.length >= MAX_DRAW_LAYERS) return;
        const n = Math.max(0, ...layers.map((l) => Number(/^Layer (\d+)$/.exec(l.name)?.[1] ?? 0))) + 1;
        const nl = newDrawLayer(n);
        const at = activeIndex(layers, get().activeLayer);
        step((d) => {
          d.drawing.layers.splice(at + 1, 0, nl);
        });
        set((s) => {
          s.activeLayer = nl.id;
        });
      },
      removeDrawLayer: (id) => {
        const layers = get().doc.drawing.layers;
        const i = layers.findIndex((l) => l.id === id);
        if (i < 0) return;
        step((d) => {
          d.drawing.layers.splice(i, 1);
          if (d.drawing.layers.length === 0) d.drawing.layers.push(newDrawLayer(1));
        });
        set((s) => {
          const ls = s.doc.drawing.layers;
          s.activeLayer = ls[Math.max(0, Math.min(i - 1, ls.length - 1))].id;
        });
      },
      duplicateDrawLayer: (id) => {
        const layers = get().doc.drawing.layers;
        const i = layers.findIndex((l) => l.id === id);
        if (i < 0 || layers.length >= MAX_DRAW_LAYERS) return;
        const copy: DrawLayer = { ...layers[i], id: newId(), name: `${layers[i].name} copy` };
        step((d) => {
          d.drawing.layers.splice(i + 1, 0, copy);
        });
        set((s) => {
          s.activeLayer = copy.id;
        });
      },
      clearDrawLayer: (id) =>
        step((d) => {
          const l = d.drawing.layers.find((x) => x.id === id);
          if (l) l.strokes = [];
        }),
      moveDrawLayer: (id, dir) => {
        const arr = get().doc.drawing.layers;
        const i = arr.findIndex((l) => l.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return;
        step((d) => {
          const [l] = d.drawing.layers.splice(i, 1);
          d.drawing.layers.splice(j, 0, l);
        });
      },
      setDrawLayer: (id, patch, coalesce) =>
        step((d) => {
          const l = d.drawing.layers.find((x) => x.id === id);
          if (l) Object.assign(l, patch);
        }, coalesce),
      setDrawing: (patch, coalesce) => step((d) => void Object.assign(d.drawing, patch), coalesce),

      setBase: (b) => step((d) => void Object.assign(d.base, b)),

      setRender: (r) => step((d) => void (d.settings.render = r)),
      setShading: (on) => step((d) => void (d.settings.shading = on)),
      setFabric: (id, f) =>
        step((d) => {
          const g = findG(d, id);
          if (g) g.fabric = f;
        }),
      setFabricScale: (id, v) =>
        step(
          (d) => {
            const g = findG(d, id);
            if (g) g.fabricScale = v;
          },
          `fabscale:${id}`,
        ),
      setMeasure: (id, m, inches) =>
        step(
          (d) => {
            const g = findG(d, id);
            if (g) applyMeasure(g, m, inches);
          },
          `measure:${id}:${m}`,
        ),
      addNote: (x, y) => {
        const id = newId();
        get().checkpoint();
        set((s) => {
          s.doc.notes.push({ id, x, y, text: 'note', tx: x - 40, ty: y + 70 });
          s.selectedNote = id;
          s.selectedId = null;
          s.selectedText = null;
        });
        return id;
      },
      editNote: (id, fn) =>
        set((s) => {
          const n = s.doc.notes.find((x) => x.id === id);
          if (n) fn(n);
        }),
      setNoteText: (id, t) =>
        step(
          (d) => {
            const n = d.notes.find((x) => x.id === id);
            if (n) n.text = t;
          },
          `note:${id}`,
        ),
      removeNote: (id) => {
        get().checkpoint();
        set((s) => {
          s.doc.notes = s.doc.notes.filter((n) => n.id !== id);
          if (s.selectedNote === id) s.selectedNote = null;
        });
      },

      addJeans: (fit) => {
        const g = createJeans(fit, 'Mid');
        const { sex, view } = get().doc.base;
        g.transform = placeOnCroquis(g, sex, view);
        get().checkpoint();
        set((s) => {
          s.doc.garments.push(g);
          s.selectedId = g.id;
          s.selectedText = null;
          s.tool = 'move';
        });
      },
      addShorts: (length, style, hem) => {
        const g = createShorts(length, undefined, style, hem);
        const { sex, view } = get().doc.base;
        g.transform = placeOnCroquis(g, sex, view);
        get().checkpoint();
        set((s) => {
          s.doc.garments.push(g);
          s.selectedId = g.id;
          s.selectedText = null;
          s.tool = 'move';
        });
      },
      addSkirt: (shape, length = 'Mini') => {
        const g = createSkirt(shape, length);
        const { sex, view } = get().doc.base;
        g.transform = placeOnCroquis(g, sex, view);
        get().checkpoint();
        set((s) => {
          s.doc.garments.push(g);
          s.selectedId = g.id;
          s.selectedText = null;
          s.tool = 'move';
        });
      },
      addPants: (o) => {
        const g = createPants(o);
        const { sex, view } = get().doc.base;
        g.transform = placeOnCroquis(g, sex, view);
        get().checkpoint();
        set((s) => {
          s.doc.garments.push(g);
          s.selectedId = g.id;
          s.selectedText = null;
          s.tool = 'move';
        });
      },
      setPants: (id, patch) =>
        step((d) => {
          const g = findG(d, id);
          if (!g || !g.pants) return;
          Object.assign(g.pants, patch);
          if (patch.block && patch.block !== 'Jogger') delete g.pants.open;
          if (patch.open !== undefined && g.pants.block === 'Jogger' && !patch.block) {
            g.parts.hem = patch.open ? 'Clean' : 'Rib';
            g.fit = patch.open ? 'Baggy' : 'Straight';
          }
          if (patch.block) {
            const look = PANTS_LOOK[patch.block];
            g.block = patch.block.toLowerCase();
            g.fabric = look.fabric;
            g.wash = look.wash;
            g.fit = look.fit;
            g.parts = { ...look.parts };
          }
          g.points = buildPantsPoints(g.pants, g.fit, g.rise, g.parts.hem);
          g.name = pantsName(g.pants);
        }),
      addShoes: (o) => {
        const g = createShoes(o);
        get().checkpoint();
        set((s) => {
          s.doc.garments.push(g);
          s.selectedId = g.id;
          s.selectedText = null;
          s.tool = 'move';
        });
      },
      setShoes: (id, patch) =>
        step((d) => {
          const g = findG(d, id);
          if (!g || !g.shoes) return;
          Object.assign(g.shoes, patch);
          g.name = shoeName(g.shoes);
          g.block = g.shoes.kind;
        }),
      setShortsLength: (id, length) =>
        step((d) => {
          const g = findG(d, id);
          if (!g || !g.shorts) return;
          g.shorts = { length, inseam: SHORTS_INSEAM[length], ...(g.shorts.style ? { style: g.shorts.style } : {}) };
          g.points = buildShortsPoints(g.fit, g.rise, g.shorts.inseam);
          g.name = g.shorts.style ? SHORTS_STYLE_NAME[g.shorts.style] : shortsLabel(length);
        }),
      setHem: (id, hem) =>
        step((d) => {
          const g = findG(d, id);
          if (!g) return;
          g.parts.hem = hem;
          if (g.pants) g.points = buildPantsPoints(g.pants, g.fit, g.rise, hem);
        }),
      setSkirt: (id, patch) =>
        step((d) => {
          const g = findG(d, id);
          if (!g || !g.skirt) return;
          if (patch.shape) {
            g.skirt.shape = patch.shape;
            g.skirt.sweep = null;
            g.name = `${patch.shape} skirt`;
            g.block = patch.shape.toLowerCase();
          }
          if (patch.length) {
            g.skirt.length = patch.length;
            g.skirt.len = SKIRT_LEN[patch.length];
          }
          g.points = buildSkirtPoints(g.skirt);
        }),
      addTop: (o) => {
        const g = createTop(o);
        get().checkpoint();
        set((s) => {
          s.doc.garments.push(g);
          s.selectedId = g.id;
          s.selectedText = null;
          s.tool = 'move';
        });
      },
      setTop: (id, patch) =>
        step((d) => {
          const g = findG(d, id);
          if (!g || !g.top) return;
          Object.assign(g.top, patch);
          if (patch.length && patch.tuck === undefined) g.top.tuck = false;
          g.points = buildTopPoints(g.top);
          g.name = topName(g.top);
          if (patch.block) {
            const look = BLOCK_LOOK[patch.block];
            g.fabric = look?.fabric ?? (patch.block === 'Tank' ? 'Rib' : 'Jersey');
            if (look) g.wash = look.wash;
          }
        }),
      removeGarment: (id) => {
        get().checkpoint();
        set((s) => {
          s.doc.garments = s.doc.garments.filter((g) => g.id !== id);
          if (s.selectedId === id) {
            s.selectedId = null;
            s.selectedText = null;
          }
        });
      },
      toggleVisible: (id) =>
        step((d) => {
          const g = findG(d, id);
          if (g) g.visible = !g.visible;
        }),
      moveLayer: (id, dir) => {
        const arr = get().doc.garments;
        const i = arr.findIndex((g) => g.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return;
        step((d) => {
          const [g] = d.garments.splice(i, 1);
          d.garments.splice(j, 0, g);
        });
      },

      setFit: (id, fit) =>
        step((d) => {
          const g = findG(d, id);
          if (!g) return;
          g.fit = fit;
          if (g.pants) {
            g.points = buildPantsPoints(g.pants, fit, g.rise, g.parts.hem);
            return;
          }
          if (g.type === 'shorts' && g.shorts) {
            g.points = buildShortsPoints(fit, g.rise, g.shorts.inseam);
            return;
          }
          g.points = buildPoints(fit, g.rise);
          g.name = `${fit} jeans`;
        }),
      setRise: (id, rise) =>
        step((d) => {
          const g = findG(d, id);
          if (!g) return;
          g.rise = rise;
          if (g.pants) {
            g.points = buildPantsPoints(g.pants, g.fit, rise, g.parts.hem);
            return;
          }
          g.points = g.type === 'shorts' && g.shorts ? buildShortsPoints(g.fit, rise, g.shorts.inseam) : buildPoints(g.fit, rise);
        }),
      setWaist: (id, w) =>
        step((d) => {
          const g = findG(d, id);
          if (g) g.parts.waist = w;
        }),
      setPocket: (id, p) =>
        step((d) => {
          const g = findG(d, id);
          if (g) g.parts.pocket = p;
        }),
      setWash: (id, w) =>
        step((d) => {
          const g = findG(d, id);
          if (!g) return;
          g.wash = w;
          delete g.colorHex;
          delete g.colorName;
          delete g.pantone;
          syncColorway(d, g);
        }),
      setTextSize: (id, i, size) =>
        step((d) => {
          const t = findG(d, id)?.texts[i];
          if (t) t.size = size;
        }),
      setTextValue: (id, i, t) =>
        step(
          (d) => {
            const x = findG(d, id)?.texts[i];
            if (x) x.t = t;
          },
          `text:${id}:${i}`,
        ),
      clearCut: (id) =>
        step((d) => {
          const g = findG(d, id);
          if (g) g.cropY = null;
        }),
      removeItem: (id, kind, i) => {
        step((d) => {
          const g = findG(d, id);
          if (g) (g[kind] as unknown[]).splice(i, 1);
        });
        set((s) => {
          s.selectedText = null;
        });
      },
      removePoint: (id, i) => {
        const g = get().doc.garments.find((x) => x.id === id);
        if (!g || g.points.length <= MIN_POINTS) return false;
        step((d) => {
          findG(d, id)?.points.splice(i, 1);
        });
        return true;
      },

      edit: (id, fn) =>
        set((s) => {
          const g = findG(s.doc, id);
          if (g) fn(g);
        }),
    };
  }),
);

export const canUndo = (s: State) => s.past.length > 0;
export const canRedo = (s: State) => s.future.length > 0;

// helpers used by the canvas when it places things
export const holeRadius = (s: HoleSize) => HOLE_SIZES[s];
export const defaultText = (x: number, y: number): GText => ({ x, y, t: 'SDTN', size: TEXT_SIZES.Medium });
export type { Pt };
