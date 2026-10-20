// SVG output written from the vector model (not the DOM).
import {
  dimGeom,
  itemsBox,
  matStr,
  pathD,
  repeatMats,
  textPaint,
  type Box,
  type VDim,
  type VItem,
  type VPaint,
  type VStyle,
} from '../../model/vector';

const n2 = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Ctx {
  defs: string[];
  n: number;
}

function paintAttr(c: Ctx, p: VPaint | null): string {
  if (!p) return 'none';
  if (p.kind === 'solid') return p.color;
  const id = `g${c.n++}`;
  const stops = [...p.stops]
    .sort((a, b) => a.o - b.o)
    .map((s) => `<stop offset="${n2(s.o)}" stop-color="${s.color}"${s.a < 1 ? ` stop-opacity="${n2(s.a)}"` : ''}/>`)
    .join('');
  if (p.kind === 'linear') {
    c.defs.push(`<linearGradient id="${id}" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}">${stops}</linearGradient>`);
  } else {
    const r = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 0.5;
    c.defs.push(`<radialGradient id="${id}" cx="${p.x1}" cy="${p.y1}" r="${r}" fx="${p.x1}" fy="${p.y1}">${stops}</radialGradient>`);
  }
  return `url(#${id})`;
}

function styleAttrs(c: Ctx, s: VStyle): string {
  let a = ` fill="${paintAttr(c, s.fill)}"`;
  if (s.fillRule === 'evenodd') a += ' fill-rule="evenodd"';
  if (s.stroke) {
    a += ` stroke="${paintAttr(c, s.stroke)}" stroke-width="${n2(s.width)}" stroke-linecap="${s.cap}" stroke-linejoin="${s.join}"`;
    if (s.dash.length) a += ` stroke-dasharray="${s.dash.join(' ')}"`;
  }
  if (s.opacity < 1) a += ` opacity="${n2(s.opacity)}"`;
  if (s.blend !== 'normal') a += ` style="mix-blend-mode:${s.blend}"`;
  return a;
}

function dimSvg(c: Ctx, d: VDim): string {
  const g = dimGeom(d);
  const col = textPaint(d.style.stroke);
  const w = d.style.width;
  const tick = 5;
  const sg = Math.sign(d.off || 1);
  const ext = (x: number, y: number, ax: number, ay: number) => `M${n2(ax)},${n2(ay)} L${n2(x + g.nx * sg * 3)},${n2(y + g.ny * sg * 3)}`;
  const t = (px: number, py: number) =>
    `M${n2(px - g.nx * tick - g.ny * tick * 0.6)},${n2(py - g.ny * tick + g.nx * tick * 0.6)} L${n2(px + g.nx * tick + g.ny * tick * 0.6)},${n2(py + g.ny * tick - g.nx * tick * 0.6)}`;
  const mx = (g.a.x + g.b.x) / 2, my = (g.a.y + g.b.y) / 2;
  let ang = g.angle;
  if (ang > 90 || ang < -90) ang += 180;
  const label = `${(Math.round(g.inches * 8) / 8).toFixed(g.inches % 1 ? 2 : 0).replace(/\.?0+$/, '')}"`;
  void c;
  return (
    `<g${d.style.opacity < 1 ? ` opacity="${n2(d.style.opacity)}"` : ''} fill="none" stroke="${col}">` +
    `<path d="${ext(g.a.x, g.a.y, d.ax, d.ay)} ${ext(g.b.x, g.b.y, d.bx, d.by)}" stroke-width="${n2(w * 0.6)}" opacity="0.7"/>` +
    `<path d="M${n2(g.a.x)},${n2(g.a.y)} L${n2(g.b.x)},${n2(g.b.y)}" stroke-width="${n2(w)}"/>` +
    `<path d="${t(g.a.x, g.a.y)} ${t(g.b.x, g.b.y)}" stroke-width="${n2(w)}"/>` +
    `<text x="${n2(mx)}" y="${n2(my)}" transform="rotate(${n2(ang)} ${n2(mx)} ${n2(my)}) translate(0 -4)" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="${col}" stroke="#F4F2ED" stroke-width="3" paint-order="stroke">${esc(label)}</text>` +
    `</g>`
  );
}

function itemSvg(c: Ctx, it: VItem): string {
  if (it.hidden) return '';
  if (it.kind === 'path') return `<path d="${pathD(it)}"${styleAttrs(c, it.style)}/>`;
  if (it.kind === 'text') {
    const rot = it.rot ? ` transform="rotate(${n2(it.rot)} ${n2(it.x)} ${n2(it.y)})"` : '';
    const ls = it.letter ? ` letter-spacing="${n2(it.letter)}"` : '';
    return `<text x="${n2(it.x)}" y="${n2(it.y)}"${rot} font-family="${esc(it.font)}" font-weight="${it.weight}" font-size="${n2(it.size)}"${ls} text-anchor="${it.anchor}" xml:space="preserve" paint-order="stroke"${styleAttrs(c, it.style)}>${esc(it.text)}</text>`;
  }
  if (it.kind === 'dim') return dimSvg(c, it);
  const mask = it.clip && it.children[0] ? it.children[0] : null;
  const kids = it.clip ? it.children.slice(1) : it.children;
  const body = () => {
    let out = kids.map((k) => itemSvg(c, k)).join('');
    if (mask) {
      const id = `c${c.n++}`;
      const md = mask.kind === 'path' ? pathD(mask) : '';
      c.defs.push(`<clipPath id="${id}"><path d="${md}"${mask.kind === 'path' && mask.style.fillRule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/></clipPath>`);
      out = `<g clip-path="url(#${id})">${out}</g>`;
      if (mask.kind === 'path' && mask.style.stroke) out += `<path d="${md}"${styleAttrs(c, { ...mask.style, fill: null })}/>`;
    }
    return out;
  };
  let out = body();
  if (it.repeat) for (const m of repeatMats(it.repeat)) out += `<g transform="${matStr(m)}">${body()}</g>`;
  return `<g>${out}</g>`;
}

/** SVG markup for a list of items, laid out in the given box. */
export function itemsToSvg(items: VItem[], box: Box, pad = 0): string {
  const c: Ctx = { defs: [], n: 1 };
  const body = items.map((it) => itemSvg(c, it)).join('\n');
  const x = box.x - pad, y = box.y - pad, w = box.w + pad * 2, h = box.h + pad * 2;
  const defs = c.defs.length ? `<defs>${c.defs.join('')}</defs>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)}" width="${n2(w)}" height="${n2(h)}">\n${defs}${body}\n</svg>`;
}

/** Tight snippet for the system clipboard. */
export function snippetSvg(items: VItem[]): string {
  const box = itemsBox(items);
  if (!box) return '';
  return itemsToSvg(items, box, 10);
}
