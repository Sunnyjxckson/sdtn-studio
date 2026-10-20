import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';
import { emptyDoc, normalizeDoc, type Doc, type RenderMode } from './model/doc';
import type { Note } from './model/note';
import type { Sex, SkinId, View } from './model/croquis';
import type { PoseId } from './model/figure';
import {
  applyMeasure,
  buildPoints,
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
import { buildTopPoints, type TopOpts } from './model/top';
import { newId } from './model/garment';
import { brushById, MAX_DRAW_LAYERS, newDrawLayer, type BrushId, type DrawLayer, type Drawing, type Stroke } from './model/draw';

export type Tool = 'move' | 'add' | 'erase' | 'cut' | 'hole' | 'distress' | 'text' | 'note' | 'hand';
export type Tab = 'sketch' | 'draw' | 'flats' | 'pattern';
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

interface State {
  doc: Doc;
  past: Doc[];
  future: Doc[];
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

  // history
  checkpoint: (coalesce?: string) => void;
  undo: () => void;
  redo: () => void;

  // lifecycle
  hydrate: (doc: Doc | null, selectedId: string | null) => void;

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

export const useStore = create<State>()(
  immer((set, get) => {
    /** Run a discrete edit as one undo step. */
    const step = (fn: (d: Draft<Doc>) => void, coalesce?: string) => {
      get().checkpoint(coalesce);
      set((s) => {
        fn(s.doc);
      });
    };

    return {
      doc: emptyDoc(),
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
          s.future.push(s.doc);
          s.doc = prev;
          s.coalesceKey = null;
          s.selectedText = null;
          if (s.selectedNote && !prev.notes.some((n) => n.id === s.selectedNote)) s.selectedNote = null;
          if (s.selectedId && !prev.garments.some((g) => g.id === s.selectedId)) s.selectedId = null;
        }),
      redo: () =>
        set((s) => {
          const next = s.future.pop();
          if (!next) return;
          s.past.push(s.doc);
          s.doc = next;
          s.coalesceKey = null;
          s.selectedText = null;
          if (s.selectedNote && !next.notes.some((n) => n.id === s.selectedNote)) s.selectedNote = null;
          if (s.selectedId && !next.garments.some((g) => g.id === s.selectedId)) s.selectedId = null;
        }),

      hydrate: (doc, selectedId) =>
        set((s) => {
          if (doc) {
            s.doc = normalizeDoc(doc);
            s.selectedId = selectedId && doc.garments.some((g) => g.id === selectedId) ? selectedId : null;
          }
          s.ready = true;
        }),

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
          if (s.selectedId !== id) s.selectedText = null;
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
          const n = g.top.block === 'Tank' ? 'tank' : g.top.block === 'Tee' ? 'tee' : 'long sleeve';
          g.name = `${g.top.fit} ${n}`;
          if (patch.block) g.fabric = patch.block === 'Tank' ? 'Rib' : 'Jersey';
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
          g.points = buildPoints(fit, g.rise);
          g.name = `${fit} jeans`;
        }),
      setRise: (id, rise) =>
        step((d) => {
          const g = findG(d, id);
          if (!g) return;
          g.rise = rise;
          g.points = buildPoints(g.fit, rise);
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
          if (g) g.wash = w;
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
