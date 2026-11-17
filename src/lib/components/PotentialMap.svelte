<script lang="ts">
  import { onMount } from 'svelte';
  import type * as Leaflet from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { PotentialMapRow } from '$lib/potential-map';
  import { potentialStatuses } from '$lib/potential';

  let { rows }: { rows: PotentialMapRow[] } = $props();
  let container: HTMLDivElement;
  let ready = $state(false);
  let failure = $state('');
  let tilesFailed = $state(false);
  let map: Leaflet.Map;
  let library: typeof Leaflet;
  let markers: Leaflet.LayerGroup;
  const located = $derived(rows.filter((row) => row.map_location));
  const missing = $derived(rows.filter((row) => !row.map_location));
  const approximate = $derived(located.filter((row) => row.map_location?.approximate).length);

  function fit() {
    if (!map || !library) return;
    if (!located.length) map.setView([51.507, -0.128], 10);
    else
      map.fitBounds(
        library.latLngBounds(
          located.map((row) => [row.map_location!.latitude, row.map_location!.longitude]),
        ),
        { padding: [36, 36], maxZoom: 16, animate: false },
      );
  }

  function renderMarkers() {
    if (!map || !library) return;
    markers.clearLayers();
    // Group nearby points in screen-sized cells; identical venue/postcode points stay accessible.
    const groups = new Map<string, PotentialMapRow[]>();
    for (const row of located) {
      const point = map.project([row.map_location!.latitude, row.map_location!.longitude]);
      const key = Math.floor(point.x / 48) + ':' + Math.floor(point.y / 48);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const latitude =
        group.reduce((sum, row) => sum + row.map_location!.latitude, 0) / group.length;
      const longitude =
        group.reduce((sum, row) => sum + row.map_location!.longitude, 0) / group.length;
      const approximateOnly = group.every((row) => row.map_location!.approximate);
      const label =
        group.length > 1
          ? `${group.length} potential statues — open locations`
          : `${group[0].name} — ${group[0].map_location!.description}`;
      const icon = library.divIcon({
        className: 'potential-pin' + (approximateOnly ? ' potential-pin-approximate' : ''),
        html: group.length > 1 ? String(group.length) : '●',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const content = document.createElement('div');
      content.className = 'potential-map-popup';
      if (group.length > 1) {
        const zoom = document.createElement('button');
        zoom.type = 'button';
        zoom.textContent = 'Zoom to these locations';
        zoom.onclick = () =>
          map.fitBounds(
            library.latLngBounds(
              group.map((row) => [row.map_location!.latitude, row.map_location!.longitude]),
            ),
            { padding: [44, 44], maxZoom: 18, animate: false },
          );
        content.append(zoom);
      }
      for (const row of group) {
        const item = document.createElement('div');
        const link = document.createElement('a');
        link.href = '/admin/potential/' + encodeURIComponent(row.id);
        link.textContent = row.name;
        const detail = document.createElement('p');
        detail.textContent = `${potentialStatuses[row.status]} · ${row.map_location!.description}`;
        item.append(link, detail);
        if (row.map_location!.source_url) {
          const source = document.createElement('a');
          source.textContent = 'Location source ↗';
          source.href = row.map_location!.source_url!;
          source.target = '_blank';
          source.rel = 'noopener noreferrer';
          item.append(source);
        }
        content.append(item);
      }
      library
        .marker([latitude, longitude], { icon, title: label, alt: label, keyboard: true })
        .bindPopup(content, {
          maxWidth: Math.max(160, Math.min(280, map.getSize().x - 96)),
          maxHeight: 250,
          autoPanPaddingTopLeft: library.point(58, 12),
          autoPanPaddingBottomRight: library.point(12, 12),
        })
        .addTo(markers);
    }
  }

  onMount(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    import('leaflet')
      .then((module) => {
        if (disposed) return;
        library = module;
        map = library
          .map(container, { scrollWheelZoom: false, worldCopyJump: true })
          .setView([51.507, -0.128], 10);
        markers = library.layerGroup().addTo(map);
        library
          .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          })
          .on('tileerror', () => {
            tilesFailed = true;
          })
          .addTo(map);
        map.on('zoomend', renderMarkers);
        resize = new ResizeObserver(() => map.invalidateSize());
        resize.observe(container);
        ready = true;
      })
      .catch(() => {
        if (!disposed) failure = 'The map could not load. You can still use the list below.';
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      map?.remove();
    };
  });

  $effect(() => {
    if (!ready) return;
    // Reading the filtered rows here updates the map when search or filters change.
    void located;
    fit();
    renderMarkers();
  });
</script>

<section class="catalogue-map" aria-labelledby="potential-map-heading">
  <div class="heading-row">
    <h2 id="potential-map-heading">Map</h2>
    <button type="button" class="secondary" onclick={fit} disabled={!ready || !located.length}
      >Fit results</button
    >
  </div>
  <p class="hint" data-testid="map-count">
    {located.length} of {rows.length} shown on map · {approximate} approximate locations.
  </p>
  <p class="hint">
    Outlined markers use approximate postcode or researched locations, which may cover a broad area.
    Saved coordinates take priority. Tap a numbered marker to see every entry there; zoom in to
    separate nearby locations. Choose All above to include archived entries.
  </p>
  <div
    class="map-canvas"
    bind:this={container}
    role="region"
    aria-label="Potential statues map"
    data-ready={ready}
  ></div>
  {#if failure}<p role="alert">{failure}</p>{/if}
  {#if tilesFailed}<p class="hint">
      Some map tiles could not load. Markers and the list are still available.
    </p>{/if}
  <noscript
    ><p>
      Enable JavaScript to use the map. All entries remain available in the list below.
    </p></noscript
  >
  {#if missing.length}
    <details>
      <summary>{missing.length} entries need coordinates</summary>
      <p>Open an entry to import a Google Maps pin or enter latitude and longitude.</p>
      <ul>
        {#each missing as row (row.id)}<li>
            <a href={'/admin/potential/' + row.id}>{row.name}</a>
          </li>{/each}
      </ul>
    </details>
  {/if}
</section>

<style>
  .catalogue-map {
    margin: 1.25rem 0;
  }
  .map-canvas {
    height: clamp(320px, 55svh, 540px);
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 12px;
    isolation: isolate;
    z-index: 0;
  }
  .map-canvas :global(.potential-pin) {
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    border: 3px solid white;
    box-shadow: 0 1px 5px #28203688;
    font: 700 15px system-ui;
  }
  .map-canvas :global(.potential-pin-approximate) {
    background: var(--paper);
    color: var(--accent-dark);
    border: 3px dashed var(--accent);
  }
  .map-canvas :global(.potential-map-popup) {
    font: 14px system-ui;
  }
  .map-canvas :global(.potential-map-popup > div) {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--line);
  }
  .map-canvas :global(.potential-map-popup p) {
    margin: 0.35rem 0;
  }
  .map-canvas :global(.potential-map-popup button) {
    font-size: 14px;
    padding: 0.5rem;
  }
  .map-canvas :global(.leaflet-control-zoom a) {
    width: 44px;
    height: 44px;
    line-height: 44px;
  }
</style>
