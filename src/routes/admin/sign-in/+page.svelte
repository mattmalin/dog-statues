<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Owner sign-in · Dog Statue Atlas</title></svelte:head>
<main id="main" class="shell main">
  <p class="eyebrow">Private workspace</p>
  <h1>Owner sign-in</h1>
  {#if data.local}
    <form method="POST" use:enhance class="panel login">
      <label
        >Local passphrase<input
          required
          type="password"
          name="password"
          autocomplete="current-password"
          maxlength="512"
        /></label
      >
      {#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
      <button>Sign in</button>
    </form>
  {:else if data.entra}
    <p>Sign in with the Microsoft account configured for this Atlas.</p>
    <a class="button" href="/.auth/login/aad?post_login_redirect_uri=%2Fadmin"
      >Sign in with Microsoft</a
    >
  {:else}
    <p>Owner access needs to be configured. See the setup guide.</p>
  {/if}
</main>
