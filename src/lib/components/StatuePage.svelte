<script lang="ts">
  import copy from '$lib/public-copy.json';
  import { googleMapsUrl } from '$lib/maps';
  import type { getPreview } from '$lib/server/statues';
  let { data }: { data: Awaited<ReturnType<typeof getPreview>> } = $props();
  let place = $derived(
    [data.statue.city, data.statue.region, data.statue.country].filter(Boolean).join(', '),
  );
  let location = $derived(
    data.statue.latitude !== null && data.statue.longitude !== null
      ? data.statue.latitude + ',' + data.statue.longitude
      : [data.statue.address, place, data.statue.postal_code].filter(Boolean).join(', '),
  );
  const photoUrl = (id: string) =>
    data.preview ? '/api/admin/statues/' + data.id + '/photos/' + id + '?size=web' : '/media/' + id;
  const pin = $derived(googleMapsUrl(data.statue.google_maps_url)?.href);
  const videoUrl = (id: string) =>
    data.preview ? '/api/admin/statues/' + data.id + '/videos/' + id : '/videos/' + id;
</script>

<svelte:head>
  <title>{data.statue.title} · {copy.site.name}</title>
  {#if data.statue.short_summary}<meta
      name="description"
      content={data.statue.short_summary}
    />{/if}
</svelte:head>
<main id="main" class="shell main public-record">
  <a class="back" href="/">← {copy.statue.home}</a>
  <p class="eyebrow">{place || copy.statue.record}</p>
  <h1>{data.statue.title}</h1>
  {#if data.statue.short_summary}<p class="lede">{data.statue.short_summary}</p>{/if}
  {#if data.cover}
    <figure class="cover">
      <img
        src={photoUrl(data.cover.id)}
        alt={data.cover.alt_text || copy.site.photoAltPrefix + data.statue.title}
        width={data.cover.width}
        height={data.cover.height}
      />
      {#if data.cover.credit}<figcaption>{data.cover.credit}</figcaption>{/if}
    </figure>
  {/if}
  <div class="story">{data.statue.web_description}</div>
  {#if location || pin}
    <section class="panel public-location">
      <h2>{copy.statue.location}</h2>
      {#if location}<p>
          {[data.statue.address, place, data.statue.postal_code].filter(Boolean).join(', ') ||
            location}
        </p>{/if}
      <a
        href={pin ??
          'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location)}
        >{copy.statue.maps} ↗</a
      >
    </section>
  {/if}
  {#if data.photos.length > 1 || data.videos.length}
    <section>
      <h2>{copy.statue.gallery}</h2>
      <div class="gallery">
        {#each data.photos.filter((photo) => photo.id !== data.cover?.id) as photo (photo.id)}
          <figure>
            <img
              src={photoUrl(photo.id)}
              alt={photo.alt_text || copy.site.photoAltPrefix + data.statue.title}
              width={photo.width}
              height={photo.height}
              loading="lazy"
            />
            {#if photo.credit}<figcaption>{photo.credit}</figcaption>{/if}
          </figure>
        {/each}
        {#each data.videos as video (video.id)}
          <figure>
            <video
              controls
              playsinline
              preload="none"
              src={videoUrl(video.id)}
              poster={videoUrl(video.id) + '?size=poster'}
              width={video.width}
              height={video.height}
              aria-label={video.description || data.statue.title}
            >
              <track
                kind="captions"
                src={videoUrl(video.id) + '?captions=1'}
                srclang="en"
                label={video.description || data.statue.title}
              />
            </video>
            {#if video.description || video.credit}<figcaption>
                {video.description}{video.description && video.credit ? ' · ' : ''}{video.credit}
              </figcaption>{/if}
          </figure>
        {/each}
      </div>
    </section>
  {/if}
</main>

<style>
  video {
    display: block;
    width: 100%;
    height: auto;
    max-height: 75svh;
    background: #17131f;
    border-radius: 12px;
  }
</style>
