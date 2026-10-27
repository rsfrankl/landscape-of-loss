import type { County, Meta } from './types';
import { ui } from './state.svelte';
import { parseUrl, toSearch, type UrlState } from './url';

function apply(s: UrlState): void {
  ui.mode = s.mode;
  ui.decade = s.decade;
  ui.selected = s.selected;
  ui.filter = s.filter;
}

/**
 * Applies the page URL to the view state, then keeps the URL in step with it. Opening or
 * closing a county adds a history entry, so Back returns to the previous county; every other
 * change replaces the current entry. Call once, after the startup data has loaded.
 */
export function startUrlSync(meta: Meta, counties: County[]): () => void {
  apply(parseUrl(location.search, meta, counties));

  const current = () => toSearch(parseUrl(location.search, meta, counties), meta, counties);
  const write = (search: string, push: boolean) => {
    const url = `${location.pathname}${search}${location.hash}`;
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  };
  // Canonical form at load, e.g. the mode=recent redirect.
  if (location.search !== current()) write(current(), false);

  const onPopState = () => apply(parseUrl(location.search, meta, counties));
  window.addEventListener('popstate', onPopState);

  const stop = $effect.root(() => {
    $effect(() => {
      const next = toSearch(
        { mode: ui.mode, decade: ui.decade, selected: ui.selected, filter: ui.filter },
        meta,
        counties,
      );
      if (next === location.search) return;
      const selectedNow = parseUrl(location.search, meta, counties).selected;
      write(next, selectedNow !== ui.selected);
    });
  });

  return () => {
    stop();
    window.removeEventListener('popstate', onPopState);
  };
}
