// Core vector commands and the keyboard map for Vector mode.
import type { Draft } from 'immer';
import { findItem, isEditable, newLayer, orderedSelection, translate, walkItems, type VectorDoc, type VGroup, type VItem } from '../model/vector';
import { newId } from '../model/garment';
import { addItems, copySel, pasteClip, removeIds, selectedItems, transformSelection, vdoc, vs } from './edit';
import { ioCommands } from './ops/ioCommands';
import { pathCommands } from './ops/pathCommands';
import { VTOOLS, toolById } from './tools';
import type { ToolCtx, VCommand } from './tools/types';

function deleteSelection() {
  const st = vs();
  if (st.vnodes.length && st.vtool === 'direct') {
    deleteNodes();
    return;
  }
  if (!st.vsel.length) return;
  st.vstep((v) => void removeIds(v, st.vsel));
  st.setVSel([]);
}

/** Remove selected anchors. Open paths split where an anchor goes. */
function deleteNodes() {
  const st = vs();
  const refs = st.vnodes;
  st.vstep((v) => {
    const byPath = new Map<string, Map<number, Set<number>>>();
    for (const r of refs) {
      if (!byPath.has(r.id)) byPath.set(r.id, new Map());
      const m = byPath.get(r.id)!;
      if (!m.has(r.s)) m.set(r.s, new Set());
      m.get(r.s)!.add(r.i);
    }
    for (const [id, subs] of byPath) {
      const f = findItem(v as VectorDoc, id);
      if (f?.item.kind !== 'path') continue;
      const p = f.item;
      const out: typeof p.subs = [];
      p.subs.forEach((s, si) => {
        const gone = subs.get(si);
        if (!gone) return out.push(s);
        const keep = s.nodes.map((n, i) => (gone.has(i) ? null : n));
        if (s.closed) {
          // removing from a closed path keeps it closed, like Illustrator's Delete Anchor
          const left = keep.filter(Boolean) as typeof s.nodes;
          if (left.length >= 2) out.push({ closed: true, nodes: left });
          return;
        }
        let run: typeof s.nodes = [];
        for (const n of keep) {
          if (n) run.push(n);
          else {
            if (run.length >= 2) out.push({ closed: false, nodes: run });
            run = [];
          }
        }
        if (run.length >= 2) out.push({ closed: false, nodes: run });
      });
      if (out.length) p.subs = out;
      else f.list.splice(f.index, 1);
    }
  });
  st.setVNodes([]);
  st.setVSel(st.vsel.filter((id) => findItem(vdoc(), id)));
}

function group() {
  const st = vs();
  const ids = orderedSelection(st.doc.vector, st.vsel);
  if (!ids.length) return;
  const gid = newId();
  st.vstep((v) => {
    const top = findItem(v as VectorDoc, ids[ids.length - 1]);
    if (!top) return;
    const list = top.list, at = top.index;
    // insert the group where the topmost item was, then move the items in
    const g: VGroup = { kind: 'group', id: gid, name: 'Group', children: [] };
    list.splice(at + 1, 0, g as Draft<VItem>);
    const items = removeIds(v, ids);
    const gf = findItem(v as VectorDoc, gid);
    if (gf?.item.kind === 'group') gf.item.children.push(...(items as Draft<VItem>[]));
  });
  st.setVSel([gid]);
}

function ungroup() {
  const st = vs();
  const out: string[] = [];
  st.vstep((v) => {
    for (const id of orderedSelection(v as VectorDoc, st.vsel)) {
      const f = findItem(v as VectorDoc, id);
      if (f?.item.kind !== 'group' || !isEditable(f)) {
        out.push(id);
        continue;
      }
      const kids = f.item.children;
      f.list.splice(f.index, 1, ...kids);
      out.push(...kids.map((k) => k.id));
    }
  });
  st.setVSel(out);
}

function arrange(where: 'front' | 'forward' | 'backward' | 'back') {
  const st = vs();
  const ids = orderedSelection(st.doc.vector, st.vsel);
  if (!ids.length) return;
  st.vstep((v) => {
    const order = where === 'front' || where === 'forward' ? [...ids].reverse() : ids;
    for (const id of order) {
      const f = findItem(v as VectorDoc, id);
      if (!f) continue;
      const [it] = f.list.splice(f.index, 1);
      const n = f.list.length + 1;
      const to = where === 'front' ? n - 1 : where === 'back' ? 0 : where === 'forward' ? Math.min(n - 1, f.index + 1) : Math.max(0, f.index - 1);
      f.list.splice(to, 0, it);
    }
  });
}

function selectAll() {
  const v = vdoc();
  const ids: string[] = [];
  for (const l of v.layers) if (l.visible && !l.locked) for (const it of l.items) if (!it.hidden && !it.locked) ids.push(it.id);
  vs().setVSel(ids);
}

function setAll(field: 'locked' | 'hidden', on: boolean, ids?: string[]) {
  const st = vs();
  st.vstep((v) => {
    if (ids) {
      for (const id of ids) {
        const f = findItem(v as VectorDoc, id);
        if (f) f.item[field] = on;
      }
    } else walkItems(v as VectorDoc, (it) => void (it[field] = on));
  });
  if (on) st.setVSel([]);
}

function swapFillStroke() {
  const st = vs();
  const ids = st.vsel;
  const swap = (s: { fill: unknown; stroke: unknown }) => void ([s.fill, s.stroke] = [s.stroke, s.fill]);
  if (!ids.length) return st.setVStyle((s) => swap(s));
  st.vstep((v) => {
    for (const id of orderedSelection(v as VectorDoc, ids)) {
      const f = findItem(v as VectorDoc, id);
      if (!f) continue;
      const each = (it: VItem) => (it.kind === 'group' ? it.children.forEach(each) : swap(it.style));
      each(f.item as VItem);
    }
  });
}

function defaultColors() {
  const st = vs();
  const apply = (s: { fill: unknown; stroke: unknown }) => {
    s.fill = { kind: 'solid', color: '#FFFFFF' };
    s.stroke = { kind: 'solid', color: '#141414' };
  };
  st.setVStyle((s) => apply(s));
  if (!st.vsel.length) return;
  st.vstep((v) => {
    for (const id of orderedSelection(v as VectorDoc, st.vsel)) {
      const f = findItem(v as VectorDoc, id);
      const each = (it: VItem) => (it.kind === 'group' ? it.children.forEach(each) : apply(it.style));
      if (f) each(f.item as VItem);
    }
  });
}

function duplicate() {
  copySel();
  pasteClip('offset');
}

function nudge(dx: number, dy: number) {
  if (!vs().vsel.length) return;
  transformSelection(translate(dx, dy));
}

export const coreCommands: VCommand[] = [
  { id: 'delete', title: 'Delete', keys: ['delete', 'backspace'], run: deleteSelection },
  { id: 'selectAll', title: 'Select All', keys: ['mod+a'], run: selectAll },
  { id: 'deselect', title: 'Deselect', keys: ['mod+shift+a'], run: () => (vs().setVSel([]), vs().setVNodes([])) },
  { id: 'copy', title: 'Copy', keys: ['mod+c'], run: copySel },
  {
    id: 'cut',
    title: 'Cut',
    keys: ['mod+x'],
    run: () => {
      copySel();
      deleteSelection();
    },
  },
  { id: 'paste', title: 'Paste', keys: ['mod+v'], run: () => pasteClip('offset') },
  { id: 'pasteFront', title: 'Paste in Front', keys: ['mod+f'], run: () => pasteClip('front') },
  { id: 'pasteBack', title: 'Paste in Back', keys: ['mod+b'], run: () => pasteClip('back') },
  { id: 'pasteInPlace', title: 'Paste in Place', keys: ['mod+shift+v'], run: () => pasteClip('inplace') },
  { id: 'duplicate', title: 'Duplicate', keys: ['mod+d'], run: duplicate },
  { id: 'group', title: 'Group', keys: ['mod+g'], run: group },
  { id: 'ungroup', title: 'Ungroup', keys: ['mod+shift+g'], run: ungroup },
  { id: 'front', title: 'Bring to Front', keys: ['mod+shift+]'], run: () => arrange('front') },
  { id: 'forward', title: 'Bring Forward', keys: ['mod+]'], run: () => arrange('forward') },
  { id: 'backward', title: 'Send Backward', keys: ['mod+['], run: () => arrange('backward') },
  { id: 'back', title: 'Send to Back', keys: ['mod+shift+['], run: () => arrange('back') },
  { id: 'lock', title: 'Lock Selection', keys: ['mod+2'], run: () => setAll('locked', true, vs().vsel) },
  { id: 'unlockAll', title: 'Unlock All', keys: ['mod+alt+2'], run: () => setAll('locked', false) },
  { id: 'hide', title: 'Hide Selection', keys: ['mod+3'], run: () => setAll('hidden', true, vs().vsel) },
  { id: 'showAll', title: 'Show All', keys: ['mod+alt+3'], run: () => setAll('hidden', false) },
  { id: 'swap', title: 'Swap Fill and Stroke', keys: ['shift+x'], run: swapFillStroke },
  { id: 'defaultColors', title: 'Default Fill and Stroke', keys: ['d'], run: defaultColors, hidden: true },
  { id: 'nudgeL', title: 'Nudge left', keys: ['arrowleft'], run: () => nudge(-1, 0), hidden: true },
  { id: 'nudgeR', title: 'Nudge right', keys: ['arrowright'], run: () => nudge(1, 0), hidden: true },
  { id: 'nudgeU', title: 'Nudge up', keys: ['arrowup'], run: () => nudge(0, -1), hidden: true },
  { id: 'nudgeD', title: 'Nudge down', keys: ['arrowdown'], run: () => nudge(0, 1), hidden: true },
  { id: 'nudgeL10', title: 'Nudge left 10', keys: ['shift+arrowleft'], run: () => nudge(-10, 0), hidden: true },
  { id: 'nudgeR10', title: 'Nudge right 10', keys: ['shift+arrowright'], run: () => nudge(10, 0), hidden: true },
  { id: 'nudgeU10', title: 'Nudge up 10', keys: ['shift+arrowup'], run: () => nudge(0, -10), hidden: true },
  { id: 'nudgeD10', title: 'Nudge down 10', keys: ['shift+arrowdown'], run: () => nudge(0, 10), hidden: true },
  {
    id: 'newLayer',
    title: 'New Layer',
    keys: ['mod+l'],
    run: () => {
      const st = vs();
      const nl = newLayer(st.doc.vector.layers.length + 1);
      st.vstep((v) => void v.layers.push(nl));
      st.setVLayer(nl.id);
    },
  },
];

export const allCommands = (): VCommand[] => [...coreCommands, ...pathCommands, ...ioCommands];
export const runCommand = (id: string) => allCommands().find((c) => c.id === id)?.run();

/** Keyboard combo in the form used by command keys: mod+alt+shift+key. */
export function comboOf(e: KeyboardEvent): string {
  const c = e.code;
  let k = e.key.toLowerCase();
  if (/^Key[A-Z]$/.test(c)) k = c.slice(3).toLowerCase();
  else if (/^Digit\d$/.test(c)) k = c.slice(5);
  else if (c === 'BracketLeft') k = '[';
  else if (c === 'BracketRight') k = ']';
  else if (c === 'Backslash') k = '\\';
  else if (c === 'Equal' || c === 'NumpadAdd') k = '=';
  else if (c === 'Minus' || c === 'NumpadSubtract') k = '-';
  else if (c === 'Slash') k = '/';
  else if (c === 'Period') k = '.';
  else if (c === 'Comma') k = ',';
  return `${e.metaKey || e.ctrlKey ? 'mod+' : ''}${e.altKey ? 'alt+' : ''}${e.shiftKey ? 'shift+' : ''}${k}`;
}

/** Active tool context, set by the overlay so key handlers can reach it. */
let toolCtx: ToolCtx | null = null;
export const setToolCtx = (c: ToolCtx | null) => void (toolCtx = c);

export function handleVectorKey(e: KeyboardEvent): boolean {
  const st = vs();
  const tool = toolById(st.vtool);
  if (toolCtx && tool.keydown?.(e, toolCtx)) {
    e.preventDefault();
    return true;
  }
  const combo = comboOf(e);
  if (combo === 'escape') {
    tool.cancel?.(toolCtx!);
    st.setVSel([]);
    st.setVNodes([]);
    return true;
  }
  const cmd = allCommands().find((c) => c.keys?.includes(combo));
  if (cmd) {
    e.preventDefault();
    cmd.run();
    return true;
  }
  const t = VTOOLS.find((x) => x.key === combo);
  if (t) {
    if (toolCtx) tool.cancel?.(toolCtx);
    st.setVTool(t.id);
    return true;
  }
  return false;
}

export { selectedItems, addItems };
