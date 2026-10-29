<script lang="ts">
  // County search (spec 6.8): an ARIA combobox over "County name, ST", top 8 matches, ↑ ↓ Enter.
  import { untrack } from 'svelte';
  import type { County } from '../lib/types';
  import { selectCounty } from '../lib/state.svelte';
  import { buildIndex, search } from '../lib/search';
  import { countyTitle } from '../lib/describe';

  let { counties }: { counties: County[] } = $props();

  const index = buildIndex(untrack(() => counties));
  let query = $state('');
  let open = $state(false);
  let active = $state(0);
  const results = $derived(search(index, query));
  const expanded = $derived(open && results.length > 0);

  function choose(i: number): void {
    selectCounty(i, true);
    query = '';
    open = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      open = true;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + results.length) % results.length;
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape' && (expanded || query)) {
      // Close the list first; Esc on an empty search falls through and closes the profile.
      event.stopPropagation();
      if (expanded) open = false;
      else query = '';
    }
  }
</script>

<div class="search">
  <label for="county-search" class="visually-hidden">Search for a county</label>
  <input
    id="county-search"
    type="search"
    role="combobox"
    autocomplete="off"
    spellcheck="false"
    placeholder="Search county…"
    aria-autocomplete="list"
    aria-controls="county-results"
    aria-expanded={expanded}
    aria-activedescendant={expanded ? `county-result-${active}` : undefined}
    bind:value={query}
    oninput={() => {
      open = true;
      active = 0;
    }}
    onkeydown={onKeydown}
    onblur={() => (open = false)}
  />
  <ul id="county-results" role="listbox" aria-label="Matching counties" hidden={!expanded}>
    {#each results as i, k (i)}
      <!-- svelte-ignore a11y_click_events_have_key_events (the combobox input handles the keys) -->
      <li
        id="county-result-{k}"
        role="option"
        aria-selected={k === active}
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => choose(i)}
        onpointerenter={() => (active = k)}
      >
        {countyTitle(counties[i])}
      </li>
    {/each}
  </ul>
</div>

<style>
  .search {
    position: relative;
    width: 260px;
  }
  /* Narrower below 1280 px, so the tools share the tabs' row down to about 1160 px (spec 6.1); on phones the row's free width. */
  @media (max-width: 1279px) {
    .search {
      width: 168px;
    }
  }
  @media (max-width: 767px) {
    .search {
      width: auto;
    }
  }
  input {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    background: var(--bg);
  }
  input::placeholder {
    color: var(--muted);
  }
  ul {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    background: var(--bg);
    border: 1px solid var(--hairline);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgb(26 18 16 / 0.12);
  }
  li {
    padding: 8px 12px;
    cursor: pointer;
  }
  li[aria-selected='true'] {
    background: var(--accent);
    color: var(--bg);
  }
</style>
