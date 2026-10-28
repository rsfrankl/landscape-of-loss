import type { Components, Driver } from './types';

/**
 * End of an ACS row's axis (spec 6.5 block 8): a rounded value strictly above the largest of
 * county + MOE, pathway and U.S. Steps of 5 up to 50, then 10; never past 100.
 */
export function axisEnd(largest: number): number {
  const step = largest < 50 ? 5 : 10;
  return Math.min(100, Math.max(5, (Math.floor(largest / step) + 1) * step));
}

const DRIVER_TEXT: Record<Exclude<Driver, 'other'>, string> = {
  outmig: 'Lost population through net out-migration only',
  both: 'Lost population through both net out-migration and natural decrease',
  natural: 'Lost population through natural decrease only',
};

/** Share (0–1) of loss counties with each Table 2 driver. */
export function driverShares(components: Record<string, Components>): Map<Driver, number> {
  const counts = new Map<Driver, number>();
  let n = 0;
  for (const c of Object.values(components)) {
    if (!c.driver) continue;
    counts.set(c.driver, (counts.get(c.driver) ?? 0) + 1);
    n++;
  }
  return new Map([...counts].map(([d, k]) => [d, k / n]));
}

/** "Lost population through both net out-migration and natural decrease, like 50% of loss counties." */
export function driverSentence(driver: Driver, shares: Map<Driver, number>): string {
  const pct = Math.round(100 * shares.get(driver)!);
  // "Other": the census count fell but the estimates' components both point up.
  if (driver === 'other') return `The census shows a loss, but the 2010–20 estimates show growth (as for ${pct}% of losing counties).`;
  return `${DRIVER_TEXT[driver]}, like ${pct}% of loss counties.`;
}
