// Flats exports: one svg with every flat, and the tech pack pdf (jsPDF + svg2pdf.js, loaded on demand).
import { flatSheetSvg, flatsFileSvg, noteLines, type FlatModel } from './model/flats';
import type { Doc } from './model/doc';
import { garmentColor, money, rowTotal, type BomRow } from './model/production';

const base = (name: string) => name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sdtn';

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFlatsSvg(doc: Doc, models: FlatModel[]) {
  if (!models.length) return;
  save(new Blob([flatsFileSvg(models)], { type: 'image/svg+xml' }), `${base(doc.name)}-flats.svg`);
}

const PW = 792, PH = 612;
const dateText = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export async function exportTechPack(doc: Doc, models: FlatModel[]): Promise<boolean> {
  if (!models.length) return false;
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const pdf = new jsPDF({ unit: 'pt', format: [PW, PH], orientation: 'landscape' });
  const date = dateText();
  const INK = 20;
  const rule = (y: number, x0 = 28, x1 = PW - 28, g = 200) => {
    pdf.setDrawColor(g);
    pdf.setLineWidth(0.5);
    pdf.line(x0, y, x1, y);
  };
  const head = (t: string, x: number, y: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text(t, x, y, { charSpace: 1.2 });
    pdf.setTextColor(INK);
  };
  const foot = (n: number, of: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`SDTN Studio  |  ${doc.name}`, 28, PH - 18);
    pdf.text(`${n} / ${of}`, PW - 28, PH - 18, { align: 'right' });
    pdf.setTextColor(INK);
  };
  const pageHead = (title: string) => {
    pdf.setTextColor(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text(title, 28, 40);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(doc.name, PW - 28, 32, { align: 'right' });
    pdf.text(date, PW - 28, 44, { align: 'right' });
    pdf.setTextColor(INK);
    rule(54);
  };

  const textLines = (t: string, w: number) => pdf.splitTextToSize(t, w) as string[];
  const drawLegend = (m: FlatModel, X: number, XW: number, y0: number): number => {
    let cy = y0;
    head('CALLOUTS', X, cy);
    cy += 12;
    pdf.setFontSize(8.5);
    for (const r of m.legend) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${r.n}`, X, cy);
      pdf.text(r.label, X + 16, cy);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(90);
      cy += 10;
      for (const line of textLines(r.desc, XW - 16)) {
        pdf.text(line, X + 16, cy);
        cy += 10;
      }
      pdf.setTextColor(INK);
      cy += 2;
    }
    return cy;
  };
  const drawTable = (title: string, rows: { k: string; v: string; swatch?: string }[], X: number, XW: number, y0: number): number => {
    let cy = y0;
    head(title, X, cy);
    cy += 6;
    pdf.setFontSize(9);
    for (const r of rows) {
      rule(cy, X, X + XW, 225);
      cy += 12;
      pdf.setFont('helvetica', 'normal');
      pdf.text(r.k, X, cy);
      pdf.setFont('helvetica', 'bold');
      if (r.swatch) {
        pdf.setFillColor(r.swatch);
        pdf.setDrawColor(150);
        pdf.rect(X + XW - pdf.getTextWidth(r.v) - 16, cy - 7, 10, 8, 'FD');
      }
      pdf.text(r.v, X + XW, cy, { align: 'right' });
      cy += 3;
    }
    rule(cy, X, X + XW, 225);
    return cy + 20;
  };
  const drawNotes = (m: FlatModel, X: number, XW: number, y0: number) => {
    let cy = y0;
    head('NOTES', X, cy);
    cy += 12;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    for (const n of m.notes) {
      for (const line of textLines(n, XW)) {
        if (cy > PH - 30) break;
        pdf.text(line, X, cy);
        cy += 10;
      }
      cy += 2;
    }
  };
  /** Spec, materials and notes: stacked in one column, or side by side on the continuation page. */
  const drawSpecs = (m: FlatModel, X: number, XW: number, y0: number, wide: boolean) => {
    if (!wide) {
      let cy = drawTable('SPEC, SAMPLE SIZE M (IN)', m.spec, X, XW, y0);
      cy = drawTable('MATERIALS', m.materials, X, XW, cy);
      cy = drawTable('CONSTRUCTION', m.construction, X, XW, cy);
      drawNotes(m, X, XW, cy);
      return;
    }
    drawTable('SPEC, SAMPLE SIZE M (IN)', m.spec, X, XW, y0);
    const cy = drawTable('MATERIALS', m.materials, X + XW + 30, XW, y0);
    drawTable('CONSTRUCTION', m.construction, X + XW + 30, XW, cy);
    drawNotes(m, X + 2 * (XW + 30), XW, y0);
  };
  /** Height the right hand column needs on a single page. */
  const need = (m: FlatModel): number => {
    pdf.setFontSize(8.5);
    let h = 72 + 12;
    for (const r of m.legend) h += 10 + textLines(r.desc, 248).length * 10 + 2;
    h += 8 + 6 + m.spec.length * 15 + 3 + 20 + 6 + m.materials.length * 15 + 3 + 20 + 6 + m.construction.length * 15 + 3 + 20 + 12;
    for (const n of m.notes) h += textLines(n, 264).length * 10 + 2;
    return h;
  };
  const extra = models.map((m): number => (need(m) > PH - 30 ? 1 : 0));
  const pageNo: number[] = [];
  models.forEach((_, i) => pageNo.push(2 + extra.slice(0, i).reduce((a, b) => a + 1 + b, 0)));

  // cover
  pdf.setTextColor(INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('SDTN STUDIO', 40, 52, { charSpace: 2 });
  pdf.setFontSize(34);
  pdf.text(doc.name, 40, 140);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.text('Tech pack', 40, 164);
  pdf.setFontSize(10);
  pdf.setTextColor(90);
  pdf.text(date, 40, 184);
  pdf.text('Sample size M. All measurements in inches, taken from the drawing.', 40, 200);
  pdf.setTextColor(INK);
  rule(228, 40, PW - 40);
  head('LOOK', 40, 250);
  let y = 270;
  models.forEach((m, i) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`${i + 1}`, 40, y);
    pdf.text(m.g.name, 62, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(90);
    pdf.text(`${m.g.fabric}, ${m.colorway.color}`, 250, y);
    if (m.colorway.name) pdf.text(m.colorway.name, 470, y);
    pdf.text(`Page ${pageNo[i]}`, PW - 40, y, { align: 'right' });
    pdf.setTextColor(INK);
    y += 22;
  });
  const notes = noteLines(doc.notes);
  if (notes.length) {
    y += 14;
    head('SKETCH NOTES', 40, y);
    y += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    for (const n of notes) {
      for (const line of pdf.splitTextToSize(n, PW - 80) as string[]) {
        if (y > PH - 40) break;
        pdf.text(line, 40, y);
        y += 14;
      }
    }
  }

  // one page per garment
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
  document.body.appendChild(host);
  try {
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      pdf.addPage([PW, PH], 'landscape');
      pdf.setTextColor(INK);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(m.g.name, 28, 40);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(doc.name, PW - 28, 32, { align: 'right' });
      pdf.text(date, PW - 28, 44, { align: 'right' });
      pdf.setTextColor(INK);
      rule(54);

      host.innerHTML = flatSheetSvg(m, 'Helvetica, Arial, sans-serif');
      const el = host.querySelector('svg') as SVGSVGElement;
      const areaW = 452, areaH = PH - 100;
      const k = Math.min(areaW / m.sheet.w, areaH / m.sheet.h);
      const w = m.sheet.w * k, h = m.sheet.h * k;
      await svg2pdf(el, pdf, { x: 28 + (areaW - w) / 2, y: 64, width: w, height: h });

      const X = 500, XW = PW - 28 - X;
      let cy = 72;
      cy = drawLegend(m, X, XW, cy);
      if (!extra[i]) {
        cy += 8;
        drawSpecs(m, X, XW, cy, false);
      } else {
        // the callout list is long: spec, materials and notes continue on their own page
        pdf.addPage([PW, PH], 'landscape');
        pdf.setTextColor(INK);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text(`${m.g.name}, spec`, 28, 40);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100);
        pdf.text(doc.name, PW - 28, 32, { align: 'right' });
        pdf.text(date, PW - 28, 44, { align: 'right' });
        pdf.setTextColor(INK);
        rule(54);
        drawSpecs(m, 28, 230, 80, true);
      }
    }
  } finally {
    host.remove();
  }

  // production pages: graphics, colorways, bill of materials
  const col = (txt: string, x: number, y: number, w: number, o?: { bold?: boolean; align?: 'right' }) => {
    pdf.setFont('helvetica', o?.bold ? 'bold' : 'normal');
    const line = (pdf.splitTextToSize(txt, w) as string[])[0] ?? '';
    pdf.text(line, o?.align === 'right' ? x + w : x, y, o?.align ? { align: o.align } : undefined);
  };
  const imgFmt = (src: string) => (/^data:image\/jpe?g/i.test(src) ? 'JPEG' : 'PNG');

  const gfxRows = models.flatMap((m) => m.graphics.map((r) => ({ m, r })));
  const aoRows = models.filter((m) => m.allOver);
  if (gfxRows.length || aoRows.length) {
    const cols = [
      { h: '#', x: 28, w: 16 },
      { h: 'ART', x: 48, w: 44 },
      { h: 'GARMENT', x: 100, w: 140 },
      { h: 'PLACEMENT', x: 246, w: 64 },
      { h: 'METHOD', x: 314, w: 76 },
      { h: 'SIZE W X H', x: 396, w: 86 },
      { h: 'FROM CENTER', x: 488, w: 74 },
      { h: 'FROM HPS / WAISTBAND', x: 568, w: 120 },
      { h: 'ROTATION', x: 694, w: 70 },
    ];
    const gHead = (cont: boolean) => {
      pdf.addPage([PW, PH], 'landscape');
      pageHead(cont ? 'Graphics, continued' : 'Graphics');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(110);
      for (const c of cols) pdf.text(c.h, c.x, 74, { charSpace: 0.8 });
      pdf.setTextColor(INK);
      rule(80);
      return 98;
    };
    let y = gHead(false);
    const RH = 50;
    for (const { m, r } of gfxRows) {
      if (y + RH > PH - 36) y = gHead(true);
      try {
        const box = 40;
        const asp = r.h / Math.max(r.w, 0.01);
        const w = asp > 1 ? box / asp : box, h = asp > 1 ? box : box * asp;
        pdf.addImage(r.src, imgFmt(r.src), 48 + (box - w) / 2, y - 12 + (box - h) / 2, w, h);
      } catch {
        // artwork the pdf cannot embed is left out of the thumbnail
      }
      pdf.setFontSize(9);
      pdf.setTextColor(INK);
      col(`${r.n}`, cols[0].x, y + 8, cols[0].w, { bold: true });
      col(`${m.g.name}, ${r.name}`, cols[2].x, y + 8, cols[2].w);
      col(r.side === 'front' ? 'Front' : 'Back', cols[3].x, y + 8, cols[3].w);
      col(r.method, cols[4].x, y + 8, cols[4].w);
      col(`${r.w} x ${r.h} in`, cols[5].x, y + 8, cols[5].w, { bold: true });
      col(`${r.fromCenter} in`, cols[6].x, y + 8, cols[6].w);
      col(`${r.fromRef} in below ${r.refName === 'HPS' ? 'HPS' : 'band'}`, cols[7].x, y + 8, cols[7].w);
      col(`${Math.round(r.rot)} deg`, cols[8].x, y + 8, cols[8].w);
      y += RH;
      rule(y - 16, 28, PW - 28, 225);
    }
    if (aoRows.length) {
      if (y + 40 > PH - 36) y = gHead(true);
      y += 4;
      head('ALL-OVER PRINTS', 28, y);
      y += 18;
      for (const m of aoRows) {
        if (y + 24 > PH - 36) y = gHead(true);
        const a = m.allOver!;
        pdf.setFontSize(9);
        col(m.g.name, 100, y, 140, { bold: true });
        col(`${a.name}, repeat ${a.w} x ${a.h} in, rotated ${Math.round(a.rot)} deg`, 246, y, 500);
        y += 18;
      }
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text('Measured from the center line to the middle of the artwork, and down from the high point shoulder (tops) or the top of the waistband (bottoms).', 28, PH - 34);
    pdf.setTextColor(INK);
  }

  const cws = doc.colorways ?? [];
  if (cws.length) {
    pdf.addPage([PW, PH], 'landscape');
    pageHead('Colorways');
    const gw = 170;
    const cw = Math.min(180, (PW - 56 - gw) / cws.length);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(110);
    pdf.text('GARMENT', 28, 76, { charSpace: 0.8 });
    cws.forEach((c, i) => pdf.text(c.name.toUpperCase() + (c.id === doc.activeColorway ? ' *' : ''), 28 + gw + i * cw, 76, { charSpace: 0.8 }));
    pdf.setTextColor(INK);
    rule(82);
    let y = 100;
    for (const m of models) {
      if (y > PH - 60) break;
      pdf.setFontSize(10);
      col(m.g.name, 28, y + 8, gw - 10, { bold: true });
      cws.forEach((c, i) => {
        const v = c.colors[m.g.id] ?? garmentColor(m.g);
        const x = 28 + gw + i * cw;
        pdf.setFillColor(v.hex);
        pdf.setDrawColor(150);
        pdf.rect(x, y - 2, 22, 22, 'FD');
        pdf.setFontSize(9);
        col(v.name, x + 28, y + 8, cw - 34, { bold: true });
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        col(v.pantone ? `${v.hex.toUpperCase()}  ${v.pantone}` : v.hex.toUpperCase(), x + 28, y + 19, cw - 34);
        pdf.setTextColor(INK);
      });
      y += 38;
      rule(y - 10, 28, PW - 28, 225);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text('* active colorway in the sketch', 28, PH - 34);
    pdf.setTextColor(INK);
  }

  // bill of materials: one table per garment, then the look total
  {
    const bcols = [
      { h: 'ITEM', x: 28, w: 150, r: false },
      { h: 'DETAIL', x: 184, w: 330, r: false },
      { h: 'QTY', x: 520, w: 70, r: false },
      { h: 'COST EACH', x: 596, w: 70, r: true },
      { h: 'LINE COST', x: 672, w: 92, r: true },
    ];
    const bHead = (title: string) => {
      pdf.addPage([PW, PH], 'landscape');
      pageHead(title);
      return 76;
    };
    const tHead = (y: number) => {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(110);
      for (const c of bcols) {
        if (c.r) pdf.text(c.h, c.x + c.w, y, { align: 'right', charSpace: 0.8 });
        else pdf.text(c.h, c.x, y, { charSpace: 0.8 });
      }
      pdf.setTextColor(INK);
      rule(y + 6);
      return y + 20;
    };
    const row = (r: BomRow, y: number) => {
      pdf.setFontSize(9);
      col(r.item, bcols[0].x, y, bcols[0].w, { bold: true });
      col(r.detail, bcols[1].x, y, bcols[1].w);
      col(`${r.qty} ${r.unit}`, bcols[2].x, y, bcols[2].w);
      col(r.cost != null ? money(r.cost) : '', bcols[3].x, y, bcols[3].w, { align: 'right' });
      col(r.cost != null ? money(rowTotal(r)) : '', bcols[4].x, y, bcols[4].w, { align: 'right' });
    };
    let y = bHead('Bill of materials');
    let first = true;
    for (const m of models) {
      const need = 40 + (m.bom.length + 1) * 17;
      if (!first && y + need > PH - 40) y = bHead('Bill of materials, continued');
      first = false;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(m.g.name + (m.colorway.name ? `, ${m.colorway.name}` : ''), 28, y);
      y = tHead(y + 16);
      for (const r of m.bom) {
        if (y > PH - 50) {
          y = bHead(`Bill of materials, ${m.g.name}, continued`);
          y = tHead(y);
        }
        row(r, y);
        y += 17;
        rule(y - 11, 28, PW - 28, 235);
      }
      col('Total cost per unit', 28, y + 2, 200, { bold: true });
      col(money(m.bomTotal), bcols[4].x, y + 2, bcols[4].w, { bold: true, align: 'right' });
      y += 34;
    }
    if (models.length > 1) {
      if (y + 40 + models.length * 16 > PH - 40) y = bHead('Bill of materials, look total');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Look total, one of each', 28, y);
      y += 18;
      let sum = 0;
      for (const m of models) {
        sum += m.bomTotal;
        pdf.setFontSize(9);
        col(m.g.name, 28, y, 300);
        col(money(m.bomTotal), bcols[4].x, y, bcols[4].w, { align: 'right' });
        y += 16;
      }
      rule(y - 10);
      col('Total', 28, y + 4, 200, { bold: true });
      col(money(sum), bcols[4].x, y + 4, bcols[4].w, { bold: true, align: 'right' });
    }
  }

  const N = pdf.getNumberOfPages();
  for (let i = 1; i <= N; i++) {
    pdf.setPage(i);
    foot(i, N);
  }
  save(pdf.output('blob'), `${base(doc.name)}-tech-pack.pdf`);
  return true;
}
