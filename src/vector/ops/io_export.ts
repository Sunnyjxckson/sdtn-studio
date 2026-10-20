// Export the vector art as SVG, PNG or PDF, and copy as SVG markup.
import { useStore } from '../../store';
import { itemsBox, type Box, type VItem } from '../../model/vector';
import { setSvgSnippet, vdoc } from '../edit';
import { itemsToSvg, snippetSvg } from './io_svg';

const ART = { x: 0, y: 20, w: 600, h: 980 };

export interface ExportOpts {
  /** Include the croquis and garments. */
  base: boolean;
  /** Use the full artboard instead of a tight box around the art. */
  full: boolean;
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
    const box = o.full ? ART : (() => {
      const b = itemsBox(visibleItems());
      return b ? { x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 } : ART;
    })();
    clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    clone.setAttribute('width', String(box.w));
    clone.setAttribute('height', String(box.h));
    clone.querySelector(':scope > g')?.removeAttribute('transform');
    // drop editing helpers that are not artwork
    clone.querySelectorAll('[data-testid="vector-overlay"], .vector-overlay').forEach((e) => e.remove());
    return { svg: new XMLSerializer().serializeToString(clone), box };
  }
  const items = visibleItems();
  const tight = itemsBox(items);
  if (!tight && !o.full) return null;
  const box = o.full || !tight ? ART : tight;
  return { svg: itemsToSvg(items, box, o.full ? 0 : 10), box };
}

export function exportSvg(o: ExportOpts): boolean {
  const r = buildSvg(o);
  if (!r) return false;
  download(new Blob([r.svg], { type: 'image/svg+xml' }), `${fileBase()}.svg`);
  return true;
}

export async function svgToPngBlob(svg: string, w: number, h: number, scale = 2): Promise<Blob | null> {
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
    return await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPng(o: ExportOpts): Promise<boolean> {
  const r = buildSvg(o);
  if (!r) return false;
  const b = await svgToPngBlob(r.svg, r.box.w, r.box.h, 2);
  if (!b) return false;
  download(b, `${fileBase()}.png`);
  return true;
}

export async function exportPdf(o: ExportOpts): Promise<boolean> {
  const r = buildSvg(o);
  if (!r) return false;
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
  host.innerHTML = r.svg;
  document.body.appendChild(host);
  try {
    const el = host.querySelector('svg') as SVGSVGElement;
    const { w, h } = { w: r.box.w, h: r.box.h };
    const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'landscape' : 'portrait' });
    await svg2pdf(el, pdf, { x: 0, y: 0, width: w, height: h });
    download(pdf.output('blob'), `${fileBase()}.pdf`);
    return true;
  } finally {
    host.remove();
  }
}

// copy puts SVG markup on the system clipboard too
let lastSnippet = '';
export const lastCopiedSvg = () => lastSnippet;
setSvgSnippet((items) => {
  lastSnippet = snippetSvg(items);
  return lastSnippet;
});
