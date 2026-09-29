/* Smoke test of the built web: navigation between cards, history, direct links, tree, revision and mobile.
   The hashes keep their Spanish segments (#inicio, #arbol…), the format of the links the family has saved. */
import { expect, test, type Page } from '@playwright/test';

const PAGE = process.env.E2E_PAGE ?? '';
const drawer = (page: Page) => page.locator('#drawer');
const title = (page: Page) => page.locator('#drawer-body h2').first();
const hash = (page: Page) => page.evaluate(() => decodeURIComponent(location.hash));

// No JavaScript error during the whole test
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  (page as Page & { errors?: string[] }).errors = errors;
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors).toEqual([]);
});

test('person → document → person, ← button, back, forward and Escape', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('#view-home')).toHaveClass(/active/);
  const main = await page.evaluate(() => DATA.main);
  const mainName = await page.evaluate(() => DATA.people.find(p => p.id === DATA.main)!.name);

  await page.locator('#focus .pchip').click();
  await expect(drawer(page)).toHaveClass(/open/);
  await expect(title(page)).toHaveText(mainName);
  expect(await hash(page)).toBe(`#inicio/${main}/p:${main}`);
  await expect(page.locator('#drawer-back')).toBeHidden();

  const card = page.locator('#drawer-body .mini-docs .doc-card').first();
  const docId = await card.getAttribute('data-doc');
  await card.click();
  expect(await hash(page)).toBe(`#inicio/${main}/d:${docId}`);
  await expect(page.locator('#drawer-body .facts')).toContainText(docId!);
  await expect(page.locator('#drawer-back')).toBeVisible();

  const chip = page.locator('#drawer-body .people-chips .pchip').first();
  const other = await chip.getAttribute('data-person');
  await chip.click();
  expect(await hash(page)).toBe(`#inicio/${main}/p:${other}`);
  await expect(page.locator('#drawer-back')).toBeVisible();

  // ← returns to the previous card (the document)
  await page.locator('#drawer-back').click();
  await expect.poll(() => hash(page)).toBe(`#inicio/${main}/d:${docId}`);
  await expect(page.locator('#drawer-body .facts')).toContainText(docId!);
  // Browser back: the first person
  await page.goBack();
  await expect.poll(() => hash(page)).toBe(`#inicio/${main}/p:${main}`);
  await expect(title(page)).toHaveText(mainName);
  await expect(page.locator('#drawer-back')).toBeHidden();
  // Forward: the document again
  await page.goForward();
  await expect.poll(() => hash(page)).toBe(`#inicio/${main}/d:${docId}`);
  await expect(drawer(page)).toHaveClass(/open/);

  await page.keyboard.press('Escape');
  await expect(drawer(page)).not.toHaveClass(/open/);
  expect(await hash(page)).toBe(`#inicio/${main}`);
});

test('direct link to a view, a person and a document', async ({ page }) => {
  // A person who is not the main one and one of their documents, taken from the web's data
  await page.goto(PAGE);
  const { id, doc, title: docTitle } = await page.evaluate(() => {
    const p = DATA.people.find(x => x.id !== DATA.main && !x.living && x.sources.length)!;
    return { id: p.id, doc: p.sources[0], title: DATA.docs.find(d => d.id === p.sources[0])!.title };
  });
  await page.goto('about:blank');
  await page.goto(`${PAGE}#arbol/${id}/d:${doc}`);
  await expect(page.locator('#view-tree')).toHaveClass(/active/);
  await expect(page.locator('.tabs a.active')).toHaveAttribute('data-view', 'tree');
  await expect(drawer(page)).toHaveClass(/open/);
  await expect(title(page)).toContainText(docTitle);
  await expect(page.locator('#focus .pchip')).toHaveAttribute('data-person', id);
  await expect(page.locator('#FamilyChart .card_cont').first()).toBeVisible();
});

test('changing tab closes the panel', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('#focus .pchip').click();
  await expect(drawer(page)).toHaveClass(/open/);
  await page.locator('.tabs a[data-view="fan"]').click();
  await expect(page.locator('#view-fan')).toHaveClass(/active/);
  await expect(drawer(page)).not.toHaveClass(/open/);
  await expect(page.locator('#fan path.seg').first()).toBeAttached();
});

test('click on a tree card: it centers on it and opens its card', async ({ page }) => {
  await page.goto(`${PAGE}#arbol`);
  const [main, father] = await page.evaluate(() => {
    const p = DATA.people.find(x => x.id === DATA.main)!;
    return [p.id, DATA.people.find(x => x.id === p.father)!];
  });
  const card = page.locator('#FamilyChart .card').filter({ hasText: father.name }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(drawer(page)).toHaveClass(/open/);
  await expect(title(page)).toHaveText(father.name);
  expect(await hash(page)).toBe(`#arbol/${father.id}/p:${father.id}`);
  await expect(page.locator('#focus .pchip')).toHaveAttribute('data-person', father.id);
  expect(father.id).not.toBe(main);
  // The tree re-centers on it: its card becomes the main one
  await expect(page.locator('#FamilyChart .card_cont .card-main').filter({ hasText: father.name })).toHaveCount(1);
});

test('revision with the family selector, which is remembered', async ({ page }) => {
  await page.goto(PAGE);
  // The default family and another with a section in the revision, from the web's data
  const [first, other] = await page.evaluate(() => {
    const def = DATA.families.find(f => f.default)!.key;
    return [def, DATA.families.find(f => f.key !== def && DATA.research.revision!.includes(`data-family="${f.key}"`))!.key];
  });
  await page.locator('.home-grid [data-research="revision"]').first().click();
  expect(await hash(page)).toMatch(/\/r:revision$/);
  const switcher = page.locator('#drawer-body .family-switch');
  await expect(switcher).toBeVisible();
  await expect(switcher.locator('[aria-pressed="true"]')).toHaveAttribute('data-family-show', first);
  const sections = page.locator('#drawer-body section[data-family]');
  const visible = () => sections.evaluateAll(s => s.filter(x => !(x as HTMLElement).hidden).map(x => (x as HTMLElement).dataset.family));
  expect(await visible()).not.toContain(other);

  await switcher.locator(`[data-family-show="${other}"]`).click();
  await expect(switcher.locator('[aria-pressed="true"]')).toHaveAttribute('data-family-show', other);
  expect(await visible()).toContain(other);
  expect(await visible()).not.toContain(first);
  expect(await page.evaluate(() => localStorage.getItem('arbre-familia'))).toBe(other);

  await switcher.locator('[data-family-show="all"]').click();
  expect((await visible()).length).toBe(await sections.count());
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('the card opens and the page does not overflow', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator('#view-home')).toHaveClass(/active/);
    await page.locator('#focus .pchip').click();
    await expect(drawer(page)).toHaveClass(/open/);
    await expect(drawer(page)).toBeInViewport({ ratio: 1 });  // it finishes sliding in and fits whole
    await page.locator('#drawer-close').click();
    await expect(drawer(page)).not.toHaveClass(/open/);
    await page.locator('.tabs a[data-view="documents"]').click();
    await expect(page.locator('#doc-grid .doc-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
