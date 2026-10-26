import type { ReactNode } from 'react';
import { smooth, type Vec } from '../model/figure';
import { mix } from '../model/color';
import { cuffedOf, dressHemV, dressTopOf, hasStyleOptions, hemOf, isHoodie, silhouetteOf, sleeveOf, uv } from '../model/top';
import { streetFront, styleOverlay } from './TopDetailsStreet';
import { moreFront } from './TopDetailsMore';
import { bodyHem, Cuff, f1, helpers, hemBand, line, RibBand, sleeveEdge, Stitch, Zip, type DetailCtx } from './topParts';
export type { DetailCtx } from './topParts';

// ---------- hoodie ----------

function hoodieBehind(c: DetailCtx): ReactNode {
  if (c.view === 'back') return null;
  const { U } = helpers(c);
  const hood = c.rendered ? mix(c.base, '#000000', c.dark ? 0.12 : 0.04) : c.fill;
  const shade = mix(c.base, '#000000', 0.5);
  return (
    <g pointerEvents="none">
      {([-1, 1] as const).map((s) => {
        const pts = [U(s * 0.27, -4), U(s * 0.29, 8), U(s * 0.34, 16), U(s * 0.44, 19), U(s * 0.56, 17), U(s * 0.67, 9), U(s * 0.72, 0), U(s * 0.72, -4)];
        const crease = [U(s * 0.38, 18), U(s * 0.48, 12), U(s * 0.56, 4)];
        return (
          <g key={s}>
            <path d={smooth(pts, true)} fill={hood} stroke={c.outline} strokeWidth={c.rendered ? 0.9 : 1.5} strokeLinejoin="round" />
            {c.rendered && <path d={smooth([U(s * 0.31, 20), U(s * 0.36, 8), U(s * 0.4, 0)])} fill="none" stroke={shade} strokeWidth={6} opacity={0.2} strokeLinecap="round" style={{ filter: 'blur(2px)' }} />}
            <path d={smooth(crease)} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.6} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function hoodieFront(c: DetailCtx): ReactNode {
  const { F, U, A, ink } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const out: ReactNode[] = [];
  const anorak = o.block === 'Anorak';
  const puff = o.block === 'Puffer' || anorak;
  const zipHood = o.block === 'Zip hoodie';
  const plainHem = hasStyleOptions(o) && hemOf(o) !== 'Rib band';
  const bandH = o.fit === 'Oversized' ? 13 : 11;
  const band = hemBand(c.shape, bandH);
  const shade = mix(c.base, '#000000', 0.55);

  if (c.view === 'back') {
    // hood bunched at the nape, with a centre seam
    const hood = c.rendered ? c.fill : c.fill;
    const top = [U(-0.62, 0), U(-0.67, 20), U(-0.55, 40), U(-0.32, 49), U(0, 51), U(0.32, 49), U(0.55, 40), U(0.67, 20), U(0.62, 0)];
    const bot = [F(0.52, 0.1), F(0.22, 0.19), F(0, 0.21), F(-0.22, 0.19), F(-0.52, 0.1)];
    const d = smooth([...top, ...bot], true);
    out.push(
      <g key="hood" pointerEvents="none">
        {c.rendered && <path d={smooth(bot)} fill="none" stroke="#000" strokeWidth={9} opacity={0.2} strokeLinecap="round" style={{ filter: 'blur(3px)' }} />}
        <path d={d} fill={hood} stroke={c.outline} strokeWidth={c.rendered ? 0.9 : 1.5} strokeLinejoin="round" />
        {c.rendered && (
          <>
            <path d={d} fill="none" stroke={shade} strokeWidth={10} opacity={0.18} style={{ filter: 'blur(3.5px)' }} clipPath="none" />
            <path d={smooth([U(-0.58, 16), U(-0.36, 30), U(-0.1, 40)])} fill="none" stroke={shade} strokeWidth={5} opacity={0.22} strokeLinecap="round" style={{ filter: 'blur(2px)' }} />
            <path d={smooth([U(0.58, 16), U(0.36, 30), U(0.1, 40)])} fill="none" stroke={shade} strokeWidth={5} opacity={0.12} strokeLinecap="round" style={{ filter: 'blur(2px)' }} />
          </>
        )}
        <path d={smooth([U(0, 51), U(0.01, 30), F(0, 0.0), F(0.0, 0.21)])} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.8} />
        <path d={smooth([U(-0.58, 14), U(-0.34, 28), U(-0.08, 38)])} fill="none" stroke={c.outline} strokeWidth={0.7} opacity={0.55} strokeLinecap="round" />
      </g>,
    );
  } else if (o.block !== 'Puffer') {
    // rim of the hood round the front of the neck, and the drawcords
    const nf = c.g.points.find((p) => p.key === 'neckF');
    const v0 = nf ? uv(nf).v : 0.1;
    const cord = c.dark ? mix(c.base, '#ffffff', 0.6) : mix(c.base, '#ffffff', 0.7);
    out.push(
      <g key="cords" pointerEvents="none" fill="none" strokeLinecap="round">
        {([-1, 1] as const).map((s) => {
          const path = [F(s * 0.1, v0 + 0.01), F(s * 0.12, v0 + 0.12), F(s * 0.09, v0 + 0.24), F(s * 0.13, v0 + 0.34)];
          const end = path[3];
          return (
            <g key={s}>
              <path d={smooth(path)} stroke={c.outline} strokeWidth={2.6} opacity={0.7} />
              <path d={smooth(path)} stroke={cord} strokeWidth={1.7} />
              <path d={`M${f1(end.x)},${f1(end.y - 0.5)} l${f1(s * 0.4)},4.5`} stroke={c.outline} strokeWidth={2.6} />
              <circle cx={path[0].x} cy={path[0].y} r={1.7} fill={c.rendered ? '#d0d0d0' : 'none'} stroke={ink} strokeWidth={0.7} />
            </g>
          );
        })}
      </g>,
    );
  }

  // zip hoodie: a zip down the front and slanted side pockets instead of the kangaroo pocket
  if (c.view === 'front' && zipHood) {
    const z = [F(0, 0.0), F(0, 0.5), F(0, hemV - 0.1)];
    out.push(
      <g key="zip" pointerEvents="none">
        <path d={smooth(z.map((p) => ({ x: p.x + 6, y: p.y })))} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.5} />
        <Zip pts={z} c={c} />
      </g>,
    );
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.46, hemV - 0.4), F(s * 0.56, hemV - 0.3), F(s * 0.63, hemV - 0.19)];
      out.push(
        <g key={`sp${s}`} pointerEvents="none">
          <path d={smooth(p)} fill="none" stroke={c.outline} strokeWidth={1} opacity={0.85} strokeLinecap="round" />
          <Stitch d={smooth(p.map((q) => ({ x: q.x + s * 2.6, y: q.y })))} c={c} o={0.45} />
        </g>,
      );
    }
  }
  // body: rib hem band, kangaroo pocket
  if (c.view === 'front' && !zipHood && (!puff || (anorak && o.pocket !== 'Chest'))) {
    const vt = hemV - 0.5, vb = hemV - 0.1;
    const pw = (v: number) => 0.46 + ((v - vt) / (vb - vt)) * 0.2;
    const ptsTop: Vec[] = [];
    for (let k = 0; k <= 8; k++) ptsTop.push(F(-pw(vt) + (2 * pw(vt) * k) / 8, vt + 0.012 * Math.sin((Math.PI * k) / 8)));
    const poly = [...ptsTop, F(pw(vb), vb), F(-pw(vb), vb)];
    out.push(
      <g key="pocket" pointerEvents="none">
        <path d={smooth(ptsTop)} fill="none" stroke="#000" strokeWidth={5} opacity={c.rendered ? 0.16 : 0} style={{ filter: 'blur(2px)' }} transform="translate(0 3)" />
        <path d={line(poly, true)} fill={c.fill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
        {c.rendered && <path d={line(poly, true)} fill={shade} opacity={0.1} />}
        {([-1, 1] as const).map((s) => (
          <path key={s} d={`M${f1(F(s * pw(vt), vt).x)},${f1(F(s * pw(vt), vt).y)} L${f1(F(s * pw(vb), vb).x)},${f1(F(s * pw(vb), vb).y)}`} stroke={c.outline} strokeWidth={3} opacity={0.2} fill="none" strokeLinecap="round" />
        ))}
        <path d={line(poly.map((p, i) => (i < 9 ? { x: p.x, y: p.y + 2.4 } : p)).slice(0, 9))} fill="none" stroke={ink} strokeWidth={0.5} strokeDasharray="1.6 1.3" opacity={0.6} />
      </g>,
    );
  }
  if (band.poly.length && !puff && !plainHem)
    out.push(
      <g key="band" clipPath={`url(#tclip-${c.g.id})`}>
        <RibBand {...band} c={c} id="hem" />
      </g>,
    );
  // sleeve cuffs
  const cuffO = cuffedOf(o);
  if (cuffO != null && !puff) {
    const len = sleeveOf(o) + (o.fit === 'Oversized' ? 0.2 : o.fit === 'Regular' ? 0.07 : 0.02);
    const edge = sleeveEdge(len, cuffO);
    for (const s of [-1, 1] as const) out.push(<Cuff key={`cf${s}`} c={c} s={s} a0={len - 0.27} a1={len} o0={edge(len - 0.27)} o1={cuffO} />);
  }
  void A;
  return <>{out}</>;
}

// ---------- moto jacket ----------

function motoFront(c: DetailCtx): ReactNode {
  const { F, U, A, ink, metal } = helpers(c);
  const o = c.g.top!;
  const hemV = c.hemV;
  const out: ReactNode[] = [];
  const lapelFill = c.rendered ? c.fill : c.fill;
  const hi = c.dark ? 0.14 : 0.1;
  const back = c.view === 'back';
  const band = hemBand(c.shape, 11);
  const nl = c.shape.neckline;

  if (!back && nl.length >= 17) {
    for (const s of [-1, 1] as const) {
      const inner = s > 0 ? nl.slice(0, 9) : nl.slice(8).reverse();
      const tip = F(s * 0.84, 0.3), notch = F(s * 0.56, 0.14), ctip = F(s * 0.7, 0.045), brk = F(s * 0.07, 0.5);
      const poly = [...inner, brk, tip, notch, ctip];
      const stand = [F(s * 0.31, -0.01), U(s * 0.34, 8), U(s * 0.52, 8), ctip];
      out.push(
        <g key={`lap${s}`} pointerEvents="none">
          <path d={smooth(stand, true)} fill={lapelFill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
          <path d={line(poly, true)} fill={lapelFill} stroke={c.outline} strokeWidth={c.rendered ? 1 : 1.5} strokeLinejoin="round" />
          <path d={line(poly, true)} fill="#fff" opacity={c.rendered ? hi : 0} />
          <path d={`M${f1(notch.x)},${f1(notch.y)} L${f1(F(s * 0.4, 0.14).x)},${f1(F(s * 0.4, 0.14).y)}`} stroke={c.outline} strokeWidth={0.8} opacity={0.7} />
          <Stitch d={line([F(s * 0.64, 0.07), F(s * 0.74, 0.28), F(s * 0.27, 0.46)].map((p, i) => ({ x: p.x + (i === 1 ? -s * 1.5 : 0), y: p.y })))} c={c} o={0.5} />
        </g>,
      );
    }
    // asymmetric front: the zip runs on a slant from the chest to the left hip, then straight down
    const zip = [F(0.1, 0.44), F(0.0, 0.62), F(-0.16, 0.85), F(-0.3, 1.0), F(-0.3, (1 + hemV) / 2), F(-0.3, hemV - 0.1)];
    const flap = zip.map((p, i) => ({ x: p.x + 8.5, y: p.y + (i === 0 ? 1.5 : 0) }));
    out.push(
      <g key="front" pointerEvents="none">
        <path d={smooth(flap)} fill="none" stroke={c.outline} strokeWidth={1} opacity={0.85} />
        <Stitch d={smooth(flap.map((p) => ({ x: p.x + 2.4, y: p.y })))} c={c} o={0.5} />
        <Zip pts={zip} c={c} />
      </g>,
    );
    // zip pockets: slanted at the hips, and a short one on the chest
    for (const s of [-1, 1] as const) {
      const p = [F(s * 0.36, hemV - 0.42), F(s * 0.58, hemV - 0.34), F(s * 0.8, hemV - 0.25)];
      const lip = p.map((q) => ({ x: q.x, y: q.y + 3.5 }));
      out.push(
        <g key={`zp${s}`} pointerEvents="none">
          <path d={smooth(lip)} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.7} />
          <Zip pts={s > 0 ? p : [...p].reverse()} c={c} w={1.6} />
        </g>,
      );
    }
    out.push(
      <g key="chest" pointerEvents="none">
        <Zip pts={[F(-0.7, 0.54), F(-0.5, 0.56), F(-0.32, 0.54)]} c={c} w={1.4} pull />
        <Stitch d={smooth([F(-0.7, 0.58), F(-0.5, 0.6), F(-0.32, 0.58)])} c={c} o={0.45} />
      </g>,
    );
  }

  if (back) {
    // collar stand round the back of the neck, yoke seam and centre seam
    const top = [U(-0.35, 2), U(-0.32, 11), U(0, 14), U(0.32, 11), U(0.35, 2)];
    const bot = [F(0.31, 0.05), F(0, 0.085), F(-0.31, 0.05)];
    out.push(
      <g key="collar" pointerEvents="none">
        <path d={smooth([...top, ...bot], true)} fill={lapelFill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
        <path d={smooth([F(-0.98, 0.34), F(-0.5, 0.31), F(0, 0.3), F(0.5, 0.31), F(0.98, 0.34)])} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.75} />
        <Stitch d={smooth([F(-0.96, 0.37), F(-0.5, 0.34), F(0, 0.33), F(0.5, 0.34), F(0.96, 0.37)])} c={c} o={0.45} />
        <path d={smooth([F(0, 0.085), F(0, 0.5), F(0, hemV - 0.1)])} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.7} />
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
        <path d={line([...a, ...b.reverse()], true)} fill={lapelFill} stroke={c.outline} strokeWidth={0.9} strokeLinejoin="round" />
        <path d={line([...a, ...[...b].reverse()], true)} fill="#fff" opacity={c.rendered ? hi : 0} />
        <circle cx={mid.x} cy={mid.y} r={1.9} fill={c.rendered ? metal : 'none'} stroke={ink} strokeWidth={0.7} />
      </g>,
    );
  }

  // belt band at the hem, with a buckle
  if (band.poly.length) {
    const bt = band.top, bh = band.hem;
    const buckleX = c.shape.hems.length ? F(0.34, hemV - 0.055) : { x: 0, y: 0 };
    out.push(
      <g key="belt" clipPath={`url(#tclip-${c.g.id})`} pointerEvents="none">
        <path d={line(band.poly, true)} fill={c.fill} />
        <path d={line(band.poly, true)} fill="#fff" opacity={c.rendered ? hi * 0.7 : 0} />
        <path d={line(bt)} fill="none" stroke={c.outline} strokeWidth={0.9} />
        <path d={line(bh)} fill="none" stroke={c.outline} strokeWidth={0.9} />
        <Stitch d={line(bt.map((p) => ({ x: p.x, y: p.y + 2.2 })))} c={c} o={0.55} />
        <Stitch d={line(bh.map((p) => ({ x: p.x, y: p.y - 2.2 })))} c={c} o={0.55} />
        {!back &&
          [1, 2, 3].map((k) => (
            <circle key={k} cx={buckleX.x + 9 + k * 4} cy={buckleX.y} r={0.9} fill="none" stroke={ink} strokeWidth={0.6} />
          ))}
      </g>,
    );
    if (!back)
      out.push(
        <g key="buckle" pointerEvents="none">
          <rect x={buckleX.x - 5.5} y={buckleX.y - 6} width={11} height={12} rx={1.6} fill={c.rendered ? metal : 'none'} stroke={ink} strokeWidth={1} />
          <rect x={buckleX.x - 3} y={buckleX.y - 3.5} width={6} height={7} rx={0.8} fill="none" stroke={ink} strokeWidth={0.7} />
          <path d={`M${f1(buckleX.x)},${f1(buckleX.y - 4)} V${f1(buckleX.y + 4)}`} stroke={ink} strokeWidth={0.8} />
        </g>,
      );
  }

  // zip cuffs
  const cuffO = cuffedOf(o) ?? 1.1;
  const len = sleeveOf(o) + (o.fit === 'Oversized' ? 0.1 : o.fit === 'Regular' ? 0.03 : 0);
  for (const s of [-1, 1] as const) {
    const n = 6;
    const edge = sleeveEdge(len, cuffO);
    const a0 = len - 0.3;
    const L: Vec[] = [], R: Vec[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((len - a0) * i) / n;
      L.push(A(s, a, -edge(a)));
      R.push(A(s, a, edge(a)));
    }
    out.push(
      <g key={`cuff${s}`} pointerEvents="none">
        <path d={smooth([...L, ...R.reverse()], true)} fill={lapelFill} stroke={c.outline} strokeWidth={0.8} />
        <path d={smooth([...L, ...[...R].reverse()], true)} fill="#fff" opacity={c.rendered ? hi * 0.6 : 0} />
        <Zip pts={[A(s, len - 0.04, 0.4), A(s, len - 0.17, 0.7), A(s, a0 + 0.03, 0.92)]} c={c} w={1.4} />
      </g>,
    );
  }
  return <>{out}</>;
}

// ---------- dress ----------

function dressFront(c: DetailCtx): ReactNode {
  const { F, A, ink } = helpers(c);
  const o = c.g.top!;
  const top = dressTopOf(o);
  const sil = silhouetteOf(o);
  const out: ReactNode[] = [];
  const hemV = dressHemV(o);
  const back = c.view === 'back';
  const nl = c.shape.neckline;

  // hem stitch
  const hem = bodyHem(c.shape);
  if (hem.length > 2) out.push(<Stitch key="hem" d={line(hem.map((p) => ({ x: p.x, y: p.y - 3 })))} c={c} o={0.55} />);

  if (sil === 'A-line') {
    // waist seam
    const pts: Vec[] = [];
    for (let k = 0; k <= 10; k++) pts.push(F(-1.06 + (2.12 * k) / 10, 1.0 + 0.012 * Math.sin((Math.PI * k) / 10)));
    out.push(
      <g key="seam" pointerEvents="none">
        <path d={smooth(pts)} fill="none" stroke={c.outline} strokeWidth={0.8} opacity={0.8} />
        <Stitch d={smooth(pts.map((p) => ({ x: p.x, y: p.y + 2.4 })))} c={c} o={0.45} />
      </g>,
    );
  }
  if (sil === 'Bodycon') {
    // side seams and a faint centre seam
    for (const s of [-1, 1] as const) out.push(<path key={`ss${s}`} d={smooth([F(s * 0.97, 0.45), F(s * 0.9, 1.0), F(s * 0.96, 1.5), F(s * 0.9, (1.5 + hemV) / 2)])} fill="none" stroke={c.outline} strokeWidth={0.6} opacity={0.35} pointerEvents="none" />);
  }
  if (back) {
    // invisible zip down the centre back
    const z = [F(0, top === 'Straps' || top === 'Strapless' ? 0.34 : 0.07), F(0, 0.8), F(0, 1.5)];
    out.push(<Zip key="zip" pts={z} c={c} w={1.3} />);
  }
  // sleeve cuffs seam
  if (sleeveOf(o) > 1) {
    for (const s of [-1, 1] as const) {
      const a = sleeveOf(o) - 0.14;
      out.push(<path key={`c${s}`} d={smooth([A(s, a, -1.1), A(s, a + 0.02, 0), A(s, a, 1.1)])} fill="none" stroke={c.outline} strokeWidth={0.7} opacity={0.5} pointerEvents="none" />);
    }
  }
  // neckline trim
  if (!back && nl.length > 2) out.push(<path key="trim" d={line(nl.map((p) => ({ x: p.x, y: p.y + 2.8 })))} fill="none" stroke={ink} strokeWidth={0.5} strokeDasharray="1.6 1.3" opacity={0.55} pointerEvents="none" />);
  return <>{out}</>;
}

/** Spaghetti straps, drawn over the shoulder and not clipped by the dress. */
function dressOver(c: DetailCtx): ReactNode {
  const o = c.g.top!;
  if (dressTopOf(o) !== 'Straps') return null;
  const { F, U } = helpers(c);
  const nl = c.shape.neckline;
  const near = (x: number): Vec => nl.reduce((b, p) => (Math.abs(p.x - x) < Math.abs(b.x - x) ? p : b), nl[0]);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      {([-1, 1] as const).map((s) => {
        const a = near(F(s * 0.56, 0.3).x);
        const b = F(s * 0.5, 0.0);
        const mid = { x: (a.x + b.x) / 2 + s * 0.6, y: (a.y + b.y) / 2 };
        const p = c.view === 'back' ? [{ x: a.x, y: a.y }, mid, U(s * 0.5, -1)] : [a, mid, b];
        const d = `M${f1(p[0].x)},${f1(p[0].y + 1)} Q${f1(p[1].x)},${f1(p[1].y)} ${f1(p[2].x)},${f1(p[2].y)}`;
        return (
          <g key={s}>
            <path d={d} stroke={c.outline} strokeWidth={3.8} />
            <path d={d} stroke={c.base} strokeWidth={2.4} />
            {c.rendered && <path d={d} stroke="#fff" strokeWidth={0.7} opacity={c.dark ? 0.35 : 0.5} />}
          </g>
        );
      })}
    </g>
  );
}

// ---------- entry points ----------

/** Drawn first, behind the body (the hood lying behind the neck). */
export function BehindBody({ c }: { c: DetailCtx }) {
  return isHoodie(c.g.top) ? <>{hoodieBehind(c)}</> : null;
}

/** Drawn on the body, under the holes mask. */
export function OnBody({ c }: { c: DetailCtx }) {
  return (
    <>
      {blockDetails(c)}
      {styleOverlay(c)}
    </>
  );
}

function blockDetails(c: DetailCtx): ReactNode {
  switch (c.g.top?.block) {
    case 'Anorak':
      return <>{hoodieFront(c)}{streetFront(c)}</>;
    case 'Hoodie':
    case 'Zip hoodie':
      return <>{hoodieFront(c)}</>;
    case 'Puffer':
      return <>{c.g.top?.hood ? hoodieFront(c) : null}{moreFront(c)}</>;
    case 'Moto jacket':
      return <>{motoFront(c)}</>;
    case 'Dress':
      return <>{dressFront(c)}</>;
    default:
      return <>{moreFront(c)}</>;
  }
}

/** Drawn over everything, outside the body clip. */
export function OverBody({ c }: { c: DetailCtx }) {
  return c.g.top?.block === 'Dress' ? <>{dressOver(c)}</> : null;
}

