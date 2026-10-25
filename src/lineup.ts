// Lineup: every look of a collection side by side on its croquis, like a runway line sheet.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LookArt } from './components/LookArt';
import { ARTBOARD } from './model/croquis';
import type { Doc } from './model/doc';
import { pad2, type Project } from './model/project';
import { canvasBlob, downloadBlob, fileBase, loadImage } from './download';

export function lookSvg(doc: Doc): string {
  const { x, y, w, h } = ARTBOARD;
  return renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `${x} ${y} ${w} ${h}`, width: w, height: h }, createElement(LookArt, { doc })));
}
export const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/** Small jpeg of a look, for the project list. */
export async function lookThumb(doc: Doc, w = 160): Promise<string> {
  const h = Math.round((w * ARTBOARD.h) / ARTBOARD.w);
  const img = await loadImage(svgUri(lookSvg(doc)));
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const x = c.getContext('2d')!;
  x.fillStyle = '#F4F2ED';
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

const COLS = 6;
const CW = 360;
const IH = Math.round((CW * ARTBOARD.h) / ARTBOARD.w);
const GAP = 24;
const MARGIN = 48;
const HEAD = 120;
const LABEL = 96;
const SCALE = 1.5;
const isDefaultName = (n: string) => /^Look \d+$/.test(n);

/** One canvas per page, up to six looks across. */
export async function lineupPages(p: Project): Promise<HTMLCanvasElement[]> {
  const imgs = await Promise.all(p.looks.map((l) => loadImage(svgUri(lookSvg(l.doc)))));
  const cols = Math.min(COLS, p.looks.length);
  const pageCount = Math.ceil(p.looks.length / COLS);
  const W = MARGIN * 2 + cols * CW + (cols - 1) * GAP;
  const H = HEAD + IH + LABEL + MARGIN;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const pages: HTMLCanvasElement[] = [];
  for (let pg = 0; pg < pageCount; pg++) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * SCALE);
    c.height = Math.round(H * SCALE);
    const x = c.getContext('2d')!;
    x.scale(SCALE, SCALE);
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#141414';
    x.textBaseline = 'alphabetic';
    x.font = "20px 'Archivo Black', Arial, sans-serif";
    x.fillText('SDTN', MARGIN, 58);
    x.font = "600 22px 'IBM Plex Sans', Arial, sans-serif";
    x.fillText(`${p.name}  /  ${p.season}`, MARGIN + 80, 58);
    x.fillStyle = '#6a665e';
    x.font = "12px 'IBM Plex Mono', monospace";
    x.textAlign = 'right';
    x.fillText(`LINEUP${pageCount > 1 ? `  ${pg + 1} / ${pageCount}` : ''}`, W - MARGIN, 52);
    x.fillText(date, W - MARGIN, 70);
    x.textAlign = 'left';
    x.fillStyle = '#d6d2c8';
    x.fillRect(MARGIN, 88, W - MARGIN * 2, 1);
    const slice = p.looks.slice(pg * COLS, pg * COLS + COLS);
    slice.forEach((l, i) => {
      const n = pg * COLS + i;
      const cx = MARGIN + i * (CW + GAP);
      x.drawImage(imgs[n], cx, HEAD, CW, IH);
      x.fillStyle = '#141414';
      x.font = "500 14px 'IBM Plex Mono', monospace";
      x.fillText(`LOOK ${pad2(n + 1)}`, cx, HEAD + IH + 30);
      if (!isDefaultName(l.name)) {
        x.font = "600 16px 'IBM Plex Sans', Arial, sans-serif";
        x.fillText(l.name, cx, HEAD + IH + 54, CW);
      }
      x.fillStyle = '#6a665e';
      x.font = "12px 'IBM Plex Mono', monospace";
      x.fillText(`${l.doc.garments.filter((g) => g.visible).length} pieces`, cx, HEAD + IH + (isDefaultName(l.name) ? 52 : 74));
    });
    pages.push(c);
  }
  return pages;
}

export async function exportLineupPng(p: Project) {
  const pages = await lineupPages(p);
  for (let i = 0; i < pages.length; i++) {
    downloadBlob(await canvasBlob(pages[i]), `${fileBase(p.name)}-lineup${pages.length > 1 ? `-${i + 1}` : ''}.png`);
  }
}

export async function exportLineupPdf(p: Project) {
  const [{ jsPDF }, pages] = await Promise.all([import('jspdf'), lineupPages(p)]);
  const w = pages[0].width / SCALE;
  const h = pages[0].height / SCALE;
  const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'landscape' : 'portrait' });
  pages.forEach((c, i) => {
    if (i > 0) pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
  });
  downloadBlob(pdf.output('blob'), `${fileBase(p.name)}-lineup.pdf`);
}
