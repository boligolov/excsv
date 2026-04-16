import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://excsv.org',
  output: 'static',
  adapter: cloudflare(),
});