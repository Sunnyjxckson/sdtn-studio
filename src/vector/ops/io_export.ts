// Export the vector art as SVG, PNG or PDF, and copy as SVG markup.
import { useStore } from '../../store';
import { itemsBox, type Box, type VArtboard, type VItem } from '../../model/vector';
import { activeBoard } from '../artboards';
import { setSvgSnippet, vdoc } from '../edit';
import { itemsToSvg, snippetSvg } from './io_svg';


export interface ExportOpts {
  /** Include the croquis and garments. */
  base: boolean;
  /** Use the active artboard instead of a tight box around the art. */
  full: boolean;
  /** Export this artboard. */
  board?: VArtboard;
  /** Export each of these artboards (one file each, one page each in a PDF). */
  boards?: VArtboard[];
}

export const visibleItems = (): VItem[] =>
  vdoc().layers.filter((l) => l.visible).flatMap((l) => l.items.filter((i) => !i.hidden));

const fileBase = () => useStore.getState().doc.name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-') || 'sdtn';

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** The SVG text to export and its size in canvas units. Null when there is nothing to export. */
export function buildSvg(o: ExportOpts): { svg: string; box: Box } | null {
  if (o.base) {
    const src = document.querySelector('.canvaswrap svg.canvas, svg.canvas') as SVGSVGElement | null;
    if (!src) return null;
    const clone = src.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute('style');
    clone.removeAttribute('class');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-label');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const box = o.board ?? (o.full ? activeBoard() : (() => {
      const b = itemsBox(visibleItems());
      return b ? { x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 } : activeBoard();
    })());
    clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    clone.setAttribute('width', String(box.w));
    clone.setAttribute('height', String(box.h));
    clone.querySelector(':scope > g')?.removeAttribute('transform');
    // drop editing helpers that are not artwork
    clone.querySelectorAll('[data-board-bg]').forEach((e) => e.remove());
    clone.querySelectorAll('[data-testid="vector-overlay"], .vector-overlay').forEach((e) => e.remove());
    return { svg: new XMLSerializer().serializeToString(clone), box };
  }
  const items = visibleItems();
  const tight = itemsBox(items);
  const whole = o.board ?? (o.full ? activeBoard() : null);
  if (!tight && !whole) return null;
  const box = whole ?? tight!;
  return { svg: itemsToSvg(items, box, whole ? 0 : 10), box: whole ? box : { x: box.x - 10, y: box.y - 10, w: box.w + 20, h: box.h + 20 } };
}

export type RasterFormat = 'png' | 'jpeg' | 'webp';
const MIME: Record<RasterFormat, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const EXT: Record<RasterFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };

/** One export job per artboard, or a single one for the art bounds. */
function jobs(o: ExportOpts): { o: ExportOpts; suffix: string }[] {
  if (o.boards && o.boards.length) return o.boards.map((b) => ({ o: { ...o, board: b }, suffix: o.boards!.length > 1 ? `-${b.name.replace(/[^\w-]+/g, '-')}` : '' }));
  return [{ o, suffix: '' }];
}

export function exportSvg(o: ExportOpts): boolean {
  let any = false;
  for (const j of jobs(o)) {
    const r = buildSvg(j.o);
    if (!r) continue;
    download(new Blob([r.svg], { type: 'image/svg+xml' }), `${fileBase()}${j.suffix}.svg`);
    any = true;
  }
  return any;
}

export async function svgToRasterBlob(svg: string, w: number, h: number, scale = 2, fmt: RasterFormat = 'png', quality = 0.92): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg'));
      img.src = url;
    });
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * scale));
    cv.height = Math.max(1, Math.round(h * scale));
    const x = cv.getContext('2d');
    if (!x) return null;
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, cv.width, cv.height);
    x.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), MIME[fmt], quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const svgToPngBlob = (svg: string, w: number, h: number, scale = 2) => svgToRasterBlob(svg, w, h, scale, 'png');

export async function exportRaster(o: ExportOpts, fmt: RasterFormat = 'png', scale = 2): Promise<boolean> {
  let any = false;
  for (const j of jobs(o)) {
    const r = buildSvg(j.o);
    if (!r) continue;
    const b = await svgToRasterBlob(r.svg, r.box.w, r.box.h, scale, fmt);
    if (!b) continue;
    download(b, `${fileBase()}${j.suffix}${scale > 1 ? `@${scale}x` : ''}.${EXT[fmt]}`);
    any = true;
  }
  return any;
}

export const exportPng = (o: ExportOpts, scale = 2) => exportRaster(o, 'png', scale);

/** One PDF, one page per artboard. */
export async function exportPdf(o: ExportOpts): Promise<boolean> {
  const built = jobs(o).map((j) => buildSvg(j.o)).filter((r): r is { svg: string; box: Box } => !!r);
  if (!built.length) return false;
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const r of built) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
    host.innerHTML = r.svg;
    document.body.appendChild(host);
    try {
      const el = host.querySelector('svg') as SVGSVGElement;
      // the PDF writer has no filters, so the effects stay out of the PDF
      el.querySelectorAll('[filter]').forEach((n) => n.removeAttribute('filter'));
      const { w, h } = { w: r.box.w, h: r.box.h };
      const orientation = w > h ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation });
      else pdf.addPage([w, h], orientation);
      await svg2pdf(el, pdf, { x: 0, y: 0, width: w, height: h });
    } finally {
      host.remove();
    }
  }
  download(pdf!.output('blob'), `${fileBase()}.pdf`);
  return true;
}

// copy puts SVG markup on the system clipboard too
let lastSnippet = '';
export const lastCopiedSvg = () => lastSnippet;
setSvgSnippet((items) => {
  lastSnippet = snippetSvg(items);
  return lastSnippet;
});
