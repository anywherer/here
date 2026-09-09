import { QuartzConfig } from "./quartz/cfg"
import { QuartzTransformerPlugin } from "./quartz/plugins/types"
import { FullSlug } from "./quartz/util/path"
import * as Plugin from "./quartz/plugins"

/**
 * Custom transformer to set the canonical URL from `permalink` or `slug` frontmatter.
 */
const CanonicalSlug: QuartzTransformerPlugin = () => {
  return {
    name: "CanonicalSlug",
    markdownPlugins() {
      return [
        () => (_tree, file) => {
          const rawSlug =
            file.data.frontmatter?.permalink ?? file.data.frontmatter?.slug

          if (typeof rawSlug !== "string" || !rawSlug.trim()) {
            return
          }

          // Strip extensions and normalize slashes
          const clean = rawSlug.trim().replace(/\.(md|html)$/i, "")
          let newSlug: FullSlug

          if (clean === "/" || clean === "") {
            newSlug = "index" as FullSlug
          } else {
            const normalized = clean
              .replace(/^\/+|\/+$/g, "")
              .split("/")
              .map((seg) =>
                seg
                  .trim()
                  .replace(/\s+/g, "-")
                  .replace(/["'#?&%]/g, ""),
              )
              .filter(Boolean)
              .join("/")

            if (!normalized) return
            newSlug = normalized as FullSlug
          }

          const originalSlug = file.data.slug

          // 1. Promote to canonical slug
          file.data.slug = newSlug

          // 2. Delete permalink so AliasRedirects does not overwrite the real HTML with a redirect to itself
          if (file.data.frontmatter?.permalink) {
            delete file.data.frontmatter.permalink
          }

          // 3. Register the original disk path as an alias so backlinks/wikilinks still resolve
          if (originalSlug && originalSlug !== newSlug && file.data.frontmatter) {
            const existingAliases =
              file.data.frontmatter.aliases ?? file.data.frontmatter.alias ?? []
            const aliasList: string[] = Array.isArray(existingAliases)
              ? [...existingAliases]
              : [existingAliases]

            if (!aliasList.includes(originalSlug)) {
              aliasList.push(originalSlug)
            }
            file.data.frontmatter.aliases = aliasList
          }
        },
      ]
    },
  }
}

const config: QuartzConfig = {
  configuration: {
    pageTitle: "here ♡",
    pageTitleSuffix: " ♡",
    enableSPA: true,
    enablePopovers: false,
    analytics: null,
    locale: "en-US",
    baseUrl: "somewherer.com",
    ignorePatterns: ["assets/*.md", "drafts", "temp", "private", "plugins", ".obsidian"],
    defaultDateType: "published",
    theme: {
      cdnCaching: true,
      typography: {
        header: "sans-serif",
        body: "sans-serif",
        code: "monospace",
      },
      colors: {
        lightMode: {
          light: "#ffffff",
          lightgray: "#eaeaea",
          gray: "#7b7b7b",
          darkgray: "#000000",
          dark: "#000000",
          secondary: "#12546f",
          tertiary: "#12546f",
          highlight: "rgba(75, 194, 128, 0.1)",
          textHighlight: "#b3aa0288",
        },
        darkMode: {
          light: "#000000",
          lightgray: "#333333",
          gray: "#cccccc",
          darkgray: "#ffffff",
          dark: "#ffffff",
          secondary: "#b1f4ff",
          tertiary: "#b1f4ff",
          highlight: "rgba(122, 255, 187, 0.2)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.HardLineBreaks(),
      Plugin.FrontMatter(),
      CanonicalSlug(), // <--- Placed right after FrontMatter is parsed
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({
        markdownLinkResolution: "shortest",
        openLinksInNewTab: true,
      }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [
      Plugin.RemoveDrafts(),
      Plugin.ExplicitPublish(),
    ],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
        rssFullHtml: true,
        rssLimit: 1024,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config