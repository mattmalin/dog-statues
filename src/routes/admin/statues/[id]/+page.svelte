<script lang="ts">
  import Editor from '$lib/components/Editor.svelte';
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

{#key data.statue.id}
  <Editor {...data} />
{/key}
