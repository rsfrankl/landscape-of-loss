import { expect, test } from '@playwright/test';

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
