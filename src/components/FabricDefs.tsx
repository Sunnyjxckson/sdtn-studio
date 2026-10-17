import type { ReactNode } from 'react';
import { WASHES, type Garment } from '../model/garment';
import { mix } from '../model/color';

export const fabricId = (g: Garment) => `fab-${g.id}`;
export const overlayId = (g: Garment) => `ovl-${g.id}`;

/** Which kinds get a gradient overlay on top of the pattern. */
export const hasOverlay = (g: Garment) => g.fabric === 'Denim' || g.fabric === 'Leather' || g.fabric === 'Satin';

function Tile({ g, w, h, children }: { g: Garment; w: number; h: number; children: ReactNode }) {
  return (
    <pattern id={fabricId(g)} width={w} height={h} patternUnits="userSpaceOnUse" patternTransform={`scale(${g.fabricScale})`}>
      {children}
    </pattern>
  );
}

/** SVG <pattern> and overlay gradient for the garment's fabric. Colours come from the wash. */
export function FabricDefs({ g }: { g: Garment }) {
  const base = WASHES[g.wash];
  const light = mix(base, '#ffffff', 0.4);
  const dark = mix(base, '#000000', 0.45);
  // from the points themselves, so a garment drawn as two layers gets the same gradient in both
  const ys = g.points.map((p) => p.y);
  const banded = g.points.some((p) => p.key === 'waistL' || p.key === 'waistR');
  const top = Math.min(...ys) - (banded ? 14 : 0);
  const hem = Math.max(...ys);
  const span = hem - top;
  const at = (f: number) => `${((top + span * f) | 0)}`;
  let tile: ReactNode;
  let overlay: ReactNode = null;

  switch (g.fabric) {
    case 'Denim':
      tile = (
        <Tile g={g} w={3} h={3}>
          <rect width={3} height={3} fill={base} />
          <path d="M-0.5,3.5 L3.5,-0.5" stroke={light} strokeOpacity={0.22} strokeWidth={0.6} />
          <path d="M-0.5,2 L2,-0.5 M1,3.5 L3.5,1" stroke={dark} strokeOpacity={0.22} strokeWidth={0.45} />
        </Tile>
      );
      overlay = (
        <linearGradient id={overlayId(g)} gradientUnits="userSpaceOnUse" x1={0} y1={top} x2={0} y2={hem}>
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.2} stopColor="#fff" stopOpacity={0.12} />
          <stop offset={0.4} stopColor="#fff" stopOpacity={0.05} />
          <stop offset={0.6} stopColor="#fff" stopOpacity={0.2} />
          <stop offset={0.72} stopColor="#fff" stopOpacity={0.04} />
          <stop offset={1} stopColor="#fff" stopOpacity={0.1} />
        </linearGradient>
      );
      break;
    case 'Plaid':
      tile = (
        <Tile g={g} w={48} h={48}>
          <rect width={48} height={48} fill={base} />
          <rect x={0} width={16} height={48} fill={dark} opacity={0.5} />
          <rect y={0} width={48} height={16} fill={dark} opacity={0.5} />
          <rect x={26} width={5} height={48} fill={light} opacity={0.35} />
          <rect y={26} width={48} height={5} fill={light} opacity={0.35} />
          <path d="M38.5,0 V48 M0,38.5 H48" stroke="#E8DDC9" strokeWidth={1} opacity={0.85} />
          <path d="M20,0 V48 M0,20 H48" stroke="#000" strokeWidth={0.8} opacity={0.35} />
          <path d="M-2,50 L50,-2 M-2,26 L26,-2 M22,50 L50,22" stroke="#000" strokeWidth={0.6} opacity={0.12} />
        </Tile>
      );
      break;
    case 'Houndstooth':
      tile = (
        <Tile g={g} w={10} h={10}>
          <rect width={10} height={10} fill={mix(base, '#ffffff', 0.88)} />
          <path d="M0,0 H5 L10,5 H5 L0,10 Z M5,5 H10 V10 H5 Z" fill={dark} />
          <path d="M5,0 L10,0 L10,5 Z" fill={dark} />
        </Tile>
      );
      break;
    case 'Pinstripe':
      tile = (
        <Tile g={g} w={7} h={8}>
          <rect width={7} height={8} fill={mix(base, '#000000', 0.25)} />
          <path d="M0.5,0 V8" stroke="#EDEAE3" strokeWidth={0.8} opacity={0.8} />
        </Tile>
      );
      break;
    case 'Polka dot':
      tile = (
        <Tile g={g} w={14} h={14}>
          <rect width={14} height={14} fill={base} />
          <circle cx={3.5} cy={3.5} r={2.4} fill="#F4F2ED" />
          <circle cx={10.5} cy={10.5} r={2.4} fill="#F4F2ED" />
        </Tile>
      );
      break;
    case 'Leather':
      tile = (
        <Tile g={g} w={9} h={9}>
          <rect width={9} height={9} fill={mix(base, '#000000', 0.55)} />
          <path d="M1,2 q2,-1 4,0 M5,7 q2,-1 3,0 M0,5 q1,-1 2,0" stroke="#fff" strokeOpacity={0.07} strokeWidth={0.7} fill="none" />
        </Tile>
      );
      overlay = (
        <linearGradient id={overlayId(g)} gradientUnits="userSpaceOnUse" x1={60} y1={at(0.1)} x2={250} y2={at(0.6)}>
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.34} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.47} stopColor="#fff" stopOpacity={0.4} />
          <stop offset={0.56} stopColor="#fff" stopOpacity={0.05} />
          <stop offset={0.78} stopColor="#fff" stopOpacity={0.14} />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      );
      break;
    case 'Satin':
      tile = (
        <Tile g={g} w={4} h={4}>
          <rect width={4} height={4} fill={base} />
        </Tile>
      );
      overlay = (
        <linearGradient id={overlayId(g)} gradientUnits="userSpaceOnUse" x1={70} y1={top} x2={230} y2={top + span * 0.3}>
          <stop offset={0} stopColor="#000" stopOpacity={0.2} />
          <stop offset={0.2} stopColor="#fff" stopOpacity={0.38} />
          <stop offset={0.36} stopColor="#000" stopOpacity={0.12} />
          <stop offset={0.6} stopColor="#fff" stopOpacity={0.34} />
          <stop offset={0.8} stopColor="#000" stopOpacity={0.18} />
          <stop offset={1} stopColor="#fff" stopOpacity={0.15} />
        </linearGradient>
      );
      break;
    case 'Knit':
      tile = (
        <Tile g={g} w={4} h={4}>
          <rect width={4} height={4} fill={base} />
          <path d="M1,0 V4" stroke={dark} strokeOpacity={0.55} strokeWidth={1} />
          <path d="M3,0 V4" stroke={light} strokeOpacity={0.3} strokeWidth={1} />
        </Tile>
      );
      break;
    case 'Jersey':
      tile = (
        <Tile g={g} w={2} h={2}>
          <rect width={2} height={2} fill={base} />
          <rect width={1} height={1} fill={dark} opacity={0.05} />
        </Tile>
      );
      break;
    case 'Rib':
      tile = (
        <Tile g={g} w={2.4} h={10}>
          <rect width={2.4} height={10} fill={base} />
          <rect x={1.4} width={0.7} height={10} fill={dark} opacity={0.16} />
          <rect x={0.3} width={0.5} height={10} fill={light} opacity={0.18} />
        </Tile>
      );
      break;
  }
  return (
    <>
      {tile}
      {overlay}
    </>
  );
}
