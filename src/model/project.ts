// The collection layer: Project > Look > Doc. A look is one Doc (one outfit on one body).
import { emptyDoc, normalizeDoc, type Doc } from './doc';
import { newId, type Garment } from './garment';
import { garmentColor } from './production';

export interface Look {
  id: string;
  name: string;
  doc: Doc;
}

/** Line sheet fields the designer can override. Empty means use the default. */
export interface StyleInfo {
  number?: string;
  name?: string;
  colorways?: string;
  fabric?: string;
  price?: string;
}

export type MoodItem =
  | { id: string; kind: 'image'; x: number; y: number; w: number; h: number; src: string }
  | { id: string; kind: 'note'; x: number; y: number; w: number; text: string }
  | { id: string; kind: 'chip'; x: number; y: number; color: string; label: string };

export interface Project {
  id: string;
  name: string;
  season: string;
  created: number;
  updated: number;
  looks: Look[];
  activeLook: string;
  /** Keyed by style key (see styleKey). */
  styles: Record<string, StyleInfo>;
  mood: MoodItem[];
}

export const MOOD_W = 1800;
export const MOOD_H = 1200;

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const pad3 = (n: number) => String(n).padStart(3, '0');
export const styleKey = (g: Garment) => g.src ?? g.id;
export const docTitle = (season: string, lookName: string) => `${season} / ${lookName}`;

export function newLook(n: number, base?: Doc, season = 'FW27'): Look {
  const name = `Look ${pad2(n)}`;
  const doc = emptyDoc();
  if (base) {
    doc.base = { ...base.base };
    doc.settings = { ...base.settings };
    // the palette is the collection's, so a new look starts with the same colors
    if (base.palette) doc.palette = base.palette.map((c) => ({ ...c }));
    if (base.palettes) doc.palettes = base.palettes.map((p) => ({ ...p, colors: p.colors.map((c) => ({ ...c })) }));
  }
  doc.name = docTitle(season, name);
  return { id: newId(), name, doc };
}

export function newProject(name = 'Untitled collection', season = 'FW27'): Project {
  const look = newLook(1, undefined, season);
  const now = Date.now();
  return { id: newId(), name, season, created: now, updated: now, looks: [look], activeLook: look.id, styles: {}, mood: [] };
}

/** Wrap a pre collection single document as a project, so nobody loses work. */
export function projectFromLegacy(doc: Doc): Project {
  const m = /^(.*?)\s*\/\s*(.+)$/.exec(doc.name ?? '');
  const season = m ? m[1].trim() || 'FW27' : 'FW27';
  const lookName = m ? m[2].trim() : 'Look 01';
  const p = newProject(season, season);
  p.looks[0].name = lookName;
  p.looks[0].doc = { ...normalizeDoc(doc), name: docTitle(season, lookName) };
  return p;
}

export function normalizeProject(p: Project): Project {
  const looks = (p.looks ?? []).map((l) => ({ id: l.id ?? newId(), name: l.name ?? 'Look', doc: normalizeDoc(l.doc) }));
  if (!looks.length) looks.push(newProject().looks[0]);
  return {
    id: p.id ?? newId(),
    name: p.name ?? 'Untitled collection',
    season: p.season ?? 'FW27',
    created: p.created ?? Date.now(),
    updated: p.updated ?? Date.now(),
    looks,
    activeLook: looks.some((l) => l.id === p.activeLook) ? p.activeLook : looks[0].id,
    styles: p.styles ?? {},
    mood: p.mood ?? [],
  };
}

/** Deep copy a doc with new garment ids. Copies keep a src link to the original style. */
export function cloneDoc(d: Doc): Doc {
  const c: Doc = JSON.parse(JSON.stringify(d));
  const ids = new Map<string, string>();
  c.garments = c.garments.map((g) => {
    const id = newId();
    ids.set(g.id, id);
    return { ...g, id, src: g.src ?? g.id };
  });
  // colorways are keyed by garment id, so follow the new ids
  if (c.colorways) {
    c.colorways = c.colorways.map((cw) => ({ ...cw, colors: Object.fromEntries(Object.entries(cw.colors).map(([k, v]) => [ids.get(k) ?? k, v])) }));
  }
  return c;
}

export interface StyleRow {
  key: string;
  g: Garment;
  /** 1 based look numbers this style appears in. */
  looks: number[];
  number: string;
  name: string;
  colorways: string;
  fabric: string;
  price: string;
}

/** One row per style, in look order, with defaults filled in. */
export function styleRows(p: Project): StyleRow[] {
  const rows: StyleRow[] = [];
  const byKey = new Map<string, StyleRow>();
  p.looks.forEach((l, li) => {
    for (const g of l.doc.garments) {
      const k = styleKey(g);
      const hit = byKey.get(k);
      if (hit) {
        if (!hit.looks.includes(li + 1)) hit.looks.push(li + 1);
        const cn = garmentColor(g).name;
        if (!p.styles[k]?.colorways && !hit.colorways.split(', ').includes(cn)) hit.colorways += `, ${cn}`;
        continue;
      }
      const info = p.styles[k] ?? {};
      const row: StyleRow = {
        key: k,
        g,
        looks: [li + 1],
        number: info.number || `SDTN-${p.season.replace(/\s+/g, '')}-${pad3(rows.length + 1)}`,
        name: info.name || g.name,
        colorways: info.colorways || garmentColor(g).name,
        fabric: info.fabric || g.fabric,
        price: info.price ?? '',
      };
      rows.push(row);
      byKey.set(k, row);
    }
  });
  return rows;
}
