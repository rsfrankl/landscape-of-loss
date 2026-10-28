<script lang="ts">
  // Profile block 9 (spec 6.7): the 5 counties whose decade-by-decade log growth rates lie
  // closest to this county's, as small multiples of indexed population (first year = 100).
  // Mounted only while the block is open, so the map marks the matches only while they show.
  // Pointing at a row emphasises its county on the map; pointing at a match on the map marks its row.
  import { untrack } from 'svelte';
  import { line, scaleLinear } from 'd3';
  import type { County, Meta } from '../lib/types';
  import { activeMatch, openSimilar, showCounties, ui } from '../lib/state.svelte';
  import { similarCounties } from '../lib/similar';
  import { countyTitle } from '../lib/describe';

  let { meta, counties, county }: { meta: Meta; counties: County[]; county: County } = $props();

  const index = $derived(counties.indexOf(county));
  const matches = $derived(similarCounties(counties, index, ui.similar));

  $effect(() => {
    ui.matches = matches.map((m) => m.index);
    return () => {
      ui.matches = [];
      ui.matchHover = -1;
    };
  });

  const fit = () => showCounties([index, ...matches.map((m) => m.index)]);

  // Opening the block, or changing its settings, frames the county and its matches. Following a
  // match (a new county) does not: the map moves only on these and "Show on map".
  $effect(() => {
    void [ui.similar.any, ui.similar.size, ui.similar.metro];
    untrack(() => {
      if (matches.length) fit();
    });
  });

  const active = $derived(activeMatch());

  const first = $derived(meta.years[0]);
  const last = $derived(meta.years[meta.years.length - 1]);
  const indexed = (c: County) => c.pop.map((p) => (100 * p) / c.pop[0]);
  const own = $derived(indexed(county));

  // One y-scale for all five charts, so they compare.
  const W = 112;
  const H = 46;
  const x = $derived(scaleLinear().domain([0, meta.years.length - 1]).range([2, W - 2]));
  const y = $derived.by(() => {
    const all = [own, ...matches.map((m) => indexed(counties[m.index]))].flat();
    return scaleLinear()
      .domain([Math.min(100, ...all), Math.max(100, ...all)])
      .range([H - 3, 3]);
  });
  const path = (v: number[]) =>
    line<number>()
      .x((_, i) => x(i))
      .y((p) => y(p))(v) ?? '';
</script>

<fieldset class="pool">
  <legend class="visually-hidden">Counties to compare</legend>
  <label class:active={!ui.similar.any}>
    <input type="radio" name="sim-pool" checked={!ui.similar.any} onchange={() => (ui.similar.any = false)} />
    Same pathway
  </label>
  <label class:active={ui.similar.any}>
    <input type="radio" name="sim-pool" checked={ui.similar.any} onchange={() => (ui.similar.any = true)} />
    Any pathway
  </label>
</fieldset>
<div class="checks">
  <label><input type="checkbox" bind:checked={ui.similar.size} /> Similar size</label>
  <label><input type="checkbox" bind:checked={ui.similar.metro} /> Same metro status</label>
</div>

{#if matches.length === 0}
  <p class="few">No counties match these settings. Try Any pathway or clear a checkbox.</p>
{:else}
  <p class="key">
    Population indexed, {first} = 100. <span class="swatch-line own" aria-hidden="true"></span>Gray: {county.name}.
  </p>
  <ol>
    {#each matches as m (m.index)}
      {@const c = counties[m.index]}
      {@const p = meta.pathways[c.pathway - 1]}
      <li>
        <button
          type="button"
          class="match"
          class:linked={active === m.index}
          aria-label="{countyTitle(c)}, {p.name} pathway, open profile"
          onclick={() => openSimilar(m.index)}
          onpointerenter={() => (ui.matchHover = m.index)}
          onpointerleave={() => (ui.matchHover = -1)}
          onfocus={() => (ui.matchHover = m.index)}
          onblur={() => (ui.matchHover = -1)}
        >
          <svg width={W} height={H} aria-hidden="true">
            <line class="base" x1={x(0)} x2={x(meta.years.length - 1)} y1={y(100)} y2={y(100)} />
            <path class="own" d={path(own)} />
            <path class="other" d={path(indexed(c))} />
          </svg>
          <span class="text">
            <span class="name">{countyTitle(c)}</span>
            <span class="chip"><span class="dot" style:background={p.color}></span>{p.name}</span>
          </span>
        </button>
      </li>
    {/each}
  </ol>
  {#if matches.length < 5}
    <p class="few">Only {matches.length} {matches.length === 1 ? 'county matches' : 'counties match'} these settings.</p>
  {/if}
  <button type="button" class="show" onclick={fit}>
    Show on map
  </button>
{/if}
<p class="note">
  Ranked by how closely population change matched, decade by decade, {first}–{last}. Not part of the paper's analysis.
</p>

<style>
  .pool {
    display: flex;
    margin: 0;
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    overflow: hidden;
  }
  .pool label {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    cursor: pointer;
    border-left: 1px solid var(--hairline);
  }
  .pool label:first-of-type {
    border-left: 0;
  }
  .pool label.active {
    background: var(--accent);
    color: var(--bg);
  }
  .pool input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }
  .pool label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -4px;
    box-shadow: inset 0 0 0 4px var(--bg);
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 0 18px;
    margin-top: 4px;
  }
  .checks label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    cursor: pointer;
  }
  .checks input {
    accent-color: var(--accent);
    margin: 0;
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 6px;
    margin: 6px 0 4px;
    font-size: var(--size-small);
    color: var(--muted);
  }
  .swatch-line {
    display: inline-block;
    width: 16px;
    border-top: 2px solid var(--muted);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .match {
    display: grid;
    /* A fixed chart column, so the five charts share the same x positions. */
    grid-template-columns: 112px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .match:hover {
    border-color: var(--hairline);
  }
  /* Linked with the map: this row's county is outlined there, or under the pointer there. */
  .match.linked {
    border-color: var(--muted);
  }
  svg {
    display: block;
  }
  .base {
    stroke: var(--hairline);
  }
  path {
    fill: none;
    stroke-linejoin: round;
  }
  .own {
    stroke: var(--muted);
    stroke-width: 1.5;
  }
  .other {
    stroke: var(--heading);
    stroke-width: 1.75;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 800;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--size-small);
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .few {
    margin: 6px 0 0;
  }
  .show {
    min-height: 40px;
    margin-top: 8px;
    padding: 0 14px;
    background: var(--bg);
    border: 1px solid var(--hairline);
    border-radius: 4px;
    cursor: pointer;
  }
  .show:hover {
    border-color: var(--muted);
  }
  .note {
    margin: 10px 0 0;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
