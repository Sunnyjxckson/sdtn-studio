import { useState } from 'react';
import { useStore } from '../store';
import type { TopOpts } from '../model/top';
import { SKINS } from '../model/croquis';
import { POSES } from '../model/figure';
import { FIT_NAMES, SHORTS_LENGTH_NAMES, SKIRT_SHAPE_NAMES, type Fit, type HemKind, type PantsOpts, type ShortsLength, type ShortsStyle, type SkirtShape } from '../model/garment';
import type { ShoeOpts } from '../model/shoes';
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
const SHORTS_STYLE_ITEMS: { name: string; style: ShortsStyle; hem?: HemKind; icon: string }[] = [
  { name: 'Sweatshorts', style: 'Sweat', icon: shortsIcon(40, 2) + ' M17,6 L17,12 M23,6 L23,12' },
  { name: 'Raw sweats', style: 'Sweat', hem: 'Raw', icon: shortsIcon(40, 2) + ' M17,6 L17,12 M23,6 L23,12 M8,40 l1,3 M13,40 l1,3 M28,40 l1,3' },
  { name: 'Mesh', style: 'Mesh', icon: shortsIcon(46, 3) + ' M10,8 L8,45 M30,8 L32,45' },
  { name: 'Cargo shorts', style: 'Cargo', icon: shortsIcon(44, 2) + ' M7,26 H13 V34 H7 Z M27,26 H33 V34 H27 Z' },
];
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

const T = (block: TopOpts['block'], fit: TopOpts['fit'], length: TopOpts['length'], extra: Partial<TopOpts> = {}): TopOpts => ({ block, fit, length, neck: 'Crew', tuck: false, ...extra });
const TEE_BODY = 'M14,8 Q20,12 26,8 L34,13 L31,23 L27,21 L28,46 L12,46 L13,21 L9,23 L6,13 Z';
const STREET_ITEMS: typeof TOP_ITEMS = [
  { name: 'Cropped boxy tee', o: T('Tee', 'Boxy', 'Crop'), icon: 'M13,12 Q20,16 27,12 L37,16 L35,25 L30,24 L31,36 L9,36 L10,24 L5,25 L3,16 Z' },
  { name: 'Boxy tee', o: T('Tee', 'Boxy', 'Hip'), icon: 'M13,9 Q20,13 27,9 L37,14 L35,24 L30,23 L31,42 L9,42 L10,23 L5,24 L3,14 Z' },
  { name: 'Raglan tee', o: T('Tee', 'Regular', 'Hip', { sleeveStyle: 'Raglan' }), icon: TEE_BODY + ' M15,9 L13,21 M25,9 L27,21' },
  { name: 'Drop shoulder', o: T('Tee', 'Regular', 'Hip', { sleeveStyle: 'Dropped' }), icon: 'M14,8 Q20,12 26,8 L36,15 L33,26 L29,24 L28,46 L12,46 L11,24 L7,26 L4,15 Z M12,16 L11,24 M28,16 L29,24' },
  { name: 'Longline tee', o: T('Tee', 'Regular', 'Long', { hem: 'Curved' }), icon: 'M14,6 Q20,10 26,6 L34,11 L31,21 L27,19 L28,46 Q20,52 12,46 L13,19 L9,21 L6,11 Z' },
  { name: 'Ringer tee', o: T('Tee', 'Regular', 'Hip', { ringer: true }), icon: TEE_BODY + ' M14,10.5 Q20,14.5 26,10.5 M7.2,18.5 L11,20.5 M32.8,18.5 L29,20.5' },
  { name: 'Mock neck', o: T('Mock neck', 'Fitted', 'Hip'), icon: 'M15,4 L25,4 L26,9 L32,12 L36,44 L32,45 L27,20 L27,46 L13,46 L13,20 L8,45 L4,44 L8,12 L14,9 Z M15,7.5 H25' },
  { name: 'Quarter zip', o: T('Quarter zip', 'Regular', 'Hip'), icon: 'M14,4 L26,4 L27,9 L33,12 L36,42 L31,43 L28,22 L29,44 L11,44 L12,22 L9,43 L4,42 L7,12 L13,9 Z M20,4 V19 M11,40 H29' },
  { name: 'Raglan sweat', o: T('Sweatshirt', 'Regular', 'Hip', { sleeveStyle: 'Raglan' }), icon: 'M14,7 Q20,11 26,7 L33,12 L36,42 L31,43 L28,22 L29,44 L11,44 L12,22 L9,43 L4,42 L7,12 Z M11,40 H29 M15,8.5 L12,22 M25,8.5 L28,22' },
];

const SHIRT_ITEMS: typeof TOP_ITEMS = [
  { name: 'Button-up', o: { block: 'Button-up', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false, sleeve: 'Long' }, icon: 'M14,6 L20,12 L26,6 L33,11 L36,43 L31,44 L28,20 L28,46 L12,46 L12,20 L9,44 L4,43 L7,11 Z M20,12 V46 M16,4 L20,12 L24,4' },
  { name: 'Camp shirt', o: { block: 'Button-up', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false, sleeve: 'Short' }, icon: 'M14,7 L20,13 L26,7 L34,12 L31,22 L27,20 L28,46 L12,46 L13,20 L9,22 L6,12 Z M20,13 V46 M16,5 L20,13 L24,5' },
  { name: 'Polo', o: { block: 'Polo', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false, sleeve: 'Short' }, icon: 'M15,6 L20,12 L25,6 L33,12 L31,22 L27,20 L28,44 L12,44 L13,20 L9,22 L7,12 Z M20,12 V23 M17,5 L20,12 L23,5' },
  { name: 'Sweatshirt', o: { block: 'Sweatshirt', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M14,7 Q20,11 26,7 L33,12 L36,42 L31,43 L28,22 L29,44 L11,44 L12,22 L9,43 L4,42 L7,12 Z M11,40 H29 M5,40 L9,39' },
  { name: 'Oversized sweat', o: { block: 'Sweatshirt', fit: 'Oversized', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M13,7 Q20,11 27,7 L37,14 L38,46 L32,47 L29,26 L31,48 L9,48 L11,26 L8,47 L2,46 L3,14 Z M9,44 H31' },
];

const HOODIE_ITEMS: typeof TOP_ITEMS = [
  { name: 'Hoodie', o: { block: 'Hoodie', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M15,6 Q20,2 25,6 L33,12 L36,44 L31,45 L28,22 L29,42 L11,42 L12,22 L9,45 L4,44 L7,12 Z M16,28 H24 L26,38 H14 Z' },
  { name: 'Oversized hoodie', o: { block: 'Hoodie', fit: 'Oversized', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M14,6 Q20,1 26,6 L36,13 L38,46 L32,47 L29,26 L31,46 L9,46 L11,26 L8,47 L2,46 L4,13 Z M15,30 H25 L28,42 H12 Z' },
  { name: 'Zip hoodie', o: { block: 'Zip hoodie', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M15,6 Q20,2 25,6 L33,12 L36,44 L31,45 L28,22 L29,42 L11,42 L12,22 L9,45 L4,44 L7,12 Z M20,6 V42' },
  { name: 'Cropped hoodie', o: { block: 'Hoodie', fit: 'Boxy', length: 'Waist', neck: 'Crew', tuck: false }, icon: 'M14,8 Q20,3 26,8 L36,14 L37,38 L32,39 L30,22 L30,32 L10,32 L10,22 L8,39 L3,38 L4,14 Z M16,22 H24 L25,29 H15 Z' },
];

const OUTER_ITEMS: typeof TOP_ITEMS = [
  { name: 'Moto jacket', o: { block: 'Moto jacket', fit: 'Fitted', length: 'Waist', neck: 'V', tuck: false }, icon: 'M13,7 L18,6 L20,16 L22,6 L27,7 L33,12 L36,44 L31,45 L28,20 L28,38 L12,38 L12,20 L9,45 L4,44 L7,12 Z M20,16 L16,38' },
  { name: 'Long moto', o: { block: 'Moto jacket', fit: 'Regular', length: 'Hip', neck: 'V', tuck: false }, icon: 'M13,7 L18,6 L20,16 L22,6 L27,7 L33,12 L36,44 L31,45 L28,20 L28,44 L12,44 L12,20 L9,45 L4,44 L7,12 Z M20,16 L16,44' },
  { name: 'Oversized moto', o: { block: 'Moto jacket', fit: 'Oversized', length: 'Hip', neck: 'V', tuck: false }, icon: 'M12,7 L18,6 L20,16 L22,6 L28,7 L37,13 L39,46 L33,47 L30,24 L31,44 L9,44 L10,24 L7,47 L1,46 L3,13 Z M20,16 L15,44' },
];

const MORE_OUTER_ITEMS: typeof TOP_ITEMS = [
  { name: 'Anorak', o: T('Anorak', 'Regular', 'Hip', { pocket: 'Kangaroo' }), icon: 'M15,6 Q20,2 25,6 L33,12 L36,44 L31,45 L28,22 L29,44 L11,44 L12,22 L9,45 L4,44 L7,12 Z M20,6 V24 M14,29 H26 L27,38 H13 Z' },
  { name: 'Chest anorak', o: T('Anorak', 'Regular', 'Hip', { pocket: 'Chest' }), icon: 'M15,6 Q20,2 25,6 L33,12 L36,44 L31,45 L28,22 L29,44 L11,44 L12,22 L9,45 L4,44 L7,12 Z M20,6 V24 M23,28 H29' },
  { name: 'Work jacket', o: T('Work jacket', 'Boxy', 'Waist', { hem: 'Rib band' }), icon: 'M13,7 L20,11 L27,7 L34,12 L37,38 L32,39 L29,22 L29,34 L11,34 L11,22 L8,39 L3,38 L6,12 Z M20,11 V34 M12,17 H18 V22 H12 Z M22,17 H28 V22 H22 Z M11,31 H29' },
  { name: 'Coach jacket', o: T('Coach jacket', 'Regular', 'Hip'), icon: 'M13,6 L20,10 L27,6 L34,11 L36,44 L31,45 L28,20 L28,46 L12,46 L12,20 L9,45 L4,44 L6,11 Z M20,10 V46 M18,20 H22 M18,28 H22 M18,36 H22' },
  { name: 'Bomber', o: { block: 'Bomber', fit: 'Regular', length: 'Waist', neck: 'Crew', tuck: false }, icon: 'M14,6 Q20,3 26,6 L33,12 L36,40 L31,41 L28,20 L28,36 L12,36 L12,20 L9,41 L4,40 L7,12 Z M20,5 V36 M12,36 V40 H28 V36' },
  { name: 'Trucker', o: { block: 'Trucker', fit: 'Regular', length: 'Waist', neck: 'Crew', tuck: false }, icon: 'M14,6 L20,10 L26,6 L33,12 L36,40 L31,41 L28,20 L28,36 L12,36 L12,20 L9,41 L4,40 L7,12 Z M20,10 V36 M13,16 H18 V21 H13 Z M22,16 H27 V21 H22 Z' },
  { name: 'Puffer', o: { block: 'Puffer', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false }, icon: 'M14,6 Q20,3 26,6 L34,12 L37,44 L31,45 L28,22 L29,42 L11,42 L12,22 L9,45 L3,44 L6,12 Z M11,18 H29 M11,25 H29 M11,32 H29' },
  { name: 'Hooded puffer', o: { block: 'Puffer', fit: 'Regular', length: 'Hip', neck: 'Crew', tuck: false, hood: true }, icon: 'M14,7 Q20,0 26,7 L34,12 L37,44 L31,45 L28,22 L29,42 L11,42 L12,22 L9,45 L3,44 L6,12 Z M11,20 H29 M11,27 H29 M11,34 H29' },
  { name: 'Trench', o: { block: 'Trench', fit: 'Regular', length: 'Long', neck: 'V', tuck: false }, icon: 'M14,5 L20,20 L26,5 L33,10 L36,40 L31,41 L28,20 L30,54 L10,54 L12,20 L9,41 L4,40 L7,10 Z M11,28 H29 M17,22 V30 M23,22 V30' },
  { name: 'Blazer', o: { block: 'Blazer', fit: 'Fitted', length: 'Hip', neck: 'V', tuck: false }, icon: 'M14,5 L20,24 L26,5 L33,11 L36,44 L31,45 L28,20 L28,42 L12,42 L12,20 L9,45 L4,44 L7,11 Z M17,10 L20,24 L23,10 M20,24 V30' },
];

const PANTS_ITEMS: { name: string; o: PantsOpts; icon: string }[] = [
  { name: 'Cargo', o: { block: 'Cargo' }, icon: 'M7,4 H33 L35,52 H22 L20,18 L18,52 H5 Z M9,24 H15 V32 H9 Z M25,24 H31 V32 H25 Z' },
  { name: 'Sweatpants', o: { block: 'Jogger', open: true }, icon: 'M7,4 H33 L37,52 H22 L20,16 L18,52 H3 Z M16,4 V10 M24,4 V10' },
  { name: 'Joggers', o: { block: 'Jogger' }, icon: 'M8,4 H32 L31,38 L28,52 H22 L20,16 L18,52 H12 L9,38 Z M12,47 H18 M22,47 H28' },
  { name: 'Trousers', o: { block: 'Trouser' }, icon: 'M9,4 H31 L31,52 H22 L20,16 L18,52 H9 Z M14,16 V50 M26,16 V50' },
  { name: 'Pleated', o: { block: 'Trouser', pleats: true }, icon: 'M8,4 H32 L32,52 H22 L20,16 L18,52 H8 Z M13,5 V14 M16,5 V12 M27,5 V14 M24,5 V12' },
  { name: 'Leggings', o: { block: 'Legging' }, icon: 'M11,4 H29 L28,52 H22 L20,16 L18,52 H12 Z' },
];

const SHOE_ITEMS: { name: string; o: ShoeOpts; icon: string }[] = [
  { name: 'Sneaker', o: { kind: 'Sneaker' }, icon: 'M3,32 L3,43 H37 L38,39 Q38,35 30,34 L21,27 L14,29 L9,22 L5,22 Z M5,40 H36 M16,29 L20,32 M12,26 L17,30' },
  { name: 'High top', o: { kind: 'High top' }, icon: 'M5,10 H15 L16,26 L22,29 L30,33 Q37,35 37,40 L37,44 H3 L3,32 L5,28 Z M5,41 H36 M6,14 H15 M6,19 H15 M6,24 H15' },
  { name: 'Combat boot', o: { kind: 'Combat boot' }, icon: 'M6,6 H17 L18,26 L23,29 L31,32 Q38,34 38,40 L38,46 H4 L4,32 L6,28 Z M4,42 H37 M7,10 H17 M7,15 H17 M7,20 H17 M7,25 H17' },
  { name: 'Chelsea', o: { kind: 'Chelsea boot' }, icon: 'M6,14 H17 L18,28 L23,30 L31,33 Q38,35 38,40 L38,44 H4 L4,34 L6,30 Z M9,18 L9,30 M14,18 L14,30 M4,41 H37' },
  { name: 'Loafer', o: { kind: 'Loafer' }, icon: 'M3,34 L3,43 H37 L38,40 Q38,36 30,35 L20,30 L12,32 L7,30 Z M3,40 H37 M14,33 L22,32 M16,34 H20' },
  { name: 'Stiletto', o: { kind: 'Heel', heel: 'Stiletto' }, icon: 'M4,18 L9,18 Q11,32 24,36 L37,38 L37,41 L26,42 L10,41 L8,52 H5 L6,34 Z' },
  { name: 'Block heel', o: { kind: 'Heel', heel: 'Block' }, icon: 'M4,18 L10,18 Q12,32 24,36 L37,38 L37,41 L28,42 L28,52 H18 L16,43 L8,42 Z' },
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
  const addPants = useStore((s) => s.addPants);
  const addShoes = useStore((s) => s.addShoes);
  const [cat, setCat] = useState<'Tops' | 'Outerwear' | 'Bottoms' | 'Dresses' | 'Shoes'>('Bottoms');
  const items: { name: string; fit: Fit; icon: string }[] = [
    { name: 'Jeans', fit: 'Straight', icon: PANT_ICONS.Jeans },
    ...FIT_NAMES.map((f) => ({ name: f, fit: f, icon: PANT_ICONS[f] })),
  ];
  return (
    <section className="group">
      <h3 className="label">LIBRARY</h3>
      <div className="chips">
        {(['Tops', 'Outerwear', 'Bottoms', 'Dresses', 'Shoes'] as const).map((c) => (
          <button key={c} className={c === cat ? 'chip on' : 'chip'} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
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
          <p className="hint sub">Street shorts</p>
          <div className="grid3">
            {SHORTS_STYLE_ITEMS.map((it) => (
              <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}`} onClick={() => addShorts('Short', it.style, it.hem)}>
                <svg width="40" height="56" viewBox="0 0 42 56" aria-hidden="true">
                  <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{it.name}</span>
              </button>
            ))}
          </div>
          <p className="hint sub">Pants</p>
          <div className="grid3">
            {PANTS_ITEMS.map((it) => (
              <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}`} onClick={() => addPants({ ...it.o })}>
                <svg width="40" height="56" viewBox="0 0 42 56" aria-hidden="true">
                  <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span>{it.name}</span>
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
      ) : cat === 'Shoes' ? (
        <div className="grid3">
          {SHOE_ITEMS.map((it) => (
            <button key={it.name} className="block" title={`Add ${it.name.toLowerCase()}`} onClick={() => addShoes({ ...it.o })}>
              <svg width="40" height="56" viewBox="0 0 40 56" aria-hidden="true">
                <path d={it.icon} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
              </svg>
              <span>{it.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid3">
          {(cat === 'Tops' ? [...TOP_ITEMS, ...STREET_ITEMS, ...SHIRT_ITEMS, ...HOODIE_ITEMS] : cat === 'Outerwear' ? [...OUTER_ITEMS, ...MORE_OUTER_ITEMS] : DRESS_ITEMS).map((it) => (
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
