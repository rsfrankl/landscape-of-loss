<script lang="ts">
  import type { County, Meta } from '../lib/types';
  import { countiesCsv, csvName, downloadCsv } from '../lib/csv';

  let { meta, counties }: { meta: Meta; counties: County[] } = $props();
  const c = $derived(meta.citation);
</script>

<!-- One line from 1280 px (spec 6.1): download all, with the citation beside it; the full
     citation is in the About tab. -->
<footer>
  <p>
    <button type="button" class="link" onclick={() => downloadCsv(csvName('all'), countiesCsv(meta, counties))}>
      Download all counties (CSV)
    </button>
    <span class="sep">·</span> Please cite: Park, Seymour and Franklin ({c.year}), <i>Annals of the AAG</i>,
    <a href={c.url}>doi:{c.doi}</a>. Historical counts: Schroeder (2016),
    <a href="https://doi.org/10.13020/D6XW2H">doi:10.13020/D6XW2H</a>.
  </p>
</footer>

<style>
  footer {
    padding: 0 var(--gutter);
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
  .link {
    min-height: 40px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
