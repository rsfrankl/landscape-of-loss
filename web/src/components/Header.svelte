<script lang="ts">
  import { MODES } from '../lib/types';
  import type { StartupData } from '../lib/data';
  import { notice, ui } from '../lib/state.svelte';
  import Search from './Search.svelte';
  import LocateButton from './LocateButton.svelte';

  let { data }: { data: StartupData } = $props();

  // The notice clears after 8 s, on the next click or key press (Tab and modifiers aside, so
  // keyboard users can reach ×), or with ×.
  $effect(() => {
    if (!notice.text) return;
    const timer = setTimeout(() => (notice.text = ''), 8000);
    return () => clearTimeout(timer);
  });

  function dismissOnInteraction(event: Event): void {
    if (!notice.text) return;
    if (event instanceof KeyboardEvent && ['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(event.key)) return;
    notice.text = '';
  }
</script>

<svelte:window onpointerdowncapture={dismissOnInteraction} onkeydowncapture={dismissOnInteraction} />

<header>
  <h1>The Landscape of Loss: US County-Level Depopulation Pathways, 1950–2020</h1>
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
  </div>
  <div class="notice" role="status">
    {#if notice.text}
      <p>{notice.text}</p>
      <button type="button" class="dismiss" aria-label="Dismiss message" onclick={() => (notice.text = '')}>×</button>
    {/if}
  </div>
</header>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding: 12px var(--gutter);
    border-bottom: 1px solid var(--hairline);
  }
  h1 {
    flex: 1 1 100%;
    font-size: var(--size-title);
    font-weight: 800;
    line-height: 1.2;
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
  .notice {
    display: flex;
    flex: 1 1 100%;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  .notice:empty {
    display: none;
  }
  .notice p {
    margin: 0;
    font-size: var(--size-small);
  }
  .dismiss {
    flex: none;
    width: 40px;
    height: 40px;
    margin: -10px -10px -10px 0;
    border: 0;
    background: none;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .tools {
    display: flex;
    gap: 8px;
    margin-left: auto;
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
