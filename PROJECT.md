# Dog Statue Atlas — Codex project specification

**Status:** Initial build specification (version 1.0)  
**Prepared:** 9 November 2026  
**Intended audience:** OpenAI Codex or any developer implementing the project  
**Default market:** London first, then worldwide  
**Product:** Public dog-statue website plus private, mobile-first content management app

> **Instruction to Codex:** Treat this document as the project brief and source of truth. Implement the smallest complete, secure end-to-end version first. Do not invent missing factual information about statues or publish content to external platforms without an explicit user action. Record any deviations from this brief in `DECISIONS.md`. Do not create paid Azure resources or post to Instagram without explicit approval.

---

## 1. Vision and success criteria

Create a visually appealing, searchable, map-based directory of interesting dog statues and memorials, starting in London and eventually expanding globally. The owner will discover statues, visit them, take photos, research them, and publish entries both to a public website and to an Instagram account.

**Primary principle:** Enter information once and reuse it across the website and Instagram. The app must be exceptionally easy to use on an Android phone, without needing to open GitHub, spreadsheets, Azure or a desktop editor for routine content work.

### Success looks like

1. From a phone, tap **Add statue**, select/take several photos, optionally add a name and location, and **save a draft in under a minute**.
2. Return to the same record later, complete research notes, arrange photos, edit a public description and an Instagram caption, and publish when ready.
3. Publishing to the **website** generates/updates a permanent, indexable public page and makes the statue appear in listings and on a map.
4. Publishing to **Instagram**, when enabled, uses the selected photos and caption without re-entering information. Failed or duplicate publication attempts are visible and manageable.
5. Visiting a statue, editorial readiness, website publication and Instagram publication are **independent states**.
6. The site can run at very low cost on Azure, with source code, database records and media easy to export and move.
7. One owner/admin initially; public browsing needs no account.

### Non-goals for the first release

- A native Android app or Play Store submission.
- Public user accounts, comments, crowd-sourced submissions or complex moderation.
- Automated research or AI-generated historical facts.
- Automated scraping of third-party photos or unlicensed content.
- Video/Reels, Instagram Stories, multi-account social management or paid scheduling services.
- Fully offline synchronisation, push notifications or elaborate analytics.

---

## 2. Users and key journeys

### Owner/admin — Android-first

**A. Quick capture**
1. Open the installed PWA from the Android home screen.
2. Tap prominent `+ Add` button.
3. Choose photos from the phone or invoke camera capture.
4. Enter a name, approximate location and one-line note *if available* (none should prevent draft creation).
5. Tap Save; show a durable confirmation and allow immediate navigation away.
6. New entry appears in the **Inbox/Drafts** queue.

**B. Complete a record**
1. Open a saved draft.
2. Edit title, description, sources, coordinates, address, visit date, photo order, cover image and alt text.
3. Keep private notes distinct from public descriptions.
4. Write or adjust a short Instagram caption independently from website body text.
5. Preview public page and Instagram caption/media selection before publication.

**C. Publish**
1. Website publication is a deliberate, confirmed action, with mandatory validation.
2. Once published, the page gets a stable URL (e.g. `/statues/greyfriars-bobby`, with collision-safe slugs).
3. Instagram publishing is a separate deliberate action, with its own status and result.
4. Editing an existing website entry **updates the page without reposting to Instagram**.
5. Failed social publication can be investigated and retried only when it is safe to do so.

**D. Track discoveries and visits**
1. Store statues discovered online before visiting; they may have no personal photos.
2. Mark visited independently from draft/published status; record visit date and private impressions.
3. View candidates, unvisited places and published places on an admin map/list.

### Public visitor

- Browse a homepage with interesting/latest dog statues and clear London/world navigation.
- Open individual statue pages with photographs, location, description and any relevant attribution/sources.
- Search by name, city or country; filter by location and optionally tags.
- See a map with pins and a linked list; open walking/navigation directions in an external map.
- Use on mobile and desktop without logging in.

---

## 3. Feature priorities

### Phase 1 — Secure, usable MVP (must ship first)

**Private PWA / CMS**
- Entra ID login for a single explicitly allowlisted admin account. Unauthenticated visitors cannot reach private data or mutations.
- Responsive, touch-friendly admin screens: Dashboard, Quick Add, Inbox/Drafts, All Statues, Edit Statue.
- Multiple photo uploads with progress, retry and visible failures; drafts can be created with no title.
- Metadata editing: title, summary, website description, city/country, address, lat/long (manual or map pin), notes, tags, sources, visit status/date.
- Separate website and Instagram text; drafts autosave with visible save state and retry if connection fails.
- Photo order, hero image selection and delete confirmation.
- Website publication/unpublication with stable public page URLs.

**Public site**
- Responsive home/listing/detail pages and a basic map with markers.
- Search by title and place; London-first default, worldwide-ready schema.
- Public photo galleries with alt text and attribution fields.
- Search-engine friendly server rendering, metadata, canonical URL, sitemap and social preview tags.
- Only published records visible to public endpoints, feeds and maps.

**Quality & operations**
- Schema migrations, input validation, reasonable error handling, database and media export, tests for permissions and publication states.
- Infrastructure configuration, local development guide, Azure deployment guide and cost-conscious default settings.

### Phase 2 — Polished capture and editorial workflow

- Better Inbox: discovered, researching, ready, published; bulk tags and filters.
- Mobile photo compression, upload queue/retry, geolocation suggestions with permission and manual correction.
- Map-first admin planning view, nearby/unvisited filters, optional clusters.
- Side-by-side web and Instagram preview; reusable caption templates and hashtags.
- Android PWA **Web Share Target** to accept shared photos/URLs from other apps, where supported. Treat as an enhancement, not a guaranteed system-level share action on every browser.
- Optional richer source organisation and visit log.

### Phase 3 — Direct Instagram publishing (no Make/Zapier)

- Official Meta Instagram API integration, selected only after the account is configured and permissions verified.
- One image and (where supported) carousel publication, with independent caption and photo selection.
- Connection health/token expiration reporting, explicit preview and Publish to Instagram action.
- Durable attempts/audit trail, failure details, carefully controlled retries, provider post ID and permalink.
- No automatic Instagram repost upon subsequent website edits.
- Optional scheduled publishing via Azure Container Apps Jobs (or a similarly inexpensive native Azure scheduled mechanism) **only if needed**.

### Phase 4 — Nice-to-have later

- Assisted transcription/description suggestions; drafts only, never factual claims without sources and approval.
- Custom category pages, advanced geographic filters and route/visit planning.
- Export to GPX/GeoJSON, map imports and richer historical source tracking.
- Offline quick-capture queue with explicit sync conflict handling.
- Multi-user roles if collaborators are added.

---

## 4. Information architecture and UX

### Private routes

- `/admin` — dashboard: add button, recent drafts, unpublished and failed social jobs.
- `/admin/new` — single-screen fast capture; don't demand every field up front.
- `/admin/inbox` — quick-captured or incomplete entries.
- `/admin/statues` — searchable list with statuses, places and tags.
- `/admin/statues/:id` — edit tabs/sections: Overview, Photos, Location, Research, Publishing.
- `/admin/map` — own planning map (Phase 2 if needed).
- `/admin/settings` — Instagram connection (later), export and admin settings.

### Public routes

- `/` — introduction, featured and latest published statues, map/list entry point.
- `/statues` — filters, search, list and map.
- `/statues/:slug` — permanent statue detail page.
- `/places/:slug` or a query filter for cities — optional if useful.
- `/about` — purpose, editorial approach, image/credit policy.
- `/sitemap.xml` and `/robots.txt` — only public content.

### Mobile-first requirements

- One-thumb primary actions; comfortable touch targets and sticky Save/Publish controls.
- Fast photo selection: accept multiple images, show thumbnails immediately, upload in background while editing, show individual progress.
- Save partial records; don't force completion of a long form before capturing a statue.
- Clear statuses and distinct buttons: **Save Draft**, **Publish to Website**, **Post to Instagram**.
- Warn about unsaved edits only if an autosave is still in progress or failed.
- High-contrast accessible UI, keyboard navigation, screen reader labels and sensible empty/loading/error states.
- Installable PWA manifest and icons; responsive browser experience remains first-class.
- Avoid assuming reliable mobile data coverage; network failures must not silently discard an edit.

---

## 5. Data model (Azure SQL / SQL Server)

Use conventional relational tables, stable UUID or ULID identifiers, `created_at`/`updated_at` timestamps in UTC, foreign keys and indexes. Store geographical coordinates as decimal latitude/longitude initially. Do not put image binaries inside SQL. Store media references in SQL and files in Blob Storage.

### `statues`

| Field | Notes |
| --- | --- |
| `id` | Stable primary key. |
| `title` | Nullable during quick capture; required before website publish. |
| `slug` | Unique stable public slug assigned on first publish. Keep redirects/history if renamed. |
| `short_summary`, `web_description` | Public summary and rich text/Markdown description. Sanitize rendering. |
| `instagram_caption` | Independent caption; nullable. |
| `address`, `city`, `region`, `country`, `postal_code` | Flexible geographic fields; `country` preferably ISO code and display name. |
| `latitude`, `longitude` | Nullable decimal coordinates; validate ranges. |
| `sculptor`, `year_created`, `dog_name` | Optional research metadata. Avoid over-structuring uncertain history. |
| `private_notes` | NEVER returned by public APIs. |
| `editorial_status` | `inbox`, `draft`, `ready` (independent of publication). |
| `visit_status` | `unvisited`, `visited` (can be extended later). |
| `web_status` | `unpublished`, `published`, `hidden`. |
| `web_published_at`, `created_at`, `updated_at` | UTC timestamps. |
| `cover_media_id` | Nullable reference to selected image. |

### `media_assets`

`id`, `statue_id`, `blob_key_original`, `blob_key_web`, `blob_key_thumb`, `blob_key_instagram` (nullable), `original_filename`, `mime_type`, `size_bytes`, `width`, `height`, `position`, `alt_text`, `credit`, `rights_status`, `is_eligible_for_instagram`, `created_at`. Keep originals private; transformed public image variants may be public after website publication. Separate publishing eligibility from presence on the site.

### `sources`

`id`, `statue_id`, `url`, `title`, `publisher`, `retrieved_at`, `private_note`, `is_publicly_cited`, `position`.

### `visits`

`id`, `statue_id`, `visited_at`, `private_note`, `created_at`. Keep a history rather than only a single boolean; the current `visit_status` can be derived or cached.

### `tags` and `statue_tags`

For themes such as memorial, sculpture, fictional dog, London borough, etc. Avoid using tags as the sole source of location information.

### `publication_attempts`

`id`, `statue_id`, `destination` (`website` or `instagram`), `operation` (`publish`/`update`/`unpublish`), `status` (`pending`, `in_progress`, `succeeded`, `failed`, `unknown`), `request_key`, `provider_container_id`, `provider_post_id`, `provider_permalink`, `payload_snapshot_json`, `error_summary`, `attempt_count`, `created_at`, `updated_at`, `completed_at`.

An `unknown` Instagram outcome must require reconciliation before retrying; never assume a failed HTTP response means no social post was created.

### `slug_redirects` (if slug changes allowed)

`old_slug`, `statue_id`, `created_at`. Prefer never to change a published slug without a redirect.

### Model constraints

- Separate `editorial_status`, `visit_status`, `web_status` and Instagram publishing state. Do **not** collapse them into one status.
- Keep internal UUID-based relationships distinct from URLs or human-readable titles.
- Ensure one record may contain multiple visits, sources, photos and publishing attempts.
- Public queries explicitly project only publishable columns; don't serialize `private_notes`, private source notes, original media locations or security tokens.
- Record both technical timestamps and optional human-entered dates for statue visits and history.
- All queries parameterised; migrations committed to source control.

---

## 6. Proposed implementation stack

**Default:** A single full-stack **SvelteKit (TypeScript)** application, running as a container, with a responsive PWA front end and server-side API/SSR. Codex may substitute an equivalently maintainable framework, but should explain the trade-off before doing so.

- UI: SvelteKit, TypeScript, modern responsive CSS; minimal dependencies.
- Input: a schema validation library (e.g. Zod), validation server-side and client-side.
- DB: Azure SQL Database (SQL Server/T-SQL), using a maintained Node.js SQL Server driver (e.g. `mssql`) or compatible query layer. **Do not assume PostgreSQL-only ORM features or migrations are available in Azure SQL.**
- DB migrations: versioned, repeatable T-SQL migration scripts, applied separately during deployment and tested before release.
- Files: Azure Blob Storage with an adapter permitting local filesystem or Azurite in development. Blob filenames based on opaque IDs, never user-provided filenames.
- Image processing: generate compressed web display, thumbnail and Instagram-compatible JPEG variants, retaining original only where appropriate. Keep media conversions asynchronous or bounded to avoid request timeouts.
- Maps: Leaflet or MapLibre with a compliant tile provider and attribution. OpenStreetMap data can be used, but **OSM's public tile servers are not an unlimited free production hosting service**; check their tile usage policy. An external map tile endpoint is an explicit optional dependency, not a hidden assumption.
- Deploy: Azure Container Apps Consumption (scale-to-zero initially), separate Azure SQL Free and Azure Blob Storage. Use infrastructure-as-code (Bicep or Terraform) and environment variables/secrets.
- Repository: GitHub with CI for tests and build; source, docs and migrations in git, **not** production images, database records or secrets.

### Security and authentication design

- A single private admin initially. Prefer Microsoft Entra authentication via Azure Container Apps' built-in authentication, configured to allow public requests, while the application **checks the authenticated identity and an explicit allowlist on every `/admin` and private API route**. Platform authentication alone must not turn the public site private, nor should it permit any arbitrary Entra tenant user to become admin.
- Never trust user-supplied identity headers; only trust identity injected by the validated Azure platform boundary. In local development use a separate, explicit dev auth fixture that cannot be enabled in production.
- Authorise every mutation on the server, validate anti-CSRF protections and use secure cookies/same-site policy.
- Use managed identity to access Azure Blob Storage and, where practical, Azure SQL. Apply least-privilege permissions; no static credentials in source control.
- Use short-lived user-delegation SAS tokens (when appropriate) to allow browser uploads directly to Blob Storage; scope by blob, operation, file size/type and expiry. Complete upload in backend only after validating it.
- Originals and draft photos private; public image derivatives available only when approved for public use. Publish-ready media needed by Instagram must be accessible to Meta through a valid HTTPS URL for sufficient processing time.
- Strip EXIF GPS/device metadata from publicly served derivatives by default. GPS for the statue location can be manually entered or explicitly extracted with consent.
- Escape/sanitize public rich text, validate uploaded file signatures and sizes, rate-limit sensitive endpoints, redact secrets from logs and use HTTPS everywhere.

---

## 7. Website publishing behaviour

- Draft save persists content immediately, but does **not** expose it on public pages.
- Publishing requires a non-empty title, an appropriate location (at least city/country or validated coordinates), approved body text and at least one publishable photo **unless explicitly waived in the UI**.
- First publication creates a stable slug. Later edits update the same record/page.
- Unpublishing hides public detail, listings, maps and sitemap entries; return suitable HTTP status, while keeping private content and media in storage.
- Public photos require alt text or auto-generated neutral placeholder with the editor prompted to correct it; rights/credit metadata must be available.
- Server-render public pages for search engines. Set page title, description, canonical URL, Open Graph image and schema.org structured data only where accurate.
- No public index of drafts, private notes or unreleased media.

---

## 8. Direct Instagram integration (Phase 3)

Implement against **Meta's official Instagram API**. Do not add Make, Zapier, Buffer or another third-party social automation platform as a requirement.

### Preconditions

- Owner has an Instagram **Professional** account (Business or Creator as currently supported).
- Create/configure a Meta app and select the supported Instagram Login or Facebook Login path; permissions, account linkage and review requirements differ. Verify the *current* official documentation before implementation.
- For Instagram Login, relevant permission names include `instagram_business_basic` and `instagram_business_content_publish`; for Facebook Login, permissions differ (such as `instagram_content_publish`). Don't hard-code a dated authentication flow without verifying it.
- Test initially on the owner's connected account within the capabilities of the app's access level. Do not imply that the app is approved for arbitrary accounts without review.

### Publishing requirements

- User selects Instagram photos, order and caption independently from the public website body.
- Preview destination, then explicit confirmation to post. No surprise cross-posts when a website record is edited.
- Create media containers via Meta, wait/check processing state as necessary, then publish. Multiple-image carousel requires the supported child-container workflow.
- Supply HTTPS media URLs Meta can fetch; generated Instagram image derivatives should conform to Meta's current aspect ratio, dimension, file-format and size requirements. Don't expose private originals.
- Persist full state for each attempt, but never store tokens in public fields or plaintext logs. Save provider IDs/permalinks on success.
- Rate-limit and handle expired tokens. Display actionable errors to admin. Do **not** automatically retry a post with uncertain outcome; reconcile via provider status first.
- Scheduled posting is optional; if implemented, use an Azure-native scheduled job and durable DB queue, not an in-process timer in a scale-to-zero web container.

### Manual fallback

Before direct API publishing is complete, provide a **Copy Instagram Caption** action and a convenient download/share path for selected images. The rest of the system must remain useful without Meta credentials.

---

## 9. Azure infrastructure and cost constraints

### Proposed initial resources

1. **Azure Container Apps — Consumption:** One public SvelteKit container exposing both public website and authenticated admin routes. Set `minReplicas: 0` and low memory/CPU sizes if acceptable; tolerate occasional cold starts. No dedicated workload profile, minimum always-on instance or custom VNet without justification.
2. **Azure SQL Database — eligible free tier:** Relational metadata and publishing state. Select the recurring free offer **explicitly**; a normal serverless SQL database is not automatically free. Prefer the free-limit mode that pauses after quota instead of billing extra while prototyping. This can make the live site temporarily unavailable if limits are reached, so reconsider before public launch.
3. **Azure Blob Storage — standard general-purpose v2, Hot LRS initially:** private originals and public resized images. Storage, operations and egress are usage-billed even if modest.
4. **Container image registry:** Use an inexpensive compatible registry and document its actual cost. Azure Container Registry Basic is not assumed free. Reusing GitHub Container Registry may be cheaper but adds a narrowly scoped external deployment dependency.
5. **DNS/domain:** Existing domain or a new one (optional during prototyping); enable managed HTTPS.
6. **Monitoring:** Start with minimal retention/logging; avoid unnecessary costly Log Analytics, distributed tracing or alert volume. Implement health checks and enough exception logs to diagnose failures.

### Cost safeguards

- Show an estimated recurring cost and SKU details **before** creating cloud resources. User must approve paid resources.
- Set an Azure budget alert; explain that an alert **does not enforce a spending cap**.
- Avoid unexpected charges from ACR, Log Analytics, data egress, private networking, container always-on replicas, outbound IP/NAT, backup retention and paid database SKUs.
- Region: prefer **UK South** if services and desired SKUs are available; validate actual availability/quotas.
- Support local development without provisioning billable cloud resources.
- Give user a safe `destroy-dev` guide and clear separation of development vs production data.

### Database free-tier note (verify on deployment)

Azure SQL's documented free tier currently includes **100,000 vCore-seconds, 32 GB data and 32 GB backup storage per month**, with explicit free-tier configuration and a choice to pause when limits are exhausted. Quotas, eligibility and pricing can change. The free offer has restrictions and is described by Microsoft primarily for development/proof-of-concept use, with no SLA.

### Portability

Use standard SQL schema/migrations where possible, isolate cloud-specific services behind adapters, and provide JSON/CSV exports. Do not rely on an opaque low-code platform or features that prevent migration. Design so a future move to a VPS or NAS remains feasible with manageable changes.

---

## 10. Backup, export and operations

- Implement owner-triggered export of all statue metadata to JSON and CSV (including publication history and photo manifest). No secrets in export.
- Provide a tested media export mechanism (ZIP for modest datasets, or download manifest/script for larger ones).
- Document database backup/restore constraints for the chosen Azure SQL tier; don't promise that a free-tier database can be restored as another free-tier DB automatically.
- Recommend periodic encrypted copies of metadata and original photos to independent storage (the owner's Synology NAS may be used later) and an actual restore drill.
- Protect against accidental deletion with a confirmation/soft-delete approach for statues and storage cleanup grace periods.
- Keep `README.md` with local setup, env-var reference, commands, deployment, backup, recovery and operational troubleshooting.

---

## 11. Testing and acceptance criteria

Automated tests should cover:

- CRUD and input validation, including untitled quick drafts.
- Public API never returns draft/hidden records or private columns.
- Unauthenticated and non-allowlisted users cannot access `/admin` or mutate anything.
- Uploads reject unsupported file types, huge files and unexpected signatures; retry/reconcile incomplete uploads.
- Multiple photos correctly retain order and chosen cover image.
- Website publish/unpublish is reflected on direct URLs, map, search and sitemap.
- Slug remains stable; no duplicate URL for title collisions.
- Changes to website copy do **not** trigger Instagram publication.
- Publication attempts are idempotent where possible; unknown social outcomes aren't blindly retried.
- Browser smoke tests at narrow Android screen size and desktop width.
- Accessibility checks for navigation and form labels.
- Cloud deployment is reproducible from a clean environment without hand editing resources.

### Hands-on MVP acceptance script

1. On Android, install/open the PWA, authenticate, capture three photos, enter a two-word note, and save as draft.
2. Close the browser, reopen, and confirm the photos and notes persist.
3. Reorder photos; add pin/location, website description, source link and visit date.
4. Confirm the draft is not publicly visible or indexed.
5. Publish to website; open the public statue page without login on a second device and verify cover photo, gallery, body and map pin.
6. Edit the description, save, reload the public page and verify same URL and updated text.
7. Mark as unvisited/visited and confirm this doesn't change publication state.
8. Export data and demonstrate recovery of at least one record in a test environment.
9. Before Phase 3, copy the Instagram caption and export selected images without needing to retype them.

**Definition of done for Phase 1:** The above script passes, code is in git, tests pass, deployment and backup instructions exist, and a current estimated Azure monthly cost is documented.

---

## 12. Implementation plan for Codex

### Milestone 0 — Repository foundation

- Create SvelteKit TypeScript app, README, environment template, formatting, linting and test harness.
- Define SQL schema and migrations; storage adapters; seeded fictitious/test records only (not fabricated historical facts on public pages).
- Build Bicep/Terraform infrastructure draft but **do not provision paid infrastructure**.
- Document selected identity and media handling plan.

### Milestone 1 — First usable vertical slice

- Private admin login/authorization.
- Phone-friendly Quick Add, upload and autosaving draft.
- Database persistence and blob storage (local emulator for development).
- Edit record and photos.
- One public statue detail page behind publication state.
- Tests demonstrating private/public separation.

### Milestone 2 — Public directory and deployment

- Homepage, list/search, map and SEO.
- Website publish/unpublish workflow, validation, stable slugs and basic admin status dashboard.
- Azure deployment with chosen free/low-cost SKUs; cost review first.
- Export/backups and handover documentation.

### Milestone 3 — Capture polish

- Better admin statuses/filtering, sources/visits, batch photo editing, map pin picker, PWA installation and (where supported) Web Share Target.
- Image processing optimization and touch usability tests on Android.

### Milestone 4 — Instagram

- Meta account connection/permissions and test post in a controlled environment.
- Publish photo/carousel with caption, durable attempt tracking, safe retry/reconciliation, disconnect/reconnect UI.
- Only then add optional scheduling.

### Proposed repository layout

```text
/
  PROJECT.md
  README.md
  DECISIONS.md
  .env.example
  src/
    routes/                   # public SvelteKit routes
    routes/admin/             # private CMS pages
    routes/api/               # public and secured API endpoints
    lib/server/db/            # SQL Server access and repositories
    lib/server/storage/       # Blob/local adapters
    lib/server/auth/          # auth and allowlist guards
    lib/server/publishing/    # web and Instagram publishing
    lib/components/           # reusable responsive UI components
  migrations/                 # numbered T-SQL migration scripts
  infra/                      # Azure Bicep or Terraform
  scripts/                    # export, setup, migrations, maintenance
  tests/                      # unit/integration/e2e
  Dockerfile
```

### Decision rules for Codex

- Prefer a working, tested vertical slice to an elaborate but unconnected scaffold.
- No deployment or paid cloud resource creation without approval. No Instagram post without explicit approval.
- Don't require proprietary AI APIs or subscriptions for core functionality.
- Use secure defaults. Avoid writing custom authentication if a well-maintained platform mechanism meets the requirements.
- Ask only about genuinely blocking choices (e.g. domain, Azure subscription, Meta account); otherwise document a sensible default in `DECISIONS.md` and proceed.
- Preserve portability and readable code; avoid unnecessary microservices.
- Show changed files, tests run, any Azure costs/permissions required, and the next milestone after each phase.

---

## 13. Current assumptions to confirm when connecting real services

These are not blockers for building locally:

- Final brand/site name and domain are not yet selected: use **Dog Statue Atlas** as a working title, easy to change.
- Admin will initially be a single owner using a Microsoft account/Entra identity; capture exact allowlist identifier during configuration rather than hard-coding a personal address.
- Azure subscription/tenant and resource group are not yet connected.
- The Instagram account may need conversion to Professional and API access configured; assume this is **not ready** until verified.
- London is the initial content focus, but data model and public navigation should support all countries.
- Public site will display owner-supplied photos or explicitly licensed/attributed images, not automatically sourced copyrighted images.
- Decide branding, logo and exact visual design after functional first cut; choose an uncluttered, image-led mobile-first look for now.

---

## 14. References for implementation — verify latest before deployment

- Azure Container Apps billing/free allowance: https://learn.microsoft.com/en-us/azure/container-apps/billing
- Azure Container Apps authentication: https://learn.microsoft.com/en-us/azure/container-apps/authentication
- Azure Container Apps + Entra: https://learn.microsoft.com/en-us/azure/container-apps/authentication-entra
- Azure Container Apps managed identity: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity
- Azure Container Apps scheduled jobs: https://learn.microsoft.com/en-us/azure/container-apps/jobs
- Azure SQL free tier: https://learn.microsoft.com/en-us/azure/azure-sql/database/free-tier
- Azure SQL free-tier FAQ: https://learn.microsoft.com/en-us/azure/azure-sql/database/free-tier-faq
- Azure Storage security recommendations: https://learn.microsoft.com/en-us/azure/storage/blobs/security-recommendations
- Meta Instagram API official Postman documentation: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- Meta Instagram with Instagram Login: https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login

---

## 15. Copy-paste first instruction to Codex

> Read `PROJECT.md` in full and treat it as the product specification. Start with **Milestones 0 and 1 only**: create a clean, mobile-first SvelteKit/TypeScript app with SQL Server-compatible data access, safe local media storage emulation, secure admin access boundaries, quick photo capture, autosaved drafts, and a first public statue detail page whose visibility is controlled by website publishing status. Use local development tools and mocks where Azure/Meta credentials are not configured. Build actual working flows and tests, not just design mockups. Document assumptions in `DECISIONS.md`, write `README.md` with exact run commands, and show me how to test the Android-sized UI. Prepare but **do not create** Azure resources, incur costs, or publish to Instagram until I explicitly approve. After completing the first vertical slice, summarise what works, tests passing, outstanding decisions and the next sensible step.
