/* Card of a document */
import { For, Show } from 'solid-js';
import { docImages } from '../components/DocCard';
import { Html } from '../components/Html';
import { Linked } from '../components/Linked';
import { openLightbox } from '../components/Lightbox';
import { PeopleChips } from '../components/PersonChip';
import { ReviewFlag } from '../components/ReviewFlag';
import { AI, DATA, REVIEW_DONE, REVIEW_PENDING, REVISION, S } from '../data';
import { texts } from '../i18n';
import { openResearch } from '../router';
import { openDialog } from '../session';
import { longDates } from '../util';

export function DocPanel(props: { id: string }) {
  const d = S.get(props.id)!;
  const images = docImages(d);
  const others = d.files.filter(f => f.kind !== 'image');
  const rows: [string, string][] = [
    [texts.doc.date, d.date], [texts.doc.place, d.place], [texts.doc.issuer, d.issuer], [texts.doc.status, d.status],
    [texts.doc.reviewedBy, d.review === REVIEW_DONE ? longDates(d.reviewedBy) || texts.doc.reviewedByFamily : ''],
    [texts.doc.origin, d.origin], [texts.doc.pages, longDates(d.pages)], [texts.doc.reference, d.id],
  ];
  const zoom = (i: number) => openLightbox(images.map(f => ({ src: f.preview, caption: `${d.title} — ${f.name}` })), i);
  return (
    <>
      <p class="doc-type">{d.type}{' '}<Show when={d.category === AI}><span class="badge ai">{texts.doc.aiNote}</span></Show></p>
      <h2 style={{ margin: '.2rem 0 .8rem' }}>{d.title}</h2>
      <Show when={d.review === REVIEW_PENDING}>
        <p class="review-note">
          <a href="#" class="review-link" data-research={REVISION} onClick={e => { e.preventDefault(); openResearch(REVISION); }}>
            <ReviewFlag text={texts.review.doc} />
          </a>{' '}
          {texts.review.docNote}
        </p>
      </Show>
      <table class="facts">
        <tbody>
          <For each={rows.filter(([, v]) => v)}>{([k, v]) => <tr><th>{k}</th><td><Linked text={v} /></td></tr>}</For>
        </tbody>
      </table>
      <Show when={d.people.length}><h3>{texts.doc.people}</h3><PeopleChips ids={d.people} /></Show>
      <Show when={images.length}>
        <h3>{texts.doc.images}</h3>
        <div class="gallery">
          <For each={images}>{(f, i) => (
            <img loading="lazy" src={f.thumb} alt={f.name} title={f.name} onClick={() => zoom(i())} />
          )}</For>
        </div>
      </Show>
      {/* The public version of the site has only the thumbnail: the originals need the password */}
      <Show when={DATA.access === 'public'}>
        <Show when={d.thumb}>{thumb => (
          <div class="gallery"><img src={thumb()} alt={d.title} onClick={() => openLightbox([{ src: thumb(), caption: d.title }])} /></div>
        )}</Show>
        <p class="locked-note muted">{texts.session.originals}
          <button type="button" class="btn" onClick={openDialog}>{texts.session.seeOriginals}</button></p>
      </Show>
      <Show when={others.length}>
        <h3>{texts.doc.files}</h3>
        <ul class="filelist">
          <For each={others}>{f => (
            <li><a href={f.url} target="_blank" rel="noopener">{f.name}</a>
              <Show when={f.pages}>{' '}<span class="muted">{texts.doc.pageCount(f.pages!)}</span></Show></li>
          )}</For>
        </ul>
      </Show>
      <Html class="prose" html={d.html} />
    </>
  );
}
