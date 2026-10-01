/* NOVEDADES: what changed in the tree, day by day (DATA.history, from the Git history of the data) */
import { createMemo, createSignal, For, Show, type JSX } from 'solid-js';
import { ChangeText, DocLink } from '../components/ChangeText';
import { PersonChip } from '../components/PersonChip';
import { DATA, P, S } from '../data';
import { families, family, setFamily, shownFamily } from '../family';
import { texts } from '../i18n';
import { openResearch } from '../router';
import type { HistoryEntry } from '../types';
import { fmtDate } from '../util';
import { daySummary, familyHistory, type FamilyOf, knownHistory, newsFamilies, splitChanges } from './newsLayout';

/** Items shown before «Ver N más» */
const SHOWN = 12;

/** A list that shows its first SHOWN items and a button for the rest */
function Collapsed<T>(props: { items: T[]; class: string; children: (item: T) => JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  const items = () => open() ? props.items : props.items.slice(0, SHOWN);
  return (
    <>
      <ul class={props.class}><For each={items()}>{item => <li>{props.children(item)}</li>}</For></ul>
      <Show when={props.items.length > SHOWN}>
        <button class="chip news-more" aria-expanded={open()} onClick={() => setOpen(!open())}>
          {open() ? texts.news.less : texts.news.more(props.items.length - SHOWN)}
        </button>
      </Show>
    </>
  );
}

function Block(props: { title: string; when: unknown; children: JSX.Element }) {
  return <Show when={props.when}><h4>{props.title}</h4>{props.children}</Show>;
}

function Day(props: { entry: HistoryEntry }) {
  const e = props.entry;
  const s = daySummary(e);
  const { facts, texts: revised } = splitChanges(e.peopleChanged);
  const opened = e.research.filter(r => !r.resolved), resolved = e.research.filter(r => r.resolved);
  return (
    <article class="news-day card-panel" data-date={e.date}>
      <header>
        <h3>{fmtDate(e.date)}<Show when={e.first}><span class="badge">{texts.news.first}</span></Show></h3>
        <p class="muted">{texts.news.summary(s.docs, s.people, s.reviewed, s.changed)}</p>
      </header>
      <Block title={texts.news.docsAdded} when={e.docsAdded.length}>
        <Collapsed items={e.docsAdded} class="news-list">{id => <DocLink id={id} />}</Collapsed>
      </Block>
      <Block title={texts.news.docsReviewed} when={e.docsReviewed.length}>
        <Collapsed items={e.docsReviewed} class="news-list">{id => <DocLink id={id} />}</Collapsed>
      </Block>
      <Block title={texts.news.peopleAdded} when={e.peopleAdded.length}>
        <Collapsed items={e.peopleAdded} class="news-chips">{id => <PersonChip id={id} />}</Collapsed>
      </Block>
      <Block title={texts.news.peopleChanged} when={facts.length}>
        <Collapsed items={facts} class="news-list">{c => (
          <><PersonChip id={c.id} /> <span class="news-what"><ChangeText fields={c.fields} sources={c.sources} /></span></>
        )}</Collapsed>
      </Block>
      <Block title={texts.news.peopleRenamed} when={e.peopleRenamed.length}>
        <Collapsed items={e.peopleRenamed} class="news-list">{r => (
          <><PersonChip id={r.to} /> <span class="news-what">{texts.news.renamedFrom(r.from)}</span></>
        )}</Collapsed>
      </Block>
      <Block title={texts.news.docsUpdated} when={e.docsUpdated.length}>
        <Collapsed items={e.docsUpdated} class="news-list">{id => <DocLink id={id} />}</Collapsed>
      </Block>
      <Block title={texts.news.peopleTexts} when={revised.length}>
        <Collapsed items={revised} class="news-chips">{c => <PersonChip id={c.id} />}</Collapsed>
      </Block>
      <Block title={texts.news.peopleRemoved} when={e.peopleRemoved.length}>
        <p class="news-removed">{e.peopleRemoved.join(', ')}</p>
      </Block>
      <Block title={texts.news.docsRemoved} when={e.docsRemoved.length}>
        <p class="news-removed">{e.docsRemoved.join(' · ')}</p>
      </Block>
      <Block title={`${texts.news.research}: ${texts.news.researchCount(opened.length, resolved.length)}`} when={e.research.length}>
        <Collapsed items={[...opened, ...resolved]} class="news-list news-research">{r => (
          <span>
            <span class="badge" classList={{ done: r.resolved }}>{r.resolved ? texts.news.researchItem.resolved : texts.news.researchItem.opened}</span>{' '}
            <a href="#" data-research={r.note} onClick={ev => { ev.preventDefault(); openResearch(r.note); }}>
              {texts.news.notes[r.note]}</a>{`: ${r.text}`}
          </span>
        )}</Collapsed>
      </Block>
    </article>
  );
}

export function News() {
  const known = knownHistory(DATA.history, id => P.has(id), id => S.has(id));
  const of: FamilyOf = { person: id => P.get(id)?.families ?? [], doc: id => S.get(id)?.family };
  // The same choice of family as the research documents; the families the history does not name are not offered
  const offered = newsFamilies(known, families(), of);
  const shown = createMemo(() => shownFamily(offered.map(f => [f.key, f.label]), family()));
  const days = createMemo(() => familyHistory(known, shown(), of));
  return (
    <>
      <div class="view-head">
        <h2>{texts.news.title}</h2>
        <p class="muted">{texts.news.intro}</p>
        <Show when={known.length && offered.length > 1}>
          <div class="family-switch" role="group" aria-label={texts.research.whichFamily}>
            <For each={offered}>{f => (
              <button type="button" data-family-show={f.key} aria-pressed={shown() === f.key} onClick={() => setFamily(f.key)}>
                {f.label}
              </button>
            )}</For>
          </div>
        </Show>
      </div>
      <div class="news" id="news">
        <For each={days()} fallback={<p class="muted">{known.length ? texts.news.emptyFamily : texts.news.empty}</p>}>
          {e => <Day entry={e} />}
        </For>
      </div>
    </>
  );
}
