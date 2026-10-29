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
  /** Similar counties outlined on the map, while profile block 7 is open. */
  matches: [] as number[],
  /** Similar county whose row is under the pointer or focus; -1 for none. */
  matchHover: -1,
  /** The selected county and every similar county lie wholly inside the map's settled view. */
  matchesInView: true,
  /** Counties to go back to after following a similar county ("← Back to …"). */
  trail: [] as number[],
  /**
   * The profile was opened while a breakdown pathway was pinned or pointed at (spec 6.6), so it
   * offers "← Back to breakdown".
   */
  fromBreakdown: false,
});

/** A map view: the d3-zoom transform's scale and translation. */
export type View = { k: number; x: number; y: number };

/**
 * Asks the map to frame a county in its region (search, location, URL loads; spec 6.9), with
 * `counties` set to fit a set ("Show on map"), or with `view` set to return to a view.
 */
export const focus = $state({ county: -1, seq: 0, counties: [] as number[], view: null as View | null });

/** The map's current view, kept up to date by the map (not reactive). */
export const mapView: { current: View } = { current: { k: 1, x: 0, y: 0 } };

/** The view before similar counties were opened (spec 6.7); hiding them returns to it. */
export const similarView: { before: View | null } = { before: null };

/**
 * Selects a county (or -1 to close). Only `zoom` (search, location, URL loads) moves the map;
 * map clicks never do. Clears the trail of similar counties followed and collapses similar
 * counties; openSimilar and goBack keep both.
 */
export function selectCounty(i: number, zoom = false): void {
  ui.fromBreakdown = i >= 0 && breakdownHighlight() !== null;
  ui.selected = i;
  ui.trail = [];
  similarView.before = null;
  profileOpen.similar = false;
  if (i < 0 || !zoom) return;
  focus.county = i;
  focus.counties = [];
  focus.view = null;
  focus.seq++;
}

/** Selects a county reached from similar counties, keeping the trail state and the block open. */
function keepSimilar(i: number, trail: number[]): void {
  const kept = [ui.fromBreakdown, profileOpen.similar, similarView.before] as const;
  selectCounty(i);
  ui.trail = trail;
  [ui.fromBreakdown, profileOpen.similar, similarView.before] = kept;
}

/** Opens a similar county (spec 6.7), remembering the current one for "← Back to …". */
export function openSimilar(i: number): void {
  keepSimilar(i, [...ui.trail, ui.selected]);
}

/** Returns to the county the current one was reached from. */
export function goBack(): void {
  keepSimilar(ui.trail[ui.trail.length - 1], ui.trail.slice(0, -1));
}

/**
 * Opens or collapses profile block 7. Collapsing it (or "Hide similar counties") returns the map
 * to the view from before the block was opened.
 */
export function setSimilarOpen(open: boolean): void {
  profileOpen.similar = open;
  if (open || !similarView.before) return;
  focus.view = similarView.before;
  focus.counties = [];
  focus.seq++;
  similarView.before = null;
}

/**
 * The similar county emphasised on the map and in profile block 7: its row under the pointer or focus,
 * else the matched county under the pointer on the map; -1 for none.
 */
export function activeMatch(): number {
  if (ui.matchHover >= 0) return ui.matchHover;
  return ui.matches.includes(ui.hovered) ? ui.hovered : -1;
}

/** Asks the map to zoom so that all these counties are in view ("Show on map"). */
export function showCounties(list: number[]): void {
  focus.counties = list;
  focus.view = null;
  focus.seq++;
}

/** The breakdown pathway the map highlights: the hovered one, else the pinned one. */
export function breakdownHighlight(): number | null {
  return showsBreakdown(ui.mode, ui.decade) ? (ui.highlight ?? ui.pinned) : null;
}

export function togglePinned(pathway: number): void {
  ui.pinned = ui.pinned === pathway ? null : pathway;
}

/** The explainer modal (spec 6.9): open state and the tab shown. */
export type AboutTab = 'read' | 'about' | 'notes';
export const about = $state({ open: false, tab: 'read' as AboutTab, section: null as string | null });

/** Opens the explainer on a tab, scrolled to `section` (an `about-sec-…` heading) if given. */
export function openAbout(tab: AboutTab = 'read', section: string | null = null): void {
  about.tab = tab;
  about.section = section;
  about.open = true;
}

/** A short status message in a strip over the top of the map (e.g. location results). */
export const notice = $state({ text: '' });

/**
 * Open state of the profile's collapsible blocks. ACS and components are kept across selections
 * for the session; similar counties starts collapsed for each newly selected county (spec 6.5).
 */
export const profileOpen = $state({ acs: false, components: false, similar: false });

export function toggleFilter(pathway: number): void {
  ui.filter = ui.filter.includes(pathway)
    ? ui.filter.filter((p) => p !== pathway)
    : [...ui.filter, pathway].sort((a, b) => a - b);
}
