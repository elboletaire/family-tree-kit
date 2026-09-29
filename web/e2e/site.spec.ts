/* The site as deploy/server.py serves it (see playwright.config.ts): the public version, without the living, and the
   lock that opens the private data with the password, in the same view and focus. */
import { expect, test, type Page } from '@playwright/test';

const SITE = 'http://127.0.0.1:8766/';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password';
const lock = (page: Page) => page.locator('#lock');
const chip = (page: Page) => page.locator('#focus .pchip');
const hash = (page: Page) => page.evaluate(() => decodeURIComponent(location.hash));
// DATA is the global of the page: the public data it was served with (the private ones live in the bundle)
const access = (page: Page) => page.evaluate(() => DATA.access);
const status = (page: Page, url: string) => page.evaluate(u => fetch(u).then(r => r.status), url);

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  (page as Page & { errors?: string[] }).errors = errors;
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors).toEqual([]);
});

async function login(page: Page, password: string) {
  await lock(page).click();
  const form = page.locator('#login');
  await expect(form).toBeVisible();
  await expect(form.locator('input')).toBeFocused();
  await form.locator('input').fill(password);
  await form.locator('button[type="submit"]').click();
}

test('the whole web opened without a server has no lock', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('#view-home')).toHaveClass(/active/);
  await expect(lock(page)).toHaveCount(0);
});

test('the public version: «Persona viva» in the tree, and nothing private without a session', async ({ page }) => {
  await page.goto(SITE + '#arbol');
  await expect(lock(page)).toHaveAttribute('aria-label', 'Ver los datos privados');
  expect(await access(page)).toBe('public');
  const data = await page.evaluate(() => ({
    living: DATA.people.filter(p => p.living).map(p => [p.id, p.name, p.born, p.photo, p.sources.length, p.html]),
    research: Object.keys(DATA.research).length,
    files: DATA.docs.reduce((n, d) => n + d.files.length, 0),
  }));
  expect(data.living.length).toBeGreaterThan(0);
  for (const [id, name, born, photo, sources, html] of data.living) {
    expect(id).toMatch(/^living-\d+$/);
    expect([name, born, photo, sources, html]).toEqual(['Persona viva', '', null, 0, '']);
  }
  expect(data.research).toBe(0);
  expect(data.files).toBe(0);
  await expect(page.locator('#FamilyChart .card').filter({ hasText: 'Persona viva' }).first()).toBeVisible();
  expect(await status(page, 'private/data.json')).toBe(401);
  // The map only has the places of the facts it shows: of the deceased and of the public documents
  await page.goto(SITE + '#mapa');
  await expect(page.locator('#view-map')).toHaveClass(/active/);
  const unshown = await page.evaluate(() => {
    const facts = new Set([...DATA.people.flatMap(p => [p.birthPlace, p.deathPlace, ...p.marriages.map(m => m.place)]),
      ...DATA.docs.map(d => d.place)]);
    return Object.keys(DATA.places).filter(k => !facts.has(k));
  });
  expect(unshown).toEqual([]);
  // No research card on the home page
  await page.goto(SITE + '#inicio');
  await expect(page.locator('.home-grid [data-research]')).toHaveCount(0);
});

test('a wrong password shows an error without details', async ({ page }) => {
  await page.goto(SITE);
  await login(page, 'not-the-password');
  await expect(page.locator('#login .modal-error')).toHaveText('No se ha podido entrar. Revisa la contraseña o prueba más tarde.');
  expect(await access(page)).toBe('public');
  await page.keyboard.press('Escape');
  await expect(page.locator('#login')).toHaveCount(0);
});

test('the password opens the private data in the same view and focus; the session lasts and the lock closes it', async ({ page }) => {
  await page.goto(SITE);
  // Through the eyes of a living person, by their opaque id
  const opaque = await page.evaluate(() => DATA.people.find(p => p.living)!.id);
  await page.goto(SITE + `#documentos/${opaque}`);
  await expect(chip(page)).toHaveAttribute('data-person', opaque);
  await expect(chip(page)).toHaveText('Persona viva');

  await login(page, PASSWORD);
  await expect(lock(page)).toHaveClass(/open/);
  await expect(page.locator('#login')).toHaveCount(0);
  const [id, name] = await page.evaluate(async o => {
    const data = await fetch('private/data.json').then(r => r.json()) as typeof DATA;
    const id = data.publicIds[o];
    return [id, data.people.find(p => p.id === id)!.name];
  }, opaque);
  await expect.poll(() => hash(page)).toBe(`#documentos/${id}`);
  await expect(page.locator('#view-documents')).toHaveClass(/active/);
  await expect(chip(page)).toHaveAttribute('data-person', id);
  await expect(chip(page)).not.toHaveText('Persona viva');
  expect(name).not.toBe('Persona viva');

  // Reloading, the session is still there
  await page.reload();
  await expect(lock(page)).toHaveClass(/open/);
  await expect(chip(page)).toHaveAttribute('data-person', id);

  // The lock closes it and the public version comes back, with the same person
  await lock(page).click();
  await expect(lock(page)).not.toHaveClass(/open/);
  await expect(chip(page)).toHaveAttribute('data-person', opaque);
  expect(await hash(page)).toBe(`#documentos/${opaque}`);
  expect(await status(page, 'private/data.json')).toBe(401);
});
