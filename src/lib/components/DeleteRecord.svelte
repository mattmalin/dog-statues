<script lang="ts">
  import { onMount } from 'svelte';
  import { message } from '$lib/client';
  let {
    name,
    label,
    explanation,
    disabled = false,
    ondelete,
  }: {
    name: string;
    label: string;
    explanation: string;
    disabled?: boolean;
    ondelete: () => Promise<void>;
  } = $props();
  let ready = $state(false);
  let busy = $state(false);
  let failure = $state('');
  onMount(() => {
    ready = true;
  });
  async function remove() {
    if (!ready || disabled || busy) return;
    failure = '';
    if (!confirm(`${label}: “${name}”?\n\n${explanation}\n\nThis cannot be undone in the app.`))
      return;
    busy = true;
    try {
      await ondelete();
    } catch (cause) {
      failure = message(cause);
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel delete-record" aria-label="Delete record">
  <h2>Delete record</h2>
  <p>{explanation}</p>
  <button
    type="button"
    class="secondary danger"
    disabled={!ready || disabled || busy}
    onclick={remove}>{busy ? 'Deleting…' : label}</button
  >
  {#if failure}<p role="alert" class="error">{failure}</p>{/if}
</section>

<style>
  .delete-record {
    margin-top: 1.5rem;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
</style>
