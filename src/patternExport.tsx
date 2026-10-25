// Pattern exports: svg, tiled pdf (Letter or A4), large format pdf (A0 or a 36 in plotter), and dxf.
// jsPDF, svg2pdf.js and react-dom/server load on demand.
import type { Sheet } from './model/pattern';
import { PPI } from './model/pattern';
import { bbox } from './model/patternGeo';
import { PatternSheet } from './components/PatternSheet';
import { sheetToDxf } from './model/patternDxf';

export type PaperKind = 'letter' | 'a4' | 'a0' | 'plotter36';
export const PAPERS: { id: PaperKind; label: string; w: number; h: number; tiled: boolean }[] = [
  { id: 'letter', label: 'Letter tiles (8.5 x 11 in)', w: 8.5, h: 11, tiled: true },
  { id: 'a4', label: 'A4 tiles (210 x 297 mm)', w: 210 / 25.4, h: 297 / 25.4, tiled: true },
  { id: 'a0', label: 'A0 single sheet (841 x 1189 mm)', w: 841 / 25.4, h: 1189 / 25.4, tiled: false },
  { id: 'plotter36', label: '36 in plotter roll', w: 36, h: 0, tiled: false },
];
/** Width a layout may use on the paper, so a sheet built for it fits. */
export const layoutWidth = (k: PaperKind): number => {
  const p = PAPERS.find((x) => x.id === k)!;
  return p.tiled ? 38 : p.w - 1.6;
};

const base = (name: string) => name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'sdtn';

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileBase = (sheet: Sheet) => `sdtn-pattern-${base(sheet.title)}-${sheet.nested ? 'nested' : sheet.activeSize.toLowerCase()}`;

export function exportDxf(sheet: Sheet) {
  saveBlob(new Blob([sheetToDxf(sheet)], { type: 'application/dxf' }), `${fileBase(sheet)}.dxf`);
}

async function printSvg(sheet: Sheet): Promise<{ el: SVGSVGElement; cleanup: () => void }> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={sheet.w} height={sheet.h} viewBox={`0 0 ${sheet.w} ${sheet.h}`}>
      <PatternSheet sheet={sheet} print />
    </svg>,
  );
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
  host.innerHTML = markup;
  document.body.appendChild(host);
  return { el: host.querySelector('svg') as SVGSVGElement, cleanup: () => host.remove() };
}

export interface TileOpts {
  paper: 'letter' | 'a4';
  /** Overlap between neighbouring pages, inches. */
  overlap: number;
}

export interface TilePlan {
  pw: number;
  ph: number;
  margin: number;
  printW: number;
  printH: number;
  stepX: number;
  stepY: number;
  ox: number;
  oy: number;
  cols: number;
  rows: number;
  /** Row-major list of tiles that hold something, with their grid position. */
  tiles: { row: number; col: number; label: string }[];
}

const rowLetter = (r: number) => String.fromCharCode(65 + (r % 26)).repeat(1 + Math.floor(r / 26));

export function planTiles(sheet: Sheet, o: TileOpts): TilePlan {
  const p = PAPERS.find((x) => x.id === o.paper)!;
  const margin = 0.25;
  const printW = p.w - 2 * margin, printH = p.h - 2 * margin;
  const stepX = printW - o.overlap, stepY = printH - o.overlap;
  const ox = sheet.ruler * 0.5, oy = sheet.ruler * 0.5;
  const cols = Math.max(1, Math.ceil((sheet.wIn - ox - o.overlap) / stepX));
  const rows = Math.max(1, Math.ceil((sheet.hIn - oy - o.overlap) / stepY));
  const boxes = sheet.pieces.map((pc) => bbox(pc.allowance));
  // the scale square and the title block at the bottom also count
  boxes.push({ x0: 0, y0: sheet.hIn - 1.7, x1: sheet.wIn, y1: sheet.hIn });
  const tiles: TilePlan['tiles'] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = ox + c * stepX, y0 = oy + r * stepY;
      const hit = boxes.some((b) => b.x1 > x0 && b.x0 < x0 + printW && b.y1 > y0 && b.y0 < y0 + printH);
      if (hit) tiles.push({ row: r, col: c, label: `${rowLetter(r)}${c + 1}` });
    }
  }
  return { pw: p.w, ph: p.h, margin, printW, printH, stepX, stepY, ox, oy, cols, rows, tiles };
}

export async function exportTiledPdf(sheet: Sheet, o: TileOpts, save = true): Promise<{ pages: number; blob: Blob }> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const plan = planTiles(sheet, o);
  const { pw, ph, margin } = plan;
  const pdf = new jsPDF({ unit: 'in', format: [pw, ph], orientation: 'portrait' });
  const INK = 20;
  const sizeText = sheet.nested ? `sizes ${sheet.sizes.join(', ')}` : `size ${sheet.activeSize}`;
  const total = plan.tiles.length + 1;

  // ---- page 1: scale check, assembly map, piece list
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(INK);
  pdf.text('SDTN Studio pattern', margin + 0.25, 0.8);
  pdf.setFontSize(12);
  pdf.text(`${sheet.title}, ${sizeText}`, margin + 0.25, 1.1);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  const inst = [
    `Print every page at 100 percent. Turn off fit to page and shrink to fit.`,
    `Measure the square below with a ruler before you tape anything. Each side must be 2 in (50.8 mm).`,
    `Pages are labelled by row letter and column number. Lay them out as the map shows.`,
    `Match the crosses in the corners of neighbouring pages, then tape. Pages overlap ${o.overlap} in.`,
    `Dashed outline is the cut line with seam allowance. The solid line is the sewing line.`,
  ];
  inst.forEach((t, i) => pdf.text(`${i + 1}.  ${t}`, margin + 0.25, 1.5 + i * 0.2));
  pdf.setTextColor(INK);

  // 2 in test square with tick marks every 1/4 in
  const sx = margin + 0.5, sy = 2.85;
  pdf.setDrawColor(INK);
  pdf.setLineWidth(0.012);
  pdf.rect(sx, sy, 2, 2);
  for (let i = 0; i <= 8; i++) {
    const t = i * 0.25;
    const tl = i % 4 === 0 ? 0.14 : i % 2 === 0 ? 0.1 : 0.06;
    pdf.line(sx + t, sy, sx + t, sy - tl);
    pdf.line(sx, sy + t, sx - tl, sy + t);
  }
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('2 in', sx + 1, sy + 1.05, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Print scale check. If this is not 2 in square,', sx - 0.3, sy + 2.3);
  pdf.text('reprint at 100 percent.', sx - 0.3, sy + 2.43);

  // assembly map: the whole sheet drawn small, with the page grid over it
  const mapW = pw - margin * 2 - 0.5 - 2.9;
  const k = Math.min(mapW / sheet.wIn, 5.2 / sheet.hIn);
  const mx = margin + 3.15, my = 2.7;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(110);
  pdf.text('ASSEMBLY MAP', mx, my - 0.12);
  pdf.setTextColor(INK);
  pdf.setLineWidth(0.006);
  pdf.setDrawColor(190);
  pdf.rect(mx, my, sheet.wIn * k, sheet.hIn * k);
  for (const pc of sheet.pieces) {
    if (sheet.nested && !pc.primary) continue;
    const pts = pc.allowance;
    pdf.setDrawColor(120);
    pdf.lines(
      pts.slice(1).map((p, i) => [(p[0] - pts[i][0]) * k, (p[1] - pts[i][1]) * k] as [number, number]),
      mx + pts[0][0] * k,
      my + pts[0][1] * k,
      [1, 1],
      'S',
      true,
    );
  }
  pdf.setDrawColor(INK);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const printed = new Set(plan.tiles.map((t) => `${t.row}:${t.col}`));
  for (let r = 0; r < plan.rows; r++) {
    for (let c = 0; c < plan.cols; c++) {
      const x0 = plan.ox + c * plan.stepX, y0 = plan.oy + r * plan.stepY;
      const w = Math.min(plan.printW, sheet.wIn - x0), h = Math.min(plan.printH, sheet.hIn - y0);
      const on = printed.has(`${r}:${c}`);
      pdf.setLineWidth(on ? 0.01 : 0.005);
      pdf.setDrawColor(on ? 200 : 215, on ? 16 : 215, on ? 46 : 215);
      pdf.rect(mx + x0 * k, my + y0 * k, w * k, h * k);
      if (on) {
        pdf.setTextColor(200, 16, 46);
        pdf.text(`${rowLetter(r)}${c + 1}`, mx + (x0 + 0.1) * k, my + (y0 + 0.25) * k);
      }
    }
  }
  pdf.setTextColor(INK);
  pdf.setDrawColor(INK);

  // piece list
  let py = Math.max(sy + 2.7, my + sheet.hIn * k + 0.4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(110);
  pdf.text('PIECES', margin + 0.25, py);
  pdf.setTextColor(INK);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  py += 0.2;
  const seen = new Set<string>();
  for (const pc of sheet.pieces) {
    if (seen.has(pc.id)) continue;
    seen.add(pc.id);
    if (py > ph - 0.6) break;
    pdf.text(`${pc.name}`, margin + 0.25, py);
    pdf.text(pc.cutText, margin + 2.6, py);
    py += 0.17;
  }
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.text(`SDTN Studio  |  ${sheet.title}  |  page 1 of ${total}`, margin + 0.25, ph - margin - 0.1);
  pdf.setTextColor(INK);

  // ---- tiles
  const { el, cleanup } = await printSvg(sheet);
  try {
    for (let i = 0; i < plan.tiles.length; i++) {
      const t = plan.tiles[i];
      pdf.addPage([pw, ph], 'portrait');
      const x0 = plan.ox + t.col * plan.stepX, y0 = plan.oy + t.row * plan.stepY;
      pdf.saveGraphicsState();
      pdf.rect(margin, margin, plan.printW, plan.printH, null);
      pdf.clip();
      pdf.discardPath();
      await svg2pdf(el, pdf, { x: margin - x0, y: margin - y0, width: sheet.wIn, height: sheet.hIn });
      pdf.restoreGraphicsState();

      // alignment crosses at the corners of the box inset half the overlap, so they land on the neighbour's
      const ins = o.overlap / 2;
      const cx0 = margin + ins, cy0 = margin + ins, cx1 = margin + plan.printW - ins, cy1 = margin + plan.printH - ins;
      pdf.setDrawColor(200, 16, 46);
      pdf.setLineWidth(0.008);
      for (const [cx, cy] of [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]]) {
        pdf.line(cx - 0.18, cy, cx + 0.18, cy);
        pdf.line(cx, cy - 0.18, cx, cy + 0.18);
        pdf.circle(cx, cy, 0.06, 'S');
      }
      pdf.setLineDashPattern([0.08, 0.06], 0);
      pdf.setDrawColor(170);
      pdf.setLineWidth(0.005);
      pdf.rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
      pdf.setLineDashPattern([], 0);

      // labels in the margin
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(200, 16, 46);
      pdf.text(t.label, margin + 0.3, margin + 0.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(60);
      pdf.text(`Row ${rowLetter(t.row)}, column ${t.col + 1}   |   page ${i + 2} of ${total}   |   ${sheet.title}, ${sizeText}`, pw / 2, margin + 0.2, { align: 'center' });
      const has = (r: number, c: number) => printed.has(`${r}:${c}`);
      pdf.setFontSize(7);
      if (has(t.row, t.col + 1)) pdf.text(`to ${rowLetter(t.row)}${t.col + 2}`, pw - margin - 0.08, ph / 2, { align: 'right' });
      if (t.col > 0 && has(t.row, t.col - 1)) pdf.text(`to ${rowLetter(t.row)}${t.col}`, margin + 0.08, ph / 2);
      if (has(t.row + 1, t.col)) pdf.text(`to ${rowLetter(t.row + 1)}${t.col + 1}`, pw / 2, ph - margin - 0.06, { align: 'center' });
      if (t.row > 0 && has(t.row - 1, t.col)) pdf.text(`to ${rowLetter(t.row - 1)}${t.col + 1}`, pw / 2, margin + 0.36, { align: 'center' });
      pdf.setTextColor(INK);
    }
  } finally {
    cleanup();
  }
  const blob = pdf.output('blob');
  if (save) saveBlob(blob, `${fileBase(sheet)}-${o.paper}-tiled.pdf`);
  return { pages: total, blob };
}

export async function exportLargePdf(sheet: Sheet, paper: 'a0' | 'plotter36', save = true): Promise<{ pages: number; blob: Blob; w: number; h: number }> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const p = PAPERS.find((x) => x.id === paper)!;
  const pw = Math.max(p.w, sheet.wIn);
  const ph = paper === 'plotter36' ? sheet.hIn : Math.max(p.h, sheet.hIn);
  const pdf = new jsPDF({ unit: 'in', format: [pw, ph], orientation: pw > ph ? 'landscape' : 'portrait' });
  const { el, cleanup } = await printSvg(sheet);
  try {
    await svg2pdf(el, pdf, { x: 0, y: 0, width: sheet.wIn, height: sheet.hIn });
  } finally {
    cleanup();
  }
  const blob = pdf.output('blob');
  if (save) saveBlob(blob, `${fileBase(sheet)}-${paper}.pdf`);
  return { pages: 1, blob, w: pw, h: ph };
}

export function exportSvgFile(sheet: Sheet, node: SVGGElement) {
  const clone = node.cloneNode(true) as SVGGElement;
  clone.removeAttribute('transform');
  const body = new XMLSerializer().serializeToString(clone);
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.w.toFixed(0)}" height="${sheet.h.toFixed(0)}" viewBox="0 0 ${sheet.w.toFixed(0)} ${sheet.h.toFixed(0)}">` +
    body.replace(' xmlns="http://www.w3.org/2000/svg"', '') +
    `</svg>`;
  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `${fileBase(sheet)}.svg`);
}

export { PPI };
