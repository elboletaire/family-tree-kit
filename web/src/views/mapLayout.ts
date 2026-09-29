/* Calculations of the map, without DOM: the facts of each place (births, deaths, marriages and documents), the points
   they make, the migrations from the parents' birthplace to their children's and the lives from the birthplace to the
   place of death */
import { AI, DATA, P } from '../data';
import type { Doc, Person, Place } from '../types';

export type FactKind = 'birth' | 'death' | 'marriage' | 'doc';
export const FACT_KINDS: FactKind[] = ['birth', 'marriage', 'death', 'doc'];

/** Something that happened in a place: `p` (and `q`, the spouse, in a marriage) or the document `d` */
export interface Fact { kind: FactKind; year: number | null; place: string; p?: Person; q?: Person; d?: Doc }

/** A point of the map: the places written differently that share coordinates («Salamanca», «Salamanca [?]»…) */
export interface MapPlace {
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** How it is written in the notes */
  texts: string[];
  facts: Fact[];
  /** Key of the branch with most facts there */
  branch: string;
  /** Some fact is of the focused person */
  mine: boolean;
}

/** From the birthplace of a parent to that of their children, in one branch */
export interface Migration {
  key: string;
  from: MapPlace;
  to: MapPlace;
  branch: string;
  children: Person[];
  /** The first birth, to show it from that year on */
  year: number | null;
  /** Parents and children of the focused person's direct line */
  direct: boolean;
}

/** From the birthplace of some people to the place where they died, in one branch */
export interface LifeLine {
  key: string;
  from: MapPlace;
  to: MapPlace;
  branch: string;
  people: Person[];
  /** The first death, to show it from that year on */
  year: number | null;
  /** Some of them is of the focused person's direct line */
  direct: boolean;
}

/** Coordinates of a place as it is written, if places.yml has them */
export const locate = (text: string): Place | undefined => text ? DATA.places[text] : undefined;
const pointKey = (pl: Place): string => `${pl.lat.toFixed(3)},${pl.lon.toFixed(3)}`;
/** Is the fact visible up to the year `until`? (null: all, also the undated) */
const upTo = (year: number | null, until: number | null): boolean => until == null || (year != null && year <= until);

/** Facts in located places of the people in `keep` (everybody, if null), up to the year `until`, of the `kinds`
    (all, if null) */
export function mapFacts(keep: Set<string> | null, until: number | null, kinds: ReadonlySet<FactKind> | null = null): Fact[] {
  const inScope = (id: string) => !keep || keep.has(id);
  const out: Fact[] = [];
  const add = (f: Fact) => { if ((!kinds || kinds.has(f.kind)) && locate(f.place) && upTo(f.year, until)) out.push(f); };
  DATA.people.filter(p => inScope(p.id)).forEach(p => {
    add({ kind: 'birth', p, year: p.bornYear, place: p.birthPlace });
    add({ kind: 'death', p, year: p.diedYear, place: p.deathPlace });
    // Each marriage once, from the spouse whose id comes first (or from the one in scope)
    p.marriages.filter(m => P.has(m.spouse) && (p.id < m.spouse || !inScope(m.spouse)))
      .forEach(m => add({ kind: 'marriage', p, q: P.get(m.spouse), year: m.year, place: m.place }));
  });
  DATA.docs.filter(d => d.category !== AI && (!keep || d.people.some(x => keep.has(x))))
    .forEach(d => add({ kind: 'doc', d, year: d.year, place: d.place }));
  return out;
}

/** People of a fact, to color its place and to know if it is the focused person's */
export const factPeople = (f: Fact): string[] => f.d ? f.d.people : [f.p!.id, ...(f.q ? [f.q.id] : [])];

/** The facts grouped by point, the one with most first. `focus`: the person whose places are marked */
export function mapPlaces(facts: Fact[], focus: string): MapPlace[] {
  const groups = new Map<string, Fact[]>();
  facts.forEach(f => {
    const k = pointKey(locate(f.place)!);
    groups.set(k, [...groups.get(k) ?? [], f]);
  });
  return [...groups].map(([key, fs]) => {
    // The name of the way of writing it with most facts; the branch with most people there
    const byText = count(fs.map(f => f.place));
    const main = locate(byText[0][0])!;
    const branches = count(fs.flatMap(f => factPeople(f).filter(id => P.has(id)).map(id => P.get(id)!.branch)));
    return {
      key, name: main.name, lat: main.lat, lon: main.lon,
      texts: byText.map(([t]) => t),
      facts: [...fs].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
      branch: branches[0]?.[0] ?? DATA.otherBranch,
      mine: fs.some(f => factPeople(f).includes(focus)),
    };
  }).sort((a, b) => b.facts.length - a.facts.length || a.name.localeCompare(b.name));
}

/** [value, times], the most repeated first (ties, in order of appearance) */
function count(values: string[]): [string, number][] {
  const n = new Map<string, number>();
  values.forEach(v => n.set(v, (n.get(v) ?? 0) + 1));
  return [...n].sort((a, b) => b[1] - a[1]);
}

/** Lines from the birthplace of each parent to that of their child, when they differ. Both have to be in `keep`
    (all, if null) and the child born up to `until`; `line` is the focused person's direct line, highlighted */
export function migrations(keep: Set<string> | null, until: number | null, line: Set<string>): Migration[] {
  const inScope = (id: string) => !keep || keep.has(id);
  const at = pointAt();
  const out = new Map<string, Migration>();
  DATA.people.filter(c => inScope(c.id) && upTo(c.bornYear, until)).forEach(c => {
    const to = at(c.birthPlace);
    if (!to) return;
    [c.father, c.mother].forEach(id => {
      const parent = id ? P.get(id) : undefined;
      const from = parent && inScope(parent.id) ? at(parent.birthPlace) : undefined;
      if (!from || from.key === to.key) return;
      const direct = line.has(c.id) && line.has(parent!.id);
      const key = `${from.key}>${to.key}>${c.branch}`;
      const m = out.get(key);
      if (!m) out.set(key, { key, from, to, branch: c.branch, children: [c], year: c.bornYear, direct });
      else {
        if (!m.children.includes(c)) m.children.push(c);
        m.direct ||= direct;
        if (c.bornYear != null && (m.year == null || c.bornYear < m.year)) m.year = c.bornYear;
      }
    });
  });
  return [...out.values()];
}

/** Lines from the birthplace of each person to the place where they died, when they differ. The person has to be in
    `keep` (all, if null) and dead up to `until`; `line` is the focused person's direct line, highlighted */
export function lifeLines(keep: Set<string> | null, until: number | null, line: Set<string>): LifeLine[] {
  const at = pointAt();
  const out = new Map<string, LifeLine>();
  DATA.people.filter(p => (!keep || keep.has(p.id)) && upTo(p.diedYear, until)).forEach(p => {
    const from = at(p.birthPlace), to = at(p.deathPlace);
    if (!from || !to || from.key === to.key) return;
    const key = `${from.key}>${to.key}>${p.branch}`;
    const l = out.get(key);
    if (!l) out.set(key, { key, from, to, branch: p.branch, people: [p], year: p.diedYear, direct: line.has(p.id) });
    else {
      l.people.push(p);
      l.direct ||= line.has(p.id);
      if (p.diedYear != null && (l.year == null || p.diedYear < l.year)) l.year = p.diedYear;
    }
  });
  return [...out.values()];
}

/** A point (without facts) for each way of writing a located place, the same for the texts with the same coordinates */
function pointAt(): (text: string) => MapPlace | undefined {
  const point = new Map<string, MapPlace>();
  return text => {
    const pl = locate(text);
    if (!pl) return undefined;
    const k = pointKey(pl);
    if (!point.has(k)) point.set(k, { key: k, name: pl.name, lat: pl.lat, lon: pl.lon, texts: [text], facts: [], branch: '', mine: false });
    return point.get(k);
  };
}

/** [[south, west], [north, east]] of the places that gather `share` of the facts, the biggest first: a place far away
    with a fact or two (an emigrant) does not shrink the rest to a corner. Null without places */
export function mainBounds(places: MapPlace[], share = .9): [[number, number], [number, number]] | null {
  const total = places.reduce((n, pl) => n + pl.facts.length, 0);
  const kept: MapPlace[] = [];
  let n = 0;
  for (const pl of [...places].sort((a, b) => b.facts.length - a.facts.length)) {
    if (kept.length && n >= total * share) break;
    kept.push(pl);
    n += pl.facts.length;
  }
  if (!kept.length) return null;
  const lats = kept.map(pl => pl.lat), lons = kept.map(pl => pl.lon);
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
}

/** Radius of a point, in pixels, by its number of facts */
export const radius = (n: number): number => Math.min(22, 4 + 2.6 * Math.sqrt(n));

/** Points of a gentle curve from `a` to `b` ([lat, lon]), bent to the right of the way, so that the lines that go and
    come back do not overlap */
export function arc(a: [number, number], b: [number, number], steps = 16): [number, number][] {
  const [dy, dx] = [b[0] - a[0], b[1] - a[1]];
  const c: [number, number] = [(a[0] + b[0]) / 2 - dx * .18, (a[1] + b[1]) / 2 + dy * .18];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
}

/** Number of facts of each kind, in the order of FACT_KINDS, without the empty ones */
export const kindCounts = (facts: Fact[]): [FactKind, number][] =>
  FACT_KINDS.map(k => [k, facts.filter(f => f.kind === k).length] as [FactKind, number]).filter(([, n]) => n);

/** Ways of writing a place of the data that places.yml does not locate */
export function unlocated(): string[] {
  const texts = new Set([
    ...DATA.people.flatMap(p => [p.birthPlace, p.deathPlace, ...p.marriages.map(m => m.place)]),
    ...DATA.docs.map(d => d.place),
  ]);
  return [...texts].filter(t => t && !locate(t)).sort();
}
