import { memo } from 'react';
import {
  garmentPaths,
  holeThreads,
  isDarkWash,
  ripPath,
  WASHES,
  zig,
  type Garment,
} from '../model/garment';
import { mix } from '../model/color';
import { foldStrokes, highlightStrokes } from '../model/shading';
import { polyPath, ripFray, ripPoly, ripThreads, wornPatch } from '../model/rips';
import { FabricDefs, fabricId, hasOverlay, overlayId } from './FabricDefs';

const ACCENT = '#C8102E';
const BIG = { x: -60, y: -60, w: 420, h: 760 };

interface Props {
  g: Garment;
  selectedText: number | null;
  /** Show the dashed cut guide (only for the selected garment). */
  showCut: boolean;
  rendered: boolean;
  shading: boolean;
  /** Waist curve for the posed view, garment units. */
  sag?: number;
  /** Outline to stroke and shade instead of the full body path (skips hidden joins). */
  edge?: string;
  /** Leg layer drawn behind the rest: no band, pockets, fly or text. */
  legOnly?: boolean;
  /** Darken the whole layer (the leg furthest from the viewer). */
  dim?: boolean;
  /** Suffix for defs ids when the same garment is drawn as more than one layer. */
  layer?: string;
}

/** Renders one garment from data, in garment space, inside its own transform. */
export const GarmentView = memo(function GarmentView({ g, selectedText, showCut, rendered, shading, sag = 0, edge, legOnly = false, dim = false, layer = '' }: Props) {
  const paths = garmentPaths(g, sag);
  const { body } = paths;
  const band = legOnly ? '' : paths.band;
  const details = legOnly ? '' : paths.details;
  const solid = legOnly ? '' : paths.solid;
  const strap = legOnly ? '' : paths.strap;
  const line = edge ?? body;
  const uid = g.id + layer;
  const dimTop = g.points.find((p) => p.key === 'crotch')?.y ?? 0;
  const dark = isDarkWash(g.wash);
  const base = WASHES[g.wash];
  const t = g.transform;
  const cropH = g.cropY ?? 520;
  const shapeId = `shape-${uid}`;
  const cropId = `crop-${uid}`;
  const maskId = `hm-${uid}`;

  const fill = rendered ? `url(#${fabricId(g)})` : base;
  const outline = rendered ? mix(base, '#000000', 0.7) : '#141414';
  const holes = rendered ? g.holes.map((h, i) => ({ h, i, poly: ripPoly(g.id, i, h) })) : [];

  return (
    <g id={`garment-${uid}`} transform={`translate(${t.x} ${t.y}) scale(${t.scale})`} data-gid={g.id}>
      <defs>
        <clipPath id={cropId}>
          <rect x={-60} y={-60} width={420} height={cropH + 60} />
        </clipPath>
        <clipPath id={shapeId}>
          <path d={body} />
          {band && <path d={band} />}
        </clipPath>
        {rendered && (
          <>
            <FabricDefs g={g} />
            <filter id={`bl-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={5} />
            </filter>
            <filter id={`sf-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation={0.9} />
            </filter>
            <filter id={`wn-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={3} />
            </filter>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={BIG.x} y={BIG.y} width={BIG.w} height={BIG.h}>
              <rect x={BIG.x} y={BIG.y} width={BIG.w} height={BIG.h} fill="#fff" />
              {holes.map(({ i, poly }) => (
                <path key={i} d={polyPath(poly)} fill="#000" />
              ))}
            </mask>
            {holes.map(({ i, poly }) => (
              <g key={i}>
                <clipPath id={`hc-${uid}-${i}`}>
                  <path d={polyPath(poly)} />
                </clipPath>
                <clipPath id={`ho-${uid}-${i}`}>
                  <path
                    clipRule="evenodd"
                    d={`M${BIG.x},${BIG.y} H${BIG.x + BIG.w} V${BIG.y + BIG.h} H${BIG.x} Z ${polyPath(poly)}`}
                  />
                </clipPath>
              </g>
            ))}
          </>
        )}
      </defs>
      <g clipPath={`url(#${cropId})`}>
        <g mask={rendered && holes.length ? `url(#${maskId})` : undefined}>
          <path d={body} fill={fill} stroke={edge ? 'none' : outline} strokeWidth={rendered ? 1.4 : 1.6} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />
          {edge && <path d={edge} fill="none" stroke={outline} strokeWidth={rendered ? 1.4 : 1.6} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
          {band && <path d={band} fill={fill} stroke={outline} strokeWidth={rendered ? 1.4 : 1.6} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />}
          {rendered && hasOverlay(g) && (
            <g pointerEvents="none">
              <path d={body} fill={`url(#${overlayId(g)})`} />
              {band && <path d={band} fill={`url(#${overlayId(g)})`} />}
            </g>
          )}
          {dim && (
            <>
              <linearGradient id={`dim-${uid}`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={dimTop - 4} y2={dimTop + 46}>
                <stop offset={0} stopColor="#000" stopOpacity={0} />
                <stop offset={1} stopColor="#000" stopOpacity={rendered ? 0.32 : 0.16} />
              </linearGradient>
              <path d={body} fill={`url(#dim-${uid})`} pointerEvents="none" />
            </>
          )}
          {rendered && shading && (
            <g clipPath={`url(#${shapeId})`} pointerEvents="none">
              <g filter={`url(#bl-${uid})`} fill="none" stroke="#000" strokeWidth={16} strokeLinejoin="round" opacity={0.42} style={{ mixBlendMode: 'multiply' }}>
                <path d={line} />
                {band && <path d={band} />}
              </g>
              <g fill="none" stroke="#000" strokeLinecap="round">
                {foldStrokes(g).map((s, i) => (
                  <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                ))}
              </g>
              <g fill="none" stroke="#fff" strokeLinecap="round" filter={`url(#sf-${uid})`}>
                {highlightStrokes(g).map((s, i) => (
                  <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                ))}
              </g>
            </g>
          )}
          <path d={details} fill="none" stroke={rendered ? '#D9C48A' : dark ? '#C9CDD2' : '#5A5A5A'} strokeOpacity={rendered ? 0.8 : 1} strokeWidth={1.1} strokeLinecap="round" strokeDasharray="3 2" pointerEvents="none" />
          <path d={solid} fill="none" stroke={rendered ? mix(base, '#000000', 0.65) : '#141414'} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
          <g clipPath={`url(#${shapeId})`}>
            {g.distress.map((d, i) => {
              if (!rendered) {
                return (
                  <g key={`r${i}`}>
                    <path d={ripPath(d)} fill="none" stroke="#F4F2ED" strokeWidth={1.4} strokeLinecap="round" pointerEvents="none" />
                    <circle cx={d.x} cy={d.y} r={12} fill="transparent" data-kind="dist" data-i={i} data-gid={g.id} />
                  </g>
                );
              }
              const w = wornPatch(g.id, i, d);
              return (
                <g key={`r${i}`}>
                  <ellipse cx={d.x} cy={d.y} rx={w.rx} ry={w.ry} fill="#fff" opacity={0.28} filter={`url(#wn-${uid})`} pointerEvents="none" />
                  <path d={w.ticks} stroke="#fff" strokeWidth={0.8} strokeLinecap="round" opacity={0.85} pointerEvents="none" />
                  <circle cx={d.x} cy={d.y} r={12} fill="transparent" data-kind="dist" data-i={i} data-gid={g.id} />
                </g>
              );
            })}
            {!rendered &&
              g.holes.map((h, i) => (
                <g key={`h${i}`}>
                  <ellipse cx={h.x} cy={h.y} rx={h.r} ry={h.r * 0.7} fill="#F4F2ED" stroke="#141414" strokeWidth={0.9} data-kind="hole" data-i={i} data-gid={g.id} />
                  <path d={holeThreads(h)} fill="none" stroke={dark ? '#C9CDD2' : '#5A5A5A'} strokeWidth={1} pointerEvents="none" />
                </g>
              ))}
            {g.cropY != null && (
              <path d={zig(30, 280, g.cropY - 3, 3, 5)} fill="none" stroke="#F4F2ED" strokeWidth={1.6} strokeLinejoin="round" pointerEvents="none" />
            )}
          </g>
        </g>
        {/* ragged holes: worn ring, white weft threads and frayed marks, drawn over the cut-out */}
        {holes.map(({ h, i, poly }) => (
          <g key={`rh${i}`}>
            <g clipPath={`url(#ho-${uid}-${i})`} pointerEvents="none">
              <path d={polyPath(poly)} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinejoin="round" opacity={0.28} />
              <path d={ripFray(g.id, i, h, poly)} stroke="#fff" strokeWidth={0.8} strokeLinecap="round" opacity={0.8} fill="none" />
            </g>
            <path d={polyPath(poly)} fill="none" stroke="#000" strokeWidth={0.9} opacity={0.5} strokeLinejoin="round" pointerEvents="none" />
            <g clipPath={`url(#hc-${uid}-${i})`} fill="none" stroke="#fff" strokeLinecap="round" pointerEvents="none">
              {ripThreads(g.id, i, poly).map((s, k) => (
                <path key={k} d={s.d} strokeWidth={s.w} opacity={s.o} />
              ))}
            </g>
            <path d={polyPath(poly)} fill="transparent" data-kind="hole" data-i={i} data-gid={g.id} />
          </g>
        ))}
        <g clipPath={`url(#${shapeId})`}>
          {!legOnly && g.texts.map((x, i) => (
            <text
              key={`t${i}`}
              x={x.x}
              y={x.y}
              textAnchor="middle"
              fontFamily="Archivo Black, sans-serif"
              fontSize={x.size}
              fill={dark ? '#F4F2ED' : '#141414'}
              stroke={selectedText === i ? ACCENT : 'none'}
              strokeWidth={selectedText === i ? 1.2 : 0}
              paintOrder="stroke"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              data-kind="text"
              data-i={i}
              data-gid={g.id}
            >
              {x.t}
            </text>
          ))}
        </g>
      </g>
      {strap && <path d={strap} fill="none" stroke={ACCENT} strokeWidth={4} strokeLinecap="round" pointerEvents="none" />}
      {showCut && g.cropY != null && <path d={`M10,${g.cropY} H290`} fill="none" stroke={ACCENT} strokeWidth={1.2} strokeDasharray="5 4" pointerEvents="none" />}
    </g>
  );
});
