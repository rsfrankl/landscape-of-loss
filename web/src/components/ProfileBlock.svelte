<script lang="ts">
  // One block of the county profile (spec 6.5): a heading and its body. Collapsible blocks
  // put the heading in a disclosure button.
  import type { Snippet } from 'svelte';

  let {
    title,
    collapsible = false,
    open = $bindable(true),
    children,
  }: { title: string; collapsible?: boolean; open?: boolean; children: Snippet } = $props();

  const id = $props.id();
</script>

<section class="block" aria-labelledby="{id}-h">
  {#if collapsible}
    <h3 id="{id}-h">
      <button type="button" class="toggle" aria-expanded={open} aria-controls="{id}-b" onclick={() => (open = !open)}>
        <span class="chevron" class:open aria-hidden="true"></span>{title}
      </button>
    </h3>
  {:else}
    <h3 id="{id}-h">{title}</h3>
  {/if}
  {#if !collapsible || open}
    <div id="{id}-b" class="body">{@render children()}</div>
  {/if}
</section>

<style>
  .block {
    padding: 14px 0;
    border-top: 1px solid var(--hairline);
  }
  h3 {
    font-size: var(--size-heading);
    font-weight: 800;
    line-height: 1.3;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 40px;
    margin: -10px 0;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .chevron {
    flex: none;
    width: 7px;
    height: 7px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 150ms;
  }
  .chevron.open {
    transform: rotate(45deg);
  }
  .body {
    margin-top: 8px;
  }
</style>
