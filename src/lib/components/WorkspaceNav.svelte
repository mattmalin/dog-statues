<script lang="ts">
  import { page } from '$app/state';
</script>

<nav class="workspace-nav" aria-label="Owner area">
  <a aria-current={page.url.pathname === '/admin' ? 'page' : undefined} href="/admin">Workspace</a>
  <a aria-current={page.url.pathname === '/admin/inbox' ? 'page' : undefined} href="/admin/inbox"
    >Inbox</a
  >
  <a
    aria-current={page.url.pathname === '/admin/statues' ? 'page' : undefined}
    href="/admin/statues">All statues</a
  >
</nav>
