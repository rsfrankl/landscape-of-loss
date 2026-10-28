import { expect, test, type Page } from '@playwright/test';

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
  // Fixed line: no layout shift (compared relative to each other, since hovering may scroll the panel).
  const [after, rowAfter] = [(await readout.boundingBox())!, (await row.boundingBox())!];
  expect(after.height).toBe(before!.height);
  expect(rowAfter.y - after.y).toBeCloseTo(rowBox!.y - before!.y, 1);
  await expect(page.locator('ul.key')).toContainText('Conterminous U.S.');
  await expect(page.getByText('Each row has its own scale.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Why it changed, 2010–20' }).click();
  await expect(page.getByText(/like \d+% of loss counties\.$/)).toBeVisible();
  const arial = await page.evaluate(() =>
    [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily).filter((f) => /arial/i.test(f)),
  );
  expect(arial).toEqual([]);
  expect(errors).toEqual([]);
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

test('similar counties: 5 matches ringed on the map, settings in the URL, back link', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?county=01005');
  await page.getByRole('button', { name: 'Similar counties' }).click();
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

  // Hovering a row outlines its county like the selection and adds a locator ring; the map stays put.
  const view = () => page.locator('svg > g').first().getAttribute('transform');
  await page.waitForTimeout(800); // the URL load's zoom transition
  const before = await view();
  await matches.nth(1).hover();
  await expect(page.locator('path.line.linked')).toHaveCount(1);
  await expect(page.locator('circle.locator')).toHaveCount(2);
  expect(await page.locator('path.line.linked').evaluate((el) => getComputedStyle(el).strokeWidth)).toBe('2px');
  expect(await view()).toBe(before);
  await page.mouse.move(0, 0);
  await expect(page.locator('circle.locator')).toHaveCount(0);
  // Focus does the same as hover.
  await matches.first().focus();
  await expect(page.locator('circle.locator')).toHaveCount(2);
  await matches.first().blur();

  // Hovering a matched county on the map marks its row (at full extent, so the match is on screen).
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.waitForTimeout(700);
  const ring = (await page.locator('path.line.match').first().boundingBox())!;
  await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
  await expect(page.locator('button.match.linked')).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(page.getByText('Not part of the paper\'s analysis.', { exact: false })).toBeVisible();
  // The page itself never scrolls; only the panel does.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);

  await page.getByText('Any pathway').click();
  await page.getByLabel('Similar size').check();
  await expect(page).toHaveURL(/\?county=01005&sim=any,size$/);
  await page.reload();
  await page.getByRole('button', { name: 'Similar counties' }).click();
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
  await expect(page.getByRole('button', { name: '← Back to breakdown' })).toBeVisible();

  // Closing the profile removes the rings; a pool with no matches says so.
  await page.getByRole('button', { name: 'Close county profile' }).click();
  await expect(page.locator('path.line.match')).toHaveCount(0);
  await page.goto('./?county=06037&sim=size,metro');
  await page.getByRole('button', { name: 'Similar counties' }).click();
  await expect(page.getByText('No counties match these settings.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
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
  // On its own line under the header controls, clear of the panel title.
  const [msg, panel] = [await status.boundingBox(), await page.locator('aside.panel').boundingBox()];
  expect(msg!.y + msg!.height).toBeLessThanOrEqual(panel!.y);
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
  // Deterministic points whose press and release pixels (2 px apart) are both solid county fill.
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
      if (solid(x, y) && solid(x + 2, y)) out.push([x, y]);
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
