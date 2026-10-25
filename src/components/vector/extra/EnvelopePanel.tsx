// Envelope Distort controls: presets, amount, reset, expand.
import { useStore } from '../../../store';
import { cancelEnvelope, ENV_PRESETS, expandEnvelope, resetEnvelope, setEnvPreset, startEnvelope, useEnvelope } from '../../../vector/ops/envelope';
import { Section } from '../VectorPanels';

function Controls() {
  const e = useEnvelope();
  const n = useStore((s) => s.vsel.length);
  if (!e.active) {
    return (
      <>
        <div className="opts">
          <button className="opt" disabled={!n} data-testid="env-start" onClick={() => startEnvelope()}>
            Make envelope
          </button>
        </div>
        <p className="hint small muted">{e.msg || 'Warp a graphic or print with a 4 x 4 mesh.'}</p>
      </>
    );
  }
  return (
    <>
      <div className="opts">
        {ENV_PRESETS.map((p) => (
          <button key={p.id} className={e.preset === p.id ? 'opt on' : 'opt'} data-env={p.id} onClick={() => setEnvPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="numfield">
        <span className="muted small">Amount</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(e.amount * 100)}
          onChange={(ev) => {
            const a = Number(ev.target.value) / 100;
            if (e.preset) setEnvPreset(e.preset, a);
            else useEnvelope.getState().set({ amount: a });
          }}
          aria-label="Envelope amount"
          style={{ width: 110 }}
        />
      </label>
      <div className="opts">
        <button className="opt" onClick={resetEnvelope}>Reset</button>
        <button className="opt on" data-testid="env-expand" onClick={expandEnvelope}>Expand to paths</button>
        <button className="opt" onClick={cancelEnvelope}>Cancel</button>
      </div>
    </>
  );
}

export function EnvelopePanel({ bar }: { bar?: boolean }) {
  if (bar) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Controls />
      </div>
    );
  }
  return (
    <Section label="ENVELOPE DISTORT">
      <Controls />
    </Section>
  );
}
