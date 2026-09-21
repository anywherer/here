import { defineConfig } from 'astro/config';

function remarkHighlight() {
  function walk(node) {
    if (!node || !node.children) return;
    const newChildren = [];

    for (const child of node.children) {
      if (child.type === 'text' && child.value.includes('==')) {
        const regex = /(==[^\s=](?:[\s\S]*?[^\s=])?==)/g;
        const parts = child.value.split(regex);

        for (const part of parts) {
          if (part.startsWith('==') && part.endsWith('==') && part.length >= 4) {
            newChildren.push({
              type: 'html',
              value: `<mark>${part.slice(2, -2)}</mark>`,
            });
          } else if (part) {
            newChildren.push({ type: 'text', value: part });
          }
        }
      } else {
        walk(child);
        newChildren.push(child);
      }
    }
    node.children = newChildren;
  }

  return (tree) => walk(tree);
}

export default defineConfig({
  site: 'https://somewherer.com',
  scopedStyleStrategy: 'where',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  markdown: {
    remarkPlugins: [remarkHighlight],
  },
  vite: {
    build: {
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules') || id.includes('_astro')) {
              return 'main';
            }
          },
        },
      },
    },
  },
});