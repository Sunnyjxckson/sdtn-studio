// Croquis base: 9 head figures drawn as one half, mirrored about x = 300.
// Canvas space matches the mockup: viewBox 0 20 600 980, head = 102 units.

export type Sex = 'male' | 'female';
export type View = 'front' | 'back';

export interface CroquisPath {
  d: string;
  w?: number;
  /** Front only detail (face, chest, navel). Dropped for the back view. */
  detail?: boolean;
  /** Face marks. Hidden in the rendered look so the head stays faceless. */
  face?: boolean;
}

export const ARTBOARD = { x: 0, y: 20, w: 600, h: 980 };
export const CENTER_X = 300;
export const HEAD = 102;

const MALE: CroquisPath[] = [
  { d: 'M300,42 Q265,42 265,92 Q266,132 286,140 Q294,143 300,143' },
  { d: 'M266,96 Q283,101 300,102', w: 0.6, detail: true, face: true },
  { d: 'M265,90 Q258,98 266,112', face: true },
  { d: 'M286,140 Q287,158 282,172 Q242,180 200,192' },
  { d: 'M266,193 Q284,199 296,195', detail: true },
  { d: 'M200,192 Q182,208 186,250 Q184,300 186,346 Q182,400 186,448' },
  { d: 'M222,250 Q214,300 210,346 Q206,400 202,448' },
  { d: 'M186,448 Q178,480 188,512 Q197,528 205,512 Q211,480 202,448 M200,462 Q210,474 206,490' },
  { d: 'M222,250 Q226,300 240,342 Q230,390 234,430' },
  { d: 'M240,252 Q264,266 292,258', detail: true },
  { d: 'M262,300 Q280,306 296,302', w: 0.6, detail: true },
  { d: 'M244,408 Q272,416 300,417 M246,410 Q282,438 300,458' },
  { d: 'M234,430 Q226,480 236,560 L252,664 Q242,730 256,800 L268,890' },
  { d: 'M298,458 Q292,560 286,664 Q276,712 282,770 L286,890' },
  { d: 'M260,650 Q270,656 280,650', w: 0.7 },
  { d: 'M268,890 Q258,926 256,948 Q270,962 292,956 Q294,930 286,890' },
];
const MALE_NAVEL = 'M297,346 Q300,350 303,346';

const FEMALE: CroquisPath[] = [
  { d: 'M300,44 Q268,44 268,92 Q269,128 287,138 Q294,142 300,142' },
  { d: 'M269,96 Q285,100 300,101', w: 0.6, detail: true, face: true },
  { d: 'M288,138 Q290,160 286,176 Q252,182 222,192' },
  { d: 'M270,196 Q286,201 296,197', detail: true },
  { d: 'M222,192 Q208,206 210,246 Q208,300 212,340 Q206,400 210,448' },
  { d: 'M232,250 Q228,300 226,340 Q222,400 222,448' },
  { d: 'M210,448 Q204,480 212,512 Q220,526 227,511 Q231,480 222,448 M221,462 Q229,474 226,488' },
  { d: 'M232,250 Q236,292 252,330 Q236,380 230,432' },
  { d: 'M240,236 Q244,262 268,266 Q286,264 296,250', detail: true },
  { d: 'M248,408 Q274,416 300,417 M250,410 Q284,438 300,458' },
  { d: 'M230,432 Q224,500 240,580 L256,666 Q246,740 262,812 L272,902' },
  { d: 'M298,458 Q292,560 288,666 Q280,720 284,782 L288,902' },
  { d: 'M264,654 Q273,660 282,654', w: 0.7 },
  { d: 'M272,902 Q266,932 268,958 Q276,968 285,961 Q290,932 288,902' },
];
const FEMALE_NAVEL = 'M297,350 Q300,354 303,350';

export interface CroquisSpec {
  half: CroquisPath[];
  navel: string;
  /** Extra line drawn only on the back view. */
  spine: string;
  /** Where garments sit: waistband top and hem, in canvas space. */
  waistY: number;
  hemY: number;
  label: string;
}

export function getCroquis(sex: Sex, view: View): CroquisSpec {
  const male = sex === 'male';
  const base = male ? MALE : FEMALE;
  return {
    half: view === 'back' ? base.filter((p) => !p.detail) : base,
    navel: view === 'back' ? '' : male ? MALE_NAVEL : FEMALE_NAVEL,
    spine: view === 'back' ? 'M300,150 V440' : '',
    waistY: 352,
    hemY: male ? 884 : 894,
    label: `${male ? 'Male' : 'Female'} ${view}`,
  };
}

/** Head-line marks down the left edge. */
export const HEAD_LINES = [40, 142, 244, 346, 448, 550, 652, 754, 856, 958];
export const INK = '#3E3B35';
export const INK_WEIGHT = 1.4;

export type SkinId = 'Espresso' | 'Deep brown' | 'Brown' | 'Tan' | 'Light';
/** Dark tones first. */
export const SKINS: { id: SkinId; color: string }[] = [
  { id: 'Espresso', color: '#4A2E22' },
  { id: 'Deep brown', color: '#6B4430' },
  { id: 'Brown', color: '#8D5E43' },
  { id: 'Tan', color: '#C99A74' },
  { id: 'Light', color: '#EBC9A8' },
];
export const DEFAULT_SKIN: SkinId = 'Deep brown';
export const skinColor = (id: SkinId) => (SKINS.find((s) => s.id === id) ?? SKINS[1]).color;

/** Closed fill shapes for one half (mirrored like the lines). Head is separate so the face stays blank. */
const FILL = {
  male: {
    head: 'M300,42 Q265,42 265,92 Q266,132 286,140 Q294,143 300,143 Z',
    body:
      'M300,143 L286,140 Q287,158 282,172 Q242,180 200,192 Q182,208 186,250 Q184,300 186,346 Q182,400 186,448 ' +
      'Q178,480 188,512 Q197,528 205,512 Q211,480 202,448 Q206,400 210,346 Q214,300 222,250 Q226,300 240,342 ' +
      'Q230,390 234,430 Q226,480 236,560 L252,664 Q242,730 256,800 L268,890 Q258,926 256,948 Q270,962 292,956 ' +
      'Q294,930 286,890 L282,770 Q276,712 286,664 Q292,560 298,458 L300,458 Z',
    oval: { cx: 300, cy: 92, rx: 22, ry: 32 },
  },
  female: {
    head: 'M300,44 Q268,44 268,92 Q269,128 287,138 Q294,142 300,142 Z',
    body:
      'M300,142 L288,138 Q290,160 286,176 Q252,182 222,192 Q208,206 210,246 Q208,300 212,340 Q206,400 210,448 ' +
      'Q204,480 212,512 Q220,526 227,511 Q231,480 222,448 Q222,400 226,340 Q228,300 232,250 Q236,292 252,330 ' +
      'Q236,380 230,432 Q224,500 240,580 L256,666 Q246,740 262,812 L272,902 Q266,932 268,958 Q276,968 285,961 ' +
      'Q290,932 288,902 L284,782 Q280,720 288,666 Q292,560 298,458 L300,458 Z',
    oval: { cx: 300, cy: 92, rx: 21, ry: 32 },
  },
};
export const getFill = (sex: Sex) => FILL[sex];
