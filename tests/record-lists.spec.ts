import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { initialFields } from '../src/lib/model';

const headers = { origin: 'http://127.0.0.1:4177' };
async function signIn(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
}

test('statue list searches saved details and photo metadata, combines filters and sorts', async ({
  page,
}) => {
  await signIn(page);
  const prefix = 'LISTQA ' + crypto.randomUUID();
  const ids: string[] = [];
  for (const [index, suffix] of ['Zulu', 'Alpha'].entries()) {
    const id = crypto.randomUUID();
    ids.push(id);
    expect(
      (
        await page.request.post('/admin/new', {
          headers: { ...headers, accept: 'text/html' },
          form: { id },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(303);
    expect(
      (
        await page.request.patch('/api/admin/statues/' + id, {
          headers,
          data: {
            revision: 0,
            fields: {
              ...initialFields,
              title: prefix + ' ' + suffix,
              city: index ? 'Tokyo' : 'London',
              country: index ? 'Japan' : 'United Kingdom',
              private_notes: 'CAFÉ secret notebook',
              sculptor: 'SculptorNeedle',
              plaque: 'InscriptionNeedle',
              editorial_status: index ? 'ready' : 'draft',
              visit_status: index ? 'visited' : 'unvisited',
              sources: index
                ? []
                : [
                    {
                      title: 'Archive',
                      url: 'https://example.org/archive-needle',
                      notes: 'SourceNeedle',
                      checked: '2026-11-18',
                    },
                  ],
              latitude: index ? null : 51.5,
              longitude: index ? null : -0.1,
            },
          },
        })
      ).status(),
    ).toBe(200);
  }
  const jpeg = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#65369a' },
  })
    .jpeg()
    .toBuffer();
  const uploaded = await page.request.put(
    '/api/admin/statues/' + ids[0] + '/photos/' + crypto.randomUUID(),
    {
      headers: { ...headers, 'content-type': 'image/jpeg', 'x-photo-name': 'FileNeedle.jpg' },
      data: jpeg,
    },
  );
  expect(uploaded.ok()).toBe(true);
  const draft = await (await page.request.get('/api/admin/statues/' + ids[0])).json();
  expect(
    (
      await page.request.patch('/api/admin/statues/' + ids[0] + '/photos/' + draft.photos[0].id, {
        headers,
        data: {
          action: 'details',
          alt_text: '',
          credit: 'CreditNeedle',
          rights_status: 'approved',
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/admin/statues');
  const search = page.getByLabel('Find a statue');
  const rows = page.locator('.records li');
  await search.fill(prefix);
  await expect(rows).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('name_asc');
  await expect(rows.first()).toContainText('Alpha');
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('name_desc');
  await expect(rows.first()).toContainText('Zulu');
  for (const needle of [
    'cafe notebook',
    'SculptorNeedle InscriptionNeedle',
    'SourceNeedle',
    'archive-needle',
    'FileNeedle',
    'CreditNeedle',
  ]) {
    await search.fill(prefix + ' ' + needle);
    await expect(rows).toHaveCount(needle.includes('cafe') || needle.includes('Sculptor') ? 2 : 1);
  }
  await search.fill(prefix);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('published');
  await expect(rows).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('unpublished');
  await page.getByText('More filters', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Photos', exact: true }).selectOption('missing-alt');
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('United Kingdom');
  await page
    .getByRole('combobox', { name: 'Map details', exact: true })
    .selectOption('coordinates');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Zulu');
  await page.getByRole('combobox', { name: 'Visit status', exact: true }).selectOption('visited');
  await expect(rows).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filters and sort' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveValue(
    'updated_desc',
  );
  await search.fill(prefix);
  await expect(rows).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'test-results/statue-filters-' + test.info().project.name.replaceAll(' ', '-') + '.png',
  });
});

test('potential filters search nested image research, sort and keep map results in sync', async ({
  page,
}) => {
  await signIn(page);
  const prefix = 'POTENTIALFILTER ' + crypto.randomUUID();
  for (const [index, suffix] of ['Zulu', 'Alpha'].entries()) {
    const response = await page.request.post('/admin/potential/new', {
      headers,
      form: {
        id: crypto.randomUUID(),
        revision: '',
        name: prefix + ' ' + suffix,
        city: index ? 'Tokyo' : 'London',
        country: index ? 'Japan' : 'United Kingdom',
        status: index ? 'archived' : 'to_visit',
        latitude: index ? '' : '51.5',
        longitude: index ? '' : '-0.1',
        pin_checked: index ? '' : 'on',
        source_url: index ? '' : 'https://example.org/source-needle',
        notes: 'CAFÉ ResearchNeedle',
        images: JSON.stringify(
          index
            ? []
            : [
                {
                  id: crypto.randomUUID(),
                  image_url: 'https://images.example.test/research.jpg',
                  source_url: 'https://example.org/image-source',
                  credit: 'CreditNeedle',
                  reuse_notes: 'PermissionNeedle',
                },
              ],
        ),
      },
      maxRedirects: 0,
    });
    expect(await response.json()).toMatchObject({ type: 'redirect', status: 303 });
  }
  await page.goto('/admin/potential');
  const search = page.getByLabel('Search potential statues');
  const rows = page.locator('.records li');
  await search.fill(prefix);
  await expect(rows).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('all');
  await expect(rows).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('name_asc');
  await expect(rows.first()).toContainText('Alpha');
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('photos_desc');
  await expect(rows.first()).toContainText('Zulu');
  await search.fill(prefix + ' cafe ResearchNeedle');
  await expect(rows).toHaveCount(2);
  for (const needle of ['CreditNeedle PermissionNeedle', 'image-source', 'source-needle']) {
    await search.fill(prefix + ' ' + needle);
    await expect(rows).toHaveCount(1);
  }
  await search.fill(prefix);
  await page.getByText('More filters', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Images', exact: true }).selectOption('without');
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId('map-count')).toHaveText(
    '0 of 1 shown on map · 0 approximate locations.',
  );
  await page.getByRole('combobox', { name: 'Images', exact: true }).selectOption('with');
  await page.getByRole('combobox', { name: 'Map location', exact: true }).selectOption('checked');
  await page.getByRole('combobox', { name: 'Research sources', exact: true }).selectOption('with');
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('United Kingdom');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Zulu');
  await expect(page.getByTestId('map-count')).toHaveText(
    '1 of 1 shown on map · 0 approximate locations.',
  );
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('archived');
  await expect(rows).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filters and sort' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('active');
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveValue(
    'london_first',
  );
  await search.fill(prefix);
  await expect(rows).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path:
      'test-results/potential-filters-' + test.info().project.name.replaceAll(' ', '-') + '.png',
  });
});
