<script lang="ts">
  // "Use my location" (spec 6.8): finds the county under the browser's position and selects it.
  // The position is used once in the browser and never stored or sent anywhere.
  import type { StartupData } from '../lib/data';
  import { notice, selectCounty } from '../lib/state.svelte';
  import { countyAt, currentPosition } from '../lib/locate';

  let { data }: { data: StartupData } = $props();

  let busy = $state(false);

  async function locate(): Promise<void> {
    busy = true;
    notice.text = '';
    try {
      const { coords } = await currentPosition();
      const i = countyAt(data.topo, data.counties, coords.longitude, coords.latitude);
      if (i >= 0) selectCounty(i, true);
      else notice.text = 'Your location is outside the counties in this study.';
    } catch (e) {
      const denied = (e as GeolocationPositionError).code === 1;
      notice.text = denied
        ? 'Location access was denied, so your county could not be found. Check that location access is ' +
          'allowed for this site in your browser and in your computer’s privacy settings.'
        : 'Your location could not be found.';
    } finally {
      busy = false;
    }
  }
</script>

<button type="button" onclick={locate} disabled={busy}>
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="5" />
    <circle cx="8" cy="8" r="1.75" class="dot" />
    <path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" />
  </svg>
  <span class="label">{busy ? 'Finding…' : 'My location'}</span>
</button>

<style>
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
  /* Icon only where the tools share the tabs' row (spec 6.1); the label stays for screen readers. */
  @media (max-width: 1149px) {
    button {
      justify-content: center;
      width: 40px;
      padding: 0;
    }
    .label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
</style>
