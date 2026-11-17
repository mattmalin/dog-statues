<script lang="ts">
  import { onMount } from 'svelte';
  import { researchUrl, type PotentialImage } from '$lib/potential';
  let { images = $bindable(), onedit }: { images: PotentialImage[]; onedit: () => void } = $props();
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });
  function add() {
    images = [
      ...images,
      { id: crypto.randomUUID(), image_url: '', source_url: '', credit: '', reuse_notes: '' },
    ];
    onedit();
  }
  function first(index: number) {
    images = [images[index], ...images.filter((_, i) => i !== index)];
    onedit();
  }
</script>

<section class="panel research-images" aria-labelledby="research-images-heading">
  <h2 id="research-images-heading">Research images</h2>
  <p>
    Save a direct image link and its source page. The first image is used as the catalogue
    thumbnail. These links stay in the private catalogue; check permission before reusing an image
    publicly.
  </p>
  <input type="hidden" name="images" value={JSON.stringify(images)} />
  {#each images as image, index (image.id)}
    <fieldset>
      <legend>Image {index + 1}{index === 0 ? ' · Thumbnail' : ''}</legend>
      {#if researchUrl(image.image_url, true)}
        <img
          class="research-preview"
          src={image.image_url}
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
        />
      {/if}
      <label
        >Image URL<input type="url" required maxlength="2048" bind:value={image.image_url} /></label
      >
      <label
        >Source page<input
          type="url"
          required
          maxlength="2048"
          bind:value={image.source_url}
        /></label
      >
      {#if researchUrl(image.source_url)}<a
          href={image.source_url}
          target="_blank"
          rel="noopener noreferrer">Open image source ↗</a
        >{/if}
      <label>Credit or photographer<input maxlength="500" bind:value={image.credit} /></label>
      <label
        >Licence or permission notes<textarea
          rows="3"
          maxlength="1500"
          bind:value={image.reuse_notes}
        ></textarea></label
      >
      <div class="button-row">
        {#if index > 0}<button
            type="button"
            class="secondary"
            disabled={!ready}
            onclick={() => first(index)}>Use as thumbnail</button
          >{/if}
        <button
          type="button"
          class="secondary"
          disabled={!ready}
          onclick={() => {
            images = images.filter((_, i) => i !== index);
            onedit();
          }}>Remove image link</button
        >
      </div>
    </fieldset>
  {/each}
  <button type="button" class="secondary" disabled={!ready || images.length >= 24} onclick={add}
    >Add image link</button
  >
  <p class="hint">
    Save the potential statue to keep image changes. Online images can move or disappear; the source
    and credit remain saved.
  </p>
</section>

<style>
  fieldset {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1rem;
    margin: 1rem 0;
  }
  label {
    margin: 0.8rem 0;
  }
  .research-preview {
    display: block;
    max-width: 100%;
    max-height: 260px;
    object-fit: contain;
    border-radius: 8px;
  }
</style>
