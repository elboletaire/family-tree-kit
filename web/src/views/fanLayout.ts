/* Calculations of the ancestors fan, without DOM */
import { P } from '../data';
import { texts } from '../i18n';
import type { Person } from '../types';

/** Sector of the fan. `key` numbers the ancestors as in an ahnentafel: father 2n, mother 2n+1 */
export interface Segment { key: number; gen: number; id: string | null | undefined; p: Person | null | undefined; a0: number; a1: number }

export const MAXGEN = 7;
/** Radius of the central circle and of each ring */
export const R0 = 78;
export const ring = (gen: number): number => R0 + [0, 88, 170, 245, 312, 368, 412, 450][gen];

/** Sectors of the ancestors of `rootId` up to MAXGEN - 1 generations; the unknown ones are left as gaps */
export function fanSegments(rootId: string): Segment[] {
  const segs: Segment[] = [];
  const span = Math.PI * 1.5;         // 270°
  const start = -span / 2;
  const walk = (id: string | null | undefined, n: number, gen: number) => {
    if (gen > MAXGEN - 1) return;
    const p = id ? P.get(id) : null;
    if (gen > 0) {
      const slots = 2 ** gen, i = n - slots;
      segs.push({ key: n, gen, id, p, a0: start + i * span / slots, a1: start + (i + 1) * span / slots });
    }
    if (!p && gen > 0) return;        // gap: the ancestors of someone unknown are not drawn
    walk(p?.father, 2 * n, gen + 1);
    walk(p?.mother, 2 * n + 1, gen + 1);
  };
  walk(rootId, 1, 0);
  return segs;
}

/** Relation of the ancestor number `n` (2 the father, 3 the mother, 4 the paternal grandfather…) */
export const fanRelation = (n: number): string => texts.fan.relation(n);

/** Name that fits in the sector: full near the center, shorter outwards */
export function fanLabel(d: Segment): string {
  if (!d.p) return '';
  const width = (d.a1 - d.a0) * (ring(d.gen - 1) + ring(d.gen)) / 2;
  if (d.gen <= 2) return d.p.name;
  if (width < 18 && d.gen >= 5) return d.p.given.split(' ')[0];
  return d.p.given.split(' ').slice(0, 2).join(' ') + (d.gen <= 4 ? ' ' + (d.p.surnames.split(' ')[0] || '') : '');
}
export const fanFontSize = (gen: number): number => [0, 14, 12.5, 11.5, 10.5, 9.5, 9][gen];
/** Width available for the name: along the radius in the outer rings, along the arc in the inner ones */
export function fanLabelRoom(d: Segment): number {
  const inner = ring(d.gen - 1), outer = ring(d.gen);
  return d.gen >= 3 ? (outer - inner - 10) : (d.a1 - d.a0) * (inner + outer) / 2 - 14;
}
/** Trims `text` (two letters at a time, with «…») until `measure` says it fits in `max` */
export function fitText(text: string, max: number, measure: (s: string) => number): string {
  let s = text, out = text;
  while (s.length > 3 && measure(out) > max) { s = s.slice(0, -2); out = s + '…'; }
  return out;
}
/** Position and rotation of the name at the center of the sector: radial in the outer rings and always readable */
export function fanLabelTransform(d: Segment): string {
  const a = (d.a0 + d.a1) / 2, r = (ring(d.gen - 1) + ring(d.gen)) / 2;
  const x = Math.sin(a) * r, y = -Math.cos(a) * r;
  let rot = a * 180 / Math.PI;
  if (d.gen >= 3) rot -= 90;
  if (rot > 90 || rot < -90) rot += 180;
  return `translate(${x},${y}) rotate(${rot})`;
}
