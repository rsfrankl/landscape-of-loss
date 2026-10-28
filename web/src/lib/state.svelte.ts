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
  /** Similar counties outlined on the map, while profile block 9 is open. */
  matches: [] as number[],
  /** Similar county whose row is under the pointer or focus; -1 for none. */
  matchHover: -1,
  /** Counties to go back to after following a similar county ("← Back to …"). */
  trail: [] as number[],
});

/**
 * Asks the map to frame a county in its region (search, location, URL loads; spec 6.9), or with
 * `counties` set, to fit a set ("Show on map").
 */
export const focus = $state({ county: -1, seq: 0, counties: [] as number[] });

/**
 * Selects a county (or -1 to close). Only `zoom` (search, location, URL loads) moves the map;
 * map clicks never do. Clears the trail of similar counties followed; openSimilar and goBack
 * keep it.
 */
export function selectCounty(i: number, zoom = false): void {
  ui.selected = i;
  ui.trail = [];
  if (i < 0 || !zoom) return;
  focus.county = i;
  focus.counties = [];
  focus.seq++;
}

/** Opens a similar county (spec 6.7), remembering the current one for "← Back to …". */
export function openSimilar(i: number): void {
  const trail = [...ui.trail, ui.selected];
  selectCounty(i);
  ui.trail = trail;
}

/** Returns to the county the current one was reached from. */
export function goBack(): void {
  const trail = ui.trail.slice(0, -1);
  selectCounty(ui.trail[ui.trail.length - 1]);
  ui.trail = trail;
}

/** Asks the map to zoom so that all these counties are in view ("Show on map"). */
export function showCounties(list: number[]): void {
  focus.counties = list;
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
export const profileOpen = $state({ acs: false, components: false, similar: false });

export function toggleFilter(pathway: number): void {
  ui.filter = ui.filter.includes(pathway)
    ? ui.filter.filter((p) => p !== pathway)
    : [...ui.filter, pathway].sort((a, b) => a - b);
}
