/* Research documents: they are split by families (those of families.yml, in DATA.families) and one or all of them
   are shown. By default, the one marked `default`; the choice is remembered. */
import { createSignal } from 'solid-js';
import { DATA } from './data';
import { texts } from './i18n';
import { store } from './util';

/** Key of a family, or `all` */
export type FamilyChoice = string;

export const ALL = 'all';
/** Former name of `all`, which a saved choice may still have */
const ALL_LEGACY = 'todo';
/** Shared sections, always shown: «Afecta a varias familias» and «General» */
export const SEVERAL = 'several', GENERAL = 'general';
export const SHARED = [SEVERAL, GENERAL];
// The storage key keeps its former name, so that the choices already saved in browsers still count
const STORE_KEY = 'arbre-familia';

/** Families that can be chosen, with their short name, and «All» at the end */
export const families = (): [FamilyChoice, string][] => [...DATA.families.map(f => [f.key, f.label] as [string, string]), [ALL, texts.research.all]];
export const defaultFamily = (): FamilyChoice => DATA.families.find(f => f.default)?.key ?? ALL;
export const isFamily = (f: string | null | undefined): f is FamilyChoice => families().some(([k]) => k === f);

const [family, setFamilySignal] = createSignal<FamilyChoice>(ALL);
/** Chosen family */
export { family };
export function setFamily(f: FamilyChoice): void { setFamilySignal(f); store.set(STORE_KEY, f); }
/** Reads the remembered family (or the default one) */
export function initFamily(): void {
  const stored = store.get(STORE_KEY);
  const saved = stored === ALL_LEGACY ? ALL : stored;
  setFamilySignal(isFamily(saved) ? saved : defaultFamily());
}

/** Piece of a research document: a `<section data-family>` of build_site.py or what lies between them */
export interface ResearchPart { family: string | null; count: number; html: string }
const SECTION = /<section data-family="([^"]*)" data-count="(\d+)">([\s\S]*?)<\/section>/g;
export function researchParts(html: string): ResearchPart[] {
  const out: ResearchPart[] = [];
  let last = 0;
  for (const m of html.matchAll(SECTION)) {
    if (m.index > last) out.push({ family: null, count: 0, html: html.slice(last, m.index) });
    out.push({ family: m[1], count: +m[2], html: m[3] });
    last = m.index + m[0].length;
  }
  if (last < html.length) out.push({ family: null, count: 0, html: html.slice(last) });
  return out;
}

/** Only the families that have a section in this document, and always «All» */
export const offeredFamilies = (parts: ResearchPart[]): [FamilyChoice, string][] =>
  families().filter(([k]) => k === ALL || parts.some(p => p.family === k));
/** The family shown: the chosen one if it has a section; otherwise, all */
export const shownFamily = (offered: [FamilyChoice, string][], chosen: FamilyChoice): FamilyChoice =>
  offered.some(([k]) => k === chosen) ? chosen : ALL;
/** Is the section of `section` shown when `shown` has been chosen? */
export const sectionVisible = (section: string | null, shown: FamilyChoice): boolean =>
  shown === ALL || section === shown || SHARED.includes(section!);
/** Points (or documents) of a family, according to the `data-count` of its sections */
export const familyCount = (parts: ResearchPart[], f: FamilyChoice): number =>
  parts.filter(p => p.family && (f === ALL || p.family === f)).reduce((n, p) => n + p.count, 0);
