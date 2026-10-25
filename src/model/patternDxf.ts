// DXF R12 export of the pattern pieces, units inches. One block per piece, layers by role:
// CUT_LINE (with allowance), SEAM_LINE (sewing line), GRAINLINE, NOTCHES, INTERNAL (pleats, fold lines), TEXT.
// Piece annotation text follows the AAMA habit: piece name, quantity, size.
import type { Sheet, PlacedPiece } from './pattern';
import type { P } from './patternGeo';

const LAYERS: { name: string; color: number; ltype: string }[] = [
  { name: 'CUT_LINE', color: 7, ltype: 'CONTINUOUS' },
  { name: 'SEAM_LINE', color: 5, ltype: 'DASHED' },
  { name: 'GRAINLINE', color: 3, ltype: 'CONTINUOUS' },
  { name: 'NOTCHES', color: 1, ltype: 'CONTINUOUS' },
  { name: 'INTERNAL', color: 6, ltype: 'DASHED' },
  { name: 'TEXT', color: 2, ltype: 'CONTINUOUS' },
];

const f = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(5);

export function sheetToDxf(sheet: Sheet): string {
  const out: string[] = [];
  const add = (code: number, v: string | number) => out.push(String(code), String(v));
  const H = sheet.hIn;
  const Y = (y: number) => H - y;

  add(0, 'SECTION');
  add(2, 'HEADER');
  add(9, '$ACADVER');
  add(1, 'AC1009');
  add(9, '$INSUNITS');
  add(70, 1);
  add(9, '$MEASUREMENT');
  add(70, 0);
  add(0, 'ENDSEC');

  add(0, 'SECTION');
  add(2, 'TABLES');
  add(0, 'TABLE');
  add(2, 'LTYPE');
  add(70, 2);
  add(0, 'LTYPE');
  add(2, 'CONTINUOUS');
  add(70, 0);
  add(3, 'Solid line');
  add(72, 65);
  add(73, 0);
  add(40, 0);
  add(0, 'LTYPE');
  add(2, 'DASHED');
  add(70, 0);
  add(3, 'Dashed');
  add(72, 65);
  add(73, 2);
  add(40, 0.375);
  add(49, 0.25);
  add(49, -0.125);
  add(0, 'ENDTAB');
  add(0, 'TABLE');
  add(2, 'LAYER');
  add(70, LAYERS.length);
  for (const l of LAYERS) {
    add(0, 'LAYER');
    add(2, l.name);
    add(70, 0);
    add(62, l.color);
    add(6, l.ltype);
  }
  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  const poly = (layer: string, pts: P[], closed: boolean) => {
    add(0, 'POLYLINE');
    add(8, layer);
    add(66, 1);
    add(70, closed ? 1 : 0);
    add(10, 0);
    add(20, 0);
    add(30, 0);
    for (const p of pts) {
      add(0, 'VERTEX');
      add(8, layer);
      add(10, f(p[0]));
      add(20, f(Y(p[1])));
      add(30, 0);
    }
    add(0, 'SEQEND');
    add(8, layer);
  };
  const line = (layer: string, a: P, b: P) => {
    add(0, 'LINE');
    add(8, layer);
    add(10, f(a[0]));
    add(20, f(Y(a[1])));
    add(30, 0);
    add(11, f(b[0]));
    add(21, f(Y(b[1])));
    add(31, 0);
  };
  const text = (layer: string, at: P, h: number, s: string) => {
    add(0, 'TEXT');
    add(8, layer);
    add(10, f(at[0]));
    add(20, f(Y(at[1])));
    add(30, 0);
    add(40, f(h));
    add(1, s.replace(/[\r\n]+/g, ' '));
  };

  const names: string[] = [];
  const block = (p: PlacedPiece) => {
    const name = `${p.id}_${p.size}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    names.push(name);
    add(0, 'BLOCK');
    add(8, 0);
    add(2, name);
    add(70, 0);
    add(10, 0);
    add(20, 0);
    add(30, 0);
    add(3, name);
    poly('CUT_LINE', p.allowance, true);
    poly('SEAM_LINE', p.seam, true);
    const [g1, g2] = p.grain;
    line('GRAINLINE', g1, g2);
    for (const [a, b] of [[g1, g2], [g2, g1]] as [P, P][]) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const L = 0.14;
      line('GRAINLINE', a, [a[0] + Math.cos(ang - 0.45) * L, a[1] + Math.sin(ang - 0.45) * L]);
      line('GRAINLINE', a, [a[0] + Math.cos(ang + 0.45) * L, a[1] + Math.sin(ang + 0.45) * L]);
    }
    for (const tri of p.notches) poly('NOTCHES', tri, false);
    for (const l of p.lines) poly('INTERNAL', l.pts, false);
    if (p.foldEdge) line('INTERNAL', p.foldEdge[0], p.foldEdge[1]);
    const [lx, ly] = p.label;
    text('TEXT', [lx - 1, ly - 0.25], 0.25, `Piece Name: ${p.name}`);
    text('TEXT', [lx - 1, ly + 0.1], 0.2, `Quantity: ${p.cut}${p.fold ? ' on fold' : p.mirror ? ' mirrored' : ''}`);
    text('TEXT', [lx - 1, ly + 0.4], 0.2, `Size: ${p.size}`);
    add(0, 'ENDBLK');
    add(8, 0);
  };

  add(0, 'SECTION');
  add(2, 'BLOCKS');
  for (const p of sheet.pieces) block(p);
  add(0, 'ENDSEC');

  add(0, 'SECTION');
  add(2, 'ENTITIES');
  for (const n of names) {
    add(0, 'INSERT');
    add(8, 'CUT_LINE');
    add(2, n);
    add(10, 0);
    add(20, 0);
    add(30, 0);
  }
  add(0, 'ENDSEC');
  add(0, 'EOF');
  return out.join('\n') + '\n';
}
