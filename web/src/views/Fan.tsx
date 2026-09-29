/* FAN of ancestors. The sectors are Solid SVG; d3 gives the geometry of the arcs and the clock of the transition
   from one person to another */
import * as d3 from 'd3';
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { Legend } from '../components/Legend';
import { hideTip, showTip } from '../components/Tooltip';
import { color, DATA, P } from '../data';
import { texts } from '../i18n';
import { openPerson, view, viewHash } from '../router';
import { focus } from '../state';
import type { Person } from '../types';
import { initials, lifespan, lightColor, reduced, T, years } from '../util';
import { fanFontSize, fanLabel, fanLabelRoom, fanLabelTransform, fanRelation, fanSegments, fitText, R0, ring, type Segment } from './fanLayout';

const W = 1120, H = 980;
type Geometry = Pick<Segment, 'gen' | 'a0' | 'a1'>;
/** Sector with the geometry it comes from (the one it had before, or a line at its center if it is new) */
interface Drawn extends Segment { from: Geometry }

const arc = d3.arc<Geometry>().innerRadius(d => ring(d.gen - 1) + 2).outerRadius(d => ring(d.gen))
  .startAngle(d => d.a0).endAngle(d => d.a1).padAngle(.006).cornerRadius(3);

// Text measured with the same font as the SVG (#fan text), to trim the names that do not fit
let ctx: CanvasRenderingContext2D | null | undefined;
function measure(text: string, size: number): number {
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d'); } catch { ctx = null; }
  }
  if (!ctx) return 0;
  ctx.font = `500 ${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--sans') || 'sans-serif'}`;
  return ctx.measureText(text).width;
}

function Center(props: { p: Person }) {
  const r = R0 - 6;
  return (
    <g class="center fan-center" style={{ cursor: 'pointer' }} onClick={() => openPerson(props.p.id)}>
      <clipPath id="fan-clip"><circle r={r} /></clipPath>
      <circle r={r + 3} fill="#fff" stroke={color(props.p.id)} stroke-width={3} />
      <Show when={props.p.photo} fallback={<>
        <circle r={r} fill={color(props.p.id)} opacity={.9} />
        <text text-anchor="middle" dy=".35em" font-family="Georgia, serif" font-size="34" fill="#fff">{initials(props.p)}</text>
      </>}>
        {photo => <image href={photo()} x={-r} y={-r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clip-path="url(#fan-clip)" />}
      </Show>
      <text class="center-name" y={r + 30} text-anchor="middle">{props.p.name}</text>
      <text class="center-dates" y={r + 48} text-anchor="middle">{lifespan(props.p)}</text>
    </g>
  );
}

export function Fan() {
  // Person at the center and the path to them (the crumbs: back to whoever was seen before)
  const [root, setRoot] = createSignal<string | null>(null);
  const [trail, setTrail] = createSignal<string[]>([]);
  createEffect(on([() => view() === 'fan', focus], ([active, id]) => {
    if (!active) return;
    const current = root();
    const next = P.has(id) ? id : (current || DATA.main);
    if (next === current) return;
    let crumbs = trail();
    if (current && !crumbs.includes(next)) crumbs = [...crumbs, current];
    const back = crumbs.indexOf(next);
    if (back >= 0) crumbs = crumbs.slice(0, back);
    batch(() => { setTrail(crumbs); setRoot(next); });
  }));

  // Transition: each sector moves from its previous geometry to the new one, ring by ring; the leftover ones fade out
  const drawnGeometry = new Map<number, Geometry>();
  const [segments, setSegments] = createSignal<Drawn[]>([]);
  const [leaving, setLeaving] = createSignal<Drawn[]>([]);
  const [elapsed, setElapsed] = createSignal(Infinity);
  let timer: d3.Timer | undefined;
  createEffect(on(root, id => {
    if (!id) return;
    const next = fanSegments(id).map(s => ({ ...s, from: drawnGeometry.get(s.key) ?? { gen: s.gen, a0: (s.a0 + s.a1) / 2, a1: (s.a0 + s.a1) / 2 } }));
    const keys = new Set(next.map(s => s.key));
    const gone = segments().filter(s => !keys.has(s.key));
    gone.forEach(s => drawnGeometry.delete(s.key));
    next.forEach(s => drawnGeometry.set(s.key, s));
    timer?.stop();
    batch(() => { setSegments(next); setLeaving(gone); setElapsed(reduced ? Infinity : 0); });
    if (reduced) return setLeaving([]);
    const end = T(90 * 6 + 750);
    timer = d3.timer(t => {
      setElapsed(t);
      if (t >= end) { timer!.stop(); setLeaving([]); }
    });
  }));
  onCleanup(() => timer?.stop());
  const geometry = (s: Drawn): Geometry => {
    const k = d3.easeCubic(Math.max(0, Math.min(1, (elapsed() - T(s.gen * 90)) / 750)));
    return { gen: s.gen, a0: s.from.a0 + (s.a0 - s.from.a0) * k, a1: s.from.a1 + (s.a1 - s.from.a1) * k };
  };
  const person = createMemo(() => root() ? P.get(root()!)! : null);

  const tip = (s: Segment, ev: MouseEvent) => s.p
    ? showTip({ title: s.p.name, lines: [years(s.p)], note: fanRelation(s.key) }, ev)
    : showTip({ note: texts.fan.unknown(fanRelation(s.key)), noteOpacity: .85 }, ev);

  function Sector(props: { s: Drawn }) {
    const s = props.s;
    const label = s.p ? fitText(fanLabel(s), fanLabelRoom(s), text => measure(text, fanFontSize(s.gen))) : '';
    return (
      <g class="segment">
        <path class="seg" classList={{ empty: !s.p }} d={arc(geometry(s)) ?? ''}
              fill={s.p ? color(s.id!) : '#f1ece3'} stroke={s.p ? 'none' : '#d9d1c4'} stroke-dasharray={s.p ? undefined : '4 4'}
              onClick={() => { if (s.p) location.hash = viewHash('fan', s.id!); }}
              onMouseMove={ev => tip(s, ev)} onMouseLeave={hideTip}
              onContextMenu={ev => { if (s.p) { ev.preventDefault(); openPerson(s.id!); } }} />
        <text class={`fan-label${s.p && lightColor(color(s.id!)) ? ' dark' : ''}`} font-size={String(fanFontSize(s.gen))}
              text-anchor="middle" dy="0.35em" transform={fanLabelTransform(s)}
              style={{ 'animation-delay': `${T(350 + s.gen * 90)}ms` }}>{label}</text>
      </g>
    );
  }

  return (
    <>
      <div class="view-head">
        <h2>{texts.fan.title}<span id="fan-root-name">{person()?.name}</span></h2>
        <p class="muted">{texts.fan.intro}</p>
        <div class="crumbs" id="fan-crumbs">
          <For each={trail()}>{h => <a href={viewHash('fan', h)}>← {P.get(h)!.given || P.get(h)!.name}</a>}</For>
        </div>
      </div>
      <div class="fan-wrap">
        <svg id="fan" role="img" aria-label={texts.fan.label} viewBox={[-W / 2, -545, W, H].join(',')}>
          <g>
            <For each={segments()}>{s => <Sector s={s} />}</For>
            <For each={leaving()}>{s => (
              <g class="segment" style={{ opacity: Math.max(0, 1 - elapsed() / T(300) || 0) }}>
                <path class="seg" classList={{ empty: !s.p }} d={arc(s) ?? ''} fill={s.p ? color(s.id!) : '#f1ece3'} />
              </g>
            )}</For>
          </g>
          <Show when={person()} keyed>{p => <Center p={p} />}</Show>
        </svg>
      </div>
      <Legend id="legend-fan" />
    </>
  );
}
