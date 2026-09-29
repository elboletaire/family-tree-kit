/* Shared state: the focused person, through whose eyes all the views look */
import { createSignal } from 'solid-js';
import { DATA, P } from './data';
import { kinship, type Kin } from './kinship';
import type { Data } from './types';
import { store } from './util';

/** Filter by kinship with the focused person: everybody, their blood family, or their direct line */
export type Scope = 'all' | 'blood' | 'direct';

const STORE_KEY = 'arbre-focus';
const [focus, setFocusSignal] = createSignal('');
/** Person through whose eyes the family is seen */
export { focus };
/** Changes the focused person and remembers it */
export function setFocus(id: string): void { setFocusSignal(id); store.set(STORE_KEY, id); }
/** Changes the focused person without remembering it: the default one (the main person), not a choice */
export function setDefaultFocus(id: string): void { setFocusSignal(id); }
/** The person chosen and remembered, if any */
export const savedFocus = (): string | null => store.get(STORE_KEY);
/** The remembered one, or the main one */
export function initFocus(): void {
  const saved = savedFocus();
  setFocusSignal(saved && P.has(saved) ? saved : DATA.main);
}

// Kinship is computed once per focused person (and per data set, which the tests change). It derives from `focus`
// like a createMemo, but without needing an owner (createRoot) at module level.
let kinCache: { id: string; data: Data; map: Map<string, Kin> } | null = null;
/** Kinship of each person with the focused one */
export const kin = (): Map<string, Kin> => {
  const id = focus();
  if (kinCache?.id !== id || kinCache.data !== DATA) kinCache = { id, data: DATA, map: kinship(id) };
  return kinCache.map;
};
export const focusName = (): string => { const p = P.get(focus())!; return p.given || p.name; };
export const kinOf = (id: string): Kin | null | undefined => id === focus() ? null : kin().get(id);
/** Set to filter by: direct line (ancestors and descendants) or the whole blood family; null, everybody */
export const kinSet = (scope: Scope): Set<string> | null => scope === 'all' ? null
  : new Set([...kin()].filter(([, k]) => k.kind === 'self' || k.kind === 'direct' || (scope === 'blood' && k.kind === 'blood')).map(([id]) => id));
