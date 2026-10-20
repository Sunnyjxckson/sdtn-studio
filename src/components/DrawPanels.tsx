import { useEffect, useRef, useState } from 'react';
import { activeDrawLayer, canRedo, canUndo, toolBrush, useStore, type DrawTool, type PaintTool } from '../store';
import { BLENDS, BRUSHES, PALETTE, type BrushDef, type DrawLayer } from '../model/draw';
import { ARTBOARD } from '../model/croquis';
import { ctx2d, LH, LW, makeCanvas, renderStroke } from '../draw/engine';
import { flatten, layerCanvas, onLayersChange } from '../draw/layers';
import { fitToArtboard, zoomBy } from '../viewport';
import { Icon, type IconName } from './icons';

export const DRAW_TOOLS: { id: DrawTool; title: string; key: string; icon: IconName; help: string }[] = [
  { id: 'brush', title: 'Brush', key: 'B', icon: 'brush', help: 'Draw. Hold at the end of a stroke to snap a line or ellipse.' },
  { id: 'smudge', title: 'Smudge', key: 'S', icon: 'smudge', help: 'Drag to blend paint on the current layer.' },
  { id: 'erase', title: 'Eraser', key: 'E', icon: 'eraser', help: 'Erase on the current layer with any brush.' },
  { id: 'fill', title: 'Fill', key: 'G', icon: 'fill', help: 'Tap inside a closed shape to fill it. Mark a line layer as Reference to fill on another layer.' },
  { id: 'eyedrop', title: 'Eyedropper', key: 'I', icon: 'eyedrop', help: 'Tap or drag to pick a color from the drawing.' },
  { id: 'hand', title: 'Hand', key: 'H', icon: 'hand', help: 'Drag to pan. Two fingers pinch to zoom, tap with two to undo, three to redo.' },
];

const paintTool = (t: DrawTool): PaintTool => (t === 'smudge' || t === 'erase' ? t : 'brush');

export function DrawToolStrip() {
  const tool = useStore((s) => s.drawTool);
  const setTool = useStore((s) => s.setDrawTool);
  return (
    <nav className="toolstrip" aria-label="Draw tools">
      {DRAW_TOOLS.map((t) => (
        <button
          key={t.id}
          className={tool === t.id ? 'tool on' : 'tool'}
          title={`${t.title} (${t.key})`}
          aria-label={t.title}
          aria-pressed={tool === t.id}
          onClick={() => setTool(t.id)}
        >
          <Icon name={t.icon} />
        </button>
      ))}
    </nav>
  );
}

async function exportPng() {
  const st = useStore.getState();
  const d = st.doc.drawing;
  const out = makeCanvas();
  const x = ctx2d(out);
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, LW, LH);
  const svg = document.querySelector('.canvaswrap svg.canvas') as SVGSVGElement | null;
  if (svg) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute('style');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `${ARTBOARD.x} ${ARTBOARD.y} ${ARTBOARD.w} ${ARTBOARD.h}`);
    clone.setAttribute('width', String(LW));
    clone.setAttribute('height', String(LH));
    clone.querySelector(':scope > g')?.removeAttribute('transform');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('svg'));
        img.src = url;
      });
      x.drawImage(img, 0, 0, LW, LH);
    } catch {
      // drawing only if the base cannot be drawn
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  flatten(d.layers, x);
  out.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${st.doc.name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

export function DrawBar() {
  const tool = useStore((s) => s.drawTool);
  const prefs = useStore((s) => s.drawPrefs);
  const k = useStore((s) => s.view.k);
  const u = useStore(canUndo);
  const r = useStore(canRedo);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const cur = DRAW_TOOLS.find((t) => t.id === tool)!;
  const pt = tool === 'brush' || tool === 'erase' || tool === 'smudge' ? toolBrush(prefs, tool) : null;
  return (
    <div className="canvasbar">
      <span className="toolname">
        {cur.title} <span className="mono muted">{cur.key}</span>
      </span>
      {pt && <span className="small brushname">{pt.brush.name}</span>}
      <span className="muted small toolhelp">{cur.help}</span>
      <div className="barend">
        <button className="iconbtn" aria-label="Export PNG" title="Export PNG" onClick={() => void exportPng()}>
          <Icon name="download" size={16} />
        </button>
        <span className="sep" />
        <button className="iconbtn" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <Icon name="minus" size={16} />
        </button>
        <span className="mono small zoomval">{Math.round(k * 100)}%</span>
        <button className="iconbtn" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.25)}>
          <Icon name="plus" size={16} />
        </button>
        <button className="iconbtn" aria-label="Fit to screen" title="Fit to screen" onClick={() => fitToArtboard()}>
          <Icon name="fit" size={16} />
        </button>
        <span className="sep" />
        <button className="iconbtn" aria-label="Undo" title="Undo (Ctrl+Z, two finger tap)" disabled={!u} onClick={undo}>
          <Icon name="undo" size={18} />
        </button>
        <button className="iconbtn" aria-label="Redo" title="Redo (Shift+Ctrl+Z, three finger tap)" disabled={!r} onClick={redo}>
          <Icon name="redo" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Procreate style size and opacity sliders down the side of the canvas. */
export function SideSliders() {
  const tool = useStore((s) => s.drawTool);
  const prefs = useStore((s) => s.drawPrefs);
  const set = useStore((s) => s.setDrawPrefs);
  const t = paintTool(tool);
  const tb = toolBrush(prefs, t);
  // size slider is on a curve so small sizes get most of the travel
  const toS = (v: number) => Math.round(Math.pow(v / 1000, 2.2) * 120 * 10) / 10 || 0.5;
  const fromS = (s: number) => Math.round(Math.pow(s / 120, 1 / 2.2) * 1000);
  return (
    <div className="sidesliders">
      <label className="vslider" title={`Size ${tb.size}`}>
        <input
          type="range"
          min={60}
          max={1000}
          value={fromS(tb.size)}
          aria-label="Brush size"
          onChange={(e) => set((p) => void (p.size[tb.key] = Math.max(0.5, toS(Number(e.target.value)))))}
        />
      </label>
      <span className="mono vval">{tb.size}</span>
      <label className="vslider" title={`${t === 'smudge' ? 'Strength' : 'Opacity'} ${Math.round(tb.opacity * 100)}%`}>
        <input
          type="range"
          min={2}
          max={100}
          value={Math.round(tb.opacity * 100)}
          aria-label={t === 'smudge' ? 'Smudge strength' : 'Brush opacity'}
          onChange={(e) => set((p) => void (p.opacity[tb.key] = Number(e.target.value) / 100))}
        />
      </label>
      <span className="mono vval">{Math.round(tb.opacity * 100)}</span>
    </div>
  );
}

const previews = new Map<string, string>();
let previewCanvas: HTMLCanvasElement | null = null;
function brushPreview(b: BrushDef): string {
  const hit = previews.get(b.id);
  if (hit) return hit;
  const pts: number[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = ARTBOARD.x + 12 + t * 156;
    const y = ARTBOARD.y + 24 + Math.sin(t * Math.PI * 2) * 11;
    pts.push(x, y, 0.35 + 0.65 * Math.sin(t * Math.PI));
  }
  const size = Math.min(b.size, 14);
  const c = (previewCanvas ??= makeCanvas());
  const x = ctx2d(c);
  x.clearRect(0, 0, LW, LH);
  renderStroke(x, { kind: 'paint', brush: b.id, color: '#EDEAE3', size, opacity: 1, op: 'over', pts, seed: 7 });
  const small = makeCanvas(180 * 2, 48 * 2);
  ctx2d(small).drawImage(c, 0, 0, 360, 96, 0, 0, 360, 96);
  const url = small.toDataURL();
  previews.set(b.id, url);
  return url;
}

export function BrushPanel() {
  const tool = useStore((s) => s.drawTool);
  const prefs = useStore((s) => s.drawPrefs);
  const set = useStore((s) => s.setDrawPrefs);
  const setTool = useStore((s) => s.setDrawTool);
  const t = paintTool(tool);
  const sets = [...new Set(BRUSHES.map((b) => b.set))];
  const [, force] = useState(0);
  useEffect(() => {
    // previews need a canvas, so draw them after mount
    const id = requestAnimationFrame(() => {
      BRUSHES.forEach(brushPreview);
      force((n) => n + 1);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <aside className="panel left">
      <section className="group">
        <h3 className="label">BRUSHES {t === 'brush' ? '' : `FOR ${t === 'erase' ? 'ERASER' : 'SMUDGE'}`}</h3>
        {sets.map((s) => (
          <div key={s} className="brushset">
            <p className="hint">{s}</p>
            {BRUSHES.filter((b) => b.set === s).map((b) => (
              <button
                key={b.id}
                className={prefs.brush[t] === b.id ? 'brushrow on' : 'brushrow'}
                onClick={() => {
                  set((p) => void (p.brush[t] = b.id));
                  if (tool !== t) setTool(t);
                }}
              >
                <span className="brushlabel">{b.name}</span>
                {previews.has(b.id) && <img src={previews.get(b.id)} alt="" className="brushprev" />}
              </button>
            ))}
          </div>
        ))}
      </section>
      {tool === 'fill' && (
        <section className="group">
          <h3 className="label">FILL THRESHOLD</h3>
          <label className="range">
            <span>
              Threshold <span className="mono">{Math.round(prefs.fillTolerance * 100)}%</span>
            </span>
            <input type="range" min={2} max={80} value={Math.round(prefs.fillTolerance * 100)} onChange={(e) => set((p) => void (p.fillTolerance = Number(e.target.value) / 100))} />
          </label>
        </section>
      )}
    </aside>
  );
}

// ---------- color ----------
function hexToHsv(hex: string) {
  const n = parseInt(hex.slice(1), 16) || 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: ((h * 60) + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function drag(e: React.PointerEvent<HTMLDivElement>, fn: (fx: number, fy: number) => void) {
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  const go = (ev: { clientX: number; clientY: number }) => {
    const r = el.getBoundingClientRect();
    fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
  };
  go(e);
  const move = (ev: PointerEvent) => go(ev);
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function ColorPanel() {
  const color = useStore((s) => s.drawPrefs.color);
  const recent = useStore((s) => s.drawPrefs.recent);
  const set = useStore((s) => s.setDrawPrefs);
  // keep hue when the color goes gray
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  useEffect(() => {
    if (hsvToHex(hsv.h, hsv.s, hsv.v) !== color) setHsv((o) => {
      const n = hexToHsv(color);
      return n.s === 0 ? { ...n, h: o.h } : n;
    });
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    const hex = hsvToHex(h, s, v);
    set((p) => void (p.color = hex));
  };
  const [hexText, setHexText] = useState(color);
  useEffect(() => setHexText(color), [color]);
  return (
    <section className="group">
      <div className="titlerow">
        <h3 className="label">COLOR</h3>
        <span className="cur" style={{ background: color }} />
      </div>
      <div className="svbox" style={{ background: `hsl(${hsv.h} 100% 50%)` }} onPointerDown={(e) => drag(e, (fx, fy) => pick(hsv.h, fx, 1 - fy))}>
        <div className="svwhite" />
        <div className="svblack" />
        <div className="svdot" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: color }} />
      </div>
      <div className="huebar" onPointerDown={(e) => drag(e, (fx) => pick(fx * 359.9, hsv.s, hsv.v))}>
        <div className="huedot" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <input
        className="hexin mono"
        value={hexText}
        aria-label="Hex color"
        onChange={(e) => {
          setHexText(e.target.value);
          const v = e.target.value.trim();
          if (/^#?[0-9a-fA-F]{6}$/.test(v)) set((p) => void (p.color = (v.startsWith('#') ? v : '#' + v).toUpperCase()));
        }}
      />
      <div className="palette">
        {PALETTE.map((c) => (
          <button key={c} className={c === color ? 'sw on' : 'sw'} style={{ background: c }} aria-label={`Color ${c}`} title={c} onClick={() => set((p) => void (p.color = c))} />
        ))}
      </div>
      {recent.length > 0 && (
        <>
          <p className="hint">Recent</p>
          <div className="palette">
            {recent.map((c) => (
              <button key={c} className={c === color ? 'sw on' : 'sw'} style={{ background: c }} aria-label={`Color ${c}`} title={c} onClick={() => set((p) => void (p.color = c))} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ---------- layers ----------
function LayerThumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const x = c.getContext('2d')!;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(layerCanvas(id), 0, 0, c.width, c.height);
    };
    draw();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onLayersChange(() => {
      clearTimeout(t);
      t = setTimeout(draw, 120);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [id]);
  return <canvas ref={ref} width={36} height={Math.round((36 * ARTBOARD.h) / ARTBOARD.w)} className="thumb" />;
}

function LayerRow({ l, active, n }: { l: DrawLayer; active: boolean; n: number }) {
  const a = useStore.getState;
  const [naming, setNaming] = useState(false);
  return (
    <div className={active ? 'layer on' : 'layer'}>
      <button className="iconbtn sm" aria-label={l.visible ? 'Hide layer' : 'Show layer'} title={l.visible ? 'Hide' : 'Show'} onClick={() => a().setDrawLayer(l.id, { visible: !l.visible })}>
        <Icon name={l.visible ? 'eye' : 'eyeoff'} size={16} />
      </button>
      <button className="thumbbtn" onClick={() => a().setActiveLayer(l.id)} aria-label={`Select ${l.name}`}>
        <LayerThumb id={l.id} />
      </button>
      {naming ? (
        <input
          className="layerinput"
          autoFocus
          defaultValue={l.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== l.name) a().setDrawLayer(l.id, { name: v });
            setNaming(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <button className="layername" onClick={() => a().setActiveLayer(l.id)} onDoubleClick={() => setNaming(true)} style={{ opacity: l.visible ? 1 : 0.5 }} title="Double click to rename">
          <span className="mono muted">{n}</span> {l.name}
          {l.alphaLock && <span className="tag">α</span>}
          {l.reference && <span className="tag">REF</span>}
        </button>
      )}
    </div>
  );
}

function DrawLayersPanel() {
  const drawing = useStore((s) => s.doc.drawing);
  const active = useStore(activeDrawLayer);
  const a = useStore.getState;
  const rows = drawing.layers.map((l, i) => ({ l, n: i + 1, i })).reverse();
  const top = drawing.layers.length - 1;
  const ai = drawing.layers.findIndex((l) => l.id === active.id);
  return (
    <section className="group">
      <div className="titlerow">
        <h3 className="label">LAYERS</h3>
        <button className="iconbtn sm" aria-label="Add layer" title="Add layer" onClick={() => a().addDrawLayer()}>
          <Icon name="plus" size={18} />
        </button>
      </div>
      <div className="layers">
        {rows.map(({ l, n }) => (
          <LayerRow key={l.id} l={l} n={n} active={l.id === active.id} />
        ))}
        <div className="layer base">
          <button className="iconbtn sm" aria-label={drawing.showRef ? 'Hide base' : 'Show base'} title={drawing.showRef ? 'Hide' : 'Show'} onClick={() => a().setDrawing({ showRef: !drawing.showRef })}>
            <Icon name={drawing.showRef ? 'eye' : 'eyeoff'} size={16} />
          </button>
          <span className="layername muted">
            <span className="mono">0</span> Croquis and garments
          </span>
        </div>
      </div>
      {drawing.showRef && (
        <label className="range">
          <span>
            Base opacity <span className="mono">{Math.round(drawing.refOpacity * 100)}%</span>
          </span>
          <input type="range" min={5} max={100} value={Math.round(drawing.refOpacity * 100)} onChange={(e) => a().setDrawing({ refOpacity: Number(e.target.value) / 100 }, 'refop')} />
        </label>
      )}
      <div className="layeropts">
        <p className="hint">{active.name}</p>
        <label className="range">
          <span>
            Opacity <span className="mono">{Math.round(active.opacity * 100)}%</span>
          </span>
          <input type="range" min={0} max={100} value={Math.round(active.opacity * 100)} onChange={(e) => a().setDrawLayer(active.id, { opacity: Number(e.target.value) / 100 }, `lop:${active.id}`)} />
        </label>
        <div className="opts">
          {BLENDS.map((b) => (
            <button key={b} className={active.blend === b ? 'opt on' : 'opt'} onClick={() => a().setDrawLayer(active.id, { blend: b })}>
              {b[0].toUpperCase() + b.slice(1)}
            </button>
          ))}
        </div>
        <div className="opts">
          <button className={active.alphaLock ? 'opt on' : 'opt'} title="Paint only where this layer already has paint" onClick={() => a().setDrawLayer(active.id, { alphaLock: !active.alphaLock })}>
            Alpha lock
          </button>
          <button
            className={active.reference ? 'opt on' : 'opt'}
            title="Fill on any layer stops at this layer's lines"
            onClick={() => {
              const on = !active.reference;
              // only one reference layer at a time
              drawing.layers.forEach((l) => l.reference && l.id !== active.id && a().setDrawLayer(l.id, { reference: false }));
              a().setDrawLayer(active.id, { reference: on });
            }}
          >
            Reference
          </button>
        </div>
        <div className="layerbtns">
          <button className="iconbtn sm" aria-label="Move layer up" title="Move up" disabled={ai === top} onClick={() => a().moveDrawLayer(active.id, 1)}>
            <Icon name="up" size={16} />
          </button>
          <button className="iconbtn sm" aria-label="Move layer down" title="Move down" disabled={ai === 0} onClick={() => a().moveDrawLayer(active.id, -1)}>
            <Icon name="down" size={16} />
          </button>
          <button className="iconbtn sm" aria-label="Duplicate layer" title="Duplicate" onClick={() => a().duplicateDrawLayer(active.id)}>
            <Icon name="copy" size={16} />
          </button>
          <button className="iconbtn sm" aria-label="Clear layer" title="Clear" disabled={active.strokes.length === 0} onClick={() => a().clearDrawLayer(active.id)}>
            <Icon name="clear" size={16} />
          </button>
          <button className="iconbtn sm" aria-label="Delete layer" title="Delete" onClick={() => a().removeDrawLayer(active.id)}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

export function DrawRightPanel() {
  return (
    <aside className="panel right">
      <ColorPanel />
      <DrawLayersPanel />
    </aside>
  );
}
