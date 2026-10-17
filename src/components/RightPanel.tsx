import { useStore } from '../store';
import {
  computeSpec,
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
  const spec = computeSpec(g);
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

      <Group label="DETAILS">
        <Options names={WAIST_NAMES} value={g.parts.waist} onPick={(n) => a().setWaist(g.id, n)} />
        <Options names={POCKET_NAMES} value={g.parts.pocket} onPick={(n) => a().setPocket(g.id, n)} />
      </Group>

      <Group label="WASH">
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
