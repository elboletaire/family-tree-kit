/* HTML already rendered by scripts/build_site.py (biographies, documents, research): the only place where the
   interface uses innerHTML. Its links to people, documents and research (data-person, data-doc, data-research) are
   handled here, delegated to the element itself. */
import { splitProps, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { openDoc, openPerson, openResearch } from '../router';

type Props = { html: string; tag?: string } & Omit<JSX.HTMLAttributes<HTMLElement>, 'innerHTML' | 'children'>;

export function followLink(e: MouseEvent): void {
  const a = (e.target as Element).closest<HTMLElement>('[data-person],[data-doc],[data-research]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.person) openPerson(a.dataset.person);
  else if (a.dataset.doc) openDoc(a.dataset.doc);
  else openResearch(a.dataset.research!, a.dataset.family);
}

export function Html(props: Props) {
  const [own, rest] = splitProps(props, ['html', 'tag']);
  return <Dynamic component={own.tag ?? 'div'} {...rest} innerHTML={own.html} onClick={followLink} />;
}
