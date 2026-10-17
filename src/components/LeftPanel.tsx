import { useState } from 'react';
import { useStore } from '../store';
import type { TopOpts } from '../model/top';
import { SKINS } from '../model/croquis';
import { POSES } from '../model/figure';
import { FIT_NAMES, type Fit } from '../model/garment';
import { Icon } from './icons';

const PANT_ICONS: Record<Fit | 'Jeans', string> = {
  Jeans: 'M8,4 H32 L32,52 H22 L20,16 L18,52 H8 Z',
  Skinny: 'M10,4 H30 L29,52 H22 L20,16 L18,52 H11 Z',
  Slim: 'M9,4 H31 L30,52 H22 L20,16 L18,52 H10 Z',
  Straight: 'M8,4 H32 L32,52 H22 L20,16 L18,52 H8 Z',
  Flare: 'M9,4 H31 L30,30 L35,52 H22 L20,16 L18,52 H5 L10,30 Z',
  Baggy: 'M6,4 H34 L37,52 H22 L20,18 L18,52 H3 Z',
  Wide: 'M5,4 H35 L39,52 H22 L20,18 L18,52 H1 Z',
};

function BasePanel() {
  const base = useStore((s) => s.doc.base);
  const setBase = useStore((s) => s.setBase);
  return (
    <section className="group">
      <h3 className="label">BASE</h3>
      <div className="grid2">
        {(['male', 'female'] as const).map((sex) => (
          <button key={sex} className={base.sex === sex ? 'btn on' : 'btn'} onClick={() => setBase({ sex })}>
            {sex === 'male' ? 'Male' : 'Female'}
          </button>
        ))}
      </div>
      <div className="grid2">
        {(['front', 'back'] as const).map((view) => (
          <button key={view} className={base.view === view ? 'seg on' : 'seg'} onClick={() => setBase({ view })}>
            {view === 'front' ? 'Front' : 'Back'}
          </button>
        ))}
      </div>
      <div className="grid2" aria-label="Pose">
        {POSES.map((p) => (
          <button key={p.id} className={base.pose === p.id ? 'seg on' : 'seg'} onClick={() => setBase({ pose: p.id })}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="swatches" aria-label="Skin tone">
        {SKINS.map((k) => (
          <button
            key={k.id}
            className={base.skin === k.id ? 'skin on' : 'skin'}
            style={{ background: k.color }}
            title={k.id}
            aria-label={`Skin tone ${k.id}`}
            onClick={() => setBase({ skin: k.id })}
          />
        ))}
      </div>
    </section>
  );
}

const TOP_ITEMS: { name: string; o: TopOpts; icon: string }[] = [
  { name: 'Tank', o: { block: 'Tank', fit: 'Fitted', length: 'Waist', neck: 'Scoop', tuck: false }, icon: 'M14,6 L17,6 Q20,16 23,6 L26,6 L28,20 L29,46 L11,46 L12,20 Z' },
  { name: 'Baby tee', o: { block: 'Tee', fit: 'Fitted', length: 'Crop', neck: 'Crew', tuck: false }, icon: 'M14,10 Q20,14 26,10 L33,14 L31,22 L27,20 L27,36 L13,36 L13,20 L9,22 L7,14 Z' },
  { name: 'Tee', o: { block: 'Tee', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M14,8 Q20,12 26,8 L34,13 L31,23 L27,21 L28,46 L12,46 L13,21 L9,23 L6,13 Z' },
  { name: 'Oversized', o: { block: 'Tee', fit: 'Oversized', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M13,8 Q20,12 27,8 L37,15 L33,27 L29,25 L30,50 L10,50 L11,25 L7,27 L3,15 Z' },
  { name: 'Long sleeve', o: { block: 'Long sleeve', fit: 'Fitted', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M14,8 Q20,12 26,8 L32,12 L36,44 L32,45 L27,20 L27,46 L13,46 L13,20 L8,45 L4,44 L8,12 Z' },
];

function LibraryPanel() {
  const addJeans = useStore((s) => s.addJeans);
  const addTop = useStore((s) => s.addTop);
  const [cat, setCat] = useState<'Tops' | 'Bottoms'>('Bottoms');
  const items: { name: string; fit: Fit; icon: string }[] = [
    { name: 'Jeans', fit: 'Straight', icon: PANT_ICONS.Jeans },
    ...FIT_NAMES.map((f) => ({ name: f, fit: f, icon: PANT_ICONS[f] })),
  ];
  return (
    <section className="group">
      <h3 className="label">LIBRARY</h3>
      <div className="chips">
        {(['Tops', 'Outerwear', 'Bottoms', 'Dresses', 'Shoes'] as const).map((c) => {
          const live = c === 'Tops' || c === 'Bottoms';
          return live ? (
            <button key={c} className={c === cat ? 'chip on' : 'chip'} onClick={() => setCat(c)}>
              {c}
            </button>
          ) : (
            <span key={c} className="chip off" title="Coming later">
              {c}
            </span>
          );
        })}
      </div>
      <div className="grid3">
        {cat === 'Bottoms'
          ? items.map((it) => (
              <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}${it.name === 'Jeans' ? '' : ' jeans'}`} onClick={() => addJeans(it.fit)}>
                <svg width="40" height="56" viewBox="0 0 42 56" aria-hidden="true">
                  <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{it.name}</span>
              </button>
            ))
          : TOP_ITEMS.map((it) => (
              <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}`} onClick={() => addTop({ ...it.o })}>
                <svg width="40" height="56" viewBox="0 0 40 56" aria-hidden="true">
                  <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{it.name}</span>
              </button>
            ))}
      </div>
      <p className="hint">Click a block and it fits onto the body. Then edit it.</p>
    </section>
  );
}

function LayersPanel() {
  const garments = useStore((s) => s.doc.garments);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const toggleVisible = useStore((s) => s.toggleVisible);
  const moveLayer = useStore((s) => s.moveLayer);
  const base = useStore((s) => s.doc.base);
  const rows = garments.map((g, i) => ({ g, n: i + 1, i })).reverse();
  return (
    <section className="group">
      <h3 className="label">LAYERS</h3>
      <div className="layers">
        {rows.length === 0 && <p className="hint">No garments yet.</p>}
        {rows.map(({ g, n, i }) => (
          <div key={g.id} className={g.id === selectedId ? 'layer on' : 'layer'} data-testid="layer">
            <button className="iconbtn sm" aria-label={g.visible ? 'Hide layer' : 'Show layer'} title={g.visible ? 'Hide' : 'Show'} onClick={() => toggleVisible(g.id)}>
              <Icon name={g.visible ? 'eye' : 'eyeoff'} size={16} />
            </button>
            <button className="layername" onClick={() => select(g.id)} style={{ opacity: g.visible ? 1 : 0.5 }}>
              <span className="mono muted">{n}</span> {g.name}
            </button>
            <button className="iconbtn sm" aria-label="Move layer up" title="Move up" disabled={i === garments.length - 1} onClick={() => moveLayer(g.id, 1)}>
              <Icon name="up" size={16} />
            </button>
            <button className="iconbtn sm" aria-label="Move layer down" title="Move down" disabled={i === 0} onClick={() => moveLayer(g.id, -1)}>
              <Icon name="down" size={16} />
            </button>
          </div>
        ))}
        <div className="layer base">
          <span className="layername muted">
            <span className="mono">0</span> Croquis, {base.sex} {base.view}, {POSES.find((p) => p.id === base.pose)?.label.toLowerCase()}
          </span>
        </div>
      </div>
    </section>
  );
}

export function LeftPanel() {
  return (
    <aside className="panel left">
      <BasePanel />
      <LibraryPanel />
      <LayersPanel />
    </aside>
  );
}
