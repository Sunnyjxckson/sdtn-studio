import { Canvas } from './components/Canvas';
import { CanvasBar } from './components/CanvasBar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ToolStrip } from './components/ToolStrip';
import { PatternView } from './components/PatternView';
import { TopBar } from './components/TopBar';
import { DrawOverlay } from './components/DrawOverlay';
import { BrushPanel, DrawBar, DrawRightPanel, DrawToolStrip, SideSliders } from './components/DrawPanels';
import { useAutosave, useShortcuts } from './hooks';
import { useStore } from './store';

export default function App() {
  useAutosave();
  useShortcuts();
  const ready = useStore((s) => s.ready);
  const tab = useStore((s) => s.tab);
  const draw = tab === 'draw';
  return (
    <div className="app">
      <TopBar />
      <div className={draw ? 'main draw' : 'main'}>
        {draw ? <BrushPanel /> : <LeftPanel />}
        <div className="center">
          {tab === 'pattern' ? (
            <PatternView />
          ) : (
            <>
              {draw ? <DrawToolStrip /> : <ToolStrip />}
              <div className="stage">
                {draw ? <DrawBar /> : <CanvasBar />}
                <div className="canvaswrap">
                  {ready ? (
                    <>
                      <Canvas />
                      {tab !== 'flats' && <DrawOverlay interactive={draw} />}
                      {draw && <SideSliders />}
                    </>
                  ) : (
                    <div className="loading mono muted">Loading</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {draw ? <DrawRightPanel /> : <RightPanel />}
      </div>
    </div>
  );
}
