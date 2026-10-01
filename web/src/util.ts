/* Stateless helpers */
import { texts } from './i18n';
import type { Person } from './types';

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const initials = (p: Person): string =>
  ((p.given || '?')[0] + (p.surnames || '')[0]).toUpperCase().replace('UNDEFINED', '');
export const lifespan = (p: Person): string =>
  (p.born || p.died) ? `${p.born || '?'} – ${p.died || (p.living ? '' : '?')}` : '';
export const years = (p: Person): string =>
  (p.bornYear || p.diedYear) ? `${p.bornYear ?? '?'}–${p.diedYear ?? (p.living ? '' : '?')}` : '';
/** Is the color («#rrggbb») so light that the text on it has to be dark? By its relative luminance */
export const lightColor = (hex: string): boolean => {
  const lin = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  return .2126 * lin(1) + .7152 * lin(3) + .0722 * lin(5) > .31;
};

export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const T = (ms: number): number => reduced ? 0 : ms;

/** Search without accents or capitals */
export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «1896-12-19» → «19 dic 1896», keeping the prefixes («c.», «antes de»…) */
export const fmtDate = (s: string | null | undefined): string =>
  String(s || '').replace(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/, (_m, y: string, mo?: string, d?: string) =>
    [d && +d, mo && texts.months[+mo - 1], y].filter(Boolean).join(' '));
/** Position in years with decimals, to spread the events of the same year */
export const yearAt = (s: string | null | undefined, fallback: number): number => {
  const m = String(s || '').match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  return m ? +m[1] + (m[2] ? (+m[2] - 1) / 12 : .5) + (m[3] ? (+m[3] - 1) / 372 : 0) : fallback + .5;
};
export const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Access to localStorage that does not fail without storage */
export const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* no storage */ } },
};

/** A piece of a plain text: text, or an http(s) address written in it. */
export type TextPart = { text: string; url?: string };

// An address runs until a space or a character that cannot be in it; the punctuation that closes the sentence
// around it (and a bracket opened before it) is trimmed afterwards. The same rule as `autolink` in build_site.py
const URL_RE = /https?:\/\/[^\s<>"«»`\u0000-\u001f\u007f]+/g;
const TRAILING = '.,;:!?\'"’”';

function trimUrl(url: string): string {
  for (;;) {
    const last = url.slice(-1);
    const open = last === ')' ? '(' : last === ']' ? '[' : '';
    if (TRAILING.includes(last) || (open && url.split(open).length < url.split(last).length)) url = url.slice(0, -1);
    else return url;
  }
}

/** Splits a plain text into text and the http(s) addresses written in it, to show them as links. */
export function splitUrls(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    if (!/^https?:\/\/[^/?#]/.test(url)) continue;
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ text: url, url });
    at = m.index + url.length;
  }
  if (at < text.length || !parts.length) parts.push({ text: text.slice(at) });
  return parts;
}
