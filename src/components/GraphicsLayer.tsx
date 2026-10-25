import type { Garment } from '../model/garment';
import type { Graphic } from '../model/production';

const ACCENT = '#C8102E';

interface AllOverProps {
  g: Garment;
  /** Shape paths to cover (body, waistband). */
  d: string[];
  /** Size scale for the space the garment is drawn in. */
  k: number;
  uid: string;
}

/** The all-over print: the uploaded image tiled across the garment, with scale and rotation. */
export function AllOverFill({ g, d, k, uid }: AllOverProps) {
  const a = g.allOver;
  if (!a) return null;
  const w = Math.max(4, a.scale * k), h = w * a.aspect;
  const id = `aop-${uid}`;
  return (
    <g pointerEvents="none">
      <pattern id={id} patternUnits="userSpaceOnUse" width={w} height={h} patternTransform={`rotate(${a.rot})`}>
        <image href={a.src} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
      </pattern>
      {d.filter(Boolean).map((p, i) => (
        <path key={i} d={p} fill={`url(#${id})`} />
      ))}
    </g>
  );
}

interface Props {
  g: Garment;
  view: 'front' | 'back';
  /** Garment space to drawing space. */
  map: (x: number, y: number) => { x: number; y: number };
  k: number;
  selectedId: string | null;
  uid: string;
}

function Art({ gr, w, h, uid }: { gr: Graphic; w: number; h: number; uid: string }) {
  const x = -w / 2, y = -h / 2;
  const img = (props: object = {}) => <image href={gr.src} x={x} y={y} width={w} height={h} preserveAspectRatio="none" {...props} />;
  switch (gr.method) {
    case 'Embroidery':
      return (
        <g>
          <defs>
            <pattern id={`th-${uid}`} width={1.6} height={1.6} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width={1.6} height={0.7} fill="#000" fillOpacity={0.3} />
              <rect y={0.7} width={1.6} height={0.35} fill="#fff" fillOpacity={0.22} />
            </pattern>
            <mask id={`em-${uid}`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
              {img()}
            </mask>
            <filter id={`ef-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx={0.4} dy={0.7} stdDeviation={0.6} floodColor="#000" floodOpacity={0.45} />
            </filter>
          </defs>
          <g filter={`url(#ef-${uid})`}>{img()}</g>
          <rect x={x} y={y} width={w} height={h} fill={`url(#th-${uid})`} mask={`url(#em-${uid})`} />
        </g>
      );
    case 'Puff print':
      return (
        <g>
          <defs>
            <filter id={`pf-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx={0.8} dy={1.5} stdDeviation={1.1} floodColor="#000" floodOpacity={0.5} />
            </filter>
          </defs>
          <g filter={`url(#pf-${uid})`}>{img()}</g>
        </g>
      );
    case 'Patch':
      return (
        <g>
          <rect x={x - 2.5} y={y - 2.5} width={w + 5} height={h + 5} rx={3} fill="#F1EDE3" stroke="#141414" strokeWidth={0.8} strokeDasharray="2.2 1.4" />
          {img()}
        </g>
      );
    case 'DTG':
      return img({ opacity: 0.94 });
    default:
      return img();
  }
}

/** Placed graphics for one side of the garment, clipped by the caller to the garment outline. */
export function GraphicsLayer({ g, view, map, k, selectedId, uid }: Props) {
  const list = g.graphics;
  if (!list?.length) return null;
  return (
    <g>
      {list.map((gr, i) => {
        if (gr.side !== view) return null;
        const c = map(gr.x, gr.y);
        const w = gr.w * k, h = w * gr.aspect;
        const on = gr.id === selectedId;
        return (
          <g key={gr.id} transform={`translate(${c.x} ${c.y}) rotate(${gr.rot})`} data-kind="graphic" data-i={i} data-gid={g.id} style={{ cursor: 'pointer' }}>
            <Art gr={gr} w={w} h={h} uid={`${uid}-${i}`} />
            <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="transparent" stroke={on ? ACCENT : 'none'} strokeWidth={1} strokeDasharray="4 3" />
          </g>
        );
      })}
    </g>
  );
}
