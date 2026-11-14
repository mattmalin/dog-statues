<script lang="ts">
  import copy from '$lib/public-copy.json';
  import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · {copy.site.name}</title></svelte:head>
<main id="main" class="shell main">
  <p class="eyebrow">{copy.site.name} · {page.status}</p>
  <h1>{page.status === 404 ? copy.error.missing : copy.error.other}</h1>
  <p>{page.error?.message}</p>
  <a class="button secondary" href="/">{copy.error.home}</a>
</main>
