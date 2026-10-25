import { Canvas } from './components/Canvas';
import { CanvasBar } from './components/CanvasBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ToolStrip } from './components/ToolStrip';
import { PatternView } from './components/PatternView';
import { FlatsView } from './components/FlatsView';
import { TopBar } from './components/TopBar';
import { DrawOverlay } from './components/DrawOverlay';
import { BrushPanel, DrawBar, DrawRightPanel, DrawToolStrip, SideSliders } from './components/DrawPanels';
import { useAutosave, useShortcuts } from './hooks';
import { useStore } from './store';
import { VectorOverlay } from './components/vector/VectorOverlay';
import { VectorBar, VectorLeftPanel, VectorRightPanel, VectorToolStrip } from './components/vector/VectorPanels';

export default function App() {
  useAutosave();
  useShortcuts();
  const ready = useStore((s) => s.ready);
  const tab = useStore((s) => s.tab);
  const draw = tab === 'draw';
  const vec = tab === 'vector';
  return (
    <div className="app">
      <TopBar />
      <div className={draw ? 'main draw' : vec ? 'main vec' : 'main'}>
        {draw ? <BrushPanel /> : vec ? <VectorLeftPanel /> : <LeftPanel />}
        <div className="center">
          {tab === 'pattern' ? (
            <PatternView />
          ) : tab === 'flats' ? (
            <FlatsView />
          ) : (
            <>
              {draw ? <DrawToolStrip /> : vec ? <VectorToolStrip /> : <ToolStrip />}
              <div className="stage">
                {draw ? <DrawBar /> : vec ? <VectorBar /> : <CanvasBar />}
                <div className="canvaswrap">
                  {ready ? (
                    <>
                      <Canvas />
                      <DrawOverlay interactive={draw} />
                      {draw && <SideSliders />}
                      {vec && <VectorOverlay />}
                    </>
                  ) : (
                    <div className="loading mono muted">Loading</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {draw ? <DrawRightPanel /> : vec ? <VectorRightPanel /> : <RightPanel />}
      </div>
    </div>
  );
}
