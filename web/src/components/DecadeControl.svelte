<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Meta } from '../lib/types';
  import { LAST_DECADE } from '../lib/types';
  import { ui } from '../lib/state.svelte';

  let { meta }: { meta: Meta } = $props();

  const STEP_MS = 1500;
  let interval: ReturnType<typeof setInterval> | undefined;

  function stop(): void {
    ui.playing = false;
    clearInterval(interval);
  }

  function play(): void {
    // Playing from the last decade starts over from the first.
    if (ui.decade === LAST_DECADE) ui.decade = 0;
    ui.playing = true;
    interval = setInterval(() => {
      ui.decade += 1;
      if (ui.decade >= LAST_DECADE) stop();
    }, STEP_MS);
  }

  function choose(d: number): void {
    stop();
    ui.decade = d;
  }

  onDestroy(stop);
</script>

<div class="decades">
  <button
    type="button"
    class="play"
    aria-label={ui.playing ? 'Pause' : 'Play through the decades'}
    onclick={() => (ui.playing ? stop() : play())}
  >
    {#if ui.playing}
      <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>
    {:else}
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 L14 8 L4 14 Z" /></svg>
    {/if}
  </button>
  <div class="track">
    <input
      type="range"
      min="0"
      max={LAST_DECADE}
      step="1"
      value={ui.decade}
      aria-label="Decade"
      aria-valuetext={meta.decades[ui.decade].label}
      oninput={(e) => choose(Number(e.currentTarget.value))}
    />
    <div class="labels">
      {#each meta.decades as d, i (d.start)}
        <button type="button" tabindex="-1" class:current={i === ui.decade} onclick={() => choose(i)}>
          {d.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .decades {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 100%;
    padding: 0 var(--gutter);
  }
  .play {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1px solid var(--hairline);
    border-radius: 50%;
    background: var(--bg);
    cursor: pointer;
  }
  .play svg {
    width: 14px;
    height: 14px;
    fill: var(--heading);
  }
  .track {
    flex: 1;
    min-width: 0;
  }
  input[type='range'] {
    width: calc(100% - 100% / 7);
    margin: 0 calc(100% / 14);
    display: block;
    accent-color: var(--accent);
    height: 20px;
    cursor: pointer;
  }
  .labels {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
  .labels button {
    padding: 0;
    line-height: 1.3;
    border: 0;
    background: none;
    font-family: var(--font-mono);
    font-size: var(--size-small);
    color: var(--muted);
    cursor: pointer;
    text-align: center;
  }
  .labels button.current {
    color: var(--text);
    font-weight: 400;
    text-decoration: underline;
    text-decoration-color: var(--accent);
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }
</style>
