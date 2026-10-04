/* Card of a document; clicking it opens its panel */
import { type JSX, Show } from 'solid-js';
import { AI, catLabel, REVIEW_PENDING } from '../data';
import { texts } from '../i18n';
import { openDoc } from '../router';
import type { Doc } from '../types';
import { hideTip, showTip } from './Tooltip';

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
          {[props.doc.date, props.doc.place].filter(Boolean).join(' · ')}
        </div>
        <Show when={props.doc.category === AI || props.doc.review === REVIEW_PENDING}>
          <div class="doc-tags">
            <Show when={props.doc.review === REVIEW_PENDING}>
              <DocTag label={texts.review.doc} class="review"><i aria-hidden="true" /></DocTag>
            </Show>
            <Show when={props.doc.category === AI}>
              <DocTag label={texts.doc.aiBadge} class="ai">
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor"
                  d="M6 1l1.4 3.6L11 6 7.4 7.4 6 11 4.6 7.4 1 6l3.6-1.4zM12 8l.8 2.2L15 11l-2.2.8L12 14l-.8-2.2L9 11l2.2-.8z" /></svg>
              </DocTag>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

/* Icon-only mark of a document card; its description is a tooltip on hover and on keyboard focus */
function DocTag(props: { label: string; class: string; children: JSX.Element }) {
  const at = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { clientX: r.left, clientY: r.bottom }; };
  return (
    <span class={`doc-tag ${props.class}`} role="img" tabindex="0" aria-label={props.label}
          onMouseEnter={e => showTip({ title: props.label }, e)} onMouseLeave={hideTip}
          onFocus={e => showTip({ title: props.label }, at(e.currentTarget))} onBlur={hideTip}
          onClick={e => e.stopPropagation()}>
      {props.children}
    </span>
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
