// Fashion symbol library. Click to place at the center of the active artboard, or drag onto the canvas.
import { memo, useEffect, useMemo } from 'react';
import { useStore } from '../../../store';
import { cloneItem, itemBox, transformItem, translate, type VItem } from '../../../model/vector';
import { activeBoard } from '../../../vector/artboards';
import { addItems } from '../../../vector/edit';
import { SYMBOLS, type SymbolDef } from '../../../vector/symbols';
import { ItemView } from '../VectorArt';
import { Section } from '../VectorPanels';

let placed = 0;
const MIME = 'application/x-sdtn-symbol';

/** Put a fresh copy of a symbol with its center at x, y. */
export function placeSymbol(def: SymbolDef, x: number, y: number) {
  const it = cloneItem(def.build());
  const b = itemBox(it);
  if (b) transformItem(it, translate(Math.round(x - (b.x + b.w / 2)), Math.round(y - (b.y + b.h / 2))));
  addItems([it]);
}

const Thumb = memo(function Thumb({ def }: { def: SymbolDef }) {
  const item = useMemo<VItem>(() => def.build(), [def]);
  const b = itemBox(item) ?? { x: 0, y: 0, w: 20, h: 20 };
  const pad = 4;
  const size = Math.max(b.w, b.h) + pad * 2;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return (
    <svg viewBox={`${cx - size / 2} ${cy - size / 2} ${size} ${size}`} width={46} height={46} aria-hidden="true" style={{ background: '#F4F2ED', borderRadius: 3 }}>
      <ItemView it={item} />
    </svg>
  );
});

export function SymbolsPanel() {
  const groups = useMemo(() => {
    const m = new Map<string, SymbolDef[]>();
    for (const s of SYMBOLS) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m.entries()];
  }, []);

  // drop onto the canvas overlay
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(MIME)) return;
      if ((e.target as Element | null)?.closest?.('.vectoroverlay')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const id = e.dataTransfer?.getData(MIME);
      const ov = (e.target as Element | null)?.closest?.('.vectoroverlay');
      if (!id || !ov) return;
      e.preventDefault();
      const def = SYMBOLS.find((s) => s.id === id);
      if (!def) return;
      const r = ov.getBoundingClientRect();
      const { view } = useStore.getState();
      placeSymbol(def, (e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <Section label="SYMBOLS">
      {groups.map(([g, list]) => (
        <div key={g}>
          <div className="muted small" style={{ margin: '6px 0 3px' }}>{g}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {list.map((s) => (
              <button
                key={s.id}
                className="opt"
                style={{ padding: 2, width: 52, height: 52, display: 'grid', placeItems: 'center' }}
                title={s.name}
                aria-label={s.name}
                data-symbol={s.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME, s.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  const b = activeBoard();
                  // each click steps over so a row of clicks does not pile up
                  const n = placed++ % 6;
                  placeSymbol(s, b.x + b.w / 2 + (n - 2.5) * 36, b.y + b.h / 2 + (n % 2 ? 30 : -30));
                }}
              >
                <Thumb def={s} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="hint small muted">Click to place, or drag onto the canvas. Ungroup to edit the parts.</p>
    </Section>
  );
}
