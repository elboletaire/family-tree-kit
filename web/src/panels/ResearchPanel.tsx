/* Research documents (inconsistencies, pending lines, revision), with the family selector */
import { createMemo, For, Show } from 'solid-js';
import { Html } from '../components/Html';
import { DATA } from '../data';
import { family, familyCount, offeredFamilies, researchParts, sectionVisible, setFamily, shownFamily } from '../family';
import { texts } from '../i18n';
import type { ResearchKey } from '../types';

export function ResearchPanel(props: { name: string }) {
  const parts = researchParts(DATA.research[props.name as ResearchKey] || texts.unavailable);
  const split = parts.some(p => p.family);
  // Only the families with a section in this document; if the chosen one has none, everything is shown
  const offered = offeredFamilies(parts);
  const shown = createMemo(() => shownFamily(offered, family()));
  const pick = (f: string, e: MouseEvent) => {
    setFamily(f);
    (e.currentTarget as Element).closest('.drawer')?.scrollTo({ top: 0 });
  };
  return (
    <>
      <Show when={split}>
        <div class="family-switch" role="group" aria-label={texts.research.whichFamily}>
          <For each={offered}>{([key, label]) => {
            const n = familyCount(parts, key);
            return (
              <button type="button" data-family-show={key} aria-pressed={shown() === key} onClick={e => pick(key, e)}>
                {label}<span class="n">{n ? ` · ${n}` : ''}</span>
              </button>
            );
          }}</For>
        </div>
      </Show>
      <div class={`prose research-${props.name}`}>
        <For each={parts}>{part => part.family
          ? <Html tag="section" html={part.html} data-family={part.family} data-count={String(part.count)}
                  hidden={!sectionVisible(part.family, shown())} />
          : <Html tag="div" html={part.html} style={{ display: 'contents' }} />}
        </For>
      </div>
    </>
  );
}
