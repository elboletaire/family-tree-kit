/* A plain text (a field of a person or a document) with the http(s) addresses written in it as links, which open in
   another tab. Built with elements, never with innerHTML. */
import { For } from 'solid-js';
import { splitUrls } from '../util';

export function Linked(props: { text: string }) {
  return (
    <For each={splitUrls(props.text)}>{part => part.url
      ? <a href={part.url} target="_blank" rel="noopener noreferrer">{part.text}</a>
      : <>{part.text}</>}
    </For>
  );
}
