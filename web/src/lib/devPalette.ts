// Dev-only preview of the pathway colour options in docs/pathway-colours.md (spec 8.6):
// `?palette=A`, `B` or `C` on the dev server recolours the pathways everywhere (map, legend,
// profile, explainer). Every use sits behind `import.meta.env.DEV`, so production builds drop this
// module and the live site always uses meta.json. The hexes mirror pipeline/checks/pathway_colours.R.
import type { Meta } from './types';

/** Each option's eight pathway colours, by id. A is the paper's Fig. 8; C is the one in use. */
const FIG8 = ['#6388b4', '#ffae34', '#ef6f6a', '#00a86b', '#8cc2ca', '#e5e522', '#bb7693', '#8cd17d'];
const OPTIONS: Record<string, string[]> = {
  A: FIG8,
  B: FIG8.map((c, i) => ({ 1: '#f3a31a', 2: '#c0433d', 7: '#aef3a0' })[i] ?? c),
  C: FIG8.map((c, i) => ({ 1: '#f3a31a', 3: '#007e40', 7: '#aef3a0' })[i] ?? c),
};

/** The option named in the URL, or null. */
export function devPalette(): string | null {
  const p = new URLSearchParams(location.search).get('palette')?.toUpperCase();
  return p && p in OPTIONS ? p : null;
}

/**
 * Recolours the pathways in the loaded meta.json to the option in the URL, and labels the map
 * with a badge at its top left (added once the map area has rendered).
 */
export function applyDevPalette(meta: Meta): void {
  const p = devPalette();
  if (!p) return;
  OPTIONS[p].forEach((color, i) => (meta.pathways[i].color = color));
  const badge = document.createElement('p');
  badge.textContent = `Pathway colours: option ${p} (dev preview)`;
  badge.style.cssText =
    'position: absolute; top: 8px; left: var(--gutter); z-index: 2; margin: 0; padding: 4px 10px;' +
    'pointer-events: none; border: 1px solid var(--heading); border-radius: 4px; background: var(--bg); font-weight: 800;';
  const place = () => {
    const map = document.querySelector('main.map');
    if (map) map.append(badge);
    else requestAnimationFrame(place);
  };
  place();
}

/** Keeps `palette` in the query string when the URL sync rewrites it. */
export function withDevPalette(search: string): string {
  const p = devPalette();
  return p ? `${search}${search ? '&' : '?'}palette=${p}` : search;
}
