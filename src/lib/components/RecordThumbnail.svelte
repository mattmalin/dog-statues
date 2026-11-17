<script lang="ts">
  let { src }: { src?: string | null } = $props();
  let failed = $state(false);
  $effect(() => {
    void src;
    failed = false;
  });
</script>

<span class="thumbnail" aria-hidden="true">
  {#if src && !failed}
    <img
      {src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      onerror={() => {
        failed = true;
      }}
    />
  {:else}<span>◇</span>{/if}
</span>

<style>
  .thumbnail {
    width: 56px;
    height: 56px;
    flex: 0 0 56px;
    overflow: hidden;
    border-radius: 8px;
    background: var(--wash);
    display: grid;
    place-items: center;
    color: var(--muted);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
