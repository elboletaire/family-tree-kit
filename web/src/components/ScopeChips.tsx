/* «Everybody / blood family / direct line» selector of the focused person */
import { For } from 'solid-js';
import { texts } from '../i18n';
import { focusName, type Scope } from '../state';

export function ScopeChips(props: { id: string; label: string; value: Scope; onChange: (s: Scope) => void }) {
  const options = (): [Scope, string][] => [
    ['all', texts.scope.all], ['blood', texts.scope.blood(focusName())], ['direct', texts.scope.direct(focusName())],
  ];
  return (
    <div class="filters" id={props.id} role="toolbar" aria-label={props.label}>
      <For each={options()}>{([key, label]) => (
        <button class="chip" data-s={key} aria-pressed={props.value === key} onClick={() => props.onChange(key)}>{label}</button>
      )}</For>
    </div>
  );
}
