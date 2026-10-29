// Dev-only preview of the pathway colour options in docs/pathway-colours.md (spec 8.6):
// `?palette=A`, `B` or `C` on the dev server recolours the pathways everywhere (map, legend,
// profile, explainer). Every use sits behind `import.meta.env.DEV`, so production builds drop this
// module and the live site always uses meta.json. The hexes mirror pipeline/checks/pathway_colours.R.
import type { Meta } from './types';

/** Changed colours by pathway id; A is the paper's Fig. 8 palette, unchanged. */
const OPTIONS: Record<string, Record<number, string>> = {
  A: {},
  B: { 2: '#f3a31a', 3: '#c0433d', 8: '#aef3a0' },
  C: { 2: '#f3a31a', 4: '#007e40', 8: '#aef3a0' },
};

/** The option named in the URL, or null. */
export function devPalette(): string | null {
  const p = new URLSearchParams(location.search).get('palette')?.toUpperCase();
  return p && p in OPTIONS ? p : null;
}

/**
 * Recolours the pathways in the loaded meta.json to the option in the URL, and labels the page
 * with a badge at the top right.
 */
export function applyDevPalette(meta: Meta): void {
  const p = devPalette();
  if (!p) return;
  for (const [id, color] of Object.entries(OPTIONS[p])) meta.pathways[Number(id) - 1].color = color;
  const badge = document.createElement('p');
  badge.textContent = `Pathway colours: option ${p} (dev preview)`;
  badge.style.cssText =
    'position: fixed; top: 8px; right: 8px; z-index: 10; margin: 0; padding: 4px 10px; pointer-events: none;' +
    'border: 1px solid var(--heading); border-radius: 4px; background: var(--bg); font-weight: 800;';
  document.body.append(badge);
}

/** Keeps `palette` in the query string when the URL sync rewrites it. */
export function withDevPalette(search: string): string {
  const p = devPalette();
  return p ? `${search}${search ? '&' : '?'}palette=${p}` : search;
}
