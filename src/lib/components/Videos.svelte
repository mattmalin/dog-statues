<script lang="ts">
  import { onMount } from 'svelte';
  import {
    maxVideos,
    maxVideoUpload,
    maxVideoSeconds,
    type Video,
    type videoEditSchema,
  } from '$lib/video';
  import type { z } from 'zod';
  import { message, RequestError, send, uploadId } from '$lib/client';
  import VideoCard from './VideoCard.svelte';
  let {
    statueId,
    videos = $bindable(),
    busy = $bindable(false),
    pending = $bindable(false),
    locked,
  }: {
    statueId: string;
    videos: Video[];
    busy: boolean;
    pending: boolean;
    locked: boolean;
  } = $props();
  type Upload = {
    id: string;
    file: File;
    preview: string;
    progress: number;
    status: 'waiting' | 'uploading' | 'failed';
    error?: string;
  };
  let uploads = $state<Upload[]>([]);
  let notice = $state('');
  let ready = $state(false);
  let request: XMLHttpRequest | undefined;
  const api = $derived('/api/admin/statues/' + statueId + '/videos/');
  onMount(() => {
    ready = true;
    return () => {
      request?.abort();
      for (const entry of uploads) URL.revokeObjectURL(entry.preview);
    };
  });
  $effect(() => {
    pending = uploads.length > 0;
  });
  $effect(() => {
    if (ready && !locked && !busy && uploads.some((entry) => entry.status === 'waiting'))
      void drain();
  });
  function choose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    notice = '';
    for (const file of input.files ?? []) {
      if (videos.length + uploads.length >= maxVideos) {
        notice = `This statue can have up to ${maxVideos} video clips.`;
        break;
      }
      uploads.push({
        id: uploadId(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: file.size > maxVideoUpload ? 'failed' : 'waiting',
        error: file.size > maxVideoUpload ? 'Choose a video under 100 MB.' : undefined,
      });
    }
    input.value = '';
  }
  function dismiss(id: string) {
    const entry = uploads.find((item) => item.id === id);
    if (entry) URL.revokeObjectURL(entry.preview);
    uploads = uploads.filter((item) => item.id !== id);
  }
  function transfer(entry: Upload) {
    return new Promise<Video>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      request = xhr;
      xhr.open('PUT', api + entry.id);
      xhr.timeout = 240000;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Video-Name', encodeURIComponent(entry.file.name.toWellFormed()));
      xhr.upload.onprogress = ({ loaded, total, lengthComputable }) => {
        if (lengthComputable) entry.progress = Math.round((100 * loaded) / total);
      };
      xhr.onload = () => {
        if (xhr.status === 200 && xhr.response?.id) resolve(xhr.response);
        else
          reject(
            new RequestError(
              xhr.status,
              xhr.response?.message || 'Upload failed. Try this clip again.',
            ),
          );
      };
      xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Error('Upload interrupted'));
      xhr.send(entry.file);
    });
  }
  async function drain() {
    if (busy || locked) return;
    busy = true;
    try {
      let entry = uploads.find((item) => item.status === 'waiting');
      while (entry) {
        entry.status = 'uploading';
        try {
          const video = await transfer(entry);
          videos = [...videos.filter((item) => item.id !== video.id), video].sort(
            (a, b) => a.position - b.position,
          );
          dismiss(entry.id);
        } catch (cause) {
          entry.error = message(cause);
          entry.status = 'failed';
        }
        entry = uploads.find((item) => item.status === 'waiting');
      }
    } finally {
      request = undefined;
      busy = false;
    }
  }
  async function edit(id: string, edit: z.infer<typeof videoEditSchema>) {
    if (busy || locked) return false;
    busy = true;
    notice = '';
    try {
      const result = await send<{ videos: Video[] }>(api + id, 'PATCH', edit);
      videos = result.videos;
      return true;
    } catch (cause) {
      notice = message(cause);
      return false;
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel" id="videos" aria-labelledby="videos-heading">
  <div class="section-heading">
    <h2 id="videos-heading">Videos</h2>
    <span class="count">{videos.length + uploads.length}/{maxVideos}</span>
  </div>
  <div class="capture-actions">
    <label class="file-button"
      >Choose videos<input
        type="file"
        disabled={!ready || locked}
        multiple
        accept="video/mp4,video/quicktime,video/webm,.mov"
        onchange={choose}
      /></label
    >
    <label class="file-button secondary"
      >Record video<input
        type="file"
        disabled={!ready || locked}
        accept="video/*"
        capture="environment"
        onchange={choose}
      /></label
    >
  </div>
  <p class="hint">
    MP4, MOV or WebM. Up to 100 MB and {maxVideoSeconds} seconds each. Clips start private. Keep this
    tab open until uploads finish.
  </p>
  <p class="hint">
    Approve each clip in Video details, then publish the website update. Instagram preparation
    continues to use photos.
  </p>
  {#if notice}<p role="alert" class="error">{notice}</p>{/if}
  <ul class="video-list">
    {#each videos as video, index (video.id)}<VideoCard
        {video}
        path={api + video.id}
        busy={busy || locked}
        first={index === 0}
        last={index === videos.length - 1}
        onedit={edit.bind(null, video.id)}
      />{/each}
    {#each uploads as entry (entry.id)}
      <li class="upload-card">
        <!-- svelte-ignore a11y_media_has_caption (local unsaved upload preview) -->
        <video controls playsinline preload="metadata" src={entry.preview}></video>
        <strong class="filename">{entry.file.name}</strong>
        {#if entry.status === 'failed'}
          <p role="alert" class="error">{entry.error}</p>
          <div class="button-row">
            {#if entry.file.size <= maxVideoUpload}<button
                class="secondary"
                type="button"
                disabled={busy || locked}
                onclick={() => {
                  entry.progress = 0;
                  entry.status = 'waiting';
                }}>Retry video</button
              >{/if}
            <button
              class="secondary"
              type="button"
              disabled={busy}
              onclick={() => dismiss(entry.id)}>Dismiss video</button
            >
          </div>
        {:else if entry.status === 'uploading'}
          <p role="status">
            {entry.progress === 100 ? 'Processing video…' : 'Uploading · ' + entry.progress + '%'}
          </p>
          <progress aria-label={'Upload ' + entry.file.name} max="100" value={entry.progress}
          ></progress>
        {:else}<p>Waiting to upload</p>{/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .video-list {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 1rem;
  }
  .upload-card {
    border: 1px solid var(--line);
    padding: 1rem;
    border-radius: 12px;
    min-width: 0;
  }
  .upload-card video {
    width: 100%;
    max-height: 300px;
    background: #17131f;
  }
  .filename {
    display: block;
    overflow-wrap: anywhere;
  }
</style>
