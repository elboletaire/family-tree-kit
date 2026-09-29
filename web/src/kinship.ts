/* Kinship between two people of the tree */
import { P } from './data';
import { texts } from './i18n';
import type { Person } from './types';

/** Generations up to the closest common ancestor: `a` from one person, `b` from the other */
export interface Blood { a: number; b: number }
/** The person themselves, their direct line (ancestors and descendants), other blood relatives or in-laws */
export type KinKind = 'self' | 'direct' | 'blood' | 'inLaw';
export interface Kin { label: string; kind: KinKind }

// Siblings without known parents share a virtual parent («~»), so that they count as siblings
export const parentsOf = (id: string): string[] => {
  const p = P.get(id)!;
  const ps = [p.father, p.mother].filter((x): x is string => P.has(x!));
  return ps.length || !p.siblings.length ? ps : ['~' + [id, ...p.siblings].sort()[0]];
};
export function ancestors(id: string): Map<string, number> {
  const d = new Map([[id, 0]]), q = [id];
  while (q.length) {
    const c = q.shift()!;
    if (c[0] === '~') continue;
    parentsOf(c).forEach(x => { if (!d.has(x)) { d.set(x, d.get(c)! + 1); q.push(x); } });
  }
  return d;
}
// Year the union of `a` and `b` began: their wedding or the birth of their first common child (null if unknown)
function unionStart(a: string, b: string): number | null {
  const x = P.get(a), y = P.get(b);
  if (!x || !y) return null;
  const years = [...x.marriages.filter(m => m.spouse === b).map(m => m.year),
                 ...x.children.filter(c => y.children.includes(c)).map(c => P.get(c)!.bornYear)]
    .filter((n): n is number => n != null);
  return years.length ? Math.min(...years) : null;
}
/** Step-siblings: `x` is the child of a spouse of a parent of `y`, with no common parent. They are not if either of
    them was born after that union began: they came from a later couple, when the union had already broken up. */
export function stepSiblings(a: string, b: string): boolean {
  if (a === b) return false;
  const pa = parentsOf(a), pb = parentsOf(b);
  if (pa.some(x => pb.includes(x))) return false;
  const ya = P.get(a)!.bornYear, yb = P.get(b)!.bornYear;
  return pa.some(x => pb.some(y => {
    if (!P.get(x)?.spouses.includes(y)) return false;
    const start = unionStart(x, y);
    return start == null || !((ya != null && ya > start) || (yb != null && yb > start));
  }));
}
// Consanguinity: for each relative, generations up to the closest common ancestor
// (a: from `id`, b: from the relative). Sharing a single parent already counts as siblings.
export function blood(id: string): Map<string, Blood> {
  const mine = ancestors(id), out = new Map<string, Blood>();
  P.forEach((_, x) => {
    let best: Blood | null = null;
    ancestors(x).forEach((b, c) => {
      if (!mine.has(c)) return;
      const a = mine.get(c)!;
      if (!best || a + b < best.a + best.b) best = { a, b };
    });
    if (best) out.set(x, best);
  });
  return out;
}
/** Name of the blood relation of `p` (its wording depends on the language: see i18n) */
export const bloodLabel = (p: Person, { a, b }: Blood): string => texts.kin.blood(p, a, b);
// Kinship of each person with `id`: by blood, or in-law (through their marriage or a relative's)
export function kinship(id: string): Map<string, Kin> {
  const me = P.get(id)!, mine = blood(id), out = new Map<string, Kin>();
  const kind = (r: Blood): KinKind => (!r.a || !r.b) ? 'direct' : 'blood';
  mine.forEach((r, x) => out.set(x, { label: bloodLabel(P.get(x)!, r), kind: x === id ? 'self' : kind(r) }));
  me.spouses.forEach(s => { if (!out.has(s)) out.set(s, { label: texts.kin.spouse, kind: 'inLaw' }); });
  P.forEach((x, xid) => {
    if (!out.has(xid) && stepSiblings(id, xid)) out.set(xid, { label: texts.kin.stepSibling(x), kind: 'inLaw' });
  });
  // Spouses of blood relatives
  P.forEach((x, xid) => {
    if (out.has(xid)) return;
    const via = x.spouses.filter(s => mine.has(s) && s !== id)
      .sort((u, v) => (mine.get(u)!.a + mine.get(u)!.b) - (mine.get(v)!.a + mine.get(v)!.b))[0];
    if (!via) return;
    const r = mine.get(via)!, rp = P.get(via)!;
    const label = r.a === 1 && r.b === 1 ? texts.kin.siblingInLaw(x)
      : !r.a && r.b === 1 ? texts.kin.childInLaw(x)
      : texts.kin.spouseOf(bloodLabel(rp, r));
    out.set(xid, { label, kind: 'inLaw' });
  });
  // Blood relatives of their spouses
  me.spouses.forEach(s => blood(s).forEach((r, xid) => {
    if (out.has(xid) || xid === s) return;
    const x = P.get(xid)!;
    const label = !r.b && r.a === 1 ? texts.kin.parentInLaw(x)
      : r.a === 1 && r.b === 1 ? texts.kin.siblingInLaw(x)
      : texts.kin.ofSpouse(bloodLabel(x, r));
    out.set(xid, { label, kind: 'inLaw' });
  }));
  return out;
}
