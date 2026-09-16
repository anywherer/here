import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://somewherer.com',
  scopedStyleStrategy: 'where',
  trailingSlash: 'never',
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
});