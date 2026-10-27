<script lang="ts">
  import type { Meta } from '../lib/types';

  let { meta }: { meta: Meta } = $props();
  const c = $derived(meta.citation);
</script>

<footer>
  <p>
    {c.authors.join(', ')} ({c.year}). {c.title}. <i>{c.journal}</i>.
    <a href={c.url}>doi:{c.doi}</a>
  </p>
  <p class="sources">
    Historical counts: Schroeder (2016), <a href="https://doi.org/10.13020/D6XW2H">doi:10.13020/D6XW2H</a>;
    2020 Census. Boundaries: 2020 counties, conterminous U.S.
  </p>
</footer>

<style>
  footer {
    padding: 8px var(--gutter);
    border-top: 1px solid var(--hairline);
    font-size: var(--size-small);
    color: var(--muted);
  }
  p {
    margin: 0;
  }
  .sources {
    margin-top: 2px;
  }
</style>
