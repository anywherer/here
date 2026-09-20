import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getPostMetadata, isPublished } from '../utils';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', isPublished);

  const sortedPosts = posts
    .map((post) => ({ entry: post, ...getPostMetadata(post) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  // Ensure trailing slash for consistent base resolution
  const siteUrl = context.site
    ? context.site.href.replace(/\/$/, '') + '/'
    : 'https://somewherer.com/';

  return rss({
    title: 'here ♡',
    description:
      'Here is a little place, somewhere lonely and cute, in a world big and complicated. Welcome to some of my writings, big and small.',
    site: siteUrl,

    // 1. Add Atom XML namespace for W3C compliance
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },

    // 2. Add self-referencing atom:link & lastBuildDate
    customData: [
      `<language>en</language>`,
      `<atom:link href="${siteUrl}rss.xml" rel="self" type="application/rss+xml" />`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ].join(''),

    items: sortedPosts.map((post) => {
      const postUrl = `${siteUrl}${post.slug}/`;
      const rawHtml =
        (post.entry as any).rendered?.html ||
        post.entry.body ||
        post.entry.data.description ||
        '';

      // 3. Convert all relative links/images to absolute URLs so RSS readers can open them
      const absoluteHtml = rawHtml.replace(
        /(href|src)="\/([^"]*)"/g,
        `$1="${siteUrl}$2"`
      );

      return {
        title: post.title,
        pubDate: post.date,
        description: post.entry.data.description || '',
        link: `/${post.slug}/`,
        // 4. Unique, permanent GUID for each note
        guid: postUrl,
        categories: post.entry.data.tags || [],
        content: absoluteHtml,
      };
    }),
  });
}