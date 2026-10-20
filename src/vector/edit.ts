// Shared vector editing helpers: adding items, selection, drag transforms, clipboard.
import type { Draft } from 'immer';
import { useStore } from '../store';
import {
  cloneItem,
  findItem,
  isEditable,
  itemsBox,
  orderedSelection,
  pathsIn,
  transformItem,
  type Box,
  type Mat,
  type VectorDoc,
  type VItem,
  type VLayer,
  type VStyle,
} from '../model/vector';

export const vs = () => useStore.getState();
export const vdoc = () => vs().doc.vector;

/** The layer new items go into: the picked one, else the top visible unlocked layer. */
export function targetLayer(v: VectorDoc | Draft<VectorDoc>, prefer: string | null): VLayer | Draft<VLayer> {
  const picked = v.layers.find((l) => l.id === prefer && l.visible && !l.locked);
  if (picked) return picked;
  for (let i = v.layers.length - 1; i >= 0; i--) if (v.layers[i].visible && !v.layers[i].locked) return v.layers[i];
  return v.layers[v.layers.length - 1];
}

/** Add items on top of the target layer as one undo step, and select them. */
export function addItems(items: VItem[], opts: { select?: boolean; checkpoint?: boolean } = {}) {
  const st = vs();
  const lid = targetLayer(st.doc.vector, st.vlayer).id;
  const fn = (v: Draft<VectorDoc>) => {
    const l = v.layers.find((x) => x.id === lid);
    if (l) {
      l.visible = true;
      l.locked = false;
      l.items.push(...(items as Draft<VItem>[]));
    }
  };
  if (opts.checkpoint === false) st.vedit(fn);
  else st.vstep(fn);
  if (opts.select !== false) st.setVSel(items.map((i) => i.id));
}

/** Selected items that can be edited, in stacking order, nested duplicates removed. */
export function selectedItems(v: VectorDoc = vdoc(), ids: string[] = vs().vsel): VItem[] {
  return orderedSelection(v, ids)
    .map((id) => findItem(v, id))
    .filter((f) => f && isEditable(f))
    .map((f) => f!.item);
}

export function selectionBox(): Box | null {
  return itemsBox(selectedItems());
}

/** Every path in the selection, groups opened up. */
export function selectedPaths() {
  return selectedItems().flatMap(pathsIn);
}

// ---------- drag transforms ----------

let originals: Map<string, VItem> | null = null;

/** Remember the selection before a drag so each move is applied to the original, not compounded. */
export function beginTransform(ids: string[] = vs().vsel) {
  const v = vdoc();
  originals = new Map();
  for (const id of orderedSelection(v, ids)) {
    const f = findItem(v, id);
    if (f && isEditable(f)) originals.set(id, structuredClone(f.item));
  }
  vs().checkpoint();
}

export function applyTransform(m: Mat) {
  if (!originals) return;
  const o = originals;
  vs().vedit((v) => {
    for (const [id, orig] of o) {
      const f = findItem(v as VectorDoc, id);
      if (!f) continue;
      const c = structuredClone(orig);
      transformItem(c, m);
      (f.list as VItem[])[f.index] = c;
    }
  });
}

export const endTransform = () => void (originals = null);

/** Transform the selection as one undo step. */
export function transformSelection(m: Mat, ids: string[] = vs().vsel) {
  vs().vstep((v) => {
    for (const id of orderedSelection(v as VectorDoc, ids)) {
      const f = findItem(v as VectorDoc, id);
      if (f && isEditable(f)) transformItem(f.item as VItem, m);
    }
  });
}

/** Edit every selected path's style (or the default style when nothing is selected). */
export function editStyle(fn: (s: Draft<VStyle> | VStyle) => void, coalesce?: string) {
  const st = vs();
  const ids = orderedSelection(st.doc.vector, st.vsel);
  if (ids.length === 0) {
    st.setVStyle(fn);
    return;
  }
  st.vstep((v) => {
    for (const id of ids) {
      const f = findItem(v as VectorDoc, id);
      if (!f || !isEditable(f)) continue;
      const all = (it: VItem): VItem[] => (it.kind === 'group' ? it.children.flatMap(all) : [it]);
      for (const leaf of all(f.item as VItem)) if (leaf.kind !== 'group') fn(leaf.style);
    }
  }, coalesce);
  // new shapes follow the last edit, like Illustrator
  st.setVStyle(fn);
}

/** The style the Appearance panel shows. */
export function shownStyle(): VStyle {
  const st = vs();
  for (const it of selectedItems()) {
    const leaf = it.kind === 'group' ? firstLeaf(it) : it;
    if (leaf && leaf.kind !== 'group') return leaf.style;
  }
  return st.vstyle;
}
function firstLeaf(it: VItem): VItem | null {
  if (it.kind !== 'group') return it;
  for (const c of it.children) {
    const l = firstLeaf(c);
    if (l) return l;
  }
  return null;
}

/** Remove items by id. Returns them in stacking order. */
export function removeIds(v: Draft<VectorDoc>, ids: string[]): VItem[] {
  const out: VItem[] = [];
  for (const id of orderedSelection(v as VectorDoc, ids)) {
    const f = findItem(v as VectorDoc, id);
    if (!f) continue;
    out.push(f.item as VItem);
    f.list.splice(f.index, 1);
  }
  return out;
}

// ---------- clipboard ----------

let clip: VItem[] = [];
export const clipboard = () => clip;

export function copySel() {
  clip = selectedItems().map((i) => structuredClone(i));
  try {
    const svg = clip.length ? itemsToSvgSnippet(clip) : '';
    if (svg) void navigator.clipboard?.writeText(svg).catch(() => {});
  } catch {
    // clipboard blocked
  }
}

/** Filled in by the export module so copies paste into other apps as SVG. */
let snippet: (items: VItem[]) => string = () => '';
export const setSvgSnippet = (fn: (items: VItem[]) => string) => void (snippet = fn);
const itemsToSvgSnippet = (items: VItem[]) => snippet(items);

export function pasteClip(where: 'offset' | 'front' | 'back' | 'inplace') {
  if (!clip.length) return;
  const items = clip.map((c) => cloneItem(c));
  if (where === 'offset') items.forEach((i) => transformItem(i, [1, 0, 0, 1, 10, 10]));
  const st = vs();
  if (where === 'front' || where === 'back') {
    const sel = orderedSelection(st.doc.vector, st.vsel);
    const anchor = sel.length ? findItem(st.doc.vector, where === 'front' ? sel[sel.length - 1] : sel[0]) : null;
    if (anchor) {
      const lid = anchor.layer.id;
      st.vstep((v) => {
        const f = findItem(v as VectorDoc, anchor.item.id);
        if (!f) return;
        f.list.splice(where === 'front' ? f.index + 1 : f.index, 0, ...(items as Draft<VItem>[]));
        void lid;
      });
      st.setVSel(items.map((i) => i.id));
      return;
    }
  }
  addItems(items);
}
