// Blanks library: editable front and back technical flats, grouped by category.
// Scale is PX_IN_V canvas units per inch, so the Measure tool reads real inches.
import type { VGroup, VItem } from '../../model/vector';
import { cloneItem, itemBox, transformItem, translate } from '../../model/vector';
import { addItems, vs } from '../edit';
import { findItem } from '../../model/vector';
import { buildBottom, BOT_PARAMS } from './bottoms';
import { GREY, shade, text } from './kit';
import { buildTop, TOP_PARAMS, type View } from './tops';

export type BlankCat = 'Tees' | 'Long sleeves' | 'Sweatshirts' | 'Hoodies' | 'Outerwear' | 'Shorts' | 'Pants';
export const BLANK_CATS: BlankCat[] = ['Tees', 'Long sleeves', 'Sweatshirts', 'Hoodies', 'Outerwear', 'Shorts', 'Pants'];

export interface BlankDef {
  id: string;
  name: string;
  cat: BlankCat;
  build: (view: View) => VItem;
}

const top = (id: string, name: string, cat: BlankCat, key = id): BlankDef => ({ id, name, cat, build: (v) => buildTop(TOP_PARAMS[key], v, `${name} ${v}`) });
const bot = (id: string, name: string, cat: BlankCat, key = id): BlankDef => ({ id, name, cat, build: (v) => buildBottom(BOT_PARAMS[key], v, `${name} ${v}`) });

export const BLANKS: BlankDef[] = [
  top('tee', 'Regular tee', 'Tees'),
  top('teeBoxy', 'Boxy tee', 'Tees'),
  top('teeOver', 'Oversized drop shoulder tee', 'Tees'),
  top('teeCrop', 'Cropped boxy tee', 'Tees'),
  top('teeRaglan', 'Raglan tee', 'Tees'),
  top('teeLong', 'Longline curved hem tee', 'Tees'),
  top('teeRinger', 'Ringer tee', 'Tees'),
  top('ls', 'Long sleeve tee', 'Long sleeves'),
  top('lsRaglan', 'Raglan long sleeve', 'Long sleeves'),
  top('lsCrop', 'Cropped long sleeve', 'Long sleeves'),
  top('mock', 'Mock neck long sleeve', 'Long sleeves'),
  top('crew', 'Crewneck sweatshirt', 'Sweatshirts'),
  top('crewOver', 'Oversized crewneck', 'Sweatshirts'),
  top('crewCrop', 'Cropped crewneck', 'Sweatshirts'),
  top('qzip', 'Quarter zip', 'Sweatshirts'),
  top('hzip', 'Half zip', 'Sweatshirts'),
  top('hood', 'Pullover hoodie', 'Hoodies'),
  top('hoodZip', 'Zip up hoodie', 'Hoodies'),
  top('hoodOver', 'Oversized boxy hoodie', 'Hoodies'),
  top('hoodCrop', 'Cropped hoodie', 'Hoodies'),
  top('hoodPlain', 'No pocket hoodie', 'Hoodies'),
  top('anorak', 'Anorak half zip windbreaker', 'Hoodies'),
  top('work', 'Cropped work jacket', 'Outerwear'),
  top('coach', 'Coach jacket', 'Outerwear'),
  bot('sweatShort', 'Sweatshorts', 'Shorts'),
  bot('meshShort', 'Mesh basketball shorts', 'Shorts'),
  bot('cargoShort', 'Cargo shorts', 'Shorts'),
  bot('jort', 'Jorts', 'Shorts'),
  bot('sweatCuff', 'Cuffed sweatpants', 'Pants'),
  bot('sweatWide', 'Open hem wide sweatpants', 'Pants'),
  bot('jeanStraight', 'Straight jeans', 'Pants'),
  bot('jeanBaggy', 'Baggy jeans', 'Pants'),
  bot('cargo', 'Cargo pants', 'Pants'),
];

// ---------- colorways ----------

export type Part = 'all' | 'body' | 'sleeves' | 'ribs' | 'pockets' | 'hood';
export const PARTS: { id: Part; label: string }[] = [
  { id: 'all', label: 'Whole blank' },
  { id: 'body', label: 'Body' },
  { id: 'sleeves', label: 'Sleeves' },
  { id: 'ribs', label: 'Ribs and bands' },
  { id: 'pockets', label: 'Pockets' },
  { id: 'hood', label: 'Hood and collar' },
];

type Kind = 'body' | 'sleeves' | 'ribs' | 'trim' | 'pockets' | 'hood' | 'detail' | null;
export function kindOf(name: string): Kind {
  if (/^Body/.test(name)) return 'body';
  if (/^Sleeve/.test(name)) return 'sleeves';
  if (/^(Rib|Waistband)/.test(name)) return 'ribs';
  if (/^Trim/.test(name)) return 'trim';
  if (/^Pocket/.test(name)) return 'pockets';
  if (/^(Hood|Collar)/.test(name)) return 'hood';
  if (/^Detail/.test(name)) return 'detail';
  return null;
}

/** Recolor the fills of an item tree. Mutates, so pass a draft or a fresh build. */
export function applyColor(it: VItem, color: string, part: Part = 'all') {
  if (it.kind === 'group') {
    for (const c of it.children) applyColor(c, color, part);
    return;
  }
  if (it.kind !== 'path' || !it.style.fill) return;
  const k = kindOf(it.name);
  if (!k) return;
  let c: string | null = null;
  if (part === 'all') c = k === 'trim' ? shade(color, 0.62) : k === 'detail' ? shade(color, 0.9) : color;
  else if (part === 'ribs') c = k === 'ribs' ? color : k === 'trim' ? shade(color, 0.7) : null;
  else if (part === 'hood') c = k === 'hood' ? color : null;
  else if (k === part) c = color;
  if (c) it.style.fill = { kind: 'solid', color: c };
}

/** Recolor whatever is selected as one undo step. Returns how many items it touched. */
export function recolorSelection(color: string, part: Part): number {
  const ids = vs().vsel;
  if (!ids.length) return 0;
  vs().vstep((v) => {
    for (const id of ids) {
      const f = findItem(v as never, id);
      if (f) applyColor(f.item as VItem, color, part);
    }
  });
  return ids.length;
}

// ---------- placing ----------

let placed = 0;

/** Center a freshly built blank at x, y. */
function centered(it: VItem, x: number, y: number) {
  const b = itemBox(it);
  if (b) transformItem(it, translate(Math.round(x - (b.x + b.w / 2)), Math.round(y - (b.y + b.h / 2))));
}

export function buildBlank(def: BlankDef, view: View, color: string): VItem {
  const it = cloneItem(def.build(view));
  if (color.toUpperCase() !== GREY) applyColor(it, color, 'all');
  return it;
}

export function placeBlank(def: BlankDef, x: number, y: number, mode: View | 'pair', color = GREY): VItem[] {
  if (mode !== 'pair') {
    const it = buildBlank(def, mode, color);
    centered(it, x, y);
    addItems([it]);
    return [it];
  }
  const f = buildBlank(def, 'front', color) as VGroup;
  const b = buildBlank(def, 'back', color) as VGroup;
  const fb = itemBox(f)!, bb = itemBox(b)!;
  const gap = 90;
  const total = fb.w + bb.w + gap;
  const left = x - total / 2;
  centered(f, left + fb.w / 2, y);
  centered(b, left + fb.w + gap + bb.w / 2, y);
  const lf = itemBox(f)!, lb = itemBox(b)!;
  const labels = [text('FRONT', lf.x + lf.w / 2, lf.y + lf.h + 34, 13), text('BACK', lb.x + lb.w / 2, lb.y + lb.h + 34, 13)];
  addItems([f, b, ...labels]);
  return [f, b, ...labels];
}

/** Clicking steps the drop point so a row of clicks does not pile up. */
export const nextOffset = () => placed++ % 4;
