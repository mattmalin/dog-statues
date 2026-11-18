import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { videoTool } from '../src/lib/server/video-tools';
import { initialFields } from '../src/lib/model';

const headers = { origin: 'http://127.0.0.1:4177' };
let clip: Buffer, longClip: Buffer;
test.beforeAll(() => {
  mkdirSync('test-results/video-fixtures', { recursive: true });
  for (const [name, duration] of [
    ['short', 1],
    ['long', 91],
  ] as const) {
    const file = resolve('test-results/video-fixtures', name + '.mp4');
    execFileSync(
      videoTool('ffmpeg'),
      [
        '-nostdin',
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=purple:s=96x64:r=2',
        '-t',
        String(duration),
        '-metadata',
        'location=+51.5000-000.1000/',
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-pix_fmt',
        'yuv420p',
        file,
      ],
      { windowsHide: true },
    );
  }
  clip = readFileSync('test-results/video-fixtures/short.mp4');
  longClip = readFileSync('test-results/video-fixtures/long.mp4');
  // Synthetic colour clip with a real 90-degree display matrix, independent of FFmpeg's metadata-writing version.
  copyFileSync('tests/fixtures/rotated.mov', 'test-results/video-fixtures/phone.mov');
  execFileSync(
    videoTool('ffmpeg'),
    [
      '-nostdin',
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=purple:s=96x64:r=2',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      '1',
      '-c:v',
      'libvpx-vp9',
      '-threads',
      '1',
      '-c:a',
      'libopus',
      resolve('test-results/video-fixtures/phone.webm'),
    ],
    { windowsHide: true },
  );
});
async function draft(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Local passphrase').fill('test-fixture-passphrase-only');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
  const id = crypto.randomUUID();
  expect(
    (
      await page.request.post('/admin/new', {
        headers: { ...headers, accept: 'text/html' },
        form: { id },
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(303);
  const api = '/api/admin/statues/' + id;
  expect(
    (
      await page.request.patch(api, {
        headers,
        data: {
          revision: 0,
          fields: {
            ...initialFields,
            title: 'Video fixture ' + id,
            web_description: 'Owner-written video story',
            city: 'London',
            country: 'United Kingdom',
          },
        },
      })
    ).status(),
  ).toBe(200);
  return { id, api, path: '/admin/statues/' + id };
}

test('phone clips upload, play, reorder, publish with approval and preserve a private original', async ({
  page,
  request,
}) => {
  const { api, path } = await draft(page);
  await page.goto(path);
  await expect(page.getByLabel('Choose videos', { exact: true })).toBeEnabled();
  await page.getByLabel('Choose videos', { exact: true }).setInputFiles([
    { name: 'First.mp4', mimeType: 'video/mp4', buffer: clip },
    { name: 'Second.mp4', mimeType: 'video/mp4', buffer: clip },
  ]);
  const cards = page.locator('.video-card');
  await expect(cards).toHaveCount(2, { timeout: 20000 });
  let row = await (await page.request.get(api)).json();
  const firstId = row.videos[0].id;
  const secondId = row.videos[1].id;
  expect(
    row.videos.every((video: { rights_status: string }) => video.rights_status === 'private'),
  ).toBe(true);
  expect((await request.get('/videos/' + firstId)).status()).toBe(404);
  expect((await request.get(api + '/videos/' + firstId)).status()).toBe(401);
  await cards.first().getByRole('button', { name: 'Video details' }).click();
  await cards.first().getByLabel('Video description').fill('Owner-written clip description');
  await cards.first().getByLabel('Video credit').fill('Fixture photographer');
  await cards.first().getByRole('checkbox').check();
  await cards.first().getByText('Captions for speech or meaningful sound', { exact: true }).click();
  await cards
    .first()
    .getByLabel('WebVTT captions')
    .fill('WEBVTT\n\n00:00.000 --> 00:01.000\nOwner-written sound caption');
  await cards.first().getByRole('button', { name: 'Save video details' }).click();
  await expect(cards.first()).toContainText('Approved for website');
  await cards.last().getByRole('button', { name: 'Move Second.mp4 earlier' }).click();
  await expect(cards.first()).toContainText('Second.mp4');
  await page.reload();
  await expect(cards.first()).toContainText('Second.mp4');
  await page.getByRole('region', { name: 'Videos', exact: true }).screenshot({
    path: 'test-results/video-section-' + test.info().project.name.replaceAll(' ', '-') + '.png',
  });
  expect((await request.get('/videos/' + firstId)).status()).toBe(404);
  await page.getByRole('button', { name: 'Private preview', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(1);
  await expect(
    page.getByText('Owner-written clip description · Fixture photographer'),
  ).toBeVisible();
  await page.goto(path);
  await expect(page.getByLabel('Choose videos', { exact: true })).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Publish to website', exact: true }).click();
  const publicLink = page.getByRole('link', { name: 'View public page' });
  await expect(publicLink).toBeVisible();
  const publicPath = (await publicLink.getAttribute('href'))!;
  const publicPage = await page.context().newPage();
  await publicPage.goto(publicPath);
  const player = publicPage.locator('video');
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute('preload', 'none');
  await expect(player).toHaveAttribute('playsinline', '');
  await player.evaluate(async (element) => {
    (element as HTMLVideoElement).muted = true;
    await (element as HTMLVideoElement).play();
  });
  await expect(player).toHaveJSProperty('paused', false);
  const range = await request.get('/videos/' + firstId, { headers: { range: 'bytes=0-31' } });
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(32);
  expect(range.headers()['content-range']).toMatch(/^bytes 0-31\/\d+$/);
  expect(
    (await request.get('/videos/' + firstId, { headers: { range: 'bytes=-16' } })).status(),
  ).toBe(206);
  expect(
    (await request.get('/videos/' + firstId, { headers: { range: 'bytes=999999999-' } })).status(),
  ).toBe(416);
  expect((await request.get('/videos/' + firstId + '?size=poster')).headers()['content-type']).toBe(
    'image/jpeg',
  );
  expect(await (await request.get('/videos/' + firstId + '?captions=1')).text()).toContain(
    'Owner-written sound caption',
  );
  expect((await request.get('/videos/' + secondId)).status()).toBe(404);
  const web = await (await request.get('/videos/' + firstId + '?size=original')).body();
  expect(web.equals(clip)).toBe(false);
  expect(web.includes(Buffer.from('+51.5000'))).toBe(false);
  const original = await page.request.get(api + '/videos/' + firstId + '?size=original');
  expect((await original.body()).equals(clip)).toBe(true);
  expect(original.headers()['content-disposition']).toBe('attachment');
  row = await (await page.request.get(api)).json();
  await page.request.patch(api + '/videos/' + firstId, {
    headers,
    data: { action: 'details', description: 'PRIVATE EDIT NOT PUBLISHED' },
  });
  expect(await (await request.get(publicPath)).text()).not.toContain('PRIVATE EDIT NOT PUBLISHED');
  await page.request.post(api + '/publication', {
    headers,
    data: { revision: row.statue.revision, action: 'unpublish', waivePhoto: false },
  });
  expect((await request.get('/videos/' + firstId)).status()).toBe(404);
  expect((await request.get('/videos/' + firstId + '?size=poster')).status()).toBe(404);
  expect((await request.get('/videos/' + firstId + '?captions=1')).status()).toBe(404);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed video uploads retry without duplication and removal requires confirmation', async ({
  page,
  request,
}) => {
  const { api, path } = await draft(page);
  await page.goto(path);
  await expect(page.getByLabel('Choose videos', { exact: true })).toBeEnabled();
  let loseResponse = true;
  await page.route('**' + api + '/videos/*', async (route) => {
    if (route.request().method() === 'PUT' && loseResponse) {
      loseResponse = false;
      await route.fetch();
      await route.abort('connectionreset');
    } else await route.continue();
  });
  await page
    .getByLabel('Choose videos', { exact: true })
    .setInputFiles({ name: 'Retry.mp4', mimeType: 'video/mp4', buffer: clip });
  await expect(page.getByRole('button', { name: 'Retry video' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Retry video' }).click();
  await expect(page.locator('.video-card')).toHaveCount(1);
  const row = await (await page.request.get(api)).json();
  expect(row.videos).toHaveLength(1);
  const videoApi = api + '/videos/' + row.videos[0].id;
  await page.getByRole('button', { name: 'Video details' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Remove video', exact: true }).click();
  expect((await page.request.get(videoApi)).status()).toBe(200);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove video', exact: true }).click();
  await expect(page.locator('.video-card')).toHaveCount(0);
  expect((await page.request.get(videoApi)).status()).toBe(404);
  expect((await request.get('/videos/' + row.videos[0].id)).status()).toBe(404);
  await page.screenshot({
    path: 'test-results/video-editor-' + test.info().project.name.replaceAll(' ', '-') + '.png',
  });
});

test('video validation enforces authentication, origin, content, duration and clip limit', async ({
  page,
  request,
}) => {
  const { api } = await draft(page);
  const endpoint = api + '/videos/' + crypto.randomUUID();
  expect((await request.put(endpoint, { headers, data: clip })).status()).toBe(401);
  expect(
    (
      await page.request.put(endpoint, { headers: { origin: 'https://example.org' }, data: clip })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.put(endpoint, { headers, data: Buffer.from('<html>not a video</html>') })
    ).status(),
  ).toBe(415);
  expect((await page.request.put(endpoint, { headers, data: longClip })).status()).toBe(422);
  for (let index = 0; index < 6; index++)
    expect(
      (
        await page.request.put(api + '/videos/' + crypto.randomUUID(), { headers, data: clip })
      ).status(),
    ).toBe(200);
  expect((await page.request.put(endpoint, { headers, data: clip })).status()).toBe(422);
  const row = await (await page.request.get(api)).json();
  expect(
    (
      await page.request.patch(api + '/videos/' + row.videos[0].id, {
        headers,
        data: { action: 'details', captions: 'not WebVTT' },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.delete(api, {
        headers,
        data: { revision: row.statue.revision, confirmed: true },
      })
    ).status(),
  ).toBe(200);
  expect((await page.request.get(api + '/videos/' + row.videos[0].id)).status()).toBe(404);
});

test('MOV orientation and WebM sound survive conversion to browser MP4', async ({ page }) => {
  const { api } = await draft(page);
  for (const extension of ['mov', 'webm']) {
    const endpoint = api + '/videos/' + crypto.randomUUID();
    const response = await page.request.put(endpoint, {
      headers: { ...headers, 'x-video-name': 'phone.' + extension },
      data: readFileSync('test-results/video-fixtures/phone.' + extension),
    });
    expect(response.status()).toBe(200);
    const video = await response.json();
    if (extension === 'mov') {
      expect(video.width).toBe(64);
      expect(video.height).toBe(96);
    }
    const output = resolve(
      'test-results/video-fixtures',
      extension + '-' + test.info().project.name.replaceAll(' ', '-') + '.mp4',
    );
    writeFileSync(output, await (await page.request.get(endpoint)).body());
    const info = JSON.parse(
      execFileSync(videoTool('ffprobe'), ['-v', 'error', '-show_streams', '-of', 'json', output], {
        encoding: 'utf8',
        windowsHide: true,
      }),
    );
    expect(
      info.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video')
        .codec_name,
    ).toBe('h264');
    if (extension === 'webm')
      expect(
        info.streams.find((stream: { codec_type: string }) => stream.codec_type === 'audio')
          .codec_name,
      ).toBe('aac');
  }
});
