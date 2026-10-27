import type { Mode } from './types';
import { LAST_DECADE } from './types';

// Shared view state. Names follow the URL keys in spec 6.9 (mode, decade, county, path) so
// milestone 3 can round-trip them.
export const ui = $state({
  mode: 'pathways' as Mode,
  /** Decade index 0–6, shared by Spatial context and Population change. */
  decade: LAST_DECADE,
  /** Pathway ids kept by the legend filter; empty keeps all. Persists across modes. */
  filter: [] as number[],
  /** Legend key under the pointer, e.g. "p3", "A", "c2"; dims everything else. */
  isolate: null as string | null,
  /** County indices (TopoJSON order); -1 for none. */
  hovered: -1,
  selected: -1,
  playing: false,
});

export function toggleFilter(pathway: number): void {
  ui.filter = ui.filter.includes(pathway)
    ? ui.filter.filter((p) => p !== pathway)
    : [...ui.filter, pathway].sort((a, b) => a - b);
}
