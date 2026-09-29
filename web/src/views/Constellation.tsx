/* Constellation: all the people and their relations, with a d3 force simulation. Solid draws the dots and the
   lines; d3 computes the positions and handles zoom and drag */
import * as d3 from 'd3';
import { createSignal, For, onCleanup, onMount } from 'solid-js';
import { hideTip, showTip } from '../components/Tooltip';
import { color, DATA } from '../data';
import { texts } from '../i18n';
import type { KinKind } from '../kinship';
import { openPerson } from '../router';
import { focus, focusName, kin, kinOf } from '../state';
import type { Person } from '../types';
import { reduced, years } from '../util';

interface Node extends d3.SimulationNodeDatum { id: string; p: Person; r: number; delay: number }
interface Link extends d3.SimulationLinkDatum<Node> { source: string | Node; target: string | Node; kind: 'parent' | 'spouse' | 'sibling' }
const idOf = (n: string | Node): string => typeof n === 'string' ? n : n.id;
const nodeOf = (n: string | Node): Node => n as Node;  // once the simulation starts, the ends are nodes

// Opacity by kinship with the focused person: their direct line stands out and the rest fades
const KIND_OPACITY: Record<KinKind, number> = { self: 1, direct: 1, blood: .8, inLaw: .45 };

export function Constellation() {
  let svg!: SVGSVGElement;
  const nodes: Node[] = DATA.people.map(p => ({
    id: p.id, p, x: (Math.random() - .5) * 20, y: (Math.random() - .5) * 20,
    r: p.photo ? 7.5 : 5 + Math.min(p.sources.length, 4) * .6, delay: Math.random() * 900,
  }));
  const links: Link[] = [];
  DATA.people.forEach(p => {
    [p.father, p.mother].filter((x): x is string => Boolean(x)).forEach(par => links.push({ source: par, target: p.id, kind: 'parent' }));
    p.spouses.filter(s => s > p.id).forEach(s => links.push({ source: p.id, target: s, kind: 'spouse' }));
    if (!p.father && !p.mother) p.siblings.filter(s => s > p.id).forEach(s => links.push({ source: p.id, target: s, kind: 'sibling' }));
  });
  const neighbours = new Map(nodes.map(n => [n.id, new Set([n.id])]));
  links.forEach(l => { neighbours.get(idOf(l.source))!.add(idOf(l.target)); neighbours.get(idOf(l.target))!.add(idOf(l.source)); });

  const [viewBox, setViewBox] = createSignal<string>();
  const [transform, setTransform] = createSignal<string>();
  // Each step of the simulation: the positions are in the nodes, this signal tells they have changed
  const [tick, setTick] = createSignal(undefined, { equals: false });
  const [hover, setHover] = createSignal<string | null>(null);

  const kinOpacity = (id: string) => KIND_OPACITY[kin().get(id)?.kind as KinKind] ?? .2;
  const nodeOpacity = (id: string) => { const h = hover(); return h ? (neighbours.get(h)!.has(id) ? 1 : .15) : kinOpacity(id); };
  const linkOpacity = (l: Link) => {
    const h = hover();
    if (h) return idOf(l.source) === h || idOf(l.target) === h ? 1 : .08;
    return Math.min(kinOpacity(idOf(l.source)), kinOpacity(idOf(l.target)));
  };
  const labelShown = (id: string) => { const h = hover(); return h ? neighbours.get(h)!.has(id) : id === focus(); };
  const tip = (n: Node, ev: MouseEvent) => {
    const k = kinOf(n.id);
    showTip({ title: n.p.name, lines: [years(n.p)], note: k ? texts.kin.of(k.label, focusName()) : undefined }, ev);
  };

  let sim: d3.Simulation<Node, Link>;
  const drag = d3.drag<SVGGElement, Node>()
    .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(.2).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
    .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = d.fy = null; });

  onMount(() => {
    const { width, height } = svg.getBoundingClientRect();
    setViewBox([-width / 2, -height / 2, width, height].join(','));
    d3.select(svg).call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([.3, 4]).on('zoom', e => setTransform(e.transform.toString())));
    sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id)
        .distance(l => l.kind === 'spouse' ? 14 : 26).strength(l => l.kind === 'spouse' ? 1 : .7))
      .force('charge', d3.forceManyBody().strength(-38))
      .force('y', d3.forceY<Node>(d => (d.p.gen - 4) * 48).strength(.12))
      .force('x', d3.forceX(0).strength(.03))
      .force('collide', d3.forceCollide(8))
      .alphaDecay(.02)
      .on('tick', () => setTick());
    if (reduced) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); setTick(); }
    onCleanup(() => sim.stop());
  });

  return (
    <figure class="constellation-wrap">
      <svg id="constellation" role="img" aria-label={texts.home.constellation.label} ref={svg} viewBox={viewBox()}
           classList={{ hovering: Boolean(hover()) }}>
        <g transform={transform()}>
          <g stroke-linecap="round">
            <For each={links}>{l => (
              <line class="cn-link" stroke={l.kind === 'spouse' ? '#c9bfae' : '#d8d0c3'} stroke-width={l.kind === 'spouse' ? 1.2 : 1.4}
                    stroke-dasharray={l.kind === 'parent' ? undefined : '3 3'} style={{ opacity: linkOpacity(l) }}
                    x1={(tick(), nodeOf(l.source).x)} y1={(tick(), nodeOf(l.source).y)}
                    x2={(tick(), nodeOf(l.target).x)} y2={(tick(), nodeOf(l.target).y)} />
            )}</For>
          </g>
          <g>
            <For each={nodes}>{n => (
              <g class="cn-node" classList={{ focus: n.id === focus() }} style={{ cursor: 'pointer', opacity: nodeOpacity(n.id) }}
                 transform={(tick(), `translate(${n.x},${n.y})`)}
                 ref={el => d3.select(el).datum(n).call(drag)}
                 onMouseEnter={ev => { setHover(n.id); tip(n, ev); }} onMouseMove={ev => tip(n, ev)}
                 onMouseLeave={() => { setHover(null); hideTip(); }} onClick={() => openPerson(n.id)}>
                <circle class="cn-dot" r={n.r} fill={color(n.id)} stroke={n.id === focus() ? '#2b2622' : '#fff'}
                        stroke-width={n.id === focus() ? 3 : 1.5} style={{ 'animation-delay': `${n.delay}ms` }} />
                <text x={9} y={3.5} font-size="10" fill="#5d564e" pointer-events="none" opacity={labelShown(n.id) ? 1 : 0}
                      font-weight={n.id === focus() ? "600" : undefined}>{n.p.given || n.p.surnames}</text>
              </g>
            )}</For>
          </g>
        </g>
      </svg>
      <figcaption>{texts.home.constellation.caption}</figcaption>
    </figure>
  );
}
