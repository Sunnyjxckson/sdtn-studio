// Artboards: add, remove, rename, resize. Units are canvas units, 72 per inch for the paper presets.
import { newId } from '../model/garment';
import type { VArtboard } from '../model/vector';
import { vdoc, vs } from './edit';

export const BOARD_PRESETS: { name: string; w: number; h: number }[] = [
  { name: 'Letter', w: 612, h: 792 },
  { name: 'A4', w: 595, h: 842 },
  { name: 'Tablet', w: 768, h: 1024 },
  { name: 'Square', w: 800, h: 800 },
  { name: 'Line sheet 11x17', w: 792, h: 1224 },
];

export const boards = (): VArtboard[] => vdoc().artboards;
export const activeBoard = (): VArtboard => boards().find((b) => b.id === vdoc().activeBoard) ?? boards()[0];

export function addBoard(preset?: { name: string; w: number; h: number }, at?: { x: number; y: number }): string {
  const list = boards();
  const right = list.reduce((m, b) => Math.max(m, b.x + b.w), 0);
  const w = preset?.w ?? 600, h = preset?.h ?? 980;
  const b: VArtboard = {
    id: newId(),
    name: preset ? preset.name : `Artboard ${list.length + 1}`,
    x: at?.x ?? right + 60,
    y: at?.y ?? 20,
    w,
    h,
  };
  vs().vstep((v) => {
    v.artboards.push(b);
    v.activeBoard = b.id;
  });
  return b.id;
}

export function removeBoard(id: string) {
  if (boards().length <= 1) return;
  vs().vstep((v) => {
    v.artboards = v.artboards.filter((b) => b.id !== id);
    if (v.activeBoard === id) v.activeBoard = v.artboards[0].id;
  });
}

export function patchBoard(id: string, p: Partial<Omit<VArtboard, 'id'>>, coalesce?: string) {
  vs().vstep((v) => {
    const b = v.artboards.find((x) => x.id === id);
    if (b) Object.assign(b, p);
  }, coalesce);
}

export const setActiveBoard = (id: string) => vs().vedit((v) => void (v.activeBoard = id));

export const boardAt = (x: number, y: number): VArtboard | null => {
  const list = boards();
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
};
