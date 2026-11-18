<script lang="ts">
  import WorkspaceNav from './WorkspaceNav.svelte';
  import RecordThumbnail from './RecordThumbnail.svelte';
  import RecordListControls from './RecordListControls.svelte';
  import {
    matchesSearch,
    places,
    samePlace,
    sortOptions,
    sortRecords,
    type DraftListRow,
  } from '$lib/record-lists';
  let {
    rows,
    newId,
    view,
  }: {
    rows: DraftListRow[];
    newId: string;
    view: 'workspace' | 'inbox' | 'all';
  } = $props();
  let search = $state('');
  let status = $state('all');
  let sort = $state('updated_desc');
  let editorial = $state('all');
  let visit = $state('all');
  let country = $state('');
  let city = $state('');
  let photos = $state('all');
  let map = $state('all');
  let sources = $state('all');
  let instagram = $state('all');
  const countries = $derived(places(rows.map((row) => row.country)));
  const cities = $derived(
    places(
      rows.filter((row) => !country || samePlace(row.country, country)).map((row) => row.city),
    ),
  );
  const statuses = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'unpublished', label: 'Unpublished' },
    { value: 'hidden', label: 'Hidden' },
  ];
  function clear() {
    search = '';
    status = 'all';
    sort = 'updated_desc';
    editorial = 'all';
    visit = 'all';
    country = '';
    city = '';
    photos = 'all';
    map = 'all';
    sources = 'all';
    instagram = 'all';
  }
  const labels = { workspace: 'Your workspace', inbox: 'Draft inbox', all: 'All statues' };
  const filtered = $derived(
    sortRecords(
      rows.filter(
        (row) =>
          matchesSearch(row.search_text, search) &&
          (status === 'all' || row.web_status === status) &&
          (editorial === 'all' || row.editorial_status === editorial) &&
          (visit === 'all' || row.visit_status === visit) &&
          (!country || samePlace(row.country, country)) &&
          (!city || samePlace(row.city, city)) &&
          (photos === 'all' ||
            (photos === 'with'
              ? row.photo_count > 0
              : photos === 'without'
                ? row.photo_count === 0
                : row.missing_alt)) &&
          (map === 'all' ||
            (map === 'coordinates'
              ? row.latitude !== null && row.longitude !== null
              : map === 'link'
                ? Boolean(row.google_maps_url)
                : row.latitude === null && !row.google_maps_url)) &&
          (sources === 'all' ||
            (sources === 'with' ? row.sources.length > 0 : row.sources.length === 0)) &&
          (instagram === 'all' ||
            (instagram === 'with' ? Boolean(row.instagram_draft) : !row.instagram_draft)),
      ),
      sort,
      (row) => row.title.trim() || 'Untitled statue',
      (row) => row.photo_count,
    ),
  );
</script>

<svelte:head><title>{labels[view]} · Dog Statue Atlas</title></svelte:head>
<main id="main" class="shell main">
  <WorkspaceNav />
  <div class="heading-row">
    <div>
      <p class="eyebrow">Field notebook</p>
      <h1>{labels[view]}</h1>
      <p class="lede">
        {view === 'workspace'
          ? 'Capture a sighting while it’s fresh. Fill in the details later.'
          : view === 'inbox'
            ? 'Pick up a draft where you left off.'
            : 'Find and edit any statue in your Atlas.'}
      </p>
    </div>
    <form action="/admin/new" method="POST" class="add-form">
      <input type="hidden" name="id" value={newId} />
      <button class="add-button"><span aria-hidden="true">＋</span> Add statue</button>
    </form>
  </div>
  {#if view !== 'workspace'}
    <RecordListControls
      bind:search
      bind:status
      bind:sort
      searchLabel="Find a statue"
      {statuses}
      sorts={sortOptions}
      onclear={clear}
    >
      <label
        >Editorial status<select bind:value={editorial}
          ><option value="all">All</option><option value="inbox">Inbox</option><option value="draft"
            >Draft</option
          ><option value="ready">Ready</option></select
        ></label
      >
      <label
        >Visit status<select bind:value={visit}
          ><option value="all">All</option><option value="unvisited">Unvisited</option><option
            value="visited">Visited</option
          ></select
        ></label
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
        >Photos<select bind:value={photos}
          ><option value="all">All</option><option value="with">With photos</option><option
            value="without">Without photos</option
          ><option value="missing-alt">Approved photos missing alt text</option></select
        ></label
      >
      <label
        >Map details<select bind:value={map}
          ><option value="all">All</option><option value="coordinates">Saved coordinates</option
          ><option value="link">Google Maps link saved</option><option value="missing"
            >No coordinates or map link</option
          ></select
        ></label
      >
      <label
        >Research sources<select bind:value={sources}
          ><option value="all">All</option><option value="with">With sources</option><option
            value="without">Without sources</option
          ></select
        ></label
      >
      <label
        >Instagram preparation<select bind:value={instagram}
          ><option value="all">All</option><option value="with">Saved draft</option><option
            value="without">No saved draft</option
          ></select
        ></label
      >
    </RecordListControls>
  {/if}
  <div class="list-heading">
    <h2>
      {view === 'workspace'
        ? 'Recent drafts'
        : view === 'inbox'
          ? 'In the inbox'
          : 'Statue records'}
    </h2>
    <span class="count">{filtered.length}</span>
  </div>
  {#if filtered.length}
    <ul class="records">
      {#each filtered as row (row.id)}
        <li>
          <a href={'/admin/statues/' + row.id}>
            <div class="record-identity">
              <RecordThumbnail
                src={row.thumbnail_media_id
                  ? '/api/admin/statues/' +
                    row.id +
                    '/photos/' +
                    row.thumbnail_media_id +
                    '?size=thumb'
                  : null}
              />
              <div>
                <strong>{row.title.trim() || 'Untitled statue'}</strong><small
                  >{[row.city, row.country].filter(Boolean).join(', ') || 'Location to add'}</small
                >
              </div>
            </div>
            <span class:live={row.web_status === 'published'} class="badge"
              >{row.web_status === 'published'
                ? 'Published'
                : row.web_status === 'hidden'
                  ? 'Hidden'
                  : row.editorial_status === 'ready'
                    ? 'Ready'
                    : 'Draft'}</span
            >
            <span aria-hidden="true">›</span>
          </a>
          {#if row.instagram_draft}
            <a class="instagram-draft-link" href={'/admin/statues/' + row.id + '#instagram'}
              >Resume Instagram draft</a
            >
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <strong>{rows.length ? 'No matches' : 'Nothing here yet'}</strong>
      <p>
        {rows.length
          ? 'Try a different search or reset the filters.'
          : 'Tap Add statue to start with a photo or a quick note.'}
      </p>
    </div>
  {/if}
  <form method="POST" action="/admin/sign-out" class="signout">
    <button class="text-button">Sign out</button>
  </form>
</main>
