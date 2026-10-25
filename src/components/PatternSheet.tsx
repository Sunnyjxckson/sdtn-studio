import { PPI, toPath, type PlacedPiece, type Sheet, type SizeName } from '../model/pattern';
import type { P } from '../model/patternGeo';

const INK = '#141414';
export const SIZE_COLORS: Record<SizeName, string> = { XS: '#7a5cc2', S: '#2b7fb8', M: '#141414', L: '#c8102e', XL: '#d9822b', XXL: '#2e9a6b' };

const px = (p: P) => `${(p[0] * PPI).toFixed(1)},${(p[1] * PPI).toFixed(1)}`;

function Arrow({ a, b, size = 12 }: { a: P; b: P; size?: number }) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const x = a[0] * PPI, y = a[1] * PPI;
  return <path d={`M${x + Math.cos(ang - 0.45) * size},${y + Math.sin(ang - 0.45) * size} L${x},${y} L${x + Math.cos(ang + 0.45) * size},${y + Math.sin(ang + 0.45) * size}`} />;
}

function Label({ p, nested }: { p: PlacedPiece; nested: boolean }) {
  const x = p.label[0] * PPI, y = p.label[1] * PPI;
  const nameSize = 20;
  const lines: { t: string; s: number; c: string }[] = [
    { t: p.name, s: nameSize, c: INK },
    { t: `${p.cutText}${nested ? '' : `  |  size ${p.size}`}`, s: 15, c: '#4A473F' },
    ...(nested ? [{ t: 'sizes ' + p.size, s: 13, c: '#4A473F' }] : []),
    ...p.notes.map((t) => ({ t, s: 12, c: '#4A473F' })),
  ];
  const wChars = Math.max(...lines.map((l) => l.t.length * l.s * 0.6));
  const hTot = lines.reduce((a, l) => a + l.s * 1.35, 0);
  let cy = y - hTot / 2;
  return (
    <g>
      <rect x={x - wChars / 2 - 6} y={cy - 2} width={wChars + 12} height={hTot + 6} rx={4} fill="#FFFFFF" fillOpacity={0.92} />
      {lines.map((l, i) => {
        cy += l.s * 1.35;
        return (
          <text key={i} x={x} y={cy - l.s * 0.3} textAnchor="middle" fontSize={l.s} fontWeight={i === 0 ? 'bold' : 'normal'} fill={l.c}>
            {l.t}
          </text>
        );
      })}
    </g>
  );
}

/** The laid-out pattern, drawn in pixels at 96 px per inch. Pure SVG attributes so it exports cleanly. */
export function PatternSheet({ sheet, print = false }: { sheet: Sheet; print?: boolean }) {
  const { w, h, wIn, hIn, ruler, nested } = sheet;
  const rp = ruler * PPI;
  const cols = Array.from({ length: Math.ceil(wIn) + 1 }, (_, i) => i);
  const rows = Array.from({ length: Math.ceil(hIn) + 1 }, (_, i) => i);
  return (
    <g fontFamily="IBM Plex Mono, monospace">
      {!print && (
        <>
          <rect width={w} height={h} fill="#FAF9F5" />
          <g stroke="#E4E1DA" strokeWidth={0.6}>
            {cols.map((i) => (
              <path key={`c${i}`} d={`M${i * PPI},${rp} V${h}`} stroke={i % 6 === 0 ? '#CFCBC2' : '#E4E1DA'} />
            ))}
            {rows.map((i) => (
              <path key={`r${i}`} d={`M${rp},${i * PPI} H${w}`} stroke={i % 6 === 0 ? '#CFCBC2' : '#E4E1DA'} />
            ))}
          </g>
          <rect width={w} height={rp} fill="#EDEAE3" />
          <rect width={rp} height={h} fill="#EDEAE3" />
          <g stroke={INK} strokeWidth={0.8} fontSize={10} fill={INK}>
            {Array.from({ length: Math.floor((wIn - ruler) * 2) + 1 }, (_, i) => {
              const x = rp + (i / 2) * PPI;
              const whole = i % 2 === 0;
              return (
                <g key={`tx${i}`}>
                  <path d={`M${x},${rp} v${whole ? -10 : -5}`} />
                  {whole && (i / 2) % 2 === 0 && (
                    <text x={x + 2} y={rp - 14} stroke="none">
                      {i / 2}
                    </text>
                  )}
                </g>
              );
            })}
            {Array.from({ length: Math.floor((hIn - ruler) * 2) + 1 }, (_, i) => {
              const y = rp + (i / 2) * PPI;
              const whole = i % 2 === 0;
              return (
                <g key={`ty${i}`}>
                  <path d={`M${rp},${y} h${whole ? -10 : -5}`} />
                  {whole && (i / 2) % 2 === 0 && (
                    <text x={4} y={y - 3} stroke="none">
                      {i / 2}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={4} y={12} stroke="none" fontSize={9}>
              in
            </text>
          </g>
        </>
      )}
      {sheet.pieces.map((p) => {
        const col = nested ? SIZE_COLORS[p.size] : INK;
        const showCut = !nested || p.primary;
        return (
          <g key={`${p.id}-${p.size}`} data-piece={p.id} data-size={p.size}>
            {showCut && <path d={toPath(p.allowance)} fill="none" stroke="#4A473F" strokeWidth={1.6} strokeDasharray="8 5" strokeLinejoin="round" />}
            <path d={toPath(p.seam)} fill={nested ? 'none' : '#FFFFFF'} fillOpacity={nested ? 0 : 0.55} stroke={col} strokeWidth={nested && !p.primary ? 1.6 : 2.6} strokeLinejoin="round" />
            {p.lines.map((l, i) => (
              <path key={i} d={toPath(l.pts, PPI, false)} fill="none" stroke={l.kind === 'fold' ? INK : '#4A473F'} strokeWidth={l.kind === 'fold' ? 1.6 : 1.1} strokeDasharray={l.kind === 'fold' ? undefined : l.kind === 'place' ? '10 6' : '3 4'} />
            ))}
            {showCut && (
              <>
                {p.notches.map((tri, i) => (
                  <path key={i} d={`M${px(tri[0])} L${px(tri[1])} L${px(tri[2])}`} fill="none" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
                ))}
                <g stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d={`M${px(p.grain[0])} L${px(p.grain[1])}`} />
                  <Arrow a={p.grain[0]} b={p.grain[1]} size={14} />
                  <Arrow a={p.grain[1]} b={p.grain[0]} size={14} />
                </g>
                {p.foldEdge && (
                  <g stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d={`M${px(p.foldEdge[0])} L${px([p.foldEdge[0][0] + 0.35, p.foldEdge[0][1]])} M${px(p.foldEdge[1])} L${px([p.foldEdge[1][0] + 0.35, p.foldEdge[1][1]])} M${px([p.foldEdge[0][0] + 0.18, p.foldEdge[0][1]])} L${px([p.foldEdge[1][0] + 0.18, p.foldEdge[1][1]])}`} />
                    <Arrow a={[p.foldEdge[0][0] + 0.18, p.foldEdge[0][1]]} b={[p.foldEdge[1][0] + 0.18, p.foldEdge[1][1]]} size={9} />
                    <Arrow a={[p.foldEdge[1][0] + 0.18, p.foldEdge[1][1]]} b={[p.foldEdge[0][0] + 0.18, p.foldEdge[0][1]]} size={9} />
                    <text transform={`translate(${(p.foldEdge[0][0] + 0.55) * PPI},${((p.foldEdge[0][1] + p.foldEdge[1][1]) / 2) * PPI}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={INK} stroke="none">
                      PLACE ON FOLD
                    </text>
                  </g>
                )}
                <Label p={p} nested={nested} />
              </>
            )}
          </g>
        );
      })}
      <g>
        <rect x={rp + 8} y={h - PPI - 20} width={PPI} height={PPI} fill="none" stroke={INK} strokeWidth={1} />
        <text x={rp + 8 + PPI / 2} y={h - PPI / 2 - 18} textAnchor="middle" fontSize={11} fill={INK}>
          1 in
        </text>
        <text x={rp + PPI + 24} y={h - 62} fontSize={14} fontWeight="bold" fill={INK}>
          {`SDTN Studio  |  ${sheet.title}  |  ${nested ? 'sizes ' + sheet.sizes.join(' ') : 'size ' + sheet.activeSize}`}
        </text>
        <text x={rp + PPI + 24} y={h - 42} fontSize={10} fill="#4A473F">
          Print at 100 percent. Dashed line is the cut line (3/8 in seam allowance, 1 in hems). Triangles are notches.
        </text>
        {nested && (
          <g fontSize={11}>
            {sheet.sizes.map((s, i) => (
              <g key={s}>
                <rect x={rp + PPI + 24 + i * 64} y={h - 30} width={14} height={4} fill={SIZE_COLORS[s]} />
                <text x={rp + PPI + 44 + i * 64} y={h - 24} fill={INK}>
                  {s}
                </text>
              </g>
            ))}
          </g>
        )}
      </g>
    </g>
  );
}
