/* What changed in a person (the facts and the new sources) and the link to a document, for «Novedades» and the
   history of the person card */
import { For, Show } from 'solid-js';
import { S } from '../data';
import { texts } from '../i18n';
import { openDoc } from '../router';
import type { PersonChange } from '../types';

/** Link to a document: its id and title */
export function DocLink(props: { id: string; title?: boolean }) {
  const d = () => S.get(props.id);
  return (
    <a href="#" class="news-doc" data-doc={props.id} onClick={e => { e.preventDefault(); openDoc(props.id); }}>
      <b>{props.id}</b><Show when={props.title !== false && d()?.title !== props.id}>{' '}{d()?.title}</Show>
    </a>
  );
}

/** The changed facts of a person and their new sources */
export function ChangeText(props: { fields: PersonChange['fields']; sources: string[] }) {
  return (
    <>
      <Show when={props.fields.length}>{texts.news.fieldList(props.fields.map(f => texts.news.fields[f]))}</Show>
      <Show when={props.fields.length && props.sources.length}>{'. '}</Show>
      <Show when={props.sources.length}>
        {texts.news.sources(props.sources.length)}{' '}
        <For each={props.sources}>{(s, i) => <>{i() > 0 && ', '}<DocLink id={s} title={false} /></>}</For>
      </Show>
    </>
  );
}
