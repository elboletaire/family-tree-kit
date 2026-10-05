import { fireEvent, render } from '@solidjs/testing-library';
import { createRoot } from 'solid-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { initData } from '../src/data';
import { openPlace, place, resetRouter, route, scope, useRouter } from '../src/router';
import { initFocus } from '../src/state';
import { MapView } from '../src/views/Map';
import { fixture } from './fixture';

const BAJO = '43.500,-5.700', ALTA = '43.100,-5.900';
const at = (hash: string) => { history.replaceState(null, '', hash); route(); };

createRoot(() => useRouter());

beforeEach(() => {
  localStorage.clear();
  initData(fixture());
  initFocus();
  resetRouter();
  at('#mapa/yo');
});

describe('map view', () => {
  it('the place of the hash is chosen; clicking another in the list writes it', () => {
    at(`#mapa/yo?lugar=${ALTA}`);
    const { container } = render(() => <MapView />);
    expect(container.querySelector('#map-side h3')?.textContent).toBe('Villa Alta');
    fireEvent.click(container.querySelector('#map-side .map-back')!);
    expect(place()).toBe(null);
    fireEvent.click(container.querySelector(`#map-side [data-place="${BAJO}"]`)!);
    expect(location.hash).toBe(`#mapa/yo?lugar=${BAJO}`);
    expect(container.querySelector('#map-side h3')?.textContent).toBe('Puerto Bajo');
  });
  it('a place left out by the year or the kinds of facts brings the whole tree, all the years and the kinds', () => {
    localStorage.setItem('arbre-map-hidden', 'doc');
    const { container } = render(() => <MapView />);
    const year = container.querySelector('#map-year') as HTMLInputElement;
    fireEvent.input(year, { target: { value: '1920' } });
    expect(container.querySelector('#map-until')?.textContent).toBe('Hasta 1920');
    fireEvent.click(container.querySelector('#map-kind-birth')!);
    expect((container.querySelector('#map-kind-birth') as HTMLInputElement).checked).toBe(false);
    openPlace(BAJO);
    expect([place(), scope()]).toEqual([BAJO, 'all']);
    expect(container.querySelector('#map-until')?.textContent).toBe('Todos los años');
    expect(container.querySelector('#map-side h3')?.textContent).toBe('Puerto Bajo');
    expect((container.querySelector('#map-kind-birth') as HTMLInputElement).checked).toBe(true);
    // Leaving it out again with the year, the list comes back and the hash forgets it
    fireEvent.input(year, { target: { value: '1920' } });
    expect(place()).toBe(null);
    expect(location.hash).toBe('#mapa/yo?filtro=todos');
    expect(container.querySelector('#map-side h3')).toBe(null);
  });
});
