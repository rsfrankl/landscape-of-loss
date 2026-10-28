<script lang="ts">
  import type { Meta } from '../lib/types';

  let { meta }: { meta: Meta } = $props();
  const c = $derived(meta.citation);
</script>

<!-- One line on desktop (spec 6.1); the full citation is in the About tab. -->
<footer>
  <p>
    Park, Seymour and Franklin ({c.year}), <i>{c.journal}</i>, <a href={c.url}>doi:{c.doi}</a>
    <span class="sep">·</span> Historical counts: Schroeder (2016), <a href="https://doi.org/10.13020/D6XW2H">doi:10.13020/D6XW2H</a>;
    2020 Census
  </p>
</footer>

<style>
  footer {
    padding: 6px var(--gutter);
    border-top: 1px solid var(--hairline);
    font-size: var(--size-small);
    color: var(--muted);
  }
  p {
    margin: 0;
  }
  .sep {
    margin: 0 4px;
  }
</style>
