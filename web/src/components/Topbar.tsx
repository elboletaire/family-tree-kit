/* Top bar: tabs of the views, focused person and search */
import { createEffect, For, onCleanup, onMount, Show } from 'solid-js';
import { DATA, P } from '../data';
import { texts } from '../i18n';
import { view, viewHash, VIEWS } from '../router';
import { hasLock } from '../session';
import { focus, focusName } from '../state';
import { LockButton } from './Lock';
import { PersonChip } from './PersonChip';
import { Search } from './Search';

export function Topbar() {
  let header!: HTMLElement;
  let tabs!: HTMLElement;
  // The side panel starts below the bar (--topbar-h), so that the focused person stays in sight
  onMount(() => {
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', header.offsetHeight + 'px'));
    ro.observe(header);
    onCleanup(() => ro.disconnect());
  });
  // On mobile the tabs scroll: the active one, into view
  createEffect(() => { view(); tabs.querySelector('a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  const main = () => P.get(DATA.main)!.name;
  return (
    <header class="topbar" ref={header}>
      <a class="brand" href={viewHash('home')}><span class="brand-mark" aria-hidden="true" />{texts.siteTitle}</a>
      <nav class="tabs" aria-label={texts.viewsNav} ref={tabs}>
        <For each={VIEWS}>{key => (
          <a href={viewHash(key, focus())} data-view={key} classList={{ active: view() === key }}>{texts.views[key]}</a>
        )}</For>
      </nav>
      <div class="focus" id="focus" aria-live="polite">
        <span class="focus-label">{texts.topbar.eyesOf}</span>
        <PersonChip id={focus()} label={focusName()} title={P.get(focus())!.name} />
        <Show when={focus() !== DATA.main}>
          <a class="focus-reset" href={viewHash(view(), DATA.main)} title={texts.topbar.backTo(main())} aria-label={texts.topbar.backTo(main())}>×</a>
        </Show>
      </div>
      <Search />
      <Show when={hasLock()}><LockButton /></Show>
    </header>
  );
}
