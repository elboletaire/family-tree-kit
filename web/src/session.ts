/* Session of the site. The public version (DATA.access «public») has no data of the living; with the password,
   deploy/server.py gives a session cookie (HttpOnly, so this code never sees it) and serves the whole tree in
   private/data.json. The web then draws itself again with those data, in the same view and with the same person in
   focus; closing the session goes back to the public data. If the site is closed (PUBLIC_SITE=0 in the server), the
   page is only served with a session, so it loads the private data before drawing anything, and closing the session
   reloads it: the server answers with its login page. */
import { batch, createSignal } from 'solid-js';
import { clearData, DATA, initData, P } from './data';
import { initFamily } from './family';
import { resetRouter, splitHash } from './router';
import { focus, savedFocus, setDefaultFocus, setFocus } from './state';
import type { Data } from './types';

// Routes of deploy/server.py, relative to the page (served at the root of the site)
export const LOGIN_URL = 'login';
export const LOGOUT_URL = 'logout';
export const PRIVATE_DATA_URL = 'private/data.json';
/** Cookie the server sets next to the session one, readable here: it only says there may be a session, so that the
 *  public version does not ask for the private data on every visit */
export const SESSION_HINT = 'arbre_hint';
/** Header of the server's answer to the logout: `closed` if the site has no public version to go back to */
export const SITE_MODE_HEADER = 'X-Site-Mode';
export const CLOSED_SITE = 'closed';

/** The public data embedded in the page, to go back to them */
let publicData: Data | null = null;
const [dialog, setDialog] = createSignal(false);
const [resuming, setResuming] = createSignal(false);
/** Are the private data of an existing session being loaded? Nothing is drawn meanwhile, so that the public version
 *  (with «Persona viva») is never seen, not even for an instant */
export { resuming };
/** Is the password dialog open? */
export { dialog };
export const openDialog = (): void => { setDialog(true); };
export const closeDialog = (): void => { setDialog(false); };
/** Does this page have a lock, i.e. is it the site's (public or unlocked) version? */
export const hasLock = (): boolean => DATA.access !== 'full';
export const unlocked = (): boolean => DATA.access === 'private';

/** Replaces the data keeping the view, the panel and the focus: `ids` translates the ids that change (the opaque ids
 *  of the living and their real ones). A focus nobody chose (nothing remembered, or the main person of the public
 *  version, which is only its default) becomes the main person of the new data, without remembering it; the focus
 *  the hash names still rules (see route) */
function swap(data: Data, ids: Record<string, string>): void {
  const tr = (id: string) => ids[id] ?? id;
  const saved = savedFocus();
  const chosen = saved !== null && saved !== publicData?.main;
  const [path, query] = splitHash(location.hash);
  const [view, arg, pnl] = path.split('/');
  const parts = [view, arg && tr(arg), pnl && (pnl.startsWith('p:') ? 'p:' + tr(pnl.slice(2)) : pnl)].filter(Boolean);
  const person = tr(focus());
  setDialog(false);
  clearData();
  if (view) history.replaceState(history.state, '', '#' + parts.join('/') + (query ? '?' + query : ''));
  resetRouter();
  batch(() => {
    initData(data);
    if (chosen && P.has(person)) setFocus(person);
    else setDefaultFocus(data.main);
    initFamily();
  });
}

/** Loads the private data if there is a session; false if not */
export async function loadPrivate(): Promise<boolean> {
  try {
    const res = await fetch(PRIVATE_DATA_URL, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json() as Data;
    publicData ??= DATA;
    swap(data, data.publicIds);
    return true;
  } catch {
    return false;
  }
}

/** On opening the public version, before drawing it: if there may be a session, its data (and, if they fail, the
 *  public version) */
export function resumeSession(): Promise<boolean> {
  if (DATA.access !== 'public' || !document.cookie.split(/;\s*/).some(c => c.startsWith(SESSION_HINT + '='))) {
    return Promise.resolve(false);
  }
  setResuming(true);
  return loadPrivate().finally(() => setResuming(false));
}

/** Sends the password; true if it opened the private data */
export async function login(password: string): Promise<boolean> {
  try {
    const res = await fetch(LOGIN_URL, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return res.ok && await loadPrivate();
  } catch {
    return false;
  }
}

/** Reloads the page (an object, so that the tests can replace it: jsdom does not reload) */
export const page = { reload: (): void => { location.reload(); } };

/** Closes the session and goes back to the public data, or, if the site is closed, to the server's login page */
export async function logout(): Promise<void> {
  const res = await fetch(LOGOUT_URL, { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
  if (res?.headers.get(SITE_MODE_HEADER) === CLOSED_SITE) { page.reload(); return; }
  if (!publicData || DATA.access !== 'private') return;
  const back = Object.fromEntries(Object.entries(DATA.publicIds).map(([opaque, id]) => [id, opaque]));
  swap(publicData, back);
}
