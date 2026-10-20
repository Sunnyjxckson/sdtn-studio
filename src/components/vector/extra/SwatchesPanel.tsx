// Document swatches plus the garment washes.
import { useStore } from '../../../store';
import { WASHES } from '../../../model/garment';
import type { VectorDoc } from '../../../model/vector';
import { editStyle, vs } from '../../../vector/edit';
import { paintColor, Section, useShownStyle } from '../VectorPanels';

const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(22px, 1fr))', gap: 5 };
const CELL: React.CSSProperties = { height: 22, borderRadius: 4, border: '1px solid var(--line2)', padding: 0, cursor: 'pointer' };
const NONE: React.CSSProperties = { ...CELL, background: 'linear-gradient(135deg, transparent 45%, var(--accent) 45%, var(--accent) 55%, transparent 55%), #f4f2ed' };

const apply = (color: string | null, stroke: boolean) =>
  editStyle((x) => {
    const p = color ? ({ kind: 'solid', color } as const) : null;
    if (stroke) x.stroke = p;
    else x.fill = p;
  });

export function SwatchesPanel() {
  const swatches = useStore((s) => s.doc.vector.swatches);
  const s = useShownStyle();
  const cur = paintColor(s.fill);
  const click = (e: React.MouseEvent, color: string | null) => apply(color, e.shiftKey);
  const add = () => {
    if (!cur || swatches.some((c) => c.toLowerCase() === cur.toLowerCase())) return;
    vs().vstep((v) => void v.swatches.push(cur));
  };
  const remove = (i: number) => vs().vstep((v: VectorDoc) => void v.swatches.splice(i, 1));
  return (
    <Section
      label="SWATCHES"
      right={
        <button className="opt" title="Save the current fill as a swatch" onClick={add} disabled={!cur}>
          Add
        </button>
      }
    >
      <div style={GRID} data-testid="swatches">
        <button style={NONE} title="None. Click for fill, Shift click for stroke" aria-label="None" onClick={(e) => click(e, null)} />
        {swatches.map((c, i) => (
          <button
            key={`${c}${i}`}
            style={{ ...CELL, background: c }}
            title={`${c}. Click for fill, Shift click for stroke, right click to delete`}
            aria-label={c}
            onClick={(e) => (e.altKey ? remove(i) : click(e, c))}
            onContextMenu={(e) => {
              e.preventDefault();
              remove(i);
            }}
          />
        ))}
      </div>
      <h4 className="label small muted">Washes</h4>
      <div style={GRID} data-testid="washes">
        {Object.entries(WASHES).map(([name, c]) => (
          <button key={name} style={{ ...CELL, background: c }} title={name} aria-label={name} onClick={(e) => click(e, c)} />
        ))}
      </div>
    </Section>
  );
}
