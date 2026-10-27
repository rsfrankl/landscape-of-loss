import { expect, test } from '@playwright/test';

test('map loads, paints, switches modes and never uses Arial', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');

  const canvas = page.locator('canvas[role="img"]');
  await expect(canvas).toHaveAttribute('aria-label', /pathway/);

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

  await expect(page.getByText('Emerging Localized Loss')).toBeVisible();
  await expect(page.locator('input[type="range"]')).toHaveCount(0);

  const modes: [string, RegExp, boolean][] = [
    ['Spatial context', /spatial context.*2010–20/, true],
    ['Population change', /population change, 2010–20/, true],
    ['2010–20 vs. 70 years', /population change, 2010–20/, false],
    ['Pathways', /pathway/, false],
  ];
  for (const [label, aria, decades] of modes) {
    await page.getByLabel(label, { exact: true }).check({ force: true });
    await expect(canvas).toHaveAttribute('aria-label', aria);
    await expect(page.locator('input[type="range"]')).toHaveCount(decades ? 1 : 0);
  }

  // Decade control keeps the decade across the two decade modes.
  await page.getByLabel('Spatial context', { exact: true }).check({ force: true });
  await page.locator('input[type="range"]').fill('2');
  await expect(canvas).toHaveAttribute('aria-label', /1970–80/);
  await page.getByLabel('Population change', { exact: true }).check({ force: true });
  await expect(canvas).toHaveAttribute('aria-label', /1970–80/);

  const arial = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .map((el) => getComputedStyle(el).fontFamily)
      .filter((f) => /arial/i.test(f)),
  );
  expect(arial).toEqual([]);
  expect(errors).toEqual([]);
});
