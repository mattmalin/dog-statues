<script lang="ts">
  import type { Photo } from '$lib/model';

  let {
    api,
    photos,
    description,
    city,
    country,
  }: { api: string; photos: Photo[]; description: string; city: string; country: string } =
    $props();

  const approved = $derived(photos.filter((photo) => photo.rights_status === 'approved'));
  const caption = $derived(`${description.trim()}\n\nLocation: ${city.trim()}, ${country.trim()}`);
  const ready = $derived(
    Boolean(approved.length && description.trim() && city.trim() && country.trim()),
  );
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
    {busy ? 'Preparing photos…' : 'Post to Instagram'}
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
</section>
