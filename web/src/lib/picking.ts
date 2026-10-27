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
