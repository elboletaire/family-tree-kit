/* Image viewer */
import { createSignal } from 'solid-js';
import { listen } from '../events';
import { texts } from '../i18n';

export interface LightboxItem { src: string; caption: string }
const [state, setState] = createSignal<{ items: LightboxItem[]; index: number } | null>(null);

export const openLightbox = (items: LightboxItem[], index = 0): void => { setState({ items, index }); };
export const closeLightbox = (): void => { setState(null); };
export const lightboxOpen = (): boolean => state() !== null;

export function Lightbox() {
  const move = (step: number) => setState(s => s && { ...s, index: (s.index + s.items.length + step) % s.items.length });
  const item = () => state() && state()!.items[state()!.index];
  const caption = () => { const s = state(); return s ? `${s.items[s.index].caption}  (${s.index + 1}/${s.items.length})` : ''; };
  const several = () => (state()?.items.length ?? 0) > 1;
  listen(document, 'keydown', e => {
    if (!state() || !several()) return;
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
  });
  return (
    <div id="lightbox" class="lightbox" hidden={!state()} onClick={e => { if (e.target === e.currentTarget) closeLightbox(); }}>
      <button class="lightbox-close" aria-label={texts.close} onClick={closeLightbox}>×</button>
      <button class="lightbox-prev" aria-label={texts.lightbox.previous} hidden={!several()} onClick={() => move(-1)}>‹</button>
      <img alt="" src={item()?.src} />
      <button class="lightbox-next" aria-label={texts.lightbox.next} hidden={!several()} onClick={() => move(1)}>›</button>
      <p class="lightbox-caption">{caption()}</p>
    </div>
  );
}
