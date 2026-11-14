const realFetch = globalThis.fetch;
let nextId = 1000;
const containers = new Set();
const uncertain = new Set();
const account = '17841453331510910';

globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin !== 'https://graph.facebook.com') return realFetch(input, options);
  const path = url.pathname.replace(/^\/v27\.0\//, '');
  const fields = options?.body;
  if (new Headers(options?.headers).get('authorization') !== 'Bearer atlas-test-instagram-token')
    return Response.json({}, { status: 401 });
  if (path === account && url.searchParams.get('fields') === 'id,username')
    return Response.json({ id: account, username: 'dogstatues' });
  if (path === account + '/media') {
    if (fields.get('media_type') === 'CAROUSEL') {
      const children = fields.get('children').split(',');
      if (
        children.length !== 2 ||
        !children.every((id) => containers.has(id)) ||
        !fields.get('caption').endsWith('\n\nLocation: London, United Kingdom')
      )
        return Response.json({}, { status: 422 });
    } else {
      const photo = new URL(fields.get('image_url'));
      if (
        photo.origin !== 'https://www.dogstatues.co.uk' ||
        fields.get('is_carousel_item') !== 'true'
      )
        return Response.json({}, { status: 422 });
      const image = await realFetch('http://127.0.0.1:4177' + photo.pathname + photo.search);
      if (!image.ok || image.headers.get('content-type') !== 'image/jpeg')
        return Response.json({}, { status: 422 });
      const { width, height } = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
      if (width !== 1080 || height !== 1080 || !photo.searchParams.has('crop'))
        return Response.json({}, { status: 422 });
    }
    const id = String(nextId++);
    containers.add(id);
    if (fields.get('caption')?.startsWith('Simulate lost response')) uncertain.add(id);
    return Response.json({ id });
  }
  if (path === account + '/media_publish' && uncertain.has(fields.get('creation_id')))
    throw new Error('Simulated lost publish response');
  if (path === account + '/media_publish' && containers.has(fields.get('creation_id')))
    return Response.json({ id: '2000' });
  if (path === '2000' && url.searchParams.get('fields') === 'permalink')
    return Response.json({ permalink: 'https://www.instagram.com/p/atlas-test/' });
  if (containers.has(path) && url.searchParams.get('fields') === 'status_code')
    return Response.json({ status_code: 'FINISHED' });
  return Response.json({}, { status: 404 });
};
import sharp from 'sharp';
