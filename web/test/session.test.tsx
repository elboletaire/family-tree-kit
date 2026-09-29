/* The lock of the site: the public version opens the private data with the password, in the same view and focus */
import { fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { DATA, initData } from '../src/data';
import { initFamily } from '../src/family';
import { resetRouter } from '../src/router';
import { CLOSED_SITE, page, PRIVATE_DATA_URL, resumeSession, SESSION_HINT, SITE_MODE_HEADER } from '../src/session';
import { focus, initFocus, savedFocus, setFocus } from '../src/state';
import { fixture, privateFixture, publicFixture } from './fixture';

const PASSWORD = 'secreto';

/** A server like deploy/server.py: the private data only after the right password. `closed`: the site has no public
 *  version (PUBLIC_SITE=0); `gate`: the private data wait for it */
function server({ closed = false, gate }: { closed?: boolean; gate?: Promise<void> } = {}) {
  let session = false;
  const calls: string[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === 'login') {
      session = JSON.parse(String(init!.body)).password === PASSWORD;
      return new Response(null, { status: session ? 200 : 401 });
    }
    if (url === 'logout') {
      session = false;
      return new Response(null, { status: 204, headers: { [SITE_MODE_HEADER]: closed ? CLOSED_SITE : 'public' } });
    }
    if (url === PRIVATE_DATA_URL) {
      await gate;
      return session ? Response.json(privateFixture()) : new Response(null, { status: 401 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  return { calls, login: () => { session = true; } };
}

function open(data = publicFixture(), hash = '#documentos') {
  localStorage.clear();
  history.replaceState(null, '', hash);
  initData(data);
  initFocus();
  initFamily();
  resetRouter();
  return render(() => <App />);
}

beforeEach(() => { document.cookie = `${SESSION_HINT}=; max-age=0`; });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('lock', () => {
  it('the whole web opened without a server has no lock', () => {
    const { container } = open(fixture());
    expect(container.querySelector('#lock')).toBe(null);
  });

  it('the public version opens through the eyes of a deceased person, with the living as «Persona viva»', () => {
    const { container } = open(publicFixture(), '#documentos');
    expect(focus()).toBe('padre');
    expect(container.querySelector('#lock')!.getAttribute('aria-label')).toBe('Ver los datos privados');
    expect(DATA.people.find(p => p.id === 'living-1')!.name).toBe('Persona viva');
    expect(DATA.people.some(p => p.id === 'yo')).toBe(false);
  });

  it('a wrong password shows an error without details and loads nothing', async () => {
    const { calls } = server();
    const { container } = open();
    fireEvent.click(container.querySelector('#lock')!);
    const form = document.querySelector<HTMLFormElement>('#login')!;
    expect(document.activeElement).toBe(form.querySelector('input'));
    form.querySelector('input')!.value = 'no';
    fireEvent.submit(form);
    await waitFor(() => expect(document.querySelector('.modal-error')).not.toBe(null));
    expect(document.querySelector('.modal-error')!.textContent).toBe('No se ha podido entrar. Revisa la contraseña o prueba más tarde.');
    expect(DATA.access).toBe('public');
    expect(calls).toEqual(['POST login']);
  });

  it('the right password loads the private data in the same view and focus, and closing goes back', async () => {
    server();
    const { container } = open(publicFixture(), '#documentos/living-1/p:living-1');
    expect(focus()).toBe('living-1');
    fireEvent.click(container.querySelector('#lock')!);
    const form = document.querySelector<HTMLFormElement>('#login')!;
    form.querySelector('input')!.value = PASSWORD;
    fireEvent.submit(form);
    await waitFor(() => expect(DATA.access).toBe('private'));
    // The opaque id of the hash becomes the real one
    expect(location.hash).toBe('#documentos/yo/p:yo');
    expect(focus()).toBe('yo');
    expect(document.querySelector('#login')).toBe(null);
    const lock = container.querySelector('#lock')!;
    expect(lock.classList.contains('open')).toBe(true);
    expect(lock.getAttribute('aria-label')).toBe('Cerrar la sesión');
    expect(container.querySelector('#drawer-body h2')!.textContent).toBe('Yo Prueba');

    fireEvent.click(lock);
    await waitFor(() => expect(DATA.access).toBe('public'));
    expect(location.hash).toBe('#documentos/living-1/p:living-1');
    expect(focus()).toBe('living-1');
    expect(container.querySelector('#drawer-body h2')!.textContent).toBe('Persona viva');
    expect(container.querySelector('#lock')!.classList.contains('open')).toBe(false);
  });

  async function unlock(container: HTMLElement) {
    fireEvent.click(container.querySelector('#lock')!);
    const form = document.querySelector<HTMLFormElement>('#login')!;
    form.querySelector('input')!.value = PASSWORD;
    fireEvent.submit(form);
    await waitFor(() => expect(DATA.access).toBe('private'));
  }

  it('without a chosen focus, the private data open through the eyes of their main person, without remembering it', async () => {
    server();
    const { container } = open(publicFixture(), '#documentos');
    expect(focus()).toBe('padre');
    await unlock(container);
    expect(focus()).toBe('yo');
    expect(savedFocus()).toBe(null);
    expect(container.querySelector('.focus-reset')).toBe(null);
    fireEvent.click(container.querySelector('#lock')!);
    await waitFor(() => expect(DATA.access).toBe('public'));
    expect(focus()).toBe('padre');
    expect(savedFocus()).toBe(null);
  });

  it('the public main person remembered is only the default: the private data open with their own', async () => {
    server();
    const { container } = open(publicFixture(), '#documentos');
    localStorage.setItem('arbre-focus', 'padre');
    await unlock(container);
    expect(focus()).toBe('yo');
    expect(container.querySelector('.focus-reset')).toBe(null);
  });

  it('a chosen focus is kept on unlocking', async () => {
    server();
    const { container } = open(publicFixture(), '#documentos');
    setFocus('abuelo');
    await unlock(container);
    expect(focus()).toBe('abuelo');
    expect(savedFocus()).toBe('abuelo');
  });

  it('Escape closes the dialog', () => {
    const { container } = open();
    fireEvent.click(container.querySelector('#lock')!);
    expect(document.querySelector('#login')).not.toBe(null);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('#login')).toBe(null);
  });

  it('on opening, the private data are asked for only if the server left its hint of a session', async () => {
    const { calls, login } = server();
    open();
    resumeSession();
    expect(calls).toEqual([]);
    login();
    document.cookie = `${SESSION_HINT}=1`;
    resumeSession();
    await waitFor(() => expect(DATA.access).toBe('private'));
    expect(calls).toEqual([`GET ${PRIVATE_DATA_URL}`]);
  });

  it('with a session, nothing is drawn until the private data arrive: never «Persona viva»', async () => {
    let arrive!: () => void;
    const { login } = server({ gate: new Promise<void>(r => { arrive = r; }) });
    login();
    document.cookie = `${SESSION_HINT}=1`;
    localStorage.clear();
    history.replaceState(null, '', '#documentos/living-1/p:living-1');
    initData(publicFixture());
    initFocus();
    initFamily();
    resetRouter();
    const resumed = resumeSession();
    const { container } = render(() => <App />);
    expect(container.querySelector('.loading')!.textContent).toBe('Cargando…');
    expect(container.textContent).not.toContain('Persona viva');
    expect(container.querySelector('#lock')).toBe(null);
    arrive();
    expect(await resumed).toBe(true);
    await waitFor(() => expect(container.querySelector('#lock')).not.toBe(null));
    expect(container.querySelector('.loading')).toBe(null);
    expect(DATA.access).toBe('private');
    expect(container.querySelector('#drawer-body h2')!.textContent).toBe('Yo Prueba');
  });

  it('if the session has gone, the public version is drawn after the wait', async () => {
    server();
    document.cookie = `${SESSION_HINT}=1`;
    const { container } = open();
    expect(await resumeSession()).toBe(false);
    await waitFor(() => expect(container.querySelector('#lock')).not.toBe(null));
    expect(DATA.access).toBe('public');
  });

  it('in a closed site, the open lock closes the session and reloads the page (the server\'s login page)', async () => {
    const { login } = server({ closed: true });
    const reload = vi.spyOn(page, 'reload').mockImplementation(() => undefined);
    login();
    document.cookie = `${SESSION_HINT}=1`;
    const { container } = open();
    await resumeSession();
    await waitFor(() => expect(container.querySelector('#lock.open')).not.toBe(null));
    fireEvent.click(container.querySelector('#lock')!);
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(DATA.access).toBe('private');  // the page goes away: there is no public version to go back to
  });
});
