/* Side panel with the cards. What it shows comes from the route's panel; when closing, it keeps the last card
   while it slides out */
import { createEffect, createMemo, Match, on, Switch } from 'solid-js';
import { texts } from '../i18n';
import { DocPanel } from '../panels/DocPanel';
import { PersonPanel } from '../panels/PersonPanel';
import { ResearchPanel } from '../panels/ResearchPanel';
import { canGoBack, closePanel, panel } from '../router';

export function Drawer() {
  let el!: HTMLElement;
  const shown = createMemo<string | null>(prev => panel() ?? prev, null);
  const kind = () => shown()?.split(':')[0];
  const key = () => shown()?.slice(2) ?? '';
  // Each new card starts at the top
  createEffect(on(panel, p => { if (p) el.scrollTop = 0; }, { defer: true }));
  // The panel starts below the top bar (--topbar-h, which Topbar measures)
  return (
    <aside id="drawer" class="drawer" classList={{ open: Boolean(panel()) }} aria-hidden={!panel()} ref={el}>
      <button class="drawer-back" id="drawer-back" aria-label={texts.drawer.back} title={texts.drawer.backTitle} hidden={!canGoBack()}
              onClick={() => history.back()}>←</button>
      <button class="drawer-close" id="drawer-close" aria-label={texts.close} onClick={closePanel}>×</button>
      <div id="drawer-body" class="drawer-body">
        <Switch>
          <Match when={kind() === 'p' && key()} keyed>{id => <PersonPanel id={id} />}</Match>
          <Match when={kind() === 'd' && key()} keyed>{id => <DocPanel id={id} />}</Match>
          <Match when={kind() === 'r' && key()} keyed>{name => <ResearchPanel name={name} />}</Match>
        </Switch>
      </div>
    </aside>
  );
}
