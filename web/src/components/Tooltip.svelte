<script lang="ts">
  import type { County, Meta } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { countyTitle, modeLine } from '../lib/describe';

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
  <div class="num">{modeLine(meta, ui.mode, county, ui.decade)}</div>
</div>

<style>
  .tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 5;
    max-width: 300px;
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
  .pathway {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
  }
</style>
