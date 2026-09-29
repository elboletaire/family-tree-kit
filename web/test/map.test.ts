import { beforeEach, describe, expect, it } from 'vitest';
import { initData } from '../src/data';
import { initFocus, kinSet } from '../src/state';
import { arc, FACT_KINDS, kindCounts, mainBounds, mapFacts, mapPlaces, migrations, radius, unlocated, type FactKind } from '../src/views/mapLayout';
import { fixture } from './fixture';

beforeEach(() => {
  localStorage.clear();
  initData(fixture());
  initFocus();
});

const summary = (keep: Set<string> | null, until: number | null) =>
  mapPlaces(mapFacts(keep, until), 'yo').map(pl => [pl.name, pl.facts.length]);
const lines = (keep: Set<string> | null, until: number | null) =>
  migrations(keep, until, kinSet('direct')!).map(m => [m.from.name, m.to.name, m.children.map(c => c.id), m.direct]);

describe('map', () => {
  it('groups the facts of the located places by point, the one with most first', () => {
    const places = mapPlaces(mapFacts(null, null), 'yo');
    expect(places.map(pl => [pl.name, pl.facts.length])).toEqual([['Puerto Bajo', 3], ['Villa Alta', 2], ['Monte Medio', 1]]);
    // Two ways of writing the same place make one point; the dated facts first
    const alta = places[1];
    expect(alta.texts).toEqual(['Villa Alta', 'Villa Alta [?]']);
    expect(alta.facts.map(f => [f.kind, f.p?.id, f.year])).toEqual([['birth', 'abuelo', 1900], ['birth', 'padre', 1930]]);
    // The document of the focused person marks its place; the branch is the one with most people there
    expect(places.map(pl => [pl.mine, pl.branch])).toEqual([[true, 'olmo'], [false, 'olmo'], [false, 'olmo']]);
    expect(kindCounts(places[0].facts)).toEqual([['birth', 2], ['doc', 1]]);
  });
  it('leaves out the places without coordinates and counts them apart', () => {
    expect(mapFacts(null, null).some(f => f.place === 'Salamanca')).toBe(false);
    expect(unlocated()).toEqual(['Salamanca']);
  });
  it('shows the facts up to a year (without the undated) and of the chosen people', () => {
    expect(summary(null, 1920)).toEqual([['Monte Medio', 1], ['Villa Alta', 1]]);
    expect(summary(null, 1950)).toEqual([['Villa Alta', 2], ['Monte Medio', 1]]);
    expect(summary(kinSet('direct'), null)).toEqual([['Villa Alta', 2], ['Monte Medio', 1], ['Puerto Bajo', 1]]);
  });
  it('shows only the kinds of facts chosen', () => {
    const kinds = (ks: FactKind[]) => mapPlaces(mapFacts(null, null, new Set(ks)), 'yo').map(pl => [pl.name, kindCounts(pl.facts)]);
    expect(kinds(['doc'])).toEqual([['Puerto Bajo', [['doc', 1]]]]);
    expect(kinds([])).toEqual([]);
    expect(mapFacts(null, null, new Set(FACT_KINDS))).toEqual(mapFacts(null, null));
  });
  it('draws the migrations from the birthplace of the parents to that of their children', () => {
    expect(lines(null, null)).toEqual([
      ['Monte Medio', 'Villa Alta', ['padre'], true],
      ['Villa Alta', 'Puerto Bajo', ['tia', 'hermana'], false],
      ['Monte Medio', 'Puerto Bajo', ['tia'], false],
    ]);
    expect(lines(null, 1950)).toEqual([['Monte Medio', 'Villa Alta', ['padre'], true]]);
    expect(lines(kinSet('direct'), null)).toEqual([['Monte Medio', 'Villa Alta', ['padre'], true]]);
  });
  it('frames the places that gather most facts', () => {
    const places = mapPlaces(mapFacts(null, null), 'yo');
    expect(mainBounds(places, 1)).toEqual([[42.5, -5.9], [43.5, -4.5]]);
    expect(mainBounds(places, .5)).toEqual([[43.5, -5.7], [43.5, -5.7]]);  // Puerto Bajo alone has half of them
    expect(mainBounds([])).toBeNull();
  });
  it('sizes the points and bends the lines', () => {
    expect(radius(1)).toBeLessThan(radius(10));
    expect(radius(1000)).toBe(22);
    const pts = arc([0, 0], [0, 10], 4);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[4]).toEqual([0, 10]);
    expect(pts[2][0]).not.toBe(0);  // away from the straight line
  });
});
