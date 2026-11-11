<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
  let place = $derived(
    [data.statue.city, data.statue.region, data.statue.country].filter(Boolean).join(', '),
  );
  let location = $derived(
    data.statue.latitude !== null && data.statue.longitude !== null
      ? data.statue.latitude + ',' + data.statue.longitude
      : [data.statue.address, place, data.statue.postal_code].filter(Boolean).join(', '),
  );
</script>

<svelte:head>
  <title>{data.statue.title} · Dog Statue Atlas</title>
  {#if data.statue.short_summary}<meta
      name="description"
      content={data.statue.short_summary}
    />{/if}
</svelte:head>
<main id="main" class="shell main public-record">
  <a class="back" href="/">← Atlas home</a>
  <p class="eyebrow">{place || 'Statue record'}</p>
  <h1>{data.statue.title}</h1>
  {#if data.statue.short_summary}<p class="lede">{data.statue.short_summary}</p>{/if}
  {#if data.cover}
    <figure class="cover">
      <img
        src={'/media/' + data.cover.id}
        alt={data.cover.alt_text || 'Photo of ' + data.statue.title}
        width={data.cover.width}
        height={data.cover.height}
      />
      {#if data.cover.credit}<figcaption>{data.cover.credit}</figcaption>{/if}
    </figure>
  {/if}
  <div class="story">{data.statue.web_description}</div>
  {#if location}
    <section class="panel public-location">
      <h2>Find the statue</h2>
      <p>
        {[data.statue.address, place, data.statue.postal_code].filter(Boolean).join(', ') ||
          location}
      </p>
      <a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location)}
        >Open in maps ↗</a
      >
    </section>
  {/if}
  {#if data.photos.length > 1}
    <section>
      <h2>Gallery</h2>
      <div class="gallery">
        {#each data.photos.filter((photo) => photo.id !== data.cover?.id) as photo (photo.id)}
          <figure>
            <img
              src={'/media/' + photo.id}
              alt={photo.alt_text || 'Photo of ' + data.statue.title}
              width={photo.width}
              height={photo.height}
              loading="lazy"
            />
            {#if photo.credit}<figcaption>{photo.credit}</figcaption>{/if}
          </figure>
        {/each}
      </div>
    </section>
  {/if}
</main>
