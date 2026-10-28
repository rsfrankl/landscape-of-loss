<script lang="ts">
  import { loadStartup } from './lib/data';
  import { MODES, showsBreakdown } from './lib/types';
  import { about, selectCounty, ui } from './lib/state.svelte';
  import { countyTitle } from './lib/describe';
  import { startUrlSync } from './lib/urlSync.svelte';
  import Header from './components/Header.svelte';
  import MapView from './components/Map.svelte';
  import DecadeControl from './components/DecadeControl.svelte';
  import Legend from './components/Legend.svelte';
  import CountyProfile from './components/CountyProfile.svelte';
  import Footer from './components/Footer.svelte';
  import Notice from './components/Notice.svelte';
  import About from './components/About.svelte';
  import IntroCard from './components/IntroCard.svelte';

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
    ui.fromBreakdown = false;
  });

  // Below 768 px the panel is a bottom sheet (spec 8.2): it peeks over the bottom of the screen
  // and a handle expands it. The footer then moves to the end of the sheet.
  const phone = matchMedia('(max-width: 767px)');
  let mobile = $state(phone.matches);
  phone.addEventListener('change', () => (mobile = phone.matches));
  let sheetOpen = $state(false);

  function onKeydown(event: KeyboardEvent): void {
    // Esc in the explainer closes only the explainer.
    if (event.key !== 'Escape' || about.open) return;
    if (ui.selected >= 0) selectCounty(-1);
    else if (ui.pinned !== null) ui.pinned = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#await loading}
  <div class="status">Loading the map…</div>
{:then data}
  {@const selected = ui.selected >= 0 ? data.counties[ui.selected] : null}
  <div class="app">
    <div class="header"><Header {data} /></div>
    <main class="map">
      <MapView {data} />
      <Notice />
      <IntroCard />
    </main>
    <!-- The decade row is reserved in every mode, so switching modes never resizes the map. -->
    <div class="decade">
      {#if usesDecade}
        <DecadeControl meta={data.meta} />
      {:else}
        <p class="whole-period">Pathways cover the whole period, {data.meta.years[0]}–{data.meta.years[data.meta.years.length - 1]}</p>
      {/if}
    </div>
    <aside class="panel" class:open={sheetOpen}>
      {#if mobile}
        <button type="button" class="handle" aria-expanded={sheetOpen} onclick={() => (sheetOpen = !sheetOpen)}>
          <span class="grip" aria-hidden="true"></span>
          {sheetOpen ? 'Show less' : 'Show more'}
        </button>
      {/if}
      {#if selected}
        <CountyProfile meta={data.meta} counties={data.counties} county={selected} />
      {:else}
        <Legend meta={data.meta} counties={data.counties} />
      {/if}
      {#if mobile}<Footer meta={data.meta} counties={data.counties} />{/if}
    </aside>
    {#if !mobile}
      <div class="footer"><Footer meta={data.meta} counties={data.counties} /></div>
    {/if}
  </div>
  <About meta={data.meta} />
  <div class="visually-hidden" aria-live="polite">
    {#if selected}
      Selected {countyTitle(selected)}: {data.meta.pathways[selected.pathway - 1].name} pathway.
    {:else if ui.pinned !== null}
      {data.meta.pathways[ui.pinned - 1].name} pathway highlighted on the map.
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
    grid-template-rows: auto minmax(0, 1fr) var(--decade-height) auto;
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
    position: relative;
    min-height: 0;
  }
  .decade {
    grid-area: decade;
    min-height: 0;
    border-top: 1px solid var(--hairline);
  }
  .whole-period {
    display: flex;
    align-items: center;
    height: 100%;
    margin: 0;
    padding: 0 var(--gutter);
    color: var(--muted);
  }
  .panel {
    grid-area: panel;
    /* Contains visually hidden (absolute) elements, so they never extend the page. */
    position: relative;
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

  /* Below 768 px (spec 8.2): map and decade row above a bottom sheet. The sheet's peek height is
     reserved as a grid row, so the map is never covered until the sheet is expanded. */
  @media (max-width: 767px) {
    .app {
      height: 100dvh;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) var(--decade-height) var(--sheet-peek);
      grid-template-areas: 'header' 'map' 'decade' 'panel';
    }
    .panel {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 3;
      height: var(--sheet-peek);
      background: var(--bg);
      border-left: 0;
      border-top: 1px solid var(--hairline);
      border-radius: 10px 10px 0 0;
      box-shadow: 0 -2px 10px rgb(26 18 16 / 0.12);
      transition: height 200ms ease;
    }
    .panel.open {
      height: 85dvh;
    }
    .handle {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 100%;
      min-height: 40px;
      padding: 6px 0 4px;
      border: 0;
      background: var(--bg);
      font-size: var(--size-small);
      color: var(--muted);
      cursor: pointer;
    }
    .grip {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: var(--hairline);
    }
  }
  @media (max-width: 767px) and (prefers-reduced-motion: reduce) {
    .panel {
      transition: none;
    }
  }
</style>
