// Flats for the streetwear blocks (mock neck, quarter zip, anorak, work jacket, coach jacket) and for the
// options that apply across tops (sleeve style, hem, ringer trim). Built on the helpers in flatsBlocks.

import type { BlockParts, TopCtx, V } from './flatsBlocks';
import { circle, curve, empty, f1, hoodie, lerp, P, placket, pocketAt, poly, ribHem, ribNeck, shirtCollar, sleeveBand, ticks, zip } from './flatsBlocks';
import { hasStyleOptions, hemOf, sleeveStyleOf, CURVE_V, type TopOpts } from './top';

/** Rib band at the body hem (hoodies and sweatshirts default to it, tees opt in). */
export const ribHemOn = (o: TopOpts) => hemOf(o) === 'Rib band';

const teeLike = (o: TopOpts) => o.block === 'Tee' || o.block === 'Long sleeve' || o.block === 'Mock neck';

/** Lowest point of a curved hem, in flat space, below the raised hem corners. */
export const curvedDip = (c: TopCtx) => c.T(0, c.hemV + CURVE_V).y - c.T(0, c.hemV).y;

/** Options that apply across blocks: raglan or dropped sleeves, ringer trim, rib or curved hem. */
export function styleParts(c: TopCtx, base?: BlockParts | null): BlockParts | null {
  const o = c.o;
  if (!hasStyleOptions(o)) return base ?? null;
  const r = base ?? empty();
  const { at, hemY } = c;
  const tee = teeLike(o);
  const ss = sleeveStyleOf(o);
  const curved = hemOf(o) === 'Curved' && !o.tuck;

  if (tee && ribHemOn(o)) {
    ribHem(c, r, o.fit === 'Oversized' || o.fit === 'Boxy' ? 13 : 11);
    r.noHemStitch = true;
    r.drop.push('hem');
  } else if (!tee && !ribHemOn(o)) {
    // a hoodie or sweatshirt without the rib band gets a plain topstitched hem
    r.noHemStitch = false;
    r.drop = r.drop.filter((k) => k !== 'hem');
  }
  if (curved) {
    const l = at('hemL') as V, rr = at('hemR') as V;
    const dip = curvedDip(c);
    r.noHemStitch = true;
    r.shapes.push({ d: `M${f1(l.x + 3)},${f1(hemY - 7)} Q150,${f1(hemY - 7 + 2 * dip)} ${f1(rr.x - 3)},${f1(hemY - 7)}`, k: 'stitch' });
    r.anchors.push({ key: 'curvehem', label: 'Curved hem', desc: 'Shirttail hem, higher at the side seams, single needle topstitch', x: 150 + 50, y: hemY + dip - 8 });
    r.drop.push('hem');
  }
  if (ss === 'Raglan') {
    r.noArmhole = true;
    for (const K of ['L', 'R'] as const) {
      const n = c.neck(K === 'L' ? 0.97 : 0.03);
      const ar = at('arm' + K) as V;
      const s = K === 'L' ? -1 : 1;
      const m = { x: (n.x + ar.x) / 2 + s * 4, y: (n.y + ar.y) / 2 - 4 };
      r.shapes.push({ d: `M${P(n)} Q${P(m)} ${P(ar)}`, k: 'seam' }, { d: `M${P(n)} Q${P(m)} ${P(ar)}`, k: 'stitch', t: [s * 2.4, 2.2] });
      if (K === 'L') r.anchors.push({ key: 'armhole', label: 'Raglan seam', desc: 'Raglan sleeve, seam runs from the neck to the underarm, overlocked', x: m.x - 3, y: m.y + 8 });
    }
    r.drop.push('armhole');
  } else if (ss === 'Dropped') {
    r.rename.armhole = { label: 'Dropped shoulder', desc: 'Dropped shoulder seam sits low on the arm, overlocked' };
  }
  if (o.ringer) {
    if (tee) {
      ribNeck(c, r, 5.5, 'Contrast neck', 'Crew neck, contrast 1x1 rib binding, topstitched');
      sleeveBand(c, r, o.block === 'Tee' ? 11 : 22, 'ringercuff', 'Contrast cuffs', o.block === 'Tee' ? 'Sleeve ends in a contrast rib band' : 'Sleeve ends in contrast 2x2 rib cuffs');
      r.noSleeveStitch = true;
      r.drop.push('sleeve');
    } else {
      r.rename.ribcuff = { desc: 'Sleeve ends in contrast 2x2 rib cuffs, 3 in' };
      r.rename.ribhem = { desc: 'Body hem, contrast 2x2 rib band' };
      r.anchors.push({ key: 'ringer', label: 'Contrast trim', desc: 'Cuffs and hem band in a contrast colour', x: 150, y: hemY - 8 });
    }
  }
  return r;
}

function standCollar(c: TopCtx, r: BlockParts, h: number) {
  const nL = c.at('neckL') as V, nR = c.at('neckR') as V;
  const top = nL.y - h;
  r.behind.push({ d: `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 3)},${f1(top)} Q150,${f1(top - 7)} ${f1(nR.x + 3)},${f1(top)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`, k: 'edge', fill: true });
  let d = '';
  for (let i = 1; i < 12; i++) {
    const x = nL.x - 2 + ((nR.x - nL.x + 4) * i) / 12;
    d += `M${f1(x)},${f1(top - 1)} L${f1(x)},${f1(nL.y + 1)} `;
  }
  r.behind.push({ d, k: 'rib' });
  r.extent.push({ x: nL.x - 3, y: top - 8 });
}

export function streetParts(c: TopCtx): BlockParts | null {
  const o = c.o;
  const { T, at, hemY, hemV, back } = c;
  const nf = at('neckF') as V;
  const r = empty();
  const wide = o.fit === 'Oversized' || o.fit === 'Boxy';

  if (o.block === 'Mock neck') {
    standCollar(c, r, 12);
    r.rename.neck = { label: 'Mock neck', desc: 'Funnel neck, 1x1 rib, stands 1.25 in, topstitched' };
    return styleParts(c, r);
  }

  if (o.block === 'Quarter zip') {
    r.noHemStitch = true;
    r.noSleeveStitch = true;
    r.drop.push('sleeve', 'hem');
    standCollar(c, r, 13);
    r.rename.neck = { label: 'Stand collar', desc: 'Stand collar in 1x1 rib, zip to the top' };
    if (ribHemOn(o)) ribHem(c, r, wide ? 15 : 13);
    else {
      r.noHemStitch = false;
      r.drop = r.drop.filter((k) => k !== 'hem');
    }
    sleeveBand(c, r, 26, 'ribcuff', 'Rib cuffs', 'Sleeve ends in 2x2 rib cuffs, 3 in');
    if (!back) {
      const z = [{ x: 150, y: nf.y - 12 }, { x: 150, y: (nf.y + T(0, 0.44).y) / 2 }, { x: 150, y: T(0, 0.44).y }];
      r.shapes.push(...zip(z), { d: `M${f1(143)},${f1(nf.y + 2)} L${f1(143)},${f1(z[2].y)} L${f1(157)},${f1(z[2].y)} L${f1(157)},${f1(nf.y + 2)}`, k: 'seam' });
      r.anchors.push({ key: 'qzip', label: 'Quarter zip', desc: 'Metal zip, 8 in, bar tacked, zip garage at the collar', x: 150 + 7, y: z[1].y });
    }
    return styleParts(c, r);
  }

  if (o.block === 'Anorak') {
    const chest = o.pocket === 'Chest';
    const h = hoodie(c, false, { noRib: true, noCuffs: true, noPocket: chest });
    h.noHemStitch = true;
    // half zip with a storm placket
    if (!back) {
      const zEnd = T(0, 0.6).y;
      const z = [{ x: 150, y: nf.y + 2 }, { x: 150, y: (nf.y + zEnd) / 2 }, { x: 150, y: zEnd }];
      h.shapes.push(
        ...zip(z),
        { d: `M${f1(141)},${f1(nf.y + 2)} L${f1(141)},${f1(zEnd)} L${f1(159)},${f1(zEnd)} L${f1(159)},${f1(nf.y + 2)}`, k: 'seam' },
        { d: `M${f1(137.5)},${f1(nf.y + 4)} L${f1(137.5)},${f1(zEnd + 2.5)} L${f1(162.5)},${f1(zEnd + 2.5)} L${f1(162.5)},${f1(nf.y + 4)}`, k: 'stitch' },
      );
      h.anchors.push({ key: 'hzip', label: 'Half zip', desc: 'Metal half zip with storm placket, bar tacked', x: 150 + 12, y: z[1].y });
      if (chest) {
        const a = T(-0.68, 0.5), b = T(-0.32, 0.49);
        h.shapes.push(...zip([b, lerp(a, b, 0.5), a]), { d: `M${P({ x: a.x, y: a.y + 4 })} L${P({ x: b.x, y: b.y + 4 })}`, k: 'stitch' });
        h.anchors.push({ key: 'chestzip', label: 'Chest zip pocket', desc: 'Welt zip pocket on the chest, 5 in', x: lerp(a, b, 0.5).x, y: a.y + 7 });
        h.anchors.push({ key: 'cord', label: 'Drawcords', desc: 'Flat drawcords with metal tips, 2 eyelets at the neck', x: 150 + 13, y: nf.y + 44 });
      }
    }
    // hem channel with drawcord ends
    const l = at('hemL') as V, rr = at('hemR') as V;
    const edge = (y: number): V[] => [l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y }));
    h.shapes.push({ d: poly(edge(hemY - 9)), k: 'seam' }, { d: poly(edge(hemY - 3)), k: 'stitch' });
    if (!back) {
      for (const s of [-1, 1]) {
        const a = T(s * 0.5, hemV);
        h.shapes.push({ d: circle({ x: a.x, y: a.y - 6 }, 1.5), k: 'line' }, { d: `M${f1(a.x)},${f1(a.y - 6)} q${f1(s * 2)},9 ${f1(s * 0.6)},17`, k: 'line' }, { d: `M${f1(a.x + s * 0.6 - 1.6)},${f1(a.y + 11)} h3.2 v4.5 h-3.2 Z`, k: 'line' });
      }
      h.anchors.push({ key: 'hemcord', label: 'Hem drawcord', desc: 'Drawcord channel at the hem, cord stops at the front', x: 150 + 62, y: hemY - 5 });
    } else h.anchors.push({ key: 'hemcord', label: 'Hem channel', desc: 'Drawcord channel at the hem, topstitched', x: 150 + 62, y: hemY - 5 });
    // elastic cuffs
    sleeveBand(c, h, 18, 'elcuff', 'Elastic cuffs', 'Elasticated cuffs with a stitched channel, 1.5 in', false);
    h.noSleeveStitch = true;
    if (!h.drop.includes('sleeve')) h.drop.push('sleeve');
    return h;
  }

  if (o.block === 'Work jacket') {
    shirtCollar(c, r, 14, true);
    r.rename.neck = { label: 'Point collar', desc: 'Point collar, double needle topstitch' };
    r.noHemStitch = true;
    r.noSleeveStitch = true;
    r.drop.push('hem', 'sleeve');
    const bh = wide ? 15 : 13;
    const hb = hemY - bh;
    if (ribHemOn(o)) ribHem(c, r, bh, 'Rib hem band');
    else {
      const l = at('hemL') as V, rr = at('hemR') as V;
      r.shapes.push({ d: poly([l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hb }))), k: 'seam' }, { d: poly([l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hb + 3 }))), k: 'stitch' }, { d: poly([l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hemY - 3 }))), k: 'stitch' });
      r.anchors.push({ key: 'wband', label: 'Waistband', desc: `Self fabric band, ${f1(bh / 9.4)} in, double needle topstitch`, x: 150 + 62, y: hemY - bh / 2 });
    }
    if (!back) {
      const z = [{ x: 150, y: nf.y + 4 }, { x: 150, y: (nf.y + hb) / 2 }, { x: 150, y: hb }];
      r.shapes.push(...zip(z), { d: `M${f1(156.5)},${f1(nf.y + 4)} L${f1(156.5)},${f1(hb)}`, k: 'seam' }, { d: `M${f1(159)},${f1(nf.y + 4)} L${f1(159)},${f1(hb)}`, k: 'stitch' });
      for (const s of [-1, 1]) {
        const a = T(s * 0.3, 0.32), b = T(s * 0.62, 0.32);
        const poc = [a, b, { x: b.x, y: b.y + 22 }, { x: a.x, y: a.y + 22 }];
        r.shapes.push({ d: poly(poc, true), k: 'line' });
        const fl = [a, b, { x: b.x, y: b.y + 10 }, { x: lerp(a, b, 0.5).x, y: a.y + 14 }, { x: a.x, y: a.y + 10 }];
        r.shapes.push({ d: poly(fl, true), k: 'line' }, { d: circle({ x: lerp(a, b, 0.5).x, y: a.y + 9 }, 1.7), k: 'line' });
        pocketAt(r, T(s * 0.42, hemV - 0.4), T(s * 0.7, hemV - 0.3), 0, 'welt');
      }
      const pa = T(0.46, 0.34);
      r.anchors.push(
        { key: 'fzip', label: 'Front zip', desc: 'Metal zip with a stitched storm flap', x: 150 + 10, y: (nf.y + hb) / 2 },
        { key: 'pocket', label: 'Chest flap pockets', desc: 'Patch pockets with flaps, snap closure', x: pa.x, y: pa.y + 5 },
        { key: 'welt', label: 'Welt pockets', desc: 'Hand welt pockets, bar tacked', x: T(0.56, hemV - 0.35).x, y: T(0.56, hemV - 0.35).y },
      );
    } else {
      const yk = [T(-0.96, 0.22), T(0, 0.3), T(0.96, 0.22)];
      r.shapes.push({ d: curve(yk), k: 'seam' }, { d: curve(yk.map((p) => ({ x: p.x, y: p.y + 2.6 }))), k: 'stitch' }, { d: `M150,${f1(T(0, 0.3).y)} L150,${f1(hb)}`, k: 'seam' });
      r.anchors.push({ key: 'yoke', label: 'Back yoke', desc: 'Back yoke, centre back seam, double needle topstitch', x: 150 + 40, y: T(0.4, 0.27).y + 6 });
    }
    sleeveBand(c, r, 20, 'cuff', 'Button cuffs', 'Button cuffs, double needle topstitch', false);
    return r;
  }

  if (o.block === 'Coach jacket') {
    shirtCollar(c, r, 14, false);
    r.rename.neck = { label: 'Spread collar', desc: 'Spread collar, single needle topstitch' };
    r.noSleeveStitch = true;
    r.drop.push('sleeve');
    sleeveBand(c, r, 20, 'ribcuff', 'Rib cuffs', 'Elastic 1x1 rib cuffs, 2 in');
    if (!back) {
      placket(c, r, nf.y + 4, hemY - 2, 5, 5, false);
      for (const s of [-1, 1]) pocketAt(r, T(s * 0.38, hemV - 0.36), T(s * 0.68, hemV - 0.25), 0, 'welt');
      r.anchors.push(
        { key: 'placket', label: 'Snap front', desc: 'Front placket with 5 metal snaps, double needle', x: 150 + 5, y: nf.y + 56 },
        { key: 'welt', label: 'Welt pockets', desc: 'Slash pockets at the hip, bar tacked', x: T(0.52, hemV - 0.31).x, y: T(0.52, hemV - 0.31).y },
      );
    } else {
      const yk = [T(-0.97, 0.2), T(0, 0.26), T(0.97, 0.2)];
      r.shapes.push({ d: curve(yk), k: 'seam' }, { d: curve(yk.map((p) => ({ x: p.x, y: p.y + 2.6 }))), k: 'stitch' }, { d: `M150,${f1(T(0, 0.26).y)} L150,${f1(hemY)}`, k: 'seam' });
      r.anchors.push({ key: 'yoke', label: 'Back yoke', desc: 'Back yoke and centre back seam, topstitched', x: 150 + 40, y: T(0.4, 0.23).y + 6 });
    }
    return r;
  }
  void ticks;
  return null;
}
