// Line sheet PDF: one row per style with flat, name, number, colorways, fabric and price.
import { buildFlat, flatSheetSvg } from './model/flats';
import { torsoProfile } from './model/figure';
import { styleRows, type Project } from './model/project';
import { downloadBlob, fileBase } from './download';

const PW = 792, PH = 612;
const M = 36;
const ROW = 84;
const TOP = 96;
const COLS = [
  { k: 'FLAT', x: M, w: 130 },
  { k: 'STYLE', x: M + 140, w: 170 },
  { k: 'NUMBER', x: M + 320, w: 110 },
  { k: 'LOOKS', x: M + 440, w: 50 },
  { k: 'COLORWAYS', x: M + 500, w: 90 },
  { k: 'FABRIC', x: M + 600, w: 70 },
  { k: 'PRICE', x: PW - M, w: 60 },
];

export async function exportLineSheet(p: Project): Promise<boolean> {
  const rows = styleRows(p);
  if (!rows.length) return false;
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const pdf = new jsPDF({ unit: 'pt', format: [PW, PH], orientation: 'landscape' });
  const perPage = Math.floor((PH - TOP - 40) / ROW);
  const pages = Math.ceil(rows.length / perPage);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden';
  document.body.appendChild(host);
  try {
    for (let pg = 0; pg < pages; pg++) {
      if (pg > 0) pdf.addPage([PW, PH], 'landscape');
      pdf.setTextColor(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('SDTN', M, 42, { charSpace: 2 });
      pdf.setFontSize(18);
      pdf.text(`${p.name}  |  ${p.season}`, M + 56, 44);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text('LINE SHEET', PW - M, 36, { align: 'right', charSpace: 1.2 });
      pdf.text(date, PW - M, 48, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      for (const c of COLS) pdf.text(c.k, c.x, TOP - 8, { align: c.k === 'PRICE' ? 'right' : 'left', charSpace: 1 });
      pdf.setDrawColor(40);
      pdf.setLineWidth(0.8);
      pdf.line(M, TOP - 2, PW - M, TOP - 2);
      const slice = rows.slice(pg * perPage, pg * perPage + perPage);
      for (let i = 0; i < slice.length; i++) {
        const r = slice[i];
        const y = TOP + i * ROW;
        pdf.setDrawColor(215);
        pdf.setLineWidth(0.5);
        pdf.line(M, y + ROW - 2, PW - M, y + ROW - 2);
        const base = p.looks[r.looks[0] - 1].doc.base;
        const m = buildFlat(r.g, torsoProfile(base.sex, base.pose));
        host.innerHTML = flatSheetSvg(m, 'Helvetica, Arial, sans-serif');
        const el = host.querySelector('svg') as SVGSVGElement;
        const bw = 128, bh = ROW - 10;
        const k = Math.min(bw / m.sheet.w, bh / m.sheet.h);
        await svg2pdf(el, pdf, { x: M + (bw - m.sheet.w * k) / 2, y: y + 3 + (bh - m.sheet.h * k) / 2, width: m.sheet.w * k, height: m.sheet.h * k });
        pdf.setTextColor(20);
        const cell = (t: string, c: (typeof COLS)[number], bold = false, lines = 3) => {
          pdf.setFont('helvetica', bold ? 'bold' : 'normal');
          const ls = (pdf.splitTextToSize(t || '-', c.w) as string[]).slice(0, lines);
          ls.forEach((l, j) => pdf.text(l, c.x, y + 16 + j * 12, { align: c.k === 'PRICE' ? 'right' : 'left' }));
        };
        pdf.setFontSize(10);
        cell(r.name, COLS[1], true);
        pdf.setFontSize(8.5);
        cell(r.number, COLS[2]);
        cell(r.looks.map((n) => String(n).padStart(2, '0')).join(', '), COLS[3]);
        cell(r.colorways, COLS[4]);
        cell(r.fabric, COLS[5]);
        pdf.setFontSize(10);
        cell(r.price, COLS[6], true, 1);
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`SDTN Studio  |  ${p.name}`, M, PH - 20);
      pdf.text(`${pg + 1} / ${pages}`, PW - M, PH - 20, { align: 'right' });
    }
  } finally {
    host.remove();
  }
  downloadBlob(pdf.output('blob'), `${fileBase(p.name)}-line-sheet.pdf`);
  return true;
}
