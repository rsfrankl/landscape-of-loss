<script lang="ts">
  // Profile block 3 (spec 6.5): seven A–D cells. Hover previews a cell's explanation; focus or
  // click pins it, so it is reachable without hover. The only A–D colours in the panel.
  import type { AdCode, County, Meta } from '../lib/types';
  import { MODES } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { isDark } from '../lib/colors';
  import { stripCaption } from '../lib/describe';

  let { meta, county }: { meta: Meta; county: County } = $props();

  let hovered = $state(-1);
  let pinned = $state(-1);
  // A new county starts with nothing pinned.
  $effect.pre(() => {
    void county;
    hovered = -1;
    pinned = -1;
  });

  const current = $derived(MODES.find((m) => m.id === ui.mode)!.usesDecade ? ui.decade : -1);
  const shown = $derived(hovered >= 0 ? hovered : pinned);
  const colors = $derived(new Map(meta.ad.map((a) => [a.code, a.color])));
</script>

<div class="strip" role="group" aria-label="A–D state by decade">
  {#each meta.decades as d, i (d.label)}
    {@const color = colors.get(county.seq[i] as AdCode)!}
    <div class="col">
      <button
        type="button"
        class="cell"
        class:current={i === current}
        aria-pressed={pinned === i}
        aria-label={stripCaption(meta, county, i)}
        style:background={color}
        style:color={isDark(color) ? 'var(--bg)' : 'var(--text)'}
        onpointerenter={() => (hovered = i)}
        onpointerleave={() => (hovered = -1)}
        onfocus={() => (pinned = i)}
        onclick={() => (pinned = i)}>{county.seq[i]}</button
      >
      <!-- Two-digit years ("80–90") fit seven cells in the 380 px panel; the caption has the full label. -->
      <span class="decade" aria-hidden="true">{String(d.start).slice(2)}–{String(d.end).slice(2)}</span>
    </div>
  {/each}
</div>
<p class="caption">
  {#if shown >= 0}
    {stripCaption(meta, county, shown)}
  {:else}
    <span class="hint">Point to or select a decade to explain it.</span>
  {/if}
</p>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }
  .cell {
    width: 100%;
    height: 40px;
    border: 0;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 15px;
    cursor: pointer;
  }
  /* The map's current decade: the map's cased outline (spec 7), drawn outside the cell. */
  .cell.current {
    outline: 2px solid var(--heading);
    outline-offset: 1px;
    box-shadow: 0 0 0 1px var(--bg);
  }
  .cell[aria-pressed='true'] {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .cell:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .decade {
    margin-top: 4px;
    font-size: var(--size-small);
    color: var(--muted);
    white-space: nowrap;
  }
  .caption {
    min-height: 2.9em;
    margin: 8px 0 0;
    font-size: var(--size-small);
  }
  .hint {
    color: var(--muted);
  }
</style>
