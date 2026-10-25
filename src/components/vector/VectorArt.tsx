// Draws the vector document. Lives inside the main canvas SVG so it shares pan, zoom and export.
import { memo, type ReactNode } from 'react';
import { useStore } from '../../store';
import {
  dimGeom,
  matStr,
  pathD,
  repeatMats,
  textPaint,
  type VDim,
  type VItem,
  type VPaint,
  type VStyle,
} from '../../model/vector';
import { dimShape, isExtraDim } from '../../vector/dimShapes';
import { filterId, filterMarkup, hasEffects } from '../../vector/effects';

const gradId = (id: string, which: 'f' | 's') => `vg-${id}-${which}`;

function GradDef({ id, which, p }: { id: string; which: 'f' | 's'; p: VPaint | null }) {
  if (!p || p.kind === 'solid') return null;
  const stops = [...p.stops].sort((a, b) => a.o - b.o).map((s, i) => <stop key={i} offset={s.o} stopColor={s.color} stopOpacity={s.a} />);
  if (p.kind === 'linear') {
    return (
      <linearGradient id={gradId(id, which)} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}>
        {stops}
      </linearGradient>
    );
  }
  const r = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 0.5;
  return (
    <radialGradient id={gradId(id, which)} cx={p.x1} cy={p.y1} r={r} fx={p.x1} fy={p.y1}>
      {stops}
    </radialGradient>
  );
}

function FilterDef({ it }: { it: VItem }) {
  const m = filterMarkup(it);
  if (!m) return null;
  // the markup is built from numbers and validated colors only
  return <g dangerouslySetInnerHTML={{ __html: m }} />;
}

/** Every gradient used by an item tree, once. */
export function GradientDefs({ items }: { items: VItem[] }) {
  const out: ReactNode[] = [];
  const walk = (it: VItem) => {
    if (it.kind === 'group') return it.children.forEach(walk);
    if (hasEffects(it.style)) out.push(<FilterDef key={it.id + 'x'} it={it} />);
    if (it.style.fill && it.style.fill.kind !== 'solid') out.push(<GradDef key={it.id + 'f'} id={it.id} which="f" p={it.style.fill} />);
    if (it.style.stroke && it.style.stroke.kind !== 'solid') out.push(<GradDef key={it.id + 's'} id={it.id} which="s" p={it.style.stroke} />);
  };
  items.forEach(walk);
  return out.length ? <defs>{out}</defs> : null;
}

const paint = (id: string, which: 'f' | 's', p: VPaint | null) => (!p ? 'none' : p.kind === 'solid' ? p.color : `url(#${gradId(id, which)})`);

export function styleProps(id: string, s: VStyle) {
  return {
    filter: hasEffects(s) ? `url(#${filterId(id)})` : undefined,
    fill: paint(id, 'f', s.fill),
    fillRule: s.fillRule,
    stroke: paint(id, 's', s.stroke),
    strokeWidth: s.stroke ? s.width : 0,
    strokeDasharray: s.dash.length ? s.dash.join(' ') : undefined,
    strokeLinecap: s.cap,
    strokeLinejoin: s.join,
    opacity: s.opacity < 1 ? s.opacity : undefined,
    style: s.blend !== 'normal' ? { mixBlendMode: s.blend } : undefined,
  } as const;
}

function ExtraDimView({ d, copy }: { d: VDim; copy: string }) {
  const sh = dimShape(d);
  const col = textPaint(d.style.stroke);
  const w = d.style.width;
  return (
    <g key={copy} opacity={d.style.opacity < 1 ? d.style.opacity : undefined} fill="none" stroke={col}>
      {sh.parts.map((p, i) => (
        <path key={i} d={p.d} strokeWidth={w * p.w} opacity={p.faint ? 0.7 : undefined} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <text
        x={sh.label.x}
        y={sh.label.y}
        transform={`rotate(${sh.label.rot} ${sh.label.x} ${sh.label.y})`}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize={11}
        fill={col}
        stroke="#F4F2ED"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {sh.label.text}
      </text>
    </g>
  );
}

export function DimView({ d, copy = '' }: { d: VDim; copy?: string }) {
  if (isExtraDim(d)) return <ExtraDimView d={d} copy={copy} />;
  const g = dimGeom(d);
  const col = textPaint(d.style.stroke);
  const w = d.style.width;
  const tick = 5;
  const mx = (g.a.x + g.b.x) / 2, my = (g.a.y + g.b.y) / 2;
  let ang = g.angle;
  if (ang > 90 || ang < -90) ang += 180;
  const label = `${(Math.round(g.inches * 8) / 8).toFixed(g.inches % 1 ? 2 : 0).replace(/\.?0+$/, '')}"`;
  const ext = (x: number, y: number, ax: number, ay: number) => `M${ax},${ay} L${x + g.nx * Math.sign(d.off || 1) * 3},${y + g.ny * Math.sign(d.off || 1) * 3}`;
  return (
    <g key={copy} opacity={d.style.opacity < 1 ? d.style.opacity : undefined}>
      <path d={ext(g.a.x, g.a.y, d.ax, d.ay) + ' ' + ext(g.b.x, g.b.y, d.bx, d.by)} stroke={col} strokeWidth={w * 0.6} fill="none" opacity={0.7} />
      <path d={`M${g.a.x},${g.a.y} L${g.b.x},${g.b.y}`} stroke={col} strokeWidth={w} fill="none" />
      <path
        d={`M${g.a.x - g.nx * tick - g.ny * tick * 0.6},${g.a.y - g.ny * tick + g.nx * tick * 0.6} L${g.a.x + g.nx * tick + g.ny * tick * 0.6},${g.a.y + g.ny * tick - g.nx * tick * 0.6} M${g.b.x - g.nx * tick - g.ny * tick * 0.6},${g.b.y - g.ny * tick + g.nx * tick * 0.6} L${g.b.x + g.nx * tick + g.ny * tick * 0.6},${g.b.y + g.ny * tick - g.nx * tick * 0.6}`}
        stroke={col}
        strokeWidth={w}
        fill="none"
      />
      <text
        x={mx}
        y={my}
        transform={`rotate(${ang} ${mx} ${my}) translate(0 -4)`}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize={11}
        fill={col}
        stroke="#F4F2ED"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

export function ItemView({ it, copy = '' }: { it: VItem; copy?: string }): ReactNode {
  if (it.hidden) return null;
  if (it.kind === 'path') return <path d={pathD(it)} {...styleProps(it.id, it.style)} data-vid={copy ? undefined : it.id} />;
  if (it.kind === 'text') {
    return (
      <text
        x={it.x}
        y={it.y}
        transform={it.rot ? `rotate(${it.rot} ${it.x} ${it.y})` : undefined}
        fontFamily={it.font}
        fontWeight={it.weight}
        fontSize={it.size}
        letterSpacing={it.letter || undefined}
        textAnchor={it.anchor}
        {...styleProps(it.id, it.style)}
        style={{ ...(styleProps(it.id, it.style).style ?? {}), whiteSpace: 'pre' }}
        paintOrder="stroke"
      >
        {it.text}
      </text>
    );
  }
  if (it.kind === 'dim') return <DimView d={it} copy={copy} />;
  const kids = it.clip && it.children.length > 1 ? it.children.slice(1) : it.clip ? [] : it.children;
  const clipId = `vc-${it.id}${copy}`;
  const body = (
    <g clipPath={it.clip && it.children.length ? `url(#${clipId})` : undefined}>
      {kids.map((c) => (
        <ItemView key={c.id} it={c} copy={copy} />
      ))}
    </g>
  );
  const mask = it.clip && it.children[0] ? it.children[0] : null;
  const clipDef = mask ? (
    <defs>
      <clipPath id={clipId}>
        {mask.kind === 'path' ? <path d={pathD(mask)} clipRule={mask.style.fillRule} /> : <ItemView it={mask} copy={copy + 'm'} />}
      </clipPath>
    </defs>
  ) : null;
  // the clipping path keeps its stroke, like Illustrator
  const maskStroke = mask && mask.kind === 'path' && mask.style.stroke ? <path d={pathD(mask)} {...styleProps(mask.id, { ...mask.style, fill: null })} /> : null;
  const one = (
    <>
      {clipDef}
      {body}
      {maskStroke}
    </>
  );
  if (!it.repeat) return <g>{one}</g>;
  return (
    <g>
      {one}
      {repeatMats(it.repeat).map((m, i) => (
        <g key={i} transform={matStr(m)} pointerEvents="none">
          {kids.length || mask ? (
            <>
              {mask && (
                <defs>
                  <clipPath id={`${clipId}r${i}`}>{mask.kind === 'path' ? <path d={pathD(mask)} /> : null}</clipPath>
                </defs>
              )}
              <g clipPath={mask ? `url(#${clipId}r${i})` : undefined}>
                {kids.map((c) => (
                  <ItemView key={c.id} it={c} copy={`${copy}r${i}`} />
                ))}
              </g>
              {maskStroke}
            </>
          ) : null}
        </g>
      ))}
    </g>
  );
}

export const VectorArt = memo(function VectorArt() {
  const layers = useStore((s) => s.doc.vector.layers);
  const boards = useStore((s) => s.doc.vector.artboards);
  // paper for artboards off the croquis page (the first page already has its own)
  const paper = boards.filter((b) => b.x >= 600 || b.x + b.w <= 0 || b.y >= 1000 || b.y + b.h <= 20);
  return (
    <g className="vector-art" pointerEvents="none">
      {paper.map((b) => (
        <rect key={b.id} data-board-bg="1" x={b.x} y={b.y} width={b.w} height={b.h} fill="#F4F2ED" />
      ))}
      {layers.map((l) =>
        l.visible ? (
          <g key={l.id} data-layer={l.id}>
            <GradientDefs items={l.items} />
            {l.items.map((it) => (
              <ItemView key={it.id} it={it} />
            ))}
          </g>
        ) : null,
      )}
    </g>
  );
});
