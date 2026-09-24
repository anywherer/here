import { readdir } from 'node:fs/promises';
import path from 'node:path';
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

export function prettyFolderSegment(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function prettyFolderParts(parts: string[]): string[] {
  return parts.map(prettyFolderSegment);
}

export function folderPathKey(parts: string[]): string {
  return parts.map(slugify).join('/');
}

export function foldersMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((part, i) => slugify(part) === slugify(b[i] || ''));
}

export function folderContains(noteParts: string[], roomParts: string[]): boolean {
  return roomParts.every((part, i) => slugify(noteParts[i] || '') === slugify(part));
}

function sourcePath(post: Post): string {
  const filePath = (post as Post & { filePath?: string }).filePath;
  return (filePath || post.id).replace(/\\/g, '/');
}

export function folderPartsFromPost(post: Post): string[] {
  let rel = sourcePath(post);
  const marker = '/content/posts/';
  const at = rel.indexOf(marker);
  if (at >= 0) rel = rel.slice(at + marker.length);
  rel = rel.replace(/\.md$/i, '');
  const parts = rel.split('/').filter(Boolean);
  if (parts.length) parts.pop();
  return prettyFolderParts(parts);
}

export function isPublished(post: Post): boolean {
  const filename = sourcePath(post).split('/').pop() || '';
  if (filename.startsWith('_')) return false;
  return post.data.publish === true && Boolean(post.data.published);
}

export function getPostMetadata(post: Post) {
  const folderParts = folderPartsFromPost(post);
  const folder = folderParts.length > 0 ? folderParts.join(' › ') : 'front door';

  const source = sourcePath(post);
  const filename = (source.split('/').pop() || '').replace(/\.md$/i, '');
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
  return `/folders/${folderPathKey(parts)}`;
}

export function folderTrail(parts: string[]) {
  const pretty = prettyFolderParts(parts);
  return pretty.map((name, index) => ({
    name,
    href: getFolderHref(pretty.slice(0, index + 1)),
  }));
}

export async function getPublishedNotes(): Promise<Note[]> {
  const posts = await getCollection('posts', isPublished);
  return posts
    .map((entry) => ({ entry, ...getPostMetadata(entry) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function rememberRoom(rooms: Map<string, string[]>, parts: string[]) {
  const pretty = prettyFolderParts(parts.filter(Boolean));
  if (!pretty.length) return;
  const key = folderPathKey(pretty);
  const existing = rooms.get(key);
  if (!existing) {
    rooms.set(key, pretty);
    return;
  }
  const incomingSpaces = pretty.join(' ').split(' ').length;
  const existingSpaces = existing.join(' ').split(' ').length;
  if (incomingSpaces > existingSpaces) rooms.set(key, pretty);
}

async function walkDiskRooms(rooms: Map<string, string[]>) {
  const root = path.resolve('./src/content/posts');

  async function walk(dir: string, parts: string[]) {
    if (parts.length) rememberRoom(rooms, parts);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      await walk(path.join(dir, entry.name), [...parts, entry.name]);
    }
  }

  await walk(root, []);
}

export async function getHouseRooms(): Promise<string[][]> {
  const rooms = new Map<string, string[]>();
  await walkDiskRooms(rooms);

  const posts = await getCollection('posts');
  for (const post of posts) {
    const folderParts = folderPartsFromPost(post);
    for (let depth = 1; depth <= folderParts.length; depth += 1) {
      rememberRoom(rooms, folderParts.slice(0, depth));
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
