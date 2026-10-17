import { PPI, type Sheet } from '../model/pattern';

const INK = '#141414';

/** The laid-out pattern, drawn in pixels at 96 px per inch. Pure SVG attributes so it exports cleanly. */
export function PatternSheet({ sheet }: { sheet: Sheet }) {
  const { w, h, wIn, hIn, ruler } = sheet;
  const rp = ruler * PPI;
  const cols = Array.from({ length: Math.ceil(wIn) + 1 }, (_, i) => i);
  const rows = Array.from({ length: Math.ceil(hIn) + 1 }, (_, i) => i);
  return (
    <g fontFamily="IBM Plex Mono, monospace">
      <rect width={w} height={h} fill="#FAF9F5" />
      {/* inch grid */}
      <g stroke="#E4E1DA" strokeWidth={0.6}>
        {cols.map((i) => (
          <path key={`c${i}`} d={`M${i * PPI},${rp} V${h}`} stroke={i % 6 === 0 ? '#CFCBC2' : '#E4E1DA'} />
        ))}
        {rows.map((i) => (
          <path key={`r${i}`} d={`M${rp},${i * PPI} H${w}`} stroke={i % 6 === 0 ? '#CFCBC2' : '#E4E1DA'} />
        ))}
      </g>
      {/* rulers, in inches */}
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
      {sheet.pieces.map((p) => (
        <g key={p.id} data-piece={p.id}>
          <path d={p.allowance} fill="none" stroke="#4A473F" strokeWidth={1.6} strokeDasharray="8 5" strokeLinejoin="round" />
          <path d={p.outline} fill="#FFFFFF" fillOpacity={0.55} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
          <path d={p.notches} fill="none" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <g stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={`M${p.grain.x1},${p.grain.y1} L${p.grain.x2},${p.grain.y2}`} />
            {[1, -1].map((s) => {
              const [x, y, ox, oy] = s === 1 ? [p.grain.x1, p.grain.y1, p.grain.x2, p.grain.y2] : [p.grain.x2, p.grain.y2, p.grain.x1, p.grain.y1];
              const a = Math.atan2(oy - y, ox - x);
              const L = 14;
              return <path key={s} d={`M${x + Math.cos(a - 0.45) * L},${y + Math.sin(a - 0.45) * L} L${x},${y} L${x + Math.cos(a + 0.45) * L},${y + Math.sin(a + 0.45) * L}`} />;
            })}
          </g>
          <text x={p.label.x} y={p.label.y} textAnchor="middle" fontSize={22} fontWeight={500} fill={INK}>
            {p.name}
          </text>
          <text x={p.label.x} y={p.label.y + 26} textAnchor="middle" fontSize={18} fill="#4A473F">
            {`cut ${p.cut}`}
          </text>
        </g>
      ))}
      <g>
        <rect x={rp + 8} y={h - PPI - 20} width={PPI} height={PPI} fill="none" stroke={INK} strokeWidth={1} />
        <text x={rp + 8 + PPI / 2} y={h - PPI / 2 - 18} textAnchor="middle" fontSize={11} fill={INK}>
          1 in
        </text>
        <text x={rp + PPI + 24} y={h - 44} fontSize={10} fill="#4A473F">
          Print at 100 percent. Dashed line is the 3/8 in seam allowance.
        </text>
      </g>
    </g>
  );
}
