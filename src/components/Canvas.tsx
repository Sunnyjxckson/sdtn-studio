import { useEffect, useRef, useState } from 'react';
import { useStore, defaultText, holeRadius } from '../store';
import { nearestSegment, MIN_CROP_Y, GARMENT_H, type Garment } from '../model/garment';
import { clientToLocal } from '../svgCoords';
import { fitToArtboard, setCanvasSize, zoomBy } from '../viewport';
import { Artboard, CroquisView } from './CroquisView';
import { GarmentView } from './GarmentView';

type Drag =
  | { type: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { type: 'pt'; gid: string; i: number; started: boolean }
  | { type: 'garment'; gid: string; last: { x: number; y: number }; started: boolean }
  | { type: 'text'; gid: string; i: number; started: boolean }
  | { type: 'cut'; gid: string }
  | { type: 'paint'; gid: string; last: { x: number; y: number } };

const ACCENT = '#C8102E';

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);

  const doc = useStore((s) => s.doc);
  const tool = useStore((s) => s.tool);
  const tab = useStore((s) => s.tab);
  const view = useStore((s) => s.view);
  const selectedId = useStore((s) => s.selectedId);
  const selectedText = useStore((s) => s.selectedText);
  const ready = useStore((s) => s.ready);

  // size tracking and first fit
  const fitted = useRef(false);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setCanvasSize(r.width, r.height);
      if (!fitted.current && r.width > 0 && useStore.getState().ready) {
        fitted.current = true;
        fitToArtboard();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (ready && !fitted.current && svgRef.current) {
      const r = svgRef.current.getBoundingClientRect();
      if (r.width > 0) {
        setCanvasSize(r.width, r.height);
        fitted.current = true;
        fitToArtboard();
      }
    }
  }, [ready]);

  // wheel zoom (needs a non passive listener)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const speed = e.ctrlKey ? 0.01 : 0.0015;
      zoomBy(Math.exp(-e.deltaY * speed), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // space key for temporary pan
  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const world = (e: { clientX: number; clientY: number }) => clientToLocal(worldRef.current, e.clientX, e.clientY);
  const local = (gid: string, e: { clientX: number; clientY: number }) =>
    clientToLocal(document.getElementById(`garment-${gid}`) as SVGGraphicsElement | null, e.clientX, e.clientY);

  const garmentById = (id: string | null): Garment | undefined => doc.garments.find((g) => g.id === id);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!e.isPrimary) return;
    const st = useStore.getState();
    const svg = e.currentTarget;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // not fatal
    }
    if (e.button === 1 || st.tool === 'hand' || space) {
      e.preventDefault();
      drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y };
      setPanning(true);
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const hit = (e.target as Element).closest('[data-kind]') as HTMLElement | SVGElement | null;
    const kind = hit?.getAttribute('data-kind') ?? null;
    const gid = hit?.getAttribute('data-gid') ?? null;
    const idx = Number(hit?.getAttribute('data-i') ?? -1);
    const t = st.tool;

    // Selecting: any tool lets you pick another garment first.
    if (gid && gid !== st.selectedId && kind !== 'pt') {
      st.select(gid);
      if (t === 'move') {
        drag.current = { type: 'garment', gid, last: world(e), started: false };
      }
      return;
    }

    if (t === 'move') {
      if (kind === 'pt' && gid) {
        drag.current = { type: 'pt', gid, i: idx, started: false };
      } else if (kind === 'text' && gid) {
        st.selectText(idx);
        drag.current = { type: 'text', gid, i: idx, started: false };
      } else if (kind === 'garment' && gid) {
        st.selectText(null);
        drag.current = { type: 'garment', gid, last: world(e), started: false };
      } else {
        st.select(null);
      }
      return;
    }

    const sel = garmentById(st.selectedId);
    if (!sel) return;

    if (t === 'erase') {
      if (kind === 'pt') st.removePoint(sel.id, idx);
      else if (kind === 'hole') st.removeItem(sel.id, 'holes', idx);
      else if (kind === 'dist') st.removeItem(sel.id, 'distress', idx);
      else if (kind === 'text') st.removeItem(sel.id, 'texts', idx);
      return;
    }

    if (t === 'add') {
      if (kind === 'pt') {
        drag.current = { type: 'pt', gid: sel.id, i: idx, started: false };
        return;
      }
      const at = local(sel.id, e);
      const { index, point } = nearestSegment(sel.points, at);
      st.checkpoint();
      st.edit(sel.id, (g) => {
        g.points.splice(index, 0, { x: point.x, y: point.y });
      });
      drag.current = { type: 'pt', gid: sel.id, i: index, started: true };
      return;
    }

    const onSel = gid === sel.id; // pointer landed on the selected garment itself
    if (!onSel) return;
    const at = local(sel.id, e);

    if (t === 'cut') {
      st.checkpoint();
      st.edit(sel.id, (g) => {
        g.cropY = Math.min(GARMENT_H, Math.max(MIN_CROP_Y, at.y));
      });
      drag.current = { type: 'cut', gid: sel.id };
    } else if (t === 'hole') {
      st.checkpoint();
      const r = holeRadius(st.holeSize);
      st.edit(sel.id, (g) => {
        g.holes.push({ x: at.x, y: at.y, r });
      });
    } else if (t === 'distress') {
      st.checkpoint();
      st.edit(sel.id, (g) => {
        g.distress.push({ x: at.x, y: at.y });
      });
      drag.current = { type: 'paint', gid: sel.id, last: at };
    } else if (t === 'text') {
      st.checkpoint();
      let n = 0;
      st.edit(sel.id, (g) => {
        g.texts.push(defaultText(at.x, at.y));
        n = g.texts.length - 1;
      });
      st.selectText(n);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || !e.isPrimary) return;
    const st = useStore.getState();
    if (d.type === 'pan') {
      st.setView({ ...st.view, x: d.vx + (e.clientX - d.sx), y: d.vy + (e.clientY - d.sy) });
      return;
    }
    if (d.type === 'pt') {
      const at = local(d.gid, e);
      if (!d.started) {
        st.checkpoint();
        d.started = true;
      }
      st.edit(d.gid, (g) => {
        const p = g.points[d.i];
        if (p) {
          p.x = at.x;
          p.y = at.y;
        }
      });
    } else if (d.type === 'text') {
      const at = local(d.gid, e);
      if (!d.started) {
        st.checkpoint();
        d.started = true;
      }
      st.edit(d.gid, (g) => {
        const x = g.texts[d.i];
        if (x) {
          x.x = at.x;
          x.y = at.y;
        }
      });
    } else if (d.type === 'garment') {
      const w = world(e);
      const dx = w.x - d.last.x, dy = w.y - d.last.y;
      if (!d.started) {
        if (Math.hypot(dx, dy) < 3) return;
        st.checkpoint();
        d.started = true;
      }
      d.last = w;
      st.edit(d.gid, (g) => {
        g.transform.x += dx;
        g.transform.y += dy;
      });
    } else if (d.type === 'cut') {
      const at = local(d.gid, e);
      st.edit(d.gid, (g) => {
        g.cropY = Math.min(GARMENT_H, Math.max(MIN_CROP_Y, at.y));
      });
    } else if (d.type === 'paint') {
      const at = local(d.gid, e);
      if (Math.hypot(at.x - d.last.x, at.y - d.last.y) > 14) {
        d.last = at;
        st.edit(d.gid, (g) => {
          g.distress.push({ x: at.x, y: at.y });
        });
      }
    }
  };

  const endDrag = () => {
    drag.current = null;
    setPanning(false);
  };

  const sel = garmentById(selectedId);
  const showHandles = !!sel && sel.visible && (tool === 'move' || tool === 'add' || tool === 'erase');
  const handleR = 6 / view.k;

  const cursor =
    panning ? 'grabbing' : space || tool === 'hand' ? 'grab' : tool === 'move' ? 'default' : 'crosshair';

  return (
    <svg
      ref={svgRef}
      className="canvas"
      role="img"
      aria-label="Design canvas"
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <g ref={worldRef} transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        <Artboard />
        {tab === 'sketch' && <CroquisView sex={doc.base.sex} view={doc.base.view} />}
        {doc.garments.map((g) =>
          g.visible ? <GarmentView key={g.id} g={g} selectedText={g.id === selectedId ? selectedText : null} showCut={g.id === selectedId} /> : null,
        )}
        {showHandles && sel && (
          <g>
            {sel.points.map((p, i) => {
              const t = sel.transform;
              const x = t.x + p.x * t.scale;
              const y = t.y + p.y * t.scale;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={handleR * 2.2} fill="transparent" data-kind="pt" data-i={i} data-gid={sel.id} style={{ cursor: tool === 'erase' ? 'crosshair' : 'grab' }} />
                  <circle
                    cx={x}
                    cy={y}
                    r={handleR}
                    fill={p.key ? '#FFFFFF' : ACCENT}
                    stroke={tool === 'erase' ? ACCENT : '#141414'}
                    strokeWidth={1.6 / view.k}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </g>
        )}
      </g>
    </svg>
  );
}
