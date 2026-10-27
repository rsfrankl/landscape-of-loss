<script lang="ts">
  // Minimal selected-county panel for milestone 2: everything the tooltip shows, reachable by
  // click (CLAUDE.md design rule). Milestone 3 replaces it with the full profile (spec 6.5).
  import type { County, Meta } from '../lib/types';
  import { LAST_DECADE } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { changeLine, contextLines, countyTitle, recentLine, type Line } from '../lib/describe';
  import { formatCount } from '../lib/format';

  let { meta, county }: { meta: Meta; county: County } = $props();

  const pathway = $derived(meta.pathways[county.pathway - 1]);
  // Trajectories mode hides the slider, so it describes 2010–20.
  const decade = $derived(ui.mode === 'pathways' ? LAST_DECADE : ui.decade);
  const lines: Line[] = $derived([
    recentLine(meta, county),
    ...(decade === LAST_DECADE ? [] : [changeLine(meta, county, decade)]),
    ...contextLines(meta, county, decade),
    { label: `Population (${meta.years[meta.years.length - 1]})`, value: formatCount(county.pop[county.pop.length - 1]) },
  ]);
</script>

<section class="stub" aria-labelledby="stub-title">
  <div class="head">
    <h2 id="stub-title">{countyTitle(county)}</h2>
    <button type="button" class="close" aria-label="Close county" onclick={() => (ui.selected = -1)}>×</button>
  </div>
  <p class="chip">
    <span class="dot" style:background={pathway.color}></span>
    {pathway.name} · {pathway.group === 'loss' ? 'Loss pathway' : 'Growth pathway'}
  </p>
  <ul>
    {#each lines as line (line.label)}
      <li>
        {#if line.color}<span class="swatch" style:background={line.color}></span>{/if}
        <span>{line.label}{#if line.value !== undefined}: <span class="num">{line.value}</span>{/if}</span>
      </li>
    {/each}
  </ul>
  <p class="note">The full county profile arrives in the next milestone.</p>
</section>

<style>
  .stub {
    padding: var(--gutter);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  h2 {
    font-size: 18px;
    font-weight: 800;
  }
  .close {
    flex: none;
    width: 40px;
    height: 40px;
    margin: -8px -8px 0 0;
    border: 0;
    background: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 14px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 4px 0;
  }
  .swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 2px;
    align-self: center;
  }
  .note {
    margin-top: 18px;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
