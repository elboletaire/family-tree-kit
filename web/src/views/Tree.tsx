/* TREE. family-chart draws and animates its own DOM: it is created when the view mounts and re-centered when the
   focused person changes (only while it is shown) */
import * as f3 from 'family-chart';
import { createEffect, on, onCleanup, onMount } from 'solid-js';
import { color, DATA, P } from '../data';
import { texts } from '../i18n';
import { go, view } from '../router';
import { focus } from '../state';
import type { Person } from '../types';
import { esc, initials, T, years } from '../util';

/** What each card carries in `data` */
interface CardData {
  gender: 'M' | 'F';
  name: string;
  years: string;
  photo?: string | null;
  conf?: Person['conf'];
  init: string;
  color?: string;
  review?: Person['review'];
  phantom?: boolean;
}
interface Card extends f3.Datum { data: CardData }

function chartData(): Card[] {
  const data: Card[] = DATA.people.map(p => ({
    id: p.id,
    data: { gender: p.sex === 'F' ? 'F' : 'M', name: p.name, years: years(p), photo: p.photo, conf: p.conf, init: initials(p), color: color(p.id), review: p.review },
    rels: { parents: [p.father, p.mother].filter((x): x is string => Boolean(x)), spouses: [...p.spouses], children: [...p.children] },
  }));
  const byId = new Map(data.map(d => [d.id, d]));
  // Siblings without known parents hang from an «unknown parents» node
  const done = new Set<string>();
  DATA.people.forEach(p => {
    if (p.father || p.mother || !p.siblings.length || done.has(p.id)) return;
    const group = [p.id, ...p.siblings]; group.forEach(x => done.add(x));
    const pid = '_parents-' + p.id;
    data.push({ id: pid, data: { gender: 'M', name: texts.tree.unknownParents, years: '', phantom: true, init: '?' },
                rels: { parents: [], spouses: [], children: group } });
    group.forEach(x => { byId.get(x)!.rels.parents = [pid]; });
  });
  return data;
}

export function Tree() {
  let el!: HTMLDivElement;
  let chart: f3.Chart | undefined;
  let main = '';

  onMount(() => {
    chart = f3.createChart(el, chartData())
      .setTransitionTime(T(700)).setCardXSpacing(250).setCardYSpacing(140)
      .setShowSiblingsOfMain(true).setSingleParentEmptyCard(false);
    // family-chart asks for the content of each card as HTML
    chart.setCardHtml().setStyle('rect').setMiniTree(true)
      .setCardDisplay([(d: Card) => {
        const x = d.data;
        const pic = x.photo ? `<img class="tc-photo" src="${x.photo}" alt="">` : `<span class="tc-initials">${esc(x.init)}</span>`;
        const rev = x.review ? `<span class="tc-review ${x.review}" title="${esc(texts.review.person[x.review])}"></span>` : '';
        return `${pic}<span><span class="tc-name">${esc(x.name)}</span><br><span class="tc-dates">${esc(x.years)}</span></span>${rev}`;
      }])
      .setOnCardUpdate(function (this: HTMLElement, d: f3.TreeDatum) {
        const card = this.querySelector<HTMLElement>('.card')!; const x = (d.data as Card).data;
        if (x.conf) card.classList.add('conf-' + x.conf);
        if (x.phantom) card.classList.add('phantom');
        else card.querySelector<HTMLElement>('.card-inner')!.style.background = x.color!;
      })
      .setOnCardClick((_e: MouseEvent, d: f3.TreeDatum) => {
        if ((d.data as Card).data.phantom) return;
        go('p:' + d.data.id, { view: 'tree', id: d.data.id });
      });
    main = focus();
    chart.updateMainId(main);
    chart.updateTree({ initial: true });
    chart.updateTree({ tree_position: 'main_to_middle', scale: .9, transition_time: 0 });
    onCleanup(() => { chart = undefined; el.replaceChildren(); });
  });

  createEffect(on([() => view() === 'tree', focus], ([active, id]) => {
    if (!active || !chart || id === main || !P.has(id)) return;
    main = id;
    chart.updateMainId(id);
    chart.updateTree({ initial: false, tree_position: 'main_to_middle', scale: .9 });
  }, { defer: true }));

  return (
    <>
      <div class="view-head">
        <h2>{texts.tree.title}</h2>
        <p class="muted">{texts.tree.intro}</p>
      </div>
      <div id="FamilyChart" class="f3 tree-canvas" ref={el} />
    </>
  );
}
