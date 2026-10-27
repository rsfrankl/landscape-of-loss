import type { ChangeClass } from './types';

const MINUS = '−';

/** Truncate toward zero to 1 decimal (19.997 → 19.9, −0.04 → −0.0), never round (spec 6.2). */
export function truncate1(x: number): number {
  return Math.trunc(Math.round(x * 1e3) / 1e2) / 10;
}

function signed(abs: number, negative: boolean): string {
  return `${negative ? MINUS : '+'}${abs.toFixed(1)}%`;
}

/**
 * A county's decadal change for display. The sign comes from the change class, so a value
 * that truncates to zero still reads as a loss when the county lost people (Milam TX: −0.0%).
 */
export function formatPct(pct: number, cls: number): string {
  return signed(Math.abs(truncate1(pct)), cls >= 4);
}

/** Class id for an unrounded % change, from the meta.json breaks. Used only as a cross-check. */
export function changeClass(pct: number, classes: ChangeClass[]): number {
  for (const c of classes) {
    const aboveMin = c.min === null || (c.includeMin ? pct >= c.min : pct > c.min);
    const belowMax = c.max === null || (c.includeMax ? pct <= c.max : pct < c.max);
    if (aboveMin && belowMax) return c.id;
  }
  throw new Error(`no change class for ${pct}`);
}

const thousands = new Intl.NumberFormat('en-US');

export function formatCount(n: number): string {
  return thousands.format(n);
}
