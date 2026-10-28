<script lang="ts">
  import { loadStartup } from './lib/data';
  import { MODES, showsBreakdown } from './lib/types';
  import { selectCounty, ui } from './lib/state.svelte';
  import { countyTitle } from './lib/describe';
  import { startUrlSync } from './lib/urlSync.svelte';
  import Header from './components/Header.svelte';
  import MapView from './components/Map.svelte';
  import DecadeControl from './components/DecadeControl.svelte';
  import Legend from './components/Legend.svelte';
  import CountyProfile from './components/CountyProfile.svelte';
  import Footer from './components/Footer.svelte';

  // The URL sets the view before the map first paints (spec 6.9).
  const loading = loadStartup().then((data) => {
    startUrlSync(data.meta, data.counties);
    return data;
  });
  const usesDecade = $derived(MODES.find((m) => m.id === ui.mode)!.usesDecade);

  // The breakdown's pin goes with the breakdown: another decade or tab clears it (spec 6.6).
  $effect(() => {
    if (showsBreakdown(ui.mode, ui.decade)) return;
    ui.pinned = null;
    ui.highlight = null;
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (ui.selected >= 0) selectCounty(-1);
    else if (ui.pinned !== null) ui.pinned = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#await loading}
  <div class="status">Loading the map…</div>
{:then data}
  {@const selected = ui.selected >= 0 ? data.counties[ui.selected] : null}
  <div class="app" class:with-decades={usesDecade}>
    <div class="header"><Header {data} /></div>
    <div class="map"><MapView {data} /></div>
    {#if usesDecade}
      <div class="decade"><DecadeControl meta={data.meta} /></div>
    {/if}
    <aside class="panel">
      {#if selected}
        <CountyProfile meta={data.meta} county={selected} />
      {:else}
        <Legend meta={data.meta} counties={data.counties} />
      {/if}
    </aside>
    <div class="footer"><Footer meta={data.meta} /></div>
  </div>
  <div class="visually-hidden" aria-live="polite">
    {#if selected}
      Selected {countyTitle(selected)}: {data.meta.pathways[selected.pathway - 1].name} pathway.
    {/if}
  </div>
{:catch error}
  <div class="status" role="alert">The map data could not be loaded. {error.message}</div>
{/await}

<style>
  .app {
    display: grid;
    height: 100vh;
    grid-template-columns: minmax(0, 1fr) var(--panel-width);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      'header header'
      'map panel'
      'decade panel'
      'footer footer';
  }
  .header {
    grid-area: header;
  }
  .map {
    grid-area: map;
    min-height: 0;
  }
  .decade {
    grid-area: decade;
  }
  .panel {
    grid-area: panel;
    min-height: 0;
    overflow-y: auto;
    border-left: 1px solid var(--hairline);
  }
  .footer {
    grid-area: footer;
  }
  .status {
    padding: 40px var(--gutter);
    color: var(--muted);
  }

  /* Below 768 px the panel stacks under the map (spec 8.2; polish comes later). */
  @media (max-width: 767px) {
    .app {
      height: auto;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto 60vh auto auto auto;
      grid-template-areas: 'header' 'map' 'decade' 'panel' 'footer';
    }
    .panel {
      border-left: 0;
      border-top: 1px solid var(--hairline);
    }
  }
</style>
