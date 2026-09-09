import { QuartzTransformerPlugin } from "../types"
import { FullSlug } from "../../util/path"

export const CanonicalSlug: QuartzTransformerPlugin = () => {
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

          // 1. Root index guard: NEVER alter the homepage slug
          const isRootIndex =
            file.data.slug === "index" ||
            file.data.filePath?.toLowerCase() === "index.md"

          if (isRootIndex) {
            // Remove frontmatter permalink so AliasRedirects doesn't collide with homepage
            if (file.data.frontmatter?.permalink) {
              delete file.data.frontmatter.permalink
            }
            return
          }

          // 2. Clean and format slug
          const clean = rawSlug.trim().replace(/\.(md|html)$/i, "")

          // Prevent any other note from hijacking the root "index"
          if (clean === "/" || clean === "" || clean.toLowerCase() === "index") {
            return
          }

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

          if (!normalized || normalized === "index") return

          const newSlug = normalized as FullSlug
          const originalSlug = file.data.slug

          // 3. Promote note to canonical slug
          file.data.slug = newSlug

          // 4. Delete permalink field so AliasRedirects does not loop
          if (file.data.frontmatter?.permalink) {
            delete file.data.frontmatter.permalink
          }

          // 5. Register original path as an alias so backlinks and wikilinks resolve.
          // Guard: NEVER allow "index" into aliases, or it will overwrite public/index.html.
          if (
            originalSlug &&
            originalSlug !== newSlug &&
            originalSlug !== "index" &&
            file.data.frontmatter
          ) {
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