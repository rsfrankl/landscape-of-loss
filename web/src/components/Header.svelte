<script lang="ts">
  import { MODES } from '../lib/types';
  import type { StartupData } from '../lib/data';
  import { openAbout, ui } from '../lib/state.svelte';
  import Search from './Search.svelte';
  import LocateButton from './LocateButton.svelte';

  let { data }: { data: StartupData } = $props();
</script>

<!-- Spec 6.1: the title, the subtitle directly under it, then the mode tabs with search, location
     and "How to read this map" on the right where they fit (otherwise on a row of their own). -->
<header>
  <h1>The Landscape of Loss: US County-Level Depopulation Pathways, 1950–2020</h1>
  <p class="subtitle">
    What is the geography of US population loss, and how does it change when we account for spatial context
    (what’s happening in neighboring counties) and each county’s history of population change?
  </p>
  <div class="controls">
    <fieldset class="modes">
      <legend class="visually-hidden">Map mode</legend>
      {#each MODES as m (m.id)}
        <label class:active={ui.mode === m.id}>
          <input type="radio" name="mode" value={m.id} bind:group={ui.mode} />
          {m.label}
        </label>
      {/each}
    </fieldset>
    <div class="tools">
      <Search counties={data.counties} />
      <LocateButton {data} />
      <button type="button" class="about" aria-haspopup="dialog" onclick={() => openAbout('read')}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="7.75" />
          <path d="M6.6 7a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.7-.9 1.3v.6" />
          <circle class="dot" cx="9" cy="13.4" r="1" />
        </svg>
        <span class="label">How to read this map</span>
      </button>
    </div>
  </div>
</header>

<style>
  header {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px var(--gutter) 8px;
    border-bottom: 1px solid var(--hairline);
  }
  h1 {
    font-size: var(--size-title);
    font-weight: 800;
    line-height: 1.2;
  }
  .subtitle {
    margin: 0;
    color: var(--muted);
  }
  /* The tabs, then the tools pushed to the right; the tools wrap to a row of their own when the
     two don't fit side by side. */
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin-top: 2px;
  }
  .tools {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .modes {
    display: flex;
    flex-wrap: nowrap;
    margin: 0;
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    overflow: hidden;
  }
  .about {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px 0 11px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    background: var(--bg);
    font-weight: 800;
    color: var(--accent);
    cursor: pointer;
  }
  .about:hover {
    border-color: var(--muted);
  }
  .about svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  .about .dot {
    fill: currentColor;
    stroke: none;
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
  /* Phones (spec 8.2): a smaller title and subtitle, the three tabs as equal columns whose labels
     wrap, then search (taking the row's free width), location and an icon-only explainer button,
     whose label stays for screen readers. */
  @media (max-width: 767px) {
    header {
      gap: 6px;
      padding: 8px 12px 6px;
    }
    h1 {
      font-size: 17px;
    }
    .subtitle {
      font-size: var(--size-small);
      line-height: 1.35;
    }
    .controls {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }
    .modes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }
    label {
      justify-content: center;
      padding: 2px 6px;
      font-size: var(--size-small);
      line-height: 1.2;
      text-align: center;
      white-space: normal;
    }
    .tools {
      margin-left: 0;
    }
    .tools > :global(:first-child) {
      flex: 1;
    }
    .about {
      justify-content: center;
      width: 40px;
      padding: 0;
    }
    .about .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
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
