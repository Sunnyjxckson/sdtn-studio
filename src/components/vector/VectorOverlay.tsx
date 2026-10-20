// Vector mode interaction layer: hit shapes, selection decorations, tool previews, pan and zoom.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../../store';
import {
  dimGeom,
  findItem,
  hasIn,
  hasOut,
  isEditable,
  itemBox,
  matStr,
  orderedSelection,
  pathD,
  repeatMats,
  textCorners,
  type VectorDoc,
  type VItem,
  type VLayer,
} from '../../model/vector';
import { clientToLocal } from '../../svgCoords';
import { MAX_ZOOM, MIN_ZOOM, zoomBy } from '../../viewport';
import { setToolCtx } from '../../vector/commands';
import { selectedItems } from '../../vector/edit';
import { getGuides, onGuides, setGuides, snapPoint } from '../../vector/snap';
import { toolById } from '../../vector/tools';
import type { BoxHandle, Hit, PtrEvt, ToolCtx } from '../../vector/tools/types';
import { setOverlayEl } from '../../vector/view';

const HANDLES: BoxHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS: Record<BoxHandle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

/** Invisible shapes the pointer hits. Each carries the leaf id; top is the top level item. */
function HitShape({ it, top, k }: { it: VItem; top: string; k: number }): ReactNode {
  if (it.hidden || it.locked) return null;
  const common = { 'data-h': 'item', 'data-id': it.id, 'data-top': top } as Record<string, string>;
  const fat = Math.max(8 / k, 0);
  if (it.kind === 'path') {
    const filled = !!it.style.fill;
    const closed = it.subs.some((s) => s.closed);
    return (
      <path
        d={pathD(it)}
        fill={filled && closed ? 'transparent' : 'none'}
        fillRule={it.style.fillRule}
        stroke="transparent"
        strokeWidth={Math.max(fat, it.style.stroke ? it.style.width : 0)}
        pointerEvents={filled ? 'all' : 'stroke'}
        {...common}
      />
    );
  }
  if (it.kind === 'text') return <polygon points={textCorners(it).map((p) => `${p.x},${p.y}`).join(' ')} fill="transparent" {...common} />;
  if (it.kind === 'dim') {
    const g = dimGeom(it);
    return <path d={`M${it.ax},${it.ay} L${g.a.x},${g.a.y} L${g.b.x},${g.b.y} L${it.bx},${it.by}`} fill="none" stroke="transparent" strokeWidth={fat * 1.5} pointerEvents="stroke" {...common} />;
  }
  const kids = it.children.map((c) => <HitShape key={c.id} it={c} top={top} k={k} />);
  if (!it.repeat) return <g>{kids}</g>;
  return (
    <g>
      {kids}
      {repeatMats(it.repeat).map((m, i) => (
        <g key={i} transform={matStr(m)}>
          {it.children.map((c) => (
            <HitShape key={c.id} it={c} top={top} k={k} />
          ))}
        </g>
      ))}
    </g>
  );
}

function HitLayer({ layers, k }: { layers: VLayer[]; k: number }) {
  return (
    <g>
      {layers.map((l) =>
        l.visible && !l.locked ? (
          <g key={l.id}>
            {l.items.map((it) => (
              <HitShape key={it.id} it={it} top={it.id} k={k} />
            ))}
          </g>
        ) : null,
      )}
    </g>
  );
}

/** Outline of a selected item, drawn in its layer color. */
function Outline({ it, color, k }: { it: VItem; color: string; k: number }): ReactNode {
  const w = 1 / k;
  if (it.kind === 'path') return <path d={pathD(it)} fill="none" stroke={color} strokeWidth={w} />;
  if (it.kind === 'text') return <polygon points={textCorners(it).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={w} />;
  if (it.kind === 'dim') return <path d={`M${it.ax},${it.ay} L${it.bx},${it.by}`} fill="none" stroke={color} strokeWidth={w} strokeDasharray={`${3 / k} ${3 / k}`} />;
  return (
    <g>
      {it.children.map((c) => (
        <Outline key={c.id} it={c} color={color} k={k} />
      ))}
    </g>
  );
}

function BoxDecor({ k }: { k: number }) {
  const v = useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const items = useMemo(() => {
    const out: { it: VItem; color: string }[] = [];
    for (const id of orderedSelection(v, sel)) {
      const f = findItem(v, id);
      if (f && isEditable(f)) out.push({ it: f.item, color: f.layer.color });
    }
    return out;
  }, [v, sel]);
  if (!items.length) return null;
  let b = itemBox(items[0].it);
  for (const x of items.slice(1)) {
    const c = itemBox(x.it);
    if (!c) continue;
    if (!b) b = c;
    else {
      const x0 = Math.min(b.x, c.x), y0 = Math.min(b.y, c.y);
      b = { x: x0, y: y0, w: Math.max(b.x + b.w, c.x + c.w) - x0, h: Math.max(b.y + b.h, c.y + c.h) - y0 };
    }
  }
  const color = items[0].color;
  const hs = 7 / k;
  return (
    <g>
      {items.map(({ it, color: c }) => (
        <Outline key={it.id} it={it} color={c} k={k} />
      ))}
      {b && (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={color} strokeWidth={1 / k} pointerEvents="none" />
          {HANDLES.map((h) => {
            const x = h.includes('w') ? b!.x : h.includes('e') ? b!.x + b!.w : b!.x + b!.w / 2;
            const y = h.includes('n') ? b!.y : h.includes('s') ? b!.y + b!.h : b!.y + b!.h / 2;
            if (h.length === 1 && ((h === 'n' || h === 's') ? b!.w * k < 24 : b!.h * k < 24)) return null;
            return (
              <Fragment key={h}>
                {h.length === 2 && (
                  <circle cx={x + (h.includes('w') ? -1 : 1) * 9 / k} cy={y + (h.includes('n') ? -1 : 1) * 9 / k} r={11 / k} fill="transparent" data-h="rotate" data-b={h} style={{ cursor: 'alias' }} />
                )}
                <rect x={x - hs / 2} y={y - hs / 2} width={hs} height={hs} fill="#fff" stroke={color} strokeWidth={1 / k} data-h="box" data-b={h} style={{ cursor: CURSORS[h] }} />
              </Fragment>
            );
          })}
        </g>
      )}
    </g>
  );
}

function NodeDecor({ k }: { k: number }) {
  const v = useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const nodes = useStore((s) => s.vnodes);
  const items = useMemo(() => selectedItems(v, sel), [v, sel]);
  const on = new Set(nodes.map((n) => `${n.id}:${n.s}:${n.i}`));
  const out: ReactNode[] = [];
  const s = 6 / k;
  const paths = items.flatMap(function flat(it: VItem): VItem[] {
    return it.kind === 'group' ? it.children.flatMap(flat) : [it];
  });
  for (const it of paths) {
    const color = findItem(v, it.id)?.layer.color ?? '#4F8DF7';
    if (it.kind !== 'path') {
      out.push(<Outline key={it.id} it={it} color={color} k={k} />);
      continue;
    }
    out.push(<path key={it.id + 'o'} d={pathD(it)} fill="none" stroke={color} strokeWidth={1 / k} pointerEvents="none" />);
    it.subs.forEach((sub, si) =>
      sub.nodes.forEach((n, i) => {
        const key = `${it.id}:${si}:${i}`;
        const selNode = on.has(key);
        // handles show on selected anchors and their neighbors, like Illustrator
        const near = selNode || on.has(`${it.id}:${si}:${i - 1}`) || on.has(`${it.id}:${si}:${i + 1}`) || (sub.closed && (on.has(`${it.id}:${si}:${(i + 1) % sub.nodes.length}`) || on.has(`${it.id}:${si}:${(i - 1 + sub.nodes.length) % sub.nodes.length}`)));
        if (near) {
          for (const side of ['in', 'out'] as const) {
            const has = side === 'in' ? hasIn(n) : hasOut(n);
            if (!has) continue;
            const hx = side === 'in' ? n.ix : n.ox, hy = side === 'in' ? n.iy : n.oy;
            out.push(
              <g key={key + side}>
                <line x1={n.x} y1={n.y} x2={hx} y2={hy} stroke={color} strokeWidth={1 / k} pointerEvents="none" />
                <circle cx={hx} cy={hy} r={3.2 / k} fill={color} stroke="#fff" strokeWidth={0.8 / k} pointerEvents="none" />
                <circle cx={hx} cy={hy} r={8 / k} fill="transparent" data-h="handle" data-id={it.id} data-s={si} data-i={i} data-side={side} style={{ cursor: 'move' }} />
              </g>,
            );
          }
        }
        out.push(
          <g key={key}>
            <rect x={n.x - s / 2} y={n.y - s / 2} width={s} height={s} fill={selNode ? color : '#fff'} stroke={color} strokeWidth={1 / k} pointerEvents="none" />
            <circle cx={n.x} cy={n.y} r={8 / k} fill="transparent" data-h="node" data-id={it.id} data-s={si} data-i={i} style={{ cursor: 'default' }} />
          </g>,
        );
      }),
    );
  }
  return <g>{out}</g>;
}

function Guides({ k }: { k: number }) {
  const [, force] = useState(0);
  useEffect(() => onGuides(() => force((n) => n + 1)), []);
  return (
    <g pointerEvents="none">
      {getGuides().map((g, i) => (
        <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#E54D9E" strokeWidth={1 / k} />
      ))}
    </g>
  );
}

function Grid({ v, k }: { v: VectorDoc; k: number }) {
  if (!v.grid) return null;
  const s = v.gridSize;
  const id = 'vgrid';
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
          <path d={`M${s},0 L0,0 L0,${s}`} fill="none" stroke="rgba(79,141,247,0.25)" strokeWidth={0.6 / k} />
        </pattern>
      </defs>
      <rect x={0} y={20} width={600} height={980} fill={`url(#${id})`} />
    </g>
  );
}

function readHit(el: Element | null): Hit {
  const t = el?.closest('[data-h]');
  if (!t) return null;
  const kind = t.getAttribute('data-h');
  const id = t.getAttribute('data-id') ?? '';
  const s = Number(t.getAttribute('data-s') ?? 0);
  const i = Number(t.getAttribute('data-i') ?? 0);
  if (kind === 'item') return { kind: 'item', id, top: t.getAttribute('data-top') ?? id };
  if (kind === 'node') return { kind: 'node', id, s, i };
  if (kind === 'handle') return { kind: 'handle', id, s, i, side: t.getAttribute('data-side') === 'in' ? 'in' : 'out' };
  if (kind === 'box') return { kind: 'box', h: t.getAttribute('data-b') as BoxHandle };
  if (kind === 'rotate') return { kind: 'rotate', h: t.getAttribute('data-b') as BoxHandle };
  return null;
}

export function VectorOverlay() {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const view = useStore((s) => s.view);
  const vtool = useStore((s) => s.vtool);
  const v = useStore((s) => s.doc.vector);
  const [preview, setPreview] = useState<ReactNode>(null);
  const [toast, setToastMsg] = useState<string | null>(null);
  const [cursorOverride, setCursorOverride] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const down = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; cx: number; cy: number; view: { x: number; y: number; k: number } } | null>(null);
  const tool = toolById(vtool);
  const k = view.k;

  const ctx = useMemo<ToolCtx>(
    () => ({
      get k() {
        return useStore.getState().view.k;
      },
      setPreview,
      snap: (p, exclude) => {
        const st = useStore.getState();
        const vd = st.doc.vector;
        return snapPoint(vd, p, { grid: vd.grid, gridSize: vd.gridSize, snap: vd.snap, smart: vd.smartGuides, tol: 6 / st.view.k }, exclude ?? st.vsel);
      },
      hitAt: (cx, cy) => readHit(document.elementFromPoint(cx, cy)),
      toast: (m) => setToastMsg(m),
      setCursor: setCursorOverride,
    }),
    [],
  );

  useEffect(() => {
    setToolCtx(ctx);
    setOverlayEl(svgRef.current);
    return () => {
      setToolCtx(null);
      setOverlayEl(null);
    };
  }, [ctx]);

  // leaving a tool ends whatever it was doing
  const prevTool = useRef(tool);
  useEffect(() => {
    if (prevTool.current !== tool) prevTool.current.cancel?.(ctx);
    prevTool.current = tool;
    setCursorOverride(null);
    setPreview(null);
  }, [tool, ctx]);
  useEffect(() => () => toolById(useStore.getState().vtool).cancel?.(ctx), [ctx]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToastMsg(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

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
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  const toEvt = (e: React.PointerEvent): PtrEvt => {
    const raw = clientToLocal(worldRef.current, e.clientX, e.clientY);
    const p = tool.snaps === false || e.ctrlKey ? raw : ctx.snap(raw);
    return {
      x: p.x,
      y: p.y,
      rx: raw.x,
      ry: raw.y,
      shift: e.shiftKey,
      alt: e.altKey,
      mod: e.metaKey || e.ctrlKey,
      pressure: e.pressure || 0.5,
      pointerType: e.pointerType,
      clientX: e.clientX,
      clientY: e.clientY,
      clicks: e.detail,
    };
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // fine
    }
    if (pointers.current.size === 2) {
      // second finger: stop the tool and pinch zoom instead
      if (down.current) tool.up?.(toEvt(e), ctx);
      down.current = false;
      const [a, b] = [...pointers.current.values()];
      const r = svgRef.current!.getBoundingClientRect();
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, view: { ...useStore.getState().view } };
      return;
    }
    if (e.button === 1 || space || tool.id === 'hand') {
      e.preventDefault();
      const st = useStore.getState();
      pan.current = { sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y };
      setPanning(true);
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    down.current = true;
    tool.down?.(toEvt(e), readHit(e.target as Element), ctx);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const r = svgRef.current!.getBoundingClientRect();
      const p = pinch.current;
      const nk = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (p.view.k * Math.hypot(a.x - b.x, a.y - b.y)) / (p.d || 1)));
      const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
      const wx = (p.cx - p.view.x) / p.view.k, wy = (p.cy - p.view.y) / p.view.k;
      useStore.getState().setView({ k: nk, x: cx - wx * nk, y: cy - wy * nk });
      return;
    }
    if (pan.current) {
      const p = pan.current;
      const st = useStore.getState();
      st.setView({ ...st.view, x: p.vx + e.clientX - p.sx, y: p.vy + e.clientY - p.sy });
      return;
    }
    if (down.current) tool.move?.(toEvt(e), ctx);
    else if (e.pointerType !== 'touch') tool.hover?.(toEvt(e), readHit(e.target as Element), ctx);
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    if (pan.current) {
      pan.current = null;
      setPanning(false);
      return;
    }
    if (!down.current) return;
    down.current = false;
    tool.up?.(toEvt(e), ctx);
    setGuides([]);
  };

  const decor = tool.decor ?? 'box';
  const cursor = panning ? 'grabbing' : space ? 'grab' : cursorOverride ?? tool.cursor ?? 'default';

  return (
    <svg
      ref={svgRef}
      className="vectoroverlay"
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="vector-overlay"
    >
      <g ref={worldRef} transform={`translate(${view.x} ${view.y}) scale(${k})`}>
        <Grid v={v} k={k} />
        <HitLayer layers={v.layers} k={k} />
        {decor === 'box' && <BoxDecor k={k} />}
        {decor === 'nodes' && <NodeDecor k={k} />}
        <Guides k={k} />
        <g pointerEvents="none">{preview}</g>
      </g>
      {toast && (
        <foreignObject x="0" y="0" width="100%" height="40" pointerEvents="none">
          <div className="drawtoast">{toast}</div>
        </foreignObject>
      )}
    </svg>
  );
}
