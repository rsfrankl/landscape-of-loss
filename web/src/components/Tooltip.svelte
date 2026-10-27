<script lang="ts">
  import type { County, Meta } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { countyTitle, tooltipLines } from '../lib/describe';

  let {
    meta,
    county,
    x,
    y,
    bounds,
  }: { meta: Meta; county: County; x: number; y: number; bounds: { width: number; height: number } } = $props();

  let w = $state(0);
  let h = $state(0);

  const lines = $derived(tooltipLines(meta, ui.mode, county, ui.decade));
  // Keep the card inside the map: flip to the left of or above the pointer near an edge.
  const left = $derived(x + 14 + w > bounds.width ? Math.max(4, x - 14 - w) : x + 14);
  const top = $derived(y + 14 + h > bounds.height ? Math.max(4, y - 14 - h) : y + 14);
</script>

<div class="tooltip" bind:clientWidth={w} bind:clientHeight={h} style:left="{left}px" style:top="{top}px">
  <div class="title">{countyTitle(county)}</div>
  {#each lines as line, i (i)}
    <div class="line">
      {#if line.swatch}<span class="dot" class:square={!line.swatch.round} style:background={line.swatch.color}></span>{/if}
      <span>{#each line.segs as part, j (j)}{#if part.num}<span class="num">{part.text}</span>{:else}{part.text}{/if}{/each}</span>
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
  .line {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    align-self: center;
  }
  .square {
    border-radius: 2px;
  }
</style>
