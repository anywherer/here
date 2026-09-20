import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPostMetadata, isPublished } from '../utils';

export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts', isPublished);

  const searchIndex = posts.map((post) => {
    const meta = getPostMetadata(post);
    const rawBody = post.body || (post as any).rawContent?.() || '';

    // Strip frontmatter, markdown symbols, extra whitespace, and truncate
    const cleanBody = rawBody
      .replace(/---[\s\S]*?---/, '')
      .replace(/```[\s\S]*?```/g, '') // strip codeblocks to save space
      .replace(/[#*`>~_\[\]()!-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title: meta.title,
      slug: meta.slug,
      desc: post.data.description || '',
      // Limit indexed body length to keep payload tiny (e.g. 500-1000 chars)
      body: cleanBody.slice(0, 1000),
    };
  });

  return new Response(JSON.stringify(searchIndex), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Allow browser and CDN caching
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};