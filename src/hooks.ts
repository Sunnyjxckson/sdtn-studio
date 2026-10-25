import { useEffect } from 'react';
import { bootProjects, refreshThumb, saveNow } from './projects';
import { handleVectorKey } from './vector/commands';
import { COLLECTION_TABS, toolBrush, useStore, type DrawTool, type Tool } from './store';

/** Restore from IndexedDB once, then auto-save (debounced) on every change to the open project. */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let thumbTimer: ReturnType<typeof setTimeout> | undefined;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    bootProjects().then(() => {
      if (cancelled) return;
      unsub = useStore.subscribe((s, prev) => {
        if (s.screen !== 'studio') return;
        if (s.doc === prev.doc && s.project === prev.project && s.selectedId === prev.selectedId) return;
        clearTimeout(timer);
        timer = setTimeout(() => void saveNow(), 400);
        clearTimeout(thumbTimer);
        thumbTimer = setTimeout(() => void refreshThumb(), 2500);
      });
    });
    const flush = () => void saveNow();
    window.addEventListener('pagehide', flush);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(thumbTimer);
      unsub?.();
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}

const KEYS: Record<string, Tool> = { v: 'move', a: 'add', e: 'erase', c: 'cut', o: 'hole', d: 'distress', t: 'text', n: 'note', h: 'hand' };

const DRAW_KEYS: Record<string, DrawTool> = { b: 'brush', s: 'smudge', e: 'erase', g: 'fill', i: 'eyedrop', h: 'hand' };

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const st = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (st.screen !== 'studio' || COLLECTION_TABS.includes(st.tab)) return;
      if (st.tab === 'vector') {
        handleVectorKey(e);
        return;
      }
      if (mod || e.altKey) return;
      if (st.tab === 'draw') {
        const dt = DRAW_KEYS[e.key.toLowerCase()];
        if (dt) st.setDrawTool(dt);
        if (e.key === '[' || e.key === ']') {
          const t = st.drawTool === 'smudge' || st.drawTool === 'erase' ? st.drawTool : 'brush';
          const cur = toolBrush(st.drawPrefs, t);
          const next = Math.max(0.5, Math.min(120, cur.size * (e.key === ']' ? 1.15 : 1 / 1.15)));
          st.setDrawPrefs((p) => void (p.size[cur.key] = Math.round(next * 10) / 10));
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedId) {
        e.preventDefault();
        st.removeGarment(st.selectedId);
        return;
      }
      const tool = KEYS[e.key.toLowerCase()];
      if (tool) st.setTool(tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
