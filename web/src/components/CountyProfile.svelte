<script lang="ts">
  // The county profile (spec 6.5), grouped by time frame: the 70-year pathway, the
  // decade-by-decade strip, single decades, then the detail blocks.
  import type { County, Meta } from '../lib/types';
  import { LAST_DECADE, MODES, showsBreakdown } from '../lib/types';
  import { goBack, profileOpen, selectCounty, ui } from '../lib/state.svelte';
  import { countyTitle, decadeSentence, populationLine, recentSentence, type Segment } from '../lib/describe';
  import ProfileBlock from './ProfileBlock.svelte';
  import SequenceStrip from './SequenceStrip.svelte';
  import PopulationChart from './PopulationChart.svelte';
  import AcsProfile from './AcsProfile.svelte';
  import ComponentsChart from './ComponentsChart.svelte';
  import SimilarCounties from './SimilarCounties.svelte';
  import { loadProfileData, type ProfileData } from '../lib/data';
  import { driverShares } from '../lib/profile';

  let { meta, counties, county }: { meta: Meta; counties: County[]; county: County } = $props();

  // acs.json and components.json load on the first profile open (spec 5).
  let extra = $state.raw<ProfileData | null>(null);
  let failed = $state(false);
  loadProfileData().then(
    (d) => (extra = d),
    () => (failed = true),
  );
  const shares = $derived(extra ? driverShares(extra.components) : null);

  const pathway = $derived(meta.pathways[county.pathway - 1]);
  const first = $derived(meta.years[0]);
  const last = $derived(meta.years[meta.years.length - 1]);
  const recent = $derived(meta.decades[LAST_DECADE].label);

  // Blocks 4 and 5 merge when the map shows 2010–20 or the mode has no decade.
  const usesDecade = $derived(MODES.find((m) => m.id === ui.mode)!.usesDecade);
  const merged = $derived(!usesDecade || ui.decade === LAST_DECADE);

  // After following a similar county, go back to it; else back to the breakdown if it shows.
  const backTo = $derived(ui.trail.length ? counties[ui.trail[ui.trail.length - 1]] : null);
</script>

{#snippet sentence(s: Segment[])}
  <p class="sentence">
    {#each s as part, i (i)}{#if part.num}<span class="num">{part.text}</span>{:else}{part.text}{/if}{/each}
  </p>
{/snippet}

<section class="profile" aria-labelledby="profile-title">
  {#if backTo}
    <button type="button" class="back" onclick={goBack}>← Back to {backTo.name}</button>
  {:else if showsBreakdown(ui.mode, ui.decade)}
    <button type="button" class="back" onclick={() => selectCounty(-1)}>← Back to breakdown</button>
  {/if}
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

  <ProfileBlock title="Who lives here (ACS 2016–20)" collapsible bind:open={profileOpen.acs}>
    {#if extra}
      <AcsProfile acs={extra.acs} {county} {pathway} />
    {:else}
      <p class="status">{failed ? 'The profile data could not be loaded.' : 'Loading…'}</p>
    {/if}
  </ProfileBlock>

  <ProfileBlock title="Why it changed, {recent}" collapsible bind:open={profileOpen.components}>
    {#if extra && shares}
      <ComponentsChart comp={extra.components[county.geoid]} {shares} />
    {:else}
      <p class="status">{failed ? 'The profile data could not be loaded.' : 'Loading…'}</p>
    {/if}
  </ProfileBlock>

  <ProfileBlock title="Similar counties" collapsible bind:open={profileOpen.similar}>
    <SimilarCounties {meta} {counties} {county} />
  </ProfileBlock>
</section>

<style>
  .profile {
    padding: var(--gutter);
  }
  .back {
    min-height: 40px;
    margin: -8px 0 4px;
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
  .sentence {
    margin: 0;
  }
  .status {
    margin: 0;
    color: var(--muted);
  }
</style>
