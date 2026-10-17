import { memo } from 'react';
import { ARTBOARD, HEAD_LINES, INK, INK_WEIGHT, skinColor, type Sex, type SkinId, type View } from '../model/croquis';
import { getFigure, POSES, usesStock, type PoseId } from '../model/figure';
import { FEMALE_WALK } from '../model/stockCroquis';
import { mix } from '../model/color';

const PAPER = '#F4F2ED';
const GUIDE = '#8C877D';
const HAIR = '#1F1B18';

interface Props {
  sex: Sex;
  view: View;
  pose: PoseId;
  rendered: boolean;
  skin: SkinId;
}

/** The licensed stock croquis: silhouette, outline and guide shapes placed by one matrix. */
function StockView({ view, rendered, skin }: { view: View; rendered: boolean; skin: SkinId }) {
  const art = FEMALE_WALK[view];
  const label = `Female ${view} croquis, walk`;
  if (rendered) {
    const tone = skinColor(skin);
    const shade = mix(tone, '#000000', 0.5);
    const lite = mix(tone, '#ffffff', 0.3);
    return (
      <g pointerEvents="none" aria-label={label}>
        <defs>
          <clipPath id="croquis-clip">
            <path d={art.sil} transform={art.mat} clipRule="evenodd" />
          </clipPath>
          <filter id="croquis-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={5} />
          </filter>
          <filter id="croquis-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={8} />
          </filter>
        </defs>
        <path d={art.sil} transform={art.mat} fill={tone} fillRule="evenodd" />
        <g clipPath="url(#croquis-clip)">
          <path d={art.sil} transform={art.mat} fill="none" stroke={shade} strokeWidth={26} opacity={0.5} filter="url(#croquis-blur)" style={{ mixBlendMode: 'multiply' }} />
          <path d="M278,240 Q300,226 322,240 L318,420 Q300,436 282,420 Z" fill={lite} opacity={0.2} filter="url(#croquis-soft)" />
        </g>
        <path d={art.ink} transform={art.mat} fill={shade} fillOpacity={0.6} />
      </g>
    );
  }
  return (
    <g pointerEvents="none" aria-label={label}>
      <path d={art.sil} transform={art.mat} fill={PAPER} fillRule="evenodd" />
      <path d={art.guide} transform={art.mat} fill={GUIDE} />
      <path d={art.ink} transform={art.mat} fill={INK} />
    </g>
  );
}

export const CroquisView = memo(function CroquisView({ sex, view, pose, rendered, skin }: Props) {
  if (usesStock(sex, pose)) {
    return (
      <>
        {!rendered && <Rulers />}
        <StockView view={view} rendered={rendered} skin={skin} />
      </>
    );
  }
  const fig = getFigure(sex, view, pose);
  const label = `${fig.label} croquis, ${POSES.find((p) => p.id === pose)?.label ?? ''}`;

  if (rendered) {
    const tone = skinColor(skin);
    const shade = mix(tone, '#000000', 0.5);
    const lite = mix(tone, '#ffffff', 0.3);
    return (
      <g pointerEvents="none" aria-label={label}>
        <defs>
          <clipPath id="croquis-clip">
            {fig.parts.map((p) => (
              <path key={p.id} d={p.fill} />
            ))}
          </clipPath>
          <filter id="croquis-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={5} />
          </filter>
          <filter id="croquis-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={6} />
          </filter>
        </defs>
        {fig.parts.map((p) => (
          <path key={p.id} d={p.fill} fill={tone} />
        ))}
        <g clipPath="url(#croquis-clip)">
          <g filter="url(#croquis-blur)" fill="none" stroke={shade} strokeWidth={13} opacity={0.5} style={{ mixBlendMode: 'multiply' }}>
            {fig.parts.map((p) => (
              <path key={p.id} d={p.fill} />
            ))}
          </g>
          <path d={fig.light} fill={lite} opacity={0.2} filter="url(#croquis-soft)" />
        </g>
        <g fill="none" stroke={shade} strokeOpacity={0.55} strokeWidth={INK_WEIGHT * 0.8} strokeLinecap="round" strokeLinejoin="round">
          {fig.parts.map((p) => p.lines.map((d, i) => <path key={`${p.id}${i}`} d={d} />))}
        </g>
        <path d={fig.hair} fill={HAIR} />
      </g>
    );
  }

  return (
    <g pointerEvents="none" aria-label={label}>
      <Rulers />
      {/* each part paints over the ones behind it, so crossing legs and arms read cleanly */}
      <g stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        {fig.parts.map((p) => (
          <g key={p.id}>
            <path d={p.fill} fill={PAPER} stroke="none" />
            {p.lines.map((d, i) => (
              <path key={i} d={d} fill="none" strokeWidth={INK_WEIGHT} />
            ))}
          </g>
        ))}
      </g>
      <g fill="none" stroke={GUIDE} strokeWidth={0.7} strokeLinecap="round">
        {fig.guides.map((d, i) => (
          <path key={i} d={d} strokeDasharray={view === 'back' && i === 0 ? '3 4' : undefined} />
        ))}
      </g>
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        {fig.face.map((d, i) => (
          <path key={i} d={d} strokeWidth={0.9} />
        ))}
        <path d={fig.hair} strokeWidth={1.1} />
        {fig.hairLines.map((d, i) => (
          <path key={i} d={d} strokeWidth={0.7} />
        ))}
      </g>
    </g>
  );
});

function Rulers() {
  return (
    <g pointerEvents="none">
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
    </g>
  );
}

export function Artboard() {
  return <rect x={ARTBOARD.x} y={ARTBOARD.y} width={ARTBOARD.w} height={ARTBOARD.h} fill={PAPER} />;
}
