import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const headers = { origin: 'http://127.0.0.1:4177', accept: 'application/json' };
async function signIn(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
}

test('statue deletion requires confirmation, rejects stale requests and removes public access', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Add statue', exact: true }).click();
  const path = new URL(page.url()).pathname;
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Draft inbox' })).toBeVisible();
  await page.goto(path);
  const name = 'DELETE QA ' + crypto.randomUUID();
  await page.getByLabel('Statue name').fill(name);
  await page.getByLabel('Website description').fill('Deletion test fixture');
  await page.getByLabel('City', { exact: true }).fill('London');
  await page.getByLabel('Country', { exact: true }).fill('United Kingdom');
  const jpeg = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#65369a' },
  })
    .jpeg()
    .toBuffer();
  await page
    .getByLabel('Choose photos')
    .setInputFiles({ name: 'Delete.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  const photo = page.locator('.photo-card');
  await expect(photo).toHaveCount(1);
  await photo.getByRole('button', { name: 'Photo details' }).click();
  await photo.getByLabel('Alt text').fill('Deletion test image');
  await photo.getByRole('checkbox').check();
  await photo.getByRole('button', { name: 'Save photo details' }).click();
  await expect(photo.getByText('Approved for website')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Publish to website', exact: true }).click();
  const publicLink = page.getByRole('link', { name: 'View public page' });
  await expect(publicLink).toBeVisible();
  const publicPath = (await publicLink.getAttribute('href'))!;
  const api = '/api' + path;
  const draft = await (await page.request.get(api)).json();
  const photoPath = api + '/photos/' + draft.photos[0].id;
  expect(
    (
      await request.delete(api, {
        headers,
        data: { revision: draft.statue.revision, confirmed: true },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.delete(api, { headers, data: { revision: draft.statue.revision } })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.delete(api, {
        headers: { ...headers, origin: 'https://example.org' },
        data: { revision: draft.statue.revision, confirmed: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.delete(api, {
        headers,
        data: { revision: draft.statue.revision - 1, confirmed: true },
      })
    ).status(),
  ).toBe(409);
  let calls = 0;
  page.on('request', (req) => {
    if (req.method() === 'DELETE' && req.url().endsWith(api)) calls++;
  });
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain(name);
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete statue', exact: true }).click();
  expect(calls).toBe(0);
  expect((await page.request.get(api)).status()).toBe(200);
  expect((await request.get(publicPath)).status()).toBe(200);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete statue', exact: true }).click();
  await expect(page).toHaveURL('/admin/statues');
  expect(calls).toBe(1);
  expect((await page.request.get(api)).status()).toBe(404);
  expect((await page.request.get(photoPath)).status()).toBe(404);
  expect((await request.get('/media/' + draft.photos[0].id)).status()).toBe(404);
  expect((await request.get(publicPath)).status()).toBe(404);
  expect(await (await request.get('/rss.xml')).text()).not.toContain(publicPath);
  expect(await (await request.get('/')).text()).not.toContain(publicPath);
  await expect(page.locator('.records a[href="' + path + '"]')).toHaveCount(0);
});

test('potential deletion confirms the entry and cancellation preserves its research', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/admin/potential/new');
  await expect(page.getByRole('button', { name: 'Delete potential statue' })).toHaveCount(0);
  const name = 'DELETE POTENTIAL ' + crypto.randomUUID();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Research notes').fill('Keep unless deletion is confirmed');
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const path = new URL(page.url()).pathname;
  const api = '/api' + path;
  expect(
    (await request.delete(api, { headers, data: { revision: 0, confirmed: true } })).status(),
  ).toBe(401);
  expect(
    (await page.request.delete(api, { headers, data: { revision: 0, confirmed: false } })).status(),
  ).toBe(422);
  await page.getByLabel('City', { exact: true }).fill('London');
  await page.getByRole('button', { name: 'Save potential statue' }).click();
  await expect(page.locator('input[name="revision"]')).toHaveValue('1');
  expect(
    (await page.request.delete(api, { headers, data: { revision: 0, confirmed: true } })).status(),
  ).toBe(409);
  expect(
    (
      await page.request.delete(api, {
        headers: { ...headers, origin: 'https://example.org' },
        data: { revision: 1, confirmed: true },
      })
    ).status(),
  ).toBe(403);
  let calls = 0;
  page.on('request', (req) => {
    if (req.method() === 'DELETE' && req.url().endsWith(api)) calls++;
  });
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain(name);
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete potential statue' }).click();
  expect(calls).toBe(0);
  await page.reload();
  await expect(page.getByLabel('Research notes')).toHaveValue('Keep unless deletion is confirmed');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete potential statue' }).click();
  await expect(page).toHaveURL('/admin/potential');
  expect(calls).toBe(1);
  expect((await page.request.get(path)).status()).toBe(404);
  await expect(page.locator('.records a[href="' + path + '"]')).toHaveCount(0);
});
