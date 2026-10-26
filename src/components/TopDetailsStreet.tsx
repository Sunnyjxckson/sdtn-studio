// Streetwear details on the tops engine: mock neck, quarter zip, anorak, work jacket and coach jacket,
// plus the options that apply across blocks (raglan seams, ringer trim, rib band hem).

import type { ReactNode } from 'react';
import { smooth } from '../model/figure';
import { mix } from '../model/color';
import { cuffedOf, hemOf, sleeveOf, sleeveStyleOf, topForward } from '../model/top';
import { bodyHem, Cuff, f1, helpers, hemBand, line, RibBand, sleeveEdge, Stitch, Zip, type DetailCtx } from './topParts';
import { bandsAndCuffs, ButtonCuff, ButtonRun, CollarBack, CollarFront, FlapPocket, HemStitch, Placket, pd, RibCollar, Seam, shift } from './TopDetailsMore';

/** A colour that reads against the body: the contrast of a ringer trim. */
export const trimColor = (c: DetailCtx) => (c.dark ? mix(c.base, '#ffffff', 0.84) : mix(c.base, '#000000', 0.8));

const sleeveLen = (c: DetailCtx) => {
  const o = c.g.top!;
  return sleeveOf(o) + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Boxy' ? 0.14 : o.fit === 'Regular' ? 0.07 : 0.02);
};

/** Band at the end of each sleeve, following the real sleeve hem, d canvas px deep. */
function SleeveBand({ c, d, fill, rib = true }: { c: DetailCtx; d: number; fill: string; rib?: boolean }): ReactNode {
  const { A, ink } = helpers(c);
  const len = sleeveLen(c);
  const hems = c.shape.hems.filter((h) => h.length > 2 && h !== bodyHem(c.shape));
  const out: ReactNode[] = [];
  hems.forEach((hem, i) => {
    const mid = hem[Math.floor(hem.length / 2)];
    const sides = ([-1, 1] as const).map((s) => ({ s, p: A(s, len, 0) }));
    const near = sides.reduce((m, q) => (Math.hypot(q.p.x - mid.x, q.p.y - mid.y) < Math.hypot(m.p.x - mid.x, m.p.y - mid.y) ? q : m));
    const up = A(near.s, len - 0.25, 0);
    const dx = up.x - near.p.x, dy = up.y - near.p.y, L = Math.hypot(dx, dy) || 1;
    const sh = hem.map((q) => ({ x: q.x + (dx / L) * d, y: q.y + (dy / L) * d }));
    let ribs = '';
    if (rib) for (let k = 1; k < hem.length - 1; k++) ribs += `M${f1(hem[k].x)},${f1(hem[k].y)} L${f1(sh[k].x)},${f1(sh[k].y)} `;
    out.push(
      <g key={i} pointerEvents="none">
        <path d={line([...hem, ...[...sh].reverse()], true)} fill={fill} />
        {ribs && <path d={ribs} stroke={ink} strokeWidth={0.5} opacity={c.rendered ? 0.3 : 0.45} fill="none" />}
        <path d={line(sh)} fill="none" stroke={c.outline} strokeWidth={0.9} />
      </g>,
    );
  });
  return <g clipPath={`url(#tclip-${c.g.id})`}>{out}</g>;
}

/** Neck binding in a flat colour along the neckline, w deep. */
function NeckBand({ c, w = 5.5, fill }: { c: DetailCtx; w?: number; fill: string }): ReactNode {
  const nl = c.shape.neckline;
  if (nl.length < 3) return null;
  const { ink } = helpers(c);
  const inner = nl.map((p) => ({ x: p.x, y: p.y + w }));
  const ribs: string[] = [];
  for (let i = 1; i < nl.length - 1; i++) ribs.push(`M${f1(nl[i].x)},${f1(nl[i].y)} L${f1(inner[i].x)},${f1(inner[i].y)}`);
  return (
    <g pointerEvents="none">
      <path d={line([...nl, ...[...inner].reverse()], true)} fill={fill} />
      <path d={ribs.join(' ')} stroke={ink} strokeWidth={0.4} opacity={c.rendered ? 0.28 : 0.4} fill="none" />
      <path d={line(inner)} fill="none" stroke={c.outline} strokeWidth={0.9} opacity={0.9} />
      <path d={line(nl)} fill="none" stroke={c.outline} strokeWidth={0.7} opacity={0.6} />
    </g>
  );
}

/** Seams that apply across blocks: raglan diagonals, ringer trim, rib hem on tee-like blocks. */
export function styleOverlay(c: DetailCtx): ReactNode {
  const o = c.g.top;
  if (!o) return null;
  const out: ReactNode[] = [];
  const { t, stiff } = c;
  const hasSleeves = sleeveOf(o) > 0 && o.block !== 'Dress';
  const raglan = hasSleeves && sleeveStyleOf(o) === 'Raglan';
  const tee = o.block === 'Tee' || o.block === 'Long sleeve' || o.block === 'Mock neck';
  const hoodie = o.block === 'Hoodie' || o.block === 'Zip hoodie';

  if (raglan) {
    const nl = c.shape.neckline;
    for (const K of ['L', 'R'] as const) {
      const pit = c.g.points.find((p) => p.key === `arm${K}`);
      if (!pit || nl.length < 3) continue;
      const a = K === 'L' ? nl[nl.length - 1] : nl[0];
      const b = topForward(t, pit, stiff);
      const s = K === 'L' ? -1 : 1;
      // the seam runs from the neck, bows slightly toward the shoulder, and ends at the underarm
      const m = { x: (a.x + b.x) / 2 + s * 3.5, y: (a.y + b.y) / 2 - 3.5 };
      const d = `M${f1(a.x)},${f1(a.y + 1)} Q${f1(m.x)},${f1(m.y)} ${f1(b.x)},${f1(b.y)}`;
      const d2 = `M${f1(a.x + s * 1.2)},${f1(a.y + 4.2)} Q${f1(m.x + s * 0.6)},${f1(m.y + 3)} ${f1(b.x - s * 0.8)},${f1(b.y - 0.5)}`;
      out.push(
        <g key={`rg${K}`} pointerEvents="none" fill="none">
          <path d={d} stroke={c.outline} strokeWidth={0.95} opacity={0.9} strokeLinecap="round" />
          <Stitch d={d2} c={c} o={0.5} />
        </g>,
      );
    }
  }

  if (o.ringer && o.block !== 'Dress') {
    const col = trimColor(c);
    if (!hoodie && o.block !== 'Sweatshirt') out.push(<NeckBand key="rn" c={c} fill={col} />);
    else if (o.block === 'Sweatshirt') out.push(<NeckBand key="rn" c={c} w={7} fill={col} />);
    if (hasSleeves) out.push(<SleeveBand key="rc" c={c} d={sleeveOf(o) > 1 ? 20 : 8} fill={col} rib={sleeveOf(o) > 1} />);
    if (hoodie || o.block === 'Sweatshirt') {
      const band = hemBand(c.shape, o.fit === 'Oversized' || o.fit === 'Boxy' ? 13 : 11);
      if (band.poly.length && hemOf(o) === 'Rib band')
        out.push(
          <g key="rh" clipPath={`url(#tclip-${c.g.id})`}>
            <RibBand {...band} c={{ ...c, fill: col, base: col }} id="ringer hem" />
          </g>,
        );
    }
  }

  if (tee) {
    if (hemOf(o) === 'Rib band') {
      const band = hemBand(c.shape, o.fit === 'Oversized' || o.fit === 'Boxy' ? 12 : 10);
      if (band.poly.length)
        out.push(
          <g key="band" clipPath={`url(#tclip-${c.g.id})`}>
            <RibBand {...band} c={c} id="rib hem" />
          </g>,
        );
    } else {
      out.push(<HemStitch key="hs" c={c} dy={-3.4} o={0.5} />);
    }
    // sleeve hem stitch
    if (hasSleeves) {
      const { A } = helpers(c);
      const len = sleeveLen(c);
      for (const s of [-1, 1] as const) out.push(<Stitch key={`ss${s}`} d={line([A(s, len - 0.05, -1.04), A(s, len - 0.052, 0), A(s, len - 0.05, 1.04)])} c={c} o={0.4} />);
    }
  }
  return <>{out}</>;
}

// ---------- mock neck long sleeve ----------

function mockNeckFront(c: DetailCtx): ReactNode {
  return <RibCollar c={c} h={9} />;
}

// ---------- quarter zip sweatshirt ----------

function quarterZipFront(c: DetailCtx): ReactNode {
  const { F, U } = helpers(c);
  const o = c.g.top!;
  const out: ReactNode[] = [];
  out.push(...bandsAndCuffs(c, o.fit === 'Oversized' || o.fit === 'Boxy' ? 13 : 11));
  const back = c.view === 'back';
  out.push(<RibCollar key="col" c={c} h={11} />);
  if (!back) {
    const z = [U(0, 11), F(0, 0.1), F(0, 0.26), F(0, 0.44)];
    // placket stitched either side of the zip, bar tack at the bottom
    out.push(
      <g key="zip" pointerEvents="none">
        <Seam pts={[F(-0.07, 0.04), F(-0.07, 0.24), F(-0.07, 0.43)]} c={c} straight o={0.55} w={0.7} />
        <Seam pts={[F(0.07, 0.04), F(0.07, 0.24), F(0.07, 0.43)]} c={c} straight o={0.55} w={0.7} />
        <Seam pts={[F(-0.07, 0.43), F(0.07, 0.43)]} c={c} straight o={0.8} w={1} />
        <Zip pts={z} c={c} />
      </g>,
    );
  }
  return <>{out}</>;
}

// ---------- half zip anorak ----------

function anorakFront(c: DetailCtx): ReactNode {
  const { F, A, ink } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  const hem = bodyHem(c.shape);
  if (!back) {
    const z = [F(0, 0.03), F(0, 0.3), F(0, 0.6)];
    out.push(
      <g key="zip" pointerEvents="none">
        <Seam pts={[F(-0.09, 0.03), F(-0.09, 0.3), F(-0.09, 0.6)]} c={c} straight o={0.6} w={0.8} />
        <Seam pts={[F(0.09, 0.03), F(0.09, 0.3), F(0.09, 0.6)]} c={c} straight o={0.6} w={0.8} />
        <Seam pts={[F(-0.09, 0.6), F(0.09, 0.6)]} c={c} straight o={0.85} w={1.2} />
        <Stitch d={line([F(-0.115, 0.04), F(-0.115, 0.6)])} c={c} o={0.4} />
        <Stitch d={line([F(0.115, 0.04), F(0.115, 0.6)])} c={c} o={0.4} />
        <Zip pts={z} c={c} w={2.2} />
      </g>,
    );
    if (o.pocket === 'Chest') {
      const p = [F(-0.68, 0.5), F(-0.5, 0.495), F(-0.32, 0.49)];
      out.push(
        <g key="chest" pointerEvents="none">
          <path d={smooth(shift(p, 0, 4))} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.7} />
          <Zip pts={[p[2], p[1], p[0]]} c={c} w={1.6} />
        </g>,
      );
    }
  } else {
    const yoke = [F(-0.97, 0.22), F(-0.5, 0.27), F(0, 0.29), F(0.5, 0.27), F(0.97, 0.22)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.6))} c={c} o={0.45} />
        <Seam pts={[F(0, 0.3), F(0, (0.3 + hemV) / 2), F(0, hemV - 0.02)]} c={c} straight o={0.5} w={0.7} />
      </g>,
    );
  }
  // hem channel with a drawcord: toggles hang at the sides of the front
  if (hem.length > 2) {
    out.push(
      <g key="chan" pointerEvents="none">
        <path d={line(hem.map((p) => ({ x: p.x, y: p.y - 7 })))} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.65} />
        <Stitch d={line(hem.map((p) => ({ x: p.x, y: p.y - 2.5 })))} c={c} o={0.5} />
      </g>,
    );
    if (!back) {
      for (const s of [-1, 1] as const) {
        const a = F(s * 0.5, hemV);
        const cord = c.dark ? mix(c.base, '#ffffff', 0.6) : mix(c.base, '#000000', 0.45);
        out.push(
          <g key={`dc${s}`} pointerEvents="none" fill="none" strokeLinecap="round">
            <path d={`M${f1(a.x)},${f1(a.y - 4)} q${f1(s * 1.5)},7 ${f1(s * 0.6)},14`} stroke={cord} strokeWidth={1.3} />
            <rect x={a.x + s * 0.6 - 1.7} y={a.y + 9} width={3.4} height={5} rx={1} fill={c.rendered ? '#c9c6bd' : 'none'} stroke={ink} strokeWidth={0.7} />
          </g>,
        );
      }
    }
  }
  // elastic cuffs
  const len = sleeveLen(c);
  for (const s of [-1, 1] as const) {
    const a0 = len - 0.2;
    out.push(
      <g key={`ec${s}`} pointerEvents="none">
        <Seam pts={[A(s, a0, -1.06), A(s, a0 + 0.01, 0), A(s, a0, 1.06)]} c={c} o={0.7} w={0.8} />
        <Stitch d={line([A(s, a0 + 0.05, -1.04), A(s, a0 + 0.06, 0), A(s, a0 + 0.05, 1.04)])} c={c} o={0.4} />
      </g>,
    );
  }
  return <>{out}</>;
}

// ---------- cropped work jacket ----------

function workJacketFront(c: DetailCtx): ReactNode {
  const { F } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  const bh = o.fit === 'Oversized' || o.fit === 'Boxy' ? 13 : 11;
  const hem = bodyHem(c.shape);
  if (hemOf(o) === 'Rib band') {
    const band = hemBand(c.shape, bh);
    if (band.poly.length)
      out.push(
        <g key="band" clipPath={`url(#tclip-${c.g.id})`}>
          <RibBand {...band} c={c} id="hem" />
        </g>,
      );
  } else if (hem.length > 2) {
    // self fabric band, topstitched both sides
    const top = hem.map((p) => ({ x: p.x, y: p.y - bh }));
    out.push(
      <g key="wb" pointerEvents="none">
        <Seam pts={top} straight c={c} o={0.85} />
        <Stitch d={line(top.map((p) => ({ x: p.x, y: p.y + 2.6 })))} c={c} o={0.55} />
        <Stitch d={line(hem.map((p) => ({ x: p.x, y: p.y - 2.6 })))} c={c} o={0.55} />
      </g>,
    );
  }
  const bandV = hemV - 0.1;
  if (!back) {
    const z = [F(0, 0.08), F(0, 0.5), F(0, bandV)];
    out.push(
      <g key="front" pointerEvents="none">
        <Seam pts={z.map((p) => ({ x: p.x + 6.5, y: p.y }))} c={c} straight o={0.5} w={0.7} />
        <Stitch d={line(z.map((p) => ({ x: p.x + 9, y: p.y })))} c={c} o={0.4} />
        <Zip pts={z} c={c} w={2.4} />
      </g>,
    );
    // chest flap pockets and welt pockets low on the body
    for (const s of [-1, 1] as const) out.push(<FlapPocket key={`cp${s}`} c={c} u0={s * 0.3} u1={s * 0.62} v={0.32} h={0.1} metal />);
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.42, hemV - 0.4), F(s * 0.55, hemV - 0.36), F(s * 0.7, hemV - 0.3)];
      out.push(
        <g key={`wp${s}`} pointerEvents="none">
          <Seam pts={p} c={c} o={0.85} w={1} />
          <Stitch d={pd(shift(p, 0, 3))} c={c} o={0.45} />
        </g>,
      );
    }
    out.push(<CollarFront key="col" c={c} v0={0.08} leaf={1.1} spread={0.04} />);
  } else {
    out.push(<CollarBack key="col" c={c} h={11} />);
    const yoke = [F(-0.96, 0.22), F(-0.5, 0.27), F(0, 0.3), F(0.5, 0.27), F(0.96, 0.22)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.8))} c={c} o={0.5} />
        <Seam pts={[F(0, 0.3), F(0, (0.3 + bandV) / 2), F(0, bandV)]} c={c} straight o={0.55} w={0.7} />
      </g>,
    );
  }
  out.push(<ButtonCuff key="cuff" c={c} len={sleeveLen(c)} w={0.2} n={1} metal />);
  return <>{out}</>;
}

// ---------- coach jacket ----------

function coachFront(c: DetailCtx): ReactNode {
  const { F } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const back = c.view === 'back';
  const out: ReactNode[] = [];
  if (!back) {
    const v0 = 0.07;
    out.push(<Placket key="pl" c={c} v0={v0 + 0.03} v1={hemV - 0.005} w={0.05} />);
    out.push(<ButtonRun key="sn" c={c} u={0} v0={0.17} v1={hemV - 0.1} n={Math.max(4, Math.round((hemV - 0.1) / 0.17))} r={2} metal />);
    out.push(<CollarFront key="col" c={c} v0={v0} leaf={1} spread={0.03} />);
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.38, hemV - 0.36), F(s * 0.52, hemV - 0.31), F(s * 0.68, hemV - 0.25)];
      out.push(
        <g key={`wp${s}`} pointerEvents="none">
          <Seam pts={p} c={c} o={0.85} w={1} />
          <Stitch d={pd(shift(p, 0, 3))} c={c} o={0.45} />
        </g>,
      );
    }
  } else {
    out.push(<CollarBack key="col" c={c} h={11} />);
    const yoke = [F(-0.97, 0.2), F(-0.5, 0.24), F(0, 0.26), F(0.5, 0.24), F(0.97, 0.2)];
    out.push(
      <g key="yk" pointerEvents="none">
        <Seam pts={yoke} c={c} />
        <Stitch d={pd(shift(yoke, 0, 2.6))} c={c} o={0.45} />
        <Seam pts={[F(0, 0.27), F(0, (0.27 + hemV) / 2), F(0, hemV - 0.02)]} c={c} straight o={0.5} w={0.7} />
      </g>,
    );
  }
  out.push(<HemStitch key="hs" c={c} dy={-3} o={0.55} />);
  // elastic rib cuffs
  const cuffO = cuffedOf(o);
  if (cuffO != null) {
    const len = sleeveLen(c);
    const edge = sleeveEdge(len, cuffO);
    for (const s of [-1, 1] as const) out.push(<Cuff key={`cf${s}`} c={c} s={s} a0={len - 0.16} a1={len} o0={edge(len - 0.16)} o1={cuffO} />);
  }
  return <>{out}</>;
}

export function streetFront(c: DetailCtx): ReactNode {
  switch (c.g.top?.block) {
    case 'Mock neck': return mockNeckFront(c);
    case 'Quarter zip': return quarterZipFront(c);
    case 'Anorak': return anorakFront(c);
    case 'Work jacket': return workJacketFront(c);
    case 'Coach jacket': return coachFront(c);
    default: return null;
  }
}
