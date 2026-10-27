// Hover hit-testing by a hidden canvas with one colour per county (spec 8.1).
// Colour 0 (black) is "no county"; county i is drawn as i + 1.

export function pickColor(index: number): string {
  const v = index + 1;
  return `rgb(${v & 255},${(v >> 8) & 255},${(v >> 16) & 255})`;
}

/** County index for a picked pixel, or -1 for background or an id that cannot exist. */
export function decodePick(r: number, g: number, b: number, count: number): number {
  const v = r | (g << 8) | (b << 16);
  return v >= 1 && v <= count ? v - 1 : -1;
}

/** Pick pixels searched around the pointer: the centre one, then a 5 × 5 window. */
export const PICK_RADIUS = 2;

/**
 * Distinct county indices decoded from a window of pick pixels (RGBA, `w` × `h`), the pixel at
 * (`cx`, `cy`) first, then by distance. Anti-aliased border pixels blend two counties' colours
 * and decode to an unrelated county, so the caller must confirm each candidate geometrically.
 */
export function pickCandidates(data: ArrayLike<number>, w: number, h: number, cx: number, cy: number, count: number): number[] {
  const cells: { k: number; d: number }[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ k: y * w + x, d: (x - cx) ** 2 + (y - cy) ** 2 });
  cells.sort((a, b) => a.d - b.d || a.k - b.k);
  const out: number[] = [];
  for (const { k } of cells) {
    const i = decodePick(data[k * 4], data[k * 4 + 1], data[k * 4 + 2], count);
    if (i >= 0 && !out.includes(i)) out.push(i);
  }
  return out;
}
