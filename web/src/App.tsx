/* The application: top bar, the views, the side panel with the cards, the image viewer and the tooltip. It is drawn
   again, whole, when the data change (the public version of the site opening the private data: session.ts) */
import { Show } from 'solid-js';
import { Drawer } from './components/Drawer';
import { closeLightbox, Lightbox, lightboxOpen } from './components/Lightbox';
import { LoginDialog } from './components/Lock';
import { Page } from './components/Page';
import { Tooltip } from './components/Tooltip';
import { Topbar } from './components/Topbar';
import { dataset } from './data';
import { listen } from './events';
import { closePanel, panel, useRouter } from './router';
import { texts } from './i18n';
import { closeDialog, dialog, resuming } from './session';
import { Documents } from './views/Documents';
import { Fan } from './views/Fan';
import { Home } from './views/Home';
import { MapView } from './views/Map';
import { Timeline } from './views/Timeline';
import { Tree } from './views/Tree';
import { Voyage } from './views/Voyage';

export function App() {
  return (
    <Show when={!resuming()} fallback={<p class="loading" role="status">{texts.session.loading}</p>}>
      <Show when={dataset()} keyed>{_data => <Site />}</Show>
    </Show>
  );
}

function Site() {
  useRouter();
  // Escape closes the password dialog, the viewer or, if none is open, the card
  listen(document, 'keydown', e => {
    if (e.key !== 'Escape') return;
    if (dialog()) closeDialog(); else if (lightboxOpen()) closeLightbox(); else if (panel()) closePanel();
  });
  return (
    <>
      <Topbar />
      <main>
        <Page name="home"><Home /></Page>
        <Page name="tree"><Tree /></Page>
        <Page name="fan"><Fan /></Page>
        <Page name="timeline"><Timeline /></Page>
        <Page name="voyage"><Voyage /></Page>
        <Page name="map"><MapView /></Page>
        <Page name="documents"><Documents /></Page>
      </main>
      <Drawer />
      <Lightbox />
      <Tooltip />
      <LoginDialog />
    </>
  );
}
