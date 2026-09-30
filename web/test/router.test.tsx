import { fireEvent, render } from '@solidjs/testing-library';
import { createRoot } from 'solid-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { Drawer } from '../src/components/Drawer';
import { Html } from '../src/components/Html';
import { Topbar } from '../src/components/Topbar';
import { initData } from '../src/data';
import { family, initFamily } from '../src/family';
import { canGoBack, go, openDoc, openPerson, openResearch, panel, resetRouter, route, scope, setScope, useRouter, view, viewHash, type HistoryState } from '../src/router';
import { focus, initFocus } from '../src/state';
import { fixture } from './fixture';

const depth = () => (history.state as HistoryState | null)?.depth;
/** history.back() and forward() are asynchronous in jsdom: wait for popstate */
const traverse = (fn: () => void) => new Promise<void>(resolve => {
  window.addEventListener('popstate', () => setTimeout(resolve), { once: true });
  fn();
});
const at = (hash: string) => { history.replaceState(null, '', hash); route(); };

// The router listens to hashchange and popstate while its owner lives, as in the application
createRoot(() => useRouter());

beforeEach(() => {
  localStorage.clear();
  initData(fixture());
  initFocus();
  initFamily();
  resetRouter();
  at('#');
});

describe('filter of people', () => {
  it('starts at the blood family, and the hash can choose another one', () => {
    at('#mapa/abuela');
    expect(scope()).toBe('blood');
    at('#mapa/abuela?filtro=linea');
    expect([view(), focus(), scope()]).toEqual(['map', 'abuela', 'direct']);
    at('#viaje/yo/p:tia?filtro=todos');
    expect([view(), panel(), scope()]).toEqual(['voyage', 'p:tia', 'all']);
    at('#viaje/yo?filtro=nada');
    expect(scope()).toBe('blood');
  });
  it('choosing it writes it in the hash without a new history entry, and the links keep it', () => {
    at('#cronologia/yo');
    const before = history.length;
    setScope('all');
    expect(location.hash).toBe('#cronologia/yo?filtro=todos');
    expect(history.length).toBe(before);
    expect(viewHash('map', 'tia')).toBe('#mapa/tia?filtro=todos');
    openPerson('tia');
    expect(location.hash).toBe('#cronologia/yo/p:tia?filtro=todos');
    setScope('blood');
    expect(location.hash).toBe('#cronologia/yo/p:tia');
  });
});

describe('route', () => {
  it('without a hash it opens home with the main person', () => {
    expect(view()).toBe('home');
    expect(focus()).toBe('yo');
    expect(panel()).toBe(null);
  });
  it('direct link #arbol/<id>/d:F001: view, focused person and card', () => {
    at('#arbol/abuela/d:F001');
    expect(view()).toBe('tree');
    expect(focus()).toBe('abuela');
    expect(localStorage.getItem('arbre-focus')).toBe('abuela');
    expect(panel()).toBe('d:F001');
  });
  it('the tabs lead to the focused person and mark the active view', () => {
    at('#arbol/abuela');
    const { container } = render(() => <Topbar />);
    expect(container.querySelector('.tabs a[data-view="fan"]')!.getAttribute('href')).toBe('#abanico/abuela');
    expect(container.querySelector('.tabs a.active')?.getAttribute('data-view')).toBe('tree');
    expect(container.querySelector('#focus .pchip')?.getAttribute('data-person')).toBe('abuela');
    // «×» goes back to the main person in the same view
    expect(container.querySelector('.focus-reset')?.getAttribute('href')).toBe('#arbol/yo');
    at('#documentos/yo');
    expect(container.querySelector('.tabs a.active')?.getAttribute('data-view')).toBe('documents');
    expect(container.querySelector('.focus-reset')).toBe(null);
  });
  it('the English names of the views are accepted too', () => {
    at('#timeline/abuela');
    expect(view()).toBe('timeline');
    expect(focus()).toBe('abuela');
  });
  it('unknown views, people and panels break nothing', () => {
    at('#nada/nadie/x:y');
    expect(view()).toBe('home');
    expect(focus()).toBe('yo');
    expect(panel()).toBe(null);
    at('#inicio/yo/d:F999');
    expect(panel()).toBe(null);
  });
});

describe('go, cards and history', () => {
  it('each card opened from another adds depth; the ← button only shows from the second', () => {
    openPerson('padre');
    expect(location.hash).toBe('#inicio/yo/p:padre');
    expect(panel()).toBe('p:padre');
    expect(depth()).toBe(1);
    expect(canGoBack()).toBe(false);
    openDoc('F001');
    expect(location.hash).toBe('#inicio/yo/d:F001');
    expect(depth()).toBe(2);
    expect(canGoBack()).toBe(true);
    openPerson('madre');
    expect(depth()).toBe(3);
    go(null);
    expect(location.hash).toBe('#inicio/yo');
    expect(depth()).toBe(0);
    expect(panel()).toBe(null);
    expect(canGoBack()).toBe(false);
  });
  it('opening the card already open adds no entries', () => {
    openPerson('padre');
    const len = history.length;
    openPerson('padre');
    expect(history.length).toBe(len);
  });
  it('a card opened from the view, without a previous panel, starts at 1', () => {
    openPerson('padre');
    go(null);
    openDoc('F002');
    expect(depth()).toBe(1);
  });
  it('go with another view and person changes the focus', () => {
    go('p:tia', { view: 'tree', id: 'tia' });
    expect(location.hash).toBe('#arbol/tia/p:tia');
    expect(focus()).toBe('tia');
    expect(view()).toBe('tree');
  });
  it('the browser\'s back and forward return to the previous card', async () => {
    openPerson('padre');
    openDoc('F001');
    await traverse(() => history.back());
    expect(location.hash).toBe('#inicio/yo/p:padre');
    expect(panel()).toBe('p:padre');
    expect(canGoBack()).toBe(false);
    await traverse(() => history.forward());
    expect(panel()).toBe('d:F001');
    expect(canGoBack()).toBe(true);
    await traverse(() => history.go(-2));
    expect(panel()).toBe(null);
  });
  it('openResearch with the card already open only changes the family', () => {
    openResearch('revision');
    const len = history.length;
    openResearch('revision', 'roble');
    expect(history.length).toBe(len);
    expect(family()).toBe('roble');
    openResearch('revision', 'several');  // not a family that can be chosen
    expect(family()).toBe('roble');
  });
});

describe('side panel', () => {
  it('shows the panel\'s card and the ← button does history.back()', async () => {
    const { container } = render(() => <Drawer />);
    const drawer = container.querySelector('#drawer')!;
    const title = () => container.querySelector('#drawer-body h2')?.textContent;
    expect(drawer.classList.contains('open')).toBe(false);
    openPerson('padre');
    expect(drawer.classList.contains('open')).toBe(true);
    expect(title()).toBe('Padre Prueba');
    expect((container.querySelector('#drawer-back') as HTMLElement).hidden).toBe(true);
    openDoc('F001');
    expect(title()).toBe('Partida de bautismo de Yo');
    expect((container.querySelector('#drawer-back') as HTMLElement).hidden).toBe(false);
    await traverse(() => fireEvent.click(container.querySelector('#drawer-back')!));
    expect(panel()).toBe('p:padre');
    // When closing, it keeps the card while it slides out
    fireEvent.click(container.querySelector('#drawer-close')!);
    expect(drawer.classList.contains('open')).toBe(false);
    expect(title()).toBe('Padre Prueba');
  });
  it('the data-person, data-doc and data-research links of the generated HTML open their card', () => {
    const { container } = render(() => <Html html={
      '<a id="l1" href="#" data-person="tia">x</a><a id="l2" href="#" data-doc="F002">y</a>' +
      '<a id="l3" href="#" data-research="revision" data-family="pino">z</a>'} />);
    fireEvent.click(container.querySelector('#l1')!);
    expect(panel()).toBe('p:tia');
    fireEvent.click(container.querySelector('#l2')!);
    expect(panel()).toBe('d:F002');
    fireEvent.click(container.querySelector('#l3')!);
    expect(panel()).toBe('r:revision');
    expect(family()).toBe('pino');
    expect(depth()).toBe(3);
  });
});
