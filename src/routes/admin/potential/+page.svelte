<script lang="ts">
  import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
  import PotentialMap from '$lib/components/PotentialMap.svelte';
  import RecordThumbnail from '$lib/components/RecordThumbnail.svelte';
  import RecordListControls from '$lib/components/RecordListControls.svelte';
  import {
    matchesSearch,
    places,
    samePlace,
    searchText,
    sortOptions,
    sortRecords,
  } from '$lib/record-lists';
  import { potentialStatuses } from '$lib/potential';
  import { page } from '$app/state';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  let search = $state('');
  let london = $state(false);
  let status = $state('active');
  let sort = $state('london_first');
  let country = $state('');
  let city = $state('');
  let images = $state('all');
  let map = $state('all');
  let sources = $state('all');
  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'all', label: 'All' },
    ...Object.entries(potentialStatuses).map(([value, label]) => ({ value, label })),
  ];
  const sorts = [{ value: 'london_first', label: 'London first' }, ...sortOptions];
  const indexed = $derived(data.rows.map((row) => ({ ...row, search_text: searchText(row) })));
  const countries = $derived(places(data.rows.map((row) => row.country)));
  const cities = $derived(
    places(
      data.rows.filter((row) => !country || samePlace(row.country, country)).map((row) => row.city),
    ),
  );
  function clear() {
    search = '';
    london = false;
    status = 'active';
    sort = 'london_first';
    country = '';
    city = '';
    images = 'all';
    map = 'all';
    sources = 'all';
  }
  const filtered = $derived(
    sortRecords(
      indexed.filter(
        (row) =>
          (!london || row.city.toLowerCase() === 'london') &&
          (status === 'all' ||
            (status === 'active' ? row.status !== 'archived' : row.status === status)) &&
          matchesSearch(row.search_text, search) &&
          (!country || samePlace(row.country, country)) &&
          (!city || samePlace(row.city, city)) &&
          (images === 'all' ||
            (images === 'with' ? row.images.length > 0 : row.images.length === 0)) &&
          (sources === 'all' || (sources === 'with' ? Boolean(row.source_url) : !row.source_url)) &&
          (map === 'all' ||
            (map === 'saved'
              ? row.latitude !== null && row.longitude !== null
              : map === 'approximate'
                ? Boolean(row.map_location?.approximate)
                : map === 'checked'
                  ? row.pin_checked
                  : map === 'unchecked'
                    ? !row.pin_checked
                    : !row.map_location)),
      ),
      sort,
      (row) => row.name,
      (row) => row.images.length,
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
  <RecordListControls
    bind:search
    bind:status
    bind:sort
    searchLabel="Search potential statues"
    {statuses}
    {sorts}
    onclear={clear}
  >
    <label
      >Country<select bind:value={country} onchange={() => (city = '')}
        ><option value="">All countries</option>{#each countries as place}<option value={place}
            >{place}</option
          >{/each}</select
      ></label
    >
    <label
      >City<select bind:value={city}
        ><option value="">All cities</option>{#each cities as place}<option value={place}
            >{place}</option
          >{/each}</select
      ></label
    >
    <label
      >Images<select bind:value={images}
        ><option value="all">All</option><option value="with">With images</option><option
          value="without">Without images</option
        ></select
      ></label
    >
    <label
      >Map location<select bind:value={map}
        ><option value="all">All</option><option value="saved">Saved coordinates</option><option
          value="approximate">Approximate location</option
        ><option value="checked">Pin checked</option><option value="unchecked">Pin to check</option
        ><option value="missing">Not plotted</option></select
      ></label
    >
    <label
      >Research sources<select bind:value={sources}
        ><option value="all">All</option><option value="with">With source link</option><option
          value="without">Without source link</option
        ></select
      ></label
    >
  </RecordListControls>
  <label class="check"><input type="checkbox" bind:checked={london} /> London only</label>
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
