import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Icon } from './icons';
import type { Garment } from '../model/garment';
import {
  buildBom,
  bomTotal,
  constructionOf,
  DEFAULT_PALETTE,
  fabricInfoOf,
  garmentColor,
  HEX_RE,
  money,
  PRINT_METHODS,
  readArtwork,
  rowTotal,
  SEAM_FINISHES,
  STITCHES,
  stitchName,
  TRIM_KINDS,
  TRIM_SIZE,
  TRIM_TYPES,
  type PrintMethod,
} from '../model/production';

function Fold({ label, count, children, open }: { label: string; count?: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group fold" open={open}>
      <summary className="label">
        {label}
        {count ? <span className="foldn mono">{count}</span> : null}
      </summary>
      <div className="foldbody">{children}</div>
    </details>
  );
}

/** A number box that keeps what you type until you leave it, then commits. */
function Num({ value, onChange, min, max, step = 1, label, wide }: { value: number | undefined; onChange: (n: number | undefined) => void; min?: number; max?: number; step?: number; label: string; wide?: boolean }) {
  return (
    <input
      className={wide ? 'pnum wide' : 'pnum'}
      type="number"
      aria-label={label}
      title={label}
      min={min}
      max={max}
      step={step}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (n: number) => void }) {
  return (
    <label className="range">
      <span>
        {label}
        <span className="mono">
          {Math.round(value * 10) / 10} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

// ---------- colorways and palette ----------

/** Colorways for the whole look, and the palette they draw on. Always shown in the inspector. */
export function ColorwaysPanel() {
  const a = useStore.getState;
  const colorways = useStore((s) => s.doc.colorways) ?? [];
  const active = useStore((s) => s.doc.activeColorway);
  const palette = useStore((s) => s.doc.palette) ?? DEFAULT_PALETTE;
  const palettes = useStore((s) => s.doc.palettes) ?? [];
  const [hex, setHex] = useState('#C8102E');
  const [name, setName] = useState('');
  const [tcx, setTcx] = useState('');
  const [pname, setPname] = useState('');
  const cur = colorways.find((c) => c.id === active);
  const add = () => {
    if (!HEX_RE.test(hex)) return;
    a().addPaletteColor({ name: name.trim() || hex.toUpperCase(), hex, pantone: tcx.trim() || undefined });
    setName('');
    setTcx('');
  };
  return (
    <Fold label="COLORWAYS" count={colorways.length} open>
      <div className="cwrow" data-testid="colorways">
        {colorways.map((c) => (
          <button key={c.id} className={c.id === active ? 'opt on' : 'opt'} onClick={() => a().applyColorway(c.id)} data-testid="colorway-chip">
            {c.name}
          </button>
        ))}
        <button className="opt" onClick={() => a().addColorway()} data-testid="add-colorway">
          {colorways.length ? '+ Colorway' : '+ Save as Colorway A'}
        </button>
      </div>
      {cur && (
        <div className="prow">
          <input className="ptext" aria-label="Colorway name" value={cur.name} onChange={(e) => a().renameColorway(cur.id, e.target.value)} />
          <button className="iconbtn sm" aria-label="Delete colorway" title="Delete colorway" onClick={() => a().removeColorway(cur.id)}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}
      <p className="hint">A colorway colors every garment at once. Pick a color on a garment, then switch colorway to compare.</p>

      <h4 className="label sub">PALETTE</h4>
      <div className="plist" data-testid="palette">
        {palette.map((c) => (
          <div className="prow" key={c.id}>
            <input type="color" className="pcolor" aria-label={`${c.name} color`} value={c.hex} onChange={(e) => a().updatePaletteColor(c.id, { hex: e.target.value }, `pc:${c.id}`)} />
            <input className="ptext" aria-label="Color name" value={c.name} onChange={(e) => a().updatePaletteColor(c.id, { name: e.target.value }, `pn:${c.id}`)} />
            <input className="ptext tcx" aria-label="Pantone TCX code" placeholder="TCX" value={c.pantone ?? ''} onChange={(e) => a().updatePaletteColor(c.id, { pantone: e.target.value }, `pt:${c.id}`)} />
            <button className="iconbtn sm" aria-label={`Remove ${c.name}`} title="Remove" onClick={() => a().removePaletteColor(c.id)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="prow">
        <input type="color" className="pcolor" aria-label="New color" value={hex} onChange={(e) => setHex(e.target.value)} />
        <input className="ptext" aria-label="New color name" placeholder="Color name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="ptext tcx" aria-label="New color Pantone TCX code" placeholder="TCX" value={tcx} onChange={(e) => setTcx(e.target.value)} />
        <button className="opt" onClick={add} data-testid="add-color">
          Add
        </button>
      </div>
      <div className="prow">
        <input className="ptext" aria-label="Palette name" placeholder="Palette name" value={pname} onChange={(e) => setPname(e.target.value)} />
        <button
          className="opt"
          onClick={() => {
            a().savePalette(pname);
            setPname('');
          }}
        >
          Save palette
        </button>
      </div>
      {palettes.map((p) => (
        <div className="prow" key={p.id}>
          <span className="pname">{p.name}</span>
          <span className="mono small muted">{p.colors.length}</span>
          <button className="opt" onClick={() => a().loadPalette(p.id)}>
            Load
          </button>
          <button className="iconbtn sm" aria-label={`Delete palette ${p.name}`} title="Delete palette" onClick={() => a().deletePalette(p.id)}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      ))}
    </Fold>
  );
}

/** Palette swatches on a garment: picking one sets the custom color. */
export function PaletteSwatches({ g }: { g: Garment }) {
  const palette = useStore((s) => s.doc.palette) ?? DEFAULT_PALETTE;
  const cur = garmentColor(g);
  return (
    <>
      <div className="washes" data-testid="palette-swatches">
        {palette.map((c) => (
          <button
            key={c.id}
            className={g.colorHex && g.colorHex.toLowerCase() === c.hex.toLowerCase() ? 'wash on' : 'wash'}
            style={{ background: c.hex }}
            aria-label={c.name}
            title={`${c.name}${c.pantone ? `, ${c.pantone}` : ''}`}
            onClick={() => useStore.getState().setGarmentColor(g.id, { name: c.name, hex: c.hex, pantone: c.pantone })}
          />
        ))}
      </div>
      <p className="hint">
        {cur.name}
        {cur.pantone ? `, ${cur.pantone}` : ''}
      </p>
    </>
  );
}

// ---------- graphics ----------

export function GraphicsGroup({ g }: { g: Garment }) {
  const a = useStore.getState;
  const sel = useStore((s) => s.selectedGraphic);
  const view = useStore((s) => s.doc.base.view);
  const fileRef = useRef<HTMLInputElement>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const [side, setSide] = useState<'front' | 'back'>(view);
  const [err, setErr] = useState('');
  const top = g.type === 'top';
  const list = g.graphics ?? [];
  const gr = list.find((x) => x.id === sel);
  const read = async (f: File | undefined, then: (art: { name: string; src: string; aspect: number }) => void) => {
    if (!f) return;
    try {
      setErr('');
      then(await readArtwork(f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not use that file');
    }
  };
  const sc = top ? { min: 10, max: 160 } : { min: 8, max: 140 };
  return (
    <Fold label="GRAPHICS AND PRINTS" count={list.length + (g.allOver ? 1 : 0)}>
      <div className="grid2">
        {(['front', 'back'] as const).map((s) => (
          <button key={s} className={side === s ? 'opt on' : 'opt'} onClick={() => setSide(s)}>
            {s === 'front' ? 'Front' : 'Back'}
          </button>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        hidden
        data-testid="graphic-file"
        onChange={(e) => {
          void read(e.target.files?.[0], (art) => a().addGraphic(g.id, art, side));
          e.target.value = '';
        }}
      />
      <button className="btn" onClick={() => fileRef.current?.click()} data-testid="add-graphic">
        Upload artwork (PNG, JPG, SVG)
      </button>
      {err && <p className="hint err">{err}</p>}
      {list.map((x) => (
        <button key={x.id} className={x.id === sel ? 'grow on' : 'grow'} onClick={() => a().selectGraphic(x.id)}>
          <img src={x.src} alt="" />
          <span className="gname">{x.name}</span>
          <span className="mono small muted">
            {x.side}, {x.method}
          </span>
        </button>
      ))}
      {gr && (
        <div className="gedit" data-testid="graphic-editor">
          <div className="opts">
            {PRINT_METHODS.map((m) => (
              <button key={m} className={gr.method === m ? 'opt on' : 'opt'} onClick={() => a().setGraphic(g.id, gr.id, { method: m as PrintMethod })}>
                {m}
              </button>
            ))}
          </div>
          <div className="grid2">
            {(['front', 'back'] as const).map((s) => (
              <button key={s} className={gr.side === s ? 'opt on' : 'opt'} onClick={() => a().setGraphic(g.id, gr.id, { side: s })}>
                On {s}
              </button>
            ))}
          </div>
          <Slider label="Width" value={gr.w} min={sc.min} max={sc.max} step={1} unit="px" onChange={(n) => a().setGraphic(g.id, gr.id, { w: n }, `gw:${gr.id}`)} />
          <Slider label="Rotate" value={gr.rot} min={-180} max={180} step={1} unit="deg" onChange={(n) => a().setGraphic(g.id, gr.id, { rot: n }, `gr:${gr.id}`)} />
          <Slider label="Across" value={gr.x} min={20} max={280} step={1} unit="" onChange={(n) => a().setGraphic(g.id, gr.id, { x: n }, `gx:${gr.id}`)} />
          <Slider label="Down" value={gr.y} min={top ? 70 : 20} max={top ? 330 : 500} step={1} unit="" onChange={(n) => a().setGraphic(g.id, gr.id, { y: n }, `gy:${gr.id}`)} />
          <p className="hint">Drag it on the canvas to place it. It is clipped to the garment.</p>
          <button className="btn" onClick={() => a().removeGraphic(g.id, gr.id)}>
            Remove graphic
          </button>
        </div>
      )}

      <h4 className="label sub">ALL-OVER PRINT</h4>
      <input
        ref={allRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        hidden
        data-testid="allover-file"
        onChange={(e) => {
          void read(e.target.files?.[0], (art) => a().setAllOver(g.id, art));
          e.target.value = '';
        }}
      />
      <div className="grid2">
        <button className="btn" onClick={() => allRef.current?.click()} data-testid="add-allover">
          {g.allOver ? 'Replace image' : 'Use image as fabric'}
        </button>
        <button className="btn" disabled={!g.allOver} onClick={() => a().setAllOver(g.id, null)}>
          Remove
        </button>
      </div>
      {g.allOver && (
        <>
          <Slider label="Tile size" value={g.allOver.scale} min={8} max={200} step={1} unit="px" onChange={(n) => a().setAllOverProps(g.id, { scale: n }, `as:${g.id}`)} />
          <Slider label="Rotate" value={g.allOver.rot} min={-90} max={90} step={1} unit="deg" onChange={(n) => a().setAllOverProps(g.id, { rot: n }, `ar:${g.id}`)} />
        </>
      )}
    </Fold>
  );
}

// ---------- trims and hardware ----------

export function TrimsGroup({ g }: { g: Garment }) {
  const a = useStore.getState;
  const [kind, setKind] = useState(TRIM_KINDS[0]);
  const list = g.trims ?? [];
  return (
    <Fold label="TRIMS AND HARDWARE" count={list.length}>
      <div className="prow">
        <select className="psel" aria-label="Trim kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} data-testid="trim-kind">
          {TRIM_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button className="opt" onClick={() => a().addTrim(g.id, kind)} data-testid="add-trim">
          Add
        </button>
      </div>
      {list.map((t) => {
        const sz = TRIM_SIZE[t.kind];
        return (
          <div className="trim" key={t.id} data-testid="trim-row">
            <div className="prow">
              <b className="tkind">{t.kind}</b>
              <button className="iconbtn sm" aria-label={`Remove ${t.kind}`} title="Remove" onClick={() => a().removeTrim(g.id, t.id)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
            <div className="prow">
              <select className="psel" aria-label="Type" value={t.type} onChange={(e) => a().setTrim(g.id, t.id, { type: e.target.value })}>
                {TRIM_TYPES[t.kind].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              {sz && (
                <label className="pfield">
                  <Num label={`${sz.label} (${sz.unit})`} value={t.size} min={sz.min} max={sz.max} step={sz.step} onChange={(n) => a().setTrim(g.id, t.id, { size: n ?? sz.def }, `ts:${t.id}`)} />
                  <span className="muted small">{sz.unit}</span>
                </label>
              )}
            </div>
            <div className="prow">
              <input className="ptext" aria-label="Color or finish" placeholder="Color or finish" value={t.color} onChange={(e) => a().setTrim(g.id, t.id, { color: e.target.value }, `tc:${t.id}`)} />
              <label className="pfield">
                <span className="muted small">Qty</span>
                <Num label="Quantity" value={t.qty} min={1} max={999} onChange={(n) => a().setTrim(g.id, t.id, { qty: Math.max(1, Math.round(n ?? 1)) }, `tq:${t.id}`)} />
              </label>
            </div>
          </div>
        );
      })}
    </Fold>
  );
}

// ---------- fabric content and bill of materials ----------

export function BomGroup({ g }: { g: Garment }) {
  const a = useStore.getState;
  const fi = fabricInfoOf(g);
  const rows = buildBom(g);
  const total = bomTotal(rows);
  return (
    <Fold label="FABRIC AND BILL OF MATERIALS">
      <div className="prow">
        <input className="ptext" aria-label="Fabric content" placeholder="Content, e.g. 100% cotton" value={fi.content} onChange={(e) => a().setFabricInfo(g.id, { content: e.target.value }, `fc:${g.id}`)} />
        <input className="ptext tcx" aria-label="Fabric weight" placeholder="14 oz" value={fi.weight} onChange={(e) => a().setFabricInfo(g.id, { weight: e.target.value }, `fw:${g.id}`)} />
      </div>
      <div className="prow">
        <label className="pfield grow1">
          <span className="muted small">Yards per unit</span>
          <Num label="Yards per unit" value={fi.yards} min={0} max={20} step={0.1} onChange={(n) => a().setFabricInfo(g.id, { yards: n ?? 0 }, `fy:${g.id}`)} />
        </label>
      </div>
      <table className="bomt" data-testid="bom">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Cost ea.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <b>{r.item}</b>
                <span className="muted small"> {r.detail}</span>
              </td>
              <td className="mono">
                {r.qty} {r.unit}
              </td>
              <td>
                <Num label={`Cost for ${r.item}`} value={r.cost} min={0} step={0.01} onChange={(n) => a().setBomCost(g.id, r.key, n, `bc:${g.id}:${r.key}`)} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total cost per unit</td>
            <td className="mono" data-testid="bom-total">
              {money(total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="hint">Line cost is quantity times cost each: {rows.some((r) => rowTotal(r) > 0) ? 'filled in' : 'type a cost to start'}.</p>
    </Fold>
  );
}

// ---------- construction ----------

export function ConstructionGroup({ g }: { g: Garment }) {
  const a = useStore.getState;
  const c = constructionOf(g);
  return (
    <Fold label="CONSTRUCTION">
      <div className="grid2">
        {STITCHES.map((s) => (
          <button key={s.id} className={c.stitch === s.id ? 'opt on' : 'opt'} onClick={() => a().setConstruction(g.id, { stitch: s.id })}>
            {s.id} {s.name.toLowerCase()}
          </button>
        ))}
      </div>
      <Slider label="Stitches per inch" value={c.spi} min={4} max={20} step={1} unit="SPI" onChange={(n) => a().setConstruction(g.id, { spi: n }, `spi:${g.id}`)} />
      <label className="range">
        <span>Seam finish</span>
        <select className="psel full" aria-label="Seam finish" value={c.seam} onChange={(e) => a().setConstruction(g.id, { seam: e.target.value })}>
          {SEAM_FINISHES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="prow">
        <input className="ptext" aria-label="Main thread" placeholder="Main thread color" value={c.threadMain ?? ''} onChange={(e) => a().setConstruction(g.id, { threadMain: e.target.value }, `tm:${g.id}`)} />
        <input className="ptext" aria-label="Topstitch thread" placeholder="Topstitch thread" value={c.threadTop ?? ''} onChange={(e) => a().setConstruction(g.id, { threadTop: e.target.value }, `tt:${g.id}`)} />
      </div>
      <p className="hint">{stitchName(c.stitch)}, {c.spi} SPI, {c.seam.toLowerCase()}. Shown in the tech pack.</p>
    </Fold>
  );
}

/** All the production groups for a garment, below the color group in the inspector. */
export function ProductionGroups({ g }: { g: Garment }) {
  return (
    <>
      <GraphicsGroup g={g} />
      <TrimsGroup g={g} />
      <ConstructionGroup g={g} />
      <BomGroup g={g} />
    </>
  );
}
