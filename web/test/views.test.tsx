import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it } from 'vitest';
import { docImages } from '../src/components/DocCard';
import { ScopeChips } from '../src/components/ScopeChips';
import { buildIndex, Search, searchHits } from '../src/components/Search';
import { initData, S } from '../src/data';
import { PersonPanel, siblingsOf } from '../src/panels/PersonPanel';
import { panel, resetRouter, route } from '../src/router';
import { initFocus, setFocus } from '../src/state';
import { Documents } from '../src/views/Documents';
import { fanLabelTransform, fanRelation, fanSegments, fitText } from '../src/views/fanLayout';
import { aliveIn, estimateBirths, lifeRows } from '../src/views/timelineLayout';
import { century, eraSummary, voyageEvents } from '../src/views/voyageEvents';
import { fixture } from './fixture';

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
      .toEqual(['Padres', 'Hermanos', 'Hermanastros', 'Documentos donde aparece']);
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

describe('scope selector and documents', () => {
  it('ScopeChips names the focused person and reports the chosen one', () => {
    let picked = '';
    render(() => <ScopeChips id="s" label="x" value="all" onChange={s => { picked = s; }} />);
    expect(screen.getAllByRole('button').map(b => b.textContent))
      .toEqual(['Todos', 'Familia de sangre de Yo', 'Antepasados y descendientes de Yo']);
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(picked).toBe('direct');
  });
  it('Documents filters by category, by review and by family of the focused person', () => {
    const { container } = render(() => <Documents />);
    const cards = () => [...container.querySelectorAll('#doc-grid .doc-card')].map(d => d.getAttribute('data-doc'));
    const chip = (sel: string) => container.querySelector<HTMLElement>(sel)!;
    expect(cards()).toEqual(['F002', 'F001']);  // by year
    expect([...container.querySelectorAll('#doc-filters .chip')].map(b => b.textContent))
      .toEqual(['Todos (2)', 'Genealogía (1)', 'Fotografías (1)', 'Pendientes de revisar (1)']);
    fireEvent.click(chip('[data-f="foto"]'));
    expect(cards()).toEqual(['F002']);
    expect(chip('[data-f="foto"]').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip('[data-f="review"]'));
    expect(cards()).toEqual(['F001']);
    fireEvent.click(chip('[data-f="all"]'));
    setFocus('tio');
    fireEvent.click(chip('#doc-scope [data-s="direct"]'));
    expect(cards()).toEqual([]);
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
