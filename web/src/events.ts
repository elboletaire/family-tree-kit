/* `window` or `document` listeners that belong to a component: they are removed when the component goes away */
import { onCleanup } from 'solid-js';

export function listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions): void;
export function listen<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (e: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions): void;
export function listen(target: EventTarget, type: string, fn: (e: Event) => void, options?: boolean | AddEventListenerOptions): void;
export function listen(target: EventTarget, type: string, fn: (e: Event) => void, options?: boolean | AddEventListenerOptions): void {
  target.addEventListener(type, fn, options);
  onCleanup(() => target.removeEventListener(type, fn, options));
}
