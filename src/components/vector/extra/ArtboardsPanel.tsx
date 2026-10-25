// Artboards: add from presets, rename, resize, remove.
import { useStore } from '../../../store';
import { addBoard, BOARD_PRESETS, patchBoard, removeBoard, setActiveBoard } from '../../../vector/artboards';
import { Icon } from '../../icons';
import { NumField, Section } from '../VectorPanels';

export function ArtboardsPanel() {
  const boards = useStore((s) => s.doc.vector.artboards);
  const activeId = useStore((s) => s.doc.vector.activeBoard);
  const setTool = useStore((s) => s.setVTool);
  const active = boards.find((b) => b.id === activeId) ?? boards[0];
  return (
    <Section
      label="ARTBOARDS"
      right={
        <span style={{ display: 'flex', gap: 2 }}>
          <button className="iconbtn sm" title="Artboard tool (Shift+O)" aria-label="Artboard tool" onClick={() => setTool('artboard')}>
            <Icon name="fit" size={14} />
          </button>
          <button className="iconbtn sm" title="New artboard" aria-label="New artboard" data-testid="board-add" onClick={() => addBoard()}>
            <Icon name="plus" size={14} />
          </button>
          <button className="iconbtn sm" title="Delete artboard" aria-label="Delete artboard" disabled={boards.length < 2} onClick={() => removeBoard(active.id)}>
            <Icon name="trash" size={14} />
          </button>
        </span>
      }
    >
      <div className="layers vlayers" data-testid="board-list">
        {boards.map((b) => (
          <div key={b.id} className={b.id === active.id ? 'layer on' : 'layer'} onClick={() => setActiveBoard(b.id)} data-board={b.id}>
            <input
              className="layerinput"
              style={{ flex: 1, minWidth: 0, width: 0 }}
              aria-label={`Artboard name ${b.name}`}
              value={b.name}
              onChange={(e) => patchBoard(b.id, { name: e.target.value }, 'board-name-' + b.id)}
              onFocus={() => setActiveBoard(b.id)}
            />
            <span className="muted small mono">{Math.round(b.w)} x {Math.round(b.h)}</span>
          </div>
        ))}
      </div>
      <div className="vrow2">
        <NumField label="W" value={active.w} min={20} max={20000} onChange={(n) => patchBoard(active.id, { w: Math.round(n) }, 'board-w')} />
        <NumField label="H" value={active.h} min={20} max={20000} onChange={(n) => patchBoard(active.id, { h: Math.round(n) }, 'board-h')} />
      </div>
      <div className="vrow2">
        <NumField label="X" value={active.x} onChange={(n) => patchBoard(active.id, { x: Math.round(n) }, 'board-x')} />
        <NumField label="Y" value={active.y} onChange={(n) => patchBoard(active.id, { y: Math.round(n) }, 'board-y')} />
      </div>
      <div className="muted small" style={{ margin: '6px 0 3px' }}>Add from a preset</div>
      <div className="opts">
        {BOARD_PRESETS.map((p) => (
          <button key={p.name} className="opt" data-preset={p.name} onClick={() => addBoard(p)}>
            {p.name}
          </button>
        ))}
      </div>
    </Section>
  );
}
