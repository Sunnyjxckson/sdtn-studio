import { useStore } from '../store';
import {
  computeSpec,
  FABRIC_NAMES,
  findPoint,
  PX_IN_H,
  PX_IN_V,
  FIT_NAMES,
  HOLE_SIZES,
  POCKET_NAMES,
  RISE_NAMES,
  TEXT_SIZES,
  WAIST_NAMES,
  WASHES,
  WASH_NAMES,
  type HoleSize,
} from '../model/garment';
import { Icon } from './icons';
import { computeTopSpec, NECKS, TOP_BLOCKS, TOP_FITS, TOP_LENGTHS } from '../model/top';
import { torsoProfile } from '../model/figure';
import { TOP_FABRICS, type Garment } from '../model/garment';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="group">
      <h3 className="label">{label}</h3>
      {children}
    </section>
  );
}

function Options<T extends string>({ names, value, onPick }: { names: readonly T[]; value: T; onPick: (n: T) => void }) {
  return (
    <div className="opts">
      {names.map((n) => (
        <button key={n} className={n === value ? 'opt on' : 'opt'} onClick={() => onPick(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function RightPanel() {
  const g = useStore((s) => s.doc.garments.find((x) => x.id === s.selectedId));
  const tool = useStore((s) => s.tool);
  const selText = useStore((s) => s.selectedText);
  const holeSize = useStore((s) => s.holeSize);
  const a = useStore.getState; // actions are stable

  const note = useStore((s) => s.doc.notes.find((n) => n.id === s.selectedNote));
  if (!g && note) {
    return (
      <aside className="panel right">
        <div className="titlerow">
          <span className="title">Note</span>
          <button className="iconbtn" aria-label="Delete note" title="Delete note" onClick={() => a().removeNote(note.id)}>
            <Icon name="trash" size={16} />
          </button>
        </div>
        <section className="group textbox">
          <label className="label" htmlFor="notetext">NOTE TEXT</label>
          <input id="notetext" type="text" value={note.text} onChange={(e) => a().setNoteText(note.id, e.target.value)} />
          <p className="hint">Drag the note to move it. Drag the red dot to aim the arrow.</p>
        </section>
      </aside>
    );
  }
  if (!g) {
    return (
      <aside className="panel right">
        <div className="empty">
          <h2>No garment selected</h2>
          <p className="muted">Pick a block from the Library to put jeans on the body, or click a garment on the canvas.</p>
        </div>
      </aside>
    );
  }
  if (g.type === 'top') return <TopPanel g={g} />;
  const spec = computeSpec(g);
  const p = g.points;
  const hemY = Math.max(findPoint(p, 'hemLo').y, findPoint(p, 'hemLi').y);
  const sliders = [
    { m: 'inseam' as const, label: 'Length', v: (hemY - findPoint(p, 'crotch').y) / PX_IN_V, min: 22, max: 32 },
    { m: 'knee' as const, label: 'Knee', v: Math.abs(findPoint(p, 'kneeLi').x - findPoint(p, 'kneeLo').x) / PX_IN_H, min: 6, max: 14 },
    { m: 'opening' as const, label: 'Leg opening', v: Math.abs(findPoint(p, 'hemLi').x - findPoint(p, 'hemLo').x) / PX_IN_H, min: 6, max: 18 },
  ];
  const text = selText != null ? g.texts[selText] : undefined;

  return (
    <aside className="panel right">
      <div className="titlerow">
        <span className="title">{g.name}</span>
        <button className="iconbtn" aria-label="Delete garment" title="Delete garment" onClick={() => a().removeGarment(g.id)}>
          <Icon name="trash" size={16} />
        </button>
      </div>

      {text && selText != null && (
        <section className="group textbox">
          <label className="label" htmlFor="seltext">SELECTED TEXT</label>
          <input
            id="seltext"
            type="text"
            value={text.t}
            onChange={(e) => a().setTextValue(g.id, selText, e.target.value)}
          />
          <div className="opts">
            {Object.entries(TEXT_SIZES).map(([name, size]) => (
              <button key={name} className={text.size === size ? 'opt on' : 'opt'} onClick={() => a().setTextSize(g.id, selText, size)}>
                {name}
              </button>
            ))}
          </div>
        </section>
      )}

      {tool === 'hole' && (
        <Group label="HOLE SIZE">
          <div className="opts">
            {(Object.keys(HOLE_SIZES) as HoleSize[]).map((n) => (
              <button key={n} className={holeSize === n ? 'opt on' : 'opt'} onClick={() => a().setHoleSize(n)}>
                {n}
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group label="FIT">
        <div className="grid3">
          {FIT_NAMES.map((n) => (
            <button key={n} className={n === g.fit ? 'opt on' : 'opt'} onClick={() => a().setFit(g.id, n)}>
              {n}
            </button>
          ))}
        </div>
        <Options names={RISE_NAMES} value={g.rise} onPick={(n) => a().setRise(g.id, n)} />
        <p className="hint">Picking a fit or rise resets the outline. Holes, rips, text and cuts stay.</p>
      </Group>

      <Group label="SHAPE">
        {sliders.map((sl) => (
          <label key={sl.m} className="range">
            <span>
              {sl.label}
              <span className="mono">{(Math.round(sl.v * 2) / 2).toFixed(1)} in</span>
            </span>
            <input
              type="range"
              min={sl.min}
              max={sl.max}
              step={0.5}
              value={Math.min(sl.max, Math.max(sl.min, Math.round(sl.v * 2) / 2))}
              onChange={(e) => a().setMeasure(g.id, sl.m, Number(e.target.value))}
            />
          </label>
        ))}
        <p className="hint">The pattern pieces follow these numbers.</p>
      </Group>

      <Group label="FABRIC">
        <div className="grid3">
          {FABRIC_NAMES.map((n) => (
            <button key={n} className={n === g.fabric ? 'opt on' : 'opt'} onClick={() => a().setFabric(g.id, n)}>
              {n}
            </button>
          ))}
        </div>
        <label className="range">
          <span>
            Pattern scale
            <span className="mono">{g.fabricScale.toFixed(1)}x</span>
          </span>
          <input type="range" min={0.5} max={3} step={0.1} value={g.fabricScale} onChange={(e) => a().setFabricScale(g.id, Number(e.target.value))} />
        </label>
        <p className="hint">Fabric shows in the Rendered look.</p>
      </Group>

      <Group label="DETAILS">
        <Options names={WAIST_NAMES} value={g.parts.waist} onPick={(n) => a().setWaist(g.id, n)} />
        <Options names={POCKET_NAMES} value={g.parts.pocket} onPick={(n) => a().setPocket(g.id, n)} />
      </Group>

      <Group label="COLOR">
        <div className="washes">
          {WASH_NAMES.map((n) => (
            <button
              key={n}
              className={n === g.wash ? 'wash on' : 'wash'}
              style={{ background: WASHES[n] }}
              aria-label={n}
              title={n}
              onClick={() => a().setWash(g.id, n)}
            />
          ))}
        </div>
      </Group>

      {g.cropY != null && (
        <button className="btn" onClick={() => a().clearCut(g.id)}>Remove cut line</button>
      )}

      <section className="group spec">
        <h3 className="label">SPEC FROM YOUR DRAWING</h3>
        <table data-testid="spec">
          <tbody>
            {spec.map((r) => (
              <tr key={r.k}>
                <td className="muted">{r.k}</td>
                <td className="mono">{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </aside>
  );
}

function TopPanel({ g }: { g: Garment }) {
  const a = useStore.getState;
  const tool = useStore((s) => s.tool);
  const selText = useStore((s) => s.selectedText);
  const holeSize = useStore((s) => s.holeSize);
  const base = useStore((s) => s.doc.base);
  const o = g.top!;
  const spec = computeTopSpec(g.points, torsoProfile(base.sex, base.pose));
  const text = selText != null ? g.texts[selText] : undefined;
  return (
    <aside className="panel right">
      <div className="titlerow">
        <span className="title">{g.name}</span>
        <button className="iconbtn" aria-label="Delete garment" title="Delete garment" onClick={() => a().removeGarment(g.id)}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      {text && selText != null && (
        <section className="group textbox">
          <label className="label" htmlFor="seltext">SELECTED TEXT</label>
          <input id="seltext" type="text" value={text.t} onChange={(e) => a().setTextValue(g.id, selText, e.target.value)} />
          <div className="opts">
            {Object.entries(TEXT_SIZES).map(([name, size]) => (
              <button key={name} className={text.size === size ? 'opt on' : 'opt'} onClick={() => a().setTextSize(g.id, selText, size)}>
                {name}
              </button>
            ))}
          </div>
        </section>
      )}
      {tool === 'hole' && (
        <Group label="HOLE SIZE">
          <div className="opts">
            {(Object.keys(HOLE_SIZES) as HoleSize[]).map((n) => (
              <button key={n} className={holeSize === n ? 'opt on' : 'opt'} onClick={() => a().setHoleSize(n)}>
                {n}
              </button>
            ))}
          </div>
        </Group>
      )}
      <Group label="BLOCK">
        <Options names={TOP_BLOCKS} value={o.block} onPick={(n) => a().setTop(g.id, { block: n })} />
      </Group>
      <Group label="FIT">
        <Options names={TOP_FITS} value={o.fit} onPick={(n) => a().setTop(g.id, { fit: n })} />
        <Options names={TOP_LENGTHS} value={o.length} onPick={(n) => a().setTop(g.id, { length: n })} />
        <Options names={NECKS} value={o.neck} onPick={(n) => a().setTop(g.id, { neck: n })} />
        <div className="opts">
          <button className={o.tuck ? 'opt on' : 'opt'} onClick={() => a().setTop(g.id, { tuck: !o.tuck })}>
            Tucked in
          </button>
        </div>
        <p className="hint">These reset the outline to fit the body again. Drag the dots to change it.</p>
      </Group>
      <Group label="FABRIC">
        <div className="grid3">
          {TOP_FABRICS.map((n) => (
            <button key={n} className={n === g.fabric ? 'opt on' : 'opt'} onClick={() => a().setFabric(g.id, n)}>
              {n}
            </button>
          ))}
        </div>
      </Group>
      <Group label="COLOR">
        <div className="washes">
          {WASH_NAMES.map((n) => (
            <button key={n} className={n === g.wash ? 'wash on' : 'wash'} style={{ background: WASHES[n] }} aria-label={n} title={n} onClick={() => a().setWash(g.id, n)} />
          ))}
        </div>
      </Group>
      <section className="group spec">
        <h3 className="label">SPEC FROM YOUR DRAWING</h3>
        <table data-testid="spec">
          <tbody>
            {spec.map((r) => (
              <tr key={r.k}>
                <td className="muted">{r.k}</td>
                <td className="mono">{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Sample size, measured against the croquis.</p>
      </section>
    </aside>
  );
}
