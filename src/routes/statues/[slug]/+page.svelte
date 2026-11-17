<script lang="ts">
  import StatuePage from '$lib/components/StatuePage.svelte';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<StatuePage {data} />
