import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import sanitizeHtml from 'sanitize-html';
import { SITE } from '../site';
import { getPublishedNotes } from '../utils';

export async function GET(context: APIContext) {
  const notes = await getPublishedNotes();
  const siteUrl = withTrailingSlash(context.site?.href ?? SITE.fallbackUrl);
  const feedUrl = new URL('rss.xml', siteUrl).href;

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: siteUrl,
    trailingSlash: false,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData: [
      `<language>en</language>`,
      `<atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml" />`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ].join(''),
    items: notes.map((note) => {
      const path = `/${note.slug}`;
      const postUrl = new URL(path, siteUrl).href;

      const rawHtml =
        (note.entry as { rendered?: { html?: string } }).rendered?.html ||
        note.entry.body ||
        note.entry.data.description ||
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
          '*': ['id'],
          a: ['href', 'title', 'rel', 'id'],
          img: ['src', 'srcset', 'alt', 'title', 'width', 'height'],
          source: ['srcset', 'type', 'media'],
        },
        allowedStyles: {},
      });

      const absoluteHtml = absolutizeHtml(cleanedHtml, postUrl, siteUrl);
      const description = excerpt(note.entry.data.description || toPlainText(absoluteHtml));

      return {
        title: note.title,
        pubDate: note.date,
        description,
        link: path,
        guid: postUrl,
        categories: note.tags,
        content: absoluteHtml,
      };
    }),
  });
}

function withTrailingSlash(url: string) {
  return url.replace(/\/?$/, '/');
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
    if (!value || /^(data:|mailto:|tel:|javascript:)/i.test(value)) return raw;
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
