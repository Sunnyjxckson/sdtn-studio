// Flats for shoes: a side view and a back view, drawn flat in sheet space (ground line at y = 190).

import type { FlatAnchor, FlatShape, FlatView } from './flats';
import type { Garment, SpecRow } from './garment';
import { WASHES } from './garment';
import { heelKindOf, soleOf, type ShoeKind, type ShoeOpts } from './shoes';

const GROUND = 190;

interface Side {
  /** Closed upper outline. */
  upper: string;
  /** Closed sole outline. */
  sole: string;
  /** Inner lines (seams, panels). */
  seams: string[];
  /** Dashed topstitching. */
  stitch: string[];
  /** Lace bars and eyelets. */
  laces: string[];
  anchors: Record<string, [number, number, string]>;
  heel?: string;
  /** Extra closed shapes drawn on top (gusset, tab, strap). */
  parts?: { d: string; k: 'line' | 'rib'; fill?: boolean }[];
  top: number;
}

const laceBars = (x0: number, y0: number, x1: number, y1: number, n: number, half: number): string[] => {
  const out: string[] = [];
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const cx = x0 + dx * t, cy = y0 + dy * t;
    out.push(`M${(cx - nx * half).toFixed(1)},${(cy - ny * half).toFixed(1)} L${(cx + nx * half).toFixed(1)},${(cy + ny * half).toFixed(1)}`);
  }
  return out;
};
const dot = (x: number, y: number, r = 1.6) => `M${x - r},${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;

function side(o: ShoeOpts): Side {
  const k: ShoeKind = o.kind;
  const g = GROUND;
  if (k === 'Sneaker' || k === 'High top' || k === 'Combat boot') {
    const boot = k === 'Combat boot';
    const high = k !== 'Sneaker';
    const top = high ? (boot ? -14 : -4) : 44;
    const sh = boot ? 24 : 16; // sole height
    const sy = g - sh;
    const upper = high
      ? `M10,${sy} C8,${sy - 40} 8,${top + 40} 16,${top} L74,${top - 4} L86,${top + 20} L98,64 C130,76 160,82 180,92 C200,102 208,118 208,${sy} Z`
      : `M10,${sy} C8,${sy - 34} 10,${sy - 74} 20,${sy - 88} L48,${sy - 90} C58,${sy - 84} 66,${sy - 74} 74,${sy - 76} L84,${sy - 100} L96,${sy - 98} L102,64 C132,76 160,82 180,92 C200,102 208,118 208,${sy} Z`;
    const sole = `M4,${sy} L210,${sy} C216,${sy} 218,${g - 6} 210,${g} L14,${g} C6,${g} 2,${g - 6} 4,${sy} Z`;
    const seams = [
      `M40,${sy} C44,${sy - 30} 62,${sy - 50} 98,66`,
      `M172,${sy} C166,${sy - 16} 168,100 176,92`,
      high ? `M16,${top + 30} L84,${top + 22}` : `M24,${sy - 70} C40,${sy - 66} 56,${sy - 62} 70,${sy - 66}`,
    ];
    const stitch = [`M44,${sy - 6} L200,${sy - 6}`, `M20,${sy - 12} C26,${sy - 46} 30,${sy - 60} 36,${sy - 70}`];
    const laces: string[] = [];
    if (high) {
      laces.push(...laceBars(80, top + 14, 100, 66, boot ? 7 : 6, 9));
      laces.push(...laceBars(106, 70, 150, 84, 3, 11));
    } else laces.push(...laceBars(96, sy - 94, 160, 82, 5, 11));
    const parts: Side['parts'] = [];
    if (boot) {
      for (let x = 22; x < 200; x += 12) parts.push({ d: `M${x},${g} l3,-6 h6 l3,6`, k: 'line' });
      parts.push({ d: `M16,${top + 4} L8,${top - 14} L20,${top - 14} L24,${top + 4}`, k: 'line' });
    } else if (high) {
      parts.push({ d: dot(34, top + 62, 7), k: 'line' });
    } else {
      parts.push({ d: `M14,${sy - 74} h8 v14 h-8 Z`, k: 'line' });
    }
    return {
      upper,
      sole,
      seams,
      stitch,
      laces,
      parts,
      top,
      anchors: {
        sole: [110, g - sh / 2, boot ? 'Lug rubber sole, 1 in heel stack, stitched welt' : 'Cupsole, rubber, stitched to the upper'],
        laces: [128, 80, `Round cotton laces, ${boot ? 'metal eyelets' : 'punched eyelets'}`],
        toecap: [176, 100, 'Toe cap panel, topstitched'],
        counter: [26, sy - 50, 'Heel counter, stitched overlay'],
        ...(high ? { shaft: [46, top + 40, boot ? 'Padded leather shaft, topstitched collar' : 'Canvas shaft with padded collar'] as [number, number, string] } : { collar: [38, sy - 90, 'Padded collar and tongue'] as [number, number, string] }),
      },
    };
  }
  if (k === 'Chelsea boot') {
    const sh = 14, sy = g - sh, top = 0;
    const upper = `M10,${sy} C8,${sy - 40} 8,${top + 40} 16,${top} L84,${top - 2} C88,30 92,56 100,70 C130,78 170,84 196,98 C214,108 222,124 222,${sy} Z`;
    const sole = `M4,${sy} L224,${sy} C230,${sy} 232,${g - 5} 224,${g} L14,${g} C6,${g} 2,${g - 6} 4,${sy} Z`;
    const heelBlock = `M10,${sy} L10,${g - 1} L66,${g - 1} L66,${sy}`;
    return {
      upper,
      sole,
      seams: [`M100,70 C104,80 110,96 112,${sy}`, `M174,${sy} C172,120 186,104 196,98`],
      stitch: [`M40,${sy - 6} L212,${sy - 6}`],
      laces: [],
      heel: heelBlock,
      parts: [
        { d: `M26,${top + 24} L78,${top + 22} L82,${top + 62} L36,${top + 66} Z`, k: 'rib' },
        { d: `M14,${top + 6} L6,${top - 14} L22,${top - 14} L24,${top + 4}`, k: 'line' },
      ],
      top: top - 14,
      anchors: {
        sole: [140, g - sh / 2, 'Leather sole with stacked heel'],
        gusset: [52, top + 44, 'Elastic side gusset, stitched in'],
        tab: [14, top - 12, 'Pull tab at the back, topstitched'],
        shaft: [48, top + 12, 'Smooth leather shaft, hidden seams'],
      },
    };
  }
  if (k === 'Loafer') {
    const sh = 8, sy = g - sh;
    const upper = `M12,${sy} C10,${sy - 20} 12,${sy - 44} 22,${sy - 54} L56,${sy - 56} C66,${sy - 52} 72,${sy - 44} 80,${sy - 44} C100,${sy - 54} 120,${sy - 58} 150,${sy - 52} C186,${sy - 44} 210,${sy - 30} 212,${sy} Z`;
    const sole = `M6,${sy} L214,${sy} C219,${sy} 220,${g - 3} 214,${g} L16,${g} C8,${g} 4,${g - 4} 6,${sy} Z`;
    const heel = `M10,${sy} L10,${g - 1} L56,${g - 1} L56,${sy}`;
    return {
      upper,
      sole,
      heel,
      seams: [`M140,${sy - 50} C150,${sy - 34} 150,${sy - 16} 144,${sy}`, `M92,${sy - 48} C98,${sy - 32} 100,${sy - 14} 96,${sy}`],
      stitch: [`M30,${sy - 6} L200,${sy - 6}`],
      laces: [],
      parts: [
        { d: `M92,${sy - 50} L144,${sy - 54} L146,${sy - 36} L96,${sy - 32} Z`, k: 'line' },
        { d: `M108,${sy - 46} L128,${sy - 48} L128,${sy - 40} L108,${sy - 38} Z`, k: 'line' },
      ],
      top: sy - 58,
      anchors: {
        sole: [110, g - 4, 'Leather sole with a low stacked heel'],
        strap: [120, sy - 42, 'Saddle strap with penny slot, topstitched'],
        apron: [180, sy - 30, 'Moc toe apron, hand stitched'],
        collar: [38, sy - 52, 'Padded collar, leather lined'],
      },
    };
  }
  // heel: pump, ground at the toe, heel seat raised
  const block = heelKindOf(o) === 'Block';
  const upper = `M12,112 C10,86 16,68 28,60 L56,62 C84,76 100,82 120,86 C160,96 196,138 216,178 L216,${g - 4} C190,${g - 4} 160,172 130,158 C108,150 84,144 36,134 L14,128 Z`;
  const sole = `M13,128 L36,134 C84,144 108,150 130,158 C160,172 190,${g - 4} 216,${g - 4} L216,${g} C186,${g} 156,176 126,164 C104,154 82,148 34,140 L12,134 Z`;
  const heel = block ? `M10,128 L40,134 L50,${g} L22,${g} L8,134 Z` : `M12,128 L38,134 L28,${g} L22,${g} L12,134 Z`;
  return {
    upper,
    sole,
    heel,
    seams: [`M40,74 C46,100 40,116 36,134`, `M120,86 C130,98 150,110 160,126`],
    stitch: [`M58,68 C84,82 100,88 118,92`],
    laces: [],
    parts: [{ d: `M16,114 C14,92 20,76 30,66`, k: 'line' }],
    top: 56,
    anchors: {
      sole: [130, 164, 'Leather sole, 2 mm, edge finished'],
      heel: [block ? 30 : 24, 164, block ? 'Block heel, 2.5 in, stacked leather' : 'Stiletto heel, 3.5 in, steel shank'],
      vamp: [140, 104, 'Pointed vamp, lined in leather'],
      counter: [24, 90, 'Stiffened heel counter'],
    },
  };
}

const sh = (d: string, k: FlatShape['k'], extra: Partial<FlatShape> = {}): FlatShape => ({ d, k, ...extra });

function backView(o: ShoeOpts, topY: number): { outline: string; shapes: FlatShape[]; behind: FlatShape[]; over: FlatShape[]; anchors: FlatAnchor[]; box: FlatView['box'] } {
  const k = o.kind;
  const g = GROUND;
  const heel = k === 'Heel';
  const tall = k === 'High top' || k === 'Combat boot' || k === 'Chelsea boot';
  const w = k === 'Combat boot' ? 50 : k === 'Heel' ? 34 : 44;
  const soleH = k === 'Combat boot' ? 24 : k === 'Sneaker' || k === 'High top' ? 16 : k === 'Chelsea boot' ? 14 : k === 'Loafer' ? 8 : 6;
  const gy = heel ? g - 66 : g;
  const sy = gy - soleH;
  const hy = heel ? sy - 0 : sy;
  const topy = heel ? gy - 100 : tall ? topY : sy - 82;
  const cx = 100;
  const outline = `M${cx - w},${hy} C${cx - w - 2},${(hy + topy) / 2} ${cx - w + 6},${topy + 14} ${cx - w + 8},${topy} L${cx + w - 8},${topy} C${cx + w - 6},${topy + 14} ${cx + w + 2},${(hy + topy) / 2} ${cx + w},${hy} Z`;
  const solePath = `M${cx - w - 3},${sy} L${cx + w + 3},${sy} L${cx + w + 3},${gy - 3} C${cx + w + 3},${gy} ${cx + w},${gy} ${cx + w - 3},${gy} L${cx - w + 3},${gy} C${cx - w},${gy} ${cx - w - 3},${gy} ${cx - w - 3},${gy - 3} Z`;
  const behind: FlatShape[] = [sh(solePath, 'line', { fill: true })];
  const over: FlatShape[] = [];
  const shapes: FlatShape[] = [
    sh(`M${cx},${topy + 2} L${cx},${sy}`, 'seam'),
    sh(`M${cx + 3},${topy + 6} L${cx + 3},${sy - 4}`, 'stitch'),
    sh(`M${cx - w + 2},${sy - 30} Q${cx},${sy - 22} ${cx + w - 2},${sy - 30}`, 'seam'),
  ];
  const anchors: FlatAnchor[] = [
    { key: 'sole', label: 'Sole', desc: 'See side view', x: cx + w - 6, y: (sy + gy) / 2 },
  ];
  if (heel) {
    const block = heelKindOf(o) === 'Block';
    const hw = block ? 11 : 3.5;
    behind.push(sh(`M${cx - hw - 2},${gy} L${cx + hw + 2},${gy} L${cx + hw},${g} L${cx - hw},${g} Z`, 'line', { fill: true }));
  }
  if (tall || k === 'Sneaker') {
    over.push(sh(`M${cx - 6},${topy} L${cx - 7},${topy - 12} L${cx + 7},${topy - 12} L${cx + 6},${topy} Z`, 'line'));
  }
  if (k === 'Chelsea boot') {
    shapes.push(sh(`M${cx - w + 1},${topy + 22} L${cx - w + 8},${topy + 22} L${cx - w + 8},${topy + 62} L${cx - w + 2},${topy + 62} Z`, 'rib'), sh(`M${cx + w - 1},${topy + 22} L${cx + w - 8},${topy + 22} L${cx + w - 8},${topy + 62} L${cx + w - 2},${topy + 62} Z`, 'rib'));
  }
  anchors.push({ key: 'seam', label: 'Back seam', desc: 'Centre back seam, topstitched', x: cx + 3, y: topy + 40 });
  if (tall || k === 'Sneaker') anchors.push({ key: 'tab', label: 'Pull tab', desc: 'Pull tab at the collar', x: cx + 7, y: topy - 6 });
  const box = { x0: cx - w - 6, y0: Math.min(topy - 14, topy), x1: cx + w + 6, y1: g + 4 };
  return { outline, shapes, behind, over, anchors, box };
}

export function shoesViews(g: Garment): FlatView[] {
  const o = g.shoes!;
  const s = side(o);
  const length = o.kind === 'Combat boot' ? 232 : 224;
  const behind: FlatShape[] = [sh(s.sole, 'line', { fill: true }), ...(s.heel ? [sh(s.heel, 'line', { fill: true })] : [])];
  const over: FlatShape[] = (s.parts ?? []).map((p) => sh(p.d, p.k, p.fill ? { fill: true } : {}));
  const shapes: FlatShape[] = [
    ...s.seams.map((d) => sh(d, 'seam')),
    ...s.stitch.map((d) => sh(d, 'stitch')),
    ...s.laces.filter(Boolean).map((d) => sh(d, 'line')),
  ];
  const anchors: FlatAnchor[] = Object.entries(s.anchors).map(([key, [x, y, desc]]) => ({
    key,
    label: key === 'sole' ? 'Sole' : key === 'laces' ? 'Laces' : key === 'toecap' ? 'Toe cap' : key === 'counter' ? 'Heel counter' : key === 'shaft' ? 'Shaft' : key === 'collar' ? 'Collar' : key === 'gusset' ? 'Elastic gusset' : key === 'tab' ? 'Pull tab' : key === 'strap' ? 'Saddle strap' : key === 'apron' ? 'Toe apron' : key === 'heel' ? 'Heel' : 'Vamp',
    desc,
    x,
    y,
  }));
  const front: FlatView = {
    id: 'front',
    label: 'SIDE',
    outline: s.upper,
    clip: s.upper,
    shapes,
    behind,
    over,
    texts: [],
    cutY: null,
    box: { x0: -4, y0: Math.min(s.top, 40) - 18, x1: length, y1: GROUND + 6 },
    anchors,
  };
  const b = backView(o, s.top);
  const back: FlatView = {
    id: 'back',
    label: 'BACK',
    outline: b.outline,
    clip: b.outline,
    shapes: b.shapes,
    behind: b.behind,
    over: b.over,
    texts: [],
    cutY: null,
    box: b.box,
    anchors: b.anchors.filter((a) => a.key !== 'sole'),
  };
  return [front, back];
}

export function shoeSpec(o: ShoeOpts): SpecRow[] {
  const rows: SpecRow[] = [{ k: 'Foot length', v: '11.0 in' }];
  const shaft: Record<ShoeKind, string> = { Sneaker: '2.5 in', 'High top': '6.5 in', 'Combat boot': '8 in', 'Chelsea boot': '6 in', Loafer: '2 in', Heel: '2 in' };
  rows.push({ k: 'Shaft height', v: shaft[o.kind] });
  const sole: Record<ShoeKind, string> = { Sneaker: '1.2 in', 'High top': '1.2 in', 'Combat boot': '1.6 in', 'Chelsea boot': '1.1 in', Loafer: '0.7 in', Heel: '0.2 in' };
  rows.push({ k: 'Sole thickness', v: sole[o.kind] });
  if (o.kind === 'Heel') rows.push({ k: 'Heel height', v: heelKindOf(o) === 'Block' ? '2.5 in' : '3.5 in' });
  else if (o.kind === 'Chelsea boot' || o.kind === 'Loafer') rows.push({ k: 'Heel height', v: '1.2 in' });
  rows.push({ k: 'Width', v: 'Medium (D)' });
  return rows;
}

export function shoeMaterials(g: Garment): { k: string; v: string; swatch?: string }[] {
  const o = g.shoes!;
  const so = soleOf(o);
  return [
    { k: 'Upper', v: g.fabric },
    { k: 'Colour', v: g.wash, swatch: WASHES[g.wash] },
    { k: 'Sole', v: so, swatch: WASHES[so] },
    { k: 'Style', v: o.kind === 'Heel' ? `${heelKindOf(o)} heel pump` : o.kind },
  ];
}
