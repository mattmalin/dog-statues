import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const origin = 'http://127.0.0.1:4177';
const headers = { origin, accept: 'application/json' };
const photo = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/jpeg', buffer });

async function signIn(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
}

async function create(page: Page) {
  await page.getByRole('button', { name: 'Add statue' }).click();
  await expect(page.getByRole('heading', { name: 'Quick add' })).toBeVisible();
  await expect(page.getByLabel('Choose photos')).toBeEnabled();
  return new URL(page.url()).pathname;
}

test('anonymous requests and forged platform headers cannot reach owner routes', async ({
  request,
}) => {
  const id = randomUUID();
  const fake = {
    ...headers,
    'x-ms-client-principal-idp': 'aad',
    'x-ms-client-principal': Buffer.from(JSON.stringify({ auth_typ: 'aad', claims: [] })).toString(
      'base64',
    ),
  };
  const protectedPage = await request.get('/%61dmin/statues', { maxRedirects: 0 });
  expect(protectedPage.status()).toBe(303);
  expect((await request.get('/api/%61dmin/statues/' + id, { headers: fake })).status()).toBe(401);
  expect(
    (await request.patch('/api/admin/statues/' + id, { headers: fake, data: {} })).status(),
  ).toBe(401);
  expect((await request.get('/statues/unpublished-test')).status()).toBe(404);
});

test('capture three photos, reopen, edit, publish and hide with private media separation', async ({
  page,
  request,
}) => {
  await signIn(page);
  const editor = await create(page);
  const jpeg = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#4a725e' },
  })
    .jpeg()
    .toBuffer();
  await page
    .getByLabel('Choose photos')
    .setInputFiles(['One.jpg', 'Two.jpg', 'Three.jpg'].map((name) => photo(name, jpeg)));
  await page.getByLabel('Quick note').fill('PRIVATE RESEARCH MARKER');
  await expect(page.getByText('Private photo', { exact: true })).toHaveCount(3);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'Draft inbox' })).toBeVisible();
  await page.goto(editor);
  await expect(page.getByLabel('Private notes')).toHaveValue('PRIVATE RESEARCH MARKER');

  await page.getByRole('button', { name: 'Move Three.jpg earlier' }).click();
  await expect(page.locator('.filename')).toHaveText(['One.jpg', 'Three.jpg', 'Two.jpg']);
  const third = page.locator('.photo-card').filter({ hasText: 'Three.jpg' });
  await third.getByRole('button', { name: 'Set cover' }).click();
  await expect(third.getByText('Cover · Private photo')).toBeVisible();
  const coverUrl = await third.locator('img').getAttribute('src');
  const media = '/media/' + coverUrl?.split('/').at(-1);
  expect((await request.get(media)).status()).toBe(404);
  expect((await request.get(coverUrl + '?size=original')).status()).toBe(401);
  expect((await request.get('/test-results/atlas-data/atlas.sqlite')).status()).toBe(403);
  const diskMedia =
    '/test-results/atlas-data/media/' +
    editor.split('/').at(-1) +
    '/' +
    coverUrl?.split('/').at(-1);
  expect((await request.get(diskMedia + '/original')).status()).toBe(403);

  await third.getByRole('button', { name: 'Photo details' }).click();
  await third.getByLabel('Alt text').fill('A green test image');
  await third.getByLabel('Photo credit').fill('Test fixture');
  await third.getByRole('checkbox').check();
  await third.getByRole('button', { name: 'Save photo details' }).click();
  await expect(third.getByText('Cover · Approved for website')).toBeVisible();
  await page.getByLabel('Statue name').fill('Fictional QA Statue');
  await page.getByLabel('City', { exact: true }).fill('London');
  await page.getByLabel('Country', { exact: true }).fill('United Kingdom');
  await page
    .getByLabel('Website description')
    .fill('Fixture only. <script>window.bad=true</script>');
  await page.getByLabel('Instagram caption').fill('PRIVATE CAPTION MARKER');
  await expect(page.getByText('Saved to Atlas', { exact: true })).toBeVisible();
  const draftSlug = '/statues/fictional-qa-statue-' + editor.split('/').at(-1);
  expect(await (await request.get('/')).text()).not.toContain(`href="${draftSlug}"`);

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Publish to website' }).click();
  const link = page.getByRole('link', { name: 'View public page' });
  await expect(link).toBeVisible();
  const slug = (await link.getAttribute('href'))!;
  expect(slug).toBe(draftSlug);
  const homepage = await request.get('/');
  expect(homepage.status()).toBe(200);
  const directory = await homepage.text();
  expect(directory).toContain(`href="${slug}"`);
  expect(directory).toContain(`${media}?size=thumb`);
  expect(directory).not.toMatch(/PRIVATE RESEARCH MARKER|PRIVATE CAPTION MARKER|One\.jpg|Two\.jpg/);
  const published = await request.get(slug);
  expect(published.status()).toBe(200);
  const html = await published.text();
  expect(html).toContain('Fictional QA Statue');
  expect(html).toContain('A green test image');
  expect(html).not.toMatch(
    /PRIVATE RESEARCH MARKER|PRIVATE CAPTION MARKER|original_filename|<script>window.bad/,
  );
  expect((await request.get(media)).headers()['content-type']).toBe('image/jpeg');

  await page.getByLabel('Statue name').fill('Renamed QA Statue');
  await page.getByLabel('Visit status').selectOption('visited');
  await expect(page.getByText('Saved to Atlas', { exact: true })).toBeVisible();
  await expect(link).toHaveAttribute('href', slug);
  expect(await (await request.get(slug)).text()).toContain('Renamed QA Statue');

  const remove = third.getByRole('button', { name: 'Remove photo' });
  await third.getByRole('button', { name: 'Photo details' }).click();
  await remove.click();
  await expect(page.getByText('Approve another photo or unpublish')).toBeVisible();
  await page.getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByText('Statue page hidden.')).toBeVisible();
  expect(await (await request.get('/')).text()).not.toContain(`href="${slug}"`);
  expect((await request.get(slug)).status()).toBe(404);
  expect((await request.get(media)).status()).toBe(404);
  expect((await page.request.get(coverUrl + '?size=original')).status()).toBe(200);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('publishing without alt text requires confirmation and keeps a reminder until it is added', async ({
  page,
  request,
}) => {
  await signIn(page);
  const editor = await create(page);
  const jpeg = await sharp({
    create: { width: 32, height: 24, channels: 3, background: '#4a725e' },
  })
    .jpeg()
    .toBuffer();
  await page.getByLabel('Choose photos').setInputFiles(photo('Statue.jpg', jpeg));
  await expect(page.getByText('Private photo', { exact: true })).toBeVisible();
  await page.goto(editor);
  await page.getByLabel('Statue name').fill('Alt text QA statue');
  await page.getByLabel('City', { exact: true }).fill('London');
  await page.getByLabel('Country', { exact: true }).fill('United Kingdom');
  await page.getByLabel('Website description').fill('Test record for the photo description flow.');
  await page.getByRole('button', { name: 'Photo details' }).click();
  await page.getByRole('checkbox', { name: /permission to show/ }).check();
  await page.getByRole('button', { name: 'Save photo details' }).click();
  await expect(page.getByText('One approved photo needs alt text.')).toBeVisible();
  await expect(page.getByText('Saved to Atlas', { exact: true })).toBeVisible();

  const api = '/api' + editor;
  const { statue, photos } = await (await page.request.get(api)).json();
  const unconfirmed = await page.request.post(api + '/publication', {
    headers,
    data: { action: 'publish', revision: statue.revision, waivePhoto: false },
  });
  expect(unconfirmed.status()).toBe(422);

  const publish = page.getByRole('button', { name: 'Publish without alt text' });
  page.once('dialog', (dialog) => dialog.dismiss());
  await publish.click();
  await expect(publish).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await publish.click();
  const link = page.getByRole('link', { name: 'View public page' });
  await expect(link).toBeVisible();
  const slug = (await link.getAttribute('href'))!;
  expect(await (await request.get(slug)).text()).toContain('alt="Photo of Alt text QA statue"');
  expect((await request.get('/media/' + photos[0].id)).status()).toBe(200);

  await page.reload();
  await expect(page.getByText('Alt text missing', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Photo details' }).click();
  await page.getByLabel('Alt text').fill('A bronze dog sitting on a stone plinth');
  await page.getByRole('button', { name: 'Save photo details' }).click();
  await expect(page.getByText('Alt text missing', { exact: true })).toHaveCount(0);
  await expect(page.getByText('One approved photo needs alt text.')).toHaveCount(0);
  expect(await (await request.get(slug)).text()).toContain(
    'alt="A bronze dog sitting on a stone plinth"',
  );
});

test('failed autosave survives reload and upload validation preserves the draft', async ({
  page,
}) => {
  await signIn(page);
  const editor = await create(page);
  const api = '/api' + editor;
  await page.route('**' + api, (route) => route.abort('internetdisconnected'));
  await page.getByLabel('Quick note').fill('Recover after the connection drops');
  await expect(page.getByText('Connection interrupted. Try again.')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('Quick note')).toHaveValue('Recover after the connection drops');
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  await page.unroute('**' + api);
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByText('Saved to Atlas', { exact: true })).toBeVisible();
  await page
    .getByLabel('Choose photos')
    .setInputFiles(photo('Not-a-photo.jpg', Buffer.from('this is not a JPEG')));
  await expect(page.getByText('This image could not be decoded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  const crossOrigin = await page.request.patch(api, {
    headers: { ...headers, origin: 'https://invalid.test' },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
  expect((await page.request.patch(api, { headers, data: {} })).status()).toBe(422);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('link', { name: /Untitled statue/ }).first()).toBeVisible();
});

test('interrupted uploads can be retried and duplicate upload IDs are reconciled', async ({
  page,
}) => {
  await signIn(page);
  const editor = await create(page);
  const api = '/api' + editor;
  const jpeg = await sharp({
    create: { width: 24, height: 24, channels: 3, background: '#111111' },
  })
    .jpeg()
    .toBuffer();
  await page.route('**' + api + '/photos/*', (route) => route.abort('internetdisconnected'), {
    times: 1,
  });
  await page.getByLabel('Choose photos').setInputFiles(photo('Retry.jpg', jpeg));
  await expect(page.getByRole('button', { name: 'Retry photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry photo' }).click();
  await expect(page.getByText('Private photo', { exact: true })).toHaveCount(1);
  const url = (await page.locator('.photo-card img').getAttribute('src'))!;
  expect((await page.request.put(url, { headers, data: jpeg })).status()).toBe(200);
  const oversized = await page.request.put(api + '/photos/' + randomUUID(), {
    headers,
    data: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  expect(oversized.status()).toBe(413);
  await page.reload();
  await expect(page.getByText('Private photo', { exact: true })).toHaveCount(1);
});

test('publication validates content and rejects stale edits while identical names get distinct URLs', async ({
  page,
  request,
}) => {
  await signIn(page);
  const editor = await create(page);
  const api = '/api' + editor;
  const current = (await (await page.request.get(api)).json()).statue;
  const body = (revision: number, waivePhoto: boolean) => ({
    revision,
    action: 'publish',
    waivePhoto,
  });
  const attempt = () => page.request.post(api + '/publication', { headers, data: body(0, true) });
  expect((await attempt()).status()).toBe(422);
  const fields = {
    title: 'Shared name',
    short_summary: '',
    web_description: 'Clearly fictional test record.',
    instagram_caption: '',
    private_notes: '',
    address: '',
    city: 'London',
    region: '',
    country: 'United Kingdom',
    postal_code: '',
    latitude: null,
    longitude: null,
    editorial_status: 'draft',
    visit_status: 'unvisited',
  };
  const predicted = '/statues/shared-name-' + current.id;
  expect((await request.get(predicted)).status()).toBe(404);
  expect((await page.request.patch(api, { headers, data: { revision: 0, fields } })).status()).toBe(
    200,
  );
  expect((await attempt()).status()).toBe(409);
  expect(
    (await page.request.post(api + '/publication', { headers, data: body(1, false) })).status(),
  ).toBe(422);
  expect(
    (await page.request.post(api + '/publication', { headers, data: body(1, true) })).status(),
  ).toBe(200);
  expect((await request.get(predicted)).status()).toBe(200);

  await page.goto('/admin');
  const second = '/api' + (await create(page));
  expect(
    (await page.request.patch(second, { headers, data: { revision: 0, fields } })).status(),
  ).toBe(200);
  const result = await page.request.post(second + '/publication', { headers, data: body(1, true) });
  expect(result.status()).toBe(200);
  const { slug } = await result.json();
  expect('/statues/' + slug).not.toBe(predicted);
  expect((await request.get('/statues/' + slug)).status()).toBe(200);
});
