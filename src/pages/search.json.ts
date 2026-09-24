import type { APIRoute } from 'astro';
import { getPublishedNotes } from '../utils';

export const prerender = true;

function cleanBody(raw: string): string {
  return raw
    .replace(/---[\s\S]*?---/, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const GET: APIRoute = async () => {
  const notes = await getPublishedNotes();

  const searchIndex = notes.map((note) => {
    const rawBody = note.entry.body || '';
    return {
      title: note.title,
      slug: note.slug,
      desc: note.entry.data.description || '',
      tags: note.tags,
      body: cleanBody(rawBody).slice(0, 1600),
    };
  });

  return new Response(JSON.stringify(searchIndex), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
