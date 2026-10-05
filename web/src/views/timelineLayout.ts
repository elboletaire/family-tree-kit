/* Calculations of the timeline, without DOM */
import * as d3 from 'd3';
import { AI, DATA, P } from '../data';
import type { Doc, HistoricEvent, Person } from '../types';

// Approximate birth year of whoever has no dates, deduced from their family: parents and children ~28 years apart,
// spouses and siblings of the same age. It spreads over several passes (one estimate helps another).
export function estimateBirths(): Map<string, number> {
  const est = new Map<string, number>(), GEN = 28, now = new Date().getFullYear();
  const year = (id: string) => { const p = P.get(id); return p ? p.bornYear ?? (p.diedYear ? p.diedYear - 60 : est.get(id)) : undefined; };
  for (let pass = 0; pass < 12; pass++) {
    const found: [string, number][] = [];
    DATA.people.forEach(p => {
      if (p.bornYear || p.diedYear || est.has(p.id)) return;
      const sibs = new Set(p.siblings);
      [p.father, p.mother].forEach(x => x && P.get(x)!.children.forEach(c => sibs.add(c)));
      sibs.delete(p.id);
      const c = [
        ...[p.father, p.mother].filter((x): x is string => Boolean(x)).map(x => year(x)! + GEN),
        ...p.children.map(x => year(x)! - GEN),
        ...[...p.spouses, ...sibs].map(year),
      ].filter((y): y is number => Number.isFinite(y));
      if (c.length) found.push([p.id, Math.min(Math.round(d3.mean(c)!), now - 1)]);
    });
    if (!found.length) break;
    found.forEach(([id, y]) => est.set(id, y));
  }
  return est;
}

/** Life in the timeline: from `start` to `end` (null if unknown); `open` if they are known to have died but not when */
export interface Row { p: Person; start: number; end: number | null; open: boolean; est?: boolean; noBirth?: boolean }

/** Lives of those who have dates (or an estimate), sorted by birth */
export function lifeRows(est: Map<string, number>, keep: Set<string> | null, now: number): Row[] {
  return DATA.people.filter(p => (p.bornYear || p.diedYear || est.has(p.id)) && (!keep || keep.has(p.id)))
    .map(p => {
      if (!p.bornYear && !p.diedYear) return { p, start: est.get(p.id)!, end: p.living ? now : null, open: !p.living, est: true };
      const start = p.bornYear ?? (p.diedYear! - 60);
      return { p, start, end: p.diedYear ?? (p.living ? now : null), open: !p.diedYear && !p.living, noBirth: !p.bornYear };
    })
    .sort((a, b) => a.start - b.start || (a.end ?? 9999) - (b.end ?? 9999));
}

/** Were they alive in `year`? Without a death date, 60 years of life are assumed */
export const aliveIn = (r: Row, year: number): boolean =>
  r.start <= year && (r.end ? r.end >= year : (r.open ? r.start + 60 >= year : true));

/** Dated documents (without the AI-generated ones) of the people in `keep` */
export const datedDocs = (keep: Set<string> | null): Doc[] =>
  DATA.docs.filter(d => d.year && d.category !== AI && (!keep || d.people.some(x => keep.has(x))));

/** Dotted lines between eras that touch or overlap, whose bands would otherwise merge into one: at the year they share,
 * or at both ends of the years they overlap (only the ends inside the other band). `row` is that of the lower of the two
 * bands (they alternate in two rows), where the line starts; one line per year, from the higher row if two coincide. */
export function eventDividers(events: HistoricEvent[]): { year: number; row: number }[] {
  const lines = new Map<number, number>();
  events.forEach((a, i) => events.slice(i + 1).forEach((b, k) => {
    const lo = Math.max(a.from, b.from), hi = Math.min(a.to, b.to);
    if (lo > hi) return;
    const row = Math.max(i % 2, (i + 1 + k) % 2);
    const years = lo === hi ? [lo] : [lo > Math.min(a.from, b.from) && lo, hi < Math.max(a.to, b.to) && hi];
    years.forEach(y => { if (y !== false) lines.set(y, Math.min(row, lines.get(y) ?? row)); });
  }));
  return [...lines].sort(([a], [b]) => a - b).map(([year, row]) => ({ year, row }));
}
