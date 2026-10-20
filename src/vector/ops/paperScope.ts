// Bridge between our vector paths and paper.js, used for booleans, offsets, simplify and SVG import.
import paper from 'paper/dist/paper-core';
import { makePath, type VNode, type VPath, type VStyle, type VSub } from '../../model/vector';

let ready = false;

/** A headless paper.js scope (no canvas). */
export function ensurePaper(): typeof paper {
  if (!ready) {
    paper.setup(new paper.Size(1, 1));
    paper.settings.insertItems = false;
    ready = true;
  }
  return paper;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function subToPaper(s: VSub): paper.Path {
  const P = ensurePaper();
  const segs = s.nodes.map(
    (n) => new P.Segment(new P.Point(n.x, n.y), new P.Point(n.ix - n.x, n.iy - n.y), new P.Point(n.ox - n.x, n.oy - n.y)),
  );
  return new P.Path({ segments: segs, closed: s.closed, insert: false });
}

/** A VPath as a paper Path (one sub path) or CompoundPath. Geometry only. */
export function toPaper(p: VPath): paper.PathItem {
  const P = ensurePaper();
  if (p.subs.length === 1) {
    const one = subToPaper(p.subs[0]);
    one.fillRule = p.style.fillRule;
    return one;
  }
  const c = new P.CompoundPath({ children: p.subs.map(subToPaper), insert: false });
  c.fillRule = p.style.fillRule;
  return c;
}

function pathToSub(path: paper.Path): VSub | null {
  if (!path.segments || path.segments.length === 0) return null;
  const nodes: VNode[] = path.segments.map((sg) => {
    const x = sg.point.x, y = sg.point.y;
    const hi = sg.handleIn, ho = sg.handleOut;
    const smooth = !hi.isZero() && !ho.isZero() && Math.abs(hi.getDirectedAngle(ho.multiply(-1))) < 1;
    return { x: r3(x), y: r3(y), ix: r3(x + hi.x), iy: r3(y + hi.y), ox: r3(x + ho.x), oy: r3(y + ho.y), smooth: smooth || undefined };
  });
  return { nodes, closed: path.closed };
}

/** Flatten any paper item tree into sub paths. */
export function paperSubs(item: paper.Item): VSub[] {
  const P = ensurePaper();
  if (item instanceof P.Path) {
    const s = pathToSub(item);
    return s ? [s] : [];
  }
  return (item.children ?? []).flatMap((c) => paperSubs(c));
}

/** A paper result back as a VPath with the given style, or null if empty. */
export function fromPaper(item: paper.Item, style: VStyle, name = 'Path'): VPath | null {
  const subs = paperSubs(item).filter((s) => s.nodes.length > (s.closed ? 2 : 1));
  if (!subs.length) return null;
  return makePath(subs, style, name);
}
