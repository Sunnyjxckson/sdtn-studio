import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { newId } from '../model/garment';
import { MOOD_H, MOOD_W, type MoodItem } from '../model/project';
import { canvasBlob, downloadBlob, fileBase, loadImage } from '../download';

const CHIP_W = 120;
const CHIP_H = 92;
const NOTE_PAD = 12;
const NOTE_LINE = 20;

/** Read an image file and shrink it so a board of many images stays small. */
async function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('read'));
    r.readAsDataURL(file);
  });
  const img = await loadImage(raw);
  const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  if (k === 1 && raw.length < 600_000) return { src: raw, w, h };
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const png = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/svg+xml';
  return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w, h };
}

function wrap(x: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (line && x.measureText(t).width > maxW) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

async function exportBoard(name: string, items: MoodItem[]) {
  if (!items.length) return;
  const noteFont = "15px 'IBM Plex Sans', Arial, sans-serif";
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = noteFont;
  const box = (m: MoodItem) => {
    if (m.kind === 'image') return { w: m.w, h: m.h };
    if (m.kind === 'chip') return { w: CHIP_W, h: CHIP_H };
    return { w: m.w, h: wrap(probe, m.text, m.w - NOTE_PAD * 2).length * NOTE_LINE + NOTE_PAD * 2 };
  };
  const M = 40;
  const x0 = Math.min(...items.map((m) => m.x)) - M;
  const y0 = Math.min(...items.map((m) => m.y)) - M;
  const x1 = Math.max(...items.map((m) => m.x + box(m).w)) + M;
  const y1 = Math.max(...items.map((m) => m.y + box(m).h)) + M;
  const S = 2;
  const c = document.createElement('canvas');
  c.width = Math.round((x1 - x0) * S);
  c.height = Math.round((y1 - y0) * S);
  const x = c.getContext('2d')!;
  x.scale(S, S);
  x.translate(-x0, -y0);
  x.fillStyle = '#F4F2ED';
  x.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const m of items) {
    if (m.kind === 'image') {
      try {
        x.drawImage(await loadImage(m.src), m.x, m.y, m.w, m.h);
      } catch {
        // skip an image that cannot be decoded
      }
    } else if (m.kind === 'chip') {
      x.fillStyle = m.color;
      x.fillRect(m.x, m.y, CHIP_W, 64);
      x.fillStyle = '#FFFFFF';
      x.fillRect(m.x, m.y + 64, CHIP_W, CHIP_H - 64);
      x.strokeStyle = '#d6d2c8';
      x.strokeRect(m.x + 0.5, m.y + 0.5, CHIP_W - 1, CHIP_H - 1);
      x.fillStyle = '#141414';
      x.font = "500 12px 'IBM Plex Mono', monospace";
      x.fillText(m.label || m.color.toUpperCase(), m.x + 10, m.y + 83, CHIP_W - 20);
    } else {
      const b = box(m);
      x.fillStyle = '#FFFFFF';
      x.fillRect(m.x, m.y, b.w, b.h);
      x.strokeStyle = '#d6d2c8';
      x.strokeRect(m.x + 0.5, m.y + 0.5, b.w - 1, b.h - 1);
      x.fillStyle = '#141414';
      x.font = noteFont;
      wrap(x, m.text, m.w - NOTE_PAD * 2).forEach((l, i) => x.fillText(l, m.x + NOTE_PAD, m.y + NOTE_PAD + 14 + i * NOTE_LINE));
    }
  }
  downloadBlob(await canvasBlob(c), `${fileBase(name)}-mood-board.png`);
}

type Drag = { id: string; sx: number; sy: number; ox: number; oy: number; mode: 'move' | 'size'; ow: number; ratio: number };

export function MoodView({ Nav }: { Nav: React.ComponentType<{ children?: React.ReactNode }> }) {
  const items = useStore((s) => s.project.mood);
  const name = useStore((s) => s.project.name);
  const add = useStore((s) => s.addMood);
  const remove = useStore((s) => s.removeMood);
  const begin = useStore((s) => s.beginMood);
  const edit = useStore((s) => s.editMood);
  const setText = useStore((s) => s.setMoodText);
  const [sel, setSel] = useState<string | null>(null);
  const [chipColor, setChipColor] = useState('#8d5e43');
  const [over, setOver] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null);

  const spot = (n: number) => ({ x: 60 + (n % 6) * 40, y: 60 + (n % 6) * 40 });

  const addImages = async (list: FileList | File[], at?: { x: number; y: number }) => {
    let n = 0;
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const im = await readImage(f);
        const w = Math.min(320, im.w);
        const h = Math.round((w * im.h) / im.w);
        const p = at ? { x: at.x + n * 24, y: at.y + n * 24 } : spot(useStore.getState().project.mood.length);
        add({ id: newId(), kind: 'image', x: Math.max(0, p.x), y: Math.max(0, p.y), w, h, src: im.src });
        n++;
      } catch {
        // unreadable image, skip it
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        remove(sel);
        setSel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, remove]);

  const down = (e: React.PointerEvent, m: MoodItem, mode: 'move' | 'size') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSel(m.id);
    begin();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id: m.id,
      sx: e.clientX,
      sy: e.clientY,
      ox: m.x,
      oy: m.y,
      mode,
      ow: m.kind === 'image' ? m.w : m.kind === 'note' ? m.w : 0,
      ratio: m.kind === 'image' ? m.h / m.w : 1,
    };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (d.mode === 'move') edit(d.id, { x: Math.max(0, Math.min(MOOD_W - 40, Math.round(d.ox + dx))), y: Math.max(0, Math.min(MOOD_H - 40, Math.round(d.oy + dy))) });
    else {
      const w = Math.max(60, Math.round(d.ow + dx));
      const it = useStore.getState().project.mood.find((x) => x.id === d.id);
      if (it?.kind === 'image') edit(d.id, { w, h: Math.round(w * d.ratio) });
      else if (it?.kind === 'note') edit(d.id, { w: Math.max(120, w) });
    }
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <div className="stage">
      <Nav>
        <button className="btn mini" onClick={() => files.current?.click()}>
          Add image
        </button>
        <button
          className="btn mini"
          onClick={() => {
            const p = spot(items.length);
            const id = newId();
            add({ id, kind: 'note', x: p.x, y: p.y, w: 220, text: 'Note' });
            setSel(id);
          }}
        >
          Add note
        </button>
        <input type="color" aria-label="Chip color" className="chipcolor" value={chipColor} onChange={(e) => setChipColor(e.target.value)} />
        <button
          className="btn mini"
          onClick={() => {
            const p = spot(items.length);
            add({ id: newId(), kind: 'chip', x: p.x, y: p.y, color: chipColor, label: chipColor.toUpperCase() });
          }}
        >
          Add color
        </button>
        <button className="primary" disabled={!items.length} onClick={() => void exportBoard(name, items)}>
          Board PNG
        </button>
        <input
          ref={files}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addImages(e.target.files);
            e.target.value = '';
          }}
        />
      </Nav>
      <div className="canvaswrap">
        <div
          className={over ? 'moodscroll over' : 'moodscroll'}
          data-testid="mood"
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const r = board.current!.getBoundingClientRect();
            void addImages(e.dataTransfer.files, { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) });
          }}
          onPointerDown={() => setSel(null)}
        >
          <div ref={board} className="moodboard" style={{ width: MOOD_W, height: MOOD_H }}>
            {items.length === 0 && <p className="muted moodhint">Drop images here, or add notes and color chips. Drag to place.</p>}
            {items.map((m) => (
              <div
                key={m.id}
                className={sel === m.id ? 'mooditem on' : 'mooditem'}
                data-testid={`mood-${m.kind}`}
                style={{ left: m.x, top: m.y, width: m.kind === 'chip' ? CHIP_W : m.w }}
                onPointerDown={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
                    e.stopPropagation();
                    setSel(m.id);
                    return;
                  }
                  down(e, m, 'move');
                }}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              >
                {m.kind === 'image' && <img src={m.src} alt="" draggable={false} style={{ width: '100%', height: m.h }} />}
                {m.kind === 'note' && <textarea aria-label="Note" className="moodnote" value={m.text} onChange={(e) => setText(m.id, e.target.value)} />}
                {m.kind === 'chip' && (
                  <div className="moodchip">
                    <div className="chipswatch" style={{ background: m.color }} />
                    <input aria-label="Chip label" className="mono" value={m.label} onChange={(e) => setText(m.id, e.target.value)} />
                  </div>
                )}
                {sel === m.id && (
                  <>
                    <button className="mooddel" aria-label="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => (remove(m.id), setSel(null))}>
                      x
                    </button>
                    {m.kind !== 'chip' && <span className="moodsize" onPointerDown={(e) => down(e, m, 'size')} />}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
