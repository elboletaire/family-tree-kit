/* TIME VOYAGE: the events come closer in perspective. The cards are Solid components; their position in each frame
   comes from the camera (year, offset and zoom), which are signals */
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack, type JSX } from 'solid-js';
import { lightboxOpen } from '../components/Lightbox';
import { PersonChip } from '../components/PersonChip';
import { ScopeChips } from '../components/ScopeChips';
import { color, DATA, P } from '../data';
import { listen } from '../events';
import { createFullscreen } from '../fullscreen';
import { texts } from '../i18n';
import { openDoc, openPerson, view } from '../router';
import { focus, focusName, kinOf, kinSet, type Scope } from '../state';
import type { Person } from '../types';
import { fmtDate, initials, reduced } from '../util';
import { century, decades, eraSummary, KIND, voyageEvents, type Placed, type VEvent } from './voyageEvents';

/** What the camera sees in a frame */
interface Camera { t: number; W: number; H: number; camX: number; D: number; fit: number; spreadY: number }
/** Where something placed at `o` is seen (null if it is out of sight: behind or too far) */
function project(o: Placed, near: number, far: number, c: Camera): { dz: number; x: number; y: number; s: number } | null {
  const dz = o.at - c.t;
  if (dz < near || dz > far) return null;
  const s = c.fit / (1 + Math.max(dz, -.85) / c.D);
  return { dz, s, x: c.W / 2 + (o.x * c.W * .5 - c.camX) * s, y: c.H * .47 + o.y * c.H * c.spreadY * s };
}
const at = (r: { x: number; y: number; s: number }) => `translate(${r.x}px, ${r.y}px) translate(-50%, -50%) scale(${r.s})`;

function Pic(props: { p: Person }) {
  return (
    <Show when={props.p.photo} fallback={<span class="vc-pic" style={{ background: color(props.p.id) }}>{initials(props.p)}</span>}>
      {photo => <span class="vc-pic" style={{ 'background-image': `url('${photo()}')` }} />}
    </Show>
  );
}

function CardBody(props: { e: VEvent }) {
  const e = props.e, k = KIND[e.kind];
  const what = <span class="vc-what">{k.icon} {k.label}{e.date ? ' · ' + fmtDate(e.date) : ''}</span>;
  const where = <Show when={e.place}><span class="vc-where">{e.place}</span></Show>;
  if (e.kind === 'doc') {
    const d = e.d!;
    return (
      <>
        <Show when={d.thumb} fallback={<span class="vc-pic">▤</span>}>{thumb => <span class="vc-pic" style={{ 'background-image': `url('${thumb()}')` }} />}</Show>
        <span class="vc-body"><b>{d.title}</b>{what}{where}</span>
      </>
    );
  }
  const p = e.p!;
  const kin = () => kinOf(p.id);
  return (
    <>
      <span class="vc-pics" style={{ '--branch': color(p.id) }}><Pic p={p} /><Show when={e.q}>{q => <Pic p={q()} />}</Show></span>
      <span class="vc-body">
        <b>{e.q ? texts.voyage.couple(p.name, e.q.name) : p.name}</b>{what}{where}
        <Show when={!e.q && kin()}>{k => <span class="vc-kin">{texts.kin.of(k().label, focusName())}</span>}</Show>
      </span>
    </>
  );
}

/** Years the play advances each second: two seconds a year, to follow who is born and dies */
const PLAY_YEARS_PER_SECOND = .5;

export function Voyage() {
  let el!: HTMLDivElement;
  let range!: HTMLInputElement;
  const now = new Date().getFullYear(), max = now + 1;
  const active = () => view() === 'voyage';

  const [scope, setScope] = createSignal<Scope>('all');
  const keep = createMemo(() => kinSet(scope()));
  const inScope = (id: string) => { const k = keep(); return !k || k.has(id); };
  const events = createMemo(() => voyageEvents(focus(), keep()));
  const min = createMemo(() => Math.floor((events()[0]?.at ?? 1800) - 1));
  const marks = createMemo(() => decades(min(), now));
  const undated = createMemo(() => DATA.people.filter(p => inScope(p.id) && !p.bornYear && !p.diedYear).length);

  /* --- camera: `t` is the year seen; `target`, where it is going */
  const [t, setT] = createSignal<number | null>(null);
  let target: number | null = null;
  const [camX, setCamX] = createSignal(0);
  const [zoom, setZoom] = createSignal(1);
  const [size, setSize] = createSignal({ W: 0, H: 0 });
  const [playing, setPlayingSignal] = createSignal(false);
  let raf: number | null = null, last = 0;
  const clamp = (y: number) => Math.min(Math.max(y, min()), max);
  const jump = (y: number) => { target = y; setT(y); };
  function glide(y: number) {
    target = clamp(y);
    if (reduced) return jump(target);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function goFocus(instant: boolean) {
    const mine = events().filter(e => e.mine);
    const y = mine.length ? mine[0].at - .6 : min();
    if (instant) jump(y); else glide(y);
  }
  function step(dir: number) {
    const ev = events(), to = target!;
    const next = dir > 0 ? ev.find(e => e.at > to + .05) : [...ev].reverse().find(e => e.at < to - .05 + .6);
    if (next) glide(next.at - .6);
  }
  function tick(ms: number) {
    const dt = Math.min(.05, (ms - last) / 1000); last = ms;
    if (playing()) {
      target = Math.min(target! + dt * PLAY_YEARS_PER_SECOND, max);
      if (target >= max) setPlaying(false);
    }
    const cur = t()!, d = target! - cur;
    setT(Math.abs(d) < .002 ? target : cur + d * Math.min(1, dt * 7));
    raf = (playing() || t() !== target) ? requestAnimationFrame(tick) : null;
  }
  function setPlaying(on: boolean) {
    setPlayingSignal(on);
    if (on) { if (target! >= max - .5) jump(min()); glide(target!); }
  }
  onCleanup(() => { if (raf) cancelAnimationFrame(raf); });
  // When the filter changes, the camera stays in the same year if it is still inside
  createEffect(on(min, () => { const cur = untrack(t); if (cur != null) jump(clamp(cur)); }, { defer: true }));

  const camera = createMemo<Camera | null>(() => {
    const cur = t(), { W, H } = size();
    if (cur == null || !W) return null;
    return {
      t: cur, W, H, camX: camX(), D: 4.5 / zoom(),
      fit: Math.min(1, Math.max(.72, W / 900)),  // on narrow screens, somewhat smaller cards
      spreadY: H > W * 1.2 ? .8 : .5,             // in portrait, more spread from top to bottom
    };
  });
  const cardStyle = (e: VEvent): JSX.CSSProperties => {
    const c = camera(), r = c && project(e, -1.1, 30, c);
    if (!r) return { display: 'none' };
    const dz = r.dz;
    return {
      transform: at(r),
      opacity: String(dz < 0 ? Math.max(0, 1 + dz / 1.1) : Math.max(0, 1 - Math.max(0, dz - 2) / 22)),
      filter: dz > 2 ? `blur(${Math.min(3, (dz - 2) * .18).toFixed(2)}px) brightness(${Math.max(.55, 1 - (dz - 2) * .025).toFixed(2)})` : undefined,
      'z-index': String(Math.round(2000 - dz * 40)),
      'pointer-events': dz > -.6 && dz < 14 ? undefined : 'none',
    };
  };
  const markStyle = (m: Placed): JSX.CSSProperties => {
    const c = camera(), r = c && project(m, -1.5, 80, c);
    if (!r) return { display: 'none' };
    return { transform: at(r), opacity: String(r.dz < 0 ? Math.max(0, .5 + r.dz / 3) : Math.max(.05, .5 - r.dz / 160)) };
  };

  /* --- year, era and who was alive */
  const year = createMemo(() => { const cur = t(); return cur == null ? null : Math.max(min(), Math.min(Math.floor(cur + .6), now)); });
  const eraFrom = createMemo(() => { const y = year(); return y == null ? null : Math.floor(y / 25) * 25; });
  const era = createMemo(() => { const from = eraFrom(); return from == null ? null : eraSummary(events(), from); });
  const alive = createMemo(() => {
    const y = year();
    return y == null ? [] : DATA.people.filter(p => p.bornYear && p.bornYear <= y && inScope(p.id) &&
      (p.diedYear ? p.diedYear >= y : p.living || p.bornYear + 90 >= y));
  });
  createEffect(() => { const cur = t(); if (cur != null && document.activeElement !== range) range.value = cur.toFixed(1); });

  /* --- full screen */
  const [full, setFull] = createFullscreen('voyage-full', () => el.focus({ preventScroll: true }));

  /* --- when the view opens: the first time, at the beginning (or, from another person's card, at their birth);
     afterwards, only if the focused person has changed */
  let drawn: string | undefined;
  createEffect(on([active, focus], ([a, f]) => {
    if (!a) { if (full()) setFull(false); return; }
    if (drawn === f) return;
    const first = drawn === undefined;
    drawn = f;
    if (first && f === DATA.main) jump(min()); else goFocus(first);
  }));

  /* --- controls: wheel, drag, keyboard and buttons */
  const onWheel = (e: WheelEvent) => {
    if ((e.target as Element).closest('.voyage-era')) return;
    e.preventDefault();
    setPlaying(false);
    glide((target ?? t()!) + Math.sign(e.deltaY) * Math.min(3, Math.abs(e.deltaY) / 40));
  };
  let drag: { x: number; y: number; t: number; cam: number; moved: boolean } | null = null;
  let justDragged = false;
  const [dragging, setDragging] = createSignal(false);
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('.voyage-era, .voyage-tools, .voyage-bar')) return;
    drag = { x: e.clientX, y: e.clientY, t: target!, cam: camX(), moved: false };
  };
  listen(window, 'pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    batch(() => {
      setDragging(true);
      setPlaying(false);
      setCamX(drag!.cam - dx);
      jump(clamp(drag!.t - dy / 25));
    });
  });
  listen(window, 'pointerup', () => {
    // The click ending a drag does not open the card below
    if (drag?.moved) { justDragged = true; setTimeout(() => { justDragged = false; }, 0); }
    drag = null; setDragging(false);
  });
  listen(document, 'keydown', e => {
    if (!active() || lightboxOpen() || (e.target as Element).matches('input, textarea')) return;
    const dir = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (dir) { e.preventDefault(); setPlaying(false); step(dir); }
    if (e.key === ' ' && e.target === el) { e.preventDefault(); setPlaying(!playing()); }
  });
  const open = (e: VEvent) => { if (justDragged) return; if (e.d) openDoc(e.d.id); else openPerson(e.p!.id); };

  onMount(() => {
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });
  const f = () => P.get(focus())!;

  return (
    <>
      <div class="view-head">
        <h2>{texts.voyage.title}</h2>
        <p class="muted">{texts.voyage.intro}</p>
        <ScopeChips id="voyage-filters" label={texts.scope.filterPeople} value={scope()} onChange={setScope} />
      </div>
      <div class="voyage" id="voyage" tabindex="0" aria-label={texts.voyage.label} ref={el}
           classList={{ dragging: dragging() }} onWheel={onWheel} onPointerDown={onPointerDown}>
        <div class="voyage-space" id="voyage-space">
          <For each={events()}>{e => (
            <div class={`vcard kind-${e.kind}`} classList={{ 'is-focus': e.mine }} style={cardStyle(e)} onClick={() => open(e)}>
              <CardBody e={e} />
            </div>
          )}</For>
          <For each={marks()}>{m => <div class="vdecade" style={markStyle(m)}>{m.at}</div>}</For>
        </div>
        <div class="voyage-year" aria-live="polite">
          <span id="voyage-year">{year()}</span><small id="voyage-century">{year() == null ? '' : texts.voyage.century(century(year()!))}</small>
        </div>
        <aside class="voyage-era" id="voyage-era">
          <Show when={era()}>{E => (
            <>
              <p class="era-range">{E().from} — {E().to}</p>
              <p class="era-count"><b>{E().total}</b> {texts.voyage.events(E().total)}</p>
              <ul class="era-list">
                <For each={E().counts}>{([k, n]) => <li>{KIND[k].icon} {n} {n === 1 ? KIND[k].label.toLowerCase() : KIND[k].plural}</li>}</For>
              </ul>
              <Show when={E().places.length}>
                <p class="era-places">{texts.voyage.places(E().places)}</p>
              </Show>
              <Show when={E().hist.length}>
                <p class="era-hist"><For each={E().hist}>{(h, i) => <>{i() > 0 && <br />}{h.label} ({h.from}–{h.to})</>}</For></p>
              </Show>
              <details class="era-people">
                <summary>{texts.voyage.aliveIn(year()!, alive().length)}</summary>
                <div class="people-chips"><For each={alive()}>{p => <PersonChip id={p.id} />}</For></div>
              </details>
            </>
          )}</Show>
        </aside>
        <div class="voyage-tools">
          <button type="button" id="voyage-start" title={texts.voyage.start} aria-label={texts.voyage.start}
                  onClick={() => { setPlaying(false); setCamX(0); glide(min()); }}>⏮</button>
          <button type="button" id="voyage-focus" title={texts.voyage.goTo(f().name)}
                  onClick={() => { setPlaying(false); setCamX(0); goFocus(false); }}>◎ {focusName()}</button>
          <button type="button" id="voyage-zoom-in" title={texts.voyage.zoomIn} aria-label={texts.voyage.zoomIn} onClick={() => setZoom(z => Math.min(2.2, z * 1.25))}>+</button>
          <button type="button" id="voyage-zoom-out" title={texts.voyage.zoomOut} aria-label={texts.voyage.zoomOut} onClick={() => setZoom(z => Math.max(.5, z / 1.25))}>−</button>
          <button type="button" id="voyage-full" classList={{ on: full() }} title={full() ? texts.voyage.fullscreen.off : texts.voyage.fullscreen.on}
                  aria-label={full() ? texts.voyage.fullscreen.off : texts.voyage.fullscreen.on} onClick={() => setFull(!full())}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path class="fs-open" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /><path class="fs-close" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            </svg>
          </button>
        </div>
        <div class="voyage-bar">
          <button type="button" id="voyage-prev" title={texts.voyage.previous} aria-label={texts.voyage.previous}
                  onClick={() => { setPlaying(false); step(-1); }}>←</button>
          <button type="button" class="voyage-play" id="voyage-play" title={playing() ? texts.voyage.pause : texts.voyage.play}
                  aria-label={playing() ? texts.voyage.pause : texts.voyage.play} onClick={() => setPlaying(!playing())}>{playing() ? '❚❚' : '▶'}</button>
          <input type="range" id="voyage-range" step="0.1" aria-label={texts.voyage.year} ref={range} min={min()} max={max}
                 onInput={() => { setPlaying(false); jump(+range.value); }} />
          <button type="button" id="voyage-next" title={texts.voyage.next} aria-label={texts.voyage.next}
                  onClick={() => { setPlaying(false); step(1); }}>→</button>
          <div class="voyage-scale"><span id="voyage-min">{min()}</span><span id="voyage-undated">{texts.voyage.undated(undated())}</span><span id="voyage-max">{now}</span></div>
        </div>
      </div>
    </>
  );
}
