/* MAP: the places of the family (places.yml) on OpenStreetMap, with Leaflet. A point per place, sized by its facts and
   colored by its branch; lines from the parents' birthplace to their children's, and from each person's birthplace to
   the place where they died. The list of the side is Solid; the
   points and lines are Leaflet layers, redrawn from the memos */
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { DocCard } from '../components/DocCard';
import { Legend } from '../components/Legend';
import { PersonChip } from '../components/PersonChip';
import { ScopeChips } from '../components/ScopeChips';
import { hideTip, showTip } from '../components/Tooltip';
import { BR, DATA } from '../data';
import { texts } from '../i18n';
import { view } from '../router';
import { focus, focusName, kinSet, type Scope } from '../state';
import { fmtDate, reduced, store } from '../util';
import { arc, FACT_KINDS, kindCounts, lifeLines, mainBounds, mapFacts, mapPlaces, migrations, radius, unlocated, type Fact, type FactKind, type MapPlace } from './mapLayout';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const LINES_KEY = 'arbre-map-lines';
/** The kinds of facts hidden, comma-separated: the ones not listed (also those added later) are shown */
const HIDDEN_KINDS_KEY = 'arbre-map-hidden';
const branchColor = (key: string): string => (BR.get(key) ?? BR.get(DATA.otherBranch)!).color;
/** Coastline of the world (Natural Earth, 1:110m), under the tiles: what is seen without network */
const LAND = feature(land110 as unknown as Topology, (land110 as unknown as Topology).objects.land as GeometryCollection);

/** One fact in the list of a place: who (or which document) and when */
function FactRow(props: { f: Fact }) {
  const when = () => props.f.year ? fmtDate(props.f.kind === 'doc' ? props.f.d!.date : String(props.f.year)) : texts.map.undated;
  return (
    <Show when={props.f.d} fallback={
      <li>
        <span class="map-who"><PersonChip id={props.f.p!.id} /><Show when={props.f.q}>{q => <PersonChip id={q().id} />}</Show></span>
        <span class="map-when">{when()}</span>
      </li>
    }>{d => <li class="map-doc"><DocCard doc={d()} /></li>}</Show>
  );
}

export function MapView() {
  let el!: HTMLDivElement;
  let side!: HTMLElement;
  const now = new Date().getFullYear();
  const [scope, setScope] = createSignal<Scope>('all');
  const keep = createMemo(() => kinSet(scope()));
  const line = createMemo(() => kinSet('direct')!);
  /** Year up to which the facts are seen (null: all, also the undated) */
  const [until, setUntil] = createSignal<number | null>(null);
  const [showLines, setShowLinesSignal] = createSignal(store.get(LINES_KEY) !== '0');
  const setShowLines = (on: boolean) => { setShowLinesSignal(on); store.set(LINES_KEY, on ? '1' : '0'); };
  const [hidden, setHiddenSignal] = createSignal(new Set((store.get(HIDDEN_KINDS_KEY) ?? '').split(',').filter(Boolean)));
  const setShown = (k: FactKind, on: boolean) => {
    const next = new Set(hidden());
    if (on) next.delete(k); else next.add(k);
    setHiddenSignal(next);
    store.set(HIDDEN_KINDS_KEY, [...next].join(','));
  };
  const kinds = createMemo(() => new Set(FACT_KINDS.filter(k => !hidden().has(k))));
  const [selected, setSelected] = createSignal<string | null>(null);
  const [offline, setOffline] = createSignal(false);

  const allFacts = createMemo(() => mapFacts(keep(), null, kinds()));
  const minYear = createMemo(() => Math.min(now, ...allFacts().map(f => f.year ?? now)));
  const places = createMemo(() => mapPlaces(until() == null ? allFacts() : mapFacts(keep(), until(), kinds()), focus()));
  // Only between places with facts up to the year, of any kind (the lines stay with the births hidden): a parent born
  // in an undated place has no point until all the years are shown
  const shownPoints = createMemo(() => new Set(mapPlaces(mapFacts(keep(), until()), focus()).map(pl => pl.key)));
  const lines = createMemo(() => migrations(keep(), until(), line()).filter(m => shownPoints().has(m.from.key) && shownPoints().has(m.to.key)));
  const lives = createMemo(() => lifeLines(keep(), until(), line()).filter(l => shownPoints().has(l.from.key) && shownPoints().has(l.to.key)));
  const current = createMemo(() => places().find(pl => pl.key === selected()) ?? null);
  const total = createMemo(() => places().reduce((n, pl) => n + pl.facts.length, 0));
  const missing = unlocated().length;

  /* --- playing the years: from the first fact to today, a few years each step */
  const [playing, setPlaying] = createSignal(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => { clearInterval(timer); timer = undefined; setPlaying(false); };
  function play() {
    if (playing()) return stop();
    setPlaying(true);
    if (until() == null || until()! >= now) setUntil(minYear());
    timer = setInterval(() => {
      const next = (until() ?? minYear()) + 2;
      if (next >= now) { setUntil(null); stop(); } else setUntil(next);
    }, reduced ? 400 : 120);
  }
  onCleanup(stop);

  /* --- the Leaflet map */
  let map: L.Map | undefined;
  const pointLayer = L.layerGroup(), lineLayer = L.layerGroup(), lifeLayer = L.layerGroup();
  const markers = new Map<string, L.CircleMarker>();
  onMount(() => {
    map = L.map(el, { zoomSnap: .5, worldCopyJump: true, attributionControl: true });
    map.createPane('outline').style.zIndex = '150';  // under the tiles (200)
    map.createPane('points').style.zIndex = '450';   // over the lines (overlayPane, 400)
    L.geoJSON(LAND, { pane: 'outline', interactive: false, style: { color: '#b9ad9c', weight: 1, fillColor: '#f2eee6', fillOpacity: 1 } }).addTo(map);
    // The server sends «Referrer-Policy: no-referrer», and OpenStreetMap blocks tile requests without a Referer:
    // the tiles send the site's origin only
    const tiles = L.tileLayer(TILES, { maxZoom: 18, attribution: texts.map.attribution, referrerPolicy: 'strict-origin' });
    tiles.on('tileerror', () => setOffline(true)).on('tileload', () => setOffline(false)).addTo(map);
    lifeLayer.addTo(map);
    lineLayer.addTo(map);
    pointLayer.addTo(map);
    map.on('click', () => setSelected(null));
    fit();
    onCleanup(() => { map!.remove(); map = undefined; });
  });
  /** Frames the places with most facts */
  function fit() {
    const box = mainBounds(places());
    if (!map) return;
    if (!box) map.setView([40.4, -3.7], 5);  // nothing to show: the Iberian Peninsula
    else map.fitBounds(box, { padding: [30, 30], maxZoom: 9 });
  }
  // The map is created inside a hidden page when it is not the active view: when it shows again, it measures itself
  createEffect(on(() => view() === 'map', active => { if (active && map) { map.invalidateSize(); } }, { defer: true }));

  const tipLines = (pl: MapPlace) => kindCounts(pl.facts).map(([k, n]) => `${n} ${n === 1 ? texts.map.kinds[k].one : texts.map.kinds[k].many}`);
  createEffect(() => {
    const pts = places();
    pointLayer.clearLayers();
    markers.clear();
    // The small ones on top, so that they can be clicked
    [...pts].reverse().forEach(pl => {
      const m = L.circleMarker([pl.lat, pl.lon], {
        pane: 'points', radius: radius(pl.facts.length), fillColor: branchColor(pl.branch), fillOpacity: .85,
        color: '#fff', weight: 1.5, className: 'map-point' + (pl.mine ? ' mine' : ''),
      });
      m.on('mousemove', e => showTip({ title: pl.name, lines: tipLines(pl) }, (e as L.LeafletMouseEvent).originalEvent));
      m.on('mouseout', hideTip);
      m.on('click', e => {
        L.DomEvent.stopPropagation(e); hideTip(); setSelected(pl.key);
        // On narrow screens the list is below the map: it comes into view
        if (matchMedia('(max-width: 900px)').matches) side.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      });
      m.addTo(pointLayer);
      markers.set(pl.key, m);
    });
  });
  // The chosen point, outlined; the focused person's places, with a dark edge
  createEffect(() => {
    places();
    const sel = selected();
    markers.forEach((m, key) => {
      const pl = places().find(p => p.key === key)!;
      m.setStyle(key === sel ? { color: '#2b2622', weight: 3.5 } : pl.mine ? { color: '#2b2622', weight: 2 } : { color: '#fff', weight: 1.5 });
      if (key === sel) m.bringToFront();
    });
  });
  createEffect(() => {
    lineLayer.clearLayers();
    if (!showLines()) return;
    // The focused person's direct line, above and stronger
    [...lines()].sort((a, b) => Number(a.direct) - Number(b.direct)).forEach(mg => {
      const pts = arc([mg.from.lat, mg.from.lon], [mg.to.lat, mg.to.lon]);
      const l = L.polyline(pts, {
        color: branchColor(mg.branch), weight: (mg.direct ? 2.5 : 1.2) + Math.min(3, mg.children.length - 1),
        opacity: mg.direct ? .9 : .45, className: 'map-line' + (mg.direct ? ' direct' : ''), dashArray: mg.direct ? undefined : '4 4',
      });
      l.on('mousemove', e => showTip({
        title: texts.map.migration(mg.from.name, mg.to.name),
        lines: [texts.map.bornThere(mg.children.map(c => c.name))],
      }, (e as L.LeafletMouseEvent).originalEvent));
      l.on('mouseout', hideTip);
      l.addTo(lineLayer);
    });
  });
  // Migrations of a life, dotted and under the others: from where each person was born to where they died
  createEffect(() => {
    lifeLayer.clearLayers();
    if (!showLines()) return;
    [...lives()].sort((a, b) => Number(a.direct) - Number(b.direct)).forEach(lf => {
      const l = L.polyline(arc([lf.from.lat, lf.from.lon], [lf.to.lat, lf.to.lon]), {
        color: branchColor(lf.branch), weight: (lf.direct ? 2.5 : 1.5) + Math.min(3, lf.people.length - 1),
        opacity: lf.direct ? .85 : .5, className: 'map-life' + (lf.direct ? ' direct' : ''), dashArray: '1 6', lineCap: 'round',
      });
      l.on('mousemove', e => showTip({
        title: texts.map.migration(lf.from.name, lf.to.name),
        lines: [texts.map.livedFromTo(lf.from.name, lf.to.name, lf.people.map(p => p.name))],
      }, (e as L.LeafletMouseEvent).originalEvent));
      l.on('mouseout', hideTip);
      l.addTo(lifeLayer);
    });
  });
  // A place chosen from the list: the map goes to it
  function choose(pl: MapPlace) {
    setSelected(pl.key);
    map?.flyTo([pl.lat, pl.lon], Math.max(map.getZoom(), 8), { animate: !reduced, duration: .8 });
  }
  // If the chosen place is left without facts (filter or year), the list comes back
  createEffect(() => { if (selected() && !current()) setSelected(null); });

  const byKind = (pl: MapPlace, k: FactKind) => pl.facts.filter(f => f.kind === k);
  const usedBranches = createMemo(() => [...new Set(places().map(pl => pl.branch))]);

  return (
    <>
      <div class="view-head">
        <h2>{texts.map.title}</h2>
        <p class="muted">{texts.map.intro}</p>
        <ScopeChips id="map-filters" label={texts.scope.filterPeople} value={scope()} onChange={setScope} />
        <div class="map-controls">
          <div class="map-kinds" role="group" aria-label={texts.map.kindsLabel}>
            <For each={FACT_KINDS}>{k => (
              <label class="map-toggle">
                <input type="checkbox" id={`map-kind-${k}`} checked={!hidden().has(k)} onChange={e => setShown(k, e.currentTarget.checked)} />
                {texts.map.kinds[k].label}
              </label>
            )}</For>
          </div>
          <label class="map-toggle" title={texts.map.migrationsTitle}>
            <input type="checkbox" id="map-lines" checked={showLines()} onChange={e => setShowLines(e.currentTarget.checked)} />
            {texts.map.migrations}
          </label>
          <button type="button" class="map-play" id="map-play" title={playing() ? texts.map.pause : texts.map.play}
                  aria-label={playing() ? texts.map.pause : texts.map.play} onClick={play}>{playing() ? '❚❚' : '▶'}</button>
          <input type="range" id="map-year" aria-label={texts.map.year} min={minYear()} max={now} step={1}
                 value={until() ?? now} onInput={e => { stop(); const y = +e.currentTarget.value; setUntil(y >= now ? null : y); }} />
          <span class="map-until" id="map-until">{until() == null ? texts.map.allYears : texts.map.until(until()!)}</span>
          <Show when={until() != null}>
            <button type="button" class="chip" id="map-all-years" onClick={() => { stop(); setUntil(null); }}>{texts.map.allYears}</button>
          </Show>
        </div>
      </div>
      <Legend id="legend-map" keys={usedBranches()} />
      <div class="map-layout">
        <div class="map-wrap">
          <div class="map" id="map" role="region" aria-label={texts.map.label} ref={el} />
          <Show when={offline()}><p class="map-offline" role="status">{texts.map.offline}</p></Show>
        </div>
        <aside class="map-side" id="map-side" aria-live="polite" ref={side}>
          <Show when={current()} fallback={
            <>
              <p class="map-count">{texts.map.places(places().length)} · {texts.map.facts(total())}</p>
              <Show when={places().length} fallback={<p class="muted">{texts.map.empty}</p>}>
                <ul class="map-places">
                  <For each={places()}>{pl => (
                    <li>
                      <button type="button" data-place={pl.key} onClick={() => choose(pl)}>
                        <i style={{ background: branchColor(pl.branch) }} classList={{ mine: pl.mine }} />
                        <span>{pl.name}</span><b>{pl.facts.length}</b>
                      </button>
                    </li>
                  )}</For>
                </ul>
              </Show>
              <Show when={missing}><p class="muted map-missing">{texts.map.unlocated(missing)}</p></Show>
            </>
          }>{pl => (
            <div class="map-place">
              <button type="button" class="map-back" onClick={() => setSelected(null)}>{texts.map.back}</button>
              <h3>{pl().name}</h3>
              <Show when={pl().texts.length > 1 || pl().texts[0] !== pl().name}>
                <details class="map-written"><summary>{texts.map.writtenAsTitle(pl().texts.length)}</summary>{pl().texts.join(' · ')}</details>
              </Show>
              <For each={FACT_KINDS.filter(k => byKind(pl(), k).length)}>{k => (
                <section>
                  <h4>{texts.map.kinds[k].label} <span class="muted">({byKind(pl(), k).length})</span></h4>
                  <ul class="map-facts"><For each={byKind(pl(), k)}>{f => <FactRow f={f} />}</For></ul>
                </section>
              )}</For>
            </div>
          )}</Show>
        </aside>
      </div>
      <p class="muted map-note">{texts.map.focusNote(focusName())}</p>
    </>
  );
}
