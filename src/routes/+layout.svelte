<script lang="ts">
  import copy from '$lib/public-copy.json';
  import '../app.css';
  let { children } = $props();
</script>

<a class="skip" href="#main">{copy.site.skip}</a>
<header class="masthead">
  <div class="shell masthead-inner">
    <a href="/" class="brand"
      ><img src="/atlas.svg" width="35" height="35" alt="" /> {copy.site.name}</a
    >
    <a href="/admin" class="owner-link">{copy.site.owner} <span aria-hidden="true">↗</span></a>
  </div>
</header>
{@render children()}
