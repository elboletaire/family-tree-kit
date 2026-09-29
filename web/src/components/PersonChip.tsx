/* Chip of a person: their portrait (or the color of their branch) and their name; clicking it opens their card */
import { For, Show } from 'solid-js';
import { color, P } from '../data';
import { openPerson } from '../router';

export function PersonChip(props: { id: string; label?: string; title?: string }) {
  return (
    <Show when={P.get(props.id)}>{p => (
      <a class="pchip" href="#" data-person={props.id} title={props.title}
         onClick={e => { e.preventDefault(); openPerson(props.id); }}>
        <i style={p().photo ? { 'background-image': `url('${p().photo}')` } : { background: color(props.id) }} />
        {props.label ?? p().name}
      </a>
    )}</Show>
  );
}

export function PeopleChips(props: { ids: string[] }) {
  return (
    <Show when={props.ids.length}>
      <div class="people-chips"><For each={props.ids}>{id => <PersonChip id={id} />}</For></div>
    </Show>
  );
}
