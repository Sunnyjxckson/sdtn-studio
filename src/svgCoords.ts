/** Convert client (screen) coordinates into the local coordinate space of an SVG element. */
export function clientToLocal(el: SVGGraphicsElement | null, clientX: number, clientY: number) {
  const m = el?.getScreenCTM();
  if (!el || !m) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
}
