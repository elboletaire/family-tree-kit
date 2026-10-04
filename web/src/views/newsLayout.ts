/* «Novedades» without the DOM: the documents added lately, the history of one person and how a day's changes are
   split for the view. DATA.history comes from scripts/history.py, newest day first. */
import { ALL, type FamilyChoice, GENERAL, sectionVisible } from '../family';
import type { Doc, HistoryEntry, HistoryField, PersonChange } from '../types';

/** Facts that are the text of the note: a change of only these is a revised biography, not new data */
const TEXT_FIELDS: HistoryField[] = ['biography', 'notes'];

/** The ids of the documents added, newest first: by day and, within a day, by id from the highest (the numbering is
 *  consecutive) */
export function addedDocIds(history: HistoryEntry[]): string[] {
  return history.flatMap(e => [...e.docsAdded].sort((a, b) => b.localeCompare(a)));
}

/** The documents for «Últimos documentos» of the home: the `n` last ones added that `keep` accepts (from the history)
 *  or, without history, those of `fallback` (the documents by their own date). `added` says which of both it is */
export function recentDocs(history: HistoryEntry[], docs: Map<string, Doc>, keep: (d: Doc) => boolean,
                           fallback: () => Doc[], n = 6): { docs: Doc[]; added: boolean } {
  const added = addedDocIds(history).map(id => docs.get(id)).filter((d): d is Doc => Boolean(d && keep(d)));
  return added.length ? { docs: added.slice(0, n), added: true } : { docs: fallback().slice(0, n), added: false };
}

/** What happened to a person on a day of the history */
export interface PersonEvent {
  date: string;
  /** Added to the tree that day (the start of the tree, if `first`) */
  added: boolean;
  first: boolean;
  fields: HistoryField[];
  sources: string[];
  /** The name they had, if they changed it that day */
  renamedFrom: string | null;
}

/** The days the person `id` changed, newest first */
export function personHistory(history: HistoryEntry[], id: string): PersonEvent[] {
  return history.flatMap(e => {
    const change = e.peopleChanged.find(c => c.id === id);
    const rename = e.peopleRenamed.find(r => r.to === id);
    const added = e.peopleAdded.includes(id);
    if (!change && !rename && !added) return [];
    return [{ date: e.date, added, first: e.first, fields: change?.fields ?? [], sources: change?.sources ?? [],
              renamedFrom: rename?.from ?? null }];
  });
}

/** The changed people of a day: those with new facts or sources, and those whose note only changed its text */
export function splitChanges(changes: PersonChange[]): { facts: PersonChange[]; texts: PersonChange[] } {
  const textOnly = (c: PersonChange) => !c.sources.length && c.fields.every(f => TEXT_FIELDS.includes(f));
  return { facts: changes.filter(c => !textOnly(c)), texts: changes.filter(textOnly) };
}

/** Counts of a day, for its heading: what was added, approved and corrected */
export function daySummary(e: HistoryEntry): { docs: number; people: number; reviewed: number; changed: number } {
  return { docs: e.docsAdded.length, people: e.peopleAdded.length, reviewed: e.docsReviewed.length,
           changed: e.peopleChanged.length + e.docsUpdated.length };
}

/** The history with only the people and documents these data have (build_site.py already filters them; this keeps
 *  the view whole if they ever disagree) */
export function knownHistory(history: HistoryEntry[], person: (id: string) => boolean, doc: (id: string) => boolean): HistoryEntry[] {
  return history.map(e => ({
    ...e,
    docsAdded: e.docsAdded.filter(doc), docsReviewed: e.docsReviewed.filter(doc), docsUpdated: e.docsUpdated.filter(doc),
    peopleAdded: e.peopleAdded.filter(person),
    peopleChanged: e.peopleChanged.filter(c => person(c.id)).map(c => ({ ...c, sources: c.sources.filter(doc) })),
    peopleRenamed: e.peopleRenamed.filter(r => person(r.to)),
  }));
}

/** Family of each person and document, for `familyHistory`: the keys of `families` of a person (none: shared by all)
 *  and the `family` of a document (a key, `several` or `general`; unknown: shared) */
export interface FamilyOf {
  person: (id: string) => string[];
  doc: (id: string) => string | undefined;
}

/** Does the person belong to `fam`, or to no family (then to all of them)? */
const personIn = (of: FamilyOf, id: string, fam: FamilyChoice): boolean => {
  const fams = of.person(id);
  return !fams.length || fams.includes(fam);
};
/** Does the document belong to `fam`? Those of several families, yes; those of none (`general`: nobody cites them),
 *  only under «All» */
const docIn = (of: FamilyOf, id: string, fam: FamilyChoice): boolean => {
  const f = of.doc(id);
  return f === undefined || (f !== GENERAL && sectionVisible(f, fam));
};

/** Has the day anything to show? */
const hasNews = (e: HistoryEntry): boolean => [e.docsAdded, e.docsReviewed, e.docsUpdated, e.peopleAdded, e.peopleChanged,
  e.peopleRemoved, e.peopleRenamed, e.docsRemoved, e.research].some(list => list.length > 0);

/** The history of the family `fam` (or all of it, with ALL): the documents of that family or of several (`several`;
 *  not those of none, `general`), the people of that family or of none and the research items of its section or a shared one; the
 *  removed people and documents, whose family is no longer known, always. The days left empty are dropped */
export function familyHistory(history: HistoryEntry[], fam: FamilyChoice, of: FamilyOf): HistoryEntry[] {
  if (fam === ALL) return history;
  const doc = (id: string) => docIn(of, id, fam), person = (id: string) => personIn(of, id, fam);
  return history.map(e => ({
    ...e,
    docsAdded: e.docsAdded.filter(doc), docsReviewed: e.docsReviewed.filter(doc), docsUpdated: e.docsUpdated.filter(doc),
    peopleAdded: e.peopleAdded.filter(person),
    peopleChanged: e.peopleChanged.filter(c => person(c.id)),
    peopleRenamed: e.peopleRenamed.filter(r => person(r.to)),
    research: e.research.filter(r => sectionVisible(r.family, fam)),
  })).filter(hasNews);
}

/** Does the history name anything of the family `fam` itself (not only shared things)? */
const namesFamily = (history: HistoryEntry[], fam: FamilyChoice, of: FamilyOf): boolean => history.some(e =>
  [...e.docsAdded, ...e.docsReviewed, ...e.docsUpdated].some(id => of.doc(id) === fam)
  || [...e.peopleAdded, ...e.peopleChanged.map(c => c.id), ...e.peopleRenamed.map(r => r.to)].some(id => of.person(id).includes(fam))
  || e.research.some(r => r.family === fam));

/** The families of `choices` to offer in «Novedades»: those the history names, and always «All» */
export function newsFamilies(history: HistoryEntry[], choices: [FamilyChoice, string][], of: FamilyOf):
  { key: FamilyChoice; label: string }[] {
  return choices.filter(([k]) => k === ALL || namesFamily(history, k, of)).map(([key, label]) => ({ key, label }));
}
