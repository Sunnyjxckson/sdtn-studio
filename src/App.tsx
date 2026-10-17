import { Canvas } from './components/Canvas';
import { CanvasBar } from './components/CanvasBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ToolStrip } from './components/ToolStrip';
import { PatternView } from './components/PatternView';
import { TopBar } from './components/TopBar';
import { useAutosave, useShortcuts } from './hooks';
import { useStore } from './store';

export default function App() {
  useAutosave();
  useShortcuts();
  const ready = useStore((s) => s.ready);
  const tab = useStore((s) => s.tab);
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <LeftPanel />
        <div className="center">
          {tab === 'pattern' ? (
            <PatternView />
          ) : (
            <>
              <ToolStrip />
              <div className="stage">
                <CanvasBar />
                <div className="canvaswrap">{ready ? <Canvas /> : <div className="loading mono muted">Loading</div>}</div>
              </div>
            </>
          )}
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
