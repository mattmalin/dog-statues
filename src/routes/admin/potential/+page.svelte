<script lang="ts">
  import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
  import PotentialMap from '$lib/components/PotentialMap.svelte';
  import RecordThumbnail from '$lib/components/RecordThumbnail.svelte';
  import { potentialStatuses } from '$lib/potential';
  import { page } from '$app/state';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  let search = $state('');
  let london = $state(false);
  let status = $state('active');
  const filtered = $derived(
    data.rows.filter(
      (row) =>
        (!london || row.city.toLowerCase() === 'london') &&
        (status === 'all' ||
          (status === 'active' ? row.status !== 'archived' : row.status === status)) &&
        [row.name, row.city, row.country, row.location, row.notes]
          .join(' ')
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ),
  );
</script>

<svelte:head><title>Potential future dog statues</title></svelte:head>
<main id="main" class="shell main">
  <WorkspaceNav />
  <div class="heading-row">
    <h1>Potential future dog statues</h1>
    <a class="button" href="/admin/potential/new">Add potential statue</a>
  </div>
  <p>Private research and visit planning. Save places here before creating a statue post.</p>
  <details>
    <summary>Researched suggestions</summary>
    <p>
      Add {data.suggestionCount} researched leads, including your 47 London CSV records. Seven matches
      with the initial suggestions have been merged. Original map links, coordinates and research are
      preserved alongside sourced story notes. Check exact pins and current access before visiting. Existing
      entries keep your edits when you import again. Historical entries may be archived; choose All to
      see them.
    </p>
    <form method="POST" action="?/suggestions">
      <button class="secondary">Add researched suggestions</button>
    </form>
    {#if data.researchedImageCount}
      <p>
        {data.researchedImageCount} sourced reference images are available. Add missing links to existing
        entries without replacing your images or selected thumbnails. These images are for private research;
        source and permission notes are saved with each one.
      </p>
      <form method="POST" action="?/images">
        <button class="secondary">Add researched images</button>
      </form>
    {/if}
  </details>
  {#if page.url.searchParams.has('added')}
    <p role="status">{page.url.searchParams.get('added')} suggestions added.</p>
  {/if}
  {#if page.url.searchParams.has('images_added')}<p role="status">
      {page.url.searchParams.get('images_added')} image links added across {page.url.searchParams.get(
        'records_updated',
      )} entries.
    </p>{/if}
  <div class="field-grid">
    <label>Search potential statues<input type="search" bind:value={search} /></label>
    <label
      >Status<select bind:value={status}>
        <option value="active">Active</option><option value="all">All</option>
        {#each Object.entries(potentialStatuses) as [value, label]}<option {value}>{label}</option
          >{/each}
      </select></label
    >
    <label class="check"><input type="checkbox" bind:checked={london} /> London only</label>
  </div>
  <p class="hint">{filtered.length} potential statues</p>
  <PotentialMap rows={filtered} />
  <ul class="records">
    {#each filtered as row (row.id)}
      <li>
        <a href={'/admin/potential/' + row.id}>
          <div class="record-identity">
            <RecordThumbnail src={row.images[0]?.image_url} />
            <div>
              <strong>{row.name}</strong><small
                >{[row.city, row.country].filter(Boolean).join(', ')}</small
              >
              <small>{row.pin_checked ? 'Pin checked' : 'Pin to check'}</small>
            </div>
          </div>
          <span class="badge">{potentialStatuses[row.status]}</span><span aria-hidden="true">›</span
          >
        </a>
      </li>
    {/each}
  </ul>
  {#if !filtered.length}<p>No matching potential statues.</p>{/if}
</main>
