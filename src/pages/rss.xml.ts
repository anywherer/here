import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getPostMetadata, isPublished } from '../utils';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', isPublished);

  const sortedPosts = posts
    .map((post) => ({ entry: post, ...getPostMetadata(post) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return rss({
    title: 'here ♡',
    description:
      'Here is a little place, somewhere lonely and cute, in a world big and complicated. Welcome to some of my writings, big and small.',
    site: context.site!,
    items: sortedPosts.map((post) => {
      const fullContent =
        (post.entry as any).rendered?.html ||
        post.entry.body ||
        post.entry.data.description ||
        '';

      return {
        title: post.title,
        pubDate: post.date,
        description: post.entry.data.description || '',
        link: `/${post.slug}/`,
        categories: post.entry.data.tags || [],
        content: fullContent,
      };
    }),
    customData: `<language>en</language>`,
  });
}