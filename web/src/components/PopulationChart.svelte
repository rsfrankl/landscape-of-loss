<script lang="ts">
  // Profile block 6 (spec 6.5): the 8 population counts as a line on an axis from 0, with
  // the seven decadal % changes as signed bars underneath, coloured by change class.
  import { extent, format, line, max, scaleLinear } from 'd3';
  import type { County, Meta } from '../lib/types';
  import { formatCount, formatPct } from '../lib/format';

  let { meta, county }: { meta: Meta; county: County } = $props();

  let width = $state(340);
  const m = { left: 40, right: 10 };
  const lineH = 120;
  const gap = 26;
  const barH = 70;
  const height = lineH + gap + barH + 24;

  const years = $derived(meta.years);
  const x = $derived(
    scaleLinear()
      .domain([years[0], years[years.length - 1]])
      .range([m.left, width - m.right]),
  );
  const y = $derived(
    scaleLinear()
      .domain([0, max(county.pop)!])
      .nice(4)
      .range([lineH, 6]),
  );
  const people = format('~s');
  const path = $derived(
    line<number>()
      .x((_, i) => x(years[i]))
      .y((p) => y(p))(county.pop) ?? '',
  );

  // Bars sit between the two years of their decade.
  const [lo, hi] = $derived(extent([0, ...county.pct]) as [number, number]);
  const yb = $derived(
    scaleLinear()
      .domain([lo, hi])
      .nice(3)
      .range([lineH + gap + barH, lineH + gap]),
  );
  const barW = $derived(((width - m.left - m.right) / meta.decades.length) * 0.6);
  const colors = $derived(new Map(meta.change.map((c) => [c.id, c.color])));
  const pctTick = (v: number) => (v === 0 ? '0%' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`);
</script>

<div class="chart" bind:clientWidth={width}>
  <svg {width} {height} aria-hidden="true">
    <!-- Population line -->
    {#each y.ticks(4) as t (t)}
      <line class="grid" x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
      <text class="tick" x={m.left - 6} y={y(t)} dy="0.32em" text-anchor="end">{people(t)}</text>
    {/each}
    <path class="pop" d={path} />
    {#each county.pop as p, i (i)}
      <circle class="pop-dot" cx={x(years[i])} cy={y(p)} r="2.5" />
    {/each}

    <!-- Decadal % change bars -->
    {#each yb.domain() as t (t)}
      {#if t !== 0}
        <text class="tick" x={m.left - 6} y={yb(t)} dy="0.32em" text-anchor="end">{pctTick(t)}</text>
      {/if}
    {/each}
    <text class="tick" x={m.left - 6} y={yb(0)} dy="0.32em" text-anchor="end">0%</text>
    {#each meta.decades as d, i (d.label)}
      {@const v = county.pct[i]}
      <rect
        x={x((d.start + d.end) / 2) - barW / 2}
        y={Math.min(yb(0), yb(v))}
        width={barW}
        height={Math.abs(yb(v) - yb(0))}
        fill={colors.get(county.cls[i])}
      />
    {/each}
    <line class="zero" x1={m.left} x2={width - m.right} y1={yb(0)} y2={yb(0)} />
    {#each years as yr (yr)}
      <text class="tick" x={x(yr)} y={height - 4} text-anchor="middle">{yr}</text>
    {/each}
  </svg>

  <table class="visually-hidden">
    <caption>Population and decadal change, {county.name}</caption>
    <thead><tr><th scope="col">Year</th><th scope="col">Population</th><th scope="col">Change since previous count</th></tr></thead>
    <tbody>
      {#each years as yr, i (yr)}
        <tr>
          <th scope="row">{yr}</th>
          <td>{formatCount(county.pop[i])}</td>
          <td>{i === 0 ? '' : formatPct(county.pct[i - 1], county.cls[i - 1])}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="axis-note">Line: people. Bars: % change in each decade.</p>
</div>

<style>
  .chart {
    position: relative;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--hairline);
  }
  .zero {
    stroke: var(--muted);
  }
  .tick {
    font-family: var(--font-mono);
    font-size: var(--size-small);
    fill: var(--muted);
  }
  .pop {
    fill: none;
    stroke: var(--heading);
    stroke-width: 1.75;
  }
  .pop-dot {
    fill: var(--heading);
  }
  .axis-note {
    margin: 4px 0 0;
    font-size: var(--size-small);
    color: var(--muted);
  }
</style>
