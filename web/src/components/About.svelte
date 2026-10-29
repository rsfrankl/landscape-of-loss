<script lang="ts">
  // The explainer (spec 6.9): a modal with three tabs, How to read this, About and Data notes.
  // A native <dialog> opened with showModal() keeps focus inside, closes on Esc and returns focus
  // to the control that opened it. The tabs follow the ARIA tabs pattern (← → Home End).
  import type { Meta } from '../lib/types';
  import { about, type AboutTab } from '../lib/state.svelte';
  import { formatCount } from '../lib/format';
  import AdDiagram from './AdDiagram.svelte';
  import ArrowNote from './ArrowNote.svelte';

  let { meta }: { meta: Meta } = $props();

  let dialog: HTMLDialogElement;
  const tabs: { id: AboutTab; label: string }[] = [
    { id: 'read', label: 'How to read this' },
    { id: 'about', label: 'About' },
    { id: 'notes', label: 'Data notes' },
  ];

  $effect(() => {
    if (about.open && !dialog.open) dialog.showModal();
    else if (!about.open && dialog.open) dialog.close();
  });

  // Opened from a legend's "What do these mean?": scroll to that legend's section, once.
  $effect(() => {
    if (!about.open || !about.section) return;
    dialog.querySelector(`#about-sec-${about.section}`)?.scrollIntoView({ block: 'start' });
    about.section = null;
  });

  function onTabKey(event: KeyboardEvent): void {
    const i = tabs.findIndex((t) => t.id === about.tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    about.tab = tabs[(next + tabs.length) % tabs.length].id;
    dialog.querySelector<HTMLButtonElement>(`#about-tab-${about.tab}`)?.focus();
  }

  /** "https://doi.org/10.x/y" → "doi:10.x/y"; other links show without the scheme. */
  const linkText = (url: string) =>
    url.startsWith('https://doi.org/') ? `doi:${url.slice(16)}` : url.replace(/^https:\/\//, '');

  const c = $derived(meta.citation);
  const v = $derived(meta.validation);
  const n = $derived(meta.pathways.reduce((a, p) => a + p.n, 0));
  const groups = $derived([
    { title: 'Loss pathways', items: meta.pathways.filter((p) => p.group === 'loss') },
    { title: 'Growth pathways', items: meta.pathways.filter((p) => p.group === 'growth') },
  ]);
  const notes = $derived([
    { title: 'Counties', text: meta.notes.geography },
    { title: 'The 2010 base', text: meta.notes.base2010 },
    { title: 'Change classes and colors', text: meta.notes.changeClasses, id: 'classes' },
    { title: 'Pathway colors', text: meta.notes.pathwayColors },
    { title: 'Neighbors', text: meta.notes.neighbors },
    { title: 'Urban–rural classes', text: `Metro is RUCC 1–3, from the 2023 codes. ${meta.notes.rucc}` },
    { title: 'Components of change', text: meta.notes.components },
  ]);
</script>

<dialog bind:this={dialog} aria-labelledby="about-title" onclose={() => (about.open = false)}>
  <header>
    <h2 id="about-title">The Landscape of Loss</h2>
    <button type="button" class="close" aria-label="Close" onclick={() => (about.open = false)}>×</button>
  </header>
  <div class="tabs" role="tablist" aria-label="Explainer">
    {#each tabs as t (t.id)}
      <button
        type="button"
        role="tab"
        id="about-tab-{t.id}"
        aria-selected={about.tab === t.id}
        aria-controls="about-panel-{t.id}"
        tabindex={about.tab === t.id ? 0 : -1}
        onclick={() => (about.tab = t.id)}
        onkeydown={onTabKey}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <!-- The body renders only while the modal is open. -->
  <div class="body">
    {#if about.open && about.tab === 'read'}
      <div role="tabpanel" id="about-panel-read" aria-labelledby="about-tab-read" tabindex="0">
        <p class="prose">
          This map has three views. <b>Decadal population change</b> colors each county by percent population
          change in each census period. <b>Decadal population change in spatial context</b> shows, for the same
          decade, the connection between a county’s population change and that of its immediate neighbors
          (population-weighted average). <b>Population change trajectories</b> includes a longer period of
          population change, each decade from 1950 to 2020, and displays eight types of population change
          trajectory, reflecting different temporal and spatial experiences of population change.
        </p>
        <h3 id="about-sec-states">A county and its neighbors, in one decade</h3>
        <AdDiagram {meta} />
        <p class="hint"><ArrowNote /></p>
        <h3 id="about-sec-types">The eight types of population change</h3>
        {#each groups as g (g.title)}
          <h4>{g.title}</h4>
          <ul class="pathways">
            {#each g.items as p (p.id)}
              <li>
                <span class="dot" style:background={p.color}></span>
                <span><b>{p.name}</b> <span class="n num">{formatCount(p.n)} counties</span><br />{p.blurb}</span>
              </li>
            {/each}
          </ul>
        {/each}
        <p class="hint">Select any county on the map to see its own decade-by-decade sequence and pathway.</p>
      </div>
    {:else if about.open && about.tab === 'about'}
      <div role="tabpanel" id="about-panel-about" aria-labelledby="about-tab-about" tabindex="0">
        <p class="prose">
          This dashboard visualizes findings from the paper below for {formatCount(n)} conterminous U.S. counties.
          It adds no new analysis. Its one derived feature, “similar counties”, ranks counties by how closely
          their decade-by-decade population change matched; it is not part of the paper's analysis.
        </p>
        <h3>Cite</h3>
        <p class="prose citation">
          {c.authors.slice(0, -1).join(', ')}, and {c.authors[c.authors.length - 1]} ({c.year}). {c.title}.
          <i>{c.journal}</i>. <a href={c.url}>doi:{c.doi}</a>
        </p>
        <h3>Data sources and credits</h3>
        <dl class="sources">
          {#each meta.sources as s (s.label)}
            <dt>{s.label}</dt>
            <dd class="prose">
              {s.text}
              {#if s.url}<a href={s.url}>{linkText(s.url)}</a>{/if}
            </dd>
          {/each}
          <dt>Fonts</dt>
          <dd class="prose">Jost and IBM Plex Mono, SIL Open Font License.</dd>
        </dl>
        <p class="prose">
          Source code, data pipeline and validation report:
          <a href="https://github.com/rsfrankl/landscape-of-loss">github.com/rsfrankl/landscape-of-loss</a>.
        </p>
      </div>
    {:else if about.open}
      <div role="tabpanel" id="about-panel-notes" aria-labelledby="about-tab-notes" tabindex="0">
        {#each notes as note (note.title)}
          <h3 id={note.id ? `about-sec-${note.id}` : undefined}>{note.title}</h3>
          <p class="prose">{note.text}</p>
        {/each}
        <h3>County profile indicators</h3>
        <p class="prose">{meta.notes.profile}</p>
        <dl class="sources">
          {#each meta.indicators as ind (ind.key)}
            <dt>{ind.label}</dt>
            <dd class="prose">{ind.definition} Source: {ind.source}.</dd>
          {/each}
        </dl>
        <h3>Similar counties</h3>
        <p class="prose">
          The five counties whose decade-by-decade change most closely matches the selected county: the smallest
          Euclidean distance between their seven decadal log growth rates (the natural log of each decade's end
          population over its start population), unstandardized. Not part of
          the paper's analysis.
        </p>
        <h3>Validation</h3>
        <p class="prose">
          The pipeline rebuilds every county's decade-by-decade state from the population counts and checks it
          against the authors' sequence files: <span class="num">{formatCount(v.adCells - v.adMismatches)}</span> of
          <span class="num">{formatCount(v.adCells)}</span> county-decades match. The pathway profiles reproduce
          Table 1 of the paper within ±0.5 points in <span class="num">{v.table1Within}</span> of
          <span class="num">{v.table1Cells}</span> cells, leaving out the education row, which differs by design.
          The drivers of 2010–20 loss reproduce Table 2 in <span class="num">{v.table2Matching}</span> of
          <span class="num">{v.table2Cells}</span> cells. Full report:
          <a href="https://github.com/rsfrankl/landscape-of-loss/blob/main/docs/validation.md">docs/validation.md</a>.
        </p>
      </div>
    {/if}
  </div>
</dialog>

<style>
  dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: min(86vh, 900px);
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog::backdrop {
    background: rgb(26 18 16 / 0.35);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 12px 0 var(--gutter);
  }
  h2 {
    font-size: 18px;
    font-weight: 800;
  }
  .close {
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }
  .tabs {
    display: flex;
    gap: 4px;
    padding: 8px var(--gutter) 0;
    border-bottom: 1px solid var(--hairline);
  }
  [role='tab'] {
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    cursor: pointer;
  }
  [role='tab'][aria-selected='true'] {
    border-bottom-color: var(--accent);
    font-weight: 800;
  }
  .body {
    overflow-y: auto;
    padding: 4px var(--gutter) var(--gutter);
  }
  [role="tabpanel"]:focus-visible {
    outline-offset: -2px;
  }
  h3 {
    scroll-margin-top: 8px;
    margin: 18px 0 6px;
    font-size: var(--size-heading);
    font-weight: 800;
  }
  h4 {
    margin: 10px 0 4px;
    font-family: var(--font-body);
    font-size: var(--size-small);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  /* Long-form text (spec 7). */
  .prose {
    font-family: Palatino, 'Palatino Linotype', 'Book Antiqua', serif;
    font-size: 15px;
    line-height: 1.5;
  }
  p {
    margin: 10px 0 0;
  }
  .hint {
    font-size: var(--size-small);
    color: var(--muted);
  }
  .pathways {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .pathways li {
    display: grid;
    grid-template-columns: 14px 1fr;
    gap: 10px;
    padding: 6px 0;
  }
  .dot {
    width: 14px;
    height: 14px;
    margin-top: 3px;
    border-radius: 50%;
  }
  .n {
    margin-left: 6px;
    font-size: var(--size-small);
    color: var(--muted);
  }
  .sources {
    margin: 0;
  }
  dt {
    margin-top: 10px;
    font-weight: 800;
  }
  dd {
    margin: 2px 0 0;
  }
  a {
    color: var(--accent);
    overflow-wrap: anywhere;
  }
</style>
