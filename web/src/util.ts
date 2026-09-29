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
