function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mix colour a toward colour b by t (0 to 1). */
export function mix(a: string, b: string, t: number): string {
  const x = parse(a), y = parse(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
