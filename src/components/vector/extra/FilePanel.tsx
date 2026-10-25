// View options, sketch to vector, SVG import and export.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../store';
import type { VectorDoc } from '../../../model/vector';
import { runCommand } from '../../../vector/commands';
import { vs } from '../../../vector/edit';
import type { ExportOpts } from '../../../vector/ops/io_export';
import { exportPdf, exportRaster, exportSvg, type RasterFormat } from '../../../vector/ops/io_export';
import { lastCopiedSvg } from '../../../vector/ops/io_export';
import { croquisToVector, garmentsToVector, placeSvg } from '../../../vector/ops/io_import';
import { NumField, Section } from '../VectorPanels';

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
const looksSvg = (t: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!doctype[^>]*>\s*)?<svg[\s>]/i.test(t);

export function FilePanel() {
  const v = useStore((s) => s.doc.vector);
  const [base, setBase] = useState(false);
  const [target, setTarget] = useState('bounds');
  const [scale, setScale] = useState(2);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const say = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((cur) => (cur === m ? '' : cur)), 2500);
  };
  const flag = (k: 'grid' | 'snap' | 'smartGuides') => vs().vstep((d) => void (d[k] = !d[k]));

  const place = (text: string, name?: string) => {
    if (placeSvg(text, name)) say('Placed');
    else say('Could not read that SVG');
  };

  // paste SVG markup, only while the Vector tab is open
  const placeRef = useRef(place);
  placeRef.current = place;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (useStore.getState().tab !== 'vector' || typing(e.target)) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!looksSvg(text) || text === lastCopiedSvg()) return;
      e.preventDefault();
      placeRef.current(text, 'Pasted SVG');
    };
    // Ctrl+V is handled as a command first, so look at the system clipboard before it runs
    const onKey = (e: KeyboardEvent) => {
      if (useStore.getState().tab !== 'vector' || typing(e.target)) return;
      if (!((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === 'KeyV')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const fallback = () => runCommand('paste');
      const rd = navigator.clipboard?.readText;
      if (!rd) return fallback();
      navigator.clipboard.readText().then(
        (text) => {
          if (looksSvg(text) && text !== lastCopiedSvg()) placeRef.current(text, 'Pasted SVG');
          else fallback();
        },
        fallback,
      );
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  const guard = async (fn: () => Promise<boolean> | boolean, ok: string) => {
    setBusy(true);
    try {
      say((await fn()) ? ok : 'Nothing to export');
    } catch {
      say('Export failed');
    } finally {
      setBusy(false);
    }
  };
  const boards = v.artboards;
  const o: ExportOpts = {
    base,
    full: false,
    boards: target === 'bounds' ? undefined : target === 'all' ? boards : boards.filter((b) => b.id === (target === 'active' ? v.activeBoard : target)),
  };
  const raster = (f: RasterFormat, label: string) => (
    <button className="opt" disabled={busy} data-export={f} onClick={() => void guard(() => exportRaster(o, f, scale), `${label} saved`)}>{label}</button>
  );

  return (
    <>
      <Section label="VIEW">
        <div className="opts">
          <button className={v.grid ? 'opt on' : 'opt'} aria-pressed={v.grid} onClick={() => flag('grid')}>Grid</button>
          <button className={v.snap ? 'opt on' : 'opt'} aria-pressed={v.snap} onClick={() => flag('snap')}>Snap</button>
          <button className={v.smartGuides ? 'opt on' : 'opt'} aria-pressed={v.smartGuides} onClick={() => flag('smartGuides')}>Smart guides</button>
        </div>
        <div className="vrow2">
          <NumField label="Grid size" value={v.gridSize} min={1} max={200} onChange={(n) => vs().vstep((d: VectorDoc) => void (d.gridSize = Math.max(1, Math.round(n)))) } />
        </div>
      </Section>
      <Section label="FROM SKETCH">
        <div className="opts">
          <button
            className="opt"
            title="Turn the garments on the croquis into editable paths"
            onClick={() => {
              const n = garmentsToVector();
              say(n ? `${n} garment${n > 1 ? 's' : ''} converted` : 'No garments on the croquis');
            }}
          >
            Garments to vector
          </button>
          <button
            className="opt"
            title="Turn the croquis figure into paths on a locked layer"
            onClick={() => say(croquisToVector() ? 'Croquis converted' : 'No croquis to convert')}
          >
            Croquis to vector
          </button>
        </div>
      </Section>
      <Section label="IMPORT">
        <div className="opts">
          <button className="opt" onClick={() => file.current?.click()}>Place SVG</button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".svg,image/svg+xml"
          data-testid="place-svg"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) place(await f.text(), f.name.replace(/\.svg$/i, ''));
          }}
        />
        <p className="hint small muted">You can also paste SVG markup.</p>
      </Section>
      <Section label="EXPORT">
        <label className="small vcheck">
          <input type="checkbox" checked={base} onChange={(e) => setBase(e.target.checked)} />
          With croquis and garments
        </label>
        <div className="vrow2">
          <label className="numfield">
            <span className="muted small">Area</span>
            <select className="hexin small" value={target} data-testid="export-target" onChange={(e) => setTarget(e.target.value)}>
              <option value="bounds">Art bounds</option>
              <option value="active">Active artboard</option>
              <option value="all">All artboards</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="numfield">
            <span className="muted small">Scale</span>
            <select className="hexin small" value={scale} data-testid="export-scale" onChange={(e) => setScale(Number(e.target.value))}>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </label>
        </div>
        <div className="opts">
          <button className="opt" disabled={busy} onClick={() => void guard(() => exportSvg(o), 'SVG saved')}>SVG</button>
          {raster('png', 'PNG')}
          {raster('jpeg', 'JPEG')}
          {raster('webp', 'WebP')}
          <button className="opt" disabled={busy} onClick={() => void guard(() => exportPdf(o), 'PDF saved')}>PDF</button>
        </div>
        {msg && <p className="hint small muted" role="status">{msg}</p>}
      </Section>
    </>
  );
}
