import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The first-visit intro card sits over the map; tests other than its own start with it dismissed.
const INTRO_KEY = 'landscape-of-loss:intro-dismissed';
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith('intro card')) {
    await page.addInitScript((key) => localStorage.setItem(key, '1'), INTRO_KEY);
  }
});

test('map loads, paints, switches modes and never uses Arial', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');

  // Default: Decadal population change at 2010–20.
  const canvas = page.locator('canvas[role="img"]');
  await expect(canvas).toHaveAttribute('aria-label', /population change, 2010–20/);
  await expect(page.getByLabel('Decadal population change', { exact: true })).toBeChecked();

  // The canvas has painted county fills (non-transparent pixels).
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let painted = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
        return painted / (c.width * c.height);
      }),
    )
    .toBeGreaterThan(0.2);

  // Three tabs, in order.
  await expect(page.locator('input[name="mode"]')).toHaveCount(3);
  await expect(page.locator('.modes label')).toHaveText([
    'Decadal population change',
    'Decadal population change in spatial context',
    'Population change trajectories',
  ]);
  await expect(page.locator('input[type="range"]')).toHaveCount(1);

  const modes: [string, RegExp, boolean][] = [
    ['Decadal population change in spatial context', /spatial context.*2010–20/, true],
    ['Population change trajectories', /pathway/, false],
    ['Decadal population change', /population change, 2010–20/, true],
  ];
  for (const [label, aria, decades] of modes) {
    await page.getByLabel(label, { exact: true }).check({ force: true });
    await expect(canvas).toHaveAttribute('aria-label', aria);
    await expect(page.locator('input[type="range"]')).toHaveCount(decades ? 1 : 0);
  }

  // The decade persists across the two decade modes.
  await page.locator('input[type="range"]').fill('2');
  await expect(canvas).toHaveAttribute('aria-label', /1970–80/);
  await page.getByLabel('Decadal population change in spatial context', { exact: true }).check({ force: true });
  await expect(canvas).toHaveAttribute('aria-label', /1970–80/);

  const arial = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .map((el) => getComputedStyle(el).fontFamily)
      .filter((f) => /arial/i.test(f)),
  );
  expect(arial).toEqual([]);
  expect(errors).toEqual([]);
});

test('the three mode tabs fit on one line at 1024 px', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('./');
  await expect(page.locator('.modes label')).toHaveCount(3);
  const tops =await page.locator('.modes label').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('header order: title, subtitle within two lines, then tabs with the tools beside them from 1280 px', async ({ page }) => {
  for (const width of [1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./');
    const sub = page.locator('.subtitle');
    await expect(sub).toContainText('What is the geography of US population loss');
    const lines = await sub.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    expect(lines, `${width} px`).toBeLessThanOrEqual(2.05);
    const box = (sel: string) => page.locator(sel).boundingBox().then((b) => b!);
    const [title, subtitle, tabs, tools] = [await box('h1'), await box('.subtitle'), await box('.modes'), await box('.tools')];
    expect(subtitle.y, `${width} px`).toBeGreaterThanOrEqual(title.y + title.height);
    expect(tabs.y, `${width} px`).toBeGreaterThanOrEqual(subtitle.y + subtitle.height);
    if (width >= 1280) expect(Math.abs(tools.y + tools.height / 2 - (tabs.y + tabs.height / 2)), `${width} px`).toBeLessThan(2);
    // The explainer button is labelled, not a bare "?".
    await expect(page.locator('.tools').getByRole('button', { name: 'How to read this map' })).toBeVisible();
    await expect(page.locator('.tools .about .label')).toBeVisible();
  }
});

test('switching modes never changes the map size, position or zoom', async ({ page }) => {
  const state = () =>
    page.evaluate(() => {
      const r = document.querySelector('.app > .map')!.getBoundingClientRect();
      const g = [...document.querySelectorAll('.map svg > g, .map svg > g > g')].map((e) => e.getAttribute('transform'));
      return JSON.stringify([r.x, r.y, r.width, r.height, ...g]);
    });
  for (const [width, height] of [[1280, 800], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    for (const search of ['', '?county=01005']) {
      await page.goto(`./${search}`);
      await page.waitForTimeout(800);
      for (const zoomed of [false, true]) {
        if (zoomed) {
          const box = (await page.locator('canvas[role="img"]').boundingBox())!;
          await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
          for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -300);
          await page.waitForTimeout(500);
          await page.mouse.move(0, 0);
        }
        const before = await state();
        for (const label of ['Population change trajectories', 'Decadal population change in spatial context', 'Population change trajectories', 'Decadal population change']) {
          await page.getByLabel(label, { exact: true }).check({ force: true });
          await page.waitForTimeout(50);
          expect(await state(), `${width}×${height} ${search} zoomed=${zoomed} → ${label}`).toBe(before);
        }
      }
    }
  }
  // Trajectories mode keeps the decade row, with a caption.
  await page.getByLabel('Population change trajectories', { exact: true }).check({ force: true });
  await expect(page.getByText('Pathways cover the whole period, 1950–2020')).toBeVisible();
});

const profileTitle = (page: Page) => page.locator('#profile-title');

test('mode=recent redirects to Decadal population change at 2010–20, keeping the county', async ({ page }) => {
  await page.goto('./?mode=recent&decade=1970&county=28101');
  await expect(profileTitle(page)).toHaveText('Newton County, MS');
  await expect(page).toHaveURL(/\?county=28101$/);
  await expect(page.getByLabel('Decadal population change', { exact: true })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Most recent decade, 2010–20 (decade on the map)' })).toBeVisible();
});

test('URL state round-trips and the profile follows the map decade', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const search = '?mode=context&decade=1980&county=28101&path=3,4';
  await page.goto(`./${search}`);
  await expect(profileTitle(page)).toHaveText('Newton County, MS');
  await expect(page.getByLabel('Decadal population change in spatial context', { exact: true })).toBeChecked();
  await expect(page.locator('input[type="range"]')).toHaveValue('3');
  await expect(page.getByText('21,291 people (2020) · Nonmetro')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1980–90 (decade on the map)' })).toBeVisible();
  await expect(page.locator('.sentence').first()).toHaveText(
    'Newton County grew 1.7% while its neighboring counties together lost 0.6%.',
  );
  await expect(page.locator('.sentence').nth(1)).toHaveText('Newton County lost 1.9%.');
  expect(new URL(page.url()).search).toBe(search);

  // Trajectories mode has no decade: blocks 4 and 5 merge, and the decade stays in the URL.
  await page.getByLabel('Population change trajectories', { exact: true }).check({ force: true });
  await expect(page.getByRole('heading', { name: 'Most recent decade, 2010–20', exact: true })).toBeVisible();
  await expect(page.locator('.sentence')).toHaveCount(1);
  await expect(page).toHaveURL(/mode=pathways&decade=1980&county=28101&path=3,4/);
  await page.reload();
  await expect(page.getByLabel('Population change trajectories', { exact: true })).toBeChecked();
  await expect(profileTitle(page)).toHaveText('Newton County, MS');

  // Closing adds a history entry; Back reopens the county.
  await page.getByRole('button', { name: 'Close county profile' }).click();
  await expect(profileTitle(page)).toHaveCount(0);
  await page.goBack();
  await expect(profileTitle(page)).toHaveText('Newton County, MS');

  // The detail blocks load on demand and open on click.
  await page.getByRole('button', { name: 'Who lives here (ACS 2016–20)' }).click();
  await expect(page.getByText('White, non-Hispanic')).toBeVisible();
  // Axis labels sit on the track; the right column holds only the county value; focus shows a readout.
  const row = page.locator('.rows li').first();
  await expect(row.locator('.track .tick')).toHaveText(['0', /^\d+%$/]);
  await expect(row.locator('.value')).toHaveText(/^\d+\.\d%$/);
  const readout = page.locator('p.readout');
  await expect(readout).toHaveText(/Point to or select a row/);
  const before = await readout.boundingBox();
  const rowBox = await row.boundingBox();
  await row.focus();
  await expect(readout).toHaveText(/^\s*County 60\.1% · Pathway 78\.5% · Conterminous U\.S\. 58\.0%\s*$/);
  await page.locator('.rows li').nth(1).hover();
  await expect(readout).toHaveText(/^\s*County 30\.3% · Pathway \d+\.\d% · Conterminous U\.S\. \d+\.\d%\s*$/);
  // Two lines reserved: no layout shift (compared relative to each other, since hovering may scroll the panel).
  const [after, rowAfter] = [(await readout.boundingBox())!, (await row.boundingBox())!];
  expect(after.height).toBe(before!.height);
  expect(await readout.evaluate((el) => getComputedStyle(el).whiteSpace)).not.toBe('nowrap');
  expect(rowAfter.y - after.y).toBeCloseTo(rowBox!.y - before!.y, 1);
  await expect(page.locator('ul.key')).toContainText('Conterminous U.S.');
  await expect(page.getByText('Each row has its own scale.', { exact: false })).toBeVisible();
  // Demographic sources of change: three bars, and no driver sentence.
  await page.getByRole('button', { name: 'Demographic sources of change, 2010–20' }).click();
  await expect(page.locator('.bars li')).toHaveText([/^Natural change/, /^Domestic migration/, /^International migration/]);
  await expect(page.getByText(/loss counties|losing counties|Lost population through/)).toHaveCount(0);
  const arial = await page.evaluate(() =>
    [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily).filter((f) => /arial/i.test(f)),
  );
  expect(arial).toEqual([]);
  expect(errors).toEqual([]);
});

test('the ACS readout reserves two lines and wraps without clipping at 200% text size', async ({ page }) => {
  await page.goto('./?county=28101');
  await page.getByRole('button', { name: 'Who lives here (ACS 2016–20)' }).click();
  const readout = page.locator('p.readout');
  const lines = () => readout.evaluate((el) => el.clientHeight / parseFloat(getComputedStyle(el).lineHeight));
  expect(await lines()).toBeCloseTo(2, 1);
  // Text-only zoom (as in Firefox) scales px font sizes: double the readout's.
  await page.addStyleTag({ content: 'p.readout { font-size: 24px !important; }' });
  await page.locator('.rows li').first().focus();
  await expect(readout).toContainText('Conterminous U.S. 58.0%');
  const m = await readout.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight }));
  expect(m.sh).toBeLessThanOrEqual(m.h);
  const [r, row] = [(await readout.boundingBox())!, (await page.locator('.rows li').first().boundingBox())!];
  expect(r.y + r.height).toBeLessThanOrEqual(row.y);
});

test('the 2010–20 breakdown shows only at 2010–20, pins a pathway, and survives a county', async ({ page }) => {
  await page.goto('./');
  const breakdown = page.locator('.breakdown');
  await expect(breakdown.getByText('Lost population 2010–20 (1,637)')).toBeVisible();
  await expect(breakdown.getByText('Gained (1,471)')).toBeVisible();
  const rows = breakdown.getByRole('button');
  await expect(rows).toHaveCount(8);

  // Pinning fades the other counties on the map.
  const mapSum = () =>
    page.locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      return s;
    });
  const before = await mapSum();
  const persistent = breakdown.getByRole('button', { name: /^Persistent Loss/ });
  await persistent.click();
  await page.mouse.move(0, 0);
  await expect(persistent).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?hl=3$/);
  await page.waitForTimeout(300);
  expect(await mapSum()).toBeGreaterThan(before);

  // Opening a county keeps the pin; "Back to breakdown" returns to it.
  await page.goto('./?county=01005&hl=3');
  await page.getByRole('button', { name: '← Back to breakdown' }).click();
  await expect(page).toHaveURL(/\?hl=3$/);
  await expect(persistent).toHaveAttribute('aria-pressed', 'true');

  // Without a pin, a map click at 2010–20 opens a profile with no "Back to breakdown"; with one, it has it.
  const back = page.getByRole('button', { name: '← Back to breakdown' });
  await page.goto('./');
  await page.waitForTimeout(300);
  const box = (await page.locator('canvas[role="img"]').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await expect(profileTitle(page)).toBeVisible();
  await expect(back).toHaveCount(0);
  await page.keyboard.press('Escape');
  await persistent.click();
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await expect(profileTitle(page)).toBeVisible();
  await expect(back).toBeVisible();
  await back.click();
  await expect(persistent).toHaveAttribute('aria-pressed', 'true');

  // Esc unpins; another decade hides the block and clears the pin.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/landscape-of-loss\/$/);
  await persistent.click();
  await page.locator('input[type="range"]').fill('4');
  await expect(breakdown).toHaveCount(0);
  await expect(page).toHaveURL(/\?decade=1990$/);
  await page.locator('input[type="range"]').fill('6');
  await expect(breakdown.locator('[aria-pressed="true"]')).toHaveCount(0);
  await page.getByLabel('Population change trajectories', { exact: true }).check({ force: true });
  await expect(breakdown).toHaveCount(0);
});

test('similar counties: rows, map rings and framing, settings in the URL, back link', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?county=01005');
  await page.getByRole('button', { name: 'See similar counties', exact: true }).click();
  const matches = page.locator('button.match');
  await expect(matches).toHaveCount(5);
  await expect(matches.first()).toHaveAccessibleName('Barton County, MO, Emerging Localized Loss pathway, open profile');
  // On the map: a thin solid outline per match; the selected outline stays heavier. No badges.
  await expect(page.locator('path.line.match')).toHaveCount(5);
  await expect(page.locator('svg .badge')).toHaveCount(0);
  const strokes = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return { match: css('path.line.match').strokeWidth, dash: css('path.line.match').strokeDasharray, selected: css('path.line.selected').strokeWidth };
  });
  expect(strokes).toEqual({ match: '1.25px', dash: 'none', selected: '2px' });

  // Every match has a small locator ring; none is emphasised until something is pointed at.
  const rings = page.locator('svg g.locator');
  await expect(rings).toHaveCount(5);
  await expect(rings.locator('circle.line').first()).toHaveAttribute('r', '6');
  await expect(page.locator('svg g.locator.faded, svg g.locator.active')).toHaveCount(0);

  // Opening the block framed the county and its matches (from the URL load's regional zoom).
  const view = () => page.locator('svg > g').first().getAttribute('transform');
  const scale = async () => Number(/scale\(([\d.]+)\)/.exec((await view())!)![1]);
  await page.waitForTimeout(800);
  const fitted = await scale();
  expect(fitted).toBeLessThan(2);
  // Everything is in view, so "Show all on map" is hidden.
  const showAll = page.getByRole('button', { name: 'Show all on map' });
  await expect(showAll).toHaveCount(0);

  // Hovering a row enlarges its ring and fades the others; it also gets the selected-style
  // outline. The map never moves on hover.
  const before = await view();
  await matches.nth(1).hover();
  await expect(page.locator('svg g.locator.active circle.line')).toHaveAttribute('r', '10');
  await expect(page.locator('svg g.locator.faded')).toHaveCount(4);
  expect(await page.locator('svg g.locator.active circle.line').evaluate((el) => getComputedStyle(el).strokeWidth)).toBe('2px');
  expect(await page.locator('svg g.locator.faded').first().evaluate((el) => getComputedStyle(el).opacity)).toBe('0.4');
  await expect(page.locator('path.line.linked')).toHaveCount(1);
  await expect(matches.nth(1)).toHaveClass(/linked/);
  expect(await view()).toBe(before);
  await page.mouse.move(0, 0);
  await expect(page.locator('svg g.locator.active')).toHaveCount(0);
  // Focus does the same as hover.
  await matches.first().focus();
  await expect(page.locator('svg g.locator.active')).toHaveCount(1);
  await matches.first().blur();

  // Hovering a matched county on the map does the same and marks its row.
  const outline = (await page.locator('path.line.match').first().boundingBox())!;
  await page.mouse.move(outline.x + outline.width / 2, outline.y + outline.height / 2);
  await expect(page.locator('button.match.linked')).toHaveCount(1);
  await expect(page.locator('svg g.locator.active')).toHaveCount(1);
  await expect(page.locator('svg g.locator.faded')).toHaveCount(4);
  expect(await view()).toBe(before);
  await page.mouse.move(0, 0);

  // After the user zooms away, changing a setting frames the matches again.
  const box = (await page.locator('canvas[role="img"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
  expect(await scale()).toBeGreaterThan(fitted + 1);
  await page.mouse.move(0, 0);
  // Matches are now out of view: the button appears, and using it frames them and hides it.
  await expect(showAll).toBeVisible();
  await showAll.click();
  await expect(showAll).toHaveCount(0);
  expect(await scale()).toBeCloseTo(fitted, 5);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
  await page.mouse.move(0, 0);
  await page.getByLabel('Same metro status').check();
  await page.waitForTimeout(800);
  expect(await scale()).toBeLessThan(2);
  await page.getByLabel('Same metro status').uncheck();
  await expect(page.getByText('Not part of the paper\'s analysis.', { exact: false })).toBeVisible();
  // The page itself never scrolls; only the panel does.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);

  await page.getByText('Any pathway').click();
  await page.getByLabel('Similar size').check();
  await expect(page).toHaveURL(/\?county=01005&sim=any,size$/);
  await page.reload();
  await page.getByRole('button', { name: 'See similar counties', exact: true }).click();
  await expect(page.getByLabel('Any pathway')).toBeChecked();
  await expect(page.getByLabel('Similar size')).toBeChecked();
  await expect(matches).toHaveCount(5);

  // Following a match offers a way back; the block stays open and the rings follow.
  await page.getByText('Same pathway').click();
  await page.getByLabel('Similar size').uncheck();
  await expect(page).toHaveURL(/\?county=01005$/);
  await matches.first().click();
  await expect(profileTitle(page)).toHaveText('Barton County, MO');
  await page.getByRole('button', { name: '← Back to Barbour County' }).click();
  await expect(profileTitle(page)).toHaveText('Barbour County, AL');
  // Opened from the URL with no pathway pinned, so there is no breakdown to go back to.
  await expect(page.getByRole('button', { name: '← Back to breakdown' })).toHaveCount(0);

  // Closing the profile removes the rings; a pool with no matches says so.
  await page.getByRole('button', { name: 'Close county profile' }).click();
  await expect(page.locator('path.line.match')).toHaveCount(0);
  await page.goto('./?county=06037&sim=size,metro');
  await page.getByRole('button', { name: 'See similar counties', exact: true }).click();
  await expect(page.getByText('No counties match these settings.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('similar counties sit after the population chart; the trajectory link opens and scrolls to them', async ({ page }) => {
  await page.goto('./?county=13067');
  await expect(profileTitle(page)).toHaveText('Cobb County, GA');
  const headings = await page.locator('.profile h3').allTextContents();
  const at = (t: string) => headings.findIndex((h) => h.trim().startsWith(t));
  expect(at('See similar counties')).toBe(at('Population, 1950–2020') + 1);
  expect(at('Who lives here')).toBe(at('See similar counties') + 1);

  // Collapsed by default, since opening reframes the map.
  const toggle = page.getByRole('button', { name: 'See similar counties', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('button.match')).toHaveCount(0);

  await page.getByRole('button', { name: 'See counties with similar population change trajectories ↓' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('button.match')).toHaveCount(5);
  await expect(toggle).toBeFocused();
  // Scrolled to the top of the panel.
  await expect
    .poll(async () => {
      const [panel, block] = await Promise.all([page.locator('aside.panel').boundingBox(), toggle.boundingBox()]);
      return block!.y - panel!.y;
    })
    .toBeLessThan(60);
});

test('similar counties: collapsed for each new county, open between a county and its matches; hiding restores the view', async ({ page }) => {
  await page.goto('./?county=01005');
  const view = () => page.locator('svg > g').first().getAttribute('transform');
  const toggle = page.getByRole('button', { name: 'See similar counties', exact: true });
  const rings = page.locator('svg g.locator');
  await page.waitForTimeout(900);
  const before = await view();
  await toggle.click();
  await expect(rings).toHaveCount(5);
  await expect.poll(view).not.toBe(before);

  // Following a match and its back link keeps the block open.
  await page.locator('button.match').first().click();
  await expect(profileTitle(page)).toHaveText('Barton County, MO');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: '← Back to Barbour County' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  // "Hide similar counties" removes the rings and returns to the view from before the block opened.
  await page.getByRole('button', { name: 'Hide similar counties' }).click();
  await expect(rings).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect.poll(view).toBe(before);
  // Collapsing from the heading does the same.
  await toggle.click();
  await expect.poll(view).not.toBe(before);
  await toggle.click();
  await expect(page.locator('path.line.match')).toHaveCount(0);
  await expect.poll(view).toBe(before);

  // A newly selected county starts with the block collapsed.
  await toggle.click();
  await expect(page.locator('button.match')).toHaveCount(5);
  await page.getByRole('combobox', { name: 'Search for a county' }).fill('newton ms');
  await page.keyboard.press('Enter');
  await expect(profileTitle(page)).toHaveText('Newton County, MS');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rings).toHaveCount(0);
});

test('leaving a profile: back to the map legend, the county again or outside the U.S.; a double-click keeps it', async ({ page }) => {
  // "Back to the map legend" follows any other back link.
  await page.goto('./?county=01005&hl=3');
  await expect(page.locator('.backs button')).toHaveText(['← Back to breakdown', '← Back to the map legend']);
  await page.getByRole('button', { name: '← Back to the map legend' }).click();
  await expect(profileTitle(page)).toHaveCount(0);
  await expect(page.locator('.legend')).toBeVisible();

  await page.goto('./');
  await page.waitForTimeout(300);
  const box = (await page.locator('canvas[role="img"]').boundingBox())!;
  const [x, y] = [box.x + box.width * 0.55, box.y + box.height * 0.5];
  await page.mouse.click(x, y);
  await expect(profileTitle(page)).toBeVisible();
  await expect(page.locator('.backs button')).toHaveText(['← Back to the map legend']);
  // Clicking the selected county again deselects it.
  await page.mouse.click(x, y);
  await expect(profileTitle(page)).toHaveCount(0);
  // So does clicking outside the U.S. (the map's lower-left corner is ocean).
  await page.mouse.click(x, y);
  await expect(profileTitle(page)).toBeVisible();
  await page.mouse.click(box.x + 3, box.y + box.height - 3);
  await expect(profileTitle(page)).toHaveCount(0);
  // A double-click on the selected county zooms and keeps it selected.
  await page.mouse.click(x, y);
  await expect(profileTitle(page)).toBeVisible();
  await page.waitForTimeout(400);
  await page.mouse.dblclick(x, y);
  await page.waitForTimeout(800);
  await expect(profileTitle(page)).toBeVisible();
  expect(await page.locator('svg > g').first().getAttribute('transform')).not.toBe('translate(0,0) scale(1)');
});

test('"What do these mean?" under each legend opens the explainer at its section', async ({ page }) => {
  const cases = [
    ['./', 'Data notes', 'Change classes and colors'],
    ['./?mode=context', 'How to read this', 'A county and its neighbors, in one decade'],
    ['./?mode=pathways', 'How to read this', 'The eight types of population change'],
  ];
  for (const [url, tab, heading] of cases) {
    await page.goto(url);
    await page.locator('.legend').getByRole('button', { name: 'What do these mean?' }).click();
    const dialog = page.getByRole('dialog', { name: 'The Landscape of Loss' });
    await expect(dialog.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('heading', { name: heading })).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test('map clicks never zoom; search and URL loads frame the county in its region', async ({ page }) => {
  const scale = async () => {
    const t = (await page.locator('svg > g').first().getAttribute('transform'))!;
    return Number(/scale\(([\d.]+)\)/.exec(t)![1]);
  };
  // A URL load frames a small county at up to 4×.
  await page.goto('./?county=51580');
  await expect.poll(scale).toBeCloseTo(4, 1);

  // A map click selects without moving the map.
  await page.goto('./');
  await page.waitForTimeout(300);
  const box = (await page.locator('canvas[role="img"]').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await expect.poll(() => new URL(page.url()).searchParams.get('county')).not.toBeNull();
  await page.waitForTimeout(700);
  expect(await scale()).toBe(1);

  // Search zooms in from the full view, but not beyond a closer view (it only pans).
  const search = page.getByRole('combobox', { name: 'Search for a county' });
  await search.fill('newton ms');
  await page.keyboard.press('Enter');
  await expect.poll(scale).toBeGreaterThan(1);
  const regional = await scale();
  expect(regional).toBeLessThanOrEqual(4);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
  const closer = await scale();
  expect(closer).toBeGreaterThan(regional);
  await search.fill('dona ana');
  await page.keyboard.press('Enter');
  await expect(profileTitle(page)).toHaveText('Doña Ana County, NM');
  await page.waitForTimeout(800);
  expect(await scale()).toBeCloseTo(closer, 5);
});

test('keyboard path: search → select → read profile → close', async ({ page }) => {
  await page.goto('./');
  const box = page.getByRole('combobox', { name: 'Search for a county' });
  await box.focus();
  await page.keyboard.type('dona ana');
  await expect(page.getByRole('option').first()).toHaveText('Doña Ana County, NM');
  await page.keyboard.press('Enter');
  await expect(profileTitle(page)).toHaveText('Doña Ana County, NM');
  await expect(page).toHaveURL(/county=35013/);
  // The strip explains a decade on focus, not only on hover.
  await page.getByRole('button', { name: /^1950–60: / }).focus();
  await expect(page.locator('.caption')).toHaveText(/^1950–60 · +Regional growth Doña Ana County grew \d+\.\d% while its neighboring counties together grew \d+\.\d%\.$/);
  await page.keyboard.press('Escape');
  await expect(profileTitle(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/landscape-of-loss\/$/);
});

test('use my location selects the county there, or says it is outside the study', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.32, longitude: -89.12 });
  await page.goto('./');
  await page.getByRole('button', { name: 'My location' }).click();
  await expect(profileTitle(page)).toHaveText('Newton County, MS');

  await context.setGeolocation({ latitude: 21.3069, longitude: -157.8583 });
  await page.getByRole('button', { name: 'My location' }).click();
  const status = page.getByRole('status');
  await expect(status).toHaveText(/^Your location is outside the counties in this study\./);
  // In a strip across the top of the map, under the header controls and never over the panel.
  const [msg, panel, header] = [await status.boundingBox(), await page.locator('aside.panel').boundingBox(), await page.locator('.app > .header').boundingBox()];
  expect(msg!.x + msg!.width).toBeLessThanOrEqual(panel!.x);
  expect(msg!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  await page.getByRole('button', { name: 'Dismiss message' }).click();
  await expect(status).toBeHidden();

  // The next click anywhere also clears it.
  await page.getByRole('button', { name: 'My location' }).click();
  await expect(status).toBeVisible();
  await page.locator('footer, .footer').first().click();
  await expect(status).toBeHidden();
});

test('a denied location request says how to allow it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'My location' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Check that location access is allowed for this site in your browser and in your computer’s privacy settings.',
  );
});

test('clicks select the county under the pointer, including near borders and with slight movement', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const canvas = page.locator('canvas[role="img"]');
  await page.waitForTimeout(500);
  const box = (await canvas.boundingBox())!;
  // Deterministic points whose press and release pixels (2 px apart) are both solid county fill,
  // with a 1 px margin: Chrome reports click coordinates in whole pixels, which can land up to a
  // pixel away from the fractional pointer position (the map's top edge can be fractional).
  const pts: [number, number][] = await canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const s = c.width / c.clientWidth;
    const solid = (x: number, y: number) => d[(Math.floor(y * s) * c.width + Math.floor(x * s)) * 4 + 3] === 255;
    const out: [number, number][] = [];
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (out.length < 24) {
      const x = rnd() * (c.clientWidth - 4);
      const y = rnd() * c.clientHeight;
      const around = (u: number, v: number) => [-1, 0, 1].every((du) => [-1, 0, 1].every((dv) => solid(u + du, v + dv)));
      if (x >= 1 && y >= 1 && around(x, y) && around(x + 2, y)) out.push([x, y]);
    }
    return out;
  });
  const missed: string[] = [];
  for (const [k, [x, y]] of pts.entries()) {
    await page.goto('./');
    await canvas.waitFor();
    await page.waitForTimeout(200);
    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.down();
    // Every other click drifts 2 px between press and release (d3-zoom clickDistance, 4 px).
    if (k % 2) await page.mouse.move(box.x + x + 2, box.y + y);
    await page.mouse.up();
    await expect.poll(() => new URL(page.url()).searchParams.get('county'), { timeout: 2000 }).not.toBeNull().catch(() => missed.push(`${x},${y}`));
  }
  expect(missed).toEqual([]);
});

test('tooltip: one swatch, every line starting with its time frame, no A–D label', async ({ page }) => {
  const canvas = page.locator('canvas[role="img"]');
  const cases: [string, RegExp[], boolean][] = [
    ['?mode=context&decade=1980', [/^\s*1980–90: (grew|lost) (less than )?\d+\.\d%; (neighboring counties together (grew|lost) (less than )?\d+\.\d%|it has no neighboring counties)$/, /^\s*1950–2020 pathway: .+$/], false],
    ['?decade=1980', [/^\s*1980–90: (grew|lost) (less than )?\d+\.\d%$/, /^\s*1950–2020 pathway: .+$/], false],
    ['?mode=pathways', [/^\s*1950–2020 pathway: .+$/, /^\s*2010–20: (grew|lost) (less than )?\d+\.\d%$/], true],
  ];
  for (const [search, lines, round] of cases) {
    await page.goto(`./${search}`);
    await page.waitForTimeout(300);
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.mouse.move(box.x + box.width * 0.5 + 2, box.y + box.height * 0.45);
    const tip = page.locator('.tooltip');
    await expect(tip).toBeVisible();
    await expect(tip.locator('.line')).toHaveText(lines);
    await expect(tip.locator('.dot')).toHaveCount(1);
    await expect(tip.locator('.dot.square')).toHaveCount(round ? 0 : 1);
    await expect(tip).not.toContainText(/Regional|Localized|Self population/);
  }
});

test('the profile panel shows no A–D letters', async ({ page }) => {
  await page.goto('./?mode=context&county=28101');
  const panel = page.locator('aside.panel');
  await expect(panel.locator('.cell')).toHaveCount(7);
  await expect(panel.locator('.cell').first()).toHaveText('');
  await expect(panel.locator('.key tbody td')).toHaveText([/Regional loss/, /Localized loss/, /Localized growth/, /Regional growth/]);
  await expect(panel).not.toContainText(/\bA–D\b|\b[ABCD]\b(?!\.)/);
  const note = /^\s*grew,\s+lost\. First arrow: the county’s population change that decade\. Second: its neighbors’ change \(population-weighted average\)\.\s*$/;
  await expect(panel.locator('.hint').last()).toHaveText(note);
  await expect(panel.locator('.hint').last().locator('svg')).toHaveCount(2);
  await page.getByRole('button', { name: 'Close county profile' }).click();
  await expect(panel.locator('.hint')).toHaveText(note);
  await expect(panel.locator('.hint svg')).toHaveCount(2);
});

test('downloads: this county, the filtered counties and all counties, each with a citation', async ({ page }) => {
  const save = async (name: string) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]);
    const chunks: Uint8Array[] = await (await download.createReadStream()).toArray();
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    chunks.reduce((at, c) => (bytes.set(c, at), at + c.length), 0);
    const text = new TextDecoder().decode(bytes);
    return { file: download.suggestedFilename(), lines: text.trimEnd().split('\r\n') };
  };
  await page.goto('./?county=01005');
  const one = await save('Download this county (CSV)');
  expect(one.file).toBe('landscape-of-loss-01005.csv');
  expect(one.lines[0]).toMatch(/^geoid,county,state,pathway,seq,pop1950,/);
  expect(one.lines.slice(1)).toEqual([expect.stringMatching(/^01005,Barbour County,Alabama,Emerging Localized Loss,BBDDDBB,/)]);
  await expect(page.locator('.profile .cite')).toContainText('Please cite: Park, G., Seymour, E., and Franklin, R. (2026)');
  await expect(page.locator('.profile .cite')).toContainText('Schroeder (2016)');

  await page.goto('./?mode=pathways&path=3,4');
  const some = await save('Download these counties (CSV)');
  expect(some.file).toBe('landscape-of-loss-filtered.csv');
  expect(some.lines).toHaveLength(442 + 512 + 1);
  await expect(page.locator('.legend .cite')).toContainText('Please cite:');

  const all = await save('Download all counties (CSV)');
  expect(all.file).toBe('landscape-of-loss-all.csv');
  expect(all.lines).toHaveLength(3109);
  await expect(page.locator('footer').last()).toContainText('Please cite:');
});

const noArial = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily).filter((f) => /arial/i.test(f)),
  );

test('explainer: three tabs by keyboard, Esc closes only the modal, focus returns', async ({ page }) => {
  await page.goto('./?county=28101');
  const open = page.getByRole('button', { name: 'How to read this map' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'The Landscape of Loss' });
  await expect(dialog).toBeVisible();
  const tabs = dialog.getByRole('tab');
  await expect(tabs).toHaveText(['How to read this', 'About', 'Data notes']);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  const read = dialog.getByRole('tabpanel');
  const intro = await read.locator('p.prose').first().evaluate((el) => el.textContent!.replace(/\s+/g, ' ').trim());
  expect(intro).toBe(
    'This map has three views. Decadal population change colors each county by percent population change in each census period. ' +
      'Decadal population change in spatial context shows, for the same decade, the connection between a county’s population change ' +
      'and that of its immediate neighbors (population-weighted average). Population change trajectories includes a longer period of ' +
      'population change, each decade from 1950 to 2020, and displays eight types of population change trajectory, reflecting ' +
      'different temporal and spatial experiences of population change.',
  );
  await expect(read.locator('.says')).toHaveText([
    'The county lost population, and so did its immediate neighbors, on average.',
    'The county lost population, but its immediate neighbors grew, on average.',
    'The county grew, but its immediate neighbors lost population, on average.',
    'The county grew, and so did its immediate neighbors, on average.',
  ]);
  await expect(read.getByRole('heading', { name: 'The eight types of population change' })).toBeVisible();
  await expect(dialog.locator('.pathways li')).toHaveCount(8);
  await expect(dialog.locator('svg rect.centre')).toHaveCount(4);

  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('tabpanel').locator('p').first()).toHaveText(
    /^\s*This dashboard visualizes findings from the paper below for 3,108 conterminous U\.S\. counties\./,
  );
  await expect(dialog.getByRole('tabpanel')).toContainText('doi:10.1080/24694452.2026.2691208');
  await expect(dialog.getByRole('tabpanel')).toContainText('Schroeder, Jonathan P. (2016)');
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  const notes = dialog.getByRole('tabpanel');
  for (const text of ['workbook value', 'exact breaks', 'population-weighted', 'Connecticut', 'Conterminous U.S.', '21,756 of 21,756', '104 of', '20 of 20', 'B16004']) {
    await expect(notes).toContainText(text);
  }
  // No A–D letters in the explainer either.
  await expect(dialog).not.toContainText(/\bA–D\b/);
  expect(await noArial(page)).toEqual([]);

  // Esc closes the modal, not the county profile, and focus returns to the button.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(profileTitle(page)).toHaveText('Newton County, MS');
  await expect(open).toBeFocused();
});

test('intro card: shown on a first visit, opens the explainer, stays dismissed', async ({ page }) => {
  await page.goto('./');
  const card = page.getByRole('region', { name: 'Introduction' });
  await expect(card).toContainText('Click any county to see its 70-year history.');
  await expect(card).not.toContainText('What is the geography');
  expect(await noArial(page)).toEqual([]);
  await card.getByRole('button', { name: 'How to read this' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('canvas[role="img"]')).toBeVisible();
  await expect(card).toHaveCount(0);

  // × also dismisses; a shared county link never shows it.
  await page.evaluate((key) => localStorage.removeItem(key), INTRO_KEY);
  await page.reload();
  await card.getByRole('button', { name: 'Dismiss introduction' }).click();
  await expect(card).toHaveCount(0);
  await page.evaluate((key) => localStorage.removeItem(key), INTRO_KEY);
  await page.goto('./?county=01005');
  await expect(profileTitle(page)).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('phones: map, search and profile blocks 1–3 work in the bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  const canvas = page.locator('canvas[role="img"]');
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let painted = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
        return painted / (c.width * c.height);
      }),
    )
    .toBeGreaterThan(0.2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  const search = page.getByRole('combobox', { name: 'Search for a county' });
  await search.fill('newton ms');
  await page.keyboard.press('Enter');
  await expect(profileTitle(page)).toHaveText('Newton County, MS');

  const handle = page.getByRole('button', { name: 'Show more' });
  await handle.click();
  await expect(page.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['70-year trajectory, 1950–2020', 'Each decade: the county and its neighbors']) {
    await page.getByRole('heading', { name }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name })).toBeInViewport();
  }
  await expect(page.locator('.cell')).toHaveCount(7);

  // Touch targets: the header controls and the sheet handle are at least 40 × 40 px.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.app > .header :is(button, label:not(.visually-hidden), input), aside .handle, .decades .play')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width < 40 || r.height < 40).length,
  );
  expect(small).toBe(0);
});

test('axe finds no WCAG 2.1 A/AA violations: default view, profile open, explainer open', async ({ page }) => {
  const scan = async (where: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const found = violations.map((v) => `${where}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    expect(found).toEqual([]);
  };
  await page.goto('./');
  await expect(page.locator('.breakdown')).toBeVisible();
  await scan('default view');

  await page.goto('./?county=28101');
  await page.getByRole('button', { name: 'Who lives here (ACS 2016–20)' }).click();
  await expect(page.getByText('White, non-Hispanic')).toBeVisible();
  await page.getByRole('button', { name: 'Demographic sources of change, 2010–20' }).click();
  await page.getByRole('button', { name: 'See similar counties', exact: true }).click();
  await expect(page.locator('button.match')).toHaveCount(5);
  await scan('profile');

  await page.getByRole('button', { name: 'How to read this map' }).click();
  for (const tab of ['How to read this', 'About', 'Data notes']) {
    await page.getByRole('tab', { name: tab }).click();
    await scan(`explainer: ${tab}`);
  }
});

test('acceptance data on screen: pathway counts, 2010–20 losers, Sarpy in the 10–19.9% class', async ({ page }) => {
  await page.goto('./?mode=pathways');
  await expect(page.locator('.legend .count')).toHaveText(['557', '126', '442', '512', '949', '141', '312', '69']);

  // Milam TX and Buena Vista VA lost population in 2010–20.
  await page.goto('./?county=48331');
  await expect(page.locator('.sentence').first()).toHaveText(/^Milam County lost less than 0\.1%/);
  await page.goto('./?county=51530');
  await expect(page.locator('.sentence').first()).toHaveText(/^Buena Vista city lost \d+\.\d%/);

  // Sarpy NE reads 19.9% and takes the +10% to 19.9% colour, not the 20%-or-more one.
  await page.goto('./?county=31153');
  await expect(page.locator('.sentence').first()).toHaveText(/^Sarpy County grew 19\.9%/);
  const colors = await page.evaluate(async () => {
    const meta = await (await fetch('data/meta.json')).json();
    return meta.change.map((c: { color: string }) => c.color.toLowerCase());
  });
  const lastBar = page.locator('.profile svg rect').last();
  expect((await lastBar.getAttribute('fill'))!.toLowerCase()).toBe(colors[1]);
});

test('the ?palette= colour preview is dev-only: the production build ignores it', async ({ page }) => {
  await page.goto('./?mode=pathways&palette=B');
  const swatch = page.locator('.legend .item', { hasText: 'Persistent Loss' }).locator('.swatch');
  await expect(swatch).toHaveCSS('background-color', 'rgb(239, 111, 106)');
  await expect(page.getByText('dev preview')).toHaveCount(0);
  await expect(page).toHaveURL(/\?mode=pathways$/);
});
