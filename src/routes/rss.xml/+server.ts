import copy from '$lib/public-copy.json';
import { listFeedEntries } from '$lib/server/statues';
import type { RequestHandler } from './$types';

function escapeXml(text: string) {
  return text
    .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: RequestHandler = async ({ url }) => {
  const entries = await listFeedEntries();
  const items = entries.map((entry) => {
    const link = escapeXml(new URL('/statues/' + encodeURIComponent(entry.slug), url).href);
    const published = entry.web_published_at ? Date.parse(entry.web_published_at) : NaN;
    // Readers can render descriptions as HTML. Escape the plain text for both HTML and XML.
    const summary = entry.short_summary
      ? `<description>${escapeXml(escapeXml(entry.short_summary))}</description>`
      : '';
    const date = Number.isFinite(published)
      ? `<pubDate>${new Date(published).toUTCString()}</pubDate>`
      : '';
    return `<item>
      <title>${escapeXml(entry.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">urn:uuid:${escapeXml(entry.id)}</guid>
      ${summary}
      ${date}
    </item>`;
  });

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(copy.site.name)}</title>
    <link>${escapeXml(new URL('/', url).href)}</link>
    <description>${escapeXml(copy.rss.description)}</description>
    <atom:link href="${escapeXml(new URL('/rss.xml', url).href)}" rel="self" type="application/rss+xml" />
    ${items.join('\n')}
  </channel>
</rss>`,
    {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
};
