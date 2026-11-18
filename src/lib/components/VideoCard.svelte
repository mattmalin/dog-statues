<script lang="ts">
  import type { Video, videoEditSchema } from '$lib/video';
  import type { z } from 'zod';
  let {
    video,
    path,
    busy,
    first,
    last,
    onedit,
  }: {
    video: Video;
    path: string;
    busy: boolean;
    first: boolean;
    last: boolean;
    onedit: (edit: z.infer<typeof videoEditSchema>) => Promise<boolean>;
  } = $props();
  let open = $state(false);
  let description = $state(''),
    credit = $state(''),
    captions = $state('');
  let approved = $state(false);
  function toggle() {
    if (!open) {
      description = video.description;
      credit = video.credit;
      captions = video.captions;
      approved = video.rights_status === 'approved';
    }
    open = !open;
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (
      await onedit({
        action: 'details',
        description,
        credit,
        captions,
        rights_status: approved ? 'approved' : 'private',
      })
    )
      open = false;
  }
</script>

<li class="video-card">
  <video
    controls
    playsinline
    preload="none"
    src={path}
    poster={path + '?size=poster'}
    aria-label={video.description || video.original_filename}
  >
    <track
      kind="captions"
      src={path + '?captions=1'}
      srclang="en"
      label={video.description || video.original_filename}
    />
  </video>
  <div class="video-card-content">
    <strong class="filename">{video.original_filename}</strong>
    <small
      >{Math.ceil(video.duration_seconds)} seconds · {video.rights_status === 'approved'
        ? 'Approved for website'
        : 'Private video'}</small
    >
    {#if video.rights_status === 'approved' && !video.description.trim()}<small
        >Description missing</small
      >{/if}
    <div class="button-row">
      <button class="secondary" type="button" disabled={busy} aria-expanded={open} onclick={toggle}
        >{open ? 'Close' : 'Video details'}</button
      >
      <button
        class="secondary"
        type="button"
        aria-label={'Move ' + video.original_filename + ' earlier'}
        disabled={busy || first}
        onclick={() => onedit({ action: 'earlier' })}>↑</button
      >
      <button
        class="secondary"
        type="button"
        aria-label={'Move ' + video.original_filename + ' later'}
        disabled={busy || last}
        onclick={() => onedit({ action: 'later' })}>↓</button
      >
    </div>
  </div>
  {#if open}
    <form onsubmit={save} class="video-detail">
      <label
        >Video description<textarea rows="2" maxlength="1000" bind:value={description}
        ></textarea></label
      >
      <p class="hint">
        Describe what happens in the clip. This description appears with published videos.
      </p>
      <label>Video credit<input maxlength="300" bind:value={credit} /></label>
      <label class="check"
        ><input type="checkbox" bind:checked={approved} /> I have permission to show this video on the
        website</label
      >
      <details>
        <summary>Captions for speech or meaningful sound</summary>
        <label
          >WebVTT captions<textarea
            rows="5"
            maxlength="50000"
            bind:value={captions}
            placeholder={'WEBVTT\n\n00:00.000 --> 00:02.000\nYour caption'}
          ></textarea></label
        >
        <p class="hint">
          Optional timed captions. Include speech and sound needed to understand the clip.
        </p>
      </details>
      <div class="button-row">
        <button disabled={busy}>Save video details</button>
        <a class="button secondary" href={path + '?size=original'} download>Download original</a>
        <button
          class="danger secondary"
          type="button"
          disabled={busy}
          onclick={() => {
            if (confirm('Remove “' + video.original_filename + '” from this statue?'))
              void onedit({ action: 'delete' });
          }}>Remove video</button
        >
      </div>
    </form>
  {/if}
</li>

<style>
  .video-card {
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  video {
    display: block;
    width: 100%;
    max-height: 400px;
    background: #17131f;
  }
  .video-card-content,
  .video-detail {
    padding: 1rem;
  }
  .filename {
    display: block;
    overflow-wrap: anywhere;
  }
  small {
    display: block;
  }
</style>
