// Store actions for graphics, colorways, trims, construction and the bill of materials.
import type { Draft } from 'immer';
import type { Doc } from './model/doc';
import { WASHES, type Garment, type WashName } from './model/garment';
import {
  DEFAULT_PALETTE,
  garmentColor,
  HEX_RE,
  newGraphic,
  newProdId,
  newTrim,
  constructionOf,
  fabricInfoOf,
  type AllOver,
  type ColorChoice,
  type Graphic,
  type PaletteColor,
  type Trim,
  type TrimKind,
} from './model/production';

export interface ProductionActions {
  selectedGraphic: string | null;
  selectGraphic: (id: string | null) => void;

  addGraphic: (gid: string, art: { name: string; src: string; aspect: number }, side: 'front' | 'back') => void;
  setGraphic: (gid: string, id: string, patch: Partial<Omit<Graphic, 'id'>>, coalesce?: string) => void;
  removeGraphic: (gid: string, id: string) => void;
  setAllOver: (gid: string, art: { name: string; src: string; aspect: number } | null) => void;
  setAllOverProps: (gid: string, patch: Partial<AllOver>, coalesce?: string) => void;

  setGarmentColor: (gid: string, c: ColorChoice) => void;
  addPaletteColor: (c: Omit<PaletteColor, 'id'>) => void;
  updatePaletteColor: (id: string, patch: Partial<Omit<PaletteColor, 'id'>>, coalesce?: string) => void;
  removePaletteColor: (id: string) => void;
  savePalette: (name: string) => void;
  loadPalette: (id: string) => void;
  deletePalette: (id: string) => void;
  addColorway: () => void;
  renameColorway: (id: string, name: string) => void;
  removeColorway: (id: string) => void;
  applyColorway: (id: string) => void;

  addTrim: (gid: string, kind: TrimKind) => void;
  setTrim: (gid: string, id: string, patch: Partial<Omit<Trim, 'id' | 'kind'>>, coalesce?: string) => void;
  removeTrim: (gid: string, id: string) => void;

  setFabricInfo: (gid: string, patch: Partial<import('./model/production').FabricInfo>, coalesce?: string) => void;
  setConstruction: (gid: string, patch: Partial<import('./model/production').Construction>, coalesce?: string) => void;
  setBomCost: (gid: string, key: string, cost: number | undefined, coalesce?: string) => void;
}

type Step = (fn: (d: Draft<Doc>) => void, coalesce?: string) => void;
type SelectedSlice = { selectedGraphic: string | null };

const findG = (d: Draft<Doc>, id: string) => d.garments.find((g) => g.id === id);

/** Keep the active colorway in step with a garment that was just recolored. */
function syncColorway(d: Draft<Doc>, g: Draft<Garment>) {
  const cw = d.colorways?.find((c) => c.id === d.activeColorway);
  if (cw) cw.colors[g.id] = garmentColor(g);
}

function putColor(g: Draft<Garment>, c: ColorChoice) {
  const wash = (Object.keys(WASHES) as WashName[]).find((w) => w === c.name && WASHES[w].toLowerCase() === c.hex.toLowerCase());
  if (wash) {
    g.wash = wash;
    delete g.colorHex;
    delete g.colorName;
    delete g.pantone;
    return;
  }
  g.colorHex = c.hex;
  g.colorName = c.name;
  if (c.pantone) g.pantone = c.pantone;
  else delete g.pantone;
}

export { syncColorway };

export function makeProductionActions(step: Step, set: (fn: (s: SelectedSlice & { doc: Doc }) => void) => void): ProductionActions {
  const gfx = (d: Draft<Doc>, gid: string, id: string) => findG(d, gid)?.graphics?.find((x) => x.id === id);
  return {
    selectedGraphic: null,
    selectGraphic: (id) =>
      set((s) => {
        s.selectedGraphic = id;
      }),

    addGraphic: (gid, art, side) => {
      const id = { v: '' };
      step((d) => {
        const g = findG(d, gid);
        if (!g) return;
        const gr = newGraphic(art, g as Garment, side);
        id.v = gr.id;
        (g.graphics ??= []).push(gr);
      });
      set((s) => {
        s.selectedGraphic = id.v || null;
      });
    },
    setGraphic: (gid, id, patch, coalesce) =>
      step((d) => {
        const x = gfx(d, gid, id);
        if (x) Object.assign(x, patch);
      }, coalesce),
    removeGraphic: (gid, id) => {
      step((d) => {
        const g = findG(d, gid);
        if (g?.graphics) g.graphics = g.graphics.filter((x) => x.id !== id);
      });
      set((s) => {
        if (s.selectedGraphic === id) s.selectedGraphic = null;
      });
    },
    setAllOver: (gid, art) =>
      step((d) => {
        const g = findG(d, gid);
        if (!g) return;
        if (!art) delete g.allOver;
        else g.allOver = { name: art.name, src: art.src, aspect: art.aspect, scale: g.type === 'top' ? 60 : 50, rot: 0 };
      }),
    setAllOverProps: (gid, patch, coalesce) =>
      step((d) => {
        const g = findG(d, gid);
        if (g?.allOver) Object.assign(g.allOver, patch);
      }, coalesce),

    setGarmentColor: (gid, c) =>
      step((d) => {
        const g = findG(d, gid);
        if (!g) return;
        putColor(g, c);
        syncColorway(d, g);
      }),
    addPaletteColor: (c) =>
      step((d) => {
        if (!d.palette) d.palette = DEFAULT_PALETTE.map((p) => ({ ...p }));
        d.palette.push({ id: newProdId(), name: c.name, hex: HEX_RE.test(c.hex) ? c.hex : '#808080', pantone: c.pantone });
      }),
    updatePaletteColor: (id, patch, coalesce) =>
      step((d) => {
        const pal = (d.palette ??= DEFAULT_PALETTE.map((p) => ({ ...p })));
        const c = pal.find((x) => x.id === id);
        if (c) Object.assign(c, patch);
      }, coalesce),
    removePaletteColor: (id) =>
      step((d) => {
        d.palette = (d.palette ?? DEFAULT_PALETTE).filter((x) => x.id !== id).map((x) => ({ ...x }));
      }),
    savePalette: (name) =>
      step((d) => {
        (d.palettes ??= []).push({ id: newProdId(), name: name.trim() || `Palette ${(d.palettes?.length ?? 0) + 1}`, colors: (d.palette ?? DEFAULT_PALETTE).map((c) => ({ ...c })) });
      }),
    loadPalette: (id) =>
      step((d) => {
        const p = d.palettes?.find((x) => x.id === id);
        if (p) d.palette = p.colors.map((c) => ({ ...c }));
      }),
    deletePalette: (id) =>
      step((d) => {
        if (d.palettes) d.palettes = d.palettes.filter((x) => x.id !== id);
      }),

    addColorway: () =>
      step((d) => {
        const list = (d.colorways ??= []);
        const colors: Record<string, ColorChoice> = {};
        for (const g of d.garments) colors[g.id] = garmentColor(g);
        const letter = String.fromCharCode(65 + (list.length % 26));
        const id = newProdId();
        list.push({ id, name: `Colorway ${letter}`, colors });
        d.activeColorway = id;
      }),
    renameColorway: (id, name) =>
      step((d) => {
        const c = d.colorways?.find((x) => x.id === id);
        if (c) c.name = name;
      }, `cwname:${id}`),
    removeColorway: (id) =>
      step((d) => {
        if (!d.colorways) return;
        d.colorways = d.colorways.filter((x) => x.id !== id);
        if (d.activeColorway === id) d.activeColorway = d.colorways[0]?.id;
      }),
    applyColorway: (id) =>
      step((d) => {
        const cw = d.colorways?.find((x) => x.id === id);
        if (!cw) return;
        d.activeColorway = id;
        for (const g of d.garments) {
          const c = cw.colors[g.id];
          if (c) putColor(g, c);
        }
      }),

    addTrim: (gid, kind) =>
      step((d) => {
        const g = findG(d, gid);
        if (g) (g.trims ??= []).push(newTrim(kind));
      }),
    setTrim: (gid, id, patch, coalesce) =>
      step((d) => {
        const t = findG(d, gid)?.trims?.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
      }, coalesce),
    removeTrim: (gid, id) =>
      step((d) => {
        const g = findG(d, gid);
        if (g?.trims) g.trims = g.trims.filter((x) => x.id !== id);
      }),

    setFabricInfo: (gid, patch, coalesce) =>
      step((d) => {
        const g = findG(d, gid);
        if (g) g.fabricInfo = { ...fabricInfoOf(g as Garment), ...patch };
      }, coalesce),
    setConstruction: (gid, patch, coalesce) =>
      step((d) => {
        const g = findG(d, gid);
        if (g) g.construction = { ...constructionOf(g as Garment), ...patch };
      }, coalesce),
    setBomCost: (gid, key, cost, coalesce) =>
      step((d) => {
        const g = findG(d, gid);
        if (!g) return;
        const v = cost == null || Number.isNaN(cost) ? undefined : cost;
        if (key === 'fabric') {
          g.fabricInfo = { ...fabricInfoOf(g as Garment), cost: v };
        } else if (key.startsWith('trim:')) {
          const t = g.trims?.find((x) => x.id === key.slice(5));
          if (t) t.cost = v;
        } else {
          const m = (g.bomCost ??= {});
          if (v == null) delete m[key];
          else m[key] = v;
        }
      }, coalesce),
  };
}
