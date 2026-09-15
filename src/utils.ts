import type { CollectionEntry } from 'astro:content';

// Converts "write drunk, edit sober" -> "write-drunk-edit-sober"
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 1. GATEKEEPER: Must have publish: true (or published: true) AND a valid published date
export function isPublished(post: CollectionEntry<'posts'>): boolean {
  const isPublishTrue = post.data.publish === true || (post.data as any).published === true;
  const hasDate = Boolean(post.data.published);
  return isPublishTrue && hasDate;
}

// 2. EXTRACT METADATA & PERMALINK
export function getPostMetadata(post: CollectionEntry<'posts'>) {
  const parts = post.id.split('/');
  const filename = parts[parts.length - 1].replace(/\.md$/, '');

  // If nested: joins all folders with " › " (e.g. "03 bed › plushies")
  const folderParts = parts.slice(0, -1);
  const folder = folderParts.length > 0 ? folderParts.join(' › ') : 'front door';

  const rawPermalink = post.data.permalink || filename;
  const slug = slugify(rawPermalink);
  const title = post.data.title || post.data.permalink || filename;
  const date = post.data.published ? new Date(post.data.published) : new Date();

  return { folder, title, slug, date };
}

// 3. DATE FORMATTER (Matches "Dec 14, 2025" without timezone shifts)
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}