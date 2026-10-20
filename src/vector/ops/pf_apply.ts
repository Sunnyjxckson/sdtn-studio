// Applying path results to the document: one undo step each, selection kept valid.
import type { Draft } from 'immer';
import { findItem, pathsIn, type VectorDoc, type VGroup, type VItem, type VPath } from '../../model/vector';
import { newId } from '../../model/garment';
import { removeIds, selectedItems, vdoc, vs } from '../edit';
import { runPathfinder, type PfOp } from './pathfinder';
import { isShape } from './pf_geom';

let notify: (msg: string) => void = () => {};
const listeners = new Set<(msg: string) => void>();
/** Tools set this so messages also show as a canvas toast. */
export const setNotifier = (fn: (msg: string) => void) => void (notify = fn);
/** The Pathfinder panel listens here to show the last message. */
export function onSay(fn: (msg: string) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const say = (msg: string) => {
  try {
    notify(msg);
  } catch {
    // toast gone with the tool
  }
  listeners.forEach((fn) => fn(msg));
};

/** Remove groups that ended up with no children. */
export function pruneEmpty(v: Draft<VectorDoc>) {
  const prune = (list: VItem[]) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.kind !== 'group') continue;
      prune(it.children);
      if (it.children.length === 0) list.splice(i, 1);
    }
  };
  for (const l of v.layers) prune(l.items as VItem[]);
}

export const makeGroup = (children: VItem[], name: string): VGroup => ({ kind: 'group', id: newId(), name, children });

/** Wrap several results in one group, a single result stays as it is. */
export const wrapResults = (items: VItem[], name: string): VItem[] => (items.length > 1 ? [makeGroup(items, name)] : items);

/**
 * Replace some paths (by id) with new items. Each path is swapped in place.
 * Items for ids not found are ignored. Returns the ids of every new item.
 */
export function replaceInPlace(repl: Map<string, VItem[]>, alsoRemove: string[] = []): string[] {
  const made: string[] = [];
  vs().vstep((v) => {
    for (const [id, items] of repl) {
      const f = findItem(v as VectorDoc, id);
      if (!f) continue;
      (f.list as VItem[]).splice(f.index, 1, ...items);
      made.push(...items.map((i) => i.id));
    }
    if (alsoRemove.length) removeIds(v, alsoRemove);
    pruneEmpty(v);
  });
  return made;
}

/** The selected items' paths in stacking order, with the top selected item that holds one. */
export function selectedShapes() {
  const items = selectedItems();
  const holders = items.filter((i) => pathsIn(i).length > 0);
  const paths = holders.flatMap(pathsIn).filter((p) => !p.hidden);
  return { paths, topId: holders.length ? holders[holders.length - 1].id : null };
}

/** Replace the given path ids with results placed above the top item. */
export function replaceAbove(inputIds: string[], topId: string, results: VItem[]): void {
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, topId);
    if (!f) return;
    (f.list as VItem[]).splice(f.index + 1, 0, ...(results as Draft<VItem>[]));
    removeIds(v, inputIds);
    pruneEmpty(v);
  });
  vs().setVSel(results.map((r) => r.id));
  vs().setVNodes([]);
}

export function applyPathfinder(op: PfOp): boolean {
  const { paths, topId } = selectedShapes();
  if (!topId || !paths.length) {
    say('Select closed shapes first');
    return false;
  }
  const res = runPathfinder(op, structuredClone(paths) as VPath[]);
  if (!res.ok) {
    say(res.msg);
    return false;
  }
  const used = paths.filter(isShape).map((p) => p.id);
  replaceAbove(used, topId, res.grouped ? wrapResults(res.paths, 'Pathfinder') : res.paths);
  return true;
}

export const docNow = () => vdoc();

/** Settings the Path row of the panel edits, read by the commands. */
export const pfParams: { offset: number; join: 'round' | 'miter' | 'bevel'; simplify: number } = { offset: 6, join: 'round', simplify: 2 };
