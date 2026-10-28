<script lang="ts">
  // Profile block 9 (spec 6.5): natural change, domestic and international migration, 2010–20,
  // as bars about zero. No net or total bar: the estimates' total can contradict the census
  // change shown in blocks 4–5. Loss counties add the Table 2 driver sentence.
  import { scaleLinear } from 'd3';
  import type { Components, Driver } from '../lib/types';
  import { formatCount } from '../lib/format';
  import { driverSentence } from '../lib/profile';

  let { comp, shares }: { comp: Components; shares: Map<Driver, number> } = $props();

  let width = $state(200);
  const bars = $derived([
    { label: 'Natural change', v: comp.natural },
    { label: 'Domestic migration', v: comp.domestic },
    { label: 'International migration', v: comp.international },
  ]);
  const extentAbs = $derived(Math.max(1, ...bars.map((b) => Math.abs(b.v))));
  const x = $derived(scaleLinear().domain([-extentAbs, extentAbs]).range([0, width]));
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatCount(Math.abs(v))}`;
</script>

<p class="sub">People, April 2010 to July 2020 (Census Bureau Vintage 2020 estimates)</p>
<ul class="bars">
  {#each bars as b (b.label)}
    <li>
      <span class="label">{b.label}</span>
      <div class="plot" bind:clientWidth={width}>
        <svg {width} height="16" aria-hidden="true">
          <rect
            x={Math.min(x(0), x(b.v))}
            y="2"
            width={Math.abs(x(b.v) - x(0))}
            height="12"
            class="bar"
          />
          <line class="zero" x1={x(0)} x2={x(0)} y1="0" y2="16" />
        </svg>
      </div>
      <span class="num value">{signed(b.v)}</span>
    </li>
  {/each}
</ul>
{#if comp.driver}
  <p class="driver">{driverSentence(comp.driver, shares)}</p>
{/if}

<style>
  .sub {
    margin: 0 0 8px;
    font-size: var(--size-small);
    color: var(--muted);
  }
  .bars {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .bars li {
    display: grid;
    grid-template-columns: 9.5em minmax(0, 1fr) 4.5em;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 13px;
  }
  svg {
    display: block;
  }
  /* One neutral colour for all three bars; the direction shows the sign. */
  .bar {
    fill: var(--muted);
  }
  .zero {
    stroke: var(--heading);
  }
  .value {
    text-align: right;
  }
  .driver {
    margin: 10px 0 0;
  }
</style>
