/* Shape of DATA, the JSON that scripts/build_site.py embeds in index.html (variable `payload`).
   If build_site.py changes a field, it has to change here too: test/data-contract.test.ts compares these types with
   the real data of build/web/index.html and fails if a key is extra, missing or of another type. */

/** Family of the research documents, from families.yml */
export interface Family {
  key: string;
  /** Short name, for the selector */
  label: string;
  /** `##` title of its section in the research documents */
  title: string;
  /** «de la familia de …», to count its documents */
  of: string;
  /** The one shown by default */
  default: boolean;
}

export interface Marriage {
  spouse: string;
  date: string;
  year: number | null;
  place: string;
}

export interface Person {
  id: string;
  name: string;
  given: string;
  surnames: string;
  sex: 'M' | 'F' | 'U';
  born: string;
  died: string;
  bornYear: number | null;
  diedYear: number | null;
  bornApprox: boolean;
  birthPlace: string;
  deathPlace: string;
  occupation: string;
  father: string | null;
  mother: string | null;
  spouses: string[];
  children: string[];
  siblings: string[];
  /** `parents_confidence` */
  conf: 'proven' | 'probable' | '';
  living: boolean;
  /** Key of `branches` */
  branch: string;
  /** Generation, from 0 (the oldest) */
  gen: number;
  photo: string | null;
  marriages: Marriage[];
  sources: string[];
  /** `person_review`: all their sources pending («new») or some («partial») */
  review: 'new' | 'partial' | '';
  html: string;
}

export interface PageImage {
  thumb: string;
  preview: string;
}

/** File of a document. `thumb`, `preview`, `pages` and `pageImages` depend on the kind */
export interface DocFile {
  name: string;
  url: string;
  kind: 'image' | 'pdf' | 'other';
  thumb?: string | null;
  preview?: string;
  pages?: number;
  pageImages?: PageImage[];
}

/** Categories of the sources (`category` of their note): they are data, so they stay in Spanish */
export type Category = 'genealogia' | 'foto' | 'arbol' | 'contexto' | 'patrimonio' | 'ia';

export interface Doc {
  id: string;
  /** Key of a family of `families`, or `several` (several) or `general` (none) */
  family: string;
  title: string;
  type: string;
  category: Category;
  date: string;
  year: number | null;
  place: string;
  issuer: string;
  status: string;
  /** `review` of its note (content, so in Spanish) */
  review: 'pendiente' | 'revisada' | '';
  reviewedBy: string;
  origin: string;
  pages: string;
  thumb: string | null;
  files: DocFile[];
  /** People who cite it */
  people: string[];
  html: string;
}

export interface Branch {
  key: string;
  label: string;
  color: string;
}

export interface HistoricEvent {
  from: number;
  to: number;
  label: string;
}

/** Coordinates of a place (places.yml), under the text it has in the notes */
export interface Place {
  lat: number;
  lon: number;
  /** Its label on the map */
  name: string;
}

/** Research documents: the names of their files in the research folder (`paths.research` in families.yml) */
export type ResearchKey = 'incoherencias' | 'pendientes' | 'revision';

export interface Data {
  people: Person[];
  docs: Doc[];
  branches: Branch[];
  events: HistoricEvent[];
  categories: Record<Category, string>;
  /** HTML of each research document, with a `<section data-family>` per family */
  research: Partial<Record<ResearchKey, string>>;
  /** Located places, by how they are written in `birthPlace`, `deathPlace`, `marriages` and `place` of the documents */
  places: Record<string, Place>;
  families: Family[];
  /** Key in `branches` of whoever does not descend from any branch */
  otherBranch: string;
  main: string;
  /** `full`: the whole tree, opened without a server (`make html`); `public`: the public version of the site, without
   *  the living (they are «Persona viva» placeholders with an opaque id); `private`: the whole tree, loaded from the
   *  server with a session (see session.ts) */
  access: Access;
  /** Only in `private`: the opaque id of each living person in the public version → their id */
  publicIds: Record<string, string>;
}

export type Access = 'full' | 'public' | 'private';
