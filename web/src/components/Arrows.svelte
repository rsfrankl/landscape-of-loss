<script lang="ts">
  // Direction arrows for the A–D states ("↓↑": county lost, neighbors grew). Drawn as SVG so they
  // never fall back to a system font for the glyphs.
  let { arrows, size = 14 }: { arrows: string; size?: number } = $props();

  const ups = $derived([...arrows].map((ch) => ch === '↑'));
</script>

<span class="arrows" aria-hidden="true">
  {#each ups as up, i (i)}
    <svg viewBox="0 0 10 16" width={(size * 10) / 16} height={size}>
      <path d={up ? 'M5 14.5V2M1.5 5.5 5 2l3.5 3.5' : 'M5 1.5V14M1.5 10.5 5 14l3.5-3.5'} />
    </svg>
  {/each}
</span>

<style>
  .arrows {
    display: inline-flex;
    gap: 1px;
    vertical-align: -0.15em;
  }
  svg {
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
