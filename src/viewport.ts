import { ARTBOARD } from './model/croquis';
import { useStore } from './store';

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 6;

let canvasW = 800;
let canvasH = 600;

export function setCanvasSize(w: number, h: number) {
  canvasW = w;
  canvasH = h;
}

export function fitToArtboard(margin = 24) {
  const k = Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, Math.min((canvasW - margin * 2) / ARTBOARD.w, (canvasH - margin * 2) / ARTBOARD.h)),
  );
  useStore.getState().setView({
    k,
    x: (canvasW - ARTBOARD.w * k) / 2 - ARTBOARD.x * k,
    y: (canvasH - ARTBOARD.h * k) / 2 - ARTBOARD.y * k,
  });
}

/** Zoom by a factor around a screen point inside the canvas (defaults to the centre). */
export function zoomBy(factor: number, cx = canvasW / 2, cy = canvasH / 2) {
  const { view, setView } = useStore.getState();
  const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.k * factor));
  const r = k / view.k;
  setView({ k, x: cx - (cx - view.x) * r, y: cy - (cy - view.y) * r });
}
