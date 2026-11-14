<script lang="ts">
  import type { Photo } from '$lib/model';
  import { cropBounds, defaultCrop, type SquareCrop } from '$lib/instagram';

  let {
    photo,
    src,
    crop,
    onchange,
  }: {
    photo: Photo;
    src: string;
    crop: SquareCrop;
    onchange: (crop: SquareCrop) => void;
  } = $props();

  const bounds = $derived(cropBounds(photo.width, photo.height, crop));
</script>

<div class="square">
  <img
    {src}
    alt={photo.alt_text}
    loading="lazy"
    style:width={(100 * photo.width) / bounds.width + '%'}
    style:left={(-100 * bounds.left) / bounds.width + '%'}
    style:top={(-100 * bounds.top) / bounds.width + '%'}
  />
</div>
<label
  >Zoom<input
    type="range"
    min="1"
    max="3"
    step="0.01"
    value={crop.zoom}
    oninput={(event) => onchange({ ...crop, zoom: event.currentTarget.valueAsNumber })}
  /></label
>
<label
  >Horizontal position<input
    type="range"
    min="0"
    max="100"
    value={crop.x}
    disabled={bounds.width === photo.width}
    oninput={(event) => onchange({ ...crop, x: event.currentTarget.valueAsNumber })}
  /></label
>
<label
  >Vertical position<input
    type="range"
    min="0"
    max="100"
    value={crop.y}
    disabled={bounds.height === photo.height}
    oninput={(event) => onchange({ ...crop, y: event.currentTarget.valueAsNumber })}
  /></label
>
<button type="button" class="secondary" onclick={() => onchange(defaultCrop)}>Reset crop</button>

<style>
  .square {
    position: relative;
    aspect-ratio: 1;
    max-width: 20rem;
    overflow: hidden;
  }
  img {
    position: absolute;
    max-width: none;
    height: auto;
  }
</style>
