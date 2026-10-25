import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { activeDrawLayer, toolBrush, useStore, type PaintTool } from '../store';
import { ARTBOARD } from '../model/croquis';
import type { PaintStroke, SmudgeStroke, Stroke } from '../model/draw';
import { computeFill, ctx2d, LH, LW, makeCanvas, PaintRun, RES, restoreBox, SmudgeRun, toPx, type Box } from '../draw/engine';
import { layerCanvas, layerEntry, markCommitted, saveSnap, syncLayers } from '../draw/layers';
import { MAX_ZOOM, MIN_ZOOM, zoomBy } from '../viewport';
import { pen } from '../touch';

let backup: HTMLCanvasElement | null = null;
const getBackup = () => (backup ??= makeCanvas());
/** Once a pen has touched the canvas, fingers only pan, zoom and tap (palm rejection). */

interface Live {
  layerId: string;
  pointerId: number;
  pen: boolean;
  t0: number;
  pts: number[];
  smooth: { x: number; y: number };
  raw: { x: number; y: number };
  sim: { p: number; t: number; sx: number; sy: number };
  streamline: number;
  run: PaintRun | SmudgeRun;
  stroke: PaintStroke | SmudgeStroke;
  shape: null | 'line' | 'ellipse';
  holdAt: { x: number; y: number };
  holdTimer: ReturnType<typeof setTimeout> | null;
  frame: number | null;
}

interface Gesture {
  t0: number;
  fingers: number;
  moved: number;
  start: Map<number, { x: number; y: number }>;
  view0: { x: number; y: number; k: number };
}

const r2 = (n: number) => Math.round(n * 20) / 20;

function LayerSlot({ id, visible, opacity, blend, transform }: { id: string; visible: boolean; opacity: number; blend: string; transform: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const c = layerCanvas(id);
    ref.current?.appendChild(c);
    return () => {
      c.remove();
    };
  }, [id]);
  return (
    <div
      ref={ref}
      className="drawslot"
      style={{ width: LW, height: LH, transform, opacity, mixBlendMode: blend as React.CSSProperties['mixBlendMode'], display: visible ? 'block' : 'none' }}
    />
  );
}

/** Points that trace a straight line or an ellipse, for QuickShape. */
function quickShape(pts: number[]): { kind: 'line' | 'ellipse'; pts: number[] } | null {
  const n = pts.length / 3;
  if (n < 4) return null;
  const x0 = pts[0], y0 = pts[1], xn = pts[(n - 1) * 3], yn = pts[(n - 1) * 3 + 1];
  let len = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pSum = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    pSum += pts[i * 3 + 2];
    if (i) len += Math.hypot(x - pts[(i - 1) * 3], y - pts[(i - 1) * 3 + 1]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (len < 12) return null;
  const p = pSum / n;
  const chord = Math.hypot(xn - x0, yn - y0);
  if (chord > len * 0.85) return { kind: 'line', pts: linePts(x0, y0, xn, yn, p) };
  if (chord < len * 0.25) {
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
    const out: number[] = [];
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      out.push(r2(cx + Math.cos(a) * rx), r2(cy + Math.sin(a) * ry), p);
    }
    return { kind: 'ellipse', pts: out };
  }
  return null;
}
const linePts = (x0: number, y0: number, x1: number, y1: number, p: number) => [x0, y0, p, r2((x0 + x1) / 2), r2((y0 + y1) / 2), p, x1, y1, p];

export function DrawOverlay({ interactive }: { interactive: boolean }) {
  const layers = useStore((s) => s.doc.drawing.layers);
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.drawTool);
  const boxRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pan = useRef<{ sx: number; sy: number; vx: number; vy: number; id: number } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const [space, setSpace] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useLayoutEffect(() => {
    syncLayers(layers);
  }, [layers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // wheel zoom and space to pan
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpace(false);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [interactive]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (e: { clientX: number; clientY: number }) => {
    const v = useStore.getState().view;
    const l = local(e);
    return { x: (l.x - v.x) / v.k, y: (l.y - v.y) / v.k };
  };

  // ---------- live strokes ----------
  const render = () => {
    const L = live.current;
    if (!L) return;
    L.frame = null;
    const dst = layerEntry(L.layerId).ctx;
    if (L.run instanceof PaintRun) {
      L.run.update(L.pts, false);
      restoreBox(dst, getBackup(), L.run.box);
      L.run.composite(dst);
    } else {
      L.run.update(L.pts, false);
    }
  };
  const schedule = () => {
    const L = live.current;
    if (L && L.frame === null) L.frame = requestAnimationFrame(render);
  };

  const beginStroke = (e: React.PointerEvent, t: PaintTool) => {
    const st = useStore.getState();
    const layer = activeDrawLayer(st);
    if (!layer.visible) {
      setToast('This layer is hidden');
      return false;
    }
    const entry = layerEntry(layer.id);
    const b = getBackup();
    const bx = ctx2d(b);
    bx.globalCompositeOperation = 'copy';
    bx.drawImage(entry.canvas, 0, 0);
    bx.globalCompositeOperation = 'source-over';
    const tb = toolBrush(st.drawPrefs, t);
    const w = world(e);
    const pen = e.pointerType === 'pen';
    const p0 = pen ? penP(e.pressure) : 0.85;
    const seed = (Math.random() * 2 ** 31) | 0;
    let stroke: PaintStroke | SmudgeStroke;
    let run: PaintRun | SmudgeRun;
    if (t === 'smudge') {
      stroke = { kind: 'smudge', brush: tb.brush.id, size: tb.size, strength: tb.opacity, pts: [], seed };
      run = new SmudgeRun(stroke, entry.ctx);
    } else {
      stroke = {
        kind: 'paint',
        brush: tb.brush.id,
        color: st.drawPrefs.color,
        size: tb.size,
        opacity: tb.opacity,
        op: t === 'erase' ? 'out' : layer.alphaLock ? 'atop' : 'over',
        pts: [],
        seed,
      };
      run = new PaintRun(stroke);
    }
    const pts = [r2(w.x), r2(w.y), p0];
    live.current = {
      layerId: layer.id,
      pointerId: e.pointerId,
      pen,
      t0: performance.now(),
      pts,
      smooth: { ...w },
      raw: { ...w },
      sim: { p: p0, t: e.timeStamp, sx: e.clientX, sy: e.clientY },
      streamline: tb.brush.streamline,
      run,
      stroke,
      shape: null,
      holdAt: { x: e.clientX, y: e.clientY },
      holdTimer: null,
      frame: null,
    };
    armHold();
    schedule();
    return true;
  };

  const penP = (p: number) => Math.pow(Math.max(0.05, Math.min(1, p || 0.5)), 0.8);

  const armHold = () => {
    const L = live.current;
    if (!L) return;
    if (L.holdTimer) clearTimeout(L.holdTimer);
    L.holdTimer = setTimeout(() => {
      const M = live.current;
      if (!M || M !== L || M.shape || M.stroke.kind !== 'paint') return;
      const q = quickShape(M.pts);
      if (!q) return;
      M.shape = q.kind;
      M.pts = q.pts;
      if (M.run instanceof PaintRun) {
        const old: Box = { ...M.run.box };
        M.run.restart(M.pts, false);
        const dst = layerEntry(M.layerId).ctx;
        restoreBox(dst, getBackup(), union(old, M.run.box));
        M.run.composite(dst);
      }
      setToast(q.kind === 'line' ? 'Line' : 'Ellipse');
    }, 550);
  };

  const addPoint = (ev: PointerEvent) => {
    const L = live.current;
    if (!L) return;
    const v = useStore.getState().view;
    const w = world(ev);
    if (L.shape === 'line') {
      // drag the far end of a snapped line
      const n = L.pts.length;
      const p = L.pts[2];
      L.pts = linePts(L.pts[0], L.pts[1], r2(w.x), r2(w.y), p);
      if (L.run instanceof PaintRun) {
        const old: Box = { ...L.run.box };
        L.run.restart(L.pts, false);
        const dst = layerEntry(L.layerId).ctx;
        restoreBox(dst, getBackup(), union(old, L.run.box));
        L.run.composite(dst);
      }
      void n;
      return;
    }
    if (L.shape) return;
    let p: number;
    if (L.pen) p = penP(ev.pressure);
    else {
      // fake pressure from speed so a mouse or finger still gives some line weight
      const dt = Math.max(1, ev.timeStamp - L.sim.t);
      const sp = Math.hypot(ev.clientX - L.sim.sx, ev.clientY - L.sim.sy) / dt;
      const target = Math.max(0.45, Math.min(1, 1.05 - sp * 0.22));
      L.sim = { p: L.sim.p + (target - L.sim.p) * 0.25, t: ev.timeStamp, sx: ev.clientX, sy: ev.clientY };
      p = L.sim.p;
    }
    L.raw = w;
    const f = 1 - L.streamline * 0.85;
    L.smooth = { x: L.smooth.x + (w.x - L.smooth.x) * f, y: L.smooth.y + (w.y - L.smooth.y) * f };
    const n = L.pts.length;
    const lx = L.pts[n - 3], ly = L.pts[n - 2];
    if (Math.hypot(L.smooth.x - lx, L.smooth.y - ly) < 0.5 / v.k) return;
    L.pts.push(r2(L.smooth.x), r2(L.smooth.y), Math.round(p * 100) / 100);
    if (Math.hypot(ev.clientX - L.holdAt.x, ev.clientY - L.holdAt.y) > 4) {
      L.holdAt = { x: ev.clientX, y: ev.clientY };
      armHold();
    }
  };

  const finishStroke = (cancel = false) => {
    const L = live.current;
    if (!L) return;
    live.current = null;
    if (L.holdTimer) clearTimeout(L.holdTimer);
    if (L.frame !== null) cancelAnimationFrame(L.frame);
    const dst = layerEntry(L.layerId).ctx;
    if (cancel) {
      restoreBox(dst, getBackup(), L.run.box);
      return;
    }
    if (!L.shape) {
      const n = L.pts.length;
      const lx = L.pts[n - 3], ly = L.pts[n - 2];
      if (Math.hypot(L.raw.x - lx, L.raw.y - ly) > 0.5) L.pts.push(r2(L.raw.x), r2(L.raw.y), L.pts[n - 1]);
    }
    if (L.run instanceof PaintRun) {
      const old: Box = { ...L.run.box };
      L.run.restart(L.pts, true);
      restoreBox(dst, getBackup(), union(old, L.run.box));
      L.run.composite(dst);
    } else {
      L.run.update(L.pts, true);
    }
    const stroke: Stroke = { ...L.stroke, pts: L.pts };
    commit(L.layerId, stroke);
  };

  const commit = (layerId: string, stroke: Stroke) => {
    const st = useStore.getState();
    const before = st.doc.drawing.layers.find((l) => l.id === layerId)?.strokes ?? [];
    markCommitted(stroke);
    saveSnap(layerId, before, getBackup());
    st.addStroke(layerId, stroke);
    if (stroke.kind !== 'smudge' && !(stroke.kind === 'paint' && stroke.op === 'out')) {
      const c = stroke.color;
      st.setDrawPrefs((p) => {
        p.recent = [c, ...p.recent.filter((x) => x !== c)].slice(0, 12);
      });
    }
  };

  const doFill = (e: React.PointerEvent) => {
    const st = useStore.getState();
    const layer = activeDrawLayer(st);
    if (!layer.visible) {
      setToast('This layer is hidden');
      return;
    }
    const refLayer = st.doc.drawing.layers.find((l) => l.reference && l.visible) ?? layer;
    const w = world(e);
    const px = toPx(w.x, w.y);
    const src = layerEntry(refLayer.id).canvas;
    const data = src.getContext('2d')!.getImageData(0, 0, LW, LH);
    const runs = computeFill(data, px.x, px.y, st.drawPrefs.fillTolerance);
    if (runs.length === 0) return;
    const entry = layerEntry(layer.id);
    const b = getBackup();
    const bx = ctx2d(b);
    bx.globalCompositeOperation = 'copy';
    bx.drawImage(entry.canvas, 0, 0);
    bx.globalCompositeOperation = 'source-over';
    const before = layer.strokes;
    saveSnap(layer.id, before, b);
    st.addStroke(layer.id, { kind: 'fill', color: st.drawPrefs.color, opacity: 1, op: layer.alphaLock ? 'atop' : 'over', runs });
    const c = st.drawPrefs.color;
    st.setDrawPrefs((p) => {
      p.recent = [c, ...p.recent.filter((x) => x !== c)].slice(0, 12);
    });
  };

  const sample = (e: { clientX: number; clientY: number }) => {
    const st = useStore.getState();
    const w = world(e);
    const px = toPx(w.x, w.y);
    const c = makeCanvas(1, 1);
    const x = c.getContext('2d', { willReadFrequently: true })!;
    for (const l of st.doc.drawing.layers) {
      if (!l.visible) continue;
      x.globalAlpha = l.opacity;
      x.globalCompositeOperation = l.blend === 'normal' ? 'source-over' : l.blend;
      x.drawImage(layerCanvas(l.id), Math.floor(px.x), Math.floor(px.y), 1, 1, 0, 0, 1, 1);
    }
    const d = x.getImageData(0, 0, 1, 1).data;
    if (d[3] < 10) return;
    const hex = '#' + [d[0], d[1], d[2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    st.setDrawPrefs((p) => void (p.color = hex));
  };
  const eyedrop = useRef(false);

  // ---------- pointer routing ----------
  const startGesture = () => {
    const pts = new Map(touches.current);
    gesture.current = { t0: performance.now(), fingers: pts.size, moved: 0, start: pts, view0: { ...useStore.getState().view } };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // not fatal
    }
    const st = useStore.getState();
    if (e.pointerType === 'pen') pen.seen = true;
    if (e.pointerType === 'touch') {
      if (live.current?.pen) return; // palm resting while the pencil draws
      touches.current.set(e.pointerId, local(e));
      if (touches.current.size >= 2) {
        const L = live.current;
        if (L && !L.pen && performance.now() - L.t0 < 400) finishStroke(true);
        else if (L) return; // a stroke is well under way, ignore the extra finger
        pan.current = null;
        startGesture();
        return;
      }
      if (pen.seen || st.drawTool === 'hand') {
        pan.current = { sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y, id: e.pointerId };
        return;
      }
    } else if (e.button === 1 || st.drawTool === 'hand' || space) {
      pan.current = { sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y, id: e.pointerId };
      return;
    } else if (e.button !== 0) return;

    if (live.current || gesture.current) return;
    const t = st.drawTool;
    if (t === 'brush' || t === 'erase' || t === 'smudge') beginStroke(e, t);
    else if (t === 'fill') doFill(e);
    else if (t === 'eyedrop') {
      eyedrop.current = true;
      sample(e);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // brush outline cursor for mouse and pen
    const cur = cursorRef.current;
    if (cur && e.pointerType !== 'touch') {
      const st = useStore.getState();
      const t = st.drawTool;
      if (t === 'brush' || t === 'erase' || t === 'smudge') {
        const d = Math.max(4, toolBrush(st.drawPrefs, t).size * st.view.k);
        const l = local(e);
        cur.style.display = 'block';
        cur.style.width = cur.style.height = `${d}px`;
        cur.style.transform = `translate(${l.x - d / 2}px, ${l.y - d / 2}px)`;
      } else cur.style.display = 'none';
    }
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) touches.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (g) {
      const ids = [...g.start.keys()].filter((id) => touches.current.has(id)).slice(0, 2);
      if (ids.length < 2) return;
      const a0 = g.start.get(ids[0])!, b0 = g.start.get(ids[1])!;
      const a1 = touches.current.get(ids[0])!, b1 = touches.current.get(ids[1])!;
      const c0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, c1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1, d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
      g.moved = Math.max(g.moved, Math.hypot(c1.x - c0.x, c1.y - c0.y), Math.abs(d1 - d0));
      if (g.moved < 6) return;
      const v0 = g.view0;
      const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v0.k * (d1 / d0)));
      const wx = (c0.x - v0.x) / v0.k, wy = (c0.y - v0.y) / v0.k;
      useStore.getState().setView({ k, x: c1.x - wx * k, y: c1.y - wy * k });
      return;
    }
    const pn = pan.current;
    if (pn && pn.id === e.pointerId) {
      const st = useStore.getState();
      st.setView({ ...st.view, x: pn.vx + (e.clientX - pn.sx), y: pn.vy + (e.clientY - pn.sy) });
      return;
    }
    const L = live.current;
    if (L && L.pointerId === e.pointerId) {
      const ne = e.nativeEvent;
      const list = typeof ne.getCoalescedEvents === 'function' ? ne.getCoalescedEvents() : [];
      for (const ev of list.length ? list : [ne]) addPoint(ev);
      schedule();
      return;
    }
    if (eyedrop.current && e.buttons) sample(e);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') touches.current.delete(e.pointerId);
    const g = gesture.current;
    if (g) {
      if (touches.current.size === 0) {
        gesture.current = null;
        if (g.moved < 10 && performance.now() - g.t0 < 350) {
          const st = useStore.getState();
          if (g.fingers === 2) st.undo();
          else if (g.fingers >= 3) st.redo();
        }
      } else {
        g.fingers = Math.max(g.fingers, touches.current.size);
      }
      return;
    }
    if (pan.current?.id === e.pointerId) {
      pan.current = null;
      return;
    }
    if (live.current?.pointerId === e.pointerId) finishStroke(false);
    eyedrop.current = false;
  };

  // count extra fingers that join a gesture for the 3 finger tap
  const onPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g && e.pointerType === 'touch') {
      touches.current.set(e.pointerId, local(e));
      g.fingers = Math.max(g.fingers, touches.current.size);
    }
  };

  const k = view.k / RES;
  const transform = `translate(${view.x + ARTBOARD.x * view.k}px, ${view.y + ARTBOARD.y * view.k}px) scale(${k})`;
  const cursor = !interactive ? undefined : space || tool === 'hand' ? 'grab' : tool === 'eyedrop' || tool === 'fill' ? 'crosshair' : 'none';

  return (
    <div
      ref={boxRef}
      className="drawlayers"
      style={{ pointerEvents: interactive ? 'auto' : 'none', cursor, touchAction: 'none' }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        if (cursorRef.current) cursorRef.current.style.display = 'none';
      }}
      onContextMenu={(e) => interactive && e.preventDefault()}
    >
      {layers.map((l) => (
        <LayerSlot key={l.id} id={l.id} visible={l.visible} opacity={l.opacity} blend={l.blend} transform={transform} />
      ))}
      {interactive && <div ref={cursorRef} className="brushcursor" />}
      {toast && <div className="drawtoast">{toast}</div>}
    </div>
  );
}

function union(a: Box, b: Box): Box {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}
