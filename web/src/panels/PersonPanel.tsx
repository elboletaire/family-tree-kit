/* Card of a person */
import { createMemo, For, Show, type JSX } from 'solid-js';
import { DocCard } from '../components/DocCard';
import { Html } from '../components/Html';
import { openLightbox } from '../components/Lightbox';
import { PeopleChips } from '../components/PersonChip';
import { ReviewFlag } from '../components/ReviewFlag';
import { branchOf, DATA, P, REVISION, S } from '../data';
import { texts } from '../i18n';
import { stepSiblings } from '../kinship';
import { openResearch, view, viewHash, type ViewName } from '../router';
import { focus, focusName, kinOf } from '../state';
import type { Doc, Person } from '../types';
import { fmtDate, initials, lifespan } from '../util';
import { ChangeText } from '../components/ChangeText';
import { personHistory } from '../views/newsLayout';

/** Siblings (by father, by mother or without known parents) and step-siblings (see `stepSiblings`) */
export function siblingsOf(p: Person): { siblings: string[]; step: string[] } {
  const parents = [p.father, p.mother].filter((x): x is string => Boolean(x));
  const sibs = new Set(p.siblings);
  parents.forEach(x => P.get(x)!.children.forEach(c => sibs.add(c)));
  sibs.delete(p.id);
  const step = new Set<string>();
  parents.forEach(x => P.get(x)!.spouses.filter(s => !parents.includes(s))
    .forEach(s => P.get(s)!.children.forEach(c => { if (!sibs.has(c) && stepSiblings(p.id, c)) step.add(c); })));
  return { siblings: [...sibs], step: [...step] };
}

/** Buttons to see the family through this person's eyes, in each view (the home one shows the constellation) */
const EYES: [ViewName, string][] = [['tree', texts.views.tree], ['fan', texts.views.fan], ['timeline', texts.views.timeline], ['voyage', texts.views.voyage],
                                    ['map', texts.views.map], ['documents', texts.views.documents], ['home', texts.person.constellation]];

function Row(props: { label: string; children: JSX.Element; when: unknown }) {
  return <Show when={props.when}><tr><th>{props.label}</th><td>{props.children}</td></tr></Show>;
}

export function PersonPanel(props: { id: string }) {
  const p = P.get(props.id)!;
  const b = branchOf(p);
  const parents = [p.father, p.mother].filter((x): x is string => Boolean(x));
  const { siblings, step } = siblingsOf(p);
  const marriages = p.marriages.filter(m => P.has(m.spouse));
  const conf = p.conf ? texts.person.confidence[p.conf] : '';
  const docs = p.sources.map(s => S.get(s)).filter((d): d is Doc => Boolean(d));
  const isFocus = () => props.id === focus();
  const kin = createMemo(() => kinOf(props.id));
  const changes = personHistory(DATA.history, props.id);
  const born = [p.born, p.birthPlace].filter(Boolean).join(' · ');
  const died = [p.died, p.deathPlace].filter(Boolean).join(' · ');
  return (
    <>
      <div class="p-head">
        <Show when={p.photo} fallback={<div class="p-avatar" style={{ background: b.color }}>{initials(p)}</div>}>
          {photo => <img class="p-photo" src={photo()} alt={p.name} onClick={() => openLightbox([{ src: photo(), caption: p.name }])} />}
        </Show>
        <div>
          <h2>{p.name}</h2>
          <p class="dates">{lifespan(p)}<Show when={p.living}>{' '}<span class="badge">{texts.person.alive}</span></Show></p>
          <span class="badge" style={{ background: b.color, color: '#fff' }}>{b.label}</span>
          <Show when={p.review}>{review => (
            <a href="#" class="review-link" data-research={REVISION} title={texts.review.personTitle[review() as 'new' | 'partial']}
               onClick={e => { e.preventDefault(); openResearch(REVISION); }}>
              <ReviewFlag text={texts.review.person[review() as 'new' | 'partial']} />
            </a>
          )}</Show>
          <Show when={!isFocus()}>
            <p class="kin"><span class="muted">{texts.person.for(focusName())}</span>{' '}
              <Show when={kin()} fallback={<span class="muted">{texts.person.noKin}</span>}>{k => <>{k().label}</>}</Show>
            </p>
          </Show>
        </div>
      </div>
      <p class="eyes-title">{isFocus() ? texts.person.eyesTitle.focus : texts.person.eyesTitle.other}</p>
      <div class="p-actions">
        <For each={EYES}>{([v, label]) => (
          <a class="btn" classList={{ primary: v === view() }} href={viewHash(v, props.id, v === 'tree' ? 'p:' + props.id : null)} data-eyes>{label}</a>
        )}</For>
      </div>
      <table class="facts">
        <tbody>
          <Row label={texts.person.birth} when={born}>{born}</Row>
          <Row label={texts.person.death} when={died}>{died}</Row>
          <Row label={texts.person.occupation} when={p.occupation}>{p.occupation}</Row>
          <Row label={texts.person.marriage} when={marriages.length}>
            <For each={marriages}>{(m, i) => (
              <>{i() > 0 && <br />}{texts.person.marriedTo(P.get(m.spouse)!.name)}{[m.date, m.place].filter(Boolean).join(', ')}</>
            )}</For>
          </Row>
        </tbody>
      </table>
      <Show when={parents.length}>
        <h3>{texts.person.parents}</h3><PeopleChips ids={parents} />
        <Show when={conf}><p class="muted" style={{ 'font-size': '.82rem', margin: '.3rem 0 0' }}>{texts.person.parentage(conf)}</p></Show>
      </Show>
      <Show when={p.spouses.length}><h3>{texts.person.spouses}</h3><PeopleChips ids={p.spouses} /></Show>
      <Show when={p.children.length}><h3>{texts.person.children}</h3><PeopleChips ids={p.children} /></Show>
      <Show when={siblings.length}><h3>{texts.person.siblings}</h3><PeopleChips ids={siblings} /></Show>
      <Show when={step.length}><h3>{texts.person.stepSiblings}</h3><PeopleChips ids={step} /></Show>
      <Show when={p.html}><Html class="prose" html={p.html} /></Show>
      <Show when={docs.length}>
        <h3>{texts.person.documents}</h3>
        <div class="mini-docs"><For each={docs}>{(d, i) => <DocCard doc={d} index={i()} />}</For></div>
      </Show>
      <Show when={changes.length}>
        <h3>{texts.person.history}</h3>
        <ul class="p-history">
          <For each={changes}>{c => (
            <li>
              <time datetime={c.date}>{fmtDate(c.date)}</time>{' '}
              <Show when={c.added}>{c.first ? texts.person.historyFirst : texts.person.historyAdded}</Show>
              <Show when={c.renamedFrom}>{from => <>{texts.person.renamedFrom(from())}{c.fields.length || c.sources.length ? '. ' : ''}</>}</Show>
              <ChangeText fields={c.fields} sources={c.sources.filter(s => S.has(s))} />
            </li>
          )}</For>
        </ul>
        <p class="p-history-more"><a href={viewHash('news', props.id)}>{texts.person.historyMore} →</a></p>
      </Show>
    </>
  );
}
