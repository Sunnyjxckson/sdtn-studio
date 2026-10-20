import { useEffect, useRef, useState } from 'react';
import { useStore, defaultText, holeRadius } from '../store';
import { nearestSegment, MIN_CROP_Y, GARMENT_H, type Garment } from '../model/garment';
import { clientToLocal } from '../svgCoords';
import { fitToArtboard, setCanvasSize, zoomBy } from '../viewport';
import { Artboard, CroquisView } from './CroquisView';
import { GarmentView } from './GarmentView';
import { notePaths } from '../model/note';
import { bodyProfile, IDENTITY_RIG, poseRig, poseUnwarp, torsoProfile, type Vec } from '../model/figure';
import { stiffOf, topForward, topInverse, topShape } from '../model/top';
import { TopView } from './TopView';
import type { Pt } from '../model/garment';
import { fitGarment } from '../model/conform';
import { getCroquis } from '../model/croquis';

type Drag =
  | { type: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { type: 'pt'; gid: string; i: number; started: boolean }
  | { type: 'garment'; gid: string; last: { x: number; y: number }; started: boolean }
  | { type: 'text'; gid: string; i: number; started: boolean }
  | { type: 'note'; id: string; last: { x: number; y: number }; started: boolean }
  | { type: 'tip'; id: string; started: boolean }
  | { type: 'cut'; gid: string }
  | { type: 'paint'; gid: string; last: { x: number; y: number } };

const ACCENT = '#C8102E';

/** Jeans: set the cut line. Tops: move everything on the body below the line up to it. */
function cutTo(g: Garment, y: number) {
  if (g.type === 'top') {
    const yy = Math.max(150, y);
    g.points.forEach((p) => {
      if (!p.r && p.key !== 'neckF' && p.y > yy) p.y = yy;
    });
    return;
  }
  g.cropY = Math.min(GARMENT_H, Math.max(MIN_CROP_Y, y));
}

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
  const selectedNote = useStore((s) => s.selectedNote);
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
  const onBody = tab === 'sketch' || tab === 'draw';
  const cq = getCroquis(doc.base.sex, doc.base.view);
  const rig = onBody ? poseRig(doc.base.sex, doc.base.pose, cq.waistY, cq.hemY) : IDENTITY_RIG;
  const body = bodyProfile(doc.base.sex, doc.base.pose);
  const sag = doc.base.view === 'front' ? 6 : 3;
  const fitOf = (g: Garment) => fitGarment(g, rig, body, sag);
  const torso = torsoProfile(doc.base.sex, onBody ? doc.base.pose : 'stand');
  const garmentById = (id: string | null): Garment | undefined => doc.garments.find((g) => g.id === id);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  /** Pointer to garment space, undoing the pose and the garment transform (tops: body space). */
  const local = (gid: string, e: { clientX: number; clientY: number }, region?: Pt['r']) => {
    const g = garmentById(gid) ?? useStore.getState().doc.garments.find((x) => x.id === gid);
    if (g?.type === 'top') {
      const p = topInverse(torso, world(e), region, stiffOf(g.top));
      return { x: r1(p.x), y: r1(p.y) };
    }
    const q = poseUnwarp(rig, world(e));
    if (!g) return q;
    const t = g.transform;
    return { x: Math.round(((q.x - t.x) / t.scale) * 10) / 10, y: Math.round(((q.y - t.y) / t.scale) * 10) / 10 };
  };
  /** Posed garments are drawn through <use>, so work out what was hit from the data. */
  const posedHit = (g: Garment, at: { x: number; y: number }): { kind: string; idx: number } => {
    for (let i = g.texts.length - 1; i >= 0; i--) {
      const x = g.texts[i];
      if (Math.abs(at.x - x.x) < x.size * 0.36 * Math.max(1, x.t.length) && Math.abs(at.y - (x.y - x.size * 0.35)) < x.size * 0.7) return { kind: 'text', idx: i };
    }
    for (let i = g.holes.length - 1; i >= 0; i--) {
      const h = g.holes[i];
      if (Math.hypot(at.x - h.x, at.y - h.y) < h.r + 2) return { kind: 'hole', idx: i };
    }
    for (let i = g.distress.length - 1; i >= 0; i--) {
      const d = g.distress[i];
      if (Math.hypot(at.x - d.x, at.y - d.y) < 12) return { kind: 'dist', idx: i };
    }
    return { kind: 'garment', idx: -1 };
  };

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
    let kind = hit?.getAttribute('data-kind') ?? null;
    const gid = hit?.getAttribute('data-gid') ?? null;
    let idx = Number(hit?.getAttribute('data-i') ?? -1);
    if (kind === 'posed' && gid) {
      const pg = garmentById(gid);
      const r = pg ? posedHit(pg, local(gid, e)) : { kind: 'garment', idx: -1 };
      kind = r.kind;
      idx = r.idx;
    }
    const t = st.tool;

    // notes and their arrow tips
    if (kind === 'tip') {
      drag.current = { type: 'tip', id: hit?.getAttribute('data-id') ?? '', started: false };
      return;
    }
    if (kind === 'note') {
      const id = hit?.getAttribute('data-id') ?? '';
      if (t === 'erase') {
        st.removeNote(id);
      } else {
        st.selectNote(id);
        if (t === 'move' || t === 'note') drag.current = { type: 'note', id, last: world(e), started: false };
      }
      return;
    }
    if (t === 'note') {
      if (kind !== 'garment') {
        const w = world(e);
        st.addNote(w.x, w.y);
      }
      return;
    }

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
        st.selectNote(null);
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
      let index: number, np: Pt;
      if (sel.type === 'top') {
        // find the nearest edge on the canvas, then put the new point in that edge's space
        const fw = sel.points.map((p) => topForward(torso, p, stiffOf(sel.top)));
        const near = nearestSegment(fw, world(e));
        index = near.index;
        const a = sel.points[(index - 1 + sel.points.length) % sel.points.length], b = sel.points[index % sel.points.length];
        const region = a.r && a.r === b.r ? a.r : undefined;
        const q = topInverse(torso, near.point, region, stiffOf(sel.top));
        np = { x: r1(q.x), y: r1(q.y), ...(region ? { r: region } : {}) };
      } else {
        const near = nearestSegment(sel.points, local(sel.id, e));
        index = near.index;
        np = { x: near.point.x, y: near.point.y };
      }
      st.checkpoint();
      st.edit(sel.id, (g) => {
        g.points.splice(index, 0, np);
      });
      drag.current = { type: 'pt', gid: sel.id, i: index, started: true };
      return;
    }

    const onSel = gid === sel.id; // pointer landed on the selected garment itself
    if (!onSel) return;
    const at = local(sel.id, e);

    if (t === 'cut') {
      st.checkpoint();
      st.edit(sel.id, (g) => cutTo(g, at.y));
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
      const at = local(d.gid, e, garmentById(d.gid)?.points[d.i]?.r);
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
      if (garmentById(d.gid)?.type === 'top') return; // tops ride the body
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
    } else if (d.type === 'note') {
      const w = world(e);
      const dx = w.x - d.last.x, dy = w.y - d.last.y;
      if (!d.started) {
        if (Math.hypot(dx, dy) < 3) return;
        st.checkpoint();
        d.started = true;
      }
      d.last = w;
      st.editNote(d.id, (n) => {
        n.x += dx;
        n.y += dy;
        n.tx += dx;
        n.ty += dy;
      });
    } else if (d.type === 'tip') {
      const w = world(e);
      if (!d.started) {
        st.checkpoint();
        d.started = true;
      }
      st.editNote(d.id, (n) => {
        n.tx = w.x;
        n.ty = w.y;
      });
    } else if (d.type === 'cut') {
      const at = local(d.gid, e);
      st.edit(d.gid, (g) => cutTo(g, at.y));
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

  const rendered = doc.settings.render === 'rendered';
  const sel = garmentById(selectedId);
  const showHandles = tab !== 'draw' && !!sel && sel.visible && (tool === 'move' || tool === 'add' || tool === 'erase');
  const handleR = 6 / view.k;
  const selFit = showHandles && sel && sel.type !== 'top' ? fitOf(sel) : null;
  // where each forearm can come forward: outside the torso, below the lowest sleeve on that side
  const armFront = ([0, 1] as const).map((s) => {
    let yLim = torso.armpit[s].y + 4;
    for (const g of doc.garments) {
      if (!g.visible || g.type !== 'top') continue;
      const K = s === 0 ? 'L' : 'R';
      const ends = g.points.filter((p) => p.key === `slO${K}` || p.key === `slI${K}` || p.key === `arm${K}`);
      for (const p of ends) yLim = Math.max(yLim, topForward(torso, p, stiffOf(g.top)).y + 3);
    }
    const side = torso.sides[s];
    const sx = (y: number) => {
      if (y <= side[0].y) return side[0].x;
      for (let i = 0; i < side.length - 1; i++) if (y <= side[i + 1].y) return side[i].x + ((y - side[i].y) / (side[i + 1].y - side[i].y || 1)) * (side[i + 1].x - side[i].x);
      return side[side.length - 1].x;
    };
    const pts: string[] = [];
    for (let y = yLim; y <= 1000; y += 6) pts.push(`${(sx(y) + (s === 0 ? -1 : 1)).toFixed(1)},${y.toFixed(1)}`);
    const edge = s === 0 ? 0 : 600;
    return `M${edge},${yLim} L${pts.join(' L')} L${edge},1000 Z`;
  });
  const selTop = showHandles && sel && sel.type === 'top' ? topShape(torso, sel.points, stiffOf(sel.top)) : null;
  // tucked tops go under everything else
  const ordered = [...doc.garments.filter((g) => g.type === 'top' && g.top?.tuck), ...doc.garments.filter((g) => !(g.type === 'top' && g.top?.tuck))];

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
        <g opacity={tab === 'draw' ? (doc.drawing.showRef ? doc.drawing.refOpacity : 0) : 1}>
        {onBody && (
          <g id="croquis-art">
            <CroquisView sex={doc.base.sex} view={doc.base.view} pose={doc.base.pose} rendered={rendered} skin={doc.base.skin} />
          </g>
        )}
        {ordered.map((g) => {
          if (!g.visible) return null;
          if (g.type === 'top') {
            return (
              <TopView key={g.id} g={g} t={torso} rendered={rendered} shading={doc.settings.shading} selectedText={g.id === selectedId ? selectedText : null} bust={doc.base.sex === 'female'} />
            );
          }
          const fit = fitOf(g);
          const common = {
            selectedText: g.id === selectedId ? selectedText : null,
            showCut: g.id === selectedId && rig.identity,
            rendered,
            shading: doc.settings.shading,
            sag: rig.identity ? 0 : sag,
            bandInset: fit.bandInset,
          };
          if (fit.layers) {
            return (
              <g key={g.id}>
                <GarmentView g={fit.layers.back.g} edge={fit.layers.back.edge} legOnly dim layer="-back" {...common} />
                <GarmentView g={fit.layers.front.g} edge={fit.layers.front.edge} {...common} />
              </g>
            );
          }
          return <GarmentView key={g.id} g={fit.g} {...common} />;
        })}
        {/* arms hang in front of the clothes: redraw the forearms and hands over the garments, below any sleeve */}
        {onBody && doc.garments.some((g) => g.visible) && (
          <>
            <defs>
              <filter id="cast-blur" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur stdDeviation={2} />
              </filter>
              <clipPath id="arms-front">
                {armFront.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </clipPath>
            </defs>
            <use href="#croquis-art" clipPath="url(#arms-front)" pointerEvents="none" />
            {/* garments cast soft shadows on what is underneath: the arm below each sleeve, the body or jeans below the hem */}
            {rendered && (
              <g pointerEvents="none" fill="none" stroke="#000" strokeLinecap="round" filter="url(#cast-blur)">
                {doc.garments
                  .filter((g) => g.visible && g.type === 'top')
                  .map((g) => {
                    const sh = topShape(torso, g.points, stiffOf(g.top));
                    return sh.hems.map((h, i) => (
                      <path key={`${g.id}${i}`} d={'M' + h.map((p) => `${p.x.toFixed(1)},${(p.y + 3).toFixed(1)}`).join(' L')} strokeWidth={3} opacity={0.12} />
                    ));
                  })}
              </g>
            )}
          </>
        )}
        {doc.notes.map((n) => {
          const { arrow, head } = notePaths(n);
          const on = n.id === selectedNote;
          return (
            <g key={n.id}>
              <path d={arrow} fill="none" stroke="#2B2B2B" strokeWidth={1.2} strokeLinecap="round" pointerEvents="none" />
              <path d={head} fill="none" stroke="#2B2B2B" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
              <text
                x={n.x}
                y={n.y}
                fontFamily="Caveat, cursive"
                fontWeight={700}
                fontSize={30}
                fill="#2B2B2B"
                stroke={on ? ACCENT : 'none'}
                strokeWidth={on ? 0.8 : 0}
                paintOrder="stroke"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                data-kind="note"
                data-id={n.id}
              >
                {n.text}
              </text>
              {on && <circle cx={n.tx} cy={n.ty} r={handleR * 1.4} fill={ACCENT} stroke="#fff" strokeWidth={1.2 / view.k} data-kind="tip" data-id={n.id} style={{ cursor: 'grab' }} />}
            </g>
          );
        })}
        {showHandles && sel && (
          <g>
            {sel.points.map((p0, i) => {
              let x: number, y: number;
              let p = p0;
              if (selTop) {
                const c: Vec = selTop.outline[selTop.index[i]] ?? topForward(torso, p0, stiffOf(sel.top));
                x = c.x;
                y = c.y;
              } else {
                const fit = selFit ?? fitOf(sel);
                p = fit.g.points[fit.index[i]] ?? p0;
                const t = sel.transform;
                x = t.x + p.x * t.scale;
                y = t.y + p.y * t.scale;
              }
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
      </g>
    </svg>
  );
}
