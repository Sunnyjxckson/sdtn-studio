// Block details for shirts, jackets and coats on the tops engine: collars, plackets, buttons, pockets,
// quilting, belts. Everything is placed on the body with F(u, v), so it follows the croquis and pose.

import type { ReactNode } from 'react';
import { smooth, type Vec } from '../model/figure';
import { mix } from '../model/color';
import { coatHemV, cuffedOf, sleeveOf, uv } from '../model/top';
import { bodyHem, Cuff, f1, helpers, hemBand, line, RibBand, sleeveEdge, Stitch, Zip, type DetailCtx } from './topParts';

const sw = (c: DetailCtx) => (c.rendered ? 0.9 : 1.4);
const hiOp = (c: DetailCtx) => (c.rendered ? (c.dark ? 0.14 : 0.1) : 0);
const pd = (pts: Vec[]) => smooth(pts);

/** Closed filled panel with an outline and a soft highlight. */
function Panel({ pts, c, round = false, fill, hi = 1 }: { pts: Vec[]; c: DetailCtx; round?: boolean; fill?: string; hi?: number }) {
  const d = round ? smooth(pts, true) : line(pts, true);
  return (
    <g pointerEvents="none">
      <path d={d} fill={fill ?? c.fill} stroke={c.outline} strokeWidth={sw(c)} strokeLinejoin="round" />
      <path d={d} fill="#fff" opacity={hiOp(c) * hi} />
    </g>
  );
}

/** A seam: an open curve in the outline colour. */
function Seam({ pts, c, o = 0.75, w = 0.8, straight = false }: { pts: Vec[]; c: DetailCtx; o?: number; w?: number; straight?: boolean }) {
  return <path d={straight ? line(pts) : pd(pts)} fill="none" stroke={c.outline} strokeWidth={w} opacity={o} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />;
}

const shift = (pts: Vec[], dx: number, dy: number): Vec[] => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));

function Btn({ p, c, r = 1.8, metal = false }: { p: Vec; c: DetailCtx; r?: number; metal?: boolean }) {
  const { ink } = helpers(c);
  const body = metal ? '#aaa69c' : mix(c.base, c.dark ? '#ffffff' : '#000000', c.dark ? 0.32 : 0.22);
  return (
    <g pointerEvents="none">
      <circle cx={p.x} cy={p.y} r={r} fill={c.rendered ? body : 'none'} stroke={ink} strokeWidth={0.7} />
      {metal ? (
        <circle cx={p.x} cy={p.y} r={r * 0.55} fill="none" stroke={ink} strokeWidth={0.5} opacity={0.8} />
      ) : (
        <>
          <circle cx={p.x - r * 0.28} cy={p.y} r={0.34} fill={ink} />
          <circle cx={p.x + r * 0.28} cy={p.y} r={0.34} fill={ink} />
        </>
      )}
    </g>
  );
}

/** Buttons down a line at u, between two heights. */
function ButtonRun({ c, u, v0, v1, n, r = 1.8, metal = false }: { c: DetailCtx; u: number; v0: number; v1: number; n: number; r?: number; metal?: boolean }) {
  const { F } = helpers(c);
  const out: ReactNode[] = [];
  for (let k = 0; k < n; k++) out.push(<Btn key={k} p={F(u, v0 + ((v1 - v0) * k) / Math.max(1, n - 1))} c={c} r={r} metal={metal} />);
  return <>{out}</>;
}

/** Straight placket: two edge lines and a topstitch row down the centre front. */
function Placket({ c, v0, v1, w = 0.045, stitch = true }: { c: DetailCtx; v0: number; v1: number; w?: number; stitch?: boolean }) {
  const { F } = helpers(c);
  const col = (u: number) => [F(u, v0), F(u, (v0 + v1) / 2), F(u, v1)];
  return (
    <g pointerEvents="none">
      <Seam pts={col(-w)} c={c} straight o={0.8} />
      <Seam pts={col(w)} c={c} straight o={0.8} />
      {stitch && <Stitch d={line(col(w * 1.9))} c={c} o={0.5} />}
      {stitch && <Stitch d={line(col(-w * 1.9))} c={c} o={0.35} />}
    </g>
  );
}

/** Shirt collar from the front: two leaves folding down, with the stand behind the neck. */
function CollarFront({ c, v0, leaf = 1, spread = 0, round = false }: { c: DetailCtx; v0: number; leaf?: number; spread?: number; round?: boolean }): ReactNode {
  const { F, U, ink } = helpers(c);
  const out: ReactNode[] = [];
  for (const s of [-1, 1] as const) {
    const pts = [
      F(s * 0.03, v0 - 0.05),
      U(s * 0.09, 5.5),
      U(s * 0.2, 9),
      U(s * 0.29, 6),
      F(s * 0.305, 0.015),
      F(s * (0.15 + spread), v0 + 0.1 * leaf),
      F(s * 0.04, v0 + 0.035),
    ];
    out.push(
      <g key={s} pointerEvents="none">
        <Panel pts={pts} c={c} round={round} />
        <Seam pts={[U(s * 0.1, 3.6), U(s * 0.21, 6.6), U(s * 0.29, 3.6)]} c={c} o={0.4} w={0.6} />
        <Stitch d={line([F(s * 0.05, v0 + 0.01), F(s * (0.15 + spread * 0.9), v0 + 0.078 * leaf), F(s * 0.285, 0.03)])} c={c} o={0.45} />
      </g>,
    );
  }
  void ink;
  return <>{out}</>;
}

/** Collar stand and fold seen from behind the neck. */
function CollarBack({ c, h = 12, fold = true }: { c: DetailCtx; h?: number; fold?: boolean }): ReactNode {
  const { F, U } = helpers(c);
  const top = [U(-0.35, 2), U(-0.31, h * 0.8), U(0, h), U(0.31, h * 0.8), U(0.35, 2)];
  const bot = [F(0.31, 0.05), F(0, 0.085), F(-0.31, 0.05)];
  return (
    <g pointerEvents="none">
      <Panel pts={[...top, ...bot]} c={c} round />
      {fold && <Seam pts={[U(-0.31, h * 0.45), U(0, h * 0.55), U(0.31, h * 0.45)]} c={c} o={0.5} w={0.7} />}
      <Stitch d={pd([F(-0.3, 0.035), F(0, 0.065), F(0.3, 0.035)])} c={c} o={0.45} />
    </g>
  );
}

/** Welt or flap pocket pointing down. */
function FlapPocket({ c, u0, u1, v, h, button = true, metal = false }: { c: DetailCtx; u0: number; u1: number; v: number; h: number; button?: boolean; metal?: boolean }): ReactNode {
  const { F } = helpers(c);
  const um = (u0 + u1) / 2;
  const pts = [F(u0, v), F(u1, v), F(u1, v + h), F(um, v + h + h * 0.22), F(u0, v + h)];
  const under = [F(u0 + (u1 - u0) * 0.04, v + h), F(um, v + h * 1.2), F(u1 - (u1 - u0) * 0.04, v + h)];
  return (
    <g pointerEvents="none">
      <path d={line([...under, F(u1 - 0.0, v + h * 0.5), F(u0, v + h * 0.5)], true)} fill={c.rendered ? mix(c.base, '#000000', 0.18) : 'none'} opacity={0.0} />
      <Panel pts={pts} c={c} />
      <Stitch d={line([F(u0 + 0.02, v + 0.012), F(u1 - 0.02, v + 0.012), F(u1 - 0.02, v + h - 0.01), F(um, v + h + h * 0.12), F(u0 + 0.02, v + h - 0.01), F(u0 + 0.02, v + 0.012)])} c={c} o={0.5} />
      {button && <Btn p={F(um, v + h * 0.62)} c={c} r={1.5} metal={metal} />}
    </g>
  );
}

/** Sleeve cuff with a button, in arm space. */
function ButtonCuff({ c, len, w = 0.22, n = 1, metal = false }: { c: DetailCtx; len: number; w?: number; n?: number; metal?: boolean }): ReactNode {
  const { A } = helpers(c);
  const o = c.g.top!;
  const cuffO = cuffedOf(o) ?? 1.1;
  const out: ReactNode[] = [];
  for (const s of [-1, 1] as const) {
    const edge = sleeveEdge(len, cuffO);
    const a0 = len - w;
    const L: Vec[] = [], R: Vec[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((len - a0) * i) / 6;
      L.push(A(s, a, -edge(a)));
      R.push(A(s, a, edge(a)));
    }
    out.push(
      <g key={s} pointerEvents="none">
        <Panel pts={[...L, ...[...R].reverse()]} c={c} round hi={0.6} />
        <Stitch d={line(shift([...L].slice(1, -1), 0, 0))} c={c} o={0.0} />
        {[...Array(n)].map((_, k) => (
          <Btn key={k} p={A(s, a0 + w * (0.42 + 0.5 * (n === 1 ? 0 : k / (n - 1) - 0.5)), 0.5)} c={c} r={1.4} metal={metal} />
        ))}
      </g>,
    );
  }
  return <>{out}</>;
}

/** Soft hem stitch. */
function HemStitch({ c, dy = -3, o = 0.55 }: { c: DetailCtx; dy?: number; o?: number }): ReactNode {
  const hem = bodyHem(c.shape);
  return hem.length > 2 ? <Stitch d={line(hem.map((p) => ({ x: p.x, y: p.y + dy })))} c={c} o={o} /> : null;
}

/** Knit collar standing round the neck, drawn as a ring. */
function RibCollar({ c, h = 12, stripes = false }: { c: DetailCtx; h?: number; stripes?: boolean }): ReactNode {
  const { F, U, ink } = helpers(c);
  const trim = c.rendered ? mix(c.base, c.dark ? '#ffffff' : '#000000', c.dark ? 0.1 : 0.07) : c.fill;
  const back = c.view === 'back';
  const nl = c.shape.neckline;
  const front = nl.length ? nl : [];
  const topL = U(-0.34, 3), topR = U(0.34, 3);
  const upper = [topL, U(-0.33, h), U(-0.18, h + 3), U(0, h + 3.4), U(0.18, h + 3), U(0.33, h), topR];
  // lower edge of the ring follows the neckline at the front, and the base of the neck at the back
  const lower = back ? [F(0.31, 0.05), F(0, 0.09), F(-0.31, 0.05)] : front.length ? [...front].reverse() : [F(0.3, 0.0), F(0, 0.1), F(-0.3, 0.0)];
  const poly = [...upper, ...lower];
  const ribs: string[] = [];
  for (let k = 1; k < 14; k++) {
    const u = -0.32 + (0.64 * k) / 14;
    const a = U(u, h * 0.85 + 3 * (1 - Math.abs(u) / 0.34)), b = F(u, back ? 0.07 : 0.03);
    ribs.push(`M${f1(a.x)},${f1(a.y)} L${f1(b.x)},${f1(b.y)}`);
  }
  return (
    <g pointerEvents="none">
      <path d={smooth(poly, true)} fill={trim} stroke={c.outline} strokeWidth={sw(c)} strokeLinejoin="round" />
      <path d={ribs.join(' ')} stroke={ink} strokeWidth={0.5} opacity={c.rendered ? 0.35 : 0.5} fill="none" />
      {stripes && (
        <>
          <path d={pd([U(-0.33, h * 0.7), U(0, h * 0.7 + 3), U(0.33, h * 0.7)])} fill="none" stroke={mix(c.base, '#ffffff', 0.7)} strokeWidth={1.8} opacity={0.85} />
          <path d={pd([U(-0.33, h * 0.4), U(0, h * 0.4 + 3), U(0.33, h * 0.4)])} fill="none" stroke={mix(c.base, '#ffffff', 0.7)} strokeWidth={1.8} opacity={0.85} />
        </>
      )}
    </g>
  );
}

// ---------- button-up shirt ----------

function shirtFront(c: DetailCtx): ReactNode {
  const { F, A } = helpers(c);
  const o = c.g.top!;
  const out: ReactNode[] = [];
  const back = c.view === 'back';
  const hemV = c.hemV;
  const v0 = 0.11;
  if (!back) {
    out.push(<Placket key="pl" c={c} v0={v0 + 0.04} v1={hemV - 0.01} />);
    out.push(<ButtonRun key="bt" c={c} u={0} v0={v0 + 0.085} v1={hemV - 0.1} n={Math.max(4, Math.round((hemV - v0) / 0.115))} />);
    // chest pocket on the wearer's left
    const px = o.fit === 'Oversized' ? 0.3 : 0.28;
    const pv = 0.36;
    const pts = [F(px, pv), F(px + 0.27, pv), F(px + 0.27, pv + 0.1), F(px + 0.135, pv + 0.135), F(px, pv + 0.1)];
    out.push(
      <g key="pk" pointerEvents="none">
        <Panel pts={pts} c={c} />
        <Stitch d={line([F(px + 0.02, pv + 0.018), F(px + 0.25, pv + 0.018), F(px + 0.25, pv + 0.09), F(px + 0.135, pv + 0.12), F(px + 0.02, pv + 0.09), F(px + 0.02, pv + 0.018)])} c={c} o={0.5} />
      </g>,
    );
    out.push(<CollarFront key="col" c={c} v0={v0} />);
  } else {
    out.push(<CollarBack key="col" c={c} />);
    // back yoke and a box pleat
    const yoke = [F(-0.98, 0.2), F(-0.5, 0.17), F(0, 0.165), F(0.5, 0.17), F(0.98, 0.2)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.6))} c={c} o={0.45} />
        <Seam pts={[F(-0.06, 0.18), F(-0.065, (0.18 + hemV) / 2), F(-0.06, hemV - 0.04)]} c={c} o={0.3} w={0.6} />
        <Seam pts={[F(0.06, 0.18), F(0.065, (0.18 + hemV) / 2), F(0.06, hemV - 0.04)]} c={c} o={0.3} w={0.6} />
      </g>,
    );
  }
  out.push(<HemStitch key="hs" c={c} />);
  const sl = sleeveOf(o);
  if (sl > 1) {
    out.push(<ButtonCuff key="cuff" c={c} len={sl + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Regular' ? 0.07 : 0.02)} n={2} />);
    if (!back)
      for (const s of [-1, 1] as const)
        out.push(<Seam key={`sp${s}`} pts={[A(s, sl - 0.2, 0.2), A(s, sl - 0.5, 0.15), A(s, sl - 0.7, 0.12)]} c={c} o={0.4} w={0.6} />);
  } else {
    for (const s of [-1, 1] as const) out.push(<Stitch key={`sh${s}`} d={line([A(s, sl - 0.045, -1.0), A(s, sl - 0.05, 0), A(s, sl - 0.045, 1.0)])} c={c} o={0.45} />);
  }
  return <>{out}</>;
}

// ---------- polo ----------

function poloFront(c: DetailCtx): ReactNode {
  const { A } = helpers(c);
  const o = c.g.top!;
  const out: ReactNode[] = [];
  const back = c.view === 'back';
  const v0 = 0.14;
  if (!back) {
    out.push(<Placket key="pl" c={c} v0={v0 - 0.03} v1={v0 + 0.26} w={0.055} stitch={false} />);
    out.push(<ButtonRun key="bt" c={c} u={0} v0={v0 + 0.03} v1={v0 + 0.21} n={3} r={1.7} />);
    out.push(<Seam key="bot" pts={[F2(c, -0.055, v0 + 0.26), F2(c, 0.055, v0 + 0.26)]} c={c} straight o={0.8} />);
    out.push(<CollarFront key="col" c={c} v0={v0} leaf={0.75} spread={0.02} round />);
  } else out.push(<CollarBack key="col" c={c} h={10} />);
  const hemV = c.hemV;
  out.push(<HemStitch key="hs" c={c} />);
  // side vents at the hem
  for (const s of [-1, 1] as const) out.push(<Seam key={`v${s}`} pts={[F2(c, s * 0.97, hemV - 0.1), F2(c, s * 0.985, hemV)]} c={c} straight o={0.6} />);
  // ribbed sleeve ends
  const sl = sleeveOf(o);
  const cuffO = cuffedOf(o);
  if (cuffO != null) {
    const len = sl + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Regular' ? 0.07 : 0.02);
    const edge = sleeveEdge(len, cuffO);
    for (const s of [-1, 1] as const) out.push(<Cuff key={`c${s}`} c={c} s={s} a0={len - 0.2} a1={len} o0={edge(len - 0.2)} o1={cuffO} />);
  } else {
    for (const s of [-1, 1] as const) out.push(<Stitch key={`sh${s}`} d={line([A(s, sl - 0.045, -1.0), A(s, sl - 0.05, 0), A(s, sl - 0.045, 1.0)])} c={c} o={0.45} />);
  }
  return <>{out}</>;
}

const F2 = (c: DetailCtx, u: number, v: number): Vec => helpers(c).F(u, v);

// ---------- crewneck sweatshirt ----------

function ribNeck(c: DetailCtx, w = 6.5): ReactNode {
  const { F, ink } = helpers(c);
  const nl = c.shape.neckline;
  if (nl.length < 3) return null;
  const trim = c.rendered ? mix(c.base, c.dark ? '#ffffff' : '#000000', c.dark ? 0.1 : 0.07) : c.fill;
  const inner = nl.map((p) => ({ x: p.x, y: p.y + w }));
  const poly = [...nl, ...[...inner].reverse()];
  const ribs: string[] = [];
  for (let i = 1; i < nl.length - 1; i += 1) ribs.push(`M${f1(nl[i].x)},${f1(nl[i].y)} L${f1(inner[i].x)},${f1(inner[i].y)}`);
  const nf = F(0, 0.08);
  return (
    <g pointerEvents="none">
      <path d={line(poly, true)} fill={trim} stroke="none" />
      <path d={ribs.join(' ')} stroke={ink} strokeWidth={0.45} opacity={c.rendered ? 0.35 : 0.5} fill="none" />
      <path d={line(inner)} fill="none" stroke={c.outline} strokeWidth={0.9} opacity={0.9} />
      {c.view === 'front' && <path d={`M${f1(nf.x - 6)},${f1(nf.y + w - 1)} L${f1(nf.x)},${f1(nf.y + w + 6)} L${f1(nf.x + 6)},${f1(nf.y + w - 1)}`} fill="none" stroke={c.outline} strokeWidth={0.7} opacity={0.6} />}
    </g>
  );
}

/** Rib hem band and rib cuffs shared by the sweatshirt, bomber and zip hoodie. */
function bandsAndCuffs(c: DetailCtx, bandH: number, cuffLen = 0.27, cuffShort = false): ReactNode[] {
  const o = c.g.top!;
  const out: ReactNode[] = [];
  const band = hemBand(c.shape, bandH);
  if (band.poly.length)
    out.push(
      <g key="band" clipPath={`url(#tclip-${c.g.id})`}>
        <RibBand {...band} c={c} id="hem" />
      </g>,
    );
  const cuffO = cuffedOf(o);
  if (cuffO != null && !cuffShort) {
    const len = sleeveOf(o) + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Regular' ? 0.07 : 0.02);
    const edge = sleeveEdge(len, cuffO);
    for (const s of [-1, 1] as const) out.push(<Cuff key={`cf${s}`} c={c} s={s} a0={len - cuffLen} a1={len} o0={edge(len - cuffLen)} o1={cuffO} />);
  }
  return out;
}

function sweatFront(c: DetailCtx): ReactNode {
  const o = c.g.top!;
  const out: ReactNode[] = [];
  out.push(...bandsAndCuffs(c, o.fit === 'Oversized' ? 13 : 11));
  out.push(<g key="neck">{ribNeck(c)}</g>);
  // set-in sleeve seams of a sweatshirt are flat felled: a short stitch row beside the shoulder seam
  return <>{out}</>;
}

// ---------- bomber ----------

function bomberFront(c: DetailCtx): ReactNode {
  const { F, A } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  out.push(...bandsAndCuffs(c, 12, 0.3));
  if (!back) {
    const z = [F(0, 0.04), F(0, 0.4), F(0, hemV - 0.12)];
    out.push(
      <g key="front" pointerEvents="none">
        <Seam pts={shift(z, 6.5, 0)} c={c} straight o={0.45} w={0.6} />
        <Zip pts={z} c={c} />
      </g>,
    );
    // slanted welt pockets
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.4, hemV - 0.4), F(s * 0.52, hemV - 0.3), F(s * 0.62, hemV - 0.2)];
      out.push(
        <g key={`wp${s}`} pointerEvents="none">
          <Seam pts={p} c={c} o={0.8} w={1} />
          <Stitch d={pd(shift(p, 0, 3))} c={c} o={0.45} />
        </g>,
      );
    }
    // sleeve pocket on the wearer's left sleeve
    const a0 = 0.32, a1 = 0.86;
    const pts = [A(-1, a0, -0.1), A(-1, a1, -0.1), A(-1, a1, 0.5), A(-1, a0, 0.5)];
    out.push(
      <g key="sp" pointerEvents="none">
        <Panel pts={pts} c={c} />
        <Zip pts={[A(-1, a0 + 0.04, 0.15), A(-1, (a0 + a1) / 2, 0.15), A(-1, a1 - 0.05, 0.15)]} c={c} w={1.3} pull />
      </g>,
    );
  } else {
    const yoke = [F(-0.98, 0.24), F(-0.5, 0.21), F(0, 0.2), F(0.5, 0.21), F(0.98, 0.24)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.6))} c={c} o={0.45} />
        <Seam pts={[F(0, 0.2), F(0, 0.6), F(0, hemV - 0.1)]} c={c} straight o={0.6} />
      </g>,
    );
  }
  void o;
  out.push(<RibCollar key="col" c={c} h={11} stripes />);
  return <>{out}</>;
}

// ---------- denim trucker ----------

function truckerFront(c: DetailCtx): ReactNode {
  const { F, A } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  const bandV = hemV - 0.09;
  // waistband at the hem
  const hem = bodyHem(c.shape);
  const bandPts = hem.map((p) => ({ x: p.x, y: p.y - 9 }));
  if (hem.length > 2)
    out.push(
      <g key="wb" pointerEvents="none">
        <Seam pts={bandPts} straight c={c} o={0.8} />
        <Stitch d={line(bandPts.map((p) => ({ x: p.x, y: p.y + 2.4 })))} c={c} o={0.55} />
        <Stitch d={line(hem.map((p) => ({ x: p.x, y: p.y - 2.4 })))} c={c} o={0.55} />
      </g>,
    );
  // adjuster tabs at the sides of the waistband
  for (const s of [-1, 1] as const) {
    const a = F(s * 0.9, bandV - 0.015), b = F(s * 0.97, hemV - 0.015);
    const tab = [{ x: a.x - 4, y: a.y }, { x: a.x + 4, y: a.y }, { x: b.x + 4, y: b.y + 1 }, { x: b.x - 4, y: b.y + 1 }];
    out.push(
      <g key={`tab${s}`} pointerEvents="none">
        <Panel pts={tab} c={c} />
        <Btn p={{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 1 }} c={c} r={1.4} metal />
      </g>,
    );
  }
  if (!back) {
    // yoke: a V across the chest, pleats falling from it, button placket, flap pockets
    const yoke = [F(-0.94, 0.19), F(-0.5, 0.235), F(0, 0.3), F(0.5, 0.235), F(0.94, 0.19)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.8))} c={c} o={0.55} />
      </g>,
    );
    for (const s of [-1, 1] as const)
      for (const u of [0.2, 0.5, 0.78]) {
        const top = 0.26 + (1 - Math.abs(u)) * 0.0 + (0.5 - Math.abs(u - 0.5)) * 0.0 + (u < 0.3 ? 0.04 : u < 0.6 ? 0.012 : -0.01);
        out.push(
          <g key={`pl${s}${u}`} pointerEvents="none">
            <Seam pts={[F(s * u, top), F(s * u, (top + bandV) / 2), F(s * u, bandV)]} c={c} straight o={0.65} w={0.8} />
            <Stitch d={line([F(s * (u + 0.022), top + 0.005), F(s * (u + 0.022), bandV)])} c={c} o={0.4} />
          </g>,
        );
      }
    out.push(<Placket key="pk" c={c} v0={0.14} v1={bandV} w={0.05} />);
    out.push(<ButtonRun key="bt" c={c} u={0} v0={0.22} v1={bandV - 0.06} n={5} r={2.3} metal />);
    for (const s of [-1, 1] as const) out.push(<FlapPocket key={`fp${s}`} c={c} u0={s * 0.3} u1={s * 0.58} v={0.34} h={0.1} metal />);
    out.push(<CollarFront key="col" c={c} v0={0.1} leaf={1.15} spread={0.04} />);
  } else {
    const yoke = [F(-0.96, 0.22), F(-0.5, 0.27), F(0, 0.33), F(0.5, 0.27), F(0.96, 0.22)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.8))} c={c} o={0.55} />
        <Seam pts={[F(-0.3, 0.33), F(-0.3, (0.33 + bandV) / 2), F(-0.3, bandV)]} c={c} straight o={0.65} />
        <Seam pts={[F(0.3, 0.33), F(0.3, (0.33 + bandV) / 2), F(0.3, bandV)]} c={c} straight o={0.65} />
        <Stitch d={line([F(-0.275, 0.35), F(-0.275, bandV)])} c={c} o={0.4} />
        <Stitch d={line([F(0.275, 0.35), F(0.275, bandV)])} c={c} o={0.4} />
        <Seam pts={[F(0, 0.33), F(0, bandV)]} c={c} straight o={0.5} />
      </g>,
    );
    out.push(<CollarBack key="col" c={c} h={13} />);
  }
  const sl = sleeveOf(o);
  out.push(<ButtonCuff key="cuff" c={c} len={sl + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Regular' ? 0.07 : 0.02)} w={0.2} n={1} metal />);
  if (!back) for (const s of [-1, 1] as const) out.push(<Seam key={`ss${s}`} pts={[A(s, 0.1, -0.8), A(s, 1.0, -0.9), A(s, 1.9, -0.95)]} c={c} o={0.0} />);
  return <>{out}</>;
}

// ---------- puffer ----------

function pufferFront(c: DetailCtx): ReactNode {
  const { F, A, U } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  const shade = mix(c.base, '#000000', 0.55);
  const hi = c.dark ? mix(c.base, '#ffffff', 0.45) : '#ffffff';
  const clipId = `tclip-${c.g.id}`;
  // quilting: a baffle every 0.115 down the body, each a little bowed so it reads as puffed
  const rows: number[] = [];
  for (let v = 0.2; v < hemV - 0.03; v += 0.118) rows.push(v);
  const bodyLines: ReactNode[] = [];
  rows.forEach((v, i) => {
    const pts: Vec[] = [];
    for (let k = 0; k <= 10; k++) {
      const u = -1.12 + (2.24 * k) / 10;
      pts.push(F(u, v + 0.012 * Math.sin((Math.PI * k) / 10)));
    }
    bodyLines.push(<path key={`l${i}`} d={pd(pts)} fill="none" stroke={c.outline} strokeWidth={0.9} opacity={0.85} />);
    if (c.rendered) {
      const p2 = pts.map((p) => ({ x: p.x, y: p.y + (F(0, 0.118).y - F(0, 0).y) * 0.52 }));
      bodyLines.push(<path key={`h${i}`} d={pd(p2)} fill="none" stroke={hi} strokeWidth={9} opacity={c.dark ? 0.1 : 0.17} strokeLinecap="round" style={{ filter: 'blur(3.5px)' }} />);
      bodyLines.push(<path key={`s${i}`} d={pd(pts)} fill="none" stroke={shade} strokeWidth={5} opacity={0.22} strokeLinecap="round" style={{ filter: 'blur(2px)' }} transform="translate(0 1.4)" />);
    }
  });
  const sleeveLines: ReactNode[] = [];
  const sl = sleeveOf(o);
  for (const s of [-1, 1] as const)
    for (let a = 0.22; a < sl - 0.1; a += 0.27) {
      const pts = [A(s, a, -1.05), A(s, a + 0.035, 0), A(s, a, 1.05)];
      sleeveLines.push(<path key={`sl${s}${a}`} d={pd(pts)} fill="none" stroke={c.outline} strokeWidth={0.85} opacity={0.8} />);
      if (c.rendered) sleeveLines.push(<path key={`sh${s}${a}`} d={pd(shift(pts, 0, 0))} fill="none" stroke={hi} strokeWidth={0} opacity={0} />);
    }
  out.push(
    <g key="quilt" clipPath={`url(#${clipId})`} pointerEvents="none">
      {bodyLines}
      {sleeveLines}
    </g>,
  );
  if (!back) {
    const z = [F(0, 0.0), F(0, 0.5), F(0, hemV - 0.05)];
    out.push(
      <g key="zip" pointerEvents="none">
        <Seam pts={shift(z, 7, 0)} c={c} straight o={0.7} />
        <Stitch d={line(shift(z, 9.6, 0))} c={c} o={0.5} />
        <Zip pts={z} c={c} />
      </g>,
    );
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.48, hemV - 0.36), F(s * 0.6, hemV - 0.27), F(s * 0.72, hemV - 0.18)];
      out.push(
        <g key={`zp${s}`} pointerEvents="none">
          <Zip pts={s > 0 ? p : [...p].reverse()} c={c} w={1.6} pull />
        </g>,
      );
    }
  } else {
    out.push(<Seam key="cb" pts={[F(0, 0.1), F(0, 0.6), F(0, hemV - 0.05)]} c={c} straight o={0.4} />);
  }
  // stretch cuffs and a drawcord hem band
  const hem = bodyHem(c.shape);
  if (hem.length > 2) out.push(<Seam key="hemband" pts={hem.map((p) => ({ x: p.x, y: p.y - 5 }))} straight c={c} o={0.6} />);
  const cuffO = cuffedOf(o);
  if (cuffO != null) {
    const len = sl + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Regular' ? 0.07 : 0.02);
    const edge = sleeveEdge(len, cuffO);
    for (const s of [-1, 1] as const) out.push(<Cuff key={`cf${s}`} c={c} s={s} a0={len - 0.17} a1={len} o0={edge(len - 0.17)} o1={cuffO} />);
  }
  // funnel collar when there is no hood
  if (!o.hood) {
    out.push(<RibCollar key="col" c={c} h={13} />);
    void U;
  }
  return <>{out}</>;
}

// ---------- trench coat ----------

function trenchFront(c: DetailCtx): ReactNode {
  const { F, U, A, metal, ink } = helpers(c);
  const o = c.g.top!;
  const hv = coatHemV(o);
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  const nl = c.shape.neckline;
  const hi = hiOp(c);
  const beltV = 1.0;
  const beltH = 0.075;
  if (!back && nl.length >= 17) {
    // big peak lapels folding back from the V
    for (const s of [-1, 1] as const) {
      const inner = s > 0 ? nl.slice(0, 9) : nl.slice(8).reverse();
      const tip = F(s * 0.9, 0.31), notch = F(s * 0.56, 0.14), ctip = F(s * 0.72, 0.045), brk = F(s * 0.05, 0.56);
      const poly = [...inner, brk, tip, notch, ctip];
      const stand = [F(s * 0.31, -0.01), U(s * 0.34, 8), U(s * 0.52, 8), ctip];
      out.push(
        <g key={`lap${s}`} pointerEvents="none">
          <path d={smooth(stand, true)} fill={c.fill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
          <path d={line(poly, true)} fill={c.fill} stroke={c.outline} strokeWidth={sw(c)} strokeLinejoin="round" />
          <path d={line(poly, true)} fill="#fff" opacity={c.rendered ? hi : 0} />
          <Stitch d={line([F(s * 0.66, 0.07), F(s * 0.82, 0.28), F(s * 0.25, 0.54)])} c={c} o={0.5} />
        </g>,
      );
    }
    // double breasted front: the overlap edge and two columns of buttons
    const edge = [F(-0.5, 0.45), F(-0.5, 0.9), F(-0.5, 1.4), F(-0.5, hv - 0.04)];
    out.push(<Seam key="edge" pts={edge} c={c} straight o={0.8} />);
    out.push(<Stitch key="edgest" d={line(shift(edge, 2.6, 0))} c={c} o={0.45} />);
    const rows = [0.66, 0.86, 1.2, 1.42, 1.66].filter((v) => v < hv - 0.1);
    for (const u of [-0.3, 0.3]) for (const v of rows) out.push(<Btn key={`b${u}${v}`} p={F(u, v)} c={c} r={2.3} />);
    // storm flap on the right shoulder
    const flap = [F(0.95, 0.12), F(0.1, 0.42), F(0.1, 0.5), F(0.95, 0.2)];
    out.push(
      <g key="storm" pointerEvents="none">
        <path d={line(flap, true)} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.65} />
      </g>,
    );
    // slanted welt pockets
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.62, 1.22), F(s * 0.7, 1.32), F(s * 0.76, 1.42)];
      out.push(
        <g key={`wp${s}`} pointerEvents="none">
          <Seam pts={p} c={c} o={0.85} w={1} />
          <Stitch d={pd(shift(p, s * 2.5, 0))} c={c} o={0.45} />
        </g>,
      );
    }
  }
  if (back) {
    const cape = [F(-0.98, 0.3), F(-0.5, 0.4), F(0, 0.43), F(0.5, 0.4), F(0.98, 0.3)];
    out.push(
      <g key="cape" pointerEvents="none">
        <path d={pd([U(-0.35, 2), U(-0.31, 10), U(0, 12), U(0.31, 10), U(0.35, 2), F(0.31, 0.05), F(0, 0.085), F(-0.31, 0.05)]) + ' Z'} fill={c.fill} stroke={c.outline} strokeWidth={0.9} />
        <Seam pts={cape} c={c} />
        <Stitch d={pd(shift(cape, 0, 2.8))} c={c} o={0.5} />
        <Seam pts={[F(0, 0.43), F(0, 1.0)]} c={c} straight o={0.6} />
        <path d={`M${f1(F(0, 1.14).x)},${f1(F(0, 1.14).y)} L${f1(F(0, hv).x)},${f1(F(0, hv).y)}`} stroke={c.outline} strokeWidth={0.9} opacity={0.75} />
        <Stitch d={line([F(-0.03, 1.14), F(-0.03, hv - 0.04)])} c={c} o={0.4} />
      </g>,
    );
  }
  // epaulettes
  for (const s of [-1, 1] as const) {
    const us = [0.42, 0.58, 0.74, 0.9];
    const a = us.map((u) => F(s * u, 0.0)), b = us.map((u) => F(s * u, 0.06));
    const mid = F(s * 0.5, 0.03);
    out.push(
      <g key={`ep${s}`} pointerEvents="none">
        <path d={line([...a, ...b.reverse()], true)} fill={c.fill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
        <path d={line([...a, ...[...b].reverse()], true)} fill="#fff" opacity={c.rendered ? hi : 0} />
        <circle cx={mid.x} cy={mid.y} r={1.7} fill={c.rendered ? metal : 'none'} stroke={ink} strokeWidth={0.7} />
      </g>,
    );
  }
  // belt with a buckle, belt loops
  {
    const top: Vec[] = [], bot: Vec[] = [];
    for (let k = 0; k <= 10; k++) {
      const u = -1.12 + (2.24 * k) / 10;
      top.push(F(u, beltV + 0.008 * Math.sin((Math.PI * k) / 10)));
      bot.push(F(u, beltV + beltH + 0.008 * Math.sin((Math.PI * k) / 10)));
    }
    out.push(
      <g key="belt" pointerEvents="none">
        <path d={line([...top, ...[...bot].reverse()], true)} fill={c.fill} stroke={c.outline} strokeWidth={sw(c)} strokeLinejoin="round" />
        <path d={line([...top, ...[...bot].reverse()], true)} fill="#fff" opacity={c.rendered ? hi * 0.8 : 0} />
        <Stitch d={line(shift(top, 0, 2.2))} c={c} o={0.5} />
        <Stitch d={line(shift(bot, 0, -2.2))} c={c} o={0.5} />
      </g>,
    );
    if (!back) {
      const bx = F(0.06, beltV + beltH / 2);
      out.push(
        <g key="buckle" pointerEvents="none">
          <rect x={bx.x - 6.5} y={bx.y - 7} width={13} height={14} rx={1.8} fill={c.rendered ? metal : 'none'} stroke={ink} strokeWidth={1} />
          <rect x={bx.x - 3.6} y={bx.y - 4.2} width={7.2} height={8.4} rx={0.9} fill="none" stroke={ink} strokeWidth={0.7} />
          <path d={`M${f1(bx.x)},${f1(bx.y - 5)} V${f1(bx.y + 5)}`} stroke={ink} strokeWidth={0.8} />
          {/* tail of the belt hanging free */}
          <path d={line([F(0.15, beltV + beltH - 0.01), F(0.24, beltV + beltH - 0.01), F(0.24, beltV + beltH + 0.2), F(0.2, beltV + beltH + 0.23), F(0.15, beltV + beltH + 0.2)], true)} fill={c.fill} stroke={c.outline} strokeWidth={0.9} />
        </g>,
      );
    }
  }
  // sleeve tab cuffs
  const len = 2.02 + (o.fit === 'Oversized' ? 0.14 : o.fit === 'Regular' ? 0.04 : 0.01);
  const cuffO = cuffedOf(o) ?? 1.15;
  const edge = sleeveEdge(len, cuffO);
  for (const s of [-1, 1] as const) {
    const a0 = len - 0.22;
    const pts = [A(s, a0, -edge(a0)), A(s, a0 - 0.02, 0), A(s, a0, edge(a0))];
    out.push(
      <g key={`tab${s}`} pointerEvents="none">
        <Seam pts={pts} c={c} o={0.8} />
        <Stitch d={pd(shift(pts, 0, 0))} c={c} o={0.0} />
        {!back && <Btn p={A(s, a0 + 0.09, 0.62)} c={c} r={1.6} />}
      </g>,
    );
  }
  const hem = bodyHem(c.shape);
  if (hem.length > 2) out.push(<Stitch key="hs" d={line(hem.map((p) => ({ x: p.x, y: p.y - 3 })))} c={c} o={0.55} />);
  void uv;
  return <>{out}</>;
}

// ---------- blazer ----------

function blazerFront(c: DetailCtx): ReactNode {
  const { F, U, A } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  const nl = c.shape.neckline;
  const hi = hiOp(c);
  if (!back && nl.length >= 17) {
    for (const s of [-1, 1] as const) {
      const inner = s > 0 ? nl.slice(0, 9) : nl.slice(8).reverse();
      const brk = F(s * 0.02, 0.8), tip = F(s * 0.7, 0.4), notch = F(s * 0.5, 0.27), ctip = F(s * 0.64, 0.06);
      const poly = [...inner, brk, F(s * 0.4, 0.62), tip, notch, ctip];
      const stand = [F(s * 0.31, -0.01), U(s * 0.34, 8), U(s * 0.5, 8), ctip];
      out.push(
        <g key={`lap${s}`} pointerEvents="none">
          <path d={smooth(stand, true)} fill={c.fill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
          <path d={line(poly, true)} fill={c.fill} stroke={c.outline} strokeWidth={sw(c)} strokeLinejoin="round" />
          <path d={line(poly, true)} fill="#fff" opacity={c.rendered ? hi : 0} />
          <path d={`M${f1(notch.x)},${f1(notch.y)} L${f1(F(s * 0.34, 0.26).x)},${f1(F(s * 0.34, 0.26).y)}`} stroke={c.outline} strokeWidth={0.8} opacity={0.7} />
          <Stitch d={line([F(s * 0.56, 0.09), F(s * 0.66, 0.38), F(s * 0.4, 0.6), F(s * 0.04, 0.78)])} c={c} o={0.5} />
        </g>,
      );
    }
    // front edge with a cutaway, two buttons, and the lapel roll line
    const edge = [F(-0.02, 0.82), F(-0.02, 1.0), F(0.07, 1.2), F(0.24, hemV - 0.01)];
    out.push(
      <g key="front" pointerEvents="none">
        <Seam pts={edge} c={c} o={0.85} />
        <Stitch d={pd(shift(edge, 2.8, 0))} c={c} o={0.45} />
        <Seam pts={[F(0.02, 0.8), F(0.2, 0.6), F(0.38, 0.4)]} c={c} o={0.0} />
      </g>,
    );
    out.push(<Btn key="b1" p={F(0, 0.83)} c={c} r={2} />, <Btn key="b2" p={F(0, 1.0)} c={c} r={2} />);
    // flap pockets at the hips and a welt on the chest
    for (const s of [-1, 1] as const) out.push(<FlapPocket key={`fp${s}`} c={c} u0={s * 0.38} u1={s * 0.78} v={hemV - 0.3} h={0.07} button={false} />);
    out.push(
      <g key="welt" pointerEvents="none">
        <Seam pts={[F(0.46, 0.4), F(0.58, 0.395), F(0.7, 0.39)]} c={c} o={0.85} w={1} />
        <Stitch d={pd([F(0.46, 0.415), F(0.58, 0.41), F(0.7, 0.405)])} c={c} o={0.4} />
      </g>,
    );
  }
  if (back) {
    out.push(<CollarBack key="col" c={c} h={11} />);
    out.push(
      <g key="cb" pointerEvents="none">
        <Seam pts={[F(0, 0.085), F(0.0, 0.7), F(0.0, 1.0)]} c={c} straight o={0.6} />
        <Seam pts={[F(-0.97, 0.45), F(-0.7, 0.8), F(-0.55, hemV - 0.0)]} c={c} o={0.55} />
        <Seam pts={[F(0.97, 0.45), F(0.7, 0.8), F(0.55, hemV - 0.0)]} c={c} o={0.55} />
        <path d={line([F(0, 1.0), F(0, hemV)])} stroke={c.outline} strokeWidth={0.9} opacity={0.75} />
        <Stitch d={line([F(0.025, 1.0), F(0.025, hemV - 0.03)])} c={c} o={0.4} />
      </g>,
    );
  }
  // button cuffs, slightly open at the wrist
  const len = sleeveOf(o) + (o.fit === 'Oversized' ? 0.1 : o.fit === 'Regular' ? 0.03 : 0);
  for (const s of [-1, 1] as const) {
    const a0 = len - 0.2;
    out.push(<Seam key={`cs${s}`} pts={[A(s, a0, -1.08), A(s, a0 + 0.01, 0), A(s, a0, 1.08)]} c={c} o={0.55} w={0.7} />);
    if (!back) for (let k = 0; k < 3; k++) out.push(<Btn key={`cb${s}${k}`} p={A(s, len - 0.07 - k * 0.055, 0.7)} c={c} r={1.15} />);
  }
  out.push(<HemStitch key="hs" c={c} dy={-2.5} o={0.4} />);
  return <>{out}</>;
}

// ---------- entry points ----------

export function moreFront(c: DetailCtx): ReactNode {
  switch (c.g.top?.block) {
    case 'Button-up': return shirtFront(c);
    case 'Polo': return poloFront(c);
    case 'Sweatshirt': return sweatFront(c);
    case 'Bomber': return bomberFront(c);
    case 'Trucker': return truckerFront(c);
    case 'Puffer': return pufferFront(c);
    case 'Trench': return trenchFront(c);
    case 'Blazer': return blazerFront(c);
    default: return null;
  }
}
