<script lang="ts">
  import copy from '$lib/public-copy.json';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{copy.site.name}</title>
  <link rel="alternate" type="application/rss+xml" title={copy.site.name} href="/rss.xml" />
  <meta name="description" content={copy.home.metadataDescription} />
</svelte:head>
<main id="main" class="shell main">
  <section class="intro">
    <h1>{copy.home.heading}</h1>
    <p class="lede">{copy.home.introduction}</p>
  </section>
  <section class="directory" aria-labelledby="directory-heading">
    <h2 id="directory-heading">{copy.home.directory}</h2>
    <p><a href="/rss.xml">{copy.home.subscribe}</a></p>
    {#if data.statues.length}
      <ul>
        {#each data.statues as statue (statue.slug)}
          {@const place = [statue.city, statue.region, statue.country].filter(Boolean).join(', ')}
          <li>
            {#if statue.photo_id}
              <img
                class="thumbnail"
                src={'/media/' + statue.photo_id + '?size=thumb'}
                alt={statue.alt_text || copy.site.photoAltPrefix + statue.title}
                width="480"
                height="300"
                loading="lazy"
              />
            {/if}
            <div class="card-copy">
              {#if place}<p class="place">{place}</p>{/if}
              <h3><a href={'/statues/' + statue.slug}>{statue.title}</a></h3>
              {#if statue.short_summary}<p>{statue.short_summary}</p>{/if}
              {#if statue.photo_id && statue.credit}<p class="credit">{statue.credit}</p>{/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="lede">{copy.home.empty}</p>
    {/if}
  </section>
</main>

<style>
  .directory {
    margin-top: 2rem;
  }
  .directory ul {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    gap: 1rem;
    list-style: none;
    padding: 0;
    margin: 1rem 0 0;
  }
  .directory li {
    position: relative;
    max-width: 32rem;
    border: 1px solid var(--line);
    border-radius: 1rem;
    background: var(--paper);
    overflow-wrap: anywhere;
  }
  .thumbnail {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 8 / 5;
    object-fit: cover;
    border-radius: 1rem 1rem 0 0;
  }
  .card-copy {
    padding: 1rem;
  }
  .card-copy h3 {
    margin: 0;
  }
  .card-copy a::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 1rem;
  }
  .card-copy p {
    margin: 0.45rem 0 0;
  }
  .card-copy .place {
    margin: 0 0 0.3rem;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .card-copy .credit {
    font-size: 0.75rem;
    color: var(--muted);
  }
</style>
