<script lang="ts">
  // How to read the four county-and-neighbors states (spec 6.9, after the paper's Figs. 2 and 4):
  // in each quadrant a county (centre, in its state colour) and its neighbors around it, with an
  // arrow for each one's change that decade. Laid out like the profile key: rows by the county's
  // change, columns by its neighbors' combined change.
  import type { AdCode, Meta } from '../lib/types';
  import { isDark } from '../lib/colors';
  import Arrows from './Arrows.svelte';

  let { meta }: { meta: Meta } = $props();

  const states = $derived(new Map(meta.ad.map((a) => [a.code, a])));
  const rows: { label: string; arrow: string; codes: [AdCode, AdCode] }[] = [
    { label: 'County lost', arrow: '↓', codes: ['A', 'B'] },
    { label: 'County grew', arrow: '↑', codes: ['C', 'D'] },
  ];
  const cols = [
    { label: 'Neighbors lost', arrow: '↓' },
    { label: 'Neighbors grew', arrow: '↑' },
  ];
  const sentence: Record<AdCode, string> = {
    A: 'The county lost population, and so did its immediate neighbors, on average.',
    B: 'The county lost population, but its immediate neighbors grew, on average.',
    C: 'The county grew, but its immediate neighbors lost population, on average.',
    D: 'The county grew, and so did its immediate neighbors, on average.',
  };

  // Arrow paths in a 10 × 16 box (as in Arrows.svelte).
  const UP = 'M5 14.5V2M1.5 5.5 5 2l3.5 3.5';
  const DOWN = 'M5 1.5V14M1.5 10.5 5 14l3.5-3.5';
  const CELL = 28;
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ r, c, centre: r === 1 && c === 1 })));
</script>

<table class="diagram">
  <thead>
    <tr>
      <td></td>
      {#each cols as col (col.label)}
        <th scope="col">{col.label} <Arrows arrows={col.arrow} size={12} /></th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.label)}
      <tr>
        <th scope="row">{row.label} <Arrows arrows={row.arrow} size={12} /></th>
        {#each row.codes as code (code)}
          {@const s = states.get(code)!}
          {@const countyUp = s.arrows[0] === '↑'}
          {@const neighborsUp = s.arrows[1] === '↑'}
          <td>
            <svg viewBox="0 0 {CELL * 3} {CELL * 3}" width={CELL * 3} height={CELL * 3} aria-hidden="true">
              {#each cells as cell (cell.r * 3 + cell.c)}
                <rect
                  class="cell"
                  class:centre={cell.centre}
                  x={cell.c * CELL + 1}
                  y={cell.r * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  style:fill={cell.centre ? s.color : null}
                />
                <path
                  class="arrow"
                  d={(cell.centre ? countyUp : neighborsUp) ? UP : DOWN}
                  transform="translate({cell.c * CELL + CELL / 2 - 5}, {cell.r * CELL + CELL / 2 - 8})"
                  stroke={cell.centre && isDark(s.color) ? 'var(--bg)' : 'var(--text)'}
                />
              {/each}
            </svg>
            <p class="name"><Arrows arrows={s.arrows} size={13} /> {s.label}</p>
            <p class="says">{sentence[code]}</p>
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .diagram {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th {
    font-weight: 400;
    font-size: var(--size-small);
    color: var(--muted);
    text-align: left;
    vertical-align: top;
    padding: 4px 8px 4px 0;
  }
  thead th {
    padding-bottom: 8px;
  }
  td {
    vertical-align: top;
    padding: 0 12px 16px 0;
  }
  thead td,
  tbody th {
    width: 110px;
  }
  svg {
    display: block;
  }
  .cell {
    fill: var(--hairline);
  }
  .cell.centre {
    stroke: var(--heading);
    stroke-width: 2;
  }
  .arrow {
    fill: none;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .name {
    margin: 6px 0 0;
    font-weight: 800;
  }
  .says {
    margin: 2px 0 0;
    font-size: var(--size-small);
  }
</style>
