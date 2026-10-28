<script lang="ts">
  // Profile block 8 (spec 6.5): one row per indicator, each on its own axis from 0 so small
  // shares stay readable. County dot with MOE whisker, pathway tick, U.S. tick.
  import type { Acs, County, Pathway } from '../lib/types';
  import { axisEnd } from '../lib/profile';

  let { acs, county, pathway }: { acs: Acs; county: County; pathway: Pathway } = $props();

  let width = $state(300);
  const pad = 6;

  const rows = $derived(
    acs.indicators.map((ind) => {
      const [value, moe] = acs.county[county.geoid][ind.key];
      const path = acs.pathway[String(pathway.id)][ind.key];
      const us = acs.us[ind.key];
      const end = axisEnd(Math.max(value + (moe ?? 0), path, us));
      return { ind, value, moe, path, us, end };
    }),
  );
  const x = (v: number, end: number) => pad + (Math.min(v, end) / end) * (width - 2 * pad);
  const pct = (v: number) => `${v.toFixed(1)}%`;

  // The readout line under the key follows the hovered row, else the focused one.
  let hovered = $state(-1);
  let focused = $state(-1);
  const active = $derived(hovered >= 0 ? hovered : focused);
</script>

<ul class="key" aria-hidden="true">
  <li><span class="k-dot"></span>County, with margin of error</li>
  <li><span class="k-path" style:background={pathway.color}></span>{pathway.name}</li>
  <li><span class="k-us"></span>Conterminous U.S.</li>
</ul>
<p class="readout" aria-hidden="true">
  {#if active >= 0}
    {@const r = rows[active]}
    County <span class="num">{pct(r.value)}</span> · Pathway <span class="num">{pct(r.path)}</span> · Conterminous U.S. <span class="num">{pct(r.us)}</span>
  {:else}
    <span class="hint">Point to or select a row to compare its values.</span>
  {/if}
</p>

<ul class="rows">
  {#each rows as r, i (r.ind.key)}
    <!-- Focusable so the readout is reachable without hover (click also focuses). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <li
      tabindex="0"
      class:active={i === active}
      onpointerenter={() => (hovered = i)}
      onpointerleave={() => (hovered = -1)}
      onfocus={() => (focused = i)}
      onblur={() => (focused = -1)}
    >
      <span class="label">{r.ind.label}</span>
      <div class="track" aria-hidden="true">
        <span class="num tick">0</span>
        <div class="plot" bind:clientWidth={width}>
          <svg {width} height="18">
            <line class="axis" x1={pad} x2={width - pad} y1="9" y2="9" />
            {#if r.moe !== null}
              <line class="moe" x1={x(Math.max(0, r.value - r.moe), r.end)} x2={x(r.value + r.moe, r.end)} y1="9" y2="9" />
            {/if}
            <line class="us" x1={x(r.us, r.end)} x2={x(r.us, r.end)} y1="2" y2="16" />
            <rect class="path" x={x(r.path, r.end) - 2} y="2" width="4" height="14" fill={pathway.color} />
            <circle class="county" cx={x(r.value, r.end)} cy="9" r="4" />
          </svg>
        </div>
        <span class="num tick">{r.end}%</span>
      </div>
      <span class="num value" aria-hidden="true">{pct(r.value)}</span>
      <span class="visually-hidden">
        County {pct(r.value)}{r.moe !== null ? ` (margin of error ±${r.moe.toFixed(1)})` : ''}; {pathway.name}
        {pct(r.path)}; conterminous U.S. {pct(r.us)}; axis 0 to {r.end}%.
      </span>
    </li>
  {/each}
</ul>
<p class="note">
  Race and ethnicity from the 2020 Census; other indicators from the ACS 2016–20. Education is bachelor's degree or
  higher, which differs from Table 1 of the paper (bachelor's degree only). Each row has its own scale.
</p>

<style>
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
    font-size: var(--size-small);
    color: var(--muted);
  }
  .key li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .k-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--heading);
  }
  .k-path {
    width: 4px;
    height: 12px;
    outline: 0.75px solid var(--heading);
  }
  .k-us {
    width: 2px;
    height: 12px;
    background: var(--muted);
  }
  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Label across the top; the track (with its 0 and maximum) and the county value below. */
  .rows li {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 4.2em;
    grid-template-areas:
      'label label'
      'track value';
    column-gap: 12px;
    align-items: center;
    padding: 5px 2px;
    border-radius: 2px;
  }
  .rows li:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
  .label {
    grid-area: label;
    font-size: 13px;
    line-height: 1.3;
  }
  .value {
    grid-area: value;
    color: var(--heading);
    text-align: right;
  }
  .track {
    grid-area: track;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .tick {
    flex: none;
    font-size: var(--size-small);
    line-height: 1;
    color: var(--muted);
  }
  /* Two lines reserved under the key, so the readout can wrap (enlarged text, WCAG 1.4.4)
     without shifting the rows in the usual case. */
  .readout {
    min-height: 3em;
    margin: -4px 0 6px;
    font-size: var(--size-small);
    line-height: 1.5;
  }
  .readout .hint {
    color: var(--muted);
  }
  .rows li.active {
    background: var(--hairline);
  }
  .plot {
    flex: 1;
    min-width: 0;
  }
  svg {
    display: block;
  }
  .axis {
    stroke: var(--hairline);
    stroke-width: 1;
  }
  .moe {
    stroke: var(--heading);
    stroke-width: 1.5;
  }
  .us {
    stroke: var(--muted);
    stroke-width: 2;
  }
  .path {
    stroke: var(--heading);
    stroke-width: 0.75;
  }
  .county {
    fill: var(--heading);
    stroke: var(--bg);
    stroke-width: 1;
  }
  .note {
    margin: 8px 0 0;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
