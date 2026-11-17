<script lang="ts">
  import StatuePage from '$lib/components/StatuePage.svelte';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<div class="shell">
  <p>Private preview · Saved draft</p>
  <a class="button secondary" href={'/admin/statues/' + data.id}>Back to editor</a>
</div>
<StatuePage {data} />
