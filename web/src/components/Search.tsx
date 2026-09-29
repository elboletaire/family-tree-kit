/* Search of people and documents */
import { createMemo, createSignal, For, Show } from 'solid-js';
import { color, DATA } from '../data';
import { texts } from '../i18n';
import { go, openDoc, openPerson, view } from '../router';
import { norm, years } from '../util';

export interface Hit { kind: 'p' | 'd'; id: string; label: string; sub: string; key: string }

export const buildIndex = (): Hit[] => [
  ...DATA.people.map(p => ({ kind: 'p' as const, id: p.id, label: p.name, sub: years(p), key: norm(p.name) })),
  ...DATA.docs.map(d => ({ kind: 'd' as const, id: d.id, label: d.title, sub: d.id, key: norm(`${d.id} ${d.title}`) })),
];
/** Each word of the query has to appear; two letters are needed */
export function searchHits(index: Hit[], query: string): Hit[] {
  const q = norm(query.trim());
  return q.length < 2 ? [] : index.filter(h => q.split(/\s+/).every(w => h.key.includes(w))).slice(0, 12);
}

export function Search() {
  let input!: HTMLInputElement;
  const index = buildIndex();
  const [query, setQuery] = createSignal('');
  const [sel, setSel] = createSignal(0);
  const [open, setOpen] = createSignal(false);
  const hits = createMemo(() => searchHits(index, query()));
  function pick(h: Hit) {
    setQuery(''); input.blur();
    if (h.kind === 'd') return openDoc(h.id);
    // In the tree and the fan, the chosen person becomes the center
    if (view() === 'tree' || view() === 'fan') go('p:' + h.id, { id: h.id });
    else openPerson(h.id);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { setSel(Math.min(sel() + 1, hits().length - 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { setSel(Math.max(sel() - 1, 0)); e.preventDefault(); }
    if (e.key === 'Enter' && hits()[sel()]) pick(hits()[sel()]);
  }
  return (
    <div class="search">
      <input id="search" type="search" placeholder={texts.search.placeholder} autocomplete="off" aria-label={texts.search.label}
             ref={input} value={query()} onInput={e => { setQuery(e.currentTarget.value); setSel(0); setOpen(true); }}
             onKeyDown={key} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      <ul id="search-results" class="search-results" role="listbox" hidden={!open() || !hits().length}>
        <For each={hits()}>{(h, i) => (
          <li role="option" aria-selected={i() === sel()} onMouseDown={() => pick(h)}>
            <Show when={h.kind === 'p'} fallback="📄">
              <i style={{ width: '10px', height: '10px', 'border-radius': '50%', background: color(h.id) }} />
            </Show>
            {h.label}<small>{h.sub}</small>
          </li>
        )}</For>
      </ul>
    </div>
  );
}
