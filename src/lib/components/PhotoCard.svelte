<script lang="ts">
  import type { Photo } from '$lib/model';

  let {
    photo,
    path,
    cover,
    first,
    last,
    busy,
    capture,
    onedit,
  }: {
    photo: Photo;
    path: string;
    cover: boolean;
    first: boolean;
    last: boolean;
    busy: boolean;
    capture: boolean;
    onedit: (
      action: 'details' | 'cover' | 'earlier' | 'later' | 'delete',
      details?: { alt_text: string; credit: string; rights_status: Photo['rights_status'] },
    ) => Promise<boolean>;
  } = $props();
  let alt = $state('');
  let credit = $state('');
  let approved = $state(false);
  let open = $state(false);

  function toggle() {
    if (!open) {
      alt = photo.alt_text;
      credit = photo.credit;
      approved = photo.rights_status === 'approved';
    }
    open = !open;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (
      await onedit('details', {
        alt_text: alt,
        credit,
        rights_status: approved ? 'approved' : 'private',
      })
    ) {
      open = false;
    }
  }
</script>

<li class="photo-card">
  <img src={path} alt={photo.alt_text || ''} />
  <div class="photo-card-content">
    <strong class="filename">{photo.original_filename}</strong>
    <small
      >{cover ? 'Cover · ' : ''}{photo.rights_status === 'approved'
        ? 'Approved for website'
        : 'Private photo'}</small
    >
    {#if !capture || open}
      <div class="photo-actions">
        <button
          class="secondary"
          type="button"
          disabled={busy}
          aria-expanded={open}
          onclick={toggle}>{open ? 'Close' : 'Photo details'}</button
        >
        <button
          class="secondary"
          type="button"
          disabled={busy || cover}
          onclick={() => onedit('cover')}>{cover ? 'Cover set' : 'Set cover'}</button
        >
        <button
          class="secondary icon"
          type="button"
          title="Move earlier"
          aria-label={'Move ' + photo.original_filename + ' earlier'}
          disabled={busy || first}
          onclick={() => onedit('earlier')}>↑</button
        >
        <button
          class="secondary icon"
          type="button"
          title="Move later"
          aria-label={'Move ' + photo.original_filename + ' later'}
          disabled={busy || last}
          onclick={() => onedit('later')}>↓</button
        >
      </div>
    {:else}
      <button
        class="text-button"
        type="button"
        disabled={busy}
        aria-expanded={open}
        onclick={toggle}>Photo details</button
      >
    {/if}
  </div>
  {#if open}
    <form class="photo-detail" onsubmit={save}>
      <label
        >Alt text <input
          maxlength="500"
          bind:value={alt}
          required={approved}
          placeholder="Describe what the photo shows"
        /></label
      >
      <label
        >Photo credit <input
          maxlength="300"
          bind:value={credit}
          placeholder="Photographer or licence, if applicable"
        /></label
      >
      <label class="check"
        ><input type="checkbox" bind:checked={approved} /> I have permission to show this photo on the
        website</label
      >
      <div class="button-row">
        <button disabled={busy}>Save photo details</button>
        <a class="button secondary" href={path + '?size=web'} download={photo.id + '.jpg'}
          >Download JPEG</a
        >
        <button
          class="danger secondary"
          type="button"
          disabled={busy}
          onclick={() => {
            if (confirm('Remove this photo from the statue?')) void onedit('delete');
          }}>Remove photo</button
        >
      </div>
    </form>
  {/if}
</li>
