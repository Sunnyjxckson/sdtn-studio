import { memo } from 'react';
import {
  garmentPaths,
  hemPaths,
  holeThreads,
  isDarkGarment,
  ripPath,
  zig,
  type Garment,
} from '../model/garment';
import { mix } from '../model/color';
import { garmentHex } from '../model/production';
import { AllOverFill, GraphicsLayer } from './GraphicsLayer';
import { drapeFolds, fadeSpots, foldStrokes, highlightStrokes, skirtFolds, whiskerStrokes } from '../model/shading';
import { honeycomb, polyPath, ripFray, ripLoose, ripPoly, ripThreads, ripWarp, seamStitch, wornPatch } from '../model/rips';
import { FabricDefs, fabricId, hasOverlay, overlayId, slubId } from './FabricDefs';

const ACCENT = '#C8102E';
const THREAD_TONES = ['#F3EFE4', '#DCD8CC', '#B9BCBD'];
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
  /** Pull the top corners of the waistband in (garment units, left and right). */
  bandInset?: [number, number];
  /** Suffix for defs ids when the same garment is drawn as more than one layer. */
  layer?: string;
  /** Which side of the body faces the viewer, for placed graphics. */
  view?: 'front' | 'back';
  selectedGraphic?: string | null;
}

/** Renders one garment from data, in garment space, inside its own transform. */
export const GarmentView = memo(function GarmentView({ g, selectedText, showCut, rendered, shading, sag = 0, edge, legOnly = false, dim = false, layer = '', bandInset, view = 'front', selectedGraphic = null }: Props) {
  const paths = garmentPaths(g, sag, bandInset);
  const { body } = paths;
  const band = legOnly ? '' : paths.band;
  const details = legOnly ? '' : paths.details;
  const solid = legOnly ? '' : paths.solid;
  const strap = legOnly ? '' : paths.strap;
  const line = edge ?? body;
  const uid = g.id + layer;
  const dimTop = g.points.find((p) => p.key === 'crotch')?.y ?? 0;
  const dark = isDarkGarment(g);
  const base = garmentHex(g);
  const t = g.transform;
  const cropH = g.cropY ?? 520;
  const shapeId = `shape-${uid}`;
  const cropId = `crop-${uid}`;
  const maskId = `hm-${uid}`;

  const fill = rendered ? `url(#${fabricId(g)})` : base;
  const outline = rendered ? mix(base, '#000000', 0.62) : '#141414';
  const sw = rendered ? 1.1 : 1.6;
  const tonal = !!g.pants;
  const thread = tonal ? mix(base, dark ? '#ffffff' : '#000000', dark ? 0.36 : 0.3) : '#D8A640';
  const skirt = g.type === 'skirt';
  const hem = hemPaths(g);
  const sk = skirt ? skirtFolds(g) : null;
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
              <feGaussianBlur stdDeviation={6} />
            </filter>
            <filter id={`sf-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation={1.6} />
            </filter>
            <filter id={`ir-${uid}`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation={1.7} />
            </filter>
            <filter id={`hl-${uid}`} x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation={1.8} />
            </filter>
            <filter id={`ws-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={0.55} />
            </filter>
            <filter id={`fs-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={2.2} />
            </filter>
            <filter id={`wn-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={3} />
            </filter>
            <filter id={`fd-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={9} />
            </filter>
            <filter id={`wk-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={1.5} />
            </filter>
            <filter id={`gr-${uid}`} filterUnits="userSpaceOnUse" x={BIG.x} y={BIG.y} width={BIG.w} height={BIG.h}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9 0.045" numOctaves={2} seed={7} />
              <feColorMatrix type="saturate" values="0" />
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
          <path d={body} fill={fill} stroke={edge ? 'none' : outline} strokeWidth={sw} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />
          {edge && <path d={edge} fill="none" stroke={outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />}
          {band && <path d={band} fill={fill} stroke={outline} strokeWidth={sw} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />}
          {rendered && g.fabric === 'Denim' && (
            <g pointerEvents="none">
              <path d={body} fill={`url(#${slubId(g)})`} />
              {band && <path d={band} fill={`url(#${slubId(g)})`} />}
            </g>
          )}
          {g.allOver && <AllOverFill g={g} d={[body, band]} k={1} uid={uid} />}
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
              <g filter={`url(#bl-${uid})`} fill="none" stroke="#000" strokeWidth={16} strokeLinejoin="round" opacity={0.34} style={{ mixBlendMode: 'multiply' }}>
                <path d={line} />
                {band && <path d={band} />}
              </g>
              {g.fabric === 'Denim' && (
                <rect x={BIG.x} y={BIG.y} width={BIG.w} height={BIG.h} filter={`url(#gr-${uid})`} opacity={0.32} style={{ mixBlendMode: 'overlay' }} />
              )}
              {(() => {
                const xs = g.points.map((p) => p.x);
                const x0 = Math.min(...xs), x1 = Math.max(...xs);
                const df = sk ?? drapeFolds(g);
                return (
                  <>
                    <linearGradient id={`lt-${uid}`} gradientUnits="userSpaceOnUse" x1={x0} x2={x1} y1={0} y2={0}>
                      <stop offset={0} stopColor="#fff" stopOpacity={0.1} />
                      <stop offset={0.45} stopColor="#fff" stopOpacity={0} />
                      <stop offset={1} stopColor="#000" stopOpacity={0.24} />
                    </linearGradient>
                    <rect x={BIG.x} y={BIG.y} width={BIG.w} height={BIG.h} fill={`url(#lt-${uid})`} />
                    <g fill="none" stroke="#000" strokeLinecap="round" filter={`url(#wn-${uid})`}>
                      {df.dark.map((s, i) => (
                        <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                      ))}
                    </g>
                    <g fill="none" stroke="#fff" strokeLinecap="round" filter={`url(#wn-${uid})`}>
                      {df.light.map((s, i) => (
                        <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                      ))}
                    </g>
                  </>
                );
              })()}
              <g fill="#fff" filter={`url(#fd-${uid})`}>
                {fadeSpots(g).map((s, i) => (
                  <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} opacity={s.o} />
                ))}
              </g>
              {!legOnly && (
                <g fill="none" stroke="#fff" strokeLinecap="round" filter={`url(#ws-${uid})`}>
                  {whiskerStrokes(g).map((s, i) => (
                    <path key={i} d={s.d} strokeWidth={s.w * 0.8} opacity={Math.min(0.7, s.o * 1.5)} />
                  ))}
                </g>
              )}
              {g.fabric === 'Denim' && !skirt && (() => {
                const hc = honeycomb(g);
                return (
                  <>
                    <g fill="none" stroke="#000" strokeLinecap="round" transform="translate(0 1.4)" filter={`url(#ws-${uid})`}>
                      {hc.dark.map((s, i) => (
                        <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                      ))}
                    </g>
                    <g fill="none" stroke="#fff" strokeLinecap="round" filter={`url(#ws-${uid})`}>
                      {hc.light.map((s, i) => (
                        <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                      ))}
                    </g>
                  </>
                );
              })()}
              <g fill="none" stroke="#000" strokeLinecap="round" filter={`url(#fs-${uid})`}>
                {(skirt ? [] : foldStrokes(g)).map((s, i) => (
                  <path key={i} d={s.d} strokeWidth={s.w * 1.6} opacity={s.o * 0.8} />
                ))}
              </g>
              <g fill="none" stroke="#fff" strokeLinecap="round" filter={`url(#sf-${uid})`}>
                {(sk ? sk.hi : highlightStrokes(g)).map((s, i) => (
                  <path key={i} d={s.d} strokeWidth={s.w} opacity={s.o} />
                ))}
              </g>
            </g>
          )}
          <path d={details} clipPath={g.pants ? `url(#${shapeId})` : undefined} fill="none" stroke={rendered ? (tonal ? thread : '#D9C48A') : dark ? '#C9CDD2' : '#5A5A5A'} strokeOpacity={rendered ? 0.8 : 1} strokeWidth={1.1} strokeLinecap="round" strokeDasharray="3 2" pointerEvents="none" />
          <path d={solid} clipPath={(g.type === "shorts" || !!g.pants) ? `url(#${shapeId})` : undefined} fill="none" stroke={rendered ? mix(base, '#000000', 0.65) : '#141414'} strokeWidth={rendered ? 1 : 1.3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
          {paths.crease && !legOnly && (
            <g pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${shapeId})`}>
              <path d={paths.crease} stroke={rendered ? '#000' : '#141414'} strokeOpacity={rendered ? 0.28 : 0.5} strokeWidth={0.8} transform="translate(1 0)" />
              <path d={paths.crease} stroke="#fff" strokeOpacity={rendered ? 0.3 : 0} strokeWidth={1.3} />
            </g>
          )}
          {rendered && !legOnly && (
            <g pointerEvents="none" clipPath={g.pants ? `url(#${shapeId})` : undefined}>
              {[
                ...(g.type === 'shorts' ? [] : [{ d: solid, t: 'translate(0 2.2)' }]),
                { d: paths.stitch, t: undefined },
                { d: seamStitch(g), t: undefined },
              ].map((l, i) => (
                <g key={i} transform={l.t} fill="none" strokeLinecap="round">
                  <path d={l.d} stroke="#000" strokeOpacity={0.35} strokeWidth={1.1} strokeDasharray="2.6 1.5" transform="translate(0.3 0.8)" />
                  <path d={l.d} stroke={thread} strokeWidth={1.05} strokeDasharray="2.6 1.5" />
                  <path d={l.d} stroke="#F4DC9A" strokeOpacity={0.55} strokeWidth={0.35} strokeDasharray="2.6 1.5" transform="translate(0 -0.25)" />
                </g>
              ))}
              {paths.rivets.map((r, i) => (
                <circle key={i} cx={r.x} cy={r.y} r={1.8} fill={g.pants ? '#B9B5AB' : '#B07A45'} stroke={g.pants ? '#55524B' : '#5C3A1E'} strokeWidth={0.5} />
              ))}
              {paths.button && (
                <>
                  <circle cx={paths.button.x} cy={paths.button.y} r={3.8} fill="#A6A49E" stroke="#4A4844" strokeWidth={0.7} />
                  <circle cx={paths.button.x} cy={paths.button.y} r={2} fill="none" stroke="#6E6C67" strokeWidth={0.5} />
                </>
              )}
            </g>
          )}
          <g clipPath={`url(#${shapeId})`}>
            {holes.map(({ h, i }) => (
              <ellipse key={`hw${i}`} cx={h.x} cy={h.y} rx={h.r * 2.9} ry={h.r * 1.5} fill="#fff" opacity={0.2} filter={`url(#wn-${uid})`} pointerEvents="none" />
            ))}
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
                  <ellipse cx={d.x} cy={d.y} rx={w.rx} ry={w.ry} fill="#fff" opacity={0.26} filter={`url(#wn-${uid})`} pointerEvents="none" />
                  <path d={w.gaps} stroke="#000" strokeWidth={0.6} strokeLinecap="round" opacity={0.3} fill="none" pointerEvents="none" />
                  <path d={w.ticks} stroke="#fff" strokeWidth={0.55} strokeLinecap="round" opacity={0.7} fill="none" pointerEvents="none" />
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
        {/* ragged holes: inner shadow, white weft threads across the gap, torn rim, fray and loose threads */}
        {holes.map(({ h, i, poly }) => {
          const pd = polyPath(poly);
          return (
            <g key={`rh${i}`}>
              <g clipPath={`url(#hc-${uid}-${i})`} pointerEvents="none">
                <path d={pd} fill="none" stroke="#000" strokeWidth={5} strokeLinejoin="round" opacity={0.38} transform="translate(0 1.4)" filter={`url(#ir-${uid})`} />
                <path d={ripWarp(g.id, i, h, poly)} fill="none" stroke={mix(base, '#000000', 0.35)} strokeWidth={0.7} strokeLinecap="round" opacity={0.9} />
                <g fill="none" strokeLinecap="round">
                  {ripThreads(g.id, i, poly).map((s, k) => (
                    <g key={k}>
                      <path d={s.d} stroke="#000" strokeWidth={s.w + 0.4} opacity={0.32} transform="translate(0.2 0.9)" />
                      <path d={s.d} stroke={THREAD_TONES[s.t]} strokeWidth={s.w} opacity={s.o} />
                    </g>
                  ))}
                </g>
              </g>
              <g clipPath={`url(#ho-${uid}-${i})`} pointerEvents="none">
                <path d={pd} fill="none" stroke="#fff" strokeWidth={6} strokeLinejoin="round" opacity={0.3} filter={`url(#hl-${uid})`} />
                <path d={pd} fill="none" stroke="#EDEFF0" strokeWidth={1.5} strokeLinejoin="round" opacity={0.55} />
                <path d={ripFray(g.id, i, h, poly)} stroke="#fff" strokeWidth={0.65} strokeLinecap="round" opacity={0.85} fill="none" />
              </g>
              <path d={pd} fill="none" stroke="#000" strokeWidth={0.7} opacity={0.55} strokeLinejoin="round" pointerEvents="none" />
              <path d={ripLoose(g.id, i, h, poly)} fill="none" stroke="#F3EFE4" strokeWidth={0.4} strokeLinecap="round" opacity={0.7} pointerEvents="none" />
              <path d={pd} fill="transparent" data-kind="hole" data-i={i} data-gid={g.id} />
            </g>
          );
        })}
        {(hem.cuff || hem.fray) && (
          <g pointerEvents="none">
            {hem.cuff && (
              <>
                <path d={hem.cuff} fill={rendered ? '#000' : 'none'} fillOpacity={0.16} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
                <path d={hem.cuffLine} fill="none" stroke={outline} strokeWidth={sw} strokeLinecap="round" />
                <path d={hem.cuffLine} fill="none" stroke="#fff" strokeOpacity={rendered ? 0.22 : 0} strokeWidth={1.4} transform="translate(0 -1.2)" />
                {rendered && <path d={hem.cuffStitch} fill="none" stroke={thread} strokeOpacity={0.8} strokeWidth={0.8} strokeDasharray="2.2 1.6" />}
                {hem.rib && <path d={hem.rib} fill="none" stroke={outline} strokeOpacity={rendered ? 0.4 : 0.55} strokeWidth={0.55} />}
              </>
            )}
            {hem.fray && (
              <>
                <path d={hem.wear} fill="none" stroke="#fff" strokeOpacity={rendered ? 0.5 : 0.7} strokeWidth={rendered ? 0.9 : 0.8} strokeLinecap="round" />
                <path d={hem.fray} fill="none" stroke={rendered ? mix(base, '#ffffff', 0.55) : outline} strokeWidth={rendered ? 0.8 : 0.7} strokeLinecap="round" />
              </>
            )}
          </g>
        )}
        <g clipPath={`url(#${shapeId})`}>
          {!legOnly && <GraphicsLayer g={g} view={view} map={(x, y) => ({ x, y })} k={1} selectedId={selectedGraphic} uid={uid} />}
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
