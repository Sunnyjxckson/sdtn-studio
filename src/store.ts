import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Draft } from 'immer';
import { emptyDoc, normalizeDoc, type Doc, type RenderMode } from './model/doc';
import type { Note } from './model/note';
import type { Sex, SkinId, View } from './model/croquis';
import {
  applyMeasure,
  buildPoints,
  type FabricKind,
  type Measure,
  createJeans,
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
import { newId } from './model/garment';

export type Tool = 'move' | 'add' | 'erase' | 'cut' | 'hole' | 'distress' | 'text' | 'note' | 'hand';
export type Tab = 'sketch' | 'flats' | 'pattern';

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

  // document edits that create their own undo step
  setBase: (b: { sex?: Sex; view?: View; skin?: SkinId }) => void;
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
