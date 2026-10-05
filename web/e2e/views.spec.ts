/* Details of the views: the active filter of the voyage, the card always on top and the legends of the timeline */
import { expect, test, type Page } from '@playwright/test';

const PAGE = process.env.E2E_PAGE ?? '';
const drawer = (page: Page) => page.locator('#drawer');

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  (page as Page & { errors?: string[] }).errors = errors;
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors).toEqual([]);
});

// The map's tiles come from OpenStreetMap: the tests do not depend on them (nor on the network)
const blockTiles = (page: Page) => page.route('https://tile.openstreetmap.org/**', r => r.abort());

// A grid of points over the card: at each one, the element on top has to belong to the card
async function drawerOnTop(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const r = document.getElementById('drawer')!.getBoundingClientRect();
    const bottom = Math.min(r.bottom, innerHeight);
    const covered: string[] = [];
    for (let i = 1; i < 6; i++) for (let j = 1; j < 8; j++) {
      const x = r.left + (r.width * i) / 6, y = r.top + ((bottom - r.top) * j) / 8;
      const el = document.elementFromPoint(x, y);
      if (!el?.closest('#drawer')) covered.push(`${Math.round(x)},${Math.round(y)}: ${el?.className || el?.tagName}`);
    }
    return covered;
  });
}

test('voyage: the pressed filter stays marked, and goes in the address', async ({ page }) => {
  await page.goto(`${PAGE}#viaje`);
  const chips = page.locator('#voyage-filters .chip');
  const all = chips.and(page.locator('[data-s="all"]'));
  const blood = chips.and(page.locator('[data-s="blood"]'));
  // The blood family by default
  await expect(blood).toHaveAttribute('aria-pressed', 'true');
  const idle = await all.evaluate(el => getComputedStyle(el).backgroundColor);

  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(blood).toHaveAttribute('aria-pressed', 'false');
  await expect(chips.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
  expect(await all.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(idle);

  // The filter is in the address: it survives a reload and goes with the view links
  await expect(page).toHaveURL(/\?filtro=todos$/);
  await page.reload();
  await expect(chips.and(page.locator('[data-s="all"]'))).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.topbar a[data-view="map"]').first().click();
  await expect(page).toHaveURL(/#mapa\/.*\?filtro=todos$/);
  await expect(page.locator('#map-filters [data-s="all"]')).toHaveAttribute('aria-pressed', 'true');
});

for (const [name, viewport] of [['desktop', { width: 1400, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
  test.describe(name, () => {
    test.use({ viewport });
    // Each view with its segment in the hash
    for (const [view, segment] of [['voyage', 'viaje'], ['tree', 'arbol'], ['fan', 'abanico'], ['timeline', 'cronologia'], ['map', 'mapa'], ['documents', 'documentos'], ['news', 'novedades']]) {
      test(`${view}: the open card stays above the view`, async ({ page }) => {
        await blockTiles(page);
        await page.goto(`${PAGE}#${segment}`);
        if (view === 'map') await expect(page.locator('#map path.map-point').first()).toBeAttached();
        await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
        if (view === 'voyage') await expect(page.locator('.vcard').first()).toBeVisible();
        await page.locator('#focus .pchip').click();  // «Con los ojos de» (through the eyes of)
        await expect(drawer(page)).toHaveClass(/open/);
        await expect(drawer(page)).toBeInViewport({ ratio: .9 });
        await expect.poll(() => drawerOnTop(page)).toEqual([]);
      });
    }
  });
}

test('timeline: the legends stay above the chart', async ({ page }) => {
  await page.goto(`${PAGE}#cronologia`);
  const bar = page.locator('#timeline .bar').first();
  await expect(bar).toBeAttached();
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));  // entrance of the view
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
  // The colors of the families, outside the chart and above it
  const legend = await box('#legend-timeline');
  expect(legend.height).toBeGreaterThan(0);
  expect(legend.y + legend.height).toBeLessThanOrEqual((await box('.timeline-wrap')).y);
  // The names of the eras and the documents, inside the chart above the first life
  const firstBar = await box('#timeline .bar');
  const above = (els: { y: number; height: number }[]) => els.every(b => b.y + b.height <= firstBar.y);
  const boxes = (sel: string) => page.locator(sel).evaluateAll(els => els.map(e => {
    const r = e.getBoundingClientRect(); return { y: r.y, height: r.height };
  }));
  const events = await boxes('#timeline .event text');
  expect(events.length).toBeGreaterThan(0);
  expect(above(events)).toBe(true);
  expect(above(await boxes('#timeline circle'))).toBe(true);
});

test('map: a place found with the search is chosen on the map, also out of the year; the back button returns', async ({ page }) => {
  await blockTiles(page);
  await page.goto(`${PAGE}#mapa`);
  const names = page.locator('#map-side .map-places button span');
  await expect(names.first()).toBeAttached();
  const all = await names.allTextContents();
  // Up to the first year, a place that is not seen yet (if every place is there from the start, the last one)
  const year = page.locator('#map-year');
  await year.fill(await year.getAttribute('min') ?? '1800');
  await expect(page.locator('#map-all-years')).toBeVisible();
  const early = new Set(await names.allTextContents());
  const name = all.find(n => !early.has(n)) ?? all[all.length - 1];

  // From another view: the search finds it with its pin and goes to the map with it chosen, with all the years
  await page.locator('.topbar a[data-view="home"]').first().click();
  await expect(page.locator('#view-home')).toHaveClass(/active/);
  const before = page.url();
  await page.locator('#search').fill(name);
  const hit = page.locator('#search-results li', { hasText: '📍' }).filter({ hasText: name }).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.locator('#view-map')).toHaveClass(/active/);
  await expect(page).toHaveURL(/#mapa\/[^?]*\?(.*&)?lugar=[-\d.,]+$/);
  await expect(page.locator('#map-side .map-place h3')).toHaveText(name);
  await expect(page.locator('#map-until')).toHaveText('Todos los años');
  // The link can be shared: opened again, the same place
  const link = page.url();
  await page.reload();
  await expect(page.locator('#map-side .map-place h3')).toHaveText(name);

  // The back button returns to the list, and from there to the view where it was searched
  await page.locator('#map-side .map-back').click();
  await expect(page.locator('#map-side .map-places')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#map-side .map-place h3')).toHaveText(name);
  expect(page.url()).toBe(link);
  await page.goBack();
  expect(page.url()).toBe(before);
  await expect(page.locator('#view-home')).toHaveClass(/active/);

  // A point of the map, clicked, also goes in the address; an unknown place is ignored
  await page.goto(`${PAGE}#mapa`);
  await page.locator('#map path.map-point').first().dispatchEvent('click');
  await expect(page).toHaveURL(/lugar=/);
  await expect(page.locator('#map-side .map-place h3')).toBeVisible();
  await page.goto(`${PAGE}#mapa?lugar=0.000,0.000`);
  await expect(page.locator('#map-side .map-places')).toBeVisible();
});

test('map: a point per place, its list, the year and the migrations', async ({ page }) => {
  await blockTiles(page);
  await page.goto(`${PAGE}#mapa`);
  await expect(page.locator('#view-map')).toHaveClass(/active/);
  const points = page.locator('#map path.map-point');
  await expect(points.first()).toBeAttached();
  const located = await page.evaluate(() => Object.keys(DATA.places).length);
  expect(located).toBeGreaterThan(0);
  const all = await points.count();
  await expect(page.locator('#map-side .map-places li')).toHaveCount(all);
  // Without tiles, the notice and the coastline underneath
  await expect(page.locator('.map-offline')).toBeVisible();
  await expect(page.locator('#map .leaflet-outline-pane path')).not.toHaveCount(0);

  // A place of the list: its people and documents, with the chips that open the cards
  await page.locator('#map-side .map-places button').first().click();
  await expect(page.locator('#map-side .map-place h3')).toBeVisible();
  await page.locator('#map-side .map-facts .pchip, #map-side .map-facts .doc-card').first().click();
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await page.locator('#map-side .map-back').click();

  // Up to an early year there are fewer points; the lines can be hidden
  const year = page.locator('#map-year');
  await year.fill(await year.getAttribute('min') ?? '1800');
  await expect(page.locator('#map-all-years')).toBeVisible();
  expect(await points.count()).toBeLessThan(all);
  await page.locator('#map-all-years').click();
  await expect(points).toHaveCount(all);
  // Each kind of fact can be hidden: without any, no points; checked again, all of them
  for (const k of ['birth', 'marriage', 'death', 'doc']) await page.locator(`#map-kind-${k}`).uncheck();
  await expect(points).toHaveCount(0);
  for (const k of ['birth', 'marriage', 'death', 'doc']) await page.locator(`#map-kind-${k}`).check();
  await expect(points).toHaveCount(all);
  // The migrations, between generations and of a life (from birth to death), are hidden together; a wide invisible
  // line under each one shows what it is on hover, also in the gaps of the dashes
  if (await page.locator('#map path.map-line, #map path.map-life').count()) {
    // The middle of a line inside the map, a little to the side: over the invisible line, not the drawn one
    const at = await page.evaluate(() => {
      const box = document.querySelector('#map')!.getBoundingClientRect();
      for (const el of document.querySelectorAll<SVGPathElement>('#map path.map-hit')) {
        const m = el.getPointAtLength(el.getTotalLength() / 2), ctm = el.getScreenCTM()!;
        const x = m.x * ctm.a + ctm.e, y = m.y * ctm.d + ctm.f + 4;
        const inside = x > box.left + 40 && x < box.right - 40 && y > box.top + 40 && y < box.bottom - 40;
        // Not under a point, which has its own tooltip
        if (inside && document.elementFromPoint(x, y)?.classList.contains('map-hit')) return { x, y };
      }
      return null;
    });
    if (at) {
      await page.mouse.move(at.x, at.y);
      await expect(page.locator('#tooltip')).toBeVisible();
      await page.mouse.move(0, 0);
    }
    await page.locator('#map-lines').uncheck();
    await expect(page.locator('#map path.map-line, #map path.map-life')).toHaveCount(0);
  }

  // The play goes a year at a time and tells it over the map; the speed changes on the way
  await expect(page.locator('#map-now')).toHaveCount(0);
  await page.locator('#map-speed').click();
  await expect(page.locator('#map-speed')).toHaveText('×2');
  await page.locator('#map-play').click();
  const first = Number(await page.locator('#map-now b').textContent());
  await expect.poll(async () => Number(await page.locator('#map-now b').textContent())).toBeGreaterThan(first);
  await page.locator('#map-play').click();
  await expect(page.locator('#map-play')).toHaveAttribute('aria-label', /Recorrer/);

  // Full screen: the controls, the map and the list of places take the whole window; the button leaves it
  await page.locator('#map-full').click();
  await expect(page.locator('body')).toHaveClass(/map-full/);
  const box = (await page.locator('.map-view').boundingBox())!;
  expect(box.y).toBe(0);
  await expect(page.locator('#map-side')).toBeVisible();
  await expect(page.locator('#map-play')).toBeVisible();
  await page.locator('#map-full').click();
  await expect(page.locator('body')).not.toHaveClass(/map-full/);
});
