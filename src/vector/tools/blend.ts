// Blend (W): click two paths to fill the space between them with interpolated copies.
import { createElement as h } from 'react';
import { findItem } from '../../model/vector';
import { vdoc, vs } from '../edit';
import { blendPaths } from './t_blend';
import { BlendOpts } from './t_opts';
import { useBlendOpts } from './t_state';
import type { ToolCtx, VToolDef } from './types';

let first: string | null = null;

export const blendTool: VToolDef = {
  id: 'blend',
  title: 'Blend',
  key: 'w',
  icon: 'M3,12 V8 H7 V12 Z M13,12 V8 H17 V12 Z M9,11 V9 H11 V11 Z',
  help: 'Click one path, then another, to blend between them. Esc to start over.',
  group: 'paint',
  cursor: 'crosshair',
  snaps: false,
  down(_e, hit, ctx) {
    const f = hit?.kind === 'item' ? findItem(vdoc(), hit.id) : null;
    if (!f || f.item.kind !== 'path') {
      first = null;
      return;
    }
    const id = f.item.id;
    if (!first || first === id || !findItem(vdoc(), first)) {
      first = id;
      vs().setVSel([id]);
      ctx.toast('Now click the second path');
      return;
    }
    const a = first;
    first = null;
    if (!blendPaths(a, id, useBlendOpts.getState().steps)) ctx.toast('Could not blend those');
  },
  cancel(_ctx: ToolCtx) {
    first = null;
  },
  options: () => h(BlendOpts),
};

export const blendTools: VToolDef[] = [blendTool];
