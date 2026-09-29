/* Calculations of the time voyage, without DOM: the events, their place on the screen and the summary of each era */
import * as d3 from 'd3';
import { AI, DATA, P } from '../data';
import { texts } from '../i18n';
import type { Doc, HistoricEvent, Person } from '../types';
import { hash, yearAt } from '../util';

export type Kind = 'birth' | 'marriage' | 'death' | 'doc';
export const KINDS: Kind[] = ['birth', 'marriage', 'death', 'doc'];
export const KIND: Record<Kind, { icon: string; label: string; plural: string }> = {
  birth: { icon: '✦', ...texts.voyage.kinds.birth }, marriage: { icon: '♡', ...texts.voyage.kinds.marriage },
  death: { icon: '◇', ...texts.voyage.kinds.death }, doc: { icon: '▤', ...texts.voyage.kinds.doc },
};
// Screen slots (fractions of the width and height) that consecutive events take in turns
const SLOTS = [[-.55, -.3], [.5, -.05], [-.25, .32], [.3, .4], [-.68, .12], [.08, -.42], [.66, .3], [-.05, .08]];

/** Something placed in time (`at`, in years with decimals) and on the screen (`x`, `y`) */
export interface Placed { at: number; x: number; y: number }
export interface VEvent extends Placed { kind: Kind; p?: Person; q?: Person; d?: Doc; date: string; place: string; mine: boolean }

/** Events of the people in `keep` (all, if null), sorted; `mine`, those of the focused person */
export function voyageEvents(focus: string, keep: Set<string> | null): VEvent[] {
  const inScope = (id: string) => !keep || keep.has(id);
  const ev: Omit<VEvent, 'x' | 'y' | 'mine'>[] = [];
  DATA.people.filter(p => inScope(p.id)).forEach(p => {
    if (p.bornYear) ev.push({ kind: 'birth', p, date: p.born, place: p.birthPlace, at: yearAt(p.born, p.bornYear) });
    if (p.diedYear) ev.push({ kind: 'death', p, date: p.died, place: p.deathPlace, at: yearAt(p.died, p.diedYear) });
    p.marriages.filter(m => m.year && P.has(m.spouse) && (p.id < m.spouse || !inScope(m.spouse)))
      .forEach(m => ev.push({ kind: 'marriage', p, q: P.get(m.spouse), date: m.date, place: m.place, at: yearAt(m.date, m.year!) }));
  });
  DATA.docs.filter(d => d.year && d.category !== AI && (!keep || d.people.some(x => keep.has(x))))
    .forEach(d => ev.push({ kind: 'doc', d, date: d.date, place: d.place, at: yearAt(d.date, d.year!) }));
  ev.sort((a, b) => a.at - b.at);
  return ev.map((e, i) => {
    const [sx, sy] = SLOTS[i % SLOTS.length], h = hash((e.p?.id || e.d!.id) + e.kind);
    return {
      ...e,
      x: sx + ((h % 100) / 100 - .5) * .12,
      y: sy + (((h >> 8) % 100) / 100 - .5) * .12,
      mine: e.p?.id === focus || e.q?.id === focus || Boolean(e.d && e.d.people.includes(focus)),
    };
  });
}

/** Reference years in the background, every 25 years */
export function decades(min: number, now: number): Placed[] {
  const out: Placed[] = [];
  for (let y = Math.ceil(min / 25) * 25; y <= now; y += 25) out.push({ at: y, x: (y / 25) % 2 ? -.62 : -.5, y: .3 });
  return out;
}

export interface Era { from: number; to: number; total: number; counts: [Kind, number][]; places: string[]; hist: HistoricEvent[] }
/** Summary of the 25 years starting at `from` */
export function eraSummary(events: VEvent[], from: number): Era {
  const to = from + 24;
  const ev = events.filter(e => e.at >= from && e.at < to + 1);
  const counts = KINDS.map(k => [k, ev.filter(e => e.kind === k).length] as [Kind, number]).filter(([, n]) => n);
  const places = d3.rollups(ev.map(e => (e.place || '').split(',')[0].trim()).filter(Boolean), v => v.length, d => d)
    .sort((a, b) => b[1] - a[1]).map(d => d[0]);
  return { from, to, total: ev.length, counts, places, hist: DATA.events.filter(h => h.from <= to && h.to >= from) };
}

/** Century in Roman numerals (from XVII to XXI) */
export const century = (year: number): string => ['XVII', 'XVIII', 'XIX', 'XX', 'XXI'][Math.floor((year - 1) / 100) + 1 - 17];
