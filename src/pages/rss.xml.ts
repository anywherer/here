import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import { getPostMetadata, isPublished } from '../utils';

const SITE_FALLBACK = 'https://somewherer.com/';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', isPublished);

  const siteUrl = withTrailingSlash(
    context.site?.href ?? SITE_FALLBACK
  );
  const feedUrl = new URL('rss.xml', siteUrl).href;

  const sortedPosts = posts
    .map((post) => ({ entry: post, ...getPostMetadata(post) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return rss({
    title: 'here ♡',
    description:
      'Here is a little place, somewhere lonely and cute, in a world big and complicated. Welcome to some of my writings, big and small.',
    site: siteUrl,
    trailingSlash: true,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData: [
      `<language>en</language>`,
      `<atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml" />`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ].join(''),
    items: sortedPosts.map((post) => {
      const path = `/${trimSlashes(post.slug)}/`;
      const postUrl = new URL(path, siteUrl).href;

      const rawHtml =
        (post.entry as { rendered?: { html?: string } }).rendered?.html ||
        post.entry.body ||
        post.entry.data.description ||
        '';

      const cleanedHtml = sanitizeHtml(rawHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          'img',
          'figure',
          'figcaption',
          'picture',
          'source',
          'h1',
          'h2',
          'h3',
          'h4',
          'del',
          's',
          'mark',
          'sup',
          'sub',
        ]),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          // Preserves footnote IDs and heading IDs
          '*': ['id'],
          a: ['href', 'title', 'rel', 'id'],
          img: ['src', 'srcset', 'alt', 'title', 'width', 'height'],
          source: ['srcset', 'type', 'media'],
        },
        allowedStyles: {},
      });

      const absoluteHtml = absolutizeHtml(cleanedHtml, postUrl, siteUrl);

      const description = excerpt(
        post.entry.data.description || toPlainText(absoluteHtml)
      );

      return {
        title: post.title,
        pubDate: post.date,
        description,
        link: path,
        // 1. ADDED: Guarantees unique post identification (W3C Requirement)
        guid: postUrl,
        categories: post.entry.data.tags || [],
        content: absoluteHtml,
      };
    }),
  });
}

function withTrailingSlash(url: string) {
  return url.replace(/\/?$/, '/');
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function toPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // 2. Decode entities so @astrojs/rss doesn't double-escape them into &amp;quot;
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(text: string, max = 280) {
  const clean = text.trim();
  if (!clean) return 'A note from here.';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function absolutizeHtml(html: string, pageUrl: string, siteUrl: string) {
  const resolve = (raw: string) => {
    const value = raw.trim();
    if (
      !value ||
      /^(data:|mailto:|tel:|javascript:)/i.test(value)
    ) {
      return raw;
    }

    // Footnote / heading anchors should point at the post, not "current reader page"
    if (value.startsWith('#')) return `${pageUrl}${value}`;

    try {
      return new URL(value, siteUrl).href;
    } catch {
      return raw;
    }
  };

  return html
    .replace(
      /\b(href|src|poster)=("|')([^"']+)\2/gi,
      (_match, attr: string, quote: string, url: string) =>
        `${attr}=${quote}${resolve(url)}${quote}`
    )
    .replace(
      /\bsrcset=("|')([^"']+)\1/gi,
      (_match, quote: string, srcset: string) => {
        const rewritten = srcset
          .split(',')
          .map((part) => {
            const [url, ...descriptors] = part.trim().split(/\s+/);
            return [resolve(url), ...descriptors].join(' ');
          })
          .join(', ');
        return `srcset=${quote}${rewritten}${quote}`;
      }
    );
}