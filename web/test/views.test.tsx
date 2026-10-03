import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it } from 'vitest';
import { docImages } from '../src/components/DocCard';
import { ScopeChips } from '../src/components/ScopeChips';
import { buildIndex, Search, searchHits } from '../src/components/Search';
import { DATA, initData, S } from '../src/data';
import { DocPanel } from '../src/panels/DocPanel';
import { PersonPanel, siblingsOf } from '../src/panels/PersonPanel';
import { panel, resetRouter, route } from '../src/router';
import { initFocus, setFocus } from '../src/state';
import { Documents } from '../src/views/Documents';
import { News } from '../src/views/News';
import { ALL, family, setFamily } from '../src/family';
import { addedDocIds, daySummary, familyHistory, type FamilyOf, knownHistory, newsFamilies, personHistory, recentDocs, splitChanges } from '../src/views/newsLayout';
import { fanLabelTransform, fanRelation, fanSegments, fitText } from '../src/views/fanLayout';
import { aliveIn, estimateBirths, lifeRows } from '../src/views/timelineLayout';
import { century, eraSummary, voyageEvents } from '../src/views/voyageEvents';
import { fixture, publicFixture } from './fixture';

beforeEach(() => {
  localStorage.clear();
  initData(fixture());
  initFocus();
  resetRouter();
  history.replaceState(null, '', '#');
  route();
});

describe('search', () => {
  it('without accents, with all the words and from two letters', () => {
    const index = buildIndex();
    expect(searchHits(index, 'j')).toEqual([]);
    expect(searchHits(index, 'nunez').map(h => h.id)).toEqual(['jose-nunez']);
    expect(searchHits(index, '  JOSÉ  pérez ').map(h => h.id)).toEqual(['jose-nunez']);
    expect(searchHits(index, 'jose garcia')).toEqual([]);
    expect(searchHits(index, 'f001')).toMatchObject([{ kind: 'd', id: 'F001', sub: 'F001' }]);
    expect(searchHits(index, 'prueba').length).toBe(9);
    const many = Array.from({ length: 20 }, (_, i) => ({ kind: 'p' as const, id: `p${i}`, label: '', sub: '', key: `persona ${i}` }));
    expect(searchHits(many, 'persona').length).toBe(12);
  });
  it('is chosen with the arrows and Enter, and opens the card', () => {
    render(() => <Search />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'prueba ab' } });
    const options = () => screen.getAllByRole('option');
    expect(options().map(o => o.textContent)).toEqual(['Abuelo Prueba1900–1970', 'Abuela Prueba1905–?']);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(panel()).toBe('p:abuela');
    expect(input.value).toBe('');
    expect(screen.getByRole('listbox', { hidden: true }).hidden).toBe(true);
  });
});

describe('person card', () => {
  it('siblings and step-siblings', () => {
    expect(siblingsOf(fixture().people.find(p => p.id === 'yo')!)).toEqual({ siblings: ['hermana'], step: ['hermanastro'] });
  });
  it('parents, kinship with the focused person and documents', () => {
    setFocus('hermana');
    const { container } = render(() => <PersonPanel id="yo" />);
    expect(container.querySelector('h2')!.textContent).toBe('Yo Prueba');
    expect([...container.querySelectorAll('h3')].map(h => h.textContent))
      .toEqual(['Padres', 'Hermanos', 'Hermanastros', 'Documentos donde aparece', 'Historial de la ficha']);
    expect(container.querySelector('.kin')!.textContent).toBe('Para hermana: hermano');
    expect(container.querySelector('.review-flag')!.textContent).toBe('Contiene datos pendientes de revisar');
    expect([...container.querySelectorAll('.mini-docs .doc-card')].map(d => d.getAttribute('data-doc'))).toEqual(['F001']);
    // The kinship follows the focused person
    setFocus('abuelo');
    expect(container.querySelector('.kin')!.textContent).toBe('Para abuelo: nieto');
    fireEvent.click(container.querySelector('.people-chips .pchip')!);
    expect(panel()).toBe('p:padre');
  });
});

describe('document card', () => {
  it('shows the addresses of its fields as links that open in another tab', () => {
    const data = fixture();
    data.docs[0].origin = 'Archivo de Villaficticia (copia en https://example.org/f001?p=2).';
    initData(data);
    const { container } = render(() => <DocPanel id={data.docs[0].id} />);
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.facts a')];
    expect(links.map(a => [a.getAttribute('href'), a.textContent, a.target, a.rel]))
      .toEqual([['https://example.org/f001?p=2', 'https://example.org/f001?p=2', '_blank', 'noopener noreferrer']]);
    expect(links[0].closest('td')!.textContent).toBe(data.docs[0].origin);
  });
});

describe('scope selector and documents', () => {
  it('ScopeChips names the focused person and reports the chosen one', () => {
    let picked = '';
    render(() => <ScopeChips id="s" label="x" value="all" onChange={s => { picked = s; }} />);
    expect(screen.getAllByRole('button').map(b => b.textContent))
      .toEqual(['Todos', 'Familia de sangre de Yo', 'Antepasados y descendientes de Yo']);
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(picked).toBe('direct');
  });
  it('Documents filters by category, by status, by review and by family of the focused person', () => {
    const { container } = render(() => <Documents />);
    const cards = () => [...container.querySelectorAll('#doc-grid .doc-card')].map(d => d.getAttribute('data-doc'));
    const chip = (sel: string) => container.querySelector<HTMLElement>(sel)!;
    expect(cards()).toEqual(['F002', 'F001']);  // by year
    expect([...container.querySelectorAll('#doc-filters .chip')].map(b => b.textContent))
      .toEqual(['Todos (2)', 'Genealogía (1)', 'Fotografías (1)', 'Indicios (1)', 'Pendientes de revisar (1)']);
    fireEvent.click(chip('[data-f="foto"]'));
    expect(cards()).toEqual(['F002']);
    expect(chip('[data-f="foto"]').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip('[data-f="status:indicio"]'));
    expect(cards()).toEqual(['F002']);
    fireEvent.click(chip('[data-f="review"]'));
    expect(cards()).toEqual(['F001']);
    fireEvent.click(chip('[data-f="all"]'));
    setFocus('tio');
    fireEvent.click(chip('#doc-scope [data-s="direct"]'));
    expect(cards()).toEqual([]);
  });
  it('Documents lists the documents nobody cites, and hides that chip when there are none', () => {
    expect(render(() => <Documents />).container.querySelector('[data-f="unreferenced"]')).toBeNull();
    const data = fixture();
    data.docs.push({ ...data.docs[0], id: 'F003', people: [], review: '' });
    initData(data);
    const { container } = render(() => <Documents />);
    const chip = container.querySelector<HTMLElement>('[data-f="unreferenced"]')!;
    expect(chip.textContent).toBe('Sin referencias (1)');
    fireEvent.click(chip);
    expect([...container.querySelectorAll('#doc-grid .doc-card')].map(d => d.getAttribute('data-doc'))).toEqual(['F003']);
  });
});

describe('fan', () => {
  it('numbers the ancestors and leaves gaps for the unknown ones', () => {
    const segs = fanSegments('yo');
    expect(segs.map(s => [s.key, s.id ?? null])).toEqual([
      [2, 'padre'], [4, 'abuelo'], [8, null], [9, null], [5, 'abuela'], [10, null], [11, null], [3, 'madre'], [6, null], [7, null],
    ]);
    const padre = segs.find(s => s.key === 2)!;
    expect(padre.a0).toBeCloseTo(-Math.PI * .75);
    expect(padre.a1).toBeCloseTo(0);
  });
  it('names the relation by line', () => {
    expect(fanRelation(2)).toBe('padre');
    expect(fanRelation(3)).toBe('madre');
    expect(fanRelation(5)).toBe('abuela (línea paterna)');
    expect(fanRelation(12)).toBe('bisabuelo (línea materna)');
    expect(fanRelation(64)).toBe('antepasado de 6ª generación (línea paterna)');
  });
  it('trims the names that do not fit and rotates them to be readable', () => {
    expect(fitText('Bartolomé', 50, s => s.length * 10)).toBe('Bar…');
    expect(fitText('Ana', 10, s => s.length * 10)).toBe('Ana');
    const segs = fanSegments('yo');
    expect(fanLabelTransform(segs.find(s => s.key === 3)!)).toMatch(/rotate\(67\.5\)$/);
  });
});

describe('timeline', () => {
  it('estimates the birth of whoever has no dates from their family', () => {
    const est = estimateBirths();
    expect(est.get('madre')).toBe(1931);    // spouse (1930) and child (1960 - 28)
    expect(est.get('hermana')).toBe(1959);  // father (1930 + 28) and sibling (1960); the mother not estimated yet
    expect(est.get('tia')).toBe(1930);      // parents (1900 + 28, 1905 + 28) and sibling (1930)
    expect(est.has('suelto1')).toBe(false);
  });
  it('sorts the lives and knows who was alive each year', () => {
    const rows = lifeRows(estimateBirths(), null, 2026);
    expect(rows.slice(0, 3).map(r => r.p.id)).toEqual(['abuelo', 'abuela', 'padre']);
    const abuela = rows.find(r => r.p.id === 'abuela')!;
    expect(abuela.open).toBe(true);
    expect([aliveIn(abuela, 1960), aliveIn(abuela, 1970)]).toEqual([true, false]);  // without a death date: 60 years
    expect(rows.find(r => r.p.id === 'madre')!.est).toBe(true);
    expect(lifeRows(estimateBirths(), new Set(['yo']), 2026).map(r => r.p.id)).toEqual(['yo']);
  });
});

describe('voyage', () => {
  it('gathers births, weddings, deaths and documents, and marks those of the focused person', () => {
    const ev = voyageEvents('yo', null);
    expect(ev.map(e => `${e.kind}:${e.p?.id ?? e.d!.id}`)).toEqual([
      'birth:abuelo', 'birth:abuela', 'birth:padre', 'marriage:madre', 'doc:F002', 'birth:yo', 'doc:F001', 'death:abuelo',
    ]);
    expect(ev.filter(e => e.mine).map(e => e.kind)).toEqual(['birth', 'doc']);
    expect(ev.every(e => Math.abs(e.x) < 1 && Math.abs(e.y) < 1)).toBe(true);
  });
  it('summarizes each era', () => {
    const era = eraSummary(voyageEvents('yo', null), 1950);
    expect(era).toMatchObject({ from: 1950, to: 1974, total: 5, counts: [['birth', 1], ['marriage', 1], ['death', 1], ['doc', 2]], places: ['Salamanca', 'Puerto Bajo'] });
    expect(century(1900)).toBe('XIX');
    expect(century(1901)).toBe('XX');
  });
});

describe('documents', () => {
  it('docImages joins photos and PDF pages', () => {
    expect(docImages(S.get('F002')!)).toEqual([{ thumb: 'media/F002/t.jpg', preview: 'media/F002/p.jpg', name: 'boda.jpg' }]);
    const pdf = { ...S.get('F001')!, files: [{ name: 'a.pdf', url: 'a.pdf', kind: 'pdf' as const, pageImages: [{ thumb: 't1', preview: 'p1' }, { thumb: 't2', preview: 'p2' }] }] };
    expect(docImages(pdf).map(i => i.name)).toEqual(['a.pdf · p. 1', 'a.pdf · p. 2']);
  });
});

describe('novedades', () => {
  const all = () => true;
  beforeEach(() => setFamily(ALL));
  it('the documents added last, newest first, and without history those of the fallback', () => {
    expect(addedDocIds(DATA.history)).toEqual(['F002', 'F001']);
    const byDate = () => [S.get('F001')!];
    expect(recentDocs(DATA.history, S, all, byDate)).toEqual({ docs: [S.get('F002'), S.get('F001')], added: true });
    // What `keep` leaves out does not count; if nothing is left, the fallback
    expect(recentDocs(DATA.history, S, d => d.category !== 'foto', byDate).docs.map(d => d.id)).toEqual(['F001']);
    expect(recentDocs(DATA.history, S, () => false, byDate)).toEqual({ docs: [S.get('F001')], added: false });
    expect(recentDocs([], S, all, byDate, 1)).toEqual({ docs: [S.get('F001')], added: false });
    // A document of the history the data do not have (the public version) is skipped
    expect(recentDocs(publicFixture().history, new Map([['F002', S.get('F002')!]]), all, byDate).docs.map(d => d.id)).toEqual(['F002']);
  });
  it('the history of a person, newest first', () => {
    expect(personHistory(DATA.history, 'abuelo')).toEqual([
      { date: '2026-03-10', added: false, first: false, fields: ['died', 'deathPlace'], sources: ['F002'], renamedFrom: null },
      { date: '2026-02-20', added: true, first: true, fields: [], sources: [], renamedFrom: null },
    ]);
    expect(personHistory(DATA.history, 'tia')[0]).toMatchObject({ renamedFrom: 'Tia Sin Apellidos', fields: ['biography', 'notes'] });
    expect(personHistory(DATA.history, 'yo').map(e => [e.date, e.added])).toEqual([['2026-03-10', false], ['2026-03-02', true]]);
    expect(personHistory(DATA.history, 'suelto1')).toEqual([]);
  });
  it('splits new facts from revised texts, counts a day and drops unknown ids', () => {
    const { facts, texts } = splitChanges(DATA.history[0].peopleChanged);
    expect([facts.map(c => c.id), texts.map(c => c.id)]).toEqual([['abuelo', 'yo'], ['tia']]);
    expect(daySummary(DATA.history[0])).toEqual({ docs: 1, people: 0, reviewed: 1, changed: 3 });
    const known = knownHistory(DATA.history, id => id !== 'yo', id => id !== 'F002');
    expect(known[0].docsAdded).toEqual([]);
    expect(known[0].peopleChanged.map(c => [c.id, c.sources])).toEqual([['abuelo', []], ['tia', []]]);
    expect(known[1].peopleAdded).toEqual(['primo']);
  });
  it('the view lists each day with links to people and documents', () => {
    const { container } = render(() => <News />);
    const days = [...container.querySelectorAll('.news-day')];
    expect(days.map(d => d.getAttribute('data-date'))).toEqual(['2026-03-10', '2026-03-02', '2026-02-20']);
    expect(days[0].querySelector('header p')!.textContent).toBe('1 documento nuevo · 1 documento revisado · 3 fichas actualizadas');
    expect([...days[0].querySelectorAll('h4')].map(h => h.textContent)).toEqual([
      'Documentos nuevos', 'Documentos revisados por la familia', 'Datos nuevos o corregidos', 'Cambios de nombre',
      'Biografías y notas revisadas', 'Personas retiradas del árbol', 'Documentos retirados', 'Investigación: 2 puntos nuevos y 1 resuelto',
    ]);
    const abuelo = [...days[0].querySelectorAll('.news-list li')].find(li => li.querySelector('[data-person="abuelo"]'))!;
    expect(abuelo.textContent).toBe('Abuelo Prueba Defunción, lugar de defunción. Nueva fuente: F002');
    expect(days[2].querySelector('.badge')!.textContent).toBe('Comienza el árbol');
    fireEvent.click(days[0].querySelector('.news-doc')!);
    expect(panel()).toBe('d:F002');
    fireEvent.click(days[1].querySelector('[data-person="primo"]')!);
    expect(panel()).toBe('p:primo');
  });
  it('filters each day by family: its own and the shared items, the people of none, but not the documents of none', () => {
    const of: FamilyOf = { person: id => DATA.people.find(p => p.id === id)?.families ?? [], doc: id => S.get(id)?.family };
    expect(familyHistory(DATA.history, ALL, of)).toBe(DATA.history);
    const roble = familyHistory(DATA.history, 'roble', of);
    // The day of «yo» and F001 (both of Olmo) is left empty and dropped
    expect(roble.map(e => e.date)).toEqual(['2026-03-10', '2026-02-20']);
    expect(roble[0]).toMatchObject({ docsAdded: ['F002'], docsReviewed: [], peopleChanged: [], peopleRenamed: [],
      peopleRemoved: ['Primo Duplicado'], docsRemoved: ['F009 — Copia repetida'] });
    expect(roble[0].research.map(r => r.family)).toEqual(['roble', 'general']);
    expect(daySummary(roble[0])).toEqual({ docs: 1, people: 0, reviewed: 0, changed: 0 });
    expect(roble[1].peopleAdded).toEqual(['madre']);
    // A document nobody cites («general») only shows under «All»
    const uncited: FamilyOf = { ...of, doc: id => id === 'F002' ? 'general' : S.get(id)?.family };
    expect(familyHistory(DATA.history, 'roble', uncited)[0].docsAdded).toEqual([]);
    const olmo = familyHistory(DATA.history, 'olmo', of);
    expect(olmo[0].peopleChanged.map(c => c.id)).toEqual(['abuelo', 'yo', 'tia']);
    expect(olmo[0].research.map(r => r.family)).toEqual(['olmo', 'general']);
    // Pino is not named by the history: not offered
    expect(newsFamilies(DATA.history, [['olmo', 'Olmo'], ['roble', 'Roble'], ['pino', 'Pino'], [ALL, 'Todo']], of))
      .toEqual([{ key: 'olmo', label: 'Olmo' }, { key: 'roble', label: 'Roble' }, { key: ALL, label: 'Todo' }]);
  });
  it('the view has the family selector of the research documents, and the same choice', () => {
    const { container } = render(() => <News />);
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.view-head .family-switch button')];
    expect(buttons.map(b => b.textContent)).toEqual(['Familia Olmo', 'Familia Roble', 'Todo']);
    expect(container.querySelector('[aria-pressed="true"]')!.getAttribute('data-family-show')).toBe(ALL);
    fireEvent.click(buttons[1]);
    expect(family()).toBe('roble');
    const days = [...container.querySelectorAll('.news-day')];
    expect(days.map(d => d.getAttribute('data-date'))).toEqual(['2026-03-10', '2026-02-20']);
    expect(days[0].querySelector('header p')!.textContent).toBe('1 documento nuevo');
    expect(days[0].textContent).not.toContain('Abuelo Prueba');
    // A family the history does not name shows everything
    setFamily('pino');
    expect(container.querySelectorAll('.news-day').length).toBe(3);
  });
  it('long lists show the first ones and the rest on demand', () => {
    const many = Array.from({ length: 14 }, (_, i) => `p${i}`);
    initData({ ...fixture(), people: [...fixture().people, ...many.map(id => ({ ...fixture().people[0], id, name: id }))],
               history: [{ ...fixture().history[2], peopleAdded: many }] });
    const { container } = render(() => <News />);
    expect(container.querySelectorAll('.news-chips li').length).toBe(12);
    fireEvent.click(screen.getByRole('button', { name: 'Ver 2 más' }));
    expect(container.querySelectorAll('.news-chips li').length).toBe(14);
  });
  it('the person card has their history', () => {
    const { container } = render(() => <PersonPanel id="tia" />);
    expect([...container.querySelectorAll('.p-history li')].map(li => li.textContent)).toEqual([
      '10 mar 2026 Antes se llamaba «Tia Sin Apellidos». Biografía, notas de investigación',
      '20 feb 2026 En el árbol desde el principio',
    ]);
    const other = render(() => <PersonPanel id="suelto1" />);
    expect(other.container.querySelector('.p-history')).toBeNull();
  });
  it('without history, a note', () => {
    initData({ ...fixture(), history: [] });
    render(() => <News />);
    expect(screen.getByText('Todavía no hay novedades.')).toBeTruthy();
  });
  it('the public version has no research, removed nor renamed', () => {
    initData(publicFixture());
    const { container } = render(() => <News />);
    const text = container.textContent!;
    for (const word of ['Investigación', 'retirad', 'Cambios de nombre', 'Yo Prueba', 'F001', 'notas de investigación']) expect(text).not.toContain(word);
  });
});
