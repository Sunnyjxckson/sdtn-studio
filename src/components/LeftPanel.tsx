import { useState } from 'react';
import { useStore } from '../store';
import type { TopOpts } from '../model/top';
import { SKINS } from '../model/croquis';
import { POSES } from '../model/figure';
import { FIT_NAMES, SHORTS_LENGTH_NAMES, SKIRT_SHAPE_NAMES, type Fit, type ShortsLength, type SkirtShape } from '../model/garment';
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

/** Shorts silhouette: legs end at endY, and open out by flare. */
const shortsIcon = (endY: number, flare: number) => `M8,6 H32 L${34 + flare},${endY} H22 L20,${Math.min(endY - 4, 22)} L18,${endY} H${6 - flare} Z`;
const SHORTS_ICONS: Record<ShortsLength, string> = {
  Micro: shortsIcon(22, 0),
  Short: shortsIcon(28, 0),
  'Mid-thigh': shortsIcon(36, 1),
  Knee: shortsIcon(44, 2),
  Jorts: shortsIcon(52, 5),
};
const SKIRT_ICONS: Record<SkirtShape, string> = {
  Pencil: 'M11,6 H29 L27,46 H13 Z M20,12 V44',
  'A-line': 'M12,6 H28 L37,46 H3 Z',
  Pleated: 'M12,6 H28 L37,46 H3 Z M16,12 L11,46 M20,12 V46 M24,12 L29,46',
  Wrap: 'M12,6 H28 L37,46 H3 Z M16,6 Q22,26 30,46',
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

const HOODIE_ITEMS: typeof TOP_ITEMS = [
  { name: 'Hoodie', o: { block: 'Hoodie', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M15,6 Q20,2 25,6 L33,12 L36,44 L31,45 L28,22 L29,42 L11,42 L12,22 L9,45 L4,44 L7,12 Z M16,28 H24 L26,38 H14 Z' },
  { name: 'Oversized hoodie', o: { block: 'Hoodie', fit: 'Oversized', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M14,6 Q20,1 26,6 L36,13 L38,46 L32,47 L29,26 L31,46 L9,46 L11,26 L8,47 L2,46 L4,13 Z M15,30 H25 L28,42 H12 Z' },
  { name: 'Cropped hoodie', o: { block: 'Hoodie', fit: 'Fitted', length: 'Waist', neck: 'Crew', tuck: false }, icon: 'M15,6 Q20,2 25,6 L33,12 L36,40 L31,41 L28,20 L28,34 L12,34 L12,20 L9,41 L4,40 L7,12 Z' },
];

const OUTER_ITEMS: typeof TOP_ITEMS = [
  { name: 'Moto jacket', o: { block: 'Moto jacket', fit: 'Fitted', length: 'Waist', neck: 'V', tuck: false }, icon: 'M13,7 L18,6 L20,16 L22,6 L27,7 L33,12 L36,44 L31,45 L28,20 L28,38 L12,38 L12,20 L9,45 L4,44 L7,12 Z M20,16 L16,38' },
  { name: 'Long moto', o: { block: 'Moto jacket', fit: 'Regular', length: 'Hip', neck: 'V', tuck: false }, icon: 'M13,7 L18,6 L20,16 L22,6 L27,7 L33,12 L36,44 L31,45 L28,20 L28,44 L12,44 L12,20 L9,45 L4,44 L7,12 Z M20,16 L16,44' },
  { name: 'Oversized moto', o: { block: 'Moto jacket', fit: 'Oversized', length: 'Hip', neck: 'V', tuck: false }, icon: 'M12,7 L18,6 L20,16 L22,6 L28,7 L37,13 L39,46 L33,47 L30,24 L31,44 L9,44 L10,24 L7,47 L1,46 L3,13 Z M20,16 L15,44' },
];

const DRESS_ITEMS: typeof TOP_ITEMS = [
  { name: 'Slip dress', o: { block: 'Dress', fit: 'Regular', length: 'Hip', neck: 'Scoop', tuck: false, silhouette: 'Slip', dressLen: 'Midi', dressTop: 'Straps' }, icon: 'M15,4 L17,4 L19,14 L21,14 L23,4 L25,4 L27,18 L26,26 L31,54 L9,54 L14,26 L13,18 Z' },
  { name: 'Bodycon', o: { block: 'Dress', fit: 'Fitted', length: 'Hip', neck: 'Crew', tuck: false, silhouette: 'Bodycon', dressLen: 'Mini', dressTop: 'Strapless' }, icon: 'M12,10 L28,10 L27,20 L25,28 L27,40 L13,40 L15,28 L13,20 Z' },
  { name: 'A-line', o: { block: 'Dress', fit: 'Fitted', length: 'Hip', neck: 'Scoop', tuck: false, silhouette: 'A-line', dressLen: 'Midi', dressTop: 'Wide strap' }, icon: 'M14,4 L17,4 Q20,12 23,4 L26,4 L27,22 L35,52 L5,52 L13,22 Z' },
  { name: 'Maxi', o: { block: 'Dress', fit: 'Regular', length: 'Hip', neck: 'V', tuck: false, silhouette: 'Slip', dressLen: 'Maxi', dressTop: 'Straps' }, icon: 'M15,4 L17,4 L19,16 L21,16 L23,4 L25,4 L27,20 L26,28 L30,56 L10,56 L14,28 L13,20 Z' },
  { name: 'Sleeve dress', o: { block: 'Dress', fit: 'Fitted', length: 'Hip', neck: 'Crew', tuck: false, silhouette: 'Bodycon', dressLen: 'Midi', dressTop: 'Long sleeve' }, icon: 'M14,6 Q20,10 26,6 L32,10 L35,34 L31,35 L28,18 L28,28 L26,50 L14,50 L12,28 L12,18 L9,35 L5,34 L8,10 Z' },
  { name: 'Mini', o: { block: 'Dress', fit: 'Fitted', length: 'Hip', neck: 'V', tuck: false, silhouette: 'A-line', dressLen: 'Mini', dressTop: 'Short sleeve' }, icon: 'M14,6 Q20,12 26,6 L33,10 L31,18 L28,16 L28,24 L33,40 L7,40 L12,24 L12,16 L9,18 L7,10 Z' },
];

function LibraryPanel() {
  const addJeans = useStore((s) => s.addJeans);
  const addTop = useStore((s) => s.addTop);
  const addShorts = useStore((s) => s.addShorts);
  const addSkirt = useStore((s) => s.addSkirt);
  const [cat, setCat] = useState<'Tops' | 'Outerwear' | 'Bottoms' | 'Dresses'>('Bottoms');
  const items: { name: string; fit: Fit; icon: string }[] = [
    { name: 'Jeans', fit: 'Straight', icon: PANT_ICONS.Jeans },
    ...FIT_NAMES.map((f) => ({ name: f, fit: f, icon: PANT_ICONS[f] })),
  ];
  return (
    <section className="group">
      <h3 className="label">LIBRARY</h3>
      <div className="chips">
        {(['Tops', 'Outerwear', 'Bottoms', 'Dresses', 'Shoes'] as const).map((c) => {
          const live = c !== 'Shoes';
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
      {cat === 'Bottoms' ? (
        <>
          <p className="hint sub">Jeans</p>
          <div className="grid3">
            {items.map((it) => (
              <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}${it.name === 'Jeans' ? '' : ' jeans'}`} onClick={() => addJeans(it.fit)}>
                <svg width="40" height="56" viewBox="0 0 42 56" aria-hidden="true">
                  <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{it.name}</span>
              </button>
            ))}
          </div>
          <p className="hint sub">Shorts</p>
          <div className="grid3">
            {SHORTS_LENGTH_NAMES.map((n) => (
              <button key={n} className="block" title={n === 'Jorts' ? 'Add jorts' : `Add ${n.toLowerCase()} shorts`} onClick={() => addShorts(n)}>
                <svg width="40" height="56" viewBox="0 0 42 56" aria-hidden="true">
                  <path d={SHORTS_ICONS[n]} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{n}</span>
              </button>
            ))}
          </div>
          <p className="hint sub">Skirts</p>
          <div className="grid3">
            {SKIRT_SHAPE_NAMES.map((n) => (
              <button key={n} className="block" title={`Add ${n.toLowerCase()} skirt`} onClick={() => addSkirt(n)}>
                <svg width="40" height="56" viewBox="0 0 42 56" aria-hidden="true">
                  <path d={SKIRT_ICONS[n]} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{n}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid3">
          {(cat === 'Tops' ? [...TOP_ITEMS, ...HOODIE_ITEMS] : cat === 'Outerwear' ? OUTER_ITEMS : DRESS_ITEMS).map((it) => (
            <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}`} onClick={() => addTop({ ...it.o })}>
              <svg width="40" height="56" viewBox="0 0 40 56" aria-hidden="true">
                <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
              </svg>
              <span>{it.name}</span>
            </button>
          ))}
        </div>
      )}
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
