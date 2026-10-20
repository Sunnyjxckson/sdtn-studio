import { zoomBy } from '../viewport';

let el: Element | null = null;
export const setOverlayEl = (e: Element | null) => void (el = e);

/** Zoom around a screen point. */
export function zoomAtClient(factor: number, clientX: number, clientY: number) {
  const r = el?.getBoundingClientRect();
  if (!r) return zoomBy(factor);
  zoomBy(factor, clientX - r.left, clientY - r.top);
}
