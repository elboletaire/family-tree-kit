/* The screenshots of the READMEs: the main views of the demo, as JPEG (small enough for the repository) in
   docs/screenshots. The map waits for its OpenStreetMap tiles; without network, it is taken with the coastline. */
import { expect, test, type Page } from '@playwright/test';

const OUT = '../docs/screenshots';

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 78 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
});

for (const [name, segment] of [['home', 'inicio'], ['fan', 'abanico'], ['timeline', 'cronologia'], ['documents', 'documentos'], ['news', 'novedades']]) {
  test(name, async ({ page }) => {
    await page.goto(`#${segment}`);
    await expect(page.locator(`#view-${name}`)).toHaveClass(/active/);
    await page.waitForTimeout(800);  // the tree and the fan settle after drawing
    await shoot(page, name);
  });
}

// The tree around the main person's paternal grandfather: his parents, his two marriages and the step-siblings
test('tree', async ({ page }) => {
  await page.goto('#arbol');
  const id = await page.evaluate(() => {
    const father = (id: string) => DATA.people.find(p => p.id === id)!.father ?? id;
    return father(father(DATA.main));
  });
  await page.goto(`#arbol/${id}`);
  await expect(page.locator('#view-tree')).toHaveClass(/active/);
  await page.waitForTimeout(800);
  await shoot(page, 'tree');
});

test('map', async ({ page }) => {
  await page.goto('#mapa');
  await expect(page.locator('#map path.map-point').first()).toBeAttached();
  await page.waitForLoadState('networkidle').catch(() => { /* without network: the coastline */ });
  await page.waitForTimeout(800);
  await shoot(page, 'map');
});

// The card of the deceased person with the most documents, over the tree
test('person', async ({ page }) => {
  await page.goto('#arbol');
  const id = await page.evaluate(() => [...DATA.people].filter(p => p.died)
    .sort((a, b) => b.sources.length - a.sources.length || a.id.localeCompare(b.id))[0].id);
  await page.goto(`#arbol/${id}/p:${id}`);
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await page.waitForTimeout(800);
  await shoot(page, 'person');
});
