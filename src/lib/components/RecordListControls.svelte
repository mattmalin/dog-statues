<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { ListOption } from '$lib/record-lists';
  let {
    search = $bindable(),
    status = $bindable(),
    sort = $bindable(),
    searchLabel,
    statuses,
    sorts,
    onclear,
    children,
  }: {
    search: string;
    status: string;
    sort: string;
    searchLabel: string;
    statuses: ListOption[];
    sorts: ListOption[];
    onclear: () => void;
    children?: Snippet;
  } = $props();
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });
</script>

<section class="list-controls" aria-label="Filter and sort records">
  <fieldset disabled={!ready}>
    <div class="primary-filters">
      <label
        >{searchLabel}<input
          type="search"
          bind:value={search}
          placeholder="Search all fields"
        /></label
      >
      <label
        >Status<select bind:value={status}
          >{#each statuses as option}<option value={option.value}>{option.label}</option
            >{/each}</select
        ></label
      >
      <label
        >Sort by<select bind:value={sort}
          >{#each sorts as option}<option value={option.value}>{option.label}</option
            >{/each}</select
        ></label
      >
    </div>
    <div class="filter-actions">
      {#if children}<details>
          <summary>More filters</summary>
          <div class="field-grid">{@render children()}</div>
        </details>{/if}
      <button type="button" class="secondary" onclick={onclear}>Reset filters and sort</button>
    </div>
    <p class="hint">
      Search matches words across all saved fields, including notes, sources and image details.
    </p>
  </fieldset>
</section>

<style>
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  .list-controls {
    margin: 1.2rem 0;
  }
  .primary-filters {
    display: grid;
    grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }
  .filter-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    margin-top: 0.8rem;
  }
  details {
    grid-area: 1 / 1;
    min-width: 0;
  }
  .filter-actions > button {
    grid-area: 1 / 1;
    justify-self: end;
    align-self: start;
    max-width: 56%;
  }
  summary {
    width: 42%;
    min-height: 44px;
    padding: 0.6rem 0;
    cursor: pointer;
  }
  @media (max-width: 620px) {
    .primary-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .primary-filters > label:first-child {
      grid-column: 1 / -1;
    }
  }
</style>
