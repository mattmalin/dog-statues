<script lang="ts">
  import DraftList from '$lib/components/DraftList.svelte';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<DraftList {...data} view="workspace" />
