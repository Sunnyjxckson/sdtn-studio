// A look drawn without any editing chrome: croquis, garments, forearms in front, cast shadows, notes.
// Pure (no store), so it can be rendered to a string for the lineup, thumbnails and exports.
import { getCroquis } from '../model/croquis';
import type { Doc } from '../model/doc';
import { bodyProfile, poseRig, torsoProfile, type TorsoProfile } from '../model/figure';
import type { Garment } from '../model/garment';
import { fitGarment } from '../model/conform';
import { garmentShape, stiffOf, topForward } from '../model/top';
import { notePaths } from '../model/note';
import { Artboard, CroquisView } from './CroquisView';
import { GarmentView } from './GarmentView';
import { TopView } from './TopView';
import { ShoeView } from './ShoeView';

/** Where each forearm can come forward: outside the torso, below the lowest sleeve on that side. */
export function armFrontPaths(torso: TorsoProfile, garments: Garment[]): string[] {
  return ([0, 1] as const).map((s) => {
    let yLim = torso.armpit[s].y + 4;
    for (const g of garments) {
      if (!g.visible || g.type !== 'top') continue;
      const K = s === 0 ? 'L' : 'R';
      const ends = g.points.filter((p) => p.key === `slO${K}` || p.key === `slI${K}` || p.key === `arm${K}`);
      for (const p of ends) yLim = Math.max(yLim, topForward(torso, p, stiffOf(g.top)).y + 3);
    }
    const side = torso.sides[s];
    const sx = (y: number) => {
      if (y <= side[0].y) return side[0].x;
      for (let i = 0; i < side.length - 1; i++) if (y <= side[i + 1].y) return side[i].x + ((y - side[i].y) / (side[i + 1].y - side[i].y || 1)) * (side[i + 1].x - side[i].x);
      return side[side.length - 1].x;
    };
    const pts: string[] = [];
    for (let y = yLim; y <= 1000; y += 6) pts.push(`${(sx(y) + (s === 0 ? -1 : 1)).toFixed(1)},${y.toFixed(1)}`);
    const edge = s === 0 ? 0 : 600;
    return `M${edge},${yLim} L${pts.join(' L')} L${edge},1000 Z`;
  });
}

export function LookArt({ doc }: { doc: Doc }) {
  const rendered = doc.settings.render === 'rendered';
  const { sex, view, pose, skin } = doc.base;
  const cq = getCroquis(sex, view);
  const rig = poseRig(sex, pose, cq.waistY, cq.hemY);
  const body = bodyProfile(sex, pose);
  const sag = view === 'front' ? 6 : 3;
  const torso = torsoProfile(sex, pose);
  const armFront = armFrontPaths(torso, doc.garments);
  const ordered = [...doc.garments.filter((g) => g.type === 'shoes'), ...doc.garments.filter((g) => g.type === 'top' && g.top?.tuck), ...doc.garments.filter((g) => g.type !== 'shoes' && !(g.type === 'top' && g.top?.tuck))];
  return (
    <g>
      <Artboard />
      <g id="croquis-art">
        <CroquisView sex={sex} view={view} pose={pose} rendered={rendered} skin={skin} />
      </g>
      {ordered.map((g) => {
        if (!g.visible) return null;
        if (g.type === 'shoes') return <ShoeView key={g.id} g={g} sex={sex} view={view} pose={pose} rendered={rendered} shading={doc.settings.shading} />;
        if (g.type === 'top') {
          return <TopView key={g.id} g={g} t={torso} rendered={rendered} shading={doc.settings.shading} selectedText={null} bust={sex === 'female'} view={view} />;
        }
        const fit = fitGarment(g, rig, body, sag);
        const common = { selectedText: null, showCut: false, rendered, shading: doc.settings.shading, sag: rig.identity ? 0 : sag, bandInset: fit.bandInset, view };
        if (fit.layers) {
          return (
            <g key={g.id}>
              <GarmentView g={fit.layers.back.g} edge={fit.layers.back.edge} legOnly dim layer="-back" {...common} />
              <GarmentView g={fit.layers.front.g} edge={fit.layers.front.edge} {...common} />
            </g>
          );
        }
        return <GarmentView key={g.id} g={fit.g} {...common} />;
      })}
      {doc.garments.some((g) => g.visible) && (
        <>
          <defs>
            <filter id="cast-blur" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation={2} />
            </filter>
            <clipPath id="arms-front">
              {armFront.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </clipPath>
          </defs>
          <use href="#croquis-art" clipPath="url(#arms-front)" />
          {rendered && (
            <g fill="none" stroke="#000" strokeLinecap="round" filter="url(#cast-blur)">
              {doc.garments
                .filter((g) => g.visible && g.type === 'top')
                .map((g) => {
                  const sh = garmentShape(torso, g, view);
                  return sh.hems.map((h, i) => (
                    <path key={`${g.id}${i}`} d={'M' + h.map((p) => `${p.x.toFixed(1)},${(p.y + 3).toFixed(1)}`).join(' L')} strokeWidth={3} opacity={0.12} />
                  ));
                })}
            </g>
          )}
        </>
      )}
      {doc.notes.map((n) => {
        const { arrow, head } = notePaths(n);
        return (
          <g key={n.id}>
            <path d={arrow} fill="none" stroke="#2B2B2B" strokeWidth={1.2} strokeLinecap="round" />
            <path d={head} fill="none" stroke="#2B2B2B" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
            <text x={n.x} y={n.y} fontFamily="Caveat, cursive" fontWeight={700} fontSize={30} fill="#2B2B2B">
              {n.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
