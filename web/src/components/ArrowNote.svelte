<script lang="ts">
  // How to read the arrow pairs (spec 6.2 legend, 6.5 block 3). Arrows are SVG, not glyphs.
  import Arrows from './Arrows.svelte';
</script>

<Arrows arrows="↑" size={11} /> grew, <Arrows arrows="↓" size={11} /> lost. First arrow: the county’s population change that decade. Second: its neighbors’ change (population-weighted average).
