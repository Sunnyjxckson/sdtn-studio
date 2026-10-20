// Type tool (T): click to add text, click text to edit it. Inline HTML editor over the canvas.
import { createElement as h } from 'react';
import { newId } from '../../model/garment';
import { findItem, textPaint, type VectorDoc, type VText } from '../../model/vector';
import { addItems, vdoc, vs } from '../edit';
import { TypeOpts } from './t_opts';
import { useTypeOpts } from './t_state';
import type { ToolCtx, VToolDef } from './types';

interface Editor {
  el: HTMLInputElement;
  /** Existing text being edited, or null for new text. */
  id: string | null;
  x: number;
  y: number;
  done: boolean;
  proto: Pick<VText, 'size' | 'font' | 'weight' | 'anchor' | 'letter' | 'rot'>;
}
let ed: Editor | null = null;

function textColor(): string {
  const f = vs().vstyle.fill;
  const c = f ? textPaint(f) : '#141414';
  return /^#f{3}$|^#f{6}$/i.test(c) || c === 'none' ? '#141414' : c;
}

function place(e: Editor) {
  const svg = document.querySelector('[data-testid=vector-overlay]');
  if (!svg) return;
  const r = svg.getBoundingClientRect();
  const { view } = vs();
  const k = view.k, s = e.proto.size * k;
  const sx = r.left + view.x + e.x * k, sy = r.top + view.y + e.y * k;
  const w = Math.max(140, e.el.value.length * s * 0.62 + 28);
  const left = e.proto.anchor === 'middle' ? sx - w / 2 : e.proto.anchor === 'end' ? sx - w : sx;
  Object.assign(e.el.style, {
    left: `${left}px`,
    top: `${sy - s * 0.9}px`,
    width: `${w}px`,
    fontSize: `${s}px`,
    textAlign: e.proto.anchor === 'middle' ? 'center' : e.proto.anchor === 'end' ? 'right' : 'left',
  });
}

function commit() {
  const e = ed;
  if (!e || e.done) return;
  e.done = true;
  ed = null;
  const text = e.el.value;
  e.el.remove();
  const st = vs();
  if (e.id) {
    const f = findItem(vdoc(), e.id);
    if (f?.item.kind !== 'text') return;
    const id = e.id;
    if (!text.trim()) {
      st.vstep((v) => {
        const g = findItem(v as VectorDoc, id);
        if (g) g.list.splice(g.index, 1);
      });
      st.setVSel([]);
    } else if (text !== f.item.text) {
      st.vstep((v) => {
        const g = findItem(v as VectorDoc, id);
        if (g?.item.kind === 'text') g.item.text = text;
      });
      st.setVSel([id]);
    } else st.setVSel([id]);
    return;
  }
  if (!text.trim()) return;
  const style = structuredClone(st.vstyle);
  style.fill = { kind: 'solid', color: textColor() };
  style.stroke = null;
  const item: VText = { kind: 'text', id: newId(), name: 'Text', x: e.x, y: e.y, text, ...e.proto, style };
  addItems([item]);
}

function cancelEdit() {
  const e = ed;
  if (!e) return;
  e.done = true;
  ed = null;
  e.el.remove();
}

function open(x: number, y: number, text: string, id: string | null, proto: Editor['proto'], color: string) {
  commit();
  const el = document.createElement('input');
  el.type = 'text';
  el.value = text;
  el.setAttribute('data-testid', 'vector-text-editor');
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: '60',
    boxSizing: 'border-box',
    padding: '0 6px',
    margin: '0',
    lineHeight: '1.2',
    height: '1.2em',
    border: '1px dashed #4F8DF7',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.9)',
    color,
    outline: 'none',
    fontFamily: proto.font,
    fontWeight: String(proto.weight),
    letterSpacing: `${proto.letter * vs().view.k}px`,
  });
  const e: Editor = { el, id, x, y, done: false, proto };
  ed = e;
  place(e);
  document.body.appendChild(el);
  el.addEventListener('input', () => place(e));
  el.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      commit();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      cancelEdit();
    }
  });
  el.addEventListener('blur', () => {
    if (!e.done) commit();
  });
  setTimeout(() => {
    el.focus();
    el.select();
  }, 0);
}

export const typeTool: VToolDef = {
  id: 'type',
  title: 'Type',
  key: 't',
  icon: 'M4,5 V3.5 H16 V5 M10,3.5 V16.5 M7.5,16.5 H12.5',
  help: 'Click to add text, click existing text to edit it. Enter to finish, Esc to cancel.',
  group: 'type',
  cursor: 'text',
  snaps: false,
  down(e, hit) {
    if (hit?.kind === 'item') {
      const f = findItem(vdoc(), hit.id);
      if (f?.item.kind === 'text') {
        const t = f.item;
        vs().setVSel([hit.top]);
        open(t.x, t.y, t.text, t.id, { size: t.size, font: t.font, weight: t.weight, anchor: t.anchor, letter: t.letter, rot: t.rot }, textPaint(t.style.fill));
        return;
      }
    }
    const o = useTypeOpts.getState();
    open(e.x, e.y, '', null, { size: o.size, font: o.font, weight: o.weight, anchor: o.anchor, letter: o.letter, rot: 0 }, textColor());
  },
  cancel(_ctx: ToolCtx) {
    commit();
  },
  options: () => h(TypeOpts),
};

export const typeTools: VToolDef[] = [typeTool];
