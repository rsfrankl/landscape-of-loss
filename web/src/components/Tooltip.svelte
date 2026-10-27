<script lang="ts">
  import type { County, Meta } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { countyTitle, modeLines } from '../lib/describe';

  let {
    meta,
    county,
    x,
    y,
    bounds,
  }: { meta: Meta; county: County; x: number; y: number; bounds: { width: number; height: number } } = $props();

  let w = $state(0);
  let h = $state(0);

  const pathway = $derived(meta.pathways[county.pathway - 1]);
  // Keep the card inside the map: flip to the left of or above the pointer near an edge.
  const left = $derived(x + 14 + w > bounds.width ? Math.max(4, x - 14 - w) : x + 14);
  const top = $derived(y + 14 + h > bounds.height ? Math.max(4, y - 14 - h) : y + 14);
</script>

<div class="tooltip" bind:clientWidth={w} bind:clientHeight={h} style:left="{left}px" style:top="{top}px">
  <div class="title">{countyTitle(county)}</div>
  <div class="pathway">
    <span class="dot" style:background={pathway.color}></span>{pathway.name}
  </div>
  {#each modeLines(meta, ui.mode, county, ui.decade) as line (line.label)}
    <div class="line">
      {#if line.color}<span class="dot square" style:background={line.color}></span>{/if}
      <span>{line.label}{#if line.value !== undefined}: <span class="num">{line.value}</span>{/if}</span>
    </div>
  {/each}
</div>

<style>
  .tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 5;
    /* Natural width, so the card flips left near the edge instead of shrinking. */
    width: max-content;
    max-width: 340px;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--hairline);
    box-shadow: 0 2px 8px rgb(26 18 16 / 0.12);
    font-size: var(--size-small);
    line-height: 1.5;
  }
  .title {
    font-weight: 800;
    font-size: 13px;
    color: var(--heading);
  }
  .pathway,
  .line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .line {
    align-items: baseline;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
  }
  .square {
    border-radius: 2px;
    align-self: center;
  }
</style>
