/* HOME: introduction, constellation of the family, the documents added last and what is pending review */
import * as d3 from 'd3';
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { DocCard } from '../components/DocCard';
import { Legend } from '../components/Legend';
import { AI, COMPILATION_TYPE, DATA, GENEALOGY, INCONSISTENCIES, P, PENDING, pendingDocs, PHOTO, REVISION, S } from '../data';
import { ALL, SEVERAL } from '../family';
import { texts } from '../i18n';
import { ancestors } from '../kinship';
import { openPerson, openResearch, viewHash } from '../router';
import { focus, kin } from '../state';
import { T } from '../util';
import { Constellation } from './Constellation';
import { recentDocs } from './newsLayout';

/** Number that counts up from 0 when it appears */
function CountUp(props: { to: number }) {
  const [n, setN] = createSignal(0);
  onMount(() => {
    const ms = T(1400);
    if (!ms) return setN(props.to);
    const timer = d3.timer(t => {
      setN(Math.round(props.to * d3.easeCubicOut(Math.min(1, t / ms))));
      if (t >= ms) timer.stop();
    });
    onCleanup(() => timer.stop());
  });
  return <b>{n()}</b>;
}

/** Link that opens a research document (and, with `family`, chooses that family) */
function ResearchLink(props: { name: string; family?: string; class?: string; children: import('solid-js').JSX.Element }) {
  return (
    <a class={props.class} href="#" data-research={props.name} data-family={props.family}
       onClick={e => { e.preventDefault(); openResearch(props.name, props.family); }}>{props.children}</a>
  );
}

export function Home() {
  const minY = d3.min(DATA.people.filter(p => p.bornYear), p => p.bornYear)!;
  const gens = d3.max(DATA.people, p => p.gen)! + 1;
  const places = new Set(DATA.people.flatMap(p => [p.birthPlace, p.deathPlace]).filter(Boolean).map(s => s.split(',')[0].trim()));
  const stats: [number, string][] = [
    [DATA.people.length, texts.home.stats.people], [gens, texts.home.stats.generations], [DATA.docs.filter(d => d.category !== AI).length, texts.home.stats.documents],
    [DATA.docs.filter(d => d.category === PHOTO).length, texts.home.stats.photos], [new Date().getFullYear() - minY, texts.home.stats.years],
    [places.size, texts.home.stats.places],
  ];
  // The documents added last (Git history of the data); without it, a sample of the documents by their own date
  const recent = recentDocs(DATA.history, S, d => d.category !== AI && d.type !== COMPILATION_TYPE,
    () => DATA.docs.filter(d => [GENEALOGY, PHOTO].includes(d.category) && d.thumb && d.type !== COMPILATION_TYPE)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).filter((_d, i) => i % 3 === 0));
  // Documents pending review, by family; those of several families open the revision with all of them
  const pendingIn = (f: string) => pendingDocs.filter(d => d.family === f).length;
  const split = [...DATA.families.map(f => [f.key, f.of]), [SEVERAL, texts.home.severalFamilies]]
    .filter(([f]) => pendingIn(f)).map(([f, label]) => ({ family: f === SEVERAL ? ALL : f, text: `${pendingIn(f)} ${label}` }));
  // Relatives of the focused person, by kind
  const summary = createMemo(() => {
    const all = [...kin()], up = ancestors(focus());
    const n = (k: string) => all.filter(([, x]) => x.kind === k).length;
    const ancestorsN = all.filter(([id, x]) => x.kind === 'direct' && up.has(id)).length;
    return { up: ancestorsN, down: n('direct') - ancestorsN, blood: n('blood'), inLaw: n('inLaw') };
  });
  return (
    <>
      <div class="hero">
        <div class="hero-text">
          <p class="eyebrow" id="hero-eyebrow">{DATA.branches.filter(b => b.key !== DATA.otherBranch).map(b => b.label).join(' · ')}</p>
          <h1>{texts.home.title}</h1>
          <p class="lede" id="hero-lede">
            {texts.home.lede(DATA.people.length, gens, minY)}
          </p>
          <p class="focus-summary" id="hero-focus">
            {texts.home.eyesOf} <a href="#" data-person={focus()} onClick={e => { e.preventDefault(); openPerson(focus()); }}>{P.get(focus())!.name}</a>:{' '}
            {texts.home.summary(summary().up, summary().down, summary().blood, summary().inLaw)}
          </p>
          <div class="stats" id="stats">
            <For each={stats}>{([n, label]) => <div class="stat"><CountUp to={n} /><span>{label}</span></div>}</For>
          </div>
          <div class="hero-actions">
            <a class="btn primary" href={viewHash('fan')}>{texts.home.seeAncestors}</a>
            <a class="btn" href={viewHash('timeline')}>{texts.home.seeTimeline}</a>
            <a class="btn" href={viewHash('documents')}>{texts.home.seeDocuments}</a>
          </div>
        </div>
        <Constellation />
      </div>
      <Legend id="legend-home" />
      <div class="home-grid">
        <div class="card-panel home-docs-panel">
          <h2>{recent.added ? texts.home.latestAdded : texts.home.latestDocuments}</h2>
          <div id="home-docs" class="mini-docs"><For each={recent.docs}>{(d, i) => <DocCard doc={d} index={i()} />}</For></div>
          <Show when={DATA.history.length}>
            <p class="home-news"><a href={viewHash('news')}>{texts.home.seeNews} →</a></p>
          </Show>
        </div>
        {/* The public version of the site has no research documents */}
        <Show when={Object.keys(DATA.research).length}>
        <div class="card-panel">
          <h2>{texts.home.pendingReview}</h2>
          <p class="muted">{texts.home.pendingIntro}</p>
          <p><ResearchLink class="btn" name={INCONSISTENCIES}>{texts.home.inconsistencies}</ResearchLink>{' '}
             <ResearchLink class="btn" name={PENDING}>{texts.home.pendingLines}</ResearchLink>{' '}
             <ResearchLink class="btn" name={REVISION}>{texts.home.revision}</ResearchLink></p>
          <Show when={pendingDocs.length}>
            <p class="review-count" id="home-review">
              <ResearchLink class="btn btn-review" name={REVISION}>
                <i aria-hidden="true" />{texts.review.pendingDocs(pendingDocs.length)}
              </ResearchLink>
              <Show when={split.length}>
                <span class="review-split">
                  <For each={split}>{(s, i) => <>{i() > 0 && ' · '}<ResearchLink name={REVISION} family={s.family}>{s.text}</ResearchLink></>}</For>
                </span>
              </Show>
            </p>
          </Show>
        </div>
        </Show>
      </div>
    </>
  );
}
