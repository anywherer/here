import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stringList = z
  .union([z.array(z.string()), z.string()])
  .nullish()
  .transform((val) => {
    if (!val) return [];
    if (typeof val === 'string') return val.trim() ? [val] : [];
    return val.filter(Boolean);
  });

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    aliases: stringList,
    tags: stringList,
    created: z.coerce.date().nullish(),
    modified: z.coerce.date().nullish(),
    published: z.coerce.date().nullish(),
    publish: z.boolean().nullish().transform((v) => v ?? true),
    permalink: z.string().nullish(),
  }),
});

export const collections = { posts };
