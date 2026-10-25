// Envelope Distort tool: drag the mesh handles. Start an envelope from the Envelope panel.
import { createElement as h } from 'react';
import { EnvelopePanel } from '../../components/vector/extra/EnvelopePanel';
import { expandEnvelope, moveMeshPoint, startEnvelope, useEnvelope } from '../ops/envelope';
import { vs } from '../edit';
import type { VToolDef } from './types';

let grab: { r: number; c: number } | null = null;

export const envelopeTool: VToolDef = {
  id: 'envelope',
  title: 'Envelope Distort',
  icon: 'M3,5 C8,2 12,8 17,5 M3,15 C8,12 12,18 17,15 M3,5 V15 M17,5 V15 M10,3.5 V13.5',
  help: 'Select an object, then drag the 16 mesh handles to wrap it around a shape. Presets and Expand are in the Envelope panel.',
  group: 'transform',
  decor: 'none',
  snaps: false,
  cursor: 'crosshair',
  down(e, _hit, ctx) {
    if (!useEnvelope.getState().active) {
      // nothing started yet: begin on the current selection
      if (vs().vsel.length) startEnvelope();
      else ctx.toast('Select an object first');
      return;
    }
    const { grid } = useEnvelope.getState();
    let best = 14 / ctx.k;
    grab = null;
    grid.forEach((row, r) =>
      row.forEach((p, c) => {
        const d = Math.hypot(p.x - e.rx, p.y - e.ry);
        if (d < best) {
          best = d;
          grab = { r, c };
        }
      }),
    );
  },
  move(e) {
    if (grab) moveMeshPoint(grab.r, grab.c, e.rx, e.ry);
  },
  up() {
    grab = null;
  },
  cancel() {
    // leaving the tool keeps the warp
    grab = null;
    expandEnvelope();
  },
  options: () => h(EnvelopePanel, { bar: true }),
};
