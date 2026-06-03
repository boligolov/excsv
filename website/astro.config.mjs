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
        'https://excsv.org/variants/',
        'https://excsv.org/variants/plain/',
        'https://excsv.org/variants/sidecar/',
        'https://excsv.org/variants/zip/',
        'https://excsv.org/variants/pack/',
        'https://excsv.org/spec/',
        'https://excsv.org/examples/',
        'https://excsv.org/tools/',
      ],
      serialize(item) {
        if (item.url === 'https://excsv.org/') {
          item.priority = 1.0;
          item.changefreq = 'monthly';
        } else if (item.url === 'https://excsv.org/spec/') {
          item.priority = 0.9;
        } else if (item.url === 'https://excsv.org/examples/') {
          item.priority = 0.8;
        } else if (item.url === 'https://excsv.org/tools/') {
          item.priority = 0.7;
        }
        return item;
      },
    }),
  ],
});