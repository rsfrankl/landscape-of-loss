<script lang="ts">
  // Profile block 3 (spec 6.5): seven cells, one per decade, coloured by the county-and-neighbors
  // state and marked with arrows (first the county, then its neighbors combined). Hover previews
  // a cell's explanation; focus or click pins it, so it is reachable without hover. A 2 × 2 key
  // follows. The only place the state colours appear in the panel; no A–D letters anywhere.
  import type { AdCode, County, Meta } from '../lib/types';
  import { MODES } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { isDark } from '../lib/colors';
  import { stripCaption, stripCaptionText } from '../lib/describe';
  import Arrows from './Arrows.svelte';

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
  const caption = $derived(shown >= 0 ? stripCaption(meta, county, shown) : null);
  const states = $derived(new Map(meta.ad.map((a) => [a.code, a])));
  const ink = (color: string) => (isDark(color) ? 'var(--bg)' : 'var(--text)');

  // Key rows: county lost / grew; columns: neighbors lost / grew.
  const keyRows: { label: string; up: boolean; codes: [AdCode, AdCode] }[] = [
    { label: 'County lost', up: false, codes: ['A', 'B'] },
    { label: 'County grew', up: true, codes: ['C', 'D'] },
  ];
</script>

{#snippet sentence(s: { text: string; num?: true }[])}
  {#each s as part, i (i)}{#if part.num}<span class="num">{part.text}</span>{:else}{part.text}{/if}{/each}
{/snippet}

<div class="strip" role="group" aria-label="The county and its neighbors, by decade">
  {#each meta.decades as d, i (d.label)}
    {@const state = states.get(county.seq[i] as AdCode)!}
    <div class="col">
      <button
        type="button"
        class="cell"
        class:current={i === current}
        aria-pressed={pinned === i}
        aria-label={stripCaptionText(meta, county, i)}
        style:background={state.color}
        style:color={ink(state.color)}
        onpointerenter={() => (hovered = i)}
        onpointerleave={() => (hovered = -1)}
        onfocus={() => (pinned = i)}
        onclick={() => (pinned = i)}><Arrows arrows={state.arrows} size={15} /></button
      >
      <!-- Two-digit years ("80–90") fit seven cells in the 380 px panel; the caption has the full label. -->
      <span class="decade" aria-hidden="true">{String(d.start).slice(2)}–{String(d.end).slice(2)}</span>
    </div>
  {/each}
</div>

{#if caption}
  <p class="caption">
    <span class="caption-head">
      {caption.decade} ·
      <span class="chip" style:background={caption.state.color} style:color={ink(caption.state.color)}
        ><Arrows arrows={caption.state.arrows} size={12} /></span
      >
      {caption.state.label}{caption.note}
    </span>
    <span class="caption-body">{@render sentence(caption.sentence)}</span>
  </p>
{/if}

<table class="key">
  <caption class="visually-hidden">Key: the county and its neighbors in a decade</caption>
  <thead>
    <tr>
      <td></td>
      <th scope="col">Neighbors lost <Arrows arrows="↓" size={11} /></th>
      <th scope="col">Neighbors grew <Arrows arrows="↑" size={11} /></th>
    </tr>
  </thead>
  <tbody>
    {#each keyRows as row (row.label)}
      <tr>
        <th scope="row">{row.label} <Arrows arrows={row.up ? '↑' : '↓'} size={11} /></th>
        {#each row.codes as code (code)}
          {@const state = states.get(code)!}
          <td
            class:shown={caption?.state.code === code}
            style:background={state.color}
            style:color={ink(state.color)}
          >
            <Arrows arrows={state.arrows} size={12} />
            {state.label}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
<p class="hint">First arrow: the county. Second: its neighbors combined. Point to a decade for details.</p>

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
    display: grid;
    place-items: center;
    width: 100%;
    height: 40px;
    border: 0;
    border-radius: 2px;
    cursor: pointer;
  }
  /* The map's current decade: the map's cased outline (spec 7), drawn outside the cell. */
  .cell.current {
    outline: 2px solid var(--heading);
    outline-offset: 1px;
    box-shadow: 0 0 0 1px var(--bg);
  }
  .cell[aria-pressed='true'] {
    box-shadow: inset 0 -3px 0 currentColor;
  }
  .cell.current[aria-pressed='true'] {
    box-shadow:
      0 0 0 1px var(--bg),
      inset 0 -3px 0 currentColor;
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
    margin: 10px 0 0;
    font-size: 13px;
  }
  .caption-head {
    display: block;
    font-weight: 800;
  }
  .chip {
    display: inline-grid;
    place-items: center;
    padding: 1px 3px;
    border-radius: 2px;
  }
  .key {
    width: 100%;
    margin-top: 12px;
    border-collapse: separate;
    border-spacing: 3px;
    font-size: var(--size-small);
    line-height: 1.25;
  }
  .key th {
    font-weight: 400;
    color: var(--muted);
    text-align: left;
    white-space: nowrap;
  }
  .key thead th {
    padding: 0 4px;
  }
  .key td {
    padding: 5px 6px;
    border-radius: 2px;
  }
  .key td.shown {
    outline: 2px solid var(--heading);
    outline-offset: 1px;
  }
  .hint {
    margin: 6px 0 0;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
