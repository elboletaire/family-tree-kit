/* Page of a view: only the active one is shown. Its content is created the first time it opens and then kept
   (the tree, the fan or the voyage stay where they were left) */
import { createMemo, Show, type JSX } from 'solid-js';
import { view, type ViewName } from '../router';

export function Page(props: { name: ViewName; children: JSX.Element }) {
  const active = () => view() === props.name;
  const seen = createMemo(prev => prev || active(), false);
  return (
    <section id={`view-${props.name}`} class="page" classList={{ active: active() }} data-view={props.name}>
      <Show when={seen()}>{props.children}</Show>
    </section>
  );
}
