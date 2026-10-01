/* Runtime check that a real DATA has the shape of src/types.ts.
   Each spec is a `Spec<T>`: TypeScript forces it to have exactly the keys of T, so if a field is added to or removed
   from types.ts without touching it, it does not compile; and if build_site.py changes, the test fails. */
import type {
  Branch, Category, Data, Doc, DocFile, Family, HistoricEvent, HistoryEntry, HistoryField, Marriage, PageImage, Person, PersonChange,
  Place, Rename, ResearchItem, ResearchKey,
} from '../src/types';

type Check = (v: unknown, path: string) => string[];
type Spec<T> = { [K in keyof Required<T>]: Check };

const ok = (cond: boolean, path: string, what: string): string[] => cond ? [] : [`${path}: expected ${what}`];
export const str: Check = (v, p) => ok(typeof v === 'string', p, 'text');
export const num: Check = (v, p) => ok(typeof v === 'number' && Number.isFinite(v), p, 'number');
export const bool: Check = (v, p) => ok(typeof v === 'boolean', p, 'boolean');
export const nullable = (c: Check): Check => (v, p) => v === null ? [] : c(v, p);
export const oneOf = <T extends string>(...values: T[]): Check => (v, p) =>
  ok(values.includes(v as T), p, `one of ${values.map(x => JSON.stringify(x)).join(', ')} (got ${JSON.stringify(v)})`);
export const arrayOf = (c: Check): Check => (v, p) =>
  Array.isArray(v) ? v.flatMap((x, i) => c(x, `${p}[${i}]`)) : [`${p}: expected a list`];
/** Object with exactly the keys of `spec`; those in `optional` may be missing */
export const object = <T>(spec: Spec<T>, optional: (keyof T)[] = []): Check => (v, p) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return [`${p}: expected an object`];
  const o = v as Record<string, unknown>;
  const extra = Object.keys(o).filter(k => !(k in spec)).map(k => `${p}.${k}: key not in src/types.ts`);
  const checks = Object.entries(spec as Record<string, Check>).flatMap(([k, c]) =>
    !(k in o) ? (optional.includes(k as keyof T) ? [] : [`${p}.${k}: missing`]) : c(o[k], `${p}.${k}`));
  return [...extra, ...checks];
};
/** Object whose keys are exactly `keys` (or a subset, if `partial`) */
const record = <K extends string>(keys: K[], c: Check, partial = false): Check => (v, p) => {
  if (typeof v !== 'object' || v === null) return [`${p}: expected an object`];
  const o = v as Record<string, unknown>;
  return [
    ...Object.keys(o).filter(k => !keys.includes(k as K)).map(k => `${p}.${k}: unexpected key`),
    ...(partial ? [] : keys.filter(k => !(k in o)).map(k => `${p}.${k}: missing`)),
    ...Object.entries(o).flatMap(([k, x]) => c(x, `${p}.${k}`)),
  ];
};
/** Object with any keys, all of them checked with `c` */
const dict = (c: Check): Check => (v, p) => typeof v !== 'object' || v === null || Array.isArray(v) ? [`${p}: expected an object`]
  : Object.entries(v).flatMap(([k, x]) => c(x, `${p}[${JSON.stringify(k)}]`));

const CATEGORIES: Category[] = ['genealogia', 'foto', 'arbol', 'contexto', 'patrimonio', 'ia'];
const RESEARCH: ResearchKey[] = ['incoherencias', 'pendientes', 'revision'];

const marriage: Spec<Marriage> = { spouse: str, date: str, year: nullable(num), place: str };
const person: Spec<Person> = {
  id: str, name: str, given: str, surnames: str, sex: oneOf<Person['sex']>('M', 'F', 'U'), born: str, died: str,
  bornYear: nullable(num), diedYear: nullable(num), bornApprox: bool, birthPlace: str, deathPlace: str, occupation: str,
  father: nullable(str), mother: nullable(str), spouses: arrayOf(str), children: arrayOf(str), siblings: arrayOf(str),
  conf: oneOf<Person['conf']>('proven', 'probable', ''), living: bool, branch: str, gen: num, photo: nullable(str),
  marriages: arrayOf(object(marriage)), sources: arrayOf(str), review: oneOf<Person['review']>('new', 'partial', ''), html: str,
  families: arrayOf(str),
};
const pageImage: Spec<PageImage> = { thumb: str, preview: str };
const docFile: Spec<DocFile> = {
  name: str, url: str, kind: oneOf<DocFile['kind']>('image', 'pdf', 'other'), thumb: nullable(str), preview: str,
  pages: num, pageImages: arrayOf(object(pageImage)),
};
const doc: Spec<Doc> = {
  id: str, family: str, title: str, type: str, category: oneOf(...CATEGORIES), date: str,
  year: nullable(num), place: str, issuer: str, status: str, review: oneOf<Doc['review']>('pendiente', 'revisada', ''),
  reviewedBy: str, origin: str, pages: str, thumb: nullable(str),
  files: arrayOf(object(docFile, ['thumb', 'preview', 'pages', 'pageImages'])), people: arrayOf(str), html: str,
};
const family: Spec<Family> = { key: str, label: str, title: str, of: str, default: bool };
const branch: Spec<Branch> = { key: str, label: str, color: str };
const event: Spec<HistoricEvent> = { from: num, to: num, label: str };
const place: Spec<Place> = { lat: num, lon: num, name: str };
const FIELDS: HistoryField[] = ['name', 'aliases', 'sex', 'born', 'birthPlace', 'died', 'deathPlace', 'occupation', 'parents',
  'siblings', 'spouses', 'photo', 'biography', 'notes'];
const personChange: Spec<PersonChange> = { id: str, fields: arrayOf(oneOf(...FIELDS)), sources: arrayOf(str) };
const rename: Spec<Rename> = { from: str, to: str };
const researchItem: Spec<ResearchItem> = { note: oneOf<ResearchItem['note']>('incoherencias', 'pendientes'), text: str, family: str, resolved: bool };
const historyEntry: Spec<HistoryEntry> = {
  date: str, first: bool, docsAdded: arrayOf(str), docsReviewed: arrayOf(str), docsUpdated: arrayOf(str),
  peopleAdded: arrayOf(str), peopleChanged: arrayOf(object(personChange)), peopleRemoved: arrayOf(str),
  peopleRenamed: arrayOf(object(rename)), docsRemoved: arrayOf(str), research: arrayOf(object(researchItem)),
};
const data: Spec<Data> = {
  people: arrayOf(object(person)), docs: arrayOf(object(doc)), branches: arrayOf(object(branch)),
  events: arrayOf(object(event)), categories: record(CATEGORIES, str), research: record(RESEARCH, str, true),
  places: dict(object(place)),
  families: arrayOf(object(family)), otherBranch: str, main: str, access: oneOf<Data['access']>('full', 'public', 'private'),
  publicIds: dict(str), history: arrayOf(object(historyEntry)),
};

/** List of mismatches between `value` and the Data type (empty if it matches) */
export const checkData = (value: unknown): string[] => object(data)(value, 'DATA');
