// Blanks library: front and back garment flats. Click to place on the active artboard, or drag onto the canvas.
import { memo, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../../store';
import { itemBox, type VItem } from '../../../model/vector';
import { activeBoard } from '../../../vector/artboards';
import { BLANKS, BLANK_CATS, PARTS, buildBlank, nextOffset, placeBlank, recolorSelection, type BlankDef, type Part } from '../../../vector/blanks';
import { ItemView } from '../VectorArt';
import { Section } from '../VectorPanels';

const MIME = 'application/x-sdtn-blank';
type Mode = 'front' | 'back' | 'pair';
const COLORWAYS = ['#D9D9D9', '#FFFFFF', '#141414', '#3E3B35', '#2F4A6D', '#7A0E1F', '#3E5236', '#C9B48A', '#E3C04B', '#D98AA0'];

const Thumb = memo(function Thumb({ def }: { def: BlankDef }) {
  const item = useMemo<VItem>(() => buildBlank(def, 'front', '#D9D9D9'), [def]);
  const b = itemBox(item) ?? { x: 0, y: 0, w: 100, h: 100 };
  const pad = 14;
  const w = b.w + pad * 2, h = b.h + pad * 2;
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${w} ${h}`} width={56} height={56} aria-hidden="true" style={{ background: '#F4F2ED', borderRadius: 3 }} preserveAspectRatio="xMidYMid meet">
      <ItemView it={item} />
    </svg>
  );
});

export function BlanksPanel() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Mode>('pair');
  const [color, setColor] = useState('#D9D9D9');
  const [part, setPart] = useState<Part>('all');
  const [applied, setApplied] = useState('');
  const sel = useStore((s) => s.vsel.length);

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    return BLANK_CATS.map((c) => [c, BLANKS.filter((b) => b.cat === c && (!t || b.name.toLowerCase().includes(t) || c.toLowerCase().includes(t)))] as const).filter(([, l]) => l.length);
  }, [q]);

  // drop onto the canvas overlay
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(MIME)) return;
      if ((e.target as Element | null)?.closest?.('.vectoroverlay')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(MIME);
      const ov = (e.target as Element | null)?.closest?.('.vectoroverlay');
      if (!raw || !ov) return;
      e.preventDefault();
      const [id, m, c] = raw.split('|');
      const def = BLANKS.find((s) => s.id === id);
      if (!def) return;
      const r = ov.getBoundingClientRect();
      const { view } = useStore.getState();
      placeBlank(def, (e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k, m as Mode, c);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, []);

  const apply = (c: string, p: Part = part) => {
    const n = recolorSelection(c, p);
    setApplied(n ? `Recolored ${n} selected` : '');
  };
  const pick = (c: string) => {
    setColor(c);
    apply(c);
  };

  return (
    <Section label="BLANKS">
      <input
        className="hexin"
        type="search"
        placeholder="Search blanks"
        aria-label="Search blanks"
        data-testid="blanks-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', marginBottom: 6 }}
      />
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }} role="group" aria-label="Add as">
        {([['front', 'Front'], ['back', 'Back'], ['pair', 'Front + back']] as const).map(([m, l]) => (
          <button key={m} className={mode === m ? 'opt on' : 'opt'} style={{ flex: 1, fontSize: 11 }} data-blank-mode={m} onClick={() => setMode(m)}>
            {l}
          </button>
        ))}
      </div>
      <div className="muted small" style={{ marginBottom: 3 }}>Colorway</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        {COLORWAYS.map((c) => (
          <button
            key={c}
            className="opt"
            aria-label={`Colorway ${c}`}
            title={c}
            data-blank-color={c}
            onClick={() => pick(c)}
            style={{ width: 20, height: 20, padding: 0, background: c, outline: color === c ? '2px solid #4F8DF7' : undefined, outlineOffset: 1 }}
          />
        ))}
        <input type="color" aria-label="Custom colorway" value={color} onChange={(e) => pick(e.target.value.toUpperCase())} style={{ width: 24, height: 24, padding: 0, border: 0, background: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        <select className="hexin" aria-label="Part to recolor" value={part} onChange={(e) => setPart(e.target.value as Part)} style={{ flex: 1 }} data-testid="blanks-part">
          {PARTS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <button className="opt" disabled={!sel} onClick={() => apply(color)} data-testid="blanks-apply">Apply</button>
      </div>
      <p className="hint small muted" style={{ minHeight: 14 }}>{applied || (sel ? 'Pick a color to recolor the selected blank.' : 'Select a blank to recolor it. New ones use this color.')}</p>
      {groups.map(([g, list]) => (
        <div key={g}>
          <div className="muted small" style={{ margin: '6px 0 3px' }}>{g}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {list.map((s) => (
              <button
                key={s.id}
                className="opt"
                style={{ padding: 2, width: 62, height: 62, display: 'grid', placeItems: 'center' }}
                title={s.name}
                aria-label={s.name}
                data-blank={s.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME, `${s.id}|${mode}|${color}`);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  const b = activeBoard();
                  const n = nextOffset();
                  placeBlank(s, b.x + b.w / 2 + (n % 2) * 24, b.y + b.h / 2 + (n >> 1) * 24, mode, color);
                }}
              >
                <Thumb def={s} />
              </button>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <p className="hint small muted">No blanks match.</p>}
      <p className="hint small muted">Drawn at 9.4 units per inch, so Measure reads inches. Ungroup to edit points.</p>
    </Section>
  );
}

if (import.meta.env.DEV) Object.assign(window, { __blanks: { BLANKS, placeBlank, buildBlank } });
