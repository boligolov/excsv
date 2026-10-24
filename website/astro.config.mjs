import { execFileSync } from 'node:child_process';
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

const site = 'https://excsv.dev';

// lastmod = date of the last commit touching the page's source file, so it only
// moves when the page does. Left out when git has no answer (e.g. no history).
function lastmod(url) {
  const path = url.slice(site.length).replace(/^\/|\/$/g, '');
  const candidates = path ? [`src/pages/${path}.astro`, `src/pages/${path}/index.astro`] : ['src/pages/index.astro'];
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...candidates], { encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const priority = {
  [`${site}/`]: 1.0,
  [`${site}/spec/`]: 0.9,
  [`${site}/examples/`]: 0.8,
  [`${site}/tools/`]: 0.7,
};

export default defineConfig({
  site,
  output: 'static',
  adapter: cloudflare(),
  integrations: [
    sitemap({
      changefreq: 'monthly',
      serialize(item) {
        item.lastmod = lastmod(item.url);
        if (item.url in priority) item.priority = priority[item.url];
        return item;
      },
    }),
  ],
});
