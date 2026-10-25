// Live effects: drop shadow and outer glow, plus per object opacity (the Opacity field in Appearance).
import { type VStyle } from '../../../model/vector';
import { editStyle } from '../../../vector/edit';
import { defaultGlow, defaultShadow } from '../../../vector/effects';
import { NumField, Section, useShownStyle } from '../VectorPanels';

const set = (fn: (x: VStyle) => void, key?: string) => editStyle((x) => fn(x as VStyle), key);

function ColorIn({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <label className="numfield">
      <span className="muted small">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label} style={{ width: 28, height: 22, padding: 0, border: 0, background: 'none' }} />
    </label>
  );
}

export function EffectsPanel() {
  const s = useShownStyle();
  const sh = s.shadow;
  const gl = s.glow;
  return (
    <Section label="EFFECTS">
      <div className="opts">
        <button
          className={sh?.on ? 'opt on' : 'opt'}
          aria-pressed={!!sh?.on}
          data-testid="fx-shadow"
          onClick={() => set((x) => void (x.shadow = x.shadow ? { ...x.shadow, on: !x.shadow.on } : defaultShadow()))}
        >
          Drop shadow
        </button>
        <button
          className={gl?.on ? 'opt on' : 'opt'}
          aria-pressed={!!gl?.on}
          data-testid="fx-glow"
          onClick={() => set((x) => void (x.glow = x.glow ? { ...x.glow, on: !x.glow.on } : defaultGlow()))}
        >
          Outer glow
        </button>
      </div>
      {sh?.on && (
        <>
          <div className="vrow2">
            <NumField label="X" value={sh.dx} onChange={(n) => set((x) => void (x.shadow && (x.shadow.dx = n)), 'sh-dx')} />
            <NumField label="Y" value={sh.dy} onChange={(n) => set((x) => void (x.shadow && (x.shadow.dy = n)), 'sh-dy')} />
            <NumField label="Blur" value={sh.blur} min={0} max={60} onChange={(n) => set((x) => void (x.shadow && (x.shadow.blur = n)), 'sh-b')} />
          </div>
          <div className="vrow2">
            <NumField label="Opacity" value={Math.round(sh.a * 100)} min={0} max={100} suffix="%" w={44} onChange={(n) => set((x) => void (x.shadow && (x.shadow.a = n / 100)), 'sh-a')} />
            <ColorIn label="Shadow color" value={sh.color} onChange={(c) => set((x) => void (x.shadow && (x.shadow.color = c)), 'sh-c')} />
          </div>
        </>
      )}
      {gl?.on && (
        <div className="vrow2">
          <NumField label="Glow blur" value={gl.blur} min={0} max={60} onChange={(n) => set((x) => void (x.glow && (x.glow.blur = n)), 'gl-b')} />
          <NumField label="Opacity" value={Math.round(gl.a * 100)} min={0} max={100} suffix="%" w={44} onChange={(n) => set((x) => void (x.glow && (x.glow.a = n / 100)), 'gl-a')} />
          <ColorIn label="Glow color" value={gl.color} onChange={(c) => set((x) => void (x.glow && (x.glow.color = c)), 'gl-c')} />
        </div>
      )}
    </Section>
  );
}
