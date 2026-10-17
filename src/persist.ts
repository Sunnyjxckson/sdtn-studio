import { get, set } from 'idb-keyval';
import type { Doc } from './model/doc';

const KEY = 'sdtn-studio:doc:v1';

interface Saved {
  v: 1;
  doc: Doc;
  selectedId: string | null;
}

export async function loadSaved(): Promise<Saved | null> {
  try {
    const s = await get<Saved>(KEY);
    if (s && s.v === 1 && s.doc && Array.isArray(s.doc.garments)) return s;
  } catch {
    // storage unavailable, start fresh
  }
  return null;
}

export async function save(doc: Doc, selectedId: string | null): Promise<void> {
  try {
    await set(KEY, { v: 1, doc, selectedId } satisfies Saved);
  } catch {
    // ignore quota or private mode errors
  }
}
