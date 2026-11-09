<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Dog Statue Atlas</title></svelte:head>
<main id="main" class="shell main">
  <p class="eyebrow">Dog Statue Atlas · {page.status}</p>
  <h1>{page.status === 404 ? 'This page is unavailable' : 'Something went wrong'}</h1>
  <p>{page.error?.message}</p>
  <a class="button secondary" href="/">Back to the Atlas</a>
</main>
