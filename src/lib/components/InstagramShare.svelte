<script lang="ts">
  import type { Photo } from '$lib/model';
  import { message, send } from '$lib/client';
  import InstagramCrop from './InstagramCrop.svelte';
  import {
    instagramCaption,
    instagramCaptionLimit,
    instagramHandle,
    instagramPhotoLimit,
    defaultCrop,
    type InstagramDraft,
    type SquareCrop,
    type InstagramPublication,
  } from '$lib/instagram';

  let {
    api,
    photos,
    description,
    city,
    country,
    instagramEnabled,
    instagramPublication,
    instagramDraft,
    save,
  }: {
    api: string;
    photos: Photo[];
    description: string;
    city: string;
    country: string;
    instagramEnabled: boolean;
    instagramPublication: InstagramPublication | null;
    instagramDraft: InstagramDraft | null;
    save: () => Promise<boolean>;
  } = $props();

  const approved = $derived(photos.filter((photo) => photo.rights_status === 'approved'));
  const caption = $derived(instagramCaption(description, city, country));
  const ready = $derived(Boolean(approved.length && caption));
  let review = $state(false);
  let selected = $state<string[]>([]);
  let crops = $state<Record<string, SquareCrop>>({});
  let draft = $state<InstagramDraft | undefined>();
  const savedDraft = $derived(draft ?? instagramDraft);
  let savingDraft = $state(false);
  let draftNotice = $state('');
  let publishing = $state(false);
  let publication = $state<InstagramPublication | null>(null);
  let publicationError = $state('');
  const status = $derived(publication ?? instagramPublication);
  const selectedIds = $derived(
    approved.filter((photo) => selected.includes(photo.id)).map((photo) => photo.id),
  );
  const blocked = $derived(
    status?.status === 'published' ||
      status?.status === 'unknown' ||
      status?.status === 'preparing',
  );

  function reviewPost() {
    selected = savedDraft
      ? [...savedDraft.photoIds]
      : approved.length <= instagramPhotoLimit
        ? approved.map((photo) => photo.id)
        : [];
    crops = { ...savedDraft?.crops };
    publicationError = '';
    review = true;
  }

  async function saveDraft() {
    savingDraft = true;
    publicationError = '';
    draftNotice = '';
    try {
      draft = await send<InstagramDraft>(api + '/instagram', 'PUT', {
        photoIds: selectedIds,
        crops,
      });
      draftNotice = 'Instagram draft saved.';
    } catch (cause) {
      publicationError = message(cause);
    } finally {
      savingDraft = false;
    }
  }

  async function refreshStatus() {
    const response = await fetch(api + '/instagram', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Status unavailable');
    publication = await response.json();
  }

  async function checkStatus() {
    publicationError = '';
    try {
      await refreshStatus();
    } catch {
      publicationError = 'Could not check the Instagram status. Try again.';
    }
  }

  async function publishPost() {
    if (publishing || blocked) return;
    const payload = { photoIds: selectedIds, crops, caption, confirmPublic: true };
    publishing = true;
    publicationError = '';
    try {
      if (!(await save())) {
        publicationError = 'Save your changes before publishing to Instagram.';
        return;
      }
      publication = await send<InstagramPublication>(api + '/instagram', 'POST', payload);
      review = false;
    } catch (cause) {
      publicationError = message(cause);
      await refreshStatus().catch(() => {});
    } finally {
      publishing = false;
    }
  }
  const photoUrl = (photo: Photo) => `${api}/photos/${photo.id}?size=web`;
  let open = $state(false);
  let busy = $state(false);
  let notice = $state('');
  let captionBox = $state<HTMLTextAreaElement>();
  let prepared = $state<{ key: string; files: File[] }>();
  const key = $derived(JSON.stringify([api, approved.map((photo) => photo.id)]));
  const files = $derived(prepared?.key === key ? prepared.files : undefined);

  async function prepare() {
    open = true;
    notice = '';
    if (!ready || files || busy) return;
    busy = true;
    const snapshot = approved.slice();
    const photoKey = key;
    try {
      if (!navigator.share || !navigator.canShare) {
        notice = 'Download the photos and open Instagram to create your post.';
        return;
      }
      const images: File[] = [];
      for (const [index, photo] of snapshot.entries()) {
        const response = await fetch(photoUrl(photo));
        const image = await response.blob();
        if (!response.ok || image.type !== 'image/jpeg') throw new Error('Photo unavailable');
        images.push(new File([image], filename(index), { type: image.type }));
      }
      if (navigator.canShare({ files: images })) prepared = { key: photoKey, files: images };
      else
        notice =
          'This device cannot share these photos together. Download them and open Instagram.';
    } catch {
      notice = 'Could not prepare the photos. Try again or download them below.';
    } finally {
      busy = false;
    }
  }

  function filename(index: number) {
    return `dog-statues-${String(index + 1).padStart(2, '0')}.jpg`;
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      notice = 'Caption copied.';
    } catch {
      captionBox?.focus();
      captionBox?.select();
      notice = 'Caption selected. Use your device’s copy action.';
    }
  }

  async function share() {
    if (!files || !ready) return;
    notice = '';
    try {
      const data = { files, text: caption };
      await navigator.share(navigator.canShare(data) ? data : { files });
      notice = 'Review the post in Instagram and paste the caption if needed.';
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        notice = 'Could not open sharing. Download the photos and open Instagram.';
      }
    }
  }
</script>

<section class="panel" aria-labelledby="instagram-heading">
  <h2 id="instagram-heading">Instagram</h2>
  <button class="secondary" disabled={!ready || busy} onclick={prepare}>
    {busy ? 'Preparing photos…' : 'Open in Instagram'}
  </button>
  {#if !ready}
    <p class="hint">Add a public description, city, country and at least one approved photo.</p>
  {/if}
  {#if open && ready}
    <p>
      Copy the caption, then choose Instagram Feed in the share menu. Check that you’re signed in as
      @dogstatues and review the audience before sharing in Instagram.
    </p>
    <label
      >Caption<textarea readonly rows="5" value={caption} bind:this={captionBox}></textarea></label
    >
    <button class="secondary" onclick={copyCaption}>Copy caption</button>
    {#if files}
      <button class="primary" onclick={share}>Open share menu</button>
    {/if}
    <details>
      <summary>Download photos in order ({approved.length})</summary>
      <ol>
        {#each approved as photo, index (photo.id)}
          <li>
            <a href={photoUrl(photo)} download={filename(index)}>Download photo {index + 1}</a>
          </li>
        {/each}
      </ol>
    </details>
  {/if}
  <p class="hint" role="status">{notice}</p>
  <button
    class="primary"
    disabled={!approved.length || blocked || publishing || savingDraft}
    onclick={reviewPost}
  >
    {savedDraft
      ? 'Resume Instagram draft'
      : ready && instagramEnabled
        ? 'Publish to ' + instagramHandle
        : 'Prepare Instagram draft'}
  </button>
  {#if !instagramEnabled}
    <p class="hint">Direct publishing needs an Instagram access token on the Atlas server.</p>
  {/if}
  {#if status?.status === 'published'}
    <p role="status">
      Published to {instagramHandle}. {#if status.permalink}<a href={status.permalink}
          >View Instagram post</a
        >{/if}
    </p>
  {:else if status?.status === 'unknown' || status?.status === 'preparing'}
    <p role="status">
      {status.status === 'unknown'
        ? 'Instagram may have published this post. Check your feed and the publishing status.'
        : 'Instagram post preparation is in progress.'}
    </p>
    <button class="secondary" disabled={publishing} onclick={checkStatus}
      >Check publishing status</button
    >
  {/if}
  {#if review && !blocked}
    <h3>Review public post for {instagramHandle}</h3>
    <p>This will publish a public feed post immediately.</p>
    <label>Instagram post preview<textarea readonly rows="6" value={caption}></textarea></label>
    {#if caption.length > instagramCaptionLimit}
      <p class="error">
        The caption including location must be {instagramCaptionLimit} characters or fewer. Shorten the
        website description to continue.
      </p>
    {/if}
    <fieldset disabled={publishing || savingDraft}>
      <legend>Photos ({selectedIds.length}/{instagramPhotoLimit})</legend>
      {#each approved as photo (photo.id)}
        <label>
          <input
            type="checkbox"
            value={photo.id}
            bind:group={selected}
            disabled={selectedIds.length >= instagramPhotoLimit && !selected.includes(photo.id)}
          />
          <img
            src={photoUrl(photo)}
            alt={photo.alt_text}
            width="56"
            height="56"
            loading="lazy"
            style="object-fit: cover"
          />
          {photo.original_filename}
        </label>
        {#if selectedIds.includes(photo.id)}
          <details>
            <summary>Square crop for {photo.original_filename}</summary>
            <InstagramCrop
              {photo}
              src={photoUrl(photo)}
              crop={crops[photo.id] ?? defaultCrop}
              onchange={(crop) => (crops[photo.id] = crop)}
            />
          </details>
        {/if}
      {/each}
    </fieldset>
    <button class="secondary" disabled={publishing || savingDraft} onclick={() => (review = false)}
      >Cancel</button
    >
    <button class="secondary" disabled={publishing || savingDraft} onclick={saveDraft}>
      {savingDraft ? 'Saving…' : 'Save Instagram draft'}
    </button>
    <button
      class="primary"
      disabled={publishing ||
        savingDraft ||
        !instagramEnabled ||
        !ready ||
        !selectedIds.length ||
        caption.length > instagramCaptionLimit}
      onclick={publishPost}
    >
      {publishing ? 'Publishing…' : 'Confirm public Instagram post'}
    </button>
  {/if}
  {#if draftNotice}<p role="status">{draftNotice}</p>{/if}
  {#if publicationError}<p class="error" role="alert">{publicationError}</p>{/if}
</section>
