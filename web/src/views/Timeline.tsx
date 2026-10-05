/* TIMELINE: the life of each person, the documents by year and the eras. Solid SVG with d3 scales */
import * as d3 from 'd3';
import { createEffect, createMemo, createSignal, For, on, onMount, Show } from 'solid-js';
import { Legend } from '../components/Legend';
import { ScopeChips } from '../components/ScopeChips';
import { hideTip, showTip } from '../components/Tooltip';
import { BR, DATA, P, PHOTO } from '../data';
import { texts } from '../i18n';
import { openDoc, openPerson, scope, setScope, view } from '../router';
import { focus, focusName, kinOf, kinSet } from '../state';
import type { Doc } from '../types';
import { lifespan, reduced, T } from '../util';
import { aliveIn, datedDocs, estimateBirths, eventDividers, lifeRows, type Row } from './timelineLayout';

// From top to bottom: eras (two rows of names, alternating so they do not overlap), documents stacked by year,
// axis and lives. The height of the documents depends on the year with most.
const ROW_H = 17, LEFT = 16, RIGHT = 24, BOTTOM = 10, DOCS_LABEL = 50, DOCS_TOP = DOCS_LABEL + 14;
const fmtYear = d3.format('d');

export function Timeline() {
  let wrap!: HTMLDivElement;
  let svg!: SVGSVGElement;
  const now = new Date().getFullYear();
  const est = estimateBirths();
  const [ready, setReady] = createSignal(false);
  onMount(() => setReady(true));
  const keep = createMemo(() => kinSet(scope()));

  const layout = createMemo(() => {
    if (!ready()) return null;
    const rows = lifeRows(est, keep(), now);
    const docs = datedDocs(keep());
    const stack = d3.rollup(docs, v => v, d => d.year!);
    const maxStack = d3.max([...stack.values()], v => v.length) ?? 0;
    const axisY = DOCS_TOP + Math.max(0, maxStack - 1) * 9 + 22;
    const top = axisY + 12;
    const width = Math.max(980, wrap.clientWidth);  // the width is measured each time the lives change
    const height = top + rows.length * ROW_H + BOTTOM;
    const x0 = Math.floor((d3.min([...rows.map(r => r.start), ...docs.map(d => d.year!)])! - 5) / 10) * 10;
    const x = d3.scaleLinear().domain([x0, now + 5]).range([LEFT, width - RIGHT]);
    const dots: { d: Doc; year: number; i: number }[] = [];
    stack.forEach((v, year) => v.forEach((d, i) => dots.push({ d, year, i })));
    const barW = (r: Row) => r.end ? Math.max(3, x(r.end) - x(r.start)) : 60;
    // The name goes after the bar, or before it if it does not fit
    const labelLeft = (r: Row) => x(r.start) + barW(r) + 150 > width;
    const events = DATA.events.filter(e => e.to > x0);
    return { rows, dots, axisY, top, width, height, x0, x, barW, labelLeft, events, dividers: eventDividers(events) };
  });

  // Who was alive in the year under the mouse
  const [cursor, setCursor] = createSignal<number | null>(null);
  const moveCursor = (e: MouseEvent) => {
    const L = layout()!;
    const year = Math.round(L.x.invert(d3.pointer(e, svg)[0]));
    setCursor(year < L.x0 || year > now ? null : year);
  };
  const aliveCount = createMemo(() => { const y = cursor(); return y == null ? 0 : layout()!.rows.filter(r => aliveIn(r, y)).length; });

  // When the view opens through the eyes of another person, it scrolls to their row
  let scrolledFor = '';
  createEffect(on([() => view() === 'timeline', focus, layout], ([active, id]) => {
    if (!active || !layout() || scrolledFor === id) return;
    scrolledFor = id;
    if (id !== DATA.main) svg.querySelector('.focus-row')?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }));

  const undatedFocus = () => { const f = P.get(focus())!; return !f.bornYear && !f.diedYear && !est.has(f.id); };
  const rowTip = (r: Row, e: MouseEvent) => {
    const k = kinOf(r.p.id);
    showTip({
      title: r.p.name,
      lines: [lifespan(r.p), ...(r.est ? [texts.timeline.estimated(r.start)] : []), ...(r.p.birthPlace ? [r.p.birthPlace] : [])],
      note: k ? texts.kin.of(k.label, focusName()) : undefined,
    }, e);
  };
  const fill = (r: Row) => r.est ? `url(#est-${r.p.branch})` : r.noBirth ? `url(#fadein-${r.p.branch})`
    : r.open ? `url(#fade-${r.p.branch})` : BR.get(r.p.branch)!.color;
  // d3.axisTop shifts the ticks half a pixel on normal screens, so the lines come out sharp
  const tickOffset = typeof devicePixelRatio === 'number' && devicePixelRatio > 1 ? 0 : .5;

  return (
    <>
      <div class="view-head">
        <h2>{texts.timeline.title}</h2>
        <p class="muted">{texts.timeline.intro}</p>
        <ScopeChips id="tl-filters" label={texts.scope.filterPeople} value={scope()} onChange={setScope} />
        <Show when={undatedFocus()}>
          <p class="tl-note">{texts.timeline.undated(P.get(focus())!.name)}</p>
        </Show>
      </div>
      <Legend id="legend-timeline" keys={layout()?.rows.map(r => r.p.branch) ?? []} />
      <div class="timeline-wrap" ref={wrap}>
        <svg id="timeline" role="img" aria-label={texts.timeline.label} ref={svg} width={layout()?.width} height={layout()?.height}
             onMouseMove={moveCursor} onMouseLeave={() => setCursor(null)}>
          <Show when={layout()}>{L => (
            <>
              {/* Eras: the band goes down from its name to the end */}
              <g>
                <For each={L().events}>{(ev, i) => (
                  <g class="event">
                    <rect x={L().x(ev.from)} width={L().x(ev.to) - L().x(ev.from)} y={18 + (i() % 2) * 13}
                          height={L().height - BOTTOM - 18 - (i() % 2) * 13} />
                    <text x={L().x((ev.from + ev.to) / 2)} y={14 + (i() % 2) * 13} text-anchor="middle">{ev.label}</text>
                  </g>
                )}</For>
                <For each={L().dividers}>{d => (
                  <line class="event-divider" x1={L().x(d.year)} x2={L().x(d.year)} y1={18 + d.row * 13}
                        y2={L().height - BOTTOM} />
                )}</For>
              </g>
              <g class="axis" transform={`translate(0,${L().axisY})`} fill="none" font-size="10" font-family="sans-serif" text-anchor="middle">
                <For each={L().x.ticks(L().width / 90)}>{t => (
                  <g class="tick" transform={`translate(${L().x(t) + tickOffset},0)`}>
                    <line stroke="currentColor" stroke-opacity={.5} y2={L().height - BOTTOM - L().axisY} />
                    <text fill="currentColor" y={-3}>{fmtYear(t)}</text>
                  </g>
                )}</For>
              </g>
              <g>
                <text x={LEFT} y={DOCS_LABEL} font-size="11" fill="#8a8278">{texts.timeline.documents}</text>
                <For each={L().dots}>{(dot, i) => (
                  <circle class="tl-pop" cx={L().x(dot.year)} cy={DOCS_TOP + dot.i * 9} r={4}
                          fill={dot.d.category === PHOTO ? '#a4683e' : '#5d564e'} stroke="#fff" style={{ cursor: 'pointer', 'animation-delay': `${T(300 + i() * 15)}ms` }}
                          onMouseMove={e => showTip({ title: dot.d.title, lines: [dot.d.date] }, e)} onMouseLeave={hideTip}
                          onClick={() => openDoc(dot.d.id)} />
                )}</For>
              </g>
              <defs>
                <For each={DATA.branches}>{b => (
                  <>
                    <linearGradient id={`fade-${b.key}`}>
                      <stop offset="0%" stop-color={b.color} /><stop offset="100%" stop-color={b.color} stop-opacity={0} />
                    </linearGradient>
                    {/* Hatching for the estimated years */}
                    <pattern id={`est-${b.key}`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width={6} height={6} fill={b.color} opacity={.12} />
                      <rect width={2.5} height={6} fill={b.color} opacity={.55} />
                    </pattern>
                    <linearGradient id={`fadein-${b.key}`}>
                      <stop offset="0%" stop-color={b.color} stop-opacity={0} /><stop offset="100%" stop-color={b.color} />
                    </linearGradient>
                  </>
                )}</For>
              </defs>
              <g>
                <For each={L().rows}>{(r, i) => (
                  <g transform={`translate(0,${L().top + i() * ROW_H})`}
                     classList={{ 'focus-row': r.p.id === focus(), dim: cursor() != null && !aliveIn(r, cursor()!) }}>
                    <Show when={r.p.id === focus()}><rect class="focus-band" x={0} y={0} width={L().width} height={ROW_H - 1} /></Show>
                    <rect class="bar tl-grow" x={L().x(r.start)} y={2} height={ROW_H - 5} rx={4} width={L().barW(r)} fill={fill(r)}
                          stroke={r.est ? BR.get(r.p.branch)!.color : undefined} stroke-dasharray={r.est ? '4 3' : undefined}
                          opacity={r.p.living && !r.est ? .75 : 1} style={{ 'animation-delay': `${T(i() * 12)}ms` }}
                          onMouseMove={e => rowTip(r, e)} onMouseLeave={hideTip} onClick={() => openPerson(r.p.id)} />
                    <text class={`row-label tl-fade${r.est ? ' est' : ''}`} x={L().labelLeft(r) ? L().x(r.start) - 6 : L().x(r.start) + L().barW(r) + 6}
                          text-anchor={L().labelLeft(r) ? 'end' : 'start'} y={ROW_H / 2 + 2} style={{ 'animation-delay': `${T(300 + i() * 12)}ms` }}>
                      {r.p.name}
                    </text>
                    {/* Weddings */}
                    <For each={r.p.marriages.filter(m => m.year)}>{m => (
                      <path class="marr" d={`M${L().x(m.year!)},${ROW_H / 2 - 5} l4,4 l-4,4 l-4,-4 z`} fill="#fff" stroke="#2b2622"
                            onMouseMove={e => showTip({ lines: [texts.timeline.marriage(P.get(m.spouse)?.name || ''), `${m.date} ${m.place}`] }, e)}
                            onMouseLeave={hideTip} />
                    )}</For>
                  </g>
                )}</For>
              </g>
              <Show when={cursor() != null}>
                <g class="cursor" transform={`translate(${L().x(cursor()!)},0)`}>
                  <line y1={L().top - 20} y2={L().height - BOTTOM} />
                  <text y={L().top - 24} text-anchor="middle">{`${cursor()} · ${texts.people(aliveCount())}`}</text>
                </g>
              </Show>
            </>
          )}</Show>
        </svg>
      </div>
    </>
  );
}
