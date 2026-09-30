/* Navigation. The hash is «#view/focus[/panel][?filtro=…]»; the open side panel goes in the third segment («p:slug»,
   «d:F001», «r:revision»), so the browser's back button returns to the previous card instead of changing view; the
   filter of people the views share (everybody, blood family, direct line) goes after «?filtro=», unless it is the
   default one.
   The view, the panel and the focused person are signals: the components render from them.
   The view segments of the hash stay in Spanish (#arbol, #abanico…), because the family has saved links; the
   English names of the views are accepted too. */
import { batch, createSignal } from 'solid-js';
import { DATA, P, S } from './data';
import { listen } from './events';
import { isFamily, setFamily } from './family';
import { focus, setFocus, type Scope } from './state';
import type { ResearchKey } from './types';

export const VIEWS = ['home', 'tree', 'fan', 'timeline', 'voyage', 'map', 'documents'] as const;
export type ViewName = typeof VIEWS[number];
/** Segment of each view in the hash */
export const VIEW_SEGMENT: Record<ViewName, string> = {
  home: 'inicio', tree: 'arbol', fan: 'abanico', timeline: 'cronologia', voyage: 'viaje', map: 'mapa', documents: 'documentos',
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
/** «?filtro=…» of a filter, empty for the default one */
const scopeQuery = (s: Scope): string => s === DEFAULT_SCOPE ? '' : `?${SCOPE_PARAM}=${SCOPE_VALUE[s]}`;

/** Hash of a view, optionally with a focused person and a panel; with the current filter */
export const viewHash = (v: ViewName, id?: string, pnl?: string | null): string =>
  `#${VIEW_SEGMENT[v]}${id ? '/' + id : ''}${pnl ? '/' + pnl : ''}${scopeQuery(scope())}`;
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
    setScopeSignal(scopeOf(new URLSearchParams(query).get(SCOPE_PARAM)));
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
