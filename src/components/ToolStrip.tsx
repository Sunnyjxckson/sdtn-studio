import { useStore, type Tool } from '../store';
import { Icon, type IconName } from './icons';

export const TOOLS: { id: Tool; title: string; key: string; icon: IconName; help: string }[] = [
  { id: 'move', title: 'Move', key: 'V', icon: 'move', help: 'Drag a dot to reshape. Drag the garment to move it.' },
  { id: 'add', title: 'Add point', key: 'A', icon: 'add', help: 'Click the outline to add a dot, then drag it.' },
  { id: 'erase', title: 'Erase', key: 'E', icon: 'erase', help: 'Click a dot, hole, rip or text to remove it.' },
  { id: 'cut', title: 'Cut line', key: 'C', icon: 'cut', help: 'Click or drag where the hem should end.' },
  { id: 'hole', title: 'Hole', key: 'O', icon: 'hole', help: 'Click the garment to punch a hole.' },
  { id: 'distress', title: 'Distress brush', key: 'D', icon: 'distress', help: 'Click or drag on the garment to fray it.' },
  { id: 'text', title: 'Text', key: 'T', icon: 'text', help: 'Click the garment to place text. Drag it to move.' },
  { id: 'note', title: 'Note', key: 'N', icon: 'note', help: 'Click empty canvas to place a handwritten note with an arrow.' },
  { id: 'hand', title: 'Hand', key: 'H', icon: 'hand', help: 'Drag to pan. Hold space with any tool to pan.' },
];

export function ToolStrip() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  return (
    <nav className="toolstrip" aria-label="Tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={tool === t.id ? 'tool on' : 'tool'}
          title={`${t.title} (${t.key})`}
          aria-label={t.title}
          aria-pressed={tool === t.id}
          onClick={() => setTool(t.id)}
        >
          <Icon name={t.icon} />
        </button>
      ))}
    </nav>
  );
}
