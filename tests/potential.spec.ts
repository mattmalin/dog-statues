import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const suggestions = JSON.parse(
  readFileSync('src/lib/server/potential-suggestions.json', 'utf8'),
) as { id: string; notes: string; status?: string }[];

test('curated research retains every CSV reference without duplicate catalogue IDs', () => {
  const csv = readFileSync('research/london-47-original.csv', 'utf8');
  const references = csv.match(/^DOG-LON-\d{3}(?=,)/gm) ?? [];
  expect(references).toHaveLength(47);
  expect(suggestions).toHaveLength(55);
  expect(new Set(suggestions.map((row) => row.id)).size).toBe(55);
  for (const reference of references) {
    expect(
      suggestions.filter((row) => row.notes.includes('Original CSV record: ' + reference)),
    ).toHaveLength(1);
  }
  expect(
    suggestions.find((row) => row.notes.includes('Original CSV record: DOG-LON-047'))?.status,
  ).toBe('archived');
});

test('potential statues support private research, map import and idempotent suggestions', async ({
  page,
  request,
}) => {
  expect((await request.get('/admin/potential', { maxRedirects: 0 })).status()).toBe(303);
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Potential future dog statues', exact: true }).click();
  await page.getByText('Researched suggestions', { exact: true }).click();
  await page.getByRole('button', { name: 'Add researched suggestions' }).click();
  await expect(page.getByRole('link', { name: /Brown Dog memorial/i })).toBeVisible();
  const count = await page.locator('.records li').count();
  expect(count).toBeGreaterThanOrEqual(54);
  await page.getByText('Researched suggestions', { exact: true }).click();
  await page.getByRole('button', { name: 'Add researched suggestions' }).click();
  await expect(page.getByRole('status')).toHaveText('0 suggestions added.');
  await expect(page.locator('.records li')).toHaveCount(count);
  await page.getByText('Researched suggestions', { exact: true }).click();
  await page.getByRole('button', { name: 'Add researched images', exact: true }).click();
  await page.getByText('Researched suggestions', { exact: true }).click();
  await page.getByRole('button', { name: 'Add researched images', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('0 image links added across 0 entries.');
  await page.getByLabel('London only').check();
  await expect(page.getByRole('link', { name: /Hachiko statue/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Brown Dog memorial/i })).toBeVisible();
  await page.getByRole('link', { name: /Best Friends – dog and child/ }).click();
  await expect(page.getByLabel('Research notes')).toHaveValue(/DOG-LON-001/);
  await expect(page.getByLabel('Research notes')).toHaveValue(/Tanya Russell/);
  await expect(page.getByLabel('Google Maps pin link')).toHaveValue(/Best%20Friends/);
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Source page', { exact: true })).toHaveValue(/tanyarussell\.com/);
  await page.getByRole('link', { name: '← Potential future dog statues' }).click();
  await page.getByRole('link', { name: 'Add potential statue' }).click();
  const name = 'PRIVATE FUTURE ' + crypto.randomUUID();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('City', { exact: true }).fill('London');
  await page.getByLabel('Country', { exact: true }).fill('United Kingdom');
  const pin = 'https://www.google.com/maps/search/?api=1&query=51.501,-0.141';
  await page.getByLabel('Google Maps pin link').fill(pin);
  await page.getByRole('button', { name: 'Import location from pin' }).click();
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('51.501');
  await page.getByLabel('Research notes').fill('Private planning note');
  await page.getByLabel('Source link').fill('https://example.org/research');
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const path = new URL(page.url()).pathname;
  await page.reload();
  await expect(page.getByLabel('Research notes')).toHaveValue('Private planning note');
  await expect(page.getByLabel('Google Maps pin link')).toHaveValue(pin);
  expect(await (await request.get('/')).text()).not.toContain(name);
  expect(await (await request.get('/rss.xml')).text()).not.toContain(name);
  expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(303);
  expect(await (await page.request.get('/admin/statues')).text()).not.toContain(name);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('archived');
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.locator('input[name="revision"]')).toHaveValue('1');
  await expect(
    page.getByRole('status').filter({ hasText: 'Potential statue saved.' }),
  ).toBeVisible();
  const stale = await page.request.post(path, {
    headers: { origin: 'http://127.0.0.1:4177' },
    form: {
      revision: '0',
      name,
      city: 'London',
      country: 'United Kingdom',
      status: 'researching',
      maps_url: pin,
      latitude: '51.501',
      longitude: '-0.141',
    },
  });
  expect(await stale.text()).toContain('This potential statue changed. Reload it before saving.');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('archived');
  await page.getByRole('link', { name: '← Potential future dog statues' }).click();
  await page.getByLabel('Search potential statues').fill(name);
  await expect(page.locator('.records li')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('archived');
  await expect(page.locator('.records li')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('embedded map follows filters, opens records safely and reports missing coordinates', async ({
  page,
}) => {
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
  const prefix = 'MAPTEST ' + crypto.randomUUID();
  const londonName = prefix + ' <img src=x> London';
  const londonId = crypto.randomUUID();
  for (const entry of [
    { id: londonId, name: londonName, city: 'London', latitude: '51.5', longitude: '-0.1' },
    {
      id: crypto.randomUUID(),
      name: prefix + ' Tokyo',
      city: 'Tokyo',
      latitude: '35.659',
      longitude: '139.7',
    },
    {
      id: crypto.randomUUID(),
      name: prefix + ' Missing',
      city: 'London',
      latitude: '',
      longitude: '',
    },
  ]) {
    const response = await page.request.post('/admin/potential/new', {
      headers: { origin: 'http://127.0.0.1:4177' },
      form: { ...entry, country: '', revision: '', status: 'researching' },
      maxRedirects: 0,
    });
    expect(await response.json()).toMatchObject({
      type: 'redirect',
      status: 303,
      location: '/admin/potential/' + entry.id + '?saved=1',
    });
  }
  await page.goto('/admin/potential');
  await expect(page.getByRole('region', { name: 'Potential statues map' })).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.getByLabel('Search potential statues').fill(prefix);
  await expect(page.getByTestId('map-count')).toHaveText(
    '2 of 3 shown on map · 0 approximate locations.',
  );
  await expect(page.getByText('1 entries need coordinates', { exact: true })).toBeVisible();
  await page.getByLabel('London only').check();
  await expect(page.getByTestId('map-count')).toHaveText(
    '1 of 2 shown on map · 0 approximate locations.',
  );
  await page.locator('.leaflet-marker-icon').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.getByRole('link', { name: londonName, exact: true })).toBeVisible();
  await expect(popup.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'test-results/potential-map-' + test.info().project.name.replaceAll(' ', '-') + '.png',
  });
  await popup.getByRole('link', { name: londonName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/admin/potential/' + londonId));
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('51.5');
});

test('research images persist with provenance and the selected thumbnail stays private', async ({
  page,
  request,
}) => {
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Potential future dog statues', exact: true }).click();
  await page.getByRole('link', { name: 'Add potential statue' }).click();
  const name = 'PRIVATE IMAGE RESEARCH ' + crypto.randomUUID();
  await page.getByLabel('Name', { exact: true }).fill(name);
  for (const number of [1, 2]) {
    await page.getByRole('button', { name: 'Add image link', exact: true }).click();
    const fieldset = page.locator('.research-images fieldset').nth(number - 1);
    await fieldset
      .getByLabel('Image URL', { exact: true })
      .fill(`https://images.example.test/dog-${number}.png`);
    await fieldset
      .getByLabel('Source page', { exact: true })
      .fill('https://example.org/image-source-' + number);
    await fieldset.getByLabel('Credit or photographer').fill('Fixture photographer ' + number);
    await fieldset
      .getByLabel('Licence or permission notes')
      .fill('PRIVATE PERMISSION NOTE ' + number);
  }
  await page.getByRole('button', { name: 'Use as thumbnail' }).click();
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const path = new URL(page.url()).pathname;
  await page.reload();
  await expect(page.getByLabel('Image URL', { exact: true }).first()).toHaveValue(
    'https://images.example.test/dog-2.png',
  );
  await expect(page.getByLabel('Credit or photographer').first()).toHaveValue(
    'Fixture photographer 2',
  );
  await page.getByLabel('Research notes').fill('An unrelated edit');
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.locator('input[name="revision"]')).toHaveValue('1');
  await page.getByRole('link', { name: '← Potential future dog statues' }).click();
  await page.getByLabel('Search potential statues').fill(name);
  const row = page.locator('.records a[href="' + path + '"]');
  await expect(row.locator('img')).toHaveAttribute('src', 'https://images.example.test/dog-2.png');
  await expect(row.locator('img')).toHaveJSProperty('naturalWidth', 1);
  for (const publicPath of ['/', '/rss.xml'])
    expect(await (await request.get(publicPath)).text()).not.toContain('images.example.test');
  expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(303);
  await row.click();
  await page.getByRole('button', { name: 'Remove image link' }).first().click();
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.locator('input[name="revision"]')).toHaveValue('2');
  await page.reload();
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue(
    'https://images.example.test/dog-1.png',
  );
  const unsafe = await page.request.post(path, {
    headers: { origin: 'http://127.0.0.1:4177' },
    form: {
      name,
      status: 'researching',
      revision: '2',
      images: JSON.stringify([
        {
          id: crypto.randomUUID(),
          image_url: 'javascript:alert(1)',
          source_url: 'https://example.org',
          credit: '',
          reuse_notes: '',
        },
      ]),
    },
  });
  expect(await unsafe.json()).toMatchObject({ type: 'failure', status: 422 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
