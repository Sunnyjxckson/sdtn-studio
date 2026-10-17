import { memo } from 'react';
import { ARTBOARD, getCroquis, getFill, HEAD_LINES, INK, INK_WEIGHT, skinColor, type Sex, type SkinId, type View } from '../model/croquis';
import { mix } from '../model/color';

const MIRROR = 'translate(600,0) scale(-1,1)';

function Half({ sex, view, rendered }: { sex: Sex; view: View; rendered: boolean }) {
  const c = getCroquis(sex, view);
  const paths = rendered ? c.half.filter((p) => !p.face) : c.half;
  return (
    <>
      {paths.map((p, i) => (
        <path key={i} d={p.d} strokeWidth={(p.w ?? INK_WEIGHT) * (rendered ? 0.8 : 1)} />
      ))}
      {c.spine && <path d={c.spine} strokeWidth={0.7} strokeDasharray="3 4" />}
    </>
  );
}

function Both({ d, ...rest }: { d: string } & React.SVGProps<SVGPathElement>) {
  return (
    <>
      <path d={d} {...rest} />
      <path d={d} transform={MIRROR} {...rest} />
    </>
  );
}

interface Props {
  sex: Sex;
  view: View;
  rendered: boolean;
  skin: SkinId;
}

export const CroquisView = memo(function CroquisView({ sex, view, rendered, skin }: Props) {
  const c = getCroquis(sex, view);
  if (rendered) {
    const fill = getFill(sex);
    const tone = skinColor(skin);
    const shade = mix(tone, '#000000', 0.5);
    const lite = mix(tone, '#ffffff', 0.3);
    return (
      <g pointerEvents="none" aria-label={`${c.label} croquis`}>
        <defs>
          <clipPath id="croquis-clip">
            <Both d={fill.body} />
            <Both d={fill.head} />
          </clipPath>
          <filter id="croquis-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={6} />
          </filter>
          <filter id="croquis-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={5} />
          </filter>
        </defs>
        <Both d={fill.body} fill={tone} />
        <Both d={fill.head} fill={tone} />
        <g clipPath="url(#croquis-clip)">
          <g filter="url(#croquis-blur)" fill="none" stroke={shade} strokeWidth={15} opacity={0.55} style={{ mixBlendMode: 'multiply' }}>
            <Both d={fill.body} />
            <Both d={fill.head} />
          </g>
          {view === 'front' && (
            <ellipse cx={fill.oval.cx} cy={fill.oval.cy} rx={fill.oval.rx} ry={fill.oval.ry} fill={lite} opacity={0.38} filter="url(#croquis-soft)" />
          )}
          {/* soft light down the centre of the torso and legs */}
          <path d="M276,260 Q300,300 324,260 L318,440 L282,440 Z" fill={lite} opacity={0.14} filter="url(#croquis-soft)" />
        </g>
        <g fill="none" stroke={shade} strokeOpacity={0.5} strokeLinecap="round" strokeLinejoin="round">
          <Half sex={sex} view={view} rendered />
          <g transform={MIRROR}>
            <Half sex={sex} view={view} rendered />
          </g>
          {c.navel && <path d={c.navel} strokeWidth={0.8} />}
        </g>
      </g>
    );
  }
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
        <Half sex={sex} view={view} rendered={false} />
        <g transform={MIRROR}>
          <Half sex={sex} view={view} rendered={false} />
        </g>
        {c.navel && <path d={c.navel} strokeWidth={0.9} />}
      </g>
    </g>
  );
});

export function Artboard() {
  return <rect x={ARTBOARD.x} y={ARTBOARD.y} width={ARTBOARD.w} height={ARTBOARD.h} fill="#F4F2ED" />;
}
