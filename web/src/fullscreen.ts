/* Full screen of a view: the browser's if it exists (the whole page, so that the card and the tooltip show on top);
   otherwise (Safari on iPhone), the view takes the whole window. `bodyClass` goes on <body> while it lasts, and the
   view's CSS does the rest */
import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import { lightboxOpen } from './components/Lightbox';
import { listen } from './events';
import { panel } from './router';

type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
const inFullscreen = () => { const doc = document as FsDocument; return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement); };

export function createFullscreen(bodyClass: string, onChange?: () => void): [Accessor<boolean>, (on: boolean) => void] {
  const [full, setFullSignal] = createSignal(false);
  createEffect(() => document.body.classList.toggle(bodyClass, full()));
  onCleanup(() => document.body.classList.remove(bodyClass));
  function setFull(on: boolean, fromBrowser?: boolean) {
    setFullSignal(on);
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const doc = document as FsDocument;
    if (on && !inFullscreen()) (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root)?.catch?.(() => {});
    if (!on && inFullscreen() && !fromBrowser) (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    onChange?.();
  }
  // When leaving the browser's full screen (Esc, system gesture), the view is undone too
  const fsChange = () => { if (!inFullscreen() && full()) setFull(false, true); };
  listen(document, 'fullscreenchange', fsChange);
  listen(document, 'webkitfullscreenchange', fsChange);
  // In the simulated full screen (iPhone), Esc closes it if there is no open card to close first
  listen(document, 'keydown', e => {
    if (e.key === 'Escape' && full() && !panel() && !lightboxOpen()) setFull(false);
  }, true);
  return [full, on => setFull(on)];
}
