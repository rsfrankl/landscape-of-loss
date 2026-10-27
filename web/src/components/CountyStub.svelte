<script lang="ts">
  // Minimal selected-county panel for milestone 2: everything the tooltip shows, reachable by
  // click (CLAUDE.md design rule). Milestone 3 replaces it with the full profile (spec 6.5).
  import type { County, Meta } from '../lib/types';
  import { LAST_DECADE } from '../lib/types';
  import { ui } from '../lib/state.svelte';
  import { contextLine, countyTitle } from '../lib/describe';
  import { formatCount, formatPct } from '../lib/format';

  let { meta, county }: { meta: Meta; county: County } = $props();

  const pathway = $derived(meta.pathways[county.pathway - 1]);
  const decade = $derived(ui.mode === 'context' || ui.mode === 'change' ? ui.decade : LAST_DECADE);
  const last = LAST_DECADE;
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
  <dl>
    <dt>{meta.decades[last].label} change</dt>
    <dd class="num">{formatPct(county.pct[last], county.cls[last])}</dd>
    <dt>{meta.decades[decade].label} change</dt>
    <dd class="num">{formatPct(county.pct[decade], county.cls[decade])}</dd>
    <dt>Spatial context</dt>
    <dd class="num">{contextLine(meta, county, decade)}</dd>
    <dt>Population, {meta.years[meta.years.length - 1]}</dt>
    <dd class="num">{formatCount(county.pop[county.pop.length - 1])}</dd>
  </dl>
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
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 14px;
    margin: 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-size: 13px;
  }
  .note {
    margin-top: 18px;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
