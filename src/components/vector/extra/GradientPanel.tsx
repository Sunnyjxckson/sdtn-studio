// Edit the gradient of the fill or stroke, or turn a solid fill into one.
import { useRef, useState } from 'react';
import { useStore } from '../../../store';
import type { VPaint, VStop, VStyle } from '../../../model/vector';
import { editStyle } from '../../../vector/edit';
import { NumField, paintColor, Section, useShownStyle } from '../VectorPanels';

type Target = 'fill' | 'stroke';
type Grad = Exclude<VPaint, { kind: 'solid' }>;

const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const angleOf = (g: Grad) => (Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180) / Math.PI;

function edit(target: Target, fn: (g: Grad) => void, key?: string) {
  editStyle((x) => {
    const p = (x as VStyle)[target];
    if (p && p.kind !== 'solid') fn(p);
  }, key);
}

function interpolate(stops: VStop[], o: number): VStop {
  const s = [...stops].sort((a, b) => a.o - b.o);
  const lo = [...s].reverse().find((t) => t.o <= o) ?? s[0];
  const hi = s.find((t) => t.o >= o) ?? s[s.length - 1];
  return { o, color: o - lo.o <= hi.o - o ? lo.color : hi.color, a: (lo.a + hi.a) / 2 };
}

function Bar({ g, target, sel, setSel }: { g: Grad; target: Target; sel: number; setSel: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const sorted = [...g.stops].sort((a, b) => a.o - b.o);
  const css = `linear-gradient(90deg, ${sorted.map((s) => `${s.color} ${Math.round(s.o * 100)}%`).join(', ')})`;
  const posOf = (e: { clientX: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  const drag = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSel(i);
    const key = `gstop-${Date.now()}-${i}`;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const o = Math.round(posOf(ev) * 1000) / 1000;
      edit(target, (gg) => void (gg.stops[i].o = o), key);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const add = (e: React.MouseEvent) => {
    const o = Math.round(posOf(e) * 1000) / 1000;
    const stop = interpolate(g.stops, o);
    edit(target, (gg) => void gg.stops.push(stop));
    setSel(g.stops.length);
  };
  return (
    <div style={{ padding: '2px 6px 14px' }}>
      <div
        ref={ref}
        data-testid="grad-bar"
        onClick={add}
        title="Click to add a stop"
        style={{ position: 'relative', height: 22, borderRadius: 4, border: '1px solid var(--line2)', background: `${css}, repeating-conic-gradient(#999 0 25%, #ccc 0 50%) 0 0 / 8px 8px`, cursor: 'copy' }}
      >
        {g.stops.map((s, i) => (
          <div
            key={i}
            data-testid="grad-stop"
            onPointerDown={(e) => drag(i, e)}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${s.o * 100}%`,
              top: 14,
              width: 12,
              height: 16,
              marginLeft: -6,
              background: s.color,
              border: `2px solid ${i === sel ? 'var(--accent)' : 'var(--text)'}`,
              borderRadius: 3,
              cursor: 'ew-resize',
              touchAction: 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function GradientPanel() {
  const s = useShownStyle();
  const hasSel = useStore((st) => st.vsel.length > 0);
  const [target, setTarget] = useState<Target>('fill');
  const [selStop, setSelStop] = useState(0);
  const other: Target = target === 'fill' ? 'stroke' : 'fill';
  const isGrad = (p: VPaint | null) => !!p && p.kind !== 'solid';
  const tgt: Target = isGrad(s[target]) ? target : isGrad(s[other]) ? other : target;
  const paint = s[tgt];
  const g = paint && paint.kind !== 'solid' ? paint : null;

  if (!g) {
    if (!hasSel) return null;
    const c = paintColor(paint);
    return (
      <Section label="GRADIENT">
        <div className="vrow2">
          <div className="tabs small-tabs" role="group" aria-label="Gradient target">
            {(['fill', 'stroke'] as Target[]).map((t) => (
              <button key={t} className={tgt === t ? 'tab on' : 'tab'} onClick={() => setTarget(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button
            className="opt"
            disabled={!c}
            onClick={() => {
              const col = c ?? '#000000';
              editStyle((x) => void ((x as VStyle)[tgt] = { kind: 'linear', x1: 0, y1: 0.5, x2: 1, y2: 0.5, stops: [{ o: 0, color: col, a: 1 }, { o: 1, color: '#FFFFFF', a: 1 }] }));
              setSelStop(0);
            }}
          >
            Gradient {tgt}
          </button>
        </div>
      </Section>
    );
  }

  const i = Math.min(selStop, g.stops.length - 1);
  const st = g.stops[i];
  const angle = Math.round(angleOf(g));
  const setAngle = (deg: number) => {
    const d = ((deg - angleOf(g)) * Math.PI) / 180;
    const c = Math.cos(d), n = Math.sin(d);
    edit(tgt, (gg) => {
      const rot = (x: number, y: number): [number, number] => [0.5 + (x - 0.5) * c - (y - 0.5) * n, 0.5 + (x - 0.5) * n + (y - 0.5) * c];
      if (gg.kind === 'linear') {
        [gg.x1, gg.y1] = rot(gg.x1, gg.y1);
        [gg.x2, gg.y2] = rot(gg.x2, gg.y2);
      } else {
        // radial: swing the radius point around the center
        const [rx, ry] = rot(gg.x2 - gg.x1 + 0.5, gg.y2 - gg.y1 + 0.5);
        gg.x2 = gg.x1 + rx - 0.5;
        gg.y2 = gg.y1 + ry - 0.5;
      }
    }, 'gangle');
  };
  const setType = (k: 'linear' | 'radial') => {
    if (g.kind === k) return;
    const a = (angleOf(g) * Math.PI) / 180;
    edit(tgt, (gg) => {
      gg.kind = k;
      const r = 0.5;
      if (k === 'radial') {
        gg.x1 = 0.5;
        gg.y1 = 0.5;
        gg.x2 = 0.5 + r * Math.cos(a);
        gg.y2 = 0.5 + r * Math.sin(a);
      } else {
        gg.x1 = 0.5 - r * Math.cos(a);
        gg.y1 = 0.5 - r * Math.sin(a);
        gg.x2 = 0.5 + r * Math.cos(a);
        gg.y2 = 0.5 + r * Math.sin(a);
      }
    });
  };
  return (
    <Section label="GRADIENT">
      <div className="vrow2">
        <div className="tabs small-tabs" role="group" aria-label="Gradient target">
          {(['fill', 'stroke'] as Target[]).map((t) => (
            <button key={t} className={tgt === t ? 'tab on' : 'tab'} onClick={() => setTarget(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="tabs small-tabs" role="group" aria-label="Gradient type">
          {(['linear', 'radial'] as const).map((k) => (
            <button key={k} className={g.kind === k ? 'tab on' : 'tab'} onClick={() => setType(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <Bar g={g} target={tgt} sel={i} setSel={setSelStop} />
      <div className="vrow2">
        <label className="pswatch" style={{ background: st.color }} title="Stop color">
          <input type="color" value={st.color.length === 7 ? st.color : '#000000'} onChange={(e) => edit(tgt, (gg) => void (gg.stops[i].color = e.target.value.toUpperCase()), `gcol${i}`)} />
        </label>
        <NumField label="Opacity" value={Math.round(st.a * 100)} min={0} max={100} suffix="%" w={44} onChange={(n) => edit(tgt, (gg) => void (gg.stops[i].a = n / 100), `ga${i}`)} />
        <NumField label="At" value={Math.round(st.o * 100)} min={0} max={100} suffix="%" w={44} onChange={(n) => edit(tgt, (gg) => void (gg.stops[i].o = n / 100))} />
      </div>
      <div className="vrow2">
        <NumField label="Angle" value={angle} suffix="°" w={48} onChange={setAngle} />
        <button className="opt" disabled={g.stops.length <= 2} onClick={() => (edit(tgt, (gg) => void gg.stops.splice(i, 1)), setSelStop(0))}>
          Delete stop
        </button>
        <button className="opt" onClick={() => edit(tgt, (gg) => gg.stops.forEach((x) => void (x.o = 1 - x.o)))}>
          Reverse stops
        </button>
        <button className="opt" onClick={() => editStyle((x) => void ((x as VStyle)[tgt] = { kind: 'solid', color: g.stops[0]?.color ?? '#000000' }))}>
          To solid
        </button>
      </div>
    </Section>
  );
}
