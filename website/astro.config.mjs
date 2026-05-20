import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://excsv.org',
  output: 'static',
  adapter: cloudflare(),
  integrations: [
    sitemap({
      changefreq: 'monthly',
      lastmod: new Date(),
      customPages: [
        'https://excsv.org/',
        'https://excsv.org/spec/',
        'https://excsv.org/examples/',
      ],
      serialize(item) {
        if (item.url === 'https://excsv.org/') {
          item.priority = 1.0;
          item.changefreq = 'monthly';
        } else if (item.url === 'https://excsv.org/spec/') {
          item.priority = 0.9;
        } else if (item.url === 'https://excsv.org/examples/') {
          item.priority = 0.8;
        }
        return item;
      },
    }),
  ],
});