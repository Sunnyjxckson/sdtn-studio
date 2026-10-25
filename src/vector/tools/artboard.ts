// Artboard tool: drag on empty canvas to make an artboard, click one to activate it,
// drag it to move it, drag the corner of the active one to resize it.
import { createElement as h } from 'react';
import { addBoard, activeBoard, boardAt, setActiveBoard } from '../artboards';
import { vs } from '../edit';
import type { VToolDef } from './types';

type Drag =
  | { kind: 'create'; x: number; y: number; cx: number; cy: number }
  | { kind: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; started: boolean }
  | { kind: 'resize'; id: string; x: number; y: number; started: boolean };

let drag: Drag | null = null;

export const artboardTool: VToolDef = {
  id: 'artboard',
  title: 'Artboard',
  key: 'shift+o',
  icon: 'M5,2 V15 H18 M2,5 H15 V18',
  help: 'Drag on empty canvas to add an artboard. Click one to make it active, drag to move it, drag the corner of the active one to resize. Presets and names are in the Artboards panel.',
  group: 'view',
  decor: 'none',
  snaps: false,
  cursor: 'crosshair',
  down(e, _hit, ctx) {
    const a = activeBoard();
    if (a && Math.hypot(e.rx - (a.x + a.w), e.ry - (a.y + a.h)) * ctx.k < 14) {
      vs().checkpoint();
      drag = { kind: 'resize', id: a.id, x: a.x, y: a.y, started: true };
      return;
    }
    const hit = boardAt(e.rx, e.ry);
    if (hit) {
      setActiveBoard(hit.id);
      vs().checkpoint();
      drag = { kind: 'move', id: hit.id, sx: e.rx, sy: e.ry, ox: hit.x, oy: hit.y, started: true };
      return;
    }
    drag = { kind: 'create', x: e.rx, y: e.ry, cx: e.rx, cy: e.ry };
  },
  move(e, ctx) {
    if (!drag) return;
    if (drag.kind === 'create') {
      drag.cx = e.rx;
      drag.cy = e.ry;
      const x = Math.min(drag.x, e.rx), y = Math.min(drag.y, e.ry);
      ctx.setPreview(
        h('rect', { x, y, width: Math.abs(e.rx - drag.x), height: Math.abs(e.ry - drag.y), fill: 'rgba(79,141,247,0.08)', stroke: '#4F8DF7', strokeWidth: 1.2 / ctx.k, strokeDasharray: `${5 / ctx.k} ${3 / ctx.k}` }),
      );
      return;
    }
    const d = drag;
    vs().vedit((v) => {
      const b = v.artboards.find((x) => x.id === d.id);
      if (!b) return;
      if (d.kind === 'move') {
        b.x = Math.round(d.ox + e.rx - d.sx);
        b.y = Math.round(d.oy + e.ry - d.sy);
      } else {
        b.w = Math.max(40, Math.round(e.rx - d.x));
        b.h = Math.max(40, Math.round(e.ry - d.y));
      }
    });
  },
  up(e, ctx) {
    const d = drag;
    drag = null;
    ctx.setPreview(null);
    if (d?.kind === 'create') {
      const w = Math.abs(e.rx - d.x), h2 = Math.abs(e.ry - d.y);
      if (w < 30 || h2 < 30) return;
      addBoard({ name: `Artboard ${vs().doc.vector.artboards.length + 1}`, w: Math.round(w), h: Math.round(h2) }, { x: Math.round(Math.min(d.x, e.rx)), y: Math.round(Math.min(d.y, e.ry)) });
    }
  },
  cancel(ctx) {
    drag = null;
    ctx?.setPreview(null);
  },
};
