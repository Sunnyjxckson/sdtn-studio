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

const ACCENT = '#C8102E';

interface Props {
  g: Garment;
  selectedText: number | null;
  /** Show the dashed cut guide (only for the selected garment). */
  showCut: boolean;
}

/** Renders one garment from data, in garment space, inside its own transform. */
export const GarmentView = memo(function GarmentView({ g, selectedText, showCut }: Props) {
  const { body, band, details, solid, strap } = garmentPaths(g);
  const dark = isDarkWash(g.wash);
  const fill = WASHES[g.wash];
  const t = g.transform;
  const cropH = g.cropY ?? 520;
  const shapeId = `shape-${g.id}`;
  const cropId = `crop-${g.id}`;

  return (
    <g id={`garment-${g.id}`} transform={`translate(${t.x} ${t.y}) scale(${t.scale})`} data-gid={g.id}>
      <defs>
        <clipPath id={cropId}>
          <rect x={-60} y={-60} width={420} height={cropH + 60} />
        </clipPath>
        <clipPath id={shapeId}>
          <path d={body} />
          <path d={band} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${cropId})`}>
        <path d={body} fill={fill} stroke="#141414" strokeWidth={1.6} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />
        <path d={band} fill={fill} stroke="#141414" strokeWidth={1.6} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />
        <path d={details} fill="none" stroke={dark ? '#C9CDD2' : '#5A5A5A'} strokeWidth={1.1} strokeLinecap="round" strokeDasharray="3 2" pointerEvents="none" />
        <path d={solid} fill="none" stroke="#141414" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        <g clipPath={`url(#${shapeId})`}>
          {g.distress.map((d, i) => (
            <g key={`r${i}`}>
              <path d={ripPath(d)} fill="none" stroke="#F4F2ED" strokeWidth={1.4} strokeLinecap="round" pointerEvents="none" />
              <circle cx={d.x} cy={d.y} r={12} fill="transparent" data-kind="dist" data-i={i} data-gid={g.id} />
            </g>
          ))}
          {g.holes.map((h, i) => (
            <g key={`h${i}`}>
              <ellipse cx={h.x} cy={h.y} rx={h.r} ry={h.r * 0.7} fill="#F4F2ED" stroke="#141414" strokeWidth={0.9} data-kind="hole" data-i={i} data-gid={g.id} />
              <path d={holeThreads(h)} fill="none" stroke={dark ? '#C9CDD2' : '#5A5A5A'} strokeWidth={1} pointerEvents="none" />
            </g>
          ))}
          {g.cropY != null && (
            <path d={zig(30, 280, g.cropY - 3, 3, 5)} fill="none" stroke="#F4F2ED" strokeWidth={1.6} strokeLinejoin="round" pointerEvents="none" />
          )}
          {g.texts.map((x, i) => (
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
