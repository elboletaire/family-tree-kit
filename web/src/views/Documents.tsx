/* DOCUMENTS */
import * as d3 from 'd3';
import { createMemo, createSignal, For } from 'solid-js';
import { DocCard } from '../components/DocCard';
import { ScopeChips } from '../components/ScopeChips';
import { CATEGORIES, catLabel, DATA, pendingDocs, REVIEW_PENDING, STATUS_FILTERS } from '../data';
import { texts } from '../i18n';
import { scope, setScope } from '../router';
import { kinSet } from '../state';

export function Documents() {
  const counts = d3.rollup(DATA.docs, v => v.length, d => d.category);
  const statuses = d3.rollup(DATA.docs, v => v.length, d => d.status);
  const unreferenced = DATA.docs.filter(d => !d.people.length).length;
  const [filter, setFilter] = createSignal('all');
  const filters: [string, string, string?][] = [
    ['all', texts.documents.all(DATA.docs.length)],
    ...CATEGORIES.filter(c => counts.has(c)).map(c => [c, texts.documents.category(catLabel(c), counts.get(c)!)] as [string, string]),
    ...STATUS_FILTERS.filter(s => statuses.has(s)).map(s =>
      [`status:${s}`, texts.documents.category(texts.documents.status[s], statuses.get(s)!)] as [string, string]),
    ...(pendingDocs.length ? [['review', texts.documents.pending(pendingDocs.length), 'chip-review'] as [string, string, string]] : []),
    ...(unreferenced ? [['unreferenced', texts.documents.unreferenced(unreferenced)] as [string, string]] : []),
  ];
  const docs = createMemo(() => {
    const keep = kinSet(scope()), f = filter();
    return DATA.docs.filter(d => f === 'all' || d.category === f || (f === 'review' && d.review === REVIEW_PENDING)
      || f === `status:${d.status}` || (f === 'unreferenced' && !d.people.length))
      // Nobody cites the unreferenced ones, so no family filter can keep them
      .filter(d => !keep || f === 'unreferenced' || d.people.some(x => keep.has(x)))
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.id.localeCompare(b.id));
  });
  return (
    <>
      <div class="view-head">
        <h2>{texts.documents.title}</h2>
        <ScopeChips id="doc-scope" label={texts.documents.whose} value={scope()} onChange={setScope} />
        <div class="filters" id="doc-filters" role="toolbar" aria-label={texts.documents.filter}>
          <For each={filters}>{([key, label, cls]) => (
            <button class={cls ? `chip ${cls}` : 'chip'} data-f={key} aria-pressed={filter() === key} onClick={() => setFilter(key)}>{label}</button>
          )}</For>
        </div>
      </div>
      <div class="doc-grid" id="doc-grid">
        <For each={docs()}>{(d, i) => <DocCard doc={d} index={i()} />}</For>
      </div>
    </>
  );
}
