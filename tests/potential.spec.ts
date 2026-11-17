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
  await page.getByLabel('London only').check();
  await expect(page.getByRole('link', { name: /Hachiko statue/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Brown Dog memorial/i })).toBeVisible();
  await page.getByRole('link', { name: /Best Friends – dog and child/ }).click();
  await expect(page.getByLabel('Research notes')).toHaveValue(/DOG-LON-001/);
  await expect(page.getByLabel('Research notes')).toHaveValue(/Tanya Russell/);
  await expect(page.getByLabel('Google Maps pin link')).toHaveValue(/Best%20Friends/);
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
