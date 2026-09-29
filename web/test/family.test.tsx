import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it } from 'vitest';
import { initData } from '../src/data';
import { defaultFamily, family, familyCount, initFamily, offeredFamilies, researchParts, sectionVisible, setFamily, shownFamily } from '../src/family';
import { ResearchPanel } from '../src/panels/ResearchPanel';
import { fixture } from './fixture';

beforeEach(() => { localStorage.clear(); initData(fixture()); initFamily(); });

describe('family filter', () => {
  it('by default, the family marked `default`; it remembers the chosen one in arbre-familia', () => {
    expect(defaultFamily()).toBe('olmo');
    expect(family()).toBe('olmo');
    setFamily('pino');
    expect(localStorage.getItem('arbre-familia')).toBe('pino');
    localStorage.setItem('arbre-familia', 'roble');
    initFamily();
    expect(family()).toBe('roble');
  });
  it('ignores saved values that are not families', () => {
    localStorage.setItem('arbre-familia', 'several');
    initFamily();
    expect(family()).toBe('olmo');
  });
  it('reads «todo», the former name of «all», saved by older versions', () => {
    localStorage.setItem('arbre-familia', 'todo');
    initFamily();
    expect(family()).toBe('all');
  });
  it('splits the HTML into family sections and what lies between them', () => {
    const parts = researchParts('<h1>T</h1><section data-family="olmo" data-count="2"><h2>A</h2></section><p>fin</p>');
    expect(parts).toEqual([
      { family: null, count: 0, html: '<h1>T</h1>' },
      { family: 'olmo', count: 2, html: '<h2>A</h2>' },
      { family: null, count: 0, html: '<p>fin</p>' },
    ]);
    expect(researchParts('<p>sin apartados</p>')).toEqual([{ family: null, count: 0, html: '<p>sin apartados</p>' }]);
  });
  it('only offers the families with a section, and always «All»', () => {
    const parts = researchParts(fixture().research.revision!);
    expect(offeredFamilies(parts).map(([k]) => k)).toEqual(['olmo', 'pino', 'all']);
    expect(shownFamily(offeredFamilies(parts), 'roble')).toBe('all');
    expect(shownFamily(offeredFamilies(parts), 'pino')).toBe('pino');
  });
  it('«several» and «general» are always shown', () => {
    expect(sectionVisible('olmo', 'olmo')).toBe(true);
    expect(sectionVisible('roble', 'olmo')).toBe(false);
    expect(sectionVisible('general', 'olmo')).toBe(true);
    expect(sectionVisible('several', 'pino')).toBe(true);
    expect(sectionVisible('roble', 'all')).toBe(true);
  });
  it('counts the points of each family', () => {
    const parts = researchParts(fixture().research.revision!);
    expect(familyCount(parts, 'olmo')).toBe(3);
    expect(familyCount(parts, 'roble')).toBe(0);
    expect(familyCount(parts, 'all')).toBe(6);
  });
});

describe('research card', () => {
  const buttons = () => screen.queryAllByRole('button') as HTMLButtonElement[];
  const visible = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('section[data-family]')]
    .filter(s => !s.hidden).map(s => s.dataset.family);

  it('shows the selector with the counts and filters the sections', () => {
    const { container } = render(() => <ResearchPanel name="revision" />);
    expect(buttons().map(b => b.textContent)).toEqual(['Familia Olmo · 3', 'Familia Pino · 2', 'Todo · 6']);
    expect(buttons().map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(visible(container)).toEqual(['olmo', 'several']);
    fireEvent.click(buttons()[1]);
    expect(visible(container)).toEqual(['pino', 'several']);
    expect(buttons().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(localStorage.getItem('arbre-familia')).toBe('pino');
    fireEvent.click(buttons()[2]);
    expect(visible(container)).toEqual(['olmo', 'pino', 'several']);
  });
  it('if the chosen family has no section, everything is shown', () => {
    setFamily('roble');
    const { container } = render(() => <ResearchPanel name="revision" />);
    expect(visible(container)).toEqual(['olmo', 'pino', 'several']);
    expect(family()).toBe('roble');
  });
  it('documents without sections have no selector', () => {
    const { container } = render(() => <ResearchPanel name="pendientes" />);
    expect(buttons()).toEqual([]);
    expect(container.querySelector('.research-pendientes')?.textContent).toBe('Sin apartados de familia');
  });
});
