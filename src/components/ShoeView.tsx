import { memo } from 'react';
import { WASHES, isDarkGarment, type Garment } from '../model/garment';
import { garmentHex } from '../model/production';
import { AllOverFill, GraphicsLayer } from './GraphicsLayer';
import { mix } from '../model/color';
import { feetOf, type PoseId } from '../model/figure';
import type { Sex } from '../model/croquis';
import { shoeGeom } from '../model/shoeShapes';
import { soleOf } from '../model/shoes';
import { FabricDefs, fabricId, hasOverlay, overlayId } from './FabricDefs';

interface Props {
  g: Garment;
  sex: Sex;
  view: 'front' | 'back';
  pose: PoseId;
  rendered: boolean;
  shading: boolean;
  selectedGraphic?: string | null;
}

/** Shoes drawn on the croquis feet, one per foot, back leg first. */
export const ShoeView = memo(function ShoeView({ g, sex, view, pose, rendered, shading, selectedGraphic }: Props) {
  const o = g.shoes!;
  const feet = feetOf(sex, pose);
  const base = garmentHex(g);
  const dark = isDarkGarment(g);
  const soleBase = WASHES[soleOf(o)];
  const outline = rendered ? mix(base, '#000000', 0.62) : '#141414';
  const soleLine = rendered ? mix(soleBase, '#000000', 0.62) : '#141414';
  const sw = rendered ? 1.1 : 1.5;
  const ink = rendered ? mix(base, dark ? '#ffffff' : '#000000', dark ? 0.5 : 0.45) : '#141414';
  const lace = rendered ? mix(base, dark ? '#ffffff' : '#000000', dark ? 0.7 : 0.4) : '#141414';
  const geoms = feet.order.map((i) => ({ i, geom: shoeGeom(o, feet.frames[i], view) }));
  const top = Math.min(...geoms.map((x) => x.geom.top));
  const bottom = Math.max(...geoms.map((x) => x.geom.bottom));
  // the fabric tile and gradient read the garment's points for their extent
  const fabricG = { ...g, points: [{ x: 0, y: top }, { x: 0, y: bottom }] };
  const fill = rendered ? `url(#${fabricId(g)})` : base;
  const panel = mix(base, dark ? '#ffffff' : '#000000', dark ? 0.16 : 0.2);

  return (
    <g id={`garment-${g.id}`} data-gid={g.id}>
      {rendered && (
        <defs>
          <FabricDefs g={fabricG as Garment} />
          <filter id={`sb-${g.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={3} />
          </filter>
          <filter id={`sh-${g.id}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={2.6} />
          </filter>
        </defs>
      )}
      {geoms.map(({ i, geom }) => {
        const clip = `sc-${g.id}-${i}`;
        const shade = rendered && shading;
        return (
          <g key={i}>
            <defs>
              <clipPath id={clip}>
                {geom.parts.map((d, k) => (
                  <path key={k} d={d} />
                ))}
              </clipPath>
            </defs>
            {geom.pin && !geom.pinOver && <path d={geom.pin} fill={soleBase} stroke={soleLine} strokeWidth={sw} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />}
            <path d={geom.sole} fill={soleBase} stroke={soleLine} strokeWidth={sw} strokeLinejoin="round" data-kind="garment" data-gid={g.id} />
            {/* outline first, then fills over it, so overlapping parts read as one shoe */}
            <g fill={outline} stroke={outline} strokeWidth={sw * 2} strokeLinejoin="round">
              {geom.parts.map((d, k) => (
                <path key={k} d={d} />
              ))}
            </g>
            <g data-kind="garment" data-gid={g.id}>
              {geom.parts.map((d, k) => (
                <path key={k} d={d} fill={fill} />
              ))}
            </g>
            {rendered && hasOverlay(g) && (
              <g pointerEvents="none">
                {geom.parts.map((d, k) => (
                  <path key={k} d={d} fill={`url(#${overlayId(g)})`} />
                ))}
              </g>
            )}
            {g.allOver && <AllOverFill g={g} d={geom.parts} k={0.6} uid={`${g.id}-${i}`} />}
            <path d={geom.panels} fill={panel} stroke={outline} strokeWidth={sw * 0.8} strokeLinejoin="round" pointerEvents="none" />
            {shade && (
              <g clipPath={`url(#${clip})`} pointerEvents="none">
                <g filter={`url(#sb-${g.id})`} fill="none" stroke="#000" strokeWidth={9} strokeLinejoin="round" opacity={dark ? 0.4 : 0.2} style={{ mixBlendMode: 'multiply' }}>
                  {geom.parts.map((d, k) => (
                    <path key={k} d={d} />
                  ))}
                </g>
                <ellipse
                  cx={geom.sheen.x}
                  cy={geom.sheen.y}
                  rx={geom.sheen.rx}
                  ry={geom.sheen.ry}
                  transform={`rotate(${geom.sheen.deg} ${geom.sheen.x} ${geom.sheen.y})`}
                  fill="#fff"
                  opacity={dark ? 0.2 : 0.3}
                  filter={`url(#sh-${g.id})`}
                />
              </g>
            )}
            <path d={geom.lines} fill="none" stroke={ink} strokeWidth={sw * 0.85} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            <path d={geom.laces} fill="none" stroke={lace} strokeWidth={sw * 1.15} strokeLinecap="round" pointerEvents="none" />
            <path d={geom.accent} fill={rendered ? mix(base, '#000000', 0.7) : '#141414'} stroke="none" pointerEvents="none" />
            {g.graphics?.length ? (
              <g clipPath={`url(#${clip})`}>
                <GraphicsLayer g={g} view={view} map={(x, y) => ({ x: (feet.frames[i].ankle.x + feet.frames[i].toe.x) / 2 + (x - 150) * 0.5, y: (feet.frames[i].ankle.y + feet.frames[i].toe.y) / 2 + (y - 150) * 0.5 })} k={0.5} selectedId={selectedGraphic ?? null} uid={`${g.id}-${i}`} />
              </g>
            ) : null}
            {geom.pin && geom.pinOver && <path d={geom.pin} fill={soleBase} stroke={soleLine} strokeWidth={sw} strokeLinejoin="round" pointerEvents="none" />}
          </g>
        );
      })}
    </g>
  );
});
