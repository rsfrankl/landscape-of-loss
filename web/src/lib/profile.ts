/**
 * End of an ACS row's axis (spec 6.5 block 8): a rounded value strictly above the largest of
 * county + MOE, pathway and U.S. Steps of 5 up to 50, then 10; never past 100.
 */
export function axisEnd(largest: number): number {
  const step = largest < 50 ? 5 : 10;
  return Math.min(100, Math.max(5, (Math.floor(largest / step) + 1) * step));
}
