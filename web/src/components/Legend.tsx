/* Color legend of the branches: all of them, or only those in `keys` */
import { createMemo, For } from 'solid-js';
import { DATA } from '../data';

export function Legend(props: { id: string; keys?: string[] }) {
  const branches = createMemo(() => {
    const used = new Set(props.keys ?? DATA.people.map(p => p.branch));
    return DATA.branches.filter(b => used.has(b.key));
  });
  return (
    <div class="legend" id={props.id}>
      <For each={branches()}>{b => <span><i style={{ background: b.color }} />{b.label}</span>}</For>
    </div>
  );
}
