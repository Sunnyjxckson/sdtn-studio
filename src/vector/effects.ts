// Live effects: drop shadow and outer glow as SVG filters, shared by the canvas and the exporters.
import { itemBox, type VItem, type VStyle } from '../model/vector';

export const filterId = (id: string) => `vf-${id}`;

export const hasEffects = (s: VStyle) => !!(s.shadow?.on || s.glow?.on);

const n2 = (n: number) => String(Math.round(n * 100) / 100);
const hex = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

/** A whole <filter> element as markup, or '' when the item has no effects. */
export function filterMarkup(it: VItem): string {
  if (it.kind === 'group' || !hasEffects(it.style)) return '';
  const s = it.style;
  const b = itemBox(it) ?? { x: 0, y: 0, w: 1, h: 1 };
  const sh = s.shadow?.on ? s.shadow : null;
  const gl = s.glow?.on ? s.glow : null;
  const pad = (s.stroke ? s.width : 0) + Math.max(sh ? sh.blur * 3 + Math.hypot(sh.dx, sh.dy) : 0, gl ? gl.blur * 3 : 0) + 4;
  let inner = '';
  const layers: string[] = [];
  if (gl) {
    inner += `<feGaussianBlur in="SourceAlpha" stdDeviation="${n2(gl.blur)}" result="gb"/><feFlood flood-color="${hex(gl.color)}" flood-opacity="${n2(gl.a)}"/><feComposite in2="gb" operator="in" result="glow"/>`;
    layers.push('glow');
  }
  if (sh) {
    inner += `<feGaussianBlur in="SourceAlpha" stdDeviation="${n2(sh.blur)}" result="sb"/><feOffset in="sb" dx="${n2(sh.dx)}" dy="${n2(sh.dy)}" result="so"/><feFlood flood-color="${hex(sh.color)}" flood-opacity="${n2(sh.a)}"/><feComposite in2="so" operator="in" result="shadow"/>`;
    layers.push('shadow');
  }
  inner += `<feMerge>${layers.map((l) => `<feMergeNode in="${l}"/>`).join('')}<feMergeNode in="SourceGraphic"/></feMerge>`;
  return `<filter id="${filterId(it.id)}" filterUnits="userSpaceOnUse" x="${n2(b.x - pad)}" y="${n2(b.y - pad)}" width="${n2(b.w + pad * 2)}" height="${n2(b.h + pad * 2)}" color-interpolation-filters="sRGB">${inner}</filter>`;
}

export const defaultShadow = () => ({ on: true, dx: 3, dy: 4, blur: 3, color: '#000000', a: 0.4 });
export const defaultGlow = () => ({ on: true, blur: 4, color: '#FFD84A', a: 0.8 });
