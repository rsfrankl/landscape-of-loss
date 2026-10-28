import type { County, Meta, Mode } from './types';
import { LAST_DECADE, MODES, showsBreakdown } from './types';

// URL state (spec 6.9): ?mode=context&decade=1990&county=01005&path=3,4&hl=3. `decade` is the
// decade's start year; defaults are left out so the plain URL is the default view.

export interface UrlState {
  mode: Mode;
  /** Decade index 0–6. */
  decade: number;
  /** County index (TopoJSON order); -1 for none. */
  selected: number;
  filter: number[];
  /** Pathway pinned in the 2010–20 breakdown; only kept where the breakdown shows. */
  pinned: number | null;
}

export const DEFAULT_STATE: UrlState = { mode: 'change', decade: LAST_DECADE, selected: -1, filter: [], pinned: null };

/** Reads a query string. Unknown or malformed values fall back to the default for that key. */
export function parseUrl(search: string, meta: Meta, counties: County[]): UrlState {
  const q = new URLSearchParams(search);
  const state: UrlState = { ...DEFAULT_STATE, filter: [] };

  let mode = q.get('mode');
  let decade = q.get('decade');
  // The retired "2010–20 vs. 70 years" tab redirects to Decadal population change at 2010–20.
  if (mode === 'recent') {
    mode = 'change';
    decade = String(meta.decades[LAST_DECADE].start);
  }
  if (MODES.some((m) => m.id === mode)) state.mode = mode as Mode;

  const d = meta.decades.findIndex((x) => String(x.start) === decade);
  if (d >= 0) state.decade = d;

  const geoid = q.get('county');
  if (geoid) state.selected = counties.findIndex((c) => c.geoid === geoid);

  const ids = new Set(meta.pathways.map((p) => p.id));
  state.filter = [...new Set((q.get('path') ?? '').split(',').map(Number))]
    .filter((p) => ids.has(p))
    .sort((a, b) => a - b);

  const hl = Number(q.get('hl'));
  if (ids.has(hl) && showsBreakdown(state.mode, state.decade)) state.pinned = hl;
  return state;
}

/** The canonical query string for a state, with a leading "?" (or "" for the default view). */
export function toSearch(state: UrlState, meta: Meta, counties: County[]): string {
  const q = new URLSearchParams();
  if (state.mode !== DEFAULT_STATE.mode) q.set('mode', state.mode);
  if (state.decade !== DEFAULT_STATE.decade) q.set('decade', String(meta.decades[state.decade].start));
  if (state.selected >= 0) q.set('county', counties[state.selected].geoid);
  if (state.filter.length) q.set('path', state.filter.join(','));
  if (state.pinned !== null && showsBreakdown(state.mode, state.decade)) q.set('hl', String(state.pinned));
  // Keep the commas in `path` readable.
  const s = q.toString().replace(/%2C/g, ',');
  return s ? `?${s}` : '';
}
