import { Root } from "hast"
import { GlobalConfiguration } from "../../cfg"
import { getDate } from "../../components/Date"
import { escapeHTML } from "../../util/escape"
import { FilePath, FullSlug, SimpleSlug, joinSegments, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { toHtml } from "hast-util-to-html"
import { write } from "./helpers"
import { i18n } from "../../i18n"
import { BuildCtx } from "../../util/ctx"
import { ProcessedContent } from "../vfile"

type ContentIndex = Tree<TreeNode>
export type ContentDetails = {
  slug: FullSlug
  filePath: FilePath
  title: string
  links: SimpleSlug[]
  tags: string[]
  content: string
  richContent?: string
  date?: Date
  description?: string
  noRSS?: boolean
}

interface Options {
  enableSiteMap: boolean
  enableRSS: boolean
  bypassIndexCheck: boolean
  rssLimit?: number
  rssFullHtml: boolean
  rssSlug: string
  includeEmptyFiles: boolean
  titlePattern?: (cfg: GlobalConfiguration, dir: FullSlug, dirIndex?: ContentDetails) => string
}

const defaultOptions: Options = {
  bypassIndexCheck: false,
  enableSiteMap: true,
  enableRSS: true,
  rssLimit: 10,
  rssFullHtml: false,
  rssSlug: "index",
  includeEmptyFiles: true,
  titlePattern: (cfg, dir, dirIndex) =>
  `${cfg.pageTitle} - ${dirIndex != null ? dirIndex.title : dir.split("/").pop()}`,
}

function generateSiteMap(cfg: GlobalConfiguration, idx: ContentIndex): string {
  const base = cfg.baseUrl ?? ""
  const createURLEntry = (content: ContentDetails): string => `
  <url>
  <loc>https://${joinSegments(base, encodeURI(simplifySlug(content.slug!)))}</loc>
  ${content.date && `<lastmod>${content.date.toISOString()}</lastmod>`}
  </url>`
  let urls = (idx.spread() as ContentDetails[]).map((e) => createURLEntry(e)).join("")
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}
</urlset>`
}

function finishRSSFeed(cfg: GlobalConfiguration, opts: Partial<Options>, entries: Feed): string {
  const base = cfg.baseUrl ?? ""
  const feedTitle = opts.titlePattern!(cfg, entries.dir, entries.dirIndex)
  const limit = opts?.rssLimit ?? entries.raw.length

  const sorted = entries.raw
  .sort((f1, f2) => {
    if (f1.date && f2.date) {
    return f2.date.getTime() - f1.date.getTime()
    } else if (f1.date && !f2.date) {
    return -1
    } else if (!f1.date && f2.date) {
    return 1
    }

    return f1.title.localeCompare(f2.title)
  })
  .slice(0, limit)
  .map((e) => e.item)
  
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
  <title>${escapeHTML(cfg.pageTitle)}</title>
  <link>${base}</link>
  <description>Welcome to some of my thoughts and writings, big and small.</description>
  ${items}
  </channel>
</rss>`
}

function generateRSSEntry(cfg: GlobalConfiguration, details: ContentDetails): Entry {
  const base = cfg.baseUrl ?? ""

  let item = `
  <item>
    <title>${escapeHTML(details.title)}</title>
    <link>https://${joinSegments(base, encodeURI(simplifySlug(details.slug!)))}</link>
    <guid>https://${joinSegments(base, encodeURI(simplifySlug(details.slug!)))}</guid>
    <description>${details.richContent ?? details.description}</description>
    <pubDate>${details.date?.toUTCString()}</pubDate>
  </item>`

  return {
  item: item,
  date: details.date!, // Safety: guaranteed non-null by Tree<Stem> -> Tree<TreeNode>
  title: details.title,
  }
}

export const ContentIndex: QuartzEmitterPlugin<Partial<Options>> = (opts) => {
  opts = { ...defaultOptions, ...opts }
  return {
  name: "ContentIndex",
  async *emit(ctx, content) {
    // If we're missing an index file, don't bother with sitemap/RSS gen
    if (
    !(
      opts?.bypassIndexCheck ||
      content.map(([_, c]) => c.data.slug!).includes("index" as FullSlug)
    )
    ) {
    console.warn(`Warning: contentIndex: 
  content/ folder is missing an index.md. RSS feeds and sitemap will not be generated.
  If you still wish to generate these files, add:
  bypassIndexCheck: true,
  to your configuration for Plugin.ContentIndex({...}) in quartz.config.ts.
  Don't do this unless you know what you're doing!`),
    return []
    }

    const cfg = ctx.cfg.configuration
    const emitted: Promise<FilePath>[] = []
    var indexTree = new Tree<TreeNode>(defaultFeed(), compareTreeNodes)

    // ProcessedContent[] -> Tree<TreeNode>
    // bfahrenfort: If I could finagle a Visitor pattern to cross
    //  different datatypes (TransformVisitor<T, K>?), half of this pass could be
    //  folded into the FeedGenerator postorder accept
    const detailsOf = ([tree, file]: ProcessedContent): ContentDetails => {
    return {
      slug: file.data.slug!,
      filePath: file.data.relativePath!,
      title: file.data.frontmatter?.title!,
      links: file.data.links ?? [],
      tags: file.data.frontmatter?.tags ?? [],
      content: file.data.text ?? "",
      richContent: opts?.rssFullHtml
      ? escapeHTML(toHtml(tree as Root, { allowDangerousHtml: true }))
      : undefined,
      date: getDate(ctx.cfg.configuration, file.data) ?? new Date(),
      description: file.data.description ?? "",
      noRSS: file.data.frontmatter?.noRSS ?? false,
    }
    }
    for (const [tree, file] of content) {
    // Create tree strucutre
    var pointer = indexTree
    const dirs = file.data.relativePath?.split("/").slice(0, -1) ?? []

    // Skips descent if file is top-level (ex. content/index.md)
    for (var i = 1; i <= dirs.length; i++) {
      // Initialize directories
      let feed = {
      dir: dirs!.slice(0, i).join("/") as FullSlug,
      raw: new Array<Entry>(),
      }
      pointer = pointer.child(feed)
    }

    // Initialize children
    // a. parse ContentDetails of file
    // b. (if exists) add the dir index to the enclosing feed
    // c. terminate branch with file's ContentDetails
    let details = detailsOf([tree, file])
    if (file.stem == "index") {
      let feed = pointer.data as Feed

      feed.dirIndex = details
    }
    pointer = pointer.child(details)
    }

    if (opts?.enableSiteMap) {
    emitted.push(
      write({
      ctx,
      content: generateSiteMap(cfg, indexTree),
      slug: "sitemap" as FullSlug,
      ext: ".xml",
      }),
    )
    }

    if (opts?.enableRSS) {
    var feedTree: Tree<TreeNode> = indexTree

    // 1. In-place Tree<TreeNode> -> Tree<TreeNode>
    //  TreeNode becomes either:
    //    data Feed with children Feed | ContentDetails
    //    ContentDetails with empty children
    // 2. Finish each Feed and emit
    //  Each Feed now has an Entry[] of enclosed RSS items, to be composed
    //  with the Entry[]s of child Feeds (bottom-up)
    //  before wrapping with RSS tags to be emitted as one string
    feedTree.acceptPostorder(new FeedGenerator(ctx, cfg, opts, emitted))

    // Generate index feed separately re-using the Entry[] composed upwards
    let topFeed = finishRSSFeed(cfg, opts, feedTree.data as Feed)
    emitted.push(
      write({
      ctx,
      content: topFeed,
      slug: opts.rssSlug! as FullSlug, // Safety: defaults to "index"
      ext: ".xml",
      }),
    )

    // Reader compatibility, don't break existing readers if the path changes
    if (opts.rssSlug !== defaultOptions.rssSlug) {
      emitted.push(
      write({
        ctx,
        content: topFeed,
        slug: "index" as FullSlug,
        ext: ".xml",
      }),
      )
    }
    }

    // Generate ContentIndex
    const fp = joinSegments("static", "contentIndex") as FullSlug
    const simplifiedIndex = Object.fromEntries(
    (indexTree.spread() as ContentDetails[]).map((content) => {
      // remove description and from content index as nothing downstream
      // actually uses it. we only keep it in the index as we need it
      // for the RSS feed
      delete content.description
      delete content.date
      delete content.noRSS

      return [content.slug, content]
    }),
    )
    emitted.push(
    write({
      ctx,
      content: JSON.stringify(simplifiedIndex),
      slug: fp,
      ext: ".json",
    }),
    )

    // Promise<FilePath>[] -> Promise<FilePath[]>
    return Promise.all(emitted)
  },
  externalResources: (ctx) => {
    if (opts?.enableRSS) {
    return {
      additionalHead: [
      <link
        rel="alternate"
        type="application/rss+xml"
        title="RSS Feed"
        href={`https://${ctx.cfg.configuration.baseUrl}/${opts.rssSlug!}.xml`}
      />,
      ],
    }
    }
  },
  }
}

class Tree<T> {
  children: Set<Tree<T>>
  data: T
  childComparator: (a: T, b: T) => boolean

  constructor(data: T, childComparator: (a: T, b: T) => boolean, children?: Set<Tree<T>>) {
  this.data = data
  this.children = children ?? new Set<Tree<T>>()
  this.childComparator = childComparator
  }

  // BFS insertion-order traversal
  accept(visitor: Visitor<T>, parent?: Tree<T>) {
  visitor.visit(parent ?? this, this) // Root has no parent

  for (var child of this.children) {
    var childVisitor = visitor.descend(child)
    child.accept(childVisitor, this)
  }
  }

  // Visit children before parent
  acceptPostorder(visitor: Visitor<T>, parent?: Tree<T>) {
  let branchesFirst = [...this.children].toSorted((_, c2) => (c2.children.size > 0 ? 1 : -1))

  for (var child of branchesFirst) {
    var childVisitor = visitor.descend(child)
    child.acceptPostorder(childVisitor, this)
  }

  visitor.visit(parent ?? this, this)
  }

  child(data: T): Tree<T> {
  for (var child of this.children) {
    if (this.childComparator(child.data, data)) {
    return child
    }
  }

  return this.childFromTree(new Tree<T>(data, this.childComparator))
  }

  childFromTree(child: Tree<T>): Tree<T> {
  this.children.add(child)
  return child
  }

  // Convert entire tree to array of only its leaves
  // ex. Tree<TreeNode> -> ContentDetails[]
  spread(): T[] {
  var flattened: T[] = []

  const flatten = (tree: Tree<T>) => {
    for (let child of tree.children) {
    if (child.children.size == 0) flattened.push(child.data)
    else flatten(child)
    }
  }

  flatten(this)
  return flattened
  }
}

interface Visitor<T> {
  // Prefix action at each tree level
  descend: (tree: Tree<T>) => Visitor<T>

  // Action at each child of parent
  visit: (parent: Tree<T>, tree: Tree<T>) => void
}

// Hierarchy of directories with metadata children
// To be turned into a hierarchy of RSS text arrays generated from metadata children
type TreeNode = ContentDetails | Feed

// All of the files in one folder, as RSS entries
// Entry[] is the vehicle for composition while keeping content metadata intact
type Feed = {
  dir: FullSlug
  raw: Entry[]
  dirIndex?: ContentDetails
}
function defaultFeed(): Feed {
  return {
  dir: "index" as FullSlug,
  raw: new Array<Entry>(),
  }
}

type Entry = {
  item: string
  // Must be maintained for sorting purposes
  date: Date
  title: string
}

// Type guards
function isFeed(feed: TreeNode): boolean {
  return Object.hasOwn(feed, "dir")
}

function isContentDetails(details: TreeNode): boolean {
  return Object.hasOwn(details, "slug")
}

function compareTreeNodes(a: TreeNode, b: TreeNode) {
  let feedComp = isFeed(a) && isFeed(b) && (a as Feed).dir == (b as Feed).dir
  let contentComp =
  isContentDetails(a) && isContentDetails(b) && (a as ContentDetails) == (b as ContentDetails)
  return feedComp || contentComp
}

type IndexVisitor = Visitor<TreeNode> // ContentIndex in interface form

// Note: only use with acceptPostorder
class FeedGenerator implements IndexVisitor {
  ctx: BuildCtx
  cfg: GlobalConfiguration
  opts: Partial<Options>
  emitted: Promise<FilePath>[]

  constructor(
  ctx: BuildCtx,
  cfg: GlobalConfiguration,
  opts: Partial<Options>,
  emitted: Promise<FilePath>[],
  ) {
  this.ctx = ctx
  this.cfg = cfg
  this.opts = opts
  this.emitted = emitted
  }

  descend(_: ContentIndex): FeedGenerator {
  return this
  }

  visit(parent: ContentIndex, tree: ContentIndex) {
  // Compose direct child Feeds' Entry[]s with the current level
  // Because this Visitor visits bottom up, works at every level
  if (isFeed(tree.data)) {
    let feed = tree.data as Feed
    tree.children.forEach((child, _) => {
    if (isFeed(child.data)) feed.raw.push(...(child.data as Feed).raw)
    })
  }

  // Handle the top-level Feed separately
  // bfahrenfort: this is really just a design choice to preserve "index.xml";
  //  if desired we could generate it uniformly with the composition instead
  if (tree === parent) return

  if (tree.children.size == 0 && !(tree.data as ContentDetails).noRSS) {
    // Generate RSS item and push to parent Feed's Entry[]
    let feed = parent.data as Feed
    feed.raw.push(generateRSSEntry(this.cfg, tree.data as ContentDetails))
  }

  if (isFeed(tree.data)) {
    // Handle all non-index feeds
    let feed = tree.data as Feed
    if (!(feed.dirIndex?.noRSS ?? false)) {
    let ctx = this.ctx

    this.emitted.push(
      write({
      ctx,
      content: finishRSSFeed(this.cfg, this.opts, feed),
      slug: feed.dir,
      ext: ".rss",
      }),
    )
    }
  }
  }
}