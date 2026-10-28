<script lang="ts">
  // First-visit intro card (spec 6.9), over the map's lower left. Dismissal is remembered in
  // localStorage when the browser allows it; the page works the same without it.
  import { openAbout } from '../lib/state.svelte';

  const KEY = 'landscape-of-loss:intro-dismissed';

  function wasDismissed(): boolean {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  }

  // Not shown on a shared link to a county, where the profile is the point.
  let visible = $state(!wasDismissed() && !new URLSearchParams(location.search).has('county'));

  function dismiss(): void {
    visible = false;
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Storage blocked: the card simply returns on the next visit.
    }
  }

  function read(): void {
    dismiss();
    openAbout('read');
  }
</script>

{#if visible}
  <section class="intro" aria-label="Introduction">
    <p>
      Click any county to see its 70-year history. Switch the tabs to compare decades, neighbors and long-run
      trajectories.
    </p>
    <div class="actions">
      <button type="button" class="link" onclick={read}>How to read this</button>
    </div>
    <button type="button" class="close" aria-label="Dismiss introduction" onclick={dismiss}>×</button>
  </section>
{/if}

<style>
  .intro {
    position: absolute;
    left: var(--gutter);
    bottom: var(--gutter);
    z-index: 1;
    max-width: 320px;
    padding: 12px 40px 6px 14px;
    background: var(--bg);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgb(26 18 16 / 0.12);
  }
  p {
    margin: 0;
  }
  .link {
    min-height: 40px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
  .close {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
</style>
