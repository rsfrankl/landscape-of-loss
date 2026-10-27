<script lang="ts">
  // "Use my location" (spec 6.8): finds the county under the browser's position and selects it.
  // The position is used once in the browser and never stored or sent anywhere.
  import type { StartupData } from '../lib/data';
  import { selectCounty } from '../lib/state.svelte';
  import { countyAt, currentPosition } from '../lib/locate';

  let { data }: { data: StartupData } = $props();

  let busy = $state(false);
  let message = $state('');

  async function locate(): Promise<void> {
    busy = true;
    message = '';
    try {
      const { coords } = await currentPosition();
      const i = countyAt(data.topo, data.counties, coords.longitude, coords.latitude);
      if (i >= 0) selectCounty(i, true);
      else message = 'Your location is outside the counties in this study.';
    } catch (e) {
      const denied = (e as GeolocationPositionError).code === 1;
      message = denied
        ? 'Location access was denied, so your county could not be found.'
        : 'Your location could not be found.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="locate">
  <button type="button" onclick={locate} disabled={busy} aria-describedby="locate-status">
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1.75" class="dot" />
      <path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" />
    </svg>
    {busy ? 'Finding…' : 'My location'}
  </button>
  <p id="locate-status" class="status" role="status">{message}</p>
</div>

<style>
  .locate {
    position: relative;
  }
  button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    background: var(--bg);
    cursor: pointer;
    white-space: nowrap;
  }
  button:disabled {
    cursor: progress;
    color: var(--muted);
  }
  svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
  }
  .dot {
    fill: currentColor;
    stroke: none;
  }
  .status {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    right: 0;
    width: max-content;
    max-width: 280px;
    margin: 0;
    font-size: var(--size-small);
    color: var(--text);
    background: var(--bg);
  }
  .status:empty {
    display: none;
  }
</style>
