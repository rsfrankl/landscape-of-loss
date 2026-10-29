<script lang="ts">
  // The county profile (spec 6.5), grouped by time frame: the 70-year pathway, the
  // decade-by-decade strip, single decades, the population chart, similar counties, then the
  // detail blocks.
  import { tick } from 'svelte';
  import type { County, Meta } from '../lib/types';
  import { LAST_DECADE, MODES, showsBreakdown } from '../lib/types';
  import { goBack, profileOpen, selectCounty, setSimilarOpen, ui } from '../lib/state.svelte';
  import { countyTitle, decadeSentence, populationLine, recentSentence, type Segment } from '../lib/describe';
  import ProfileBlock from './ProfileBlock.svelte';
  import SequenceStrip from './SequenceStrip.svelte';
  import PopulationChart from './PopulationChart.svelte';
  import AcsProfile from './AcsProfile.svelte';
  import ComponentsChart from './ComponentsChart.svelte';
  import SimilarCounties from './SimilarCounties.svelte';
  import Download from './Download.svelte';
  import { loadProfileData, type ProfileData } from '../lib/data';

  let { meta, counties, county }: { meta: Meta; counties: County[]; county: County } = $props();

  // acs.json and components.json load on the first profile open (spec 5).
  let extra = $state.raw<ProfileData | null>(null);
  let failed = $state(false);
  loadProfileData().then(
    (d) => (extra = d),
    () => (failed = true),
  );

  const pathway = $derived(meta.pathways[county.pathway - 1]);
  const first = $derived(meta.years[0]);
  const last = $derived(meta.years[meta.years.length - 1]);
  const recent = $derived(meta.decades[LAST_DECADE].label);

  // Blocks 4 and 5 merge when the map shows 2010–20 or the mode has no decade.
  const usesDecade = $derived(MODES.find((m) => m.id === ui.mode)!.usesDecade);
  const merged = $derived(!usesDecade || ui.decade === LAST_DECADE);

  // After following a similar county, go back to it; else back to the breakdown, if the profile
  // was opened from it (a pathway pinned or pointed at; spec 6.6) and it still shows. "Back to the
  // map legend" follows on every profile.
  const backTo = $derived(ui.trail.length ? counties[ui.trail[ui.trail.length - 1]] : null);

  // The trajectory link opens block 7 (which frames the map), scrolls to it and focuses its heading.
  let similarBlock: HTMLDivElement;
  const similarToggle = () => similarBlock.querySelector<HTMLButtonElement>('h3 button');
  async function seeSimilar(): Promise<void> {
    setSimilarOpen(true);
    await tick();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    similarBlock.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    similarToggle()?.focus({ preventScroll: true });
  }

  // "Hide similar counties" collapses the block and returns focus to its heading.
  function hideSimilar(): void {
    setSimilarOpen(false);
    similarToggle()?.focus();
  }
</script>

{#snippet sentence(s: Segment[])}
  <p class="sentence">
    {#each s as part, i (i)}{#if part.num}<span class="num">{part.text}</span>{:else}{part.text}{/if}{/each}
  </p>
{/snippet}

<section class="profile" aria-labelledby="profile-title">
  <div class="backs">
    {#if backTo}
      <button type="button" class="back" onclick={goBack}>← Back to {backTo.name}</button>
    {:else if ui.fromBreakdown && showsBreakdown(ui.mode, ui.decade)}
      <button type="button" class="back" onclick={() => selectCounty(-1)}>← Back to breakdown</button>
    {/if}
    <button type="button" class="back" onclick={() => selectCounty(-1)}>← Back to the map legend</button>
  </div>
  <header class="head">
    <div>
      <h2 id="profile-title">{countyTitle(county)}</h2>
      <p class="pop">{populationLine(meta, county)}</p>
      {#if county.rucc_note}<p class="note">{county.rucc_note}</p>{/if}
    </div>
    <button type="button" class="close" aria-label="Close county profile" onclick={() => selectCounty(-1)}>×</button>
  </header>

  <ProfileBlock title="{last - first}-year trajectory, {first}–{last}">
    <p class="pathway"><span class="dot" style:background={pathway.color}></span>{pathway.name}</p>
    <p class="blurb">{pathway.blurb}</p>
    <button type="button" class="link" onclick={seeSimilar}>See counties with similar population change trajectories ↓</button>
  </ProfileBlock>

  <ProfileBlock title="Each decade: the county and its neighbors">
    <SequenceStrip {meta} {county} />
  </ProfileBlock>

  {#if merged}
    <ProfileBlock title="Most recent decade, {recent}{usesDecade ? ' (decade on the map)' : ''}">
      {@render sentence(decadeSentence(county, LAST_DECADE))}
    </ProfileBlock>
  {:else}
    <ProfileBlock title="{meta.decades[ui.decade].label} (decade on the map)">
      {@render sentence(decadeSentence(county, ui.decade))}
    </ProfileBlock>
    <ProfileBlock title="Most recent decade, {recent}">
      {@render sentence(recentSentence(county))}
    </ProfileBlock>
  {/if}

  <ProfileBlock title="Population, {first}–{last}">
    <PopulationChart {meta} {county} />
  </ProfileBlock>

  <div class="anchor" bind:this={similarBlock}>
    <ProfileBlock title="See similar counties" collapsible bind:open={() => profileOpen.similar, setSimilarOpen}>
      <SimilarCounties {meta} {counties} {county} onhide={hideSimilar} />
    </ProfileBlock>
  </div>

  <ProfileBlock title="Who lives here (ACS 2016–20)" collapsible bind:open={profileOpen.acs}>
    {#if extra}
      <AcsProfile acs={extra.acs} {county} {pathway} />
    {:else}
      <p class="status">{failed ? 'The profile data could not be loaded.' : 'Loading…'}</p>
    {/if}
  </ProfileBlock>

  <ProfileBlock title="Demographic sources of change, {recent}" collapsible bind:open={profileOpen.components}>
    {#if extra}
      <ComponentsChart comp={extra.components[county.geoid]} />
    {:else}
      <p class="status">{failed ? 'The profile data could not be loaded.' : 'Loading…'}</p>
    {/if}
  </ProfileBlock>

  <div class="foot">
    <Download {meta} counties={() => [county]} label="Download this county (CSV)" suffix={county.geoid} />
  </div>
</section>

<style>
  .profile {
    padding: var(--gutter);
  }
  .backs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin: -8px 0 4px;
  }
  .back {
    min-height: 40px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    padding-bottom: 12px;
  }
  h2 {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.25;
  }
  .pop {
    margin: 4px 0 0;
  }
  .note {
    margin: 4px 0 0;
    font-size: var(--size-small);
    color: var(--muted);
  }
  .close {
    flex: none;
    width: 40px;
    height: 40px;
    margin: -8px -8px 0 0;
    border: 0;
    background: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }
  .pathway {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-weight: 800;
  }
  .dot {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .blurb {
    margin: 4px 0 0;
  }
  .link {
    min-height: 40px;
    margin: 2px 0 -10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-align: left;
    text-decoration: underline;
    cursor: pointer;
  }
  .anchor {
    scroll-margin-top: 8px;
  }
  .sentence {
    margin: 0;
  }
  .status {
    margin: 0;
    color: var(--muted);
  }
  .foot {
    margin-top: 12px;
  }
</style>
