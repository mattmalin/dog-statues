<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import WorkspaceNav from '$lib/components/WorkspaceNav.svelte';
  import PotentialImages from '$lib/components/PotentialImages.svelte';
  import DeleteRecord from '$lib/components/DeleteRecord.svelte';
  import { potentialStatuses, type PotentialFields } from '$lib/potential';
  import { message, send } from '$lib/client';
  import { googleMapsUrl } from '$lib/maps';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  const initialFields = () => ({ ...data.row });
  let fields = $state<PotentialFields>(initialFields());
  let saving = $state(false);
  let importing = $state(false);
  let notice = $state('');
  let dirty = $state(false);
  let deleting = $state(false);

  async function removeRecord() {
    if (saving || importing || deleting || data.row.revision === null) return;
    deleting = true;
    try {
      await send('/api/admin/potential/' + data.row.id, 'DELETE', {
        revision: data.row.revision,
        confirmed: true,
      });
      await goto('/admin/potential');
    } finally {
      deleting = false;
    }
  }
  const mapsLink = $derived(googleMapsUrl(fields.maps_url)?.href);
  const sourceLink = $derived(
    /^https?:\/\//i.test(fields.source_url) ? fields.source_url : undefined,
  );

  async function importPin() {
    importing = true;
    notice = '';
    const url = fields.maps_url;
    const before = JSON.stringify([fields.latitude, fields.longitude, fields.location]);
    try {
      const result = await send<{
        coordinates: { latitude: number; longitude: number } | null;
        address?: string;
      }>('/api/admin/maps-pin', 'POST', { url });
      if (
        fields.maps_url !== url ||
        before !== JSON.stringify([fields.latitude, fields.longitude, fields.location])
      ) {
        notice = 'Location changed while importing. Try again.';
        return;
      }
      if (result.coordinates) Object.assign(fields, result.coordinates);
      if (result.address) fields.location = result.address;
      notice = result.coordinates
        ? 'Coordinates imported. Check the location and save.'
        : 'This link has no coordinates to import. You can still save the link.';
    } catch (cause) {
      notice = message(cause);
    } finally {
      importing = false;
    }
  }
</script>

<svelte:head
  ><title>{data.row.name || 'Add potential statue'} · Potential future dog statues</title
  ></svelte:head
>
<main id="main" class="shell main editor" inert={deleting}>
  <WorkspaceNav />
  <a class="back" href="/admin/potential">← Potential future dog statues</a>
  <h1>{data.row.name || 'Add potential statue'}</h1>
  <p>Private research. Save a name, source or map pin to return to later.</p>
  <form
    inert={deleting}
    method="POST"
    oninput={() => (dirty = true)}
    use:enhance={() => {
      saving = true;
      return async ({ update, result }) => {
        try {
          await update({ reset: false });
          if (result.type === 'redirect' || result.type === 'success') dirty = false;
        } finally {
          saving = false;
        }
      };
    }}
  >
    <input type="hidden" name="id" value={data.row.id} />
    <input type="hidden" name="revision" value={data.row.revision ?? ''} />
    <section class="panel">
      <label>Name<input required name="name" maxlength="160" bind:value={fields.name} /></label>
      <div class="field-grid">
        <label>City<input name="city" maxlength="100" bind:value={fields.city} /></label>
        <label>Country<input name="country" maxlength="100" bind:value={fields.country} /></label>
        <label
          >Status<select name="status" bind:value={fields.status}>
            {#each Object.entries(potentialStatuses) as [value, label]}<option {value}
                >{label}</option
              >{/each}
          </select></label
        >
      </div>
      <label
        >Location or address<input
          name="location"
          maxlength="320"
          bind:value={fields.location}
        /></label
      >
      <label
        >Google Maps pin link<input
          type="url"
          name="maps_url"
          maxlength="2048"
          bind:value={fields.maps_url}
        /></label
      >
      <div class="button-row">
        {#if mapsLink}<a href={mapsLink} target="_blank" rel="noopener noreferrer">Open in maps ↗</a
          >{/if}
        <button
          type="button"
          class="secondary"
          disabled={importing || !fields.maps_url || saving}
          onclick={importPin}
        >
          {importing ? 'Importing pin…' : 'Import location from pin'}
        </button>
      </div>
      <p class="hint" role="status">{notice}</p>
      <div class="field-grid">
        <label
          >Latitude<input
            type="number"
            step="any"
            min="-90"
            max="90"
            name="latitude"
            bind:value={fields.latitude}
          /></label
        >
        <label
          >Longitude<input
            type="number"
            step="any"
            min="-180"
            max="180"
            name="longitude"
            bind:value={fields.longitude}
          /></label
        >
      </div>
      <label class="check"
        ><input type="checkbox" name="pin_checked" bind:checked={fields.pin_checked} /> I have checked
        the map pin</label
      >
      <label
        >Source link<input
          type="url"
          name="source_url"
          maxlength="2048"
          bind:value={fields.source_url}
        /></label
      >
      {#if sourceLink}<p>
          <a href={sourceLink} target="_blank" rel="noopener noreferrer">Open source ↗</a>
        </p>{/if}
      <label
        >Research notes<textarea name="notes" rows="8" maxlength="12000" bind:value={fields.notes}
        ></textarea></label
      >
    </section>
    <PotentialImages
      bind:images={fields.images}
      onedit={() => {
        dirty = true;
      }}
    />
    {#if form?.error}<p role="alert" class="error">{form.error}</p>{/if}
    {#if page.url.searchParams.has('saved') && !form?.error && !saving && !dirty}<p role="status">
        Potential statue saved.
      </p>{/if}
    <button disabled={saving || importing}>{saving ? 'Saving…' : 'Save potential statue'}</button>
  </form>
  {#if data.row.revision !== null}
    <DeleteRecord
      name={fields.name || data.row.name}
      label="Delete potential statue"
      explanation="Remove this potential statue and its private research, map details and image links. This does not delete a separate statue post."
      disabled={saving || importing || deleting}
      ondelete={removeRecord}
    />
  {/if}
</main>
