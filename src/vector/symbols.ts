// Fashion symbol library: trims, labels, stitch styles and pattern marks as plain editable vector groups.
import { newId } from '../model/garment';
import {
  corner,
  defaultStyle,
  ellipseSub,
  makePath,
  rectSub,
  type VGroup,
  type VItem,
  type VNode,
  type VPath,
  type VStyle,
  type VSub,
  type VText,
} from '../model/vector';

const INK = '#141414';
const METAL = '#BFC3CA';
const CREAM = '#F4F2ED';
const TAPE = '#E7E2D6';

type Over = { fill?: string | null; stroke?: string | null; w?: number; dash?: number[]; evenodd?: boolean; cap?: VStyle['cap'] };

function style(o: Over = {}): VStyle {
  const s = defaultStyle();
  s.fill = o.fill === undefined ? { kind: 'solid', color: METAL } : o.fill ? { kind: 'solid', color: o.fill } : null;
  s.stroke = o.stroke === undefined ? { kind: 'solid', color: INK } : o.stroke ? { kind: 'solid', color: o.stroke } : null;
  s.width = o.w ?? 1;
  s.dash = o.dash ?? [];
  if (o.evenodd) s.fillRule = 'evenodd';
  if (o.cap) s.cap = o.cap;
  return s;
}

const P = (subs: VSub[], o: Over = {}, name = 'Path'): VPath => makePath(subs, style(o), name);
const line = (pts: [number, number][], closed = false): VSub => ({ closed, nodes: pts.map(([x, y]) => corner(x, y)) });
const G = (name: string, children: VItem[]): VGroup => ({ kind: 'group', id: newId(), name, children });
const T = (text: string, x: number, y: number, size: number, o: { weight?: number; letter?: number; fill?: string } = {}): VText => ({
  kind: 'text',
  id: newId(),
  name: 'Text',
  x,
  y,
  text,
  size,
  font: 'IBM Plex Sans',
  weight: o.weight ?? 600,
  anchor: 'middle',
  rot: 0,
  letter: o.letter ?? 0,
  style: style({ fill: o.fill ?? INK, stroke: null }),
});
const node = (x: number, y: number, ix = x, iy = y, ox = x, oy = y): VNode => ({ x, y, ix, iy, ox, oy });

/** A D shape with a flat left side, r is the radius of the round side. */
function dSub(w: number, r: number): VSub {
  const k = r * 0.5523;
  return {
    closed: true,
    nodes: [node(-w, -r), node(0, -r, 0, -r, k, -r), node(r, 0, r, -k, r, k), node(0, r, k, r, 0, r), node(-w, r)],
  };
}

export interface SymbolDef {
  id: string;
  name: string;
  group: 'Hardware' | 'Labels' | 'Stitch' | 'Pattern marks';
  build: () => VItem;
}

export const SYMBOLS: SymbolDef[] = [
  {
    id: 'zipper-pull',
    name: 'Zipper pull',
    group: 'Hardware',
    build: () =>
      G('Zipper pull', [
        P([rectSub(-8, -24, 16, 22, 3)], {}, 'Slider'),
        P([rectSub(-3, -18, 6, 10, 2)], { fill: CREAM }, 'Slider window'),
        P([rectSub(-6, -4, 12, 30, 5)], {}, 'Pull tab'),
        P([ellipseSub(0, 18, 3, 3)], { fill: CREAM }, 'Tab hole'),
      ]),
  },
  {
    id: 'zipper-metal',
    name: 'Metal zipper tape',
    group: 'Hardware',
    build: () => {
      const teeth: VSub[] = [];
      for (let i = 0; i < 18; i++) {
        const y = -60 + i * 6.6;
        teeth.push(rectSub(i % 2 ? -1 : -6, y, 7, 4.4, 1));
      }
      return G('Metal zipper tape', [
        P([rectSub(-16, -64, 11, 128)], { fill: TAPE }, 'Tape left'),
        P([rectSub(5, -64, 11, 128)], { fill: TAPE }, 'Tape right'),
        P(teeth, { fill: METAL, w: 0.7 }, 'Teeth'),
        P([line([[-16, -64], [-16, 64]]), line([[16, -64], [16, 64]])], { fill: null, stroke: '#8C877D', w: 0.8, dash: [2.5, 1.8] }, 'Tape stitch'),
      ]);
    },
  },
  {
    id: 'zipper-coil',
    name: 'Coil zipper (YKK style)',
    group: 'Hardware',
    build: () => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 30; i++) pts.push([i % 2 ? 3.2 : -3.2, -60 + i * 4]);
      return G('Coil zipper', [
        P([rectSub(-16, -64, 11, 128)], { fill: TAPE }, 'Tape left'),
        P([rectSub(5, -64, 11, 128)], { fill: TAPE }, 'Tape right'),
        P([line(pts)], { fill: null, stroke: '#3E3B35', w: 2.6, cap: 'round' }, 'Coil'),
        P([line([[0, -64], [0, 64]])], { fill: null, stroke: '#8C877D', w: 0.6 }, 'Center'),
      ]);
    },
  },
  {
    id: 'button-shank',
    name: 'Shank button',
    group: 'Hardware',
    build: () =>
      G('Shank button', [
        P([ellipseSub(0, 0, 13, 13)], { fill: '#6B4430' }, 'Face'),
        P([ellipseSub(0, 0, 9, 9)], { fill: '#8A5A40' }, 'Dome'),
        P([ellipseSub(0, 0, 3.2, 3.2)], { fill: METAL, w: 0.9 }, 'Shank'),
      ]),
  },
  {
    id: 'button-4hole',
    name: '4-hole button',
    group: 'Hardware',
    build: () => {
      const holes = [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]];
      return G('4-hole button', [
        P([ellipseSub(0, 0, 13, 13)], { fill: CREAM }, 'Face'),
        P([ellipseSub(0, 0, 10, 10)], { fill: null, w: 0.7 }, 'Rim'),
        P(holes.map(([x, y]) => ellipseSub(x, y, 1.9, 1.9)), { fill: '#8C877D', w: 0.8 }, 'Holes'),
        P([line([[-3.6, -3.6], [3.6, 3.6]]), line([[3.6, -3.6], [-3.6, 3.6]])], { fill: null, w: 0.7 }, 'Thread'),
      ]);
    },
  },
  {
    id: 'snap',
    name: 'Snap',
    group: 'Hardware',
    build: () =>
      G('Snap', [
        P([ellipseSub(0, 0, 11, 11)], {}, 'Cap'),
        P([ellipseSub(0, 0, 7.5, 7.5)], { fill: '#D4D7DC', w: 0.8 }, 'Ring'),
        P([ellipseSub(0, 0, 2.4, 2.4)], { fill: '#8C8F96', w: 0.8 }, 'Dot'),
      ]),
  },
  {
    id: 'rivet',
    name: 'Rivet',
    group: 'Hardware',
    build: () =>
      G('Rivet', [
        P([ellipseSub(0, 0, 8, 8)], { fill: '#B8743A' }, 'Head'),
        P([ellipseSub(0, 0, 5.2, 5.2)], { fill: '#D79A5E', w: 0.7 }, 'Dome'),
        P([ellipseSub(-1.4, -1.6, 1.4, 1.4)], { fill: '#F2D2A8', stroke: null }, 'Shine'),
      ]),
  },
  {
    id: 'grommet',
    name: 'Grommet',
    group: 'Hardware',
    build: () =>
      G('Grommet', [
        P([ellipseSub(0, 0, 12, 12), ellipseSub(0, 0, 5.5, 5.5)], { evenodd: true }, 'Ring'),
        P([ellipseSub(0, 0, 8.6, 8.6)], { fill: null, w: 0.7 }, 'Washer edge'),
      ]),
  },
  {
    id: 'd-ring',
    name: 'D-ring',
    group: 'Hardware',
    build: () => G('D-ring', [P([dSub(12, 15), dSub(12, 10.5)], { evenodd: true }, 'Ring')]),
  },
  {
    id: 'buckle',
    name: 'Buckle',
    group: 'Hardware',
    build: () =>
      G('Buckle', [
        P([rectSub(-20, -15, 40, 30, 4), rectSub(-15, -10, 30, 20, 2)], { evenodd: true }, 'Frame'),
        P([rectSub(-3, -16, 6, 32, 2)], { fill: '#D4D7DC' }, 'Bar'),
        P([line([[0, -9], [14, 0], [0, 9]])], { fill: null, w: 1.6, cap: 'round' }, 'Prong'),
      ]),
  },
  {
    id: 'drawcord',
    name: 'Drawcord with aglet',
    group: 'Hardware',
    build: () =>
      G('Drawcord', [
        P(
          [{ closed: false, nodes: [node(-8, -56), node(8, -22, 8, -40, 8, -10), node(-6, 8, -6, -4, -6, 20), node(0, 38)] }],
          { fill: null, stroke: '#3E3B35', w: 3.4, cap: 'butt' },
          'Cord',
        ),
        P([rectSub(-3.2, 38, 6.4, 18, 2)], { fill: METAL, w: 0.9 }, 'Aglet'),
        P([line([[-3.2, 44], [3.2, 44]]), line([[-3.2, 50], [3.2, 50]])], { fill: null, w: 0.6 }, 'Aglet bands'),
      ]),
  },
  {
    id: 'woven-label',
    name: 'Woven label',
    group: 'Labels',
    build: () =>
      G('Woven label', [
        P([rectSub(-32, -13, 64, 26, 2)], { fill: CREAM }, 'Label'),
        P([rectSub(-29, -10, 58, 20, 1)], { fill: null, stroke: '#8C877D', w: 0.6, dash: [2, 1.4] }, 'Border'),
        T('SEDITION', 0, 3, 10, { weight: 800, letter: 2.2 }),
      ]),
  },
  {
    id: 'care-label',
    name: 'Care label',
    group: 'Labels',
    build: () =>
      G('Care label', [
        P([rectSub(-20, -38, 40, 76, 1.5)], { fill: '#FFFFFF' }, 'Label'),
        T('100% COTTON', 0, -28, 5.2, { weight: 700 }),
        T('MACHINE WASH COLD', 0, -16, 4.4, { weight: 500 }),
        T('DO NOT BLEACH', 0, -8, 4.4, { weight: 500 }),
        T('TUMBLE DRY LOW', 0, 0, 4.4, { weight: 500 }),
        T('COOL IRON', 0, 8, 4.4, { weight: 500 }),
        T('MADE IN PORTUGAL', 0, 24, 4.4, { weight: 500 }),
        T('RN 000000', 0, 31, 4.4, { weight: 500 }),
      ]),
  },
  {
    id: 'hang-tag',
    name: 'Hang tag',
    group: 'Labels',
    build: () =>
      G('Hang tag', [
        P([line([[-20, -22], [20, -22], [20, 34], [-20, 34]], true)], { fill: '#E8E2D2' }, 'Tag'),
        P([ellipseSub(0, -14, 3.2, 3.2)], { fill: CREAM, w: 0.9 }, 'Hole'),
        P([{ closed: false, nodes: [node(0, -17), node(14, -40, 2, -28, 22, -52), node(-10, -36, -22, -40, -2, -32)] }], { fill: null, w: 1, cap: 'round' }, 'String'),
        T('SDTN', 0, 10, 10, { weight: 800, letter: 2 }),
        T('$000', 0, 26, 6, { weight: 500 }),
      ]),
  },
  {
    id: 'topstitch',
    name: 'Topstitch line',
    group: 'Stitch',
    build: () => P([line([[-60, 0], [60, 0]])], { fill: null, w: 1.2, dash: [3, 2], cap: 'butt' }, 'Topstitch'),
  },
  {
    id: 'coverstitch',
    name: 'Coverstitch line',
    group: 'Stitch',
    build: () => {
      const zz: [number, number][] = [];
      for (let i = 0; i <= 30; i++) zz.push([-60 + i * 4, i % 2 ? 7.5 : -1.5]);
      return G('Coverstitch', [
        P([line([[-60, 0], [60, 0]]), line([[-60, 6], [60, 6]])], { fill: null, w: 1, dash: [4, 2], cap: 'butt' }, 'Needle lines'),
        P([line(zz)], { fill: null, w: 0.6, stroke: '#8C877D' }, 'Looper'),
      ]);
    },
  },
  {
    id: 'zigzag',
    name: 'Zigzag stitch',
    group: 'Stitch',
    build: () => {
      const zz: [number, number][] = [];
      for (let i = 0; i <= 40; i++) zz.push([-60 + i * 3, i % 2 ? 3.5 : -3.5]);
      return P([line(zz)], { fill: null, w: 1, cap: 'butt' }, 'Zigzag');
    },
  },
  {
    id: 'pleat',
    name: 'Pleat',
    group: 'Pattern marks',
    build: () =>
      G('Pleat', [
        P([line([[-14, -24], [-14, 24]]), line([[14, -24], [14, 24]])], { fill: null, w: 1.2 }, 'Fold lines'),
        P([line([[0, -24], [0, 24]])], { fill: null, w: 1, dash: [4, 2.5] }, 'Under fold'),
        P([line([[-14, -16], [0, -16]]), line([[-14, 0], [0, 0]]), line([[-14, 16], [0, 16]])], { fill: null, w: 0.9 }, 'Direction'),
        P([line([[-4, -19], [0, -16], [-4, -13]]), line([[-4, -3], [0, 0], [-4, 3]]), line([[-4, 13], [0, 16], [-4, 19]])], { fill: null, w: 0.9 }, 'Arrow heads'),
      ]),
  },
  {
    id: 'dart',
    name: 'Dart',
    group: 'Pattern marks',
    build: () =>
      G('Dart', [
        P([line([[-8, -32], [8, -32], [0, 32]], true)], { fill: null, w: 1.2 }, 'Legs'),
        P([line([[0, -32], [0, 32]])], { fill: null, w: 0.8, dash: [4, 2.5] }, 'Fold'),
        P([ellipseSub(0, 32, 1.4, 1.4)], { fill: INK, stroke: null }, 'Point'),
      ]),
  },
  {
    id: 'gathers',
    name: 'Gathers',
    group: 'Pattern marks',
    build: () => {
      const ticks: VSub[] = [];
      for (let i = 0; i < 11; i++) {
        const x = -30 + i * 6;
        ticks.push({ closed: false, nodes: [node(x, 0), node(x + (i % 2 ? 2.5 : -2.5), 14, x, 5, x + 1, 9)] });
      }
      return G('Gathers', [
        P([line([[-34, 0], [34, 0]])], { fill: null, w: 1.2 }, 'Seam'),
        P(ticks, { fill: null, w: 0.9, cap: 'round' }, 'Gather marks'),
        P([line([[-34, -4], [-34, 4]]), line([[34, -4], [34, 4]])], { fill: null, w: 1.2 }, 'Ends'),
      ]);
    },
  },
];
