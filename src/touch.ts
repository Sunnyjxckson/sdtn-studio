/**
 * Shared touch handling for every canvas: two finger pinch zoom and pan, and palm rejection.
 * Runs in the capture phase on the canvas element so a tool never sees the touches that
 * belong to a gesture.
 */
export interface TouchView {
  x: number;
  y: number;
  k: number;
}

/** Pen state shared by all canvases. Once a pencil has been used, one finger pans instead of drawing. */
export const pen = { seen: false, down: new Set<number>() };

interface Opts {
  get: () => TouchView;
  set: (v: TouchView) => void;
  min: number;
  max: number;
  /** Called when a gesture or palm takes over from a tool that already started. */
  cancel?: (e: PointerEvent) => void;
}

type P = { x: number; y: number };

export function attachTouchGestures(el: Element, o: Opts): () => void {
  const touches = new Map<number, P>();
  const swallow = new Set<number>();
  let gesture: { a: number; b: number; p0: P; q0: P; view0: TouchView } | null = null;
  let pan: { id: number; sx: number; sy: number; view0: TouchView } | null = null;

  const rel = (e: PointerEvent): P => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const stop = (e: Event) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
  };

  const down = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerType === 'pen') {
      pen.seen = true;
      pen.down.add(e.pointerId);
      return;
    }
    if (e.pointerType !== 'touch') return;
    // palm resting while the pencil is on the glass
    if (pen.down.size > 0) {
      swallow.add(e.pointerId);
      stop(e);
      return;
    }
    touches.set(e.pointerId, rel(e));
    if (touches.size >= 2 && !gesture) {
      const [a, b] = [...touches.keys()];
      o.cancel?.(e);
      pan = null;
      gesture = { a, b, p0: touches.get(a)!, q0: touches.get(b)!, view0: { ...o.get() } };
      swallow.add(a);
      swallow.add(b);
      stop(e);
      return;
    }
    if (gesture) {
      swallow.add(e.pointerId);
      stop(e);
      return;
    }
    if (pen.seen) {
      o.cancel?.(e);
      pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, view0: { ...o.get() } };
      swallow.add(e.pointerId);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // not fatal
      }
      stop(e);
    }
  };

  const move = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerType !== 'touch') return;
    if (touches.has(e.pointerId)) touches.set(e.pointerId, rel(e));
    if (gesture) {
      const p1 = touches.get(gesture.a), q1 = touches.get(gesture.b);
      if (p1 && q1) {
        const { p0, q0, view0 } = gesture;
        const d0 = Math.hypot(p0.x - q0.x, p0.y - q0.y) || 1;
        const d1 = Math.hypot(p1.x - q1.x, p1.y - q1.y);
        const k = Math.max(o.min, Math.min(o.max, view0.k * (d1 / d0)));
        const c0 = { x: (p0.x + q0.x) / 2, y: (p0.y + q0.y) / 2 };
        const c1 = { x: (p1.x + q1.x) / 2, y: (p1.y + q1.y) / 2 };
        const wx = (c0.x - view0.x) / view0.k, wy = (c0.y - view0.y) / view0.k;
        o.set({ k, x: c1.x - wx * k, y: c1.y - wy * k });
      }
      stop(e);
      return;
    }
    if (pan && pan.id === e.pointerId) {
      o.set({ ...pan.view0, x: pan.view0.x + (e.clientX - pan.sx), y: pan.view0.y + (e.clientY - pan.sy) });
      stop(e);
      return;
    }
    if (swallow.has(e.pointerId)) stop(e);
  };

  const up = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerType === 'pen') {
      pen.down.delete(e.pointerId);
      return;
    }
    if (e.pointerType !== 'touch') return;
    const was = swallow.delete(e.pointerId);
    touches.delete(e.pointerId);
    if (pan && pan.id === e.pointerId) pan = null;
    if (gesture && (e.pointerId === gesture.a || e.pointerId === gesture.b)) gesture = null;
    if (was) stop(e);
  };

  el.addEventListener('pointerdown', down, true);
  el.addEventListener('pointermove', move, true);
  el.addEventListener('pointerup', up, true);
  el.addEventListener('pointercancel', up, true);
  return () => {
    el.removeEventListener('pointerdown', down, true);
    el.removeEventListener('pointermove', move, true);
    el.removeEventListener('pointerup', up, true);
    el.removeEventListener('pointercancel', up, true);
  };
}

/** Stop Safari from page zooming on a pinch or double tap. Call once at startup. */
export function blockPageGestures() {
  const stop = (e: Event) => e.preventDefault();
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
}
