/* Tooltip that follows the mouse: a title, lines and, dimmed, a note */
import { createEffect, createSignal, For, Show } from 'solid-js';

export interface Tip { title?: string; lines?: string[]; note?: string; noteOpacity?: number }
const [tip, setTip] = createSignal<{ content: Tip; x: number; y: number } | null>(null);

export const showTip = (content: Tip, ev: { clientX: number; clientY: number }): void => { setTip({ content, x: ev.clientX, y: ev.clientY }); };
export const hideTip = (): void => { setTip(null); };

export function Tooltip() {
  let el!: HTMLDivElement;
  const [pos, setPos] = createSignal({ left: 0, top: 0 });
  // It is placed after rendering, when its size is known
  createEffect(() => {
    const t = tip();
    if (t) setPos({ left: Math.min(t.x + 14, innerWidth - el.offsetWidth - 8), top: Math.min(t.y + 14, innerHeight - el.offsetHeight - 8) });
  });
  const parts = () => {
    const c = tip()?.content;
    return c ? [...(c.title ? [{ text: c.title, bold: true }] : []), ...(c.lines ?? []).map(text => ({ text })),
                ...(c.note ? [{ text: c.note, opacity: c.noteOpacity ?? .75 }] : [])] as { text: string; bold?: boolean; opacity?: number }[] : [];
  };
  return (
    <div id="tooltip" class="tooltip" role="tooltip" ref={el} hidden={!tip()}
         style={{ left: `${pos().left}px`, top: `${pos().top}px` }}>
      <For each={parts()}>{(part, i) => (
        <>
          <Show when={i() > 0}><br /></Show>
          {part.bold ? <b>{part.text}</b> : part.opacity ? <span style={{ opacity: part.opacity }}>{part.text}</span> : part.text}
        </>
      )}</For>
    </div>
  );
}
