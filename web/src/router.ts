/* Navigation. The hash is «#view/focus[/panel][?filtro=…&lugar=…]»; the open side panel goes in the third segment
   («p:slug», «d:F001», «r:revision»), so the browser's back button returns to the previous card instead of changing
   view; the filter of people the views share (everybody, blood family, direct line) goes after «?filtro=», unless it
   is the default one; the place chosen on the map, after «lugar=» (only in the map).
   The view, the panel and the focused person are signals: the components render from them.
   The view segments of the hash stay in Spanish (#arbol, #abanico…), because the family has saved links; the
   English names of the views are accepted too. */
import { batch, createSignal } from 'solid-js';
import { DATA, P, S } from './data';
import { listen } from './events';
import { isFamily, setFamily } from './family';
import { focus, setFocus, type Scope } from './state';
import type { ResearchKey } from './types';
import { placeKeys } from './views/mapLayout';

export const VIEWS = ['home', 'tree', 'fan', 'timeline', 'voyage', 'map', 'documents', 'news'] as const;
export type ViewName = typeof VIEWS[number];
/** Segment of each view in the hash */
export const VIEW_SEGMENT: Record<ViewName, string> = {
  home: 'inicio', tree: 'arbol', fan: 'abanico', timeline: 'cronologia', voyage: 'viaje', map: 'mapa', documents: 'documentos',
  news: 'novedades',
};
/** History state: `depth` is how many cards are open in a row (for the ← button) */
export interface HistoryState { depth: number }

const [view, setView] = createSignal<ViewName>('home');
const [panel, setPanel] = createSignal<string | null>(null);
const [depth, setDepth] = createSignal(0);
/** Active view and open side panel («p:slug», «d:F001», «r:revision» or null) */
export { panel, view };
/** The panel's ← button shows from the second card opened in a row */
export const canGoBack = (): boolean => Boolean(panel()) && depth() > 1;

/** The filter of people the views start with */
export const DEFAULT_SCOPE: Scope = 'blood';
/** Name and values of the filter in the hash, in Spanish like the view segments */
const SCOPE_PARAM = 'filtro';
const SCOPE_VALUE: Record<Scope, string> = { all: 'todos', blood: 'sangre', direct: 'linea' };
const [scope, setScopeSignal] = createSignal<Scope>(DEFAULT_SCOPE);
/** Filter of people of the views (whose facts, lives and documents are seen) */
export { scope };
const scopeOf = (value: string | null): Scope =>
  (Object.keys(SCOPE_VALUE) as Scope[]).find(s => SCOPE_VALUE[s] === value) ?? DEFAULT_SCOPE;

/** Name of the place chosen on the map in the hash; its value is the key of the map's point */
const PLACE_PARAM = 'lugar';
const [place, setPlaceSignal] = createSignal<string | null>(null);
/** Place chosen on the map (the key of its point), or null */
export { place };

/** «?filtro=…&lugar=…» of a filter (nothing for the default one) and of a place of the map */
function hashQuery(s: Scope, pl: string | null): string {
  const params = [
    ...s === DEFAULT_SCOPE ? [] : [`${SCOPE_PARAM}=${SCOPE_VALUE[s]}`],
    ...pl ? [`${PLACE_PARAM}=${encodeURIComponent(pl).replace(/%2C/g, ',')}`] : [],
  ];
  return params.length ? '?' + params.join('&') : '';
}

/** Hash of a view, optionally with a focused person and a panel; with the current filter and, in the map, the place
    chosen (or `pl`) */
export const viewHash = (v: ViewName, id?: string, pnl?: string | null, pl: string | null = place()): string =>
  `#${VIEW_SEGMENT[v]}${id ? '/' + id : ''}${pnl ? '/' + pnl : ''}${hashQuery(scope(), v === 'map' ? pl : null)}`;
/** The path and the query of the hash («mapa/slug», «filtro=sangre») */
export const splitHash = (hash: string): [string, string] => {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  return [decodeURIComponent(path), query];
};
/** The view named by a hash segment (in Spanish or in English), or null */
const viewOf = (segment: string): ViewName | null =>
  VIEWS.find(v => VIEW_SEGMENT[v] === segment || v === segment) ?? null;
const historyDepth = (): number => (history.state as HistoryState | null)?.depth ?? 0;
/** The panel, if what it names exists */
function validPanel(pnl: string | null): string | null {
  const [kind, key] = (pnl || '').split(':');
  const ok = (kind === 'p' && P.has(key)) || (kind === 'd' && S.has(key)) || (kind === 'r' && Boolean(DATA.research[key as ResearchKey]));
  return ok ? pnl : null;
}
/** The place, if the map has a point with that key */
const validPlace = (key: string | null): string | null => key && placeKeys().has(key) ? key : null;

let routed: string | null = null;
let current: ViewName | null = null;
/** Brings the state to what the hash says */
export function route(): void {
  if (location.hash === routed) return;  // popstate and hashchange arrive together
  routed = location.hash;
  const [path, query] = splitHash(location.hash);
  const [v, arg, pnl = null] = path.split('/');
  const name = viewOf(v) ?? 'home';
  if (name !== current) window.scrollTo({ top: 0, behavior: 'auto' });
  current = name;
  batch(() => {
    if (arg && P.has(arg)) setFocus(arg);
    setView(name);
    setPanel(validPanel(pnl));
    setDepth(historyDepth());
    const params = new URLSearchParams(query);
    setScopeSignal(scopeOf(params.get(SCOPE_PARAM)));
    setPlaceSignal(name === 'map' ? validPlace(params.get(PLACE_PARAM)) : null);
  });
}

/** Chooses the filter of people: it stays in the hash (replacing it, the back button does not undo filters) */
export function setScope(s: Scope): void {
  setScopeSignal(s);
  const hash = viewHash(view(), focus(), panel());
  if (hash === location.hash) return;
  history.replaceState(history.state, '', hash);
  routed = location.hash;
}

/** Opens (or closes, with null) a panel leaving an entry in the history */
export function go(pnl: string | null, { view: v = view(), id = focus() }: { view?: ViewName; id?: string } = {}): void {
  const hash = viewHash(v, id, pnl);
  if (hash === location.hash) return;
  const d = pnl ? (panel() ? (historyDepth() || 1) + 1 : 1) : 0;
  history.pushState({ depth: d } satisfies HistoryState, '', hash);
  route();
}
/** Goes to the map with the place `key` chosen (or none, with null), leaving an entry in the history; `replace`, without
    it (a place left out by the filter). From another view, the card closes */
export function openPlace(key: string | null, { replace = false }: { replace?: boolean } = {}): void {
  const pnl = view() === 'map' ? panel() : null;
  const hash = viewHash('map', focus(), pnl, key);
  if (hash === location.hash) return;
  // A card kept open is the first of its row: its ← does not go back to another place
  const state: HistoryState = { depth: pnl ? 1 : 0 };
  if (replace) history.replaceState(state, '', hash); else history.pushState(state, '', hash);
  route();
}
export const openPerson = (id: string): void => go('p:' + id);
export const openDoc = (id: string): void => go('d:' + id);
export const closePanel = (): void => go(null);
/** Opens a research document; with `fam`, it also chooses that family (if it is already open, only that) */
export function openResearch(name: string, fam?: string | null): void {
  if (isFamily(fam)) setFamily(fam);
  if (panel() !== 'r:' + name) go('r:' + name);
}

/** Handles the hash changes while the component calling it lives (the application) */
export function useRouter(): void {
  listen(window, 'hashchange', route);
  listen(window, 'popstate', route);
  route();
}

/** Only for the tests: forgets the last hash handled */
export const resetRouter = (): void => { routed = null; current = null; };
