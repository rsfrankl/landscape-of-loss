<script lang="ts">
  // Status messages (e.g. location results; spec 6.8) in a strip across the top of the map, under
  // the header controls and never over the panel. It overlays the map, so it never resizes it.
  import { notice } from '../lib/state.svelte';

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

<div class="notice" role="status">
  {#if notice.text}
    <p>{notice.text}</p>
    <button type="button" class="dismiss" aria-label="Dismiss message" onclick={() => (notice.text = '')}>×</button>
  {/if}
</div>

<style>
  .notice {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 0 0 0 var(--gutter);
    background: var(--bg);
    border-bottom: 1px solid var(--hairline);
  }
  .notice:empty {
    display: none;
  }
  p {
    margin: 0;
    font-size: var(--size-small);
  }
  .dismiss {
    flex: none;
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
</style>
