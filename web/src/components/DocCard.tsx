/* Card of a document; clicking it opens its panel */
import { Show } from 'solid-js';
import { AI, catLabel, REVIEW_PENDING } from '../data';
import { texts } from '../i18n';
import { openDoc } from '../router';
import type { Doc } from '../types';
import { ReviewFlag } from './ReviewFlag';

export function DocCard(props: { doc: Doc; index?: number }) {
  return (
    <div class="doc-card" data-doc={props.doc.id} style={{ 'animation-delay': `${Math.min(props.index ?? 0, 30) * 25}ms` }}
         onClick={() => openDoc(props.doc.id)}>
      <div class="doc-thumb" style={props.doc.thumb ? { 'background-image': `url('${props.doc.thumb}')` } : undefined}>
        <Show when={!props.doc.thumb}><span class="ph">{(props.doc.type || texts.doc.placeholder)[0]}</span></Show>
      </div>
      <div class="doc-meta">
        <div class="doc-type">{props.doc.type || catLabel(props.doc.category)}</div>
        <div class="doc-title">{props.doc.title}</div>
        <div class="doc-sub">
          {[props.doc.date, props.doc.place].filter(Boolean).join(' · ')}{' '}
          <Show when={props.doc.category === AI}><span class="badge ai">{texts.doc.aiBadge}</span></Show>
        </div>
        <Show when={props.doc.review === REVIEW_PENDING}><ReviewFlag text={texts.review.doc} /></Show>
      </div>
    </div>
  );
}

export interface DocImage { thumb: string; preview: string; name: string }
/** Images of a document: the photos and the pages of its PDFs */
export function docImages(d: Doc): DocImage[] {
  const out: DocImage[] = [];
  d.files.forEach(f => {
    if (f.kind === 'image') out.push({ thumb: f.thumb!, preview: f.preview!, name: f.name });
    else if (f.pageImages) f.pageImages.forEach((p, i) =>
      out.push({ thumb: p.thumb, preview: p.preview, name: texts.doc.page(f.name, i + 1) }));
  });
  return out;
}
