<script lang="ts">
  import { onMount } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import {
    fieldsSchema,
    initialFields,
    maxPhotos,
    maxUpload,
    type Fields,
    type Photo,
    type Statue,
  } from '$lib/model';
  import { message, RequestError, send, uploadId } from '$lib/client';
  import PhotoCard from './PhotoCard.svelte';

  let {
    statue,
    photos: startPhotos,
    capture,
  }: { statue: Statue; photos: Photo[]; capture: boolean } = $props();
  function fieldsFrom(row: Statue): Fields {
    return Object.fromEntries(
      Object.keys(initialFields).map((key) => [key, row[key as keyof Fields]]),
    ) as Fields;
  }

  type Edit = Parameters<NonNullable<import('svelte').ComponentProps<typeof PhotoCard>['onedit']>>;
  type Upload = {
    id: string;
    file: File;
    preview: string;
    progress: number;
    status: 'waiting' | 'uploading' | 'failed';
    error?: string;
  };
  type Recovery = { fields: Fields; revision: number };

  const start = () => ({
    fields: fieldsFrom(statue),
    photos: startPhotos,
    revision: statue.revision,
    slug: statue.slug,
    webStatus: statue.web_status,
    cover: statue.cover_media_id,
    waivePhoto: statue.photo_waiver,
  });

  const initial = start();
  let fields = $state(initial.fields);
  let photos = $state(initial.photos);
  let revision = $state(initial.revision);
  let slug = $state(initial.slug);
  let webStatus = $state(initial.webStatus);
  let cover = $state(initial.cover);
  let waivePhoto = $state(initial.waivePhoto);
  let saved = $state(JSON.stringify(initial.fields));
  let recoveryBase = $state<number | undefined>();
  let ready = $state(false);
  let saving = $state(false);
  let saveError = $state('');
  let storageError = $state(false);
  let conflict = $state(false);
  let photoError = $state('');
  let publishing = $state(false);
  let publicationError = $state('');
  let publicationNotice = $state('');
  let photoBusy = $state(false);
  let uploadBusy = $state(false);
  let uploads = $state<Upload[]>([]);
  let advanced = $state(false);
  let copyNotice = $state('');
  let uploadRequest: XMLHttpRequest | undefined;

  const recordId = () => statue.id;
  const api = $derived('/api/admin/statues/' + recordId());
  const recoveryKey = $derived('atlas:editor:' + recordId());
  let serialized = $derived(JSON.stringify(fields));
  let dirty = $derived(serialized !== saved);
  const status = $derived(
    conflict
      ? 'Save conflict'
      : saveError
        ? 'Changes need attention'
        : saving
          ? 'Saving…'
          : dirty
            ? 'Changes pending'
            : uploadBusy
              ? 'Uploading photos…'
              : uploads.length
                ? 'Photos need attention'
                : 'Saved to Atlas',
  );

  function remember(value: string) {
    try {
      if (value === saved) sessionStorage.removeItem(recoveryKey);
      else
        sessionStorage.setItem(
          recoveryKey,
          JSON.stringify({ fields: JSON.parse(value), revision: recoveryBase ?? revision }),
        );
      storageError = false;
    } catch {
      storageError = true;
    }
  }

  onMount(() => {
    try {
      const value = sessionStorage.getItem(recoveryKey);
      if (value) {
        const recovery = JSON.parse(value) as Recovery;
        if (JSON.stringify(recovery.fields) !== saved) {
          fields = recovery.fields;
          conflict = recovery.revision !== revision;
          if (conflict) recoveryBase = recovery.revision;
        }
      }
    } catch {
      storageError = true;
    }
    ready = true;
    const online = () => {
      if (dirty && !conflict) void save();
    };
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      uploadRequest?.abort();
      for (const entry of uploads) URL.revokeObjectURL(entry.preview);
    };
  });

  beforeNavigate((navigation) => {
    if (
      (!dirty && !saving && !uploads.length && !photoBusy && !publishing) ||
      navigation.willUnload
    ) {
      if (navigation.willUnload && (dirty || saving || uploads.length || photoBusy || publishing))
        navigation.cancel();
      return;
    }
    if (!confirm('Some edits or photos have yet to save. Leave this editor?')) navigation.cancel();
  });

  $effect(() => {
    if (!ready) return;
    const value = serialized;
    remember(value);
    if (!dirty || saving || saveError || conflict || publishing) return;
    const timer = setTimeout(() => void save(), 650);
    return () => clearTimeout(timer);
  });

  async function save() {
    if (saving || conflict) return false;
    if (!dirty) return true;
    const payload = JSON.parse(serialized) as Fields;
    const validation = fieldsSchema.safeParse(payload);
    if (!validation.success) {
      saveError = validation.error.issues[0].message;
      return false;
    }
    saving = true;
    saveError = '';
    try {
      const result = await send<{ revision: number }>(api, 'PATCH', { revision, fields: payload });
      revision = result.revision;
      saved = JSON.stringify(payload);
      return true;
    } catch (cause) {
      if (cause instanceof RequestError && cause.status === 409) conflict = true;
      saveError = message(cause);
      return false;
    } finally {
      saving = false;
    }
  }

  function changed() {
    if (!conflict) saveError = '';
  }

  async function resolveConflict(useMine: boolean) {
    saveError = '';
    try {
      const result = await fetch(api, { cache: 'no-store' });
      if (!result.ok)
        throw new RequestError(
          result.status,
          'Could not reload the latest record. Sign in or try again.',
        );
      const latest = (await result.json()) as { statue: Statue; photos: Photo[] };
      const serverFields = fieldsFrom(latest.statue);
      revision = latest.statue.revision;
      saved = JSON.stringify(serverFields);
      slug = latest.statue.slug;
      webStatus = latest.statue.web_status;
      cover = latest.statue.cover_media_id;
      waivePhoto = latest.statue.photo_waiver;
      photos = latest.photos;
      if (!useMine) fields = serverFields;
      recoveryBase = undefined;
      conflict = false;
      if (useMine) await save();
    } catch (cause) {
      saveError = message(cause);
    }
  }

  function choose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    photoError = '';
    for (const file of input.files ?? []) {
      if (photos.length + uploads.length >= maxPhotos) {
        photoError = `This statue can have up to ${maxPhotos} photos.`;
        break;
      }
      const preview = URL.createObjectURL(file);
      const tooLarge = file.size > maxUpload;
      uploads.push({
        id: uploadId(),
        file,
        preview,
        progress: 0,
        status: tooLarge ? 'failed' : 'waiting',
        error: tooLarge ? 'Choose a smaller photo. The limit is 25 MB.' : undefined,
      });
    }
    input.value = '';
    void drainUploads();
  }

  function transfer(entry: Upload) {
    return new Promise<Photo>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      uploadRequest = xhr;
      xhr.open('PUT', api + '/photos/' + entry.id);
      xhr.timeout = 120_000;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Photo-Name', encodeURIComponent(entry.file.name.toWellFormed()));
      xhr.upload.onprogress = ({ loaded, total, lengthComputable }) => {
        if (lengthComputable) entry.progress = Math.round((100 * loaded) / total);
      };
      xhr.onload = () => {
        if (xhr.status === 200 && xhr.response?.id) resolve(xhr.response);
        else
          reject(
            new RequestError(
              xhr.status,
              xhr.response?.message || 'Upload failed. Try this photo again.',
            ),
          );
      };
      xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Error('Upload interrupted'));
      xhr.send(entry.file);
    });
  }

  async function drainUploads() {
    if (uploadBusy || photoBusy || publishing) return;
    uploadBusy = true;
    try {
      let entry = uploads.find((item) => item.status === 'waiting');
      while (entry) {
        entry.status = 'uploading';
        try {
          const photo = await transfer(entry);
          photos = [...photos.filter((item) => item.id !== photo.id), photo].sort(
            (a, b) => a.position - b.position,
          );
          removeUpload(entry.id);
        } catch (cause) {
          entry.error = message(cause);
          entry.status = 'failed';
        }
        entry = uploads.find((item) => item.status === 'waiting');
      }
    } finally {
      uploadRequest = undefined;
      uploadBusy = false;
    }
  }

  function removeUpload(id: string) {
    const entry = uploads.find((item) => item.id === id);
    if (entry) URL.revokeObjectURL(entry.preview);
    uploads = uploads.filter((item) => item.id !== id);
  }

  function retryUpload(entry: Upload) {
    entry.progress = 0;
    entry.status = 'waiting';
    void drainUploads();
  }

  async function photoEdit(id: string, [action, details]: Edit) {
    if (photoBusy || uploadBusy || publishing) return false;
    photoBusy = true;
    photoError = '';
    try {
      const result = await send<{ photos: Photo[]; cover: string | null }>(
        api + '/photos/' + id,
        'PATCH',
        { action, ...details },
      );
      photos = result.photos;
      cover = result.cover;
      return true;
    } catch (cause) {
      photoError = message(cause);
      return false;
    } finally {
      photoBusy = false;
      void drainUploads();
    }
  }

  async function publication(action: 'publish' | 'unpublish') {
    if (publishing || saving || conflict || uploadBusy || photoBusy) return;
    publicationNotice = '';
    publicationError = '';
    if (
      !confirm(
        action === 'publish'
          ? 'Make this statue and its approved photos public on the Atlas?'
          : 'Hide this statue page and its photos from the public?',
      )
    )
      return;
    publishing = true;
    try {
      if (action === 'publish' && !(await save())) return;
      const result = await send<{
        revision: number;
        slug: string | null;
        web_status: Statue['web_status'];
      }>(api + '/publication', 'POST', { action, revision, waivePhoto });
      revision = result.revision;
      slug = result.slug;
      webStatus = result.web_status;
      if (action === 'unpublish') saveError = '';
      publicationNotice =
        action === 'publish' ? 'Statue published to the website.' : 'Statue page hidden.';
    } catch (cause) {
      if (cause instanceof RequestError && cause.status === 409) conflict = true;
      publicationError = message(cause);
    } finally {
      publishing = false;
      void drainUploads();
    }
  }

  async function done() {
    if (await save())
      await goto(capture ? '/admin/inbox' : '/admin/statues', { invalidateAll: true });
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(fields.instagram_caption);
      copyNotice = 'Caption copied.';
    } catch {
      const caption = document.getElementById('caption') as HTMLTextAreaElement;
      caption.focus();
      caption.select();
      copyNotice = 'Caption selected. Use your device’s copy action.';
    }
  }

  function coordinate(value: number | undefined) {
    return value ?? null;
  }
</script>

<svelte:head><title>{capture ? 'Quick add' : 'Edit statue'} · Dog Statue Atlas</title></svelte:head>
<main id="main" class="shell main editor" inert={!ready}>
  <a class="back" href={capture ? '/admin/inbox' : '/admin/statues'}
    >← {capture ? 'Draft inbox' : 'All statues'}</a
  >
  <div class="heading-row editor-heading">
    <div>
      <p class="eyebrow">{capture ? 'Field capture' : 'Statue record'}</p>
      <h1>{capture ? 'Quick add' : fields.title.trim() || 'Untitled statue'}</h1>
      <p class="lede">
        {capture
          ? 'Take a photo or leave yourself a note. You can fill in the rest later.'
          : 'Edit the record and choose what goes on the website.'}
      </p>
    </div>
    {#if !capture || advanced}
      <span class:live={webStatus === 'published'} class="badge"
        >{webStatus === 'published'
          ? 'Published'
          : webStatus === 'hidden'
            ? 'Hidden'
            : 'Private draft'}</span
      >
    {/if}
  </div>

  {#if !capture}
    <nav class="section-nav" aria-label="Editing sections">
      <a href="#photos">Photos</a><a href="#overview">Overview</a><a href="#location">Location</a><a
        href="#research">Research</a
      ><a href="#publishing">Publishing</a>
    </nav>
  {/if}

  <section class="panel" id="photos" aria-labelledby="photos-heading">
    <div class="section-heading">
      <h2 id="photos-heading">Photos</h2>
      <span class="count">{photos.length + uploads.length}/{maxPhotos}</span>
    </div>
    <div class="capture-actions">
      <label class="file-button"
        ><span aria-hidden="true">⊕</span> Choose photos<input
          type="file"
          disabled={!ready}
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          onchange={choose}
        /></label
      >
      <label class="file-button secondary"
        ><span aria-hidden="true">◉</span> Take photo<input
          type="file"
          disabled={!ready}
          accept="image/*"
          capture="environment"
          onchange={choose}
        /></label
      >
    </div>
    <p class="hint">JPEG, PNG, WebP or AVIF. Up to 25 MB each. Photos start private.</p>
    {#if photoError}<p role="alert" class="error">{photoError}</p>{/if}
    {#if uploads.length || photos.length}
      <ul class="photo-list">
        {#each photos as photo, index (photo.id)}
          <PhotoCard
            {photo}
            path={api + '/photos/' + photo.id}
            cover={cover === photo.id}
            first={index === 0}
            last={index === photos.length - 1}
            busy={photoBusy || uploadBusy || publishing}
            capture={capture && !advanced}
            onedit={(...args) => photoEdit(photo.id, args)}
          />
        {/each}
        {#each uploads as entry (entry.id)}
          <li class="photo-card">
            <img src={entry.preview} alt="" />
            <div class="photo-card-content">
              <strong class="filename">{entry.file.name}</strong>
              {#if entry.status === 'failed'}
                <small class="error" role="alert">{entry.error}</small>
                <div class="photo-actions">
                  {#if entry.file.size <= maxUpload}<button
                      class="secondary"
                      onclick={() => retryUpload(entry)}>Retry photo</button
                    >{/if}
                  <button class="secondary" onclick={() => removeUpload(entry.id)}>Dismiss</button>
                </div>
              {:else if entry.status === 'uploading'}
                <small aria-live="polite"
                  >{entry.progress === 100
                    ? 'Processing photo…'
                    : 'Uploading · ' + entry.progress + '%'}</small
                >
                <progress aria-label={'Upload ' + entry.file.name} max="100" value={entry.progress}
                ></progress>
              {:else}
                <small>Waiting to upload</small>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="panel" id="overview" aria-labelledby="overview-heading">
    <h2 id="overview-heading">{capture ? 'Quick details' : 'Overview'}</h2>
    {#if capture}
      <label
        >Quick note <span class="optional">Private</span>
        <textarea
          rows="2"
          maxlength="16000"
          bind:value={fields.private_notes}
          oninput={changed}
          placeholder="Something to look up later"
        ></textarea>
      </label>
    {/if}
    <label
      >Statue name {#if capture}<span class="optional">Optional</span>{/if}
      <input
        maxlength="160"
        bind:value={fields.title}
        oninput={changed}
        placeholder="Leave blank if you don’t know yet"
      />
    </label>
    {#if capture}
      <label
        >City or area <span class="optional">Optional</span>
        <input
          maxlength="100"
          bind:value={fields.city}
          oninput={changed}
          placeholder="e.g. London"
        />
      </label>
    {/if}
    {#if !capture || advanced}
      <label
        >Short summary<input
          maxlength="300"
          bind:value={fields.short_summary}
          oninput={changed}
          placeholder="A brief introduction"
        /></label
      >
      <label
        >Website description<textarea
          rows="6"
          maxlength="16000"
          bind:value={fields.web_description}
          oninput={changed}
        ></textarea></label
      >
      <div class="field-grid">
        <label
          >Editorial status<select bind:value={fields.editorial_status} onchange={changed}
            ><option value="inbox">Inbox</option><option value="draft">Draft</option><option
              value="ready">Ready</option
            ></select
          ></label
        >
        <label
          >Visit status<select bind:value={fields.visit_status} onchange={changed}
            ><option value="unvisited">Unvisited</option><option value="visited">Visited</option
            ></select
          ></label
        >
      </div>
    {/if}
  </section>

  {#if capture && !advanced}
    <button type="button" class="secondary" onclick={() => (advanced = true)}
      >Add more details</button
    >
  {/if}
  {#if !capture || advanced}
    <section class="panel" id="location">
      <h2>Location</h2>
      <label
        >Street address<input
          maxlength="320"
          bind:value={fields.address}
          oninput={changed}
        /></label
      >
      <div class="field-grid">
        {#if !capture}<label
            >City<input maxlength="100" bind:value={fields.city} oninput={changed} /></label
          >{/if}
        <label>Region<input maxlength="100" bind:value={fields.region} oninput={changed} /></label>
        <label>Country<input maxlength="100" bind:value={fields.country} oninput={changed} /></label
        >
        <label
          >Postcode<input maxlength="30" bind:value={fields.postal_code} oninput={changed} /></label
        >
        <label
          >Latitude<input
            type="number"
            inputmode="decimal"
            step="any"
            min="-90"
            max="90"
            value={fields.latitude ?? undefined}
            oninput={(event) => {
              fields.latitude = coordinate(
                event.currentTarget.value === '' ? undefined : event.currentTarget.valueAsNumber,
              );
              changed();
            }}
          /></label
        >
        <label
          >Longitude<input
            type="number"
            inputmode="decimal"
            step="any"
            min="-180"
            max="180"
            value={fields.longitude ?? undefined}
            oninput={(event) => {
              fields.longitude = coordinate(
                event.currentTarget.value === '' ? undefined : event.currentTarget.valueAsNumber,
              );
              changed();
            }}
          /></label
        >
      </div>
    </section>
    <section class="panel" id="research">
      <h2>Research</h2>
      {#if !capture}<label
          >Private notes<textarea
            rows="5"
            maxlength="16000"
            bind:value={fields.private_notes}
            oninput={changed}
            placeholder="Research leads, source URLs or visit notes"
          ></textarea></label
        >{/if}
      <label
        >Instagram caption <span class="optional">Private</span><textarea
          id="caption"
          rows="4"
          maxlength="2200"
          bind:value={fields.instagram_caption}
          oninput={changed}
        ></textarea></label
      >
      <button class="secondary" disabled={!fields.instagram_caption} onclick={copyCaption}
        >Copy Instagram caption</button
      >
      <p class="hint" role="status">{copyNotice}</p>
    </section>
    <section class="panel" id="publishing">
      <h2>Publishing</h2>
      {#if webStatus === 'published' && slug}
        <p>Saved changes appear on the website.</p>
        <div class="button-row">
          <a class="button secondary" href={'/statues/' + slug} target="_blank" rel="noopener"
            >View public page ↗</a
          >
          <button
            class="secondary danger"
            disabled={publishing || saving || conflict || uploadBusy || photoBusy}
            onclick={() => publication('unpublish')}>Unpublish</button
          >
        </div>
      {:else}
        <p class="hint">
          Add a name, public description and location. Approve at least one photo with alt text, or
          choose to publish without photos.
        </p>
        <label class="check"
          ><input type="checkbox" bind:checked={waivePhoto} /> Allow publication without photos</label
        >
        <button
          disabled={publishing || saving || conflict || uploadBusy || photoBusy}
          onclick={() => publication('publish')}>Publish to website</button
        >
      {/if}
      {#if publicationError}<p role="alert" class="error">{publicationError}</p>{/if}
      {#if publicationNotice}<p role="status">{publicationNotice}</p>{/if}
    </section>
  {/if}
</main>

<div class="savebar">
  <div class="shell savebar-inner">
    {#if saveError || conflict}
      <div class="save-issue">
        <p class="error" role="alert">
          {saveError || 'This record changed while your edits were pending.'}
        </p>
        {#if conflict}
          <div class="button-row">
            <button
              class="secondary"
              disabled={uploadBusy || photoBusy}
              onclick={() => resolveConflict(false)}>Use latest saved version</button
            >
            <button
              class="secondary"
              disabled={uploadBusy || photoBusy}
              onclick={() => {
                if (confirm('Replace the latest saved fields with your edits?'))
                  void resolveConflict(true);
              }}>Keep my edits</button
            >
          </div>
        {:else}
          <button class="text-button" onclick={() => save()}>Retry save</button>
        {/if}
      </div>
    {/if}
    {#if storageError}<p class="save-issue error">
        This browser couldn’t store a recovery copy. Keep the editor open until your changes save.
      </p>{/if}
    <div class="save-status" role="status">
      <span class:pending={dirty || saving}></span>{status}
    </div>
    <button
      disabled={!ready || saving || conflict || uploadBusy || photoBusy || publishing}
      onclick={done}>{capture ? 'Save draft' : 'Save & close'}</button
    >
  </div>
</div>
