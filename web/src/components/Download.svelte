<script lang="ts">
  // A CSV download link with the citation beside it (spec 6.9). The file itself is plain CSV.
  import type { County, Meta } from '../lib/types';
  import { countiesCsv, csvName, downloadCsv } from '../lib/csv';

  let {
    meta,
    counties,
    label,
    suffix,
  }: { meta: Meta; counties: () => County[]; label: string; suffix: string } = $props();

  const c = $derived(meta.citation);
  const authors = $derived(`${c.authors.slice(0, -1).join(', ')}, and ${c.authors[c.authors.length - 1]}`);
</script>

<span class="download">
  <button type="button" class="link" onclick={() => downloadCsv(csvName(suffix), countiesCsv(meta, counties()))}>
    {label}
  </button>
  <span class="cite">
    Please cite: {authors} ({c.year}), <i>{c.journal}</i>, <a href={c.url}>doi:{c.doi}</a>.
    Historical counts: Schroeder (2016), DRUM, <a href="https://doi.org/10.13020/D6XW2H">doi:10.13020/D6XW2H</a>.
    Read geoid as text to keep leading zeros.
  </span>
</span>

<style>
  .download {
    display: block;
  }
  .link {
    min-height: 40px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }
  .cite {
    display: block;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
