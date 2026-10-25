// Flats exports: one svg with every flat, and the tech pack pdf (jsPDF + svg2pdf.js, loaded on demand).
import { flatSheetSvg, flatsFileSvg, noteLines, type FlatModel } from './model/flats';
import type { Doc } from './model/doc';

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
  const foot = (n: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`SDTN Studio  |  ${doc.name}`, 28, PH - 18);
    pdf.text(`${n} / ${total}`, PW - 28, PH - 18, { align: 'right' });
    pdf.setTextColor(INK);
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
      drawNotes(m, X, XW, cy);
      return;
    }
    drawTable('SPEC, SAMPLE SIZE M (IN)', m.spec, X, XW, y0);
    drawTable('MATERIALS', m.materials, X + XW + 30, XW, y0);
    drawNotes(m, X + 2 * (XW + 30), XW, y0);
  };
  /** Height the right hand column needs on a single page. */
  const need = (m: FlatModel): number => {
    pdf.setFontSize(8.5);
    let h = 72 + 12;
    for (const r of m.legend) h += 10 + textLines(r.desc, 248).length * 10 + 2;
    h += 8 + 6 + m.spec.length * 15 + 3 + 20 + 6 + m.materials.length * 15 + 3 + 20 + 12;
    for (const n of m.notes) h += textLines(n, 264).length * 10 + 2;
    return h;
  };
  const extra = models.map((m): number => (need(m) > PH - 30 ? 1 : 0));
  const pageNo: number[] = [];
  models.forEach((_, i) => pageNo.push(2 + extra.slice(0, i).reduce((a, b) => a + 1 + b, 0)));
  const total = 1 + extra.reduce((a, b) => a + 1 + b, 0);

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
    pdf.text(`${m.g.fabric}, ${m.g.wash}`, 300, y);
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
  foot(1);

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
        foot(pageNo[i]);
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
      foot(pageNo[i] + extra[i]);
    }
  } finally {
    host.remove();
  }
  save(pdf.output('blob'), `${base(doc.name)}-tech-pack.pdf`);
  return true;
}
