import type { Mode } from './types';
import { LAST_DECADE, showsBreakdown } from './types';
import { DEFAULT_SIMILAR, type SimilarOptions } from './similar';

// Shared view state. lib/urlSync.svelte.ts round-trips mode, decade, selected and filter
// through the URL keys of spec 6.9 (mode, decade, county, path).
export const ui = $state({
  mode: 'change' as Mode,
  /** Decade index 0–6, shared by Spatial context and Population change. */
  decade: LAST_DECADE,
  /** Pathway ids kept by the legend filter; empty keeps all. Persists across modes. */
  filter: [] as number[],
  /** Legend key under the pointer, e.g. "p3", "A", "c2"; dims everything else. */
  isolate: null as string | null,
  /** Breakdown pathway under the pointer or focus (spec 6.6); fades the other counties. */
  highlight: null as number | null,
  /** Breakdown pathway pinned by a click; kept while a county is open. */
  pinned: null as number | null,
  /** County indices (TopoJSON order); -1 for none. */
  hovered: -1,
  selected: -1,
  playing: false,
  /** Similar-counties settings (spec 6.7); kept across selections. */
  similar: { ...DEFAULT_SIMILAR } as SimilarOptions,
  /** Similar counties ringed on the map, while profile block 9 is open. */
  matches: [] as number[],
  /** Counties to go back to after following a similar county ("← Back to …"). */
  trail: [] as number[],
});

/**
 * Asks the map to bring a county into view. `force` (search, location) always zooms to it;
 * otherwise the map zooms only when the county is off-screen or under 12 px (spec 6.9).
 */
export const focus = $state({ county: -1, force: false, seq: 0 });

/** Selects a county (or -1 to close) and asks the map to bring it into view. */
export function selectCounty(i: number, force = false): void {
  ui.selected = i;
  if (i < 0) return;
  focus.county = i;
  focus.force = force;
  focus.seq++;
}

/** The breakdown pathway the map highlights: the hovered one, else the pinned one. */
export function breakdownHighlight(): number | null {
  return showsBreakdown(ui.mode, ui.decade) ? (ui.highlight ?? ui.pinned) : null;
}

export function togglePinned(pathway: number): void {
  ui.pinned = ui.pinned === pathway ? null : pathway;
}

/** A short status message on its own line under the header controls (e.g. location results). */
export const notice = $state({ text: '' });

/** Open state of the profile's collapsible blocks; kept across selections for the session. */
export const profileOpen = $state({ acs: false, components: false });

export function toggleFilter(pathway: number): void {
  ui.filter = ui.filter.includes(pathway)
    ? ui.filter.filter((p) => p !== pathway)
    : [...ui.filter, pathway].sort((a, b) => a - b);
}
