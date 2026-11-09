<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="shell masthead-inner">
    <a href="/" class="brand"
      ><img src="/atlas.svg" width="35" height="35" alt="" /> Dog Statue Atlas</a
    >
    <a href="/admin" class="owner-link">Owner area <span aria-hidden="true">↗</span></a>
  </div>
</header>
{@render children()}
