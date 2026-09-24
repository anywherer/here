import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export type Note = {
  entry: Post;
  folder: string;
  folderParts: string[];
  title: string;
  slug: string;
  date: Date;
  tags: string[];
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isPublished(post: Post): boolean {
  const filename = post.id.split('/').pop() || '';
  if (filename.startsWith('_')) return false;
  return post.data.publish === true && Boolean(post.data.published);
}

export function getPostMetadata(post: Post) {
  const parts = post.id.split('/');
  const filename = parts[parts.length - 1].replace(/\.md$/, '');
  const folderParts = parts.slice(0, -1);
  const folder = folderParts.length > 0 ? folderParts.join(' › ') : 'front door';

  const rawPermalink = post.data.permalink || filename;
  const slug = slugify(rawPermalink);
  const title = post.data.title || post.data.permalink || filename;
  const date = post.data.published ? new Date(post.data.published) : new Date();
  const tags = post.data.tags ?? [];

  return { folder, folderParts, title, slug, date, tags };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function getTagSlug(tag: string): string {
  return slugify(tag);
}

export function getFolderSlug(folder: string): string {
  return slugify(folder);
}

export function getFolderHref(parts: string[]): string {
  if (parts.length === 0) return '/';
  return `/folders/${parts.map(slugify).join('/')}`;
}

export function folderTrail(parts: string[]) {
  return parts.map((name, index) => ({
    name,
    href: getFolderHref(parts.slice(0, index + 1)),
  }));
}

export async function getPublishedNotes(): Promise<Note[]> {
  const posts = await getCollection('posts', isPublished);
  return posts
    .map((entry) => ({ entry, ...getPostMetadata(entry) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function roomKey(parts: string[]) {
  return parts.join('\0');
}

export async function getHouseRooms(): Promise<string[][]> {
  const rooms = new Map<string, string[]>();
  const posts = await getCollection('posts');

  for (const post of posts) {
    const { folderParts } = getPostMetadata(post);
    for (let depth = 1; depth <= folderParts.length; depth += 1) {
      const parts = folderParts.slice(0, depth);
      rooms.set(roomKey(parts), parts);
    }
  }

  return [...rooms.values()];
}

export function collectRoutes(notes: Note[]) {
  const routes = new Map<string, Note>();

  const claim = (slug: string, note: Note, kind: 'permalink' | 'alias') => {
    if (!slug) return;
    const existing = routes.get(slug);
    if (existing && existing.entry.id !== note.entry.id) {
      throw new Error(
        `Slug collision on "${slug}" (${kind}): "${existing.entry.id}" and "${note.entry.id}"`
      );
    }
    if (!existing) routes.set(slug, note);
  };

  for (const note of notes) {
    claim(note.slug, note, 'permalink');
    for (const alias of note.entry.data.aliases) {
      claim(slugify(alias), note, 'alias');
    }
  }

  return routes;
}
