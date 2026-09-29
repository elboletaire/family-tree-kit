/* The closed site (PUBLIC_SITE=0, see playwright.config.ts): without a session the server only gives its login page,
   with nothing of the tree; after the password the web loads the private data before drawing itself, so that no
   «Persona viva» is ever seen, and the open lock closes the session, back to the login page. */
import { expect, test, type Page } from '@playwright/test';

const SITE = 'http://127.0.0.1:8767/';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password';
const LIVING = 'Persona viva';
const lock = (page: Page) => page.locator('#lock');
const loginForm = (page: Page) => page.locator('form[action="/login"]');

declare global {
  interface Window { sawLiving?: boolean }
}

test.beforeEach(async ({ page }) => {
  // On every page, from its first byte: does the text «Persona viva» ever appear, even for an instant?
  await page.addInitScript(living => {
    try { localStorage.clear(); } catch { /* */ }
    // The text of the page, not of its scripts: the public data embedded in it do have «Persona viva»
    const check = () => {
      const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const tag = node.parentElement?.tagName;
        if (tag !== 'SCRIPT' && tag !== 'STYLE' && node.textContent?.includes(living)) { window.sawLiving = true; return; }
      }
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
  }, LIVING);
});

async function submit(page: Page, password: string) {
  await loginForm(page).locator('input[name="password"]').fill(password);
  await loginForm(page).locator('button[type="submit"]').click();
}

test('without a session, only the login page: nothing of the tree', async ({ page, request }) => {
  const res = await page.goto(SITE + '#arbol');
  expect(res!.status()).toBe(200);
  const html = await res!.text();
  expect(html).not.toContain('DATA');
  expect(html).not.toContain(LIVING);
  await expect(loginForm(page)).toBeVisible();
  await expect(page.locator('#app')).toHaveCount(0);
  for (const path of ['private/data.json', 'index.html?x', 'media/']) {
    const r = await request.get(SITE + path);
    expect(r.status(), path).toBe(path.startsWith('index.html') ? 200 : 401);
    expect(await r.text()).not.toContain('DATA');
  }
  await submit(page, 'not-the-password');
  await expect(loginForm(page).locator('.error')).toBeVisible();
  await expect(page.locator('#app')).toHaveCount(0);
});

test('the password opens the private web, in the view asked for and without «Persona viva» at any moment', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(SITE + '#arbol');
  await submit(page, PASSWORD);

  await expect(lock(page)).toHaveClass(/open/);
  expect(await page.evaluate(() => decodeURIComponent(location.hash))).toBe('#arbol');
  await expect(page.locator('#view-tree')).toHaveClass(/active/);
  await expect(page.locator('#FamilyChart .card').first()).toBeVisible();
  // DATA is the public version the page was served with; the tree drawn, the private one
  expect(await page.evaluate(() => DATA.access)).toBe('public');
  expect(await page.evaluate(() => fetch('private/data.json').then(r => r.status))).toBe(200);
  expect(await page.evaluate(() => window.sawLiving ?? false)).toBe(false);
  // Through the eyes of the main person of the private data, not of the public version's default one
  const main = await page.evaluate(() => fetch('private/data.json').then(r => r.json()).then(d => d.people.find((p: { id: string }) => p.id === d.main).name));
  await expect(page.locator('#focus .pchip')).toHaveAttribute('title', main);
  await expect(page.locator('#focus .focus-reset')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('arbre-focus'))).toBe(null);

  // Reloading, the same: the private data before anything is drawn
  await page.reload();
  await expect(lock(page)).toHaveClass(/open/);
  await expect(page.locator('#FamilyChart .card').first()).toBeVisible();
  expect(await page.evaluate(() => window.sawLiving ?? false)).toBe(false);

  // The open lock closes the session: back to the login page
  await lock(page).click();
  await expect(loginForm(page)).toBeVisible();
  await expect(page.locator('#app')).toHaveCount(0);
  expect(await page.evaluate(() => fetch('private/data.json').then(r => r.status))).toBe(401);
  expect(await page.evaluate(() => window.sawLiving ?? false)).toBe(false);
  expect(errors).toEqual([]);
});

test('the watch does see «Persona viva» where it is drawn: in the public site', async ({ page }) => {
  await page.goto('http://127.0.0.1:8766/#arbol');
  await expect(page.locator('#FamilyChart .card').filter({ hasText: LIVING }).first()).toBeVisible();
  expect(await page.evaluate(() => window.sawLiving ?? false)).toBe(true);
});
