import { canRedo, canUndo, useStore } from '../store';
import { fitToArtboard, zoomBy } from '../viewport';
import { Icon } from './icons';
import { TOOLS } from './ToolStrip';

export function CanvasBar() {
  const tool = useStore((s) => s.tool);
  const k = useStore((s) => s.view.k);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const u = useStore(canUndo);
  const r = useStore(canRedo);
  const cur = TOOLS.find((t) => t.id === tool)!;
  return (
    <div className="canvasbar">
      <span className="toolname">
        {cur.title} <span className="mono muted">{cur.key}</span>
      </span>
      <span className="muted small toolhelp">{cur.help}</span>
      <div className="barend">
        <button className="iconbtn" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <Icon name="minus" size={16} />
        </button>
        <span className="mono small zoomval" data-testid="zoom">{Math.round(k * 100)}%</span>
        <button className="iconbtn" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.25)}>
          <Icon name="plus" size={16} />
        </button>
        <button className="iconbtn" aria-label="Fit to screen" title="Fit to screen" onClick={() => fitToArtboard()}>
          <Icon name="fit" size={16} />
        </button>
        <span className="sep" />
        <button className="iconbtn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!u} onClick={undo}>
          <Icon name="undo" size={18} />
        </button>
        <button className="iconbtn" aria-label="Redo" title="Redo (Shift+Ctrl+Z)" disabled={!r} onClick={redo}>
          <Icon name="redo" size={18} />
        </button>
      </div>
    </div>
  );
}
