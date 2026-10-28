// Zoom on select (spec 6.9): search, location and URL loads frame a county in its region.

/** Largest zoom used to frame a selected county. */
export const REGIONAL_MAX = 4;

/**
 * Scale that frames a county's bounding box (in unzoomed map pixels) at about 1/20 of the map
 * width, between 1× and 4×. Never zooms out from a closer view: then it only pans.
 */
export function regionalScale(boxW: number, boxH: number, mapW: number, currentK: number): number {
  const target = Math.min(REGIONAL_MAX, Math.max(1, mapW / 20 / Math.max(boxW, boxH)));
  return Math.max(target, currentK);
}
