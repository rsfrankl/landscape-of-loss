<script lang="ts">
  // The 2010–20 breakdown (spec 6.6): that decade's losing and gaining counties, each split
  // into its four 70-year pathways. Pointing at a pathway fades the other counties on the map;
  // clicking pins it. The rows under each bar are buttons, so the keyboard reaches all of it.
  import type { County, Group, Meta } from '../lib/types';
  import { LAST_DECADE } from '../lib/types';
  import { togglePinned, ui } from '../lib/state.svelte';
  import { breakdownCounts } from '../lib/counts';
  import { formatCount } from '../lib/format';

  let { meta, counties }: { meta: Meta; counties: County[] } = $props();

  const decade = $derived(meta.decades[LAST_DECADE].label);
  const counts = $derived(breakdownCounts(counties));
  const bars = $derived(
    (['loss', 'growth'] as Group[]).map((group) => {
      const items = meta.pathways
        .filter((p) => p.group === group)
        .map((p) => ({ pathway: p, n: counts[group].get(p.id) ?? 0 }));
      const total = items.reduce((a, b) => a + b.n, 0);
      let x = 0;
      const segments = items.map((it) => {
        const s = { ...it, x0: x / total, x1: (x + it.n) / total };
        x += it.n;
        return s;
      });
      const label = group === 'loss' ? `Lost population ${decade}` : 'Gained';
      return { group, label, total, segments };
    }),
  );
  const active = $derived(ui.highlight ?? ui.pinned);

  let width = $state(340);
  const barH = 22;

  function point(id: number | null): void {
    ui.highlight = id;
  }
</script>

<section class="breakdown" aria-labelledby="breakdown-title">
  <h3 id="breakdown-title">The same {decade} loss can follow very different 70-year paths.</h3>
  <p class="hint">Point to a pathway to highlight its counties; select it to pin.</p>

  {#each bars as bar (bar.group)}
    <div class="bar">
      <p class="label">{bar.label} (<span class="num">{formatCount(bar.total)}</span>)</p>
      <div bind:clientWidth={width}>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the rows below are the keyboard route) -->
        <svg {width} height={barH} aria-hidden="true">
          {#each bar.segments as s (s.pathway.id)}
            <rect
              x={s.x0 * width}
              width={Math.max(0, (s.x1 - s.x0) * width - 1)}
              height={barH}
              fill={s.pathway.color}
              class:faded={active !== null && active !== s.pathway.id}
              onpointerenter={() => point(s.pathway.id)}
              onpointerleave={() => point(null)}
              onclick={() => togglePinned(s.pathway.id)}
            />
          {/each}
        </svg>
      </div>
      <ul>
        {#each bar.segments as s (s.pathway.id)}
          <li>
            <button
              type="button"
              class="item"
              aria-pressed={ui.pinned === s.pathway.id}
              class:off={active !== null && active !== s.pathway.id}
              onclick={() => togglePinned(s.pathway.id)}
              onpointerenter={() => point(s.pathway.id)}
              onpointerleave={() => point(null)}
              onfocus={() => point(s.pathway.id)}
              onblur={() => point(null)}
            >
              <span class="swatch" style:background={s.pathway.color}></span>
              <span class="name">{s.pathway.name}</span>
              <span class="num count">{formatCount(s.n)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</section>

<style>
  .breakdown {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--hairline);
  }
  h3 {
    font-size: var(--size-heading);
    font-weight: 800;
    line-height: 1.3;
  }
  .hint {
    margin: 4px 0 0;
    font-size: var(--size-small);
    color: var(--muted);
  }
  .bar {
    margin-top: 14px;
  }
  .label {
    margin: 0 0 6px;
  }
  svg {
    display: block;
  }
  rect {
    cursor: pointer;
    transition: opacity 120ms;
  }
  rect.faded {
    opacity: 0.2;
  }
  ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }
  .item {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .item:hover {
    border-color: var(--hairline);
  }
  .item[aria-pressed='true'] {
    border-color: var(--accent);
  }
  .item.off {
    opacity: 0.45;
  }
  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }
  .count {
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
