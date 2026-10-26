import { memo } from 'react';
import { isDarkGarment, type Garment } from '../model/garment';
import { garmentHex } from '../model/production';
import { AllOverFill, GraphicsLayer } from './GraphicsLayer';
import { smooth, type TorsoProfile, type Vec } from '../model/figure';
import { sleeveOf, sleeveStyleOf, stiffOf, topForward, topShape, torsoPt, viewPoints } from '../model/top';
import { BehindBody, OnBody, OverBody, type DetailCtx } from './TopDetails';
import { mix } from '../model/color';
import { topFolds } from '../model/topFolds';
import { uv } from '../model/top';
import { polyPath, ripPoly, ripThreads, wornPatch } from '../model/rips';
import { FabricDefs, fabricId } from './FabricDefs';

const ACCENT = '#C8102E';
const f1 = (n: number) => n.toFixed(1);
/** Tapered ribbon along a curve: pointed ends, w wide in the middle. */
function ribbon(c: Vec[], w: number, shift = 0): string {
  if (c.length < 2) return '';
  const L: Vec[] = [], R: Vec[] = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len, ny = -dx / len;
    const f = i / (c.length - 1);
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * f), 0.8);
    L.push({ x: c[i].x + nx * (hw + shift), y: c[i].y + ny * (hw + shift) });
    R.push({ x: c[i].x - nx * (hw - shift), y: c[i].y - ny * (hw - shift) });
  }
  return smooth([...L, ...R.reverse()], true);
}

/** Sample a 3-point fold as a smooth curve. */
function sample(p: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    out.push({ x: (1 - k) * (1 - k) * p[0].x + 2 * (1 - k) * k * p[1].x + k * k * p[2].x, y: (1 - k) * (1 - k) * p[0].y + 2 * (1 - k) * k * p[1].y + k * k * p[2].y });
  }
  return out;
}

const line = (pts: Vec[], closed = false) => (pts.length ? 'M' + pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' L') + (closed ? ' Z' : '') : '');

interface Props {
  g: Garment;
  t: TorsoProfile;
  rendered: boolean;
  shading: boolean;
  selectedText: number | null;
  /** Female croquis: shade under the bust. */
  bust: boolean;
  view: 'front' | 'back';
  selectedGraphic?: string | null;
}

/** A top drawn straight onto the body. Everything here is in canvas space. */
export const TopView = memo(function TopView({ g, t, rendered, shading, selectedText, bust, view, selectedGraphic = null }: Props) {
  const stiff = stiffOf(g.top);
  const pts = viewPoints(g.points, g.top, view);
  const shape = topShape(t, pts, stiff, g.top);
  const body = smooth(shape.outline, true);
  const base = garmentHex(g);
  const dark = isDarkGarment(g);
  const outline = rendered ? mix(base, '#000000', dark ? 0.55 : 0.45) : '#141414';
  const uid = g.id;
  const clip = `tclip-${uid}`;
  const F = (u: number, v: number) => topForward(t, torsoPt(u, v), stiff);
  const xs = shape.outline.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const fabricG = { ...g, points: shape.outline };
  const hemP = g.points.find((p) => p.key === 'hemL');
  const folds = g.top ? topFolds(g.id, g.top, hemP ? uv(hemP).v : 1, bust) : [];
  const shadeC = mix(base, '#000000', dark ? 0.7 : 0.55);
  // set-in sleeve seam: from the shoulder point round the top of the arm to the underarm
  const armholes: string[] = [];
  if (g.top && sleeveOf(g.top) > 0 && sleeveStyleOf(g.top) !== 'Raglan') {
    for (const K of ['L', 'R'] as const) {
      const sh = g.points.find((p) => p.key === `sh${K}`), pit = g.points.find((p) => p.key === `arm${K}`);
      if (!sh || !pit) continue;
      const drop = (g.top.fit === 'Oversized' ? 0.3 : g.top.fit === 'Boxy' ? 0.2 : g.top.fit === 'Regular' ? 0.12 : 0.06) + (sleeveStyleOf(g.top) === 'Dropped' ? 0.16 : 0);
      const side = K === 'L' ? 'armL' : 'armR';
      const a0 = topForward(t, sh, stiff), a2 = topForward(t, pit, stiff);
      const c1 = topForward(t, { x: drop * 100 * 0.9, y: 100 - 35, r: side }, stiff);
      const c2 = topForward(t, { x: drop * 100 * 0.7, y: 100 + 45, r: side }, stiff);
      armholes.push(`M${f1(a0.x)},${f1(a0.y)} C${f1(c1.x)},${f1(c1.y)} ${f1(c2.x)},${f1(c2.y)} ${f1(a2.x)},${f1(a2.y)}`);
    }
  }
  const fill = rendered ? `url(#${fabricId(g)})` : base;
  const hemV = hemP ? uv(hemP).v : 1;
  const dctx: DetailCtx = { g, t, shape, stiff, rendered, view, base, dark, fill, outline, hemV };
  const holes = g.holes.map((h, i) => {
    const c = topForward(t, { x: h.x, y: h.y }, stiff);
    const hh = { x: c.x, y: c.y, r: h.r * 1.1 };
    return { h: hh, i, poly: ripPoly(g.id, i, hh) };
  });

  return (
    <g id={`garment-${uid}`} data-gid={g.id}>
      <defs>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
        <FabricDefs g={fabricG} />
        <mask id={`tm-${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={600} height={1000}>
          <rect x={0} y={0} width={600} height={1000} fill="#fff" />
          {holes.map(({ i, poly }) => (
            <path key={i} d={polyPath(poly)} fill="#000" />
          ))}
        </mask>
        <filter id={`tb-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={4} />
        </filter>
        <filter id={`tf-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={0.9} />
        </filter>
        <filter id={`ts-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={1.8} />
        </filter>
        <linearGradient id={`tl-${uid}`} gradientUnits="userSpaceOnUse" x1={x0} x2={x1} y1={0} y2={0}>
          <stop offset={0} stopColor="#fff" stopOpacity={dark ? 0.1 : 0.28} />
          <stop offset={0.45} stopColor="#fff" stopOpacity={0} />
          <stop offset={1} stopColor="#000" stopOpacity={dark ? 0.28 : 0.16} />
        </linearGradient>
      </defs>
      <BehindBody c={dctx} />
      <g mask={holes.length ? `url(#tm-${uid})` : undefined}>
        <path d={body} fill={fill} stroke={outline} strokeWidth={rendered ? 0.9 : 1.5} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />
        {g.allOver && (
          <g clipPath={`url(#${clip})`}>
            <AllOverFill g={g} d={[body]} k={0.8} uid={uid} />
          </g>
        )}
        {rendered && shading && (
          <g clipPath={`url(#${clip})`} pointerEvents="none">
            {/* light from the upper left: one soft shadow side, like marker shading */}
            <rect x={0} y={0} width={600} height={1000} fill={`url(#tl-${uid})`} />
            <path d={body} fill="none" stroke={shadeC} strokeWidth={14} opacity={dark ? 0.35 : 0.14} filter={`url(#tb-${uid})`} transform="translate(-4 0)" />
            {bust && stiff < 0.6 &&
              [-1, 1].map((sx) => {
                const c = F(sx * 0.46, 0.41);
                return <path key={sx} d={`M${f1(c.x - 15)},${f1(c.y)} Q${f1(c.x)},${f1(c.y + 11)} ${f1(c.x + 15)},${f1(c.y - 1)}`} fill="none" stroke={shadeC} strokeWidth={6} opacity={dark ? 0.3 : 0.13} filter={`url(#tb-${uid})`} />;
              })}
          </g>
        )}
        {rendered && (
          <g clipPath={`url(#${clip})`} pointerEvents="none">
            {/* fold lines drawn like ink: thin, tapered, no glow */}
            {folds.map((fd, i) => {
              const c = sample(fd.pts.map((p) => topForward(t, p, stiff)));
              return <path key={i} d={ribbon(c, Math.min(1.8, 0.6 + fd.w * 0.22))} fill={outline} opacity={Math.min(0.75, 0.25 + fd.o * 1.6)} />;
            })}
          </g>
        )}
        <OnBody c={dctx} />
        {/* neckline binding */}
        <g fill="none" pointerEvents="none" strokeLinecap="round">
          <path d={line(shape.neckline)} stroke={outline} strokeWidth={0.8} transform="translate(0 3)" opacity={0.8} />
        </g>
        <g clipPath={`url(#${clip})`}>
          {g.distress.map((d, i) => {
            const c = topForward(t, { x: d.x, y: d.y }, stiff);
            const w = wornPatch(g.id, i, c);
            return (
              <g key={`r${i}`}>
                <ellipse cx={c.x} cy={c.y} rx={w.rx} ry={w.ry} fill="#fff" opacity={0.25} filter={`url(#ts-${uid})`} pointerEvents="none" />
                <path d={w.ticks} stroke={dark ? '#fff' : '#555'} strokeWidth={0.7} opacity={0.8} pointerEvents="none" />
                <circle cx={c.x} cy={c.y} r={10} fill="transparent" data-kind="dist" data-i={i} data-gid={g.id} />
              </g>
            );
          })}
        </g>
      </g>
      <OverBody c={dctx} />
      {holes.map(({ i, poly }) => (
        <g key={`h${i}`}>
          <path d={polyPath(poly)} fill="none" stroke="#000" strokeWidth={0.8} opacity={0.45} pointerEvents="none" />
          <g fill="none" stroke={dark ? '#ddd' : '#fff'} strokeLinecap="round" pointerEvents="none">
            {ripThreads(g.id, i, poly).map((s, k) => (
              <path key={k} d={s.d} strokeWidth={s.w * 0.7} opacity={s.o} />
            ))}
          </g>
          <path d={polyPath(poly)} fill="transparent" data-kind="hole" data-i={i} data-gid={g.id} />
        </g>
      ))}
      <g clipPath={`url(#${clip})`}>
        <GraphicsLayer g={g} view={view} map={(x, y) => topForward(t, { x, y }, stiff)} k={0.8} selectedId={selectedGraphic} uid={uid} />
        {g.texts.map((x, i) => {
          const c = topForward(t, { x: x.x, y: x.y }, stiff);
          return (
            <text
              key={`t${i}`}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              fontFamily="Archivo Black, sans-serif"
              fontSize={x.size * 0.8}
              fill={dark ? '#F4F2ED' : '#141414'}
              stroke={selectedText === i ? ACCENT : 'none'}
              strokeWidth={selectedText === i ? 1 : 0}
              paintOrder="stroke"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              data-kind="text"
              data-i={i}
              data-gid={g.id}
            >
              {x.t}
            </text>
          );
        })}
      </g>
    </g>
  );
});
