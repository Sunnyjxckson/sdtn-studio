import type { ReactNode } from 'react';

/** Pointer event in canvas units. */
export interface PtrEvt {
  x: number;
  y: number;
  /** Raw pointer, before snapping. */
  rx: number;
  ry: number;
  shift: boolean;
  alt: boolean;
  mod: boolean;
  pressure: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  /** 2 on a double click. */
  clicks: number;
}

export type BoxHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** What the pointer is over. Item ids are the leaf hit; top is its top level item in the layer. */
export type Hit =
  | { kind: 'item'; id: string; top: string }
  | { kind: 'node'; id: string; s: number; i: number }
  | { kind: 'handle'; id: string; s: number; i: number; side: 'in' | 'out' }
  | { kind: 'box'; h: BoxHandle }
  | { kind: 'rotate'; h: BoxHandle }
  | null;

export interface ToolCtx {
  /** Current zoom, screen pixels per canvas unit. */
  k: number;
  /** Draw something over the canvas in canvas units (rubber bands, previews). */
  setPreview: (n: ReactNode | null) => void;
  /** Snap a canvas point to grid, anchors and smart guides. */
  snap: (p: { x: number; y: number }, exclude?: string[]) => { x: number; y: number };
  /** What is under a screen point. */
  hitAt: (clientX: number, clientY: number) => Hit;
  toast: (msg: string) => void;
  /** Change the canvas cursor while the tool is active. */
  setCursor: (c: string | null) => void;
}

export interface VToolDef {
  id: string;
  title: string;
  /** Shortcut, lowercase, e.g. 'p', 'shift+c', '\\'. */
  key?: string;
  /** SVG path in a 20 x 20 box. */
  icon: string;
  help: string;
  cursor?: string;
  /** Tools with the same group sit next to each other in the strip. */
  group: 'select' | 'draw' | 'shape' | 'type' | 'transform' | 'paint' | 'measure' | 'view';
  /** Which selection decorations the overlay shows. Default 'box'. */
  decor?: 'box' | 'nodes' | 'none';
  /** Snap pointer positions (default true). */
  snaps?: boolean;
  down?: (e: PtrEvt, hit: Hit, ctx: ToolCtx) => void;
  move?: (e: PtrEvt, ctx: ToolCtx) => void;
  up?: (e: PtrEvt, ctx: ToolCtx) => void;
  /** Pointer moving with no button down. */
  hover?: (e: PtrEvt, hit: Hit, ctx: ToolCtx) => void;
  /** The tool was switched away from, or Escape. */
  cancel?: (ctx: ToolCtx) => void;
  /** Return true when the key was used. */
  keydown?: (e: KeyboardEvent, ctx: ToolCtx) => boolean;
  /** Tool options shown in the bar over the canvas. */
  options?: () => ReactNode;
}

export interface VCommand {
  id: string;
  title: string;
  /** Shortcuts like 'mod+g', 'mod+shift+g', 'mod+alt+7', 'delete'. */
  keys?: string[];
  run: () => void;
  /** Hide from the command list. */
  hidden?: boolean;
}
