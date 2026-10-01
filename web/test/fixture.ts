/* Small fictional family for the tests, with the same shape as the DATA of scripts/build_site.py. Like the real data,
   its ids and names are content, so they are in Spanish (several double as the expected kinship labels). */
import type { Data, Doc, HistoryEntry, Person } from '../src/types';

const person = (id: string, over: Partial<Person>): Person => ({
  id, name: id, given: id, surnames: 'Prueba', sex: 'M', born: '', died: '', bornYear: null, diedYear: null,
  bornApprox: false, birthPlace: '', deathPlace: '', occupation: '', father: null, mother: null, spouses: [],
  children: [], siblings: [], conf: '', living: false, branch: 'olmo', gen: 0, photo: null, marriages: [],
  sources: [], review: '', html: '', families: ['olmo'], ...over,
});
const doc = (id: string, over: Partial<Doc>): Doc => ({
  id, family: 'olmo', title: `Documento ${id}`, type: 'Partida', category: 'genealogia', date: '', year: null,
  place: '', issuer: '', status: 'documentado', review: '', reviewedBy: '', origin: '', pages: '', thumb: null,
  files: [], people: [], html: '<p>texto</p>', ...over,
});

const day = (date: string, over: Partial<HistoryEntry>): HistoryEntry => ({
  date, first: false, docsAdded: [], docsReviewed: [], docsUpdated: [], peopleAdded: [], peopleChanged: [],
  peopleRemoved: [], peopleRenamed: [], docsRemoved: [], research: [], ...over,
});

const research = (families: [string, number][]) => families.map(([f, n]) =>
  `<section data-family="${f}" data-count="${n}"><h2>${f}</h2><ul>${'<li>[ ] punto</li>'.repeat(n)}</ul></section>`).join('');

/* abuelo (grandfather) ═ abuela; padre (father), madre (mother), tia/tio (aunt/uncle), yo (me), hermana (sister),
   primo (cousin), segunda (second wife), hermanastro (step-brother)

     abuelo ═ abuela
          │
   ┌──────┴───────┐
 padre ═ madre   tia ═ tio
   ║ (y segunda)    │
 ┌─┴──────┐       primo
 yo    hermana
 segunda → hermanastro;  suelto1 and suelto2: siblings without known parents */
export function fixture(): Data {
  const people = [
    person('abuelo', { name: 'Abuelo Prueba', spouses: ['abuela'], children: ['padre', 'tia'], bornYear: 1900, born: '1900-03-02', diedYear: 1970, died: '1970',
      birthPlace: 'Villa Alta', deathPlace: 'Salamanca' }),
    person('abuela', { name: 'Abuela Prueba', sex: 'F', spouses: ['abuelo'], children: ['padre', 'tia'], bornYear: 1905, born: '1905', birthPlace: 'Monte Medio' }),
    person('padre', { name: 'Padre Prueba', father: 'abuelo', mother: 'abuela', conf: 'proven', spouses: ['madre', 'segunda'], children: ['yo', 'hermana'], bornYear: 1930, born: '1930', gen: 1,
      birthPlace: 'Villa Alta [?]' }),
    person('madre', { name: 'Madre Prueba', sex: 'F', spouses: ['padre'], children: ['yo', 'hermana'], branch: 'fresno', gen: 1, families: ['roble'],
      marriages: [{ spouse: 'padre', date: '1955-06-01', year: 1955, place: 'Salamanca' }] }),
    person('segunda', { name: 'Segunda Esposa', sex: 'F', spouses: ['padre'], children: ['hermanastro'], gen: 1 }),
    person('tia', { name: 'Tía Prueba', sex: 'F', father: 'abuelo', mother: 'abuela', conf: 'probable', spouses: ['tio'], children: ['primo'], gen: 1,
      birthPlace: 'Puerto Bajo' }),
    person('tio', { name: 'Tío Político', spouses: ['tia'], children: ['primo'], gen: 1 }),
    person('yo', { name: 'Yo Prueba', given: 'Yo', father: 'padre', mother: 'madre', conf: 'proven', gen: 2, bornYear: 1960, born: '1960-01-15', living: true, sources: ['F001'], review: 'partial' }),
    person('hermana', { name: 'Hermana Prueba', sex: 'F', father: 'padre', mother: 'madre', conf: 'proven', gen: 2, birthPlace: 'Puerto Bajo' }),
    person('primo', { name: 'Primo Prueba', father: 'tio', mother: 'tia', conf: 'proven', gen: 2 }),
    person('hermanastro', { name: 'Hermanastro Prueba', mother: 'segunda', conf: 'probable', gen: 2 }),
    person('suelto1', { name: 'Suelto Uno', siblings: ['suelto2'], branch: 'otras', families: [] }),
    person('suelto2', { name: 'Suelto Dos', siblings: ['suelto1'], branch: 'otras', families: [] }),
    person('jose-nunez', { name: 'José Núñez Pérez', given: 'José', surnames: 'Núñez Pérez', branch: 'otras', families: [] }),
  ];
  return {
    people,
    docs: [
      doc('F001', { title: 'Partida de bautismo de Yo', people: ['yo', 'padre'], review: 'pendiente', year: 1960, date: '1960-01-20', place: 'Puerto Bajo' }),
      doc('F002', { title: 'Foto de la boda', category: 'foto', people: ['padre', 'madre'], family: 'roble', year: 1955,
        files: [{ name: 'boda.jpg', url: '../sources/F002/boda.jpg', kind: 'image', thumb: 'media/F002/t.jpg', preview: 'media/F002/p.jpg' }] }),
    ],
    branches: [
      { key: 'olmo', label: 'Olmo', color: '#2a78d6' },
      { key: 'fresno', label: 'Fresno', color: '#eda100' },
      { key: 'otras', label: 'Otras familias', color: '#9a958c' },
    ],
    events: [{ from: 1936, to: 1939, label: 'Guerra Civil' }],
    categories: { genealogia: 'Genealogía', foto: 'Fotografías', arbol: 'Árboles', contexto: 'Contexto', patrimonio: 'Patrimonio', ia: 'Generado por IA' },
    research: {
      incoherencias: research([['olmo', 2], ['roble', 1], ['general', 1]]),
      pendientes: '<p>Sin apartados de familia</p>',
      revision: research([['olmo', 3], ['pino', 2], ['several', 1]]),
    },
    // «Salamanca» has no coordinates: it is not on the map
    places: {
      'Villa Alta': { lat: 43.1, lon: -5.9, name: 'Villa Alta' },
      'Villa Alta [?]': { lat: 43.1, lon: -5.9, name: 'Villa Alta' },
      'Monte Medio': { lat: 42.5, lon: -4.5, name: 'Monte Medio' },
      'Puerto Bajo': { lat: 43.5, lon: -5.7, name: 'Puerto Bajo' },
    },
    families: [
      { key: 'olmo', label: 'Familia Olmo', title: 'Familia Olmo (del valle)', of: 'de la familia Olmo', default: true },
      { key: 'roble', label: 'Familia Roble', title: 'Familia Roble', of: 'de la familia Roble', default: false },
      { key: 'pino', label: 'Familia Pino', title: 'Familia Pino', of: 'de la familia Pino', default: false },
    ],
    otherBranch: 'otras',
    main: 'yo',
    access: 'full',
    publicIds: {},
    // «Novedades», newest first: the tree started with the grandparents' line, later came «yo» and F001, and then F002
    history: [
      day('2026-03-10', {
        docsAdded: ['F002'], docsReviewed: ['F001'],
        peopleChanged: [
          { id: 'abuelo', fields: ['died', 'deathPlace'], sources: ['F002'] },
          { id: 'yo', fields: ['born'], sources: [] },
          { id: 'tia', fields: ['biography', 'notes'], sources: [] },
        ],
        peopleRemoved: ['Primo Duplicado'], peopleRenamed: [{ from: 'Tia Sin Apellidos', to: 'tia' }],
        docsRemoved: ['F009 — Copia repetida'],
        research: [{ note: 'pendientes', text: 'Partida de bautismo de Abuela', family: 'olmo', resolved: true },
                   { note: 'incoherencias', text: 'Fecha de la boda de Padre', family: 'roble', resolved: false },
                   { note: 'pendientes', text: 'Preguntar a los primos', family: 'general', resolved: false }],
      }),
      day('2026-03-02', { docsAdded: ['F001'], peopleAdded: ['yo', 'primo'] }),
      day('2026-02-20', { first: true, peopleAdded: ['abuelo', 'abuela', 'padre', 'madre', 'tia'] }),
    ],
  };
}

/* The public version of the same family, as scripts/build_site.py makes it: «yo» is living, so they are a «Persona
   viva» placeholder with an opaque id, and F001, which cites them, is left out; the web opens through the eyes of
   «padre», their closest deceased ancestor */
export function publicFixture(): Data {
  const d = fixture();
  const opaque = (id: string) => id === 'yo' ? 'living-1' : id;
  d.people = d.people.map(p => p.id === 'yo'
    ? { ...p, id: 'living-1', name: 'Persona viva', given: '', surnames: '', sex: 'U', born: '', bornYear: null, sources: [], review: '', families: [] }
    : { ...p, children: p.children.map(opaque), sources: p.sources.filter(s => s !== 'F001') });
  d.docs = d.docs.filter(x => x.id !== 'F001');
  d.research = {};
  // Nothing of the living, of F001, of the removed or renamed, nor of the research documents and notes
  d.history = d.history.map(e => ({
    ...e, docsAdded: e.docsAdded.filter(x => x !== 'F001'), docsReviewed: e.docsReviewed.filter(x => x !== 'F001'),
    peopleAdded: e.peopleAdded.filter(x => x !== 'yo'),
    peopleChanged: e.peopleChanged.filter(c => c.id !== 'yo').map(c => ({ ...c, fields: c.fields.filter(f => f !== 'notes') })),
    peopleRemoved: [], peopleRenamed: [], docsRemoved: [], research: [],
  }));
  d.main = 'padre';
  d.access = 'public';
  return d;
}

/** The private data of the site: the whole family, with the opaque ids of the public version */
export const privateFixture = (): Data => ({ ...fixture(), access: 'private', publicIds: { 'living-1': 'yo' } });
