// Extra drawing inside the vector overlay: artboard frames and the envelope mesh.
import { useStore } from '../../../store';
import { useEnvelope } from '../../../vector/ops/envelope';

export function BoardsLayer({ k }: { k: number }) {
  const boards = useStore((s) => s.doc.vector.artboards);
  const active = useStore((s) => s.doc.vector.activeBoard);
  const tool = useStore((s) => s.vtool);
  if (boards.length < 2 && tool !== 'artboard') return null;
  return (
    <g pointerEvents="none" data-testid="boards-layer">
      {boards.map((b) => {
        const on = b.id === active;
        return (
          <g key={b.id}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={on ? 'rgba(79,141,247,0.04)' : 'none'} stroke={on ? '#4F8DF7' : '#8C877D'} strokeWidth={(on ? 1.6 : 1) / k} strokeDasharray={on ? undefined : `${6 / k} ${4 / k}`} />
            <text x={b.x} y={b.y - 6 / k} fontSize={11 / k} fill={on ? '#4F8DF7' : '#8C877D'} fontFamily="IBM Plex Mono, monospace">
              {b.name} {Math.round(b.w)} x {Math.round(b.h)}
            </text>
            {on && tool === 'artboard' && <rect x={b.x + b.w - 5 / k} y={b.y + b.h - 5 / k} width={10 / k} height={10 / k} fill="#fff" stroke="#4F8DF7" strokeWidth={1.4 / k} />}
          </g>
        );
      })}
    </g>
  );
}

export function EnvelopeMesh({ k }: { k: number }) {
  const e = useEnvelope();
  const tool = useStore((s) => s.vtool);
  if (!e.active || tool !== 'envelope' || e.grid.length !== 4) return null;
  const g = e.grid;
  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const rows = g.map((r) => line(r));
  const cols = [0, 1, 2, 3].map((c) => line(g.map((r) => r[c])));
  return (
    <g pointerEvents="none" data-testid="envelope-mesh">
      {[...rows, ...cols].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#E54D9E" strokeWidth={1 / k} />
      ))}
      {g.flat().map((p, i) => (
        <rect key={i} x={p.x - 4 / k} y={p.y - 4 / k} width={8 / k} height={8 / k} fill="#fff" stroke="#E54D9E" strokeWidth={1.4 / k} />
      ))}
    </g>
  );
}
