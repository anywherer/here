import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import { QuartzTransformerPlugin } from "./quartz/plugins/types"
import { FilePath, FullSlug, slugifyFilePath } from "./quartz/util/path"

// Custom transformer to overwrite canonical slug using frontmatter permalink/slug
const CustomSlug: QuartzTransformerPlugin = () => ({
  name: "CustomSlug",
  markdownPlugins() {
    return [
      () => (_tree, file) => {
        const customSlug = file.data.frontmatter?.permalink || file.data.frontmatter?.slug
        if (typeof customSlug === "string" && customSlug.trim() !== "") {
          // Strip any accidental leading/trailing slashes, then slugify
          const clean = customSlug.replace(/^\/+|\/+$/g, "") as FilePath
          file.data.slug = slugifyFilePath(clean) as FullSlug
        }
      },
    ]
  },
})


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
      // fontOrigin: "googleFonts",
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
      CustomSlug(),
      Plugin.HardLineBreaks(),
      Plugin.FrontMatter(),
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
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
