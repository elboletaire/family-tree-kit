/* MAP: the places of the family (places.yml) on OpenStreetMap, with Leaflet. A point per place, sized by its facts and
   colored by its branch; lines from the parents' birthplace to their children's, and from each person's birthplace to
   the place where they died. The list of the side is Solid; the
   points and lines are Leaflet layers, redrawn from the memos */
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from 'solid-js';
import { DocCard } from '../components/DocCard';
import { Legend } from '../components/Legend';
import { PersonChip } from '../components/PersonChip';
import { ScopeChips } from '../components/ScopeChips';
import { hideTip, showTip } from '../components/Tooltip';
import { BR, DATA } from '../data';
import { createFullscreen } from '../fullscreen';
import { texts } from '../i18n';
import { openPlace, place, scope, setScope, view } from '../router';
import { focus, focusName, kinSet } from '../state';
import { fmtDate, reduced, store } from '../util';
import { arc, FACT_KINDS, kindCounts, lifeLines, mainBounds, mapFacts, mapPlaces, migrations, radius, unlocated, type Fact, type FactKind, type MapPlace } from './mapLayout';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const LINES_KEY = 'arbre-map-lines';
const SPEED_KEY = 'arbre-map-speed';
/** The speeds of the play; at ×1, a year each YEAR_MS */
const SPEEDS = [1, 2, 4];
const YEAR_MS = 500;
/** How long a new point takes to shrink to its size, a point that gains facts to pulse (both at ×1, shorter when faster)
    and a new line to be traced */
const GROW_MS = 1200, PULSE_MS = 900, TRACE_MS = 1000;
/** A new point starts this much bigger (and see-through), so that it is clearly seen appearing */
const pingRadius = (r: number): number => r * 3 + 14;
/** While playing, the camera stays between these zooms: not too close to the first point, and not so far that a place
    across the ocean shrinks the rest (the minimum is about the width of a country; less on narrow screens) */
const PLAY_MAX_ZOOM = 10.5, PLAY_MIN_ZOOM = 5, PLAY_MIN_ZOOM_NARROW = 4;
/** How far it may go out when the new places of a year are far apart (a birth across the ocean and others at home) */
const PLAY_WIDE_ZOOM = 2;
/** A flight longer than this (km) is a long journey: it lasts longer, and the camera stays there a moment */
const FAR_KM = 1500, FAR_STAY_MS = 1500;
/** The kinds of facts hidden, comma-separated: the ones not listed (also those added later) are shown */
const HIDDEN_KINDS_KEY = 'arbre-map-hidden';
const branchColor = (key: string): string => (BR.get(key) ?? BR.get(DATA.otherBranch)!).color;
/** Coastline of the world (Natural Earth, 1:110m), under the tiles: what is seen without network */
const LAND = feature(land110 as unknown as Topology, (land110 as unknown as Topology).objects.land as GeometryCollection);

/** The animations running: their next frame and what they do */
const running = new Map<object, { frame: number; fn: (k: number) => void }>();
/** Runs `fn` from 0 to 1 along `ms` (at once, with reduced motion) */
function animate(ms: number, fn: (k: number) => void) {
  if (reduced) return fn(1);
  const t0 = performance.now(), self = {};
  const frame = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    fn(k);
    if (k < 1) running.set(self, { frame: requestAnimationFrame(frame), fn }); else running.delete(self);
  };
  running.set(self, { frame: requestAnimationFrame(frame), fn });
}
/** Ends the running animations at once: a shape redrawn while the map flies is drawn out of place */
function settle() {
  running.forEach(({ frame, fn }) => { cancelAnimationFrame(frame); fn(1); });
  running.clear();
}
const easeOut = (k: number): number => 1 - (1 - k) ** 3;
/** Slow at both ends: a new point stays big for a moment before shrinking */
const easeInOut = (k: number): number => k * k * (3 - 2 * k);

type Tip = { title: string; lines: string[] };
/** A line of the map: drawn as it is seen but without events, over a wider invisible one that takes them (the gaps of
    the dashes and the thin lines can be hovered too) */
interface DrawnLine { vis: L.Polyline; hit: L.Polyline; tip: () => Tip }
interface LineSpec { key: string; pts: [number, number][]; style: L.PolylineOptions; tip: () => Tip; direct: boolean }

/** Keeps the lines of `layer` as `specs`: removes the ones gone, restyles the ones kept and adds the new ones, traced
    from their start if `trace` */
function syncLines(layer: L.LayerGroup, drawn: Map<string, DrawnLine>, specs: LineSpec[], renderer: L.Renderer, trace: boolean) {
  const keys = new Set(specs.map(s => s.key));
  drawn.forEach((d, k) => { if (!keys.has(k)) { layer.removeLayer(d.vis); layer.removeLayer(d.hit); drawn.delete(k); } });
  specs.forEach(s => {
    const old = drawn.get(s.key);
    if (old) { old.vis.setStyle(s.style); old.tip = s.tip; return; }
    const d: DrawnLine = {
      vis: L.polyline(trace ? s.pts.slice(0, 1) : s.pts, { ...s.style, renderer, interactive: false }),
      hit: L.polyline(s.pts, { renderer, weight: 14, opacity: 0, className: 'map-hit' }),
      tip: s.tip,
    };
    d.hit.on('mousemove', e => showTip(d.tip(), (e as L.LeafletMouseEvent).originalEvent));
    d.hit.on('mouseout', hideTip);
    d.vis.addTo(layer);
    d.hit.addTo(layer);
    drawn.set(s.key, d);
    if (trace) animate(TRACE_MS, k => d.vis.setLatLngs(s.pts.slice(0, 1 + Math.round(easeOut(k) * (s.pts.length - 1)))));
  });
  // The focused person's direct line, above
  specs.filter(s => s.direct).forEach(s => drawn.get(s.key)!.vis.bringToFront());
}

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
  const [offline, setOffline] = createSignal(false);
  /** Opened from the disk (file://): the page has no origin to send as Referer, and OpenStreetMap answers every tile
      without one with its «Access blocked» image (with a 200, so no tileerror): no tiles, only the coastline */
  const local = location.protocol === 'file:';

  const allFacts = createMemo(() => mapFacts(keep(), null, kinds()));
  const minYear = createMemo(() => Math.min(now, ...allFacts().map(f => f.year ?? now)));
  const places = createMemo(() => mapPlaces(until() == null ? allFacts() : mapFacts(keep(), until(), kinds()), focus()));
  // Only between places with facts up to the year, of any kind (the lines stay with the births hidden): a parent born
  // in an undated place has no point until all the years are shown
  const shownPoints = createMemo(() => new Set(mapPlaces(mapFacts(keep(), until()), focus()).map(pl => pl.key)));
  const lines = createMemo(() => migrations(keep(), until(), line()).filter(m => shownPoints().has(m.from.key) && shownPoints().has(m.to.key)));
  const lives = createMemo(() => lifeLines(keep(), until(), line()).filter(l => shownPoints().has(l.from.key) && shownPoints().has(l.to.key)));
  const current = createMemo(() => places().find(pl => pl.key === place()) ?? null);
  const total = createMemo(() => places().reduce((n, pl) => n + pl.facts.length, 0));
  /** What happened in the year seen, to tell it over the map */
  const happened = createMemo(() => {
    const y = until();
    return y == null ? [] : mapFacts(keep(), y, kinds()).filter(f => f.year === y).map(f =>
      f.kind === 'doc' ? texts.map.happened.doc(f.d!.title)
        : f.kind === 'marriage' ? texts.map.happened.marriage(f.p!.name, f.q?.name ?? null)
          : texts.map.happened[f.kind](f.p!.name));
  });
  const missing = unlocated().length;

  /* --- playing the years: from the first fact to today, a year each step */
  const [playing, setPlaying] = createSignal(false);
  const savedSpeed = Number(store.get(SPEED_KEY));
  const [speed, setSpeedSignal] = createSignal(SPEEDS.includes(savedSpeed) ? savedSpeed : 1);
  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed()) + 1) % SPEEDS.length];
    setSpeedSignal(s);
    store.set(SPEED_KEY, String(s));
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { clearTimeout(timer); timer = undefined; setPlaying(false); };
  /** The camera follows the new facts while playing, until the map is moved by hand */
  let following = false;
  /** Goes to the year `y`: the camera flies to what is new in it, and then the year shows and `then` goes on */
  function showYear(y: number, then: (changed: boolean, stay: number) => void) {
    const before = new Map(places().map(pl => [pl.key, pl.facts.length]));
    const shown = mapPlaces(mapFacts(keep(), y, kinds()), focus());
    const fresh = shown.filter(pl => (before.get(pl.key) ?? 0) < pl.facts.length);
    // The camera first, and the year once it is there: what appears is drawn in place, not in the middle of a flight
    const { flight, stay } = following && fresh.length ? follow(fresh, shown) : { flight: 0, stay: 0 };
    const show = () => { setUntil(y); then(fresh.length > 0, stay); };
    if (flight) timer = setTimeout(show, flight); else show();
  }
  // Each step reads the speed, so that changing it applies at once
  // After a year with something new, the next one waits for its points to finish appearing (and after a long journey,
  // a little more)
  const nextYear = (changed = false, stay = 0) => {
    timer = setTimeout(tick, ((changed ? Math.max(YEAR_MS, GROW_MS) : YEAR_MS) + stay) / speed());
  };
  function tick() {
    const next = (until() ?? minYear()) + 1;
    if (next >= now) {
      setUntil(null);
      stop();
      if (following && map) { settle(); const box = mainBounds(places()); flying = !reduced; if (box) map.flyToBounds(box, { padding: [30, 30], maxZoom: 9, animate: !reduced }); }
      return;
    }
    showYear(next, nextYear);
  }
  function play() {
    if (playing()) return stop();
    setPlaying(true);
    following = true;
    if (until() != null && until()! < now) return nextYear();
    // From the beginning: the map empty, and the first year
    setUntil(minYear() - 1);
    showYear(minYear(), nextYear);
  }
  /** Flies to the places that are new or have new facts, framed with the others already on the map that fit (those
      with most facts first; a place across the ocean stays out, or alone for a moment if it is the new one); returns
      how long the flight lasts (0 if they are already well in sight at about the same zoom) */
  function follow(fresh: MapPlace[], shown: MapPlace[]): { flight: number; stay: number } {
    const still = { flight: 0, stay: 0 };
    if (!map) return still;
    // Room around (more above and below: the box of the year covers the bottom of the map)
    const pad = L.point(80, 240), at = (pl: MapPlace): L.LatLngTuple => [pl.lat, pl.lon];
    const minZoom = el.clientWidth < 600 ? PLAY_MIN_ZOOM_NARROW : PLAY_MIN_ZOOM;
    const inSight = map.getBounds().pad(-.1);
    const byFacts = (pls: MapPlace[]) => [...pls].sort((a, b) => b.facts.length - a.facts.length);
    const unseen = byFacts(fresh.filter(pl => !inSight.contains(at(pl))));
    let target = L.latLngBounds(fresh.map(at)), low = PLAY_WIDE_ZOOM;
    // New places far apart the same year (across the ocean and at home): all of them, as far out as needed. Otherwise
    // the news first (the new places out of sight), then the other new ones and the places already shown that fit
    if (map.getBoundsZoom(target, false, pad) >= minZoom) {
      low = minZoom;
      const order = [...unseen, ...byFacts(fresh.filter(pl => !unseen.includes(pl))), ...byFacts(shown)];
      target = L.latLngBounds([at(order[0])]);
      for (const pl of order.slice(1)) {
        const wider = L.latLngBounds(target.getSouthWest(), target.getNorthEast()).extend(at(pl));
        if (map.getBoundsZoom(wider, false, pad) >= minZoom) target = wider;
      }
    }
    const zoom = Math.min(PLAY_MAX_ZOOM, Math.max(low, map.getBoundsZoom(target, false, pad)));
    if (!unseen.length && Math.abs(zoom - map.getZoom()) < 1) return still;
    // Longer the farther it goes (and the more the zoom changes), shorter when faster
    const km = map.distance(map.getCenter(), target.getCenter()) / 1000;
    const seconds = Math.min(3.5, .8 + km / 2500 + .12 * Math.abs(zoom - map.getZoom())) / speed();
    settle();
    flying = !reduced;
    map.flyTo(target.getCenter(), zoom, { animate: !reduced, duration: seconds });
    return reduced ? still : { flight: seconds * 1000, stay: km > FAR_KM ? FAR_STAY_MS : 0 };
  }
  onCleanup(stop);

  /* --- the Leaflet map */
  let map: L.Map | undefined;
  const pointLayer = L.layerGroup(), lineLayer = L.layerGroup(), lifeLayer = L.layerGroup();
  const markers = new Map<string, L.CircleMarker>();
  /** The place each marker shows now, for its tooltip and its click */
  const placeAt = new Map<string, MapPlace>();
  const drawnLines = new Map<string, DrawnLine>(), drawnLives = new Map<string, DrawnLine>();
  /** A drawing for each pane: the migrations of a life, under the others; the other migrations; the points, on top */
  const svgLives = L.svg({ pane: 'lives' }), svgLines = L.svg(), svgPoints = L.svg({ pane: 'points' });
  /** The camera is flying for the play: the drawings are redone on each step of the zoom */
  let flying = false;
  onMount(() => {
    map = L.map(el, { zoomSnap: .5, worldCopyJump: true, attributionControl: true });
    map.createPane('outline').style.zIndex = '150';  // under the tiles (200)
    map.createPane('lives').style.zIndex = '390';    // the migrations of a life, under the others (overlayPane, 400)
    map.createPane('points').style.zIndex = '450';   // over the lines
    L.geoJSON(LAND, { pane: 'outline', interactive: false, style: { color: '#b9ad9c', weight: 1, fillColor: '#f2eee6', fillOpacity: 1 } }).addTo(map);
    if (!local) {
      // The server sends «Referrer-Policy: no-referrer», and OpenStreetMap blocks tile requests without a Referer:
      // the tiles send the site's origin only. During the play's flights, only the tiles of the final zoom are loaded
      const tiles = L.tileLayer(TILES, { maxZoom: 18, attribution: texts.map.attribution, referrerPolicy: 'strict-origin', updateWhenZooming: false });
      tiles.on('tileerror', () => setOffline(true)).on('tileload', () => setOffline(false)).addTo(map);
    }
    lifeLayer.addTo(map);
    lineLayer.addTo(map);
    pointLayer.addTo(map);
    map.on('click', () => openPlace(null));
    // While the zoom animates, Leaflet scales the drawings as images, and a zoom of several levels (back from across the
    // ocean) makes the points huge for a moment: during the play's flights they are drawn again at each step, with
    // Leaflet's internal _reset (what it does on a viewreset)
    map.on('zoom', () => {
      if (flying) for (const r of [svgLives, svgLines, svgPoints]) (r as unknown as { _reset(): void })._reset();
    });
    map.on('moveend', () => { flying = false; });
    // Moving the map by hand stops the camera from following the play
    map.on('dragstart', () => { following = false; });
    el.addEventListener('wheel', () => { following = false; }, { passive: true });
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
  /* --- full screen: the controls, the legend, the map and the list of places take the whole window */
  const [full, setFull] = createFullscreen('map-full');
  // The map measures itself again when it changes size
  createEffect(on(full, () => requestAnimationFrame(() => map?.invalidateSize()), { defer: true }));
  // The map is created inside a hidden page when it is not the active view: when it shows again, it measures itself;
  // leaving the view leaves the full screen
  createEffect(on(() => view() === 'map', active => {
    if (active && map) map.invalidateSize();
    if (!active && full()) setFull(false);
  }, { defer: true }));

  const tipLines = (pl: MapPlace) => kindCounts(pl.facts).map(([k, n]) => `${n} ${n === 1 ? texts.map.kinds[k].one : texts.map.kinds[k].many}`);
  // The points are kept from one year to the next: while playing, the new ones grow and those that gain facts pulse
  createEffect(() => {
    const pts = places(), grow = playing();
    const keys = new Set(pts.map(pl => pl.key));
    markers.forEach((m, key) => { if (!keys.has(key)) { pointLayer.removeLayer(m); markers.delete(key); placeAt.delete(key); } });
    pts.forEach(pl => {
      const r = radius(pl.facts.length), before = placeAt.get(pl.key);
      placeAt.set(pl.key, pl);
      let m = markers.get(pl.key);
      if (!m) {
        const key = pl.key;
        m = L.circleMarker([pl.lat, pl.lon], {
          renderer: svgPoints, radius: grow ? pingRadius(r) : r, fillColor: branchColor(pl.branch), fillOpacity: grow ? .4 : .85,
          color: '#fff', weight: 1.5, className: 'map-point',
        });
        m.on('mousemove', e => { const p = placeAt.get(key)!; showTip({ title: p.name, lines: tipLines(p) }, (e as L.LeafletMouseEvent).originalEvent); });
        m.on('mouseout', hideTip);
        m.on('click', e => {
          L.DomEvent.stopPropagation(e); hideTip(); stop(); if (key !== place()) clicked = key; openPlace(key);
          // On narrow screens the list is below the map: it comes into view
          if (matchMedia('(max-width: 900px)').matches) side.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
        });
        m.addTo(pointLayer);
        markers.set(key, m);
        // It appears big and see-through, and shrinks to its size
        const born = m, big = pingRadius(r);
        if (grow) animate(GROW_MS / untrack(speed), k => {
          const e = easeInOut(k);
          born.setRadius(big + (r - big) * e);
          born.setStyle({ fillOpacity: .4 + .45 * e });
        });
      } else {
        m.setStyle({ fillColor: branchColor(pl.branch) });
        const grown = m;
        if (grow && before && pl.facts.length > before.facts.length) animate(PULSE_MS / untrack(speed), k => grown.setRadius(r + (r + 10) * (1 - easeOut(k))));
        else m.setRadius(r);
      }
      m.getElement()?.classList.toggle('mine', pl.mine);
    });
    // The small ones on top, so that they can be clicked
    [...pts].sort((a, b) => b.facts.length - a.facts.length).forEach(pl => markers.get(pl.key)!.bringToFront());
  });
  // The chosen point, outlined; the focused person's places, with a dark edge
  createEffect(() => {
    places();
    const sel = place();
    markers.forEach((m, key) => {
      // A marker of a place just gone, before the points are updated
      const pl = places().find(p => p.key === key);
      if (!pl) return;
      m.setStyle(key === sel ? { color: '#2b2622', weight: 3.5 } : pl.mine ? { color: '#2b2622', weight: 2 } : { color: '#fff', weight: 1.5 });
      if (key === sel) m.bringToFront();
    });
  });
  // The lines, kept like the points: while playing, the new ones are traced from their start. The focused person's
  // direct line, stronger and above (its key changes with it, so that its class does too)
  createEffect(() => {
    syncLines(lineLayer, drawnLines, !showLines() ? [] : lines().map(mg => ({
      key: mg.key + (mg.direct ? ' direct' : ''), direct: mg.direct,
      pts: arc([mg.from.lat, mg.from.lon], [mg.to.lat, mg.to.lon], 32),
      style: {
        color: branchColor(mg.branch), weight: (mg.direct ? 2.5 : 1.2) + Math.min(3, mg.children.length - 1),
        opacity: mg.direct ? .9 : .45, className: 'map-line' + (mg.direct ? ' direct' : ''), dashArray: mg.direct ? undefined : '4 4',
      },
      tip: () => ({ title: texts.map.migration(mg.from.name, mg.to.name), lines: [texts.map.bornThere(mg.children.map(c => c.name))] }),
    })), svgLines, playing());
  });
  // Migrations of a life, dotted and under the others: from where each person was born to where they died
  createEffect(() => {
    syncLines(lifeLayer, drawnLives, !showLines() ? [] : lives().map(lf => ({
      key: lf.key + (lf.direct ? ' direct' : ''), direct: lf.direct,
      pts: arc([lf.from.lat, lf.from.lon], [lf.to.lat, lf.to.lon], 32),
      style: {
        color: branchColor(lf.branch), weight: (lf.direct ? 2.5 : 1.5) + Math.min(3, lf.people.length - 1),
        opacity: lf.direct ? .85 : .5, className: 'map-life' + (lf.direct ? ' direct' : ''), dashArray: '1 6', lineCap: 'round',
      },
      tip: () => ({
        title: texts.map.migration(lf.from.name, lf.to.name),
        lines: [texts.map.livedFromTo(lf.from.name, lf.to.name, lf.people.map(p => p.name))],
      }),
    })), svgLives, playing());
  });
  /** The place just clicked on the map: the camera stays where it is */
  let clicked: string | null = null;
  // A place chosen (from the list, the search, a link or the back button): the map goes to it. If the filter, the year
  // or the kinds of facts leave it out, the whole tree is seen, of all the years (and, if needed, all the kinds)
  createEffect(on(place, key => {
    const still = clicked === key;
    clicked = null;
    if (!key) return;
    if (!current()) {
      stop();
      setScope('all');
      setUntil(null);
      if (!current()) { setHiddenSignal(new Set<string>()); store.set(HIDDEN_KINDS_KEY, ''); }
    }
    const pl = current();
    if (!pl || still || !map) return;
    stop();
    map.invalidateSize();
    map.flyTo([pl.lat, pl.lon], Math.max(map.getZoom(), 8), { animate: !reduced, duration: .8 });
  }));
  // If the chosen place is left without facts (filter, year or kinds of facts), the list comes back
  createEffect(on(places, () => { if (place() && !current()) openPlace(null, { replace: true }); }, { defer: true }));

  const byKind = (pl: MapPlace, k: FactKind) => pl.facts.filter(f => f.kind === k);
  const usedBranches = createMemo(() => [...new Set(places().map(pl => pl.branch))]);

  return (
    <div class="map-view">
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
          <button type="button" class="chip map-speed" id="map-speed" title={texts.map.speed}
                  aria-label={texts.map.speedLabel(speed())} onClick={nextSpeed}>×{speed()}</button>
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
          <button type="button" id="map-full" class="map-fs" classList={{ on: full() }} title={full() ? texts.map.fullscreen.off : texts.map.fullscreen.on}
                  aria-label={full() ? texts.map.fullscreen.off : texts.map.fullscreen.on} onClick={() => setFull(!full())}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path class="fs-open" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /><path class="fs-close" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            </svg>
          </button>
          <Show when={local || offline()}><p class="map-offline" role="status">{local ? texts.map.local : texts.map.offline}</p></Show>
          <Show when={until() != null}>
            <div class="map-now" id="map-now">
              <b>{until()}</b>
              <Show when={happened().length}>
                <span>{[...happened().slice(0, 3), ...(happened().length > 3 ? [texts.map.andMore(happened().length - 3)] : [])].join(' · ')}</span>
              </Show>
            </div>
          </Show>
        </div>
        <aside class="map-side" id="map-side" aria-live="polite" ref={side}>
          <Show when={current()} fallback={
            <>
              <p class="map-count">{texts.map.places(places().length)} · {texts.map.facts(total())}</p>
              <Show when={places().length} fallback={<p class="muted">{texts.map.empty}</p>}>
                <ul class="map-places">
                  <For each={places()}>{pl => (
                    <li>
                      <button type="button" data-place={pl.key} onClick={() => openPlace(pl.key)}>
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
              <button type="button" class="map-back" onClick={() => openPlace(null)}>{texts.map.back}</button>
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
    </div>
  );
}
