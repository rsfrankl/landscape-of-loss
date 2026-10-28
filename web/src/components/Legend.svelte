<script lang="ts">
  import type { County, Meta } from '../lib/types';
  import { showsBreakdown } from '../lib/types';
  import { toggleFilter, ui } from '../lib/state.svelte';
  import { legendCounts } from '../lib/counts';
  import { formatCount } from '../lib/format';
  import { isDark } from '../lib/colors';
  import Arrows from './Arrows.svelte';
  import ArrowNote from './ArrowNote.svelte';
  import Breakdown from './Breakdown.svelte';
  import Download from './Download.svelte';

  let { meta, counties }: { meta: Meta; counties: County[] } = $props();

  const decade = $derived(ui.decade);
  const counts = $derived(legendCounts(counties, ui.mode, decade));
  const groups = $derived([
    { title: 'Loss pathways', items: meta.pathways.filter((p) => p.group === 'loss') },
    { title: 'Growth pathways', items: meta.pathways.filter((p) => p.group === 'growth') },
  ]);
  const filterNames = $derived(ui.filter.map((id) => meta.pathways[id - 1].name));

  function isolate(key: string | null): void {
    ui.isolate = key;
  }
</script>

<section class="legend" aria-label="Legend">
  {#if ui.mode === 'pathways'}
    <h2>Population-change pathways, 1950–2020</h2>
    <p class="hint">Select pathways to filter the map.</p>
    {#each groups as g (g.title)}
      <h3>{g.title}</h3>
      <ul>
        {#each g.items as p (p.id)}
          <li>
            <button
              type="button"
              class="item toggle"
              aria-pressed={ui.filter.includes(p.id)}
              class:off={ui.filter.length > 0 && !ui.filter.includes(p.id)}
              onclick={() => toggleFilter(p.id)}
              onpointerenter={() => isolate(`p${p.id}`)}
              onpointerleave={() => isolate(null)}
              onfocus={() => isolate(`p${p.id}`)}
              onblur={() => isolate(null)}
            >
              <span class="swatch" style:background={p.color}></span>
              <span class="name">{p.name}</span>
              <span class="num count">{formatCount(counts.get(`p${p.id}`) ?? 0)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  {:else if ui.mode === 'context'}
    <h2>Population change in spatial context, {meta.decades[decade].label}</h2>
    <p class="hint"><ArrowNote /></p>
    <ul>
      {#each meta.ad as a (a.code)}
        <li>
          <div
            class="item"
            role="presentation"
            onpointerenter={() => isolate(a.code)}
            onpointerleave={() => isolate(null)}
          >
            <span
              class="swatch arrows"
              style:background={a.color}
              style:color={isDark(a.color) ? 'var(--bg)' : 'var(--text)'}><Arrows arrows={a.arrows} size={13} /></span
            >
            <span class="name">{a.label}</span>
            <span class="num count">{formatCount(counts.get(a.code) ?? 0)}</span>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <h2>Population change, {meta.decades[decade].label}</h2>
    <ul>
      {#each meta.change as c (c.id)}
        <li>
          <div
            class="item"
            role="presentation"
            onpointerenter={() => isolate(`c${c.id}`)}
            onpointerleave={() => isolate(null)}
          >
            <span class="swatch" style:background={c.color}></span>
            <span class="name">{c.label}</span>
            <span class="num count">{formatCount(counts.get(`c${c.id}`) ?? 0)}</span>
          </div>
        </li>
      {/each}
    </ul>
    {#if showsBreakdown(ui.mode, decade)}
      <Breakdown {meta} {counties} />
    {/if}
  {/if}

  {#if ui.filter.length > 0}
    <p class="filter">
      Showing {filterNames.join(', ')}.
      <button type="button" class="link" onclick={() => (ui.filter = [])}>Clear filter</button>
    </p>
    <Download
      {meta}
      counties={() => counties.filter((c) => ui.filter.includes(c.pathway))}
      label="Download these counties (CSV)"
      suffix="filtered"
    />
  {/if}
</section>

<style>
  .legend {
    padding: var(--gutter);
  }
  h2 {
    font-size: var(--size-heading);
    font-weight: 800;
  }
  h3 {
    margin-top: 14px;
    font-family: var(--font-body);
    font-size: var(--size-small);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .hint {
    margin: 4px 0 8px;
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
  }
  .item {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    text-align: left;
  }
  .toggle {
    cursor: pointer;
  }
  .toggle:hover {
    border-color: var(--hairline);
  }
  .toggle[aria-pressed='true'] {
    border-color: var(--accent);
  }
  .toggle.off {
    opacity: 0.45;
  }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 3px;
  }
  .arrows {
    display: grid;
    place-items: center;
    width: 30px;
  }
  .count {
    font-size: var(--size-small);
    color: var(--muted);
  }
  .filter {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--hairline);
    font-size: var(--size-small);
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
