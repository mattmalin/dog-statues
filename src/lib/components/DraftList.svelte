<script lang="ts">
  import WorkspaceNav from './WorkspaceNav.svelte';
  import type { Statue } from '$lib/model';
  let {
    rows,
    newId,
    view,
  }: {
    rows: Pick<
      Statue,
      'id' | 'title' | 'city' | 'country' | 'web_status' | 'editorial_status' | 'updated_at'
    >[];
    newId: string;
    view: 'workspace' | 'inbox' | 'all';
  } = $props();
  let search = $state('');
  const labels = { workspace: 'Your workspace', inbox: 'Draft inbox', all: 'All statues' };
  const filtered = $derived(
    rows.filter((row) =>
      [row.title || 'Untitled statue', row.city, row.country]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
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
  {#if view === 'all' && rows.length}
    <label class="search"
      >Find a statue<input
        type="search"
        bind:value={search}
        placeholder="Name, city or country"
      /></label
    >
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
            <div>
              <strong>{row.title.trim() || 'Untitled statue'}</strong><small
                >{[row.city, row.country].filter(Boolean).join(', ') || 'Location to add'}</small
              >
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
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <strong>{search ? 'No matches' : 'Nothing here yet'}</strong>
      <p>
        {search
          ? 'Try a different name or place.'
          : 'Tap Add statue to start with a photo or a quick note.'}
      </p>
    </div>
  {/if}
  <form method="POST" action="/admin/sign-out" class="signout">
    <button class="text-button">Sign out</button>
  </form>
</main>
