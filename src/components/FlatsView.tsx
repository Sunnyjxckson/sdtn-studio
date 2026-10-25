import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { torsoProfile } from '../model/figure';
import { buildFlat, flatSheetSvg } from '../model/flats';
import { money, rowTotal } from '../model/production';

export function FlatsView() {
  const doc = useStore((s) => s.doc);
  const [busy, setBusy] = useState(false);
  const models = useMemo(() => {
    const t = torsoProfile(doc.base.sex, doc.base.pose);
    const cw = doc.colorways?.find((c) => c.id === doc.activeColorway)?.name;
    return doc.garments.filter((g) => g.visible).map((g) => buildFlat(g, t, cw));
  }, [doc.garments, doc.base.sex, doc.base.pose, doc.colorways, doc.activeColorway]);

  const svg = async () => {
    const { exportFlatsSvg } = await import('../flatsExport');
    exportFlatsSvg(doc, models);
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const { exportTechPack } = await import('../flatsExport');
      await exportTechPack(doc, models);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stage">
      <div className="patternbar">
        <span className="toolname">Flats</span>
        <span className="muted small toolhelp">
          {models.length
            ? 'Front and back, built from your sketch. Edit a garment and the flat follows. Sample size M, inches.'
            : 'Add jeans or a top from the Library to see their flats.'}
        </span>
        <div className="barend">
          <button className="btn" style={{ padding: '6px 12px' }} onClick={svg} disabled={!models.length}>
            SVG flats
          </button>
          <button className="primary" onClick={pdf} disabled={!models.length || busy}>
            {busy ? 'Building PDF' : 'Tech pack PDF'}
          </button>
        </div>
      </div>
      <div className="canvaswrap">
        <div className="flatswrap" data-testid="flats">
          {models.map((m) => (
            <section className="flatcard" key={m.g.id} data-testid="flat-card">
              <h3 className="flattitle">{m.g.name}</h3>
              <div className="flatbody">
                <div className="flatsheet" dangerouslySetInnerHTML={{ __html: flatSheetSvg(m) }} />
                <div className="flatside">
                  <h4 className="label">CALLOUTS</h4>
                  <ol className="legend">
                    {m.legend.map((r) => (
                      <li key={r.n}>
                        <span className="legn mono">{r.n}</span>
                        <span>
                          <b>{r.label}</b>
                          <span className="muted small"> {r.desc}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <h4 className="label">SPEC, SAMPLE SIZE M</h4>
                  <table data-testid="flat-spec">
                    <tbody>
                      {m.spec.map((r) => (
                        <tr key={r.k}>
                          <td>{r.k}</td>
                          <td className="mono">{r.v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h4 className="label">MATERIALS</h4>
                  <table>
                    <tbody>
                      {m.materials.map((r) => (
                        <tr key={r.k}>
                          <td>{r.k}</td>
                          <td className="mono">
                            {r.swatch && <i className="wsw" style={{ background: r.swatch }} />}
                            {r.v}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h4 className="label">CONSTRUCTION</h4>
                  <table data-testid="flat-construction">
                    <tbody>
                      {m.construction.map((r) => (
                        <tr key={r.k}>
                          <td>{r.k}</td>
                          <td className="mono">{r.v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {m.graphics.length > 0 && (
                    <>
                      <h4 className="label">GRAPHICS</h4>
                      <table data-testid="flat-graphics">
                        <tbody>
                          {m.graphics.map((r) => (
                            <tr key={r.id}>
                              <td>
                                {r.n}. {r.name}
                                <span className="muted small"> {r.side}, {r.method}</span>
                              </td>
                              <td className="mono">
                                {r.w} x {r.h} in
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  <h4 className="label">BILL OF MATERIALS</h4>
                  <table className="flatbom" data-testid="flat-bom">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="r">Qty</th>
                        <th className="r">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.bom.map((r) => (
                        <tr key={r.key}>
                          <td>
                            <b>{r.item}</b>
                            <span className="muted small"> {r.detail}</span>
                          </td>
                          <td className="r mono">
                            {r.qty} {r.unit}
                          </td>
                          <td className="r mono">{r.cost != null ? money(rowTotal(r)) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}>Total per unit</td>
                        <td className="r mono">{money(m.bomTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <h4 className="label">NOTES</h4>
                  <ul className="flatnotes small muted">
                    {m.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
