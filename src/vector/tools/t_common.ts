// Helpers for the transform and paint tools.
import {
  cloneItem,
  findItem,
  isEditable,
  orderedSelection,
  transformItem,
  mul,
  rotateAt,
  scaleAt,
  type Mat,
  type VectorDoc,
  type VItem,
} from '../../model/vector';
import { selectionBox, vdoc, vs } from '../edit';
import type { Pt } from './t_geom';

export function selCenter(): Pt | null {
  const b = selectionBox();
  return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
}

/** Leaf items (paths, text, dims) inside an item. */
export const leaves = (it: VItem): VItem[] => (it.kind === 'group' ? it.children.flatMap(leaves) : [it]);

let orig: Map<string, VItem> | null = null;

/** Start a drag transform. With copy, the selection is duplicated first and the copies move. One undo step in all. */
export function beginSession(copy: boolean): boolean {
  const st = vs();
  let ids = orderedSelection(vdoc(), st.vsel).filter((id) => {
    const f = findItem(vdoc(), id);
    return f && isEditable(f);
  });
  if (!ids.length) return false;
  st.checkpoint();
  if (copy) {
    const made: string[] = [];
    const copies = ids.map((id) => [id, cloneItem(findItem(vdoc(), id)!.item)] as const);
    st.vedit((v) => {
      for (const [id, c] of copies) {
        const f = findItem(v as VectorDoc, id);
        if (!f) continue;
        (f.list as VItem[]).splice(f.index + 1, 0, c);
        made.push(c.id);
      }
    });
    st.setVSel(made);
    ids = made;
  }
  orig = new Map();
  for (const id of ids) {
    const f = findItem(vdoc(), id);
    if (f) orig.set(id, structuredClone(f.item));
  }
  return true;
}

export function applySession(m: Mat) {
  const o = orig;
  if (!o) return;
  vs().vedit((v) => {
    for (const [id, it] of o) {
      const f = findItem(v as VectorDoc, id);
      if (!f) continue;
      const c = structuredClone(it);
      transformItem(c, m);
      (f.list as VItem[])[f.index] = c;
    }
  });
}

export const endSession = () => void (orig = null);

/** Apply a matrix to the selection in one undo step, optionally to copies. */
export function applyMat(m: Mat, copy: boolean): boolean {
  if (!beginSession(copy)) return false;
  applySession(m);
  endSession();
  return true;
}

/** Reference point set by a click, null means the selection center. */
let ref: Pt | null = null;
export const getRef = () => ref;
export const setRef = (p: Pt | null) => void (ref = p);
export const refPoint = () => ref ?? selCenter();

export const reflectMat = (angleDeg: number, o: Pt): Mat => mul(rotateAt(angleDeg, o.x, o.y), mul(scaleAt(1, -1, o.x, o.y), rotateAt(-angleDeg, o.x, o.y)));
export const shearMat = (angleDeg: number, horizontal: boolean, o: Pt): Mat => {
  const k = Math.tan((angleDeg * Math.PI) / 180);
  return horizontal ? [1, 0, k, 1, -k * o.y, 0] : [1, k, 0, 1, 0, -k * o.x];
};
