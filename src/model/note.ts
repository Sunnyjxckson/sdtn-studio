export interface Note {
  id: string;
  x: number;
  y: number;
  text: string;
  /** Arrow tip. */
  tx: number;
  ty: number;
}

const n1 = (x: number) => x.toFixed(1);

/** Thin curved arrow from the note text to its tip, with a small open arrowhead. */
export function notePaths(n: Note): { arrow: string; head: string } {
  const w = Math.max(30, n.text.length * 11);
  const sx = n.x + w * 0.3, sy = n.y + 8;
  const cx = (sx + n.tx) / 2 - (n.ty - sy) * 0.15;
  const cy = (sy + n.ty) / 2 + (n.tx - sx) * 0.15;
  const ang = Math.atan2(n.ty - cy, n.tx - cx);
  const L = 9;
  const a1 = ang + Math.PI - 0.5, a2 = ang + Math.PI + 0.5;
  return {
    arrow: `M${n1(sx)},${n1(sy)} Q${n1(cx)},${n1(cy)} ${n1(n.tx)},${n1(n.ty)}`,
    head: `M${n1(n.tx + Math.cos(a1) * L)},${n1(n.ty + Math.sin(a1) * L)} L${n1(n.tx)},${n1(n.ty)} L${n1(n.tx + Math.cos(a2) * L)},${n1(n.ty + Math.sin(a2) * L)}`,
  };
}
