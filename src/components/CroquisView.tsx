import { memo } from 'react';
import { ARTBOARD, getCroquis, HEAD_LINES, INK, INK_WEIGHT, type Sex, type View } from '../model/croquis';

function Half({ sex, view }: { sex: Sex; view: View }) {
  const c = getCroquis(sex, view);
  return (
    <>
      {c.half.map((p, i) => (
        <path key={i} d={p.d} strokeWidth={p.w ?? INK_WEIGHT} />
      ))}
      {c.spine && <path d={c.spine} strokeWidth={0.7} strokeDasharray="3 4" />}
    </>
  );
}

export const CroquisView = memo(function CroquisView({ sex, view }: { sex: Sex; view: View }) {
  const c = getCroquis(sex, view);
  return (
    <g pointerEvents="none" aria-label={`${c.label} croquis`}>
      <g fill="none" stroke="#B3AFA6" strokeWidth={0.8}>
        <path d="M300,24 V986" strokeDasharray="6 6" />
        <path d={HEAD_LINES.map((y) => `M40,${y} H70`).join(' ')} />
      </g>
      <g fontFamily="IBM Plex Mono, monospace" fontSize={10} fill="#9A968E">
        {HEAD_LINES.slice(0, 9).map((y, i) => (
          <text key={y} x={26} y={y + 55}>
            {i + 1}
          </text>
        ))}
      </g>
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <Half sex={sex} view={view} />
        <g transform="translate(600,0) scale(-1,1)">
          <Half sex={sex} view={view} />
        </g>
        {c.navel && <path d={c.navel} strokeWidth={0.9} />}
      </g>
    </g>
  );
});

export function Artboard() {
  return <rect x={ARTBOARD.x} y={ARTBOARD.y} width={ARTBOARD.w} height={ARTBOARD.h} fill="#F4F2ED" />;
}
