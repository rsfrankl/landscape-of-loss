<script lang="ts">
  import { MODES } from '../lib/types';
  import type { StartupData } from '../lib/data';
  import { openAbout, ui } from '../lib/state.svelte';
  import Search from './Search.svelte';
  import LocateButton from './LocateButton.svelte';

  let { data }: { data: StartupData } = $props();
</script>

<!-- Two rows (spec 6.1): the title, with search, location and "?" on the right where they fit;
     then the mode tabs; then the subtitle on its own full-width line. -->
<header>
  <h1>The Landscape of Loss: US County-Level Depopulation Pathways, 1950–2020</h1>
  <div class="tools">
    <Search counties={data.counties} />
    <LocateButton {data} />
    <button
      type="button"
      class="about"
      aria-label="How to read this, about and data notes"
      aria-haspopup="dialog"
      onclick={() => openAbout('read')}>?</button
    >
  </div>
  <fieldset class="modes">
    <legend class="visually-hidden">Map mode</legend>
    {#each MODES as m (m.id)}
      <label class:active={ui.mode === m.id}>
        <input type="radio" name="mode" value={m.id} bind:group={ui.mode} />
        {m.label}
      </label>
    {/each}
  </fieldset>
  <p class="subtitle">
    What is the geography of US population loss, and how does it change when we account for spatial context
    (what’s happening in neighboring counties) and each county’s history of population change?
  </p>
</header>

<style>
  /* Grid areas (spec 6.1): the title, with the tools on the right where they fit (≥ 1360 px);
     the tabs on their own row, joined by the tools where those don't fit beside the title (from
     1024 px, with a narrower search and an icon-only location button under 1150 px), or below
     the tabs under 1024 px; then the subtitle. */
  header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'title tools'
      'modes .'
      'sub sub';
    align-items: center;
    gap: 8px 16px;
    padding: 10px var(--gutter) 8px;
    border-bottom: 1px solid var(--hairline);
  }
  @media (max-width: 1359px) {
    header {
      grid-template-areas:
        'title title'
        'modes tools'
        'sub sub';
    }
  }
  @media (max-width: 1023px) {
    header {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'title' 'modes' 'tools' 'sub';
    }
  }
  h1 {
    grid-area: title;
    font-size: var(--size-title);
    font-weight: 800;
    line-height: 1.2;
  }
  .tools {
    grid-area: tools;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .modes {
    grid-area: modes;
    justify-self: start;
    display: flex;
    flex-wrap: nowrap;
    margin: 0;
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    overflow: hidden;
  }
  .subtitle {
    grid-area: sub;
    margin: 0;
    color: var(--muted);
  }
  .about {
    flex: none;
    width: 40px;
    height: 40px;
    border: 1px solid var(--hairline);
    border-radius: 50%;
    background: var(--bg);
    font-weight: 800;
    cursor: pointer;
  }
  .about:hover {
    border-color: var(--muted);
  }
  label {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 40px;
    padding: 0 14px;
    cursor: pointer;
    border-left: 1px solid var(--hairline);
    white-space: nowrap;
  }
  label:first-of-type {
    border-left: 0;
  }
  label.active {
    background: var(--accent);
    color: var(--bg);
  }
  /* The tabs stay on one line at 1024 px and wider (spec 6.2); narrower screens may wrap them. */
  @media (max-width: 1023px) {
    .modes {
      flex-wrap: wrap;
    }
  }
  input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }
  label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -4px;
    box-shadow: inset 0 0 0 4px var(--bg);
  }
</style>
