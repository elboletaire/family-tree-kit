/* Spanish texts of the interface: everything the family reads comes from here, so the code stays in English. The
   kinship names follow Spanish grammar (gender endings, «primo segundo»…), so their wording lives here too. */
import type { HistoryField, Person } from '../types';

/** Masculine or feminine form, by the person's sex (masculine when unknown) */
const gender = <T>(p: Person, m: T, f: T): T => p.sex === 'F' ? f : m;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// --- Kinship (kinship.ts)
const ordinal = (n: number, o: string): string => n < 2 ? '' : n <= 4 ? [' segund', ' tercer', ' cuart'][n - 2] + o : ` en ${n}º grado`;
/** Blood relative at `a` generations from one person and `b` from the other, up to their closest common ancestor */
function blood(p: Person, a: number, b: number): string {
  const o = gender(p, 'o', 'a');
  if (!a && !b) return '';
  if (!b) return a === 1 ? gender(p, 'padre', 'madre') : a <= 4 ? ['abuel', 'bisabuel', 'tatarabuel'][a - 2] + o : `antepasad${o} (${a} generaciones)`;
  if (!a) return b <= 4 ? ['hij', 'niet', 'bisniet', 'tataraniet'][b - 1] + o : `descendiente (${b} generaciones)`;
  if (a === b) return a === 1 ? 'herman' + o
    : a === 2 ? `prim${o} herman${o}` : `prim${o}${ordinal(a - 1, o)}`;
  const extra = (n: number) => n === 2 ? '' : n === 3 ? ' abuel' + o : n === 4 ? ' bisabuel' + o : ' lejan' + o;
  if (b > a) return `sobrin${o}${ordinal(a, o)}${b - a === 2 ? ' niet' + o : b - a > 2 ? ' lejan' + o : ''}`;
  return `tí${o}${ordinal(b, o)}${extra(a - b + 1)}`;
}

/** Relation of the ancestor number `n` in the fan (2 the father, 3 the mother, 4 the paternal grandfather…) */
function fanRelation(n: number): string {
  const gen = Math.floor(Math.log2(n));
  if (gen === 1) return n === 2 ? 'padre' : 'madre';
  const names: Record<number, string> = { 2: 'abuel', 3: 'bisabuel', 4: 'tatarabuel', 5: 'trastatarabuel' };
  const female = n % 2 === 1;
  const side = (n >> (gen - 1)) === 2 ? 'paterna' : 'materna';
  const base = names[gen] ? names[gen] + (female ? 'a' : 'o') : `antepasado de ${gen}ª generación`;
  return `${base} (línea ${side})`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const es = {
  siteTitle: 'Historia de la familia',
  months: MONTHS,
  close: 'Cerrar',
  unavailable: '<p>No disponible.</p>',
  people: (n: number) => plural(n, 'persona', 'personas'),

  kin: {
    blood,
    spouse: 'cónyuge',
    stepSibling: (p: Person) => gender(p, 'hermanastro', 'hermanastra'),
    siblingInLaw: (p: Person) => gender(p, 'cuñado', 'cuñada'),
    childInLaw: (p: Person) => gender(p, 'yerno', 'nuera'),
    parentInLaw: (p: Person) => gender(p, 'suegro', 'suegra'),
    spouseOf: (relative: string) => `cónyuge de su ${relative}`,
    ofSpouse: (relative: string) => `${relative} de su cónyuge`,
    /** «padre de Juan», in tooltips and cards */
    of: (label: string, name: string) => `${label} de ${name}`,
  },

  review: {
    doc: 'Hallado por investigación automática · pendiente de revisar',
    person: { new: 'Investigación automática · pendiente de revisar', partial: 'Contiene datos pendientes de revisar' },
    personTitle: { new: 'Todas sus fuentes están pendientes de revisar', partial: 'Algunas de sus fuentes están pendientes de revisar' },
    docNote: 'Sus datos son provisionales hasta que alguien de la familia la revise.',
    pendingDocs: (n: number) => `${plural(n, 'documento pendiente', 'documentos pendientes')} de revisar`,
  },

  /** Tabs of the views, in order, and the buttons of the person panel that open them */
  views: { home: 'Inicio', tree: 'Árbol', fan: 'Abanico', timeline: 'Cronología', voyage: 'Viaje', map: 'Mapa', documents: 'Documentos', news: 'Novedades' },
  viewsNav: 'Vistas',

  topbar: {
    eyesOf: 'Con los ojos de',
    backTo: (name: string) => `Volver a ${name}`,
  },

  search: {
    placeholder: 'Buscar persona o documento…',
    label: 'Buscar',
  },

  scope: {
    all: 'Todos',
    blood: (name: string) => `Familia de sangre de ${name}`,
    direct: (name: string) => `Antepasados y descendientes de ${name}`,
    filterPeople: 'Filtrar personas',
  },

  drawer: {
    back: 'Volver a la ficha anterior',
    backTitle: 'Volver',
  },

  lightbox: { previous: 'Anterior', next: 'Siguiente' },

  person: {
    alive: 'vive',
    for: (name: string) => `Para ${name}:`,
    noKin: 'sin parentesco conocido',
    eyesTitle: { focus: 'Estás viendo la familia con sus ojos', other: 'Ver la familia con sus ojos' },
    constellation: 'Constelación',
    birth: 'Nacimiento',
    death: 'Defunción',
    occupation: 'Ocupación',
    marriage: 'Matrimonio',
    marriedTo: (name: string) => `con ${name}: `,
    parents: 'Padres',
    confidence: { proven: 'probada con documentos', probable: 'probable (sin documento directo)' },
    parentage: (conf: string) => `Filiación ${conf}.`,
    spouses: 'Cónyuges',
    children: 'Hijos',
    siblings: 'Hermanos',
    stepSiblings: 'Hermanastros',
    documents: 'Documentos donde aparece',
    history: 'Historial de la ficha',
    historyAdded: 'Entra en el árbol',
    historyFirst: 'En el árbol desde el principio',
    renamedFrom: (name: string) => `Antes se llamaba «${name}»`,
    historyMore: 'Ver todas las novedades',
  },

  doc: {
    date: 'Fecha',
    place: 'Lugar',
    issuer: 'Autoridad',
    status: 'Estado',
    reviewedBy: 'Revisada por',
    reviewedByFamily: 'la familia',
    origin: 'Procedencia',
    pages: 'Páginas',
    reference: 'Referencia',
    aiBadge: 'IA',
    aiNote: 'generado por IA · no fiable',
    people: 'Personas',
    images: 'Páginas e imágenes',
    files: 'Ficheros',
    pageCount: (n: number) => `(${n} págs.)`,
    page: (file: string, n: number) => `${file} · p. ${n}`,
    placeholder: 'D',
  },

  research: {
    whichFamily: 'Qué familia ver',
    all: 'Todo',
  },

  home: {
    title: 'Historia de la familia',
    stats: { people: 'personas', generations: 'generaciones', documents: 'documentos', photos: 'fotografías', years: 'años de historia', places: 'lugares' },
    lede: (people: number, gens: number, from: number) =>
      `${people} personas a lo largo de ${gens} generaciones, desde ${from} hasta hoy, ` +
      'reconstruidas a partir de testamentos, actas, fotografías y la memoria de la familia.',
    eyesOf: 'Con los ojos de',
    summary: (up: number, down: number, blood: number, inLaw: number) =>
      `${up} antepasados conocidos, ${down} descendientes, ${blood} parientes de sangre más y ${inLaw} por matrimonio.`,
    seeAncestors: 'Ver los antepasados',
    seeTimeline: 'Recorrer la cronología',
    seeDocuments: 'Ver documentos',
    latestDocuments: 'Últimos documentos',
    latestAdded: 'Documentos añadidos hace poco',
    seeNews: 'Ver todas las novedades',
    pendingReview: 'Pendiente de revisar',
    pendingIntro: 'Datos que no cuadran entre el árbol y los documentos, y lo hallado por investigación automática.',
    inconsistencies: 'Ver incoherencias',
    pendingLines: 'Líneas pendientes',
    revision: 'Revisión',
    severalFamilies: 'de varias familias',
    constellation: {
      label: 'Todas las personas del árbol y sus relaciones',
      caption: 'Cada punto es una persona; las líneas unen padres e hijos, y las discontinuas, matrimonios. ' +
        'Arrastra, acerca y pulsa sobre alguien.',
    },
  },

  tree: {
    title: 'Árbol',
    intro: 'Pulsa en una persona para centrar el árbol en ella y ver su ficha. Borde continuo: filiación probada; ' +
      'discontinuo: probable.',
    unknownParents: 'Padres desconocidos',
  },

  fan: {
    title: 'Abanico de antepasados de ',
    label: 'Abanico de antepasados',
    intro: 'Cada anillo es una generación: a la izquierda la línea paterna, a la derecha la materna. Los huecos son ' +
      'antepasados que aún no conocemos. Pulsa en alguien para ver sus antepasados.',
    relation: fanRelation,
    unknown: (relation: string) => `${relation}: desconocido`,
  },

  timeline: {
    title: 'Cronología',
    label: 'Cronología de vidas',
    intro: 'La vida de cada persona, ordenada por nacimiento. Las barras rayadas y los nombres en cursiva son personas ' +
      'sin fechas: su año se estima a partir de su familia. Arriba, los documentos por año. Pasa el ratón por el eje ' +
      'para ver quién vivía en cada momento.',
    undated: (name: string) => `${name} no tiene fechas ni familiares con fechas, así que no puede aparecer en la cronología.`,
    estimated: (year: number) => `Nacimiento estimado hacia ${year}, a partir de su familia`,
    documents: 'Documentos',
    marriage: (name: string) => `Boda con ${name}`,
  },

  voyage: {
    title: 'Viaje en el tiempo',
    label: 'Viaje en el tiempo por los acontecimientos de la familia',
    intro: 'Los nacimientos, bodas, defunciones y documentos de la familia se acercan a medida que avanzas por los ' +
      'años. Viaja con la rueda del ratón, las flechas o arrastrando arriba y abajo; pulsa una tarjeta para ver la ficha.',
    kinds: {
      birth: { label: 'Nacimiento', plural: 'nacimientos' }, marriage: { label: 'Boda', plural: 'bodas' },
      death: { label: 'Defunción', plural: 'defunciones' }, doc: { label: 'Documento', plural: 'documentos' },
    },
    couple: (a: string, b: string) => `${a} y ${b}`,
    century: (roman: string) => `Siglo ${roman}`,
    events: (n: number) => n === 1 ? 'acontecimiento' : 'acontecimientos',
    places: (places: string[]) => `En ${places.slice(0, 3).join(' · ')}${places.length > 3 ? ` · +${places.length - 3} lugares` : ''}`,
    aliveIn: (year: number, n: number) => `Vivían en ${year}: ${plural(n, 'persona', 'personas')}`,
    undated: (n: number) => n ? `${plural(n, 'persona', 'personas')} sin fecha` : '',
    start: 'Volver al principio',
    goTo: (name: string) => `Ir a ${name}`,
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    fullscreen: { on: 'Pantalla completa', off: 'Salir de pantalla completa' },
    previous: 'Acontecimiento anterior',
    next: 'Acontecimiento siguiente',
    play: 'Reproducir',
    pause: 'Pausa',
    year: 'Año',
  },

  map: {
    title: 'Mapa',
    label: 'Mapa de los lugares de la familia',
    intro: 'Cada punto es un lugar donde nació, se casó o murió alguien de la familia, o de donde es un documento: ' +
      'cuanto más grande, más acontecimientos, y del color de la familia con más gente allí. Las líneas van del lugar ' +
      'de nacimiento de los padres al de sus hijos y, punteadas, del lugar donde nació cada persona al lugar donde murió. ' +
      'Pulsa un punto para ver quién y qué.',
    kindsLabel: 'Qué se ve en el mapa',
    migrations: 'Migraciones',
    migrationsTitle: 'Líneas del lugar de nacimiento de los padres al de sus hijos y, punteadas, del lugar donde nació ' +
      'cada persona al lugar donde murió',
    until: (year: number) => `Hasta ${year}`,
    allYears: 'Todos los años',
    year: 'Año',
    play: 'Recorrer los años',
    fullscreen: { on: 'Pantalla completa', off: 'Salir de pantalla completa' },
    speed: 'Velocidad del recorrido',
    speedLabel: (n: number) => `Velocidad del recorrido: ×${n}`,
    happened: {
      birth: (name: string) => `Nace ${name}`,
      death: (name: string) => `Muere ${name}`,
      marriage: (a: string, b: string | null) => b ? `Se casan ${a} y ${b}` : `Se casa ${a}`,
      doc: (title: string) => title,
    },
    andMore: (n: number) => `y ${n} más`,
    pause: 'Pausa',
    places: (n: number) => plural(n, 'lugar', 'lugares'),
    facts: (n: number) => plural(n, 'acontecimiento', 'acontecimientos'),
    kinds: {
      birth: { label: 'Nacimientos', one: 'nacimiento', many: 'nacimientos' },
      marriage: { label: 'Bodas', one: 'boda', many: 'bodas' },
      death: { label: 'Defunciones', one: 'defunción', many: 'defunciones' },
      doc: { label: 'Documentos', one: 'documento', many: 'documentos' },
    },
    couple: (a: string, b: string) => `${a} y ${b}`,
    writtenAsTitle: (n: number) => n === 1 ? 'Cómo aparece en las fichas' : `Cómo aparece en las fichas (${n} formas)`,
    allPlaces: 'Todos los lugares',
    back: '← Todos los lugares',
    undated: 'sin fecha',
    unlocated: (n: number) => `${plural(n, 'lugar', 'lugares')} sin situar en el mapa`,
    migration: (from: string, to: string) => `De ${from} a ${to}`,
    bornThere: (names: string[]) => `Nacieron allí: ${names.join(', ')}`,
    livedFromTo: (from: string, to: string, names: string[]) => `Nacieron en ${from} y murieron en ${to}: ${names.join(', ')}`,
    offline: 'Sin conexión: no se puede cargar el mapa de fondo. Los lugares se ven sobre un contorno aproximado de la costa.',
    focusNote: (name: string) => `Con borde oscuro, los lugares de ${name}; en trazo continuo, las migraciones de sus antepasados y descendientes.`,
    empty: 'No hay lugares con coordenadas para estas personas y años.',
    attribution: '© colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },

  session: {
    unlock: 'Ver los datos privados',
    lock: 'Cerrar la sesión',
    title: 'Datos privados',
    intro: 'Las personas vivas, sus documentos y los originales escaneados solo se ven con la contraseña de la familia.',
    password: 'Contraseña',
    enter: 'Entrar',
    cancel: 'Cancelar',
    error: 'No se ha podido entrar. Revisa la contraseña o prueba más tarde.',
    originals: 'Los originales escaneados solo se ven con la contraseña de la familia.',
    seeOriginals: 'Entrar para verlos',
    loading: 'Cargando…',
  },

  news: {
    title: 'Novedades',
    intro: 'Lo que ha cambiado en el árbol, día a día: documentos nuevos, personas añadidas y datos corregidos. ' +
      'Pulsa un nombre o un documento para ver su ficha.',
    empty: 'Todavía no hay novedades.',
    emptyFamily: 'No hay novedades de esta familia.',
    first: 'Comienza el árbol',
    summary: (docs: number, people: number, reviewed: number, changed: number): string => [
      docs && plural(docs, 'documento nuevo', 'documentos nuevos'),
      people && plural(people, 'persona nueva', 'personas nuevas'),
      reviewed && plural(reviewed, 'documento revisado', 'documentos revisados'),
      changed && plural(changed, 'ficha actualizada', 'fichas actualizadas'),
    ].filter(Boolean).join(' · '),
    docsAdded: 'Documentos nuevos',
    docsReviewed: 'Documentos revisados por la familia',
    docsUpdated: 'Documentos corregidos o ampliados',
    docsRemoved: 'Documentos retirados',
    peopleAdded: 'Personas nuevas',
    peopleChanged: 'Datos nuevos o corregidos',
    peopleTexts: 'Biografías y notas revisadas',
    peopleRemoved: 'Personas retiradas del árbol',
    peopleRenamed: 'Cambios de nombre',
    renamedFrom: (name: string) => `antes «${name}»`,
    research: 'Investigación',
    researchItem: { opened: 'Nuevo', resolved: 'Resuelto' },
    researchCount: (opened: number, resolved: number): string => [
      opened && plural(opened, 'punto nuevo', 'puntos nuevos'), resolved && plural(resolved, 'resuelto', 'resueltos'),
    ].filter(Boolean).join(' y '),
    notes: { incoherencias: 'Incoherencias', pendientes: 'Pendientes' },
    fields: {
      name: 'nombre', aliases: 'otros nombres', sex: 'sexo', born: 'nacimiento', birthPlace: 'lugar de nacimiento',
      died: 'defunción', deathPlace: 'lugar de defunción', occupation: 'ocupación', parents: 'padres', siblings: 'hermanos',
      spouses: 'matrimonios', photo: 'retrato', biography: 'biografía', notes: 'notas de investigación',
    } satisfies Record<HistoryField, string>,
    /** «Nacimiento, lugar de nacimiento» */
    fieldList: (labels: string[]): string => labels.join(', ').replace(/^./, c => c.toUpperCase()),
    sources: (n: number) => n === 1 ? 'Nueva fuente:' : 'Nuevas fuentes:',
    more: (n: number) => `Ver ${n} más`,
    less: 'Ver menos',
  },

  documents: {
    title: 'Documentos',
    whose: 'Documentos de quién',
    filter: 'Filtrar documentos',
    all: (n: number) => `Todos (${n})`,
    category: (label: string, n: number) => `${label} (${n})`,
    pending: (n: number) => `Pendientes de revisar (${n})`,
    unreferenced: (n: number) => `Sin referencias (${n})`,
    /** Chip of each `status` of STATUS_FILTERS (data.ts) */
    status: { indicio: 'Indicios', 'en-investigacion': 'En investigación', pendiente: 'Por conseguir', 'no-fiable': 'No fiables' } as Record<string, string>,
  },
};
