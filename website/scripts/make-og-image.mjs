// Renders public/og.png (1200x630), the social-share image referenced by
// og:image in src/layouts/Base.astro. Run by hand when the tagline changes:
//   node scripts/make-og-image.mjs
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'public', 'og.png');

const sans = 'Segoe UI, system-ui, Helvetica, Arial, sans-serif';
const mono = 'Consolas, Cascadia Code, Menlo, monospace';
const code = [
  ['#!excsv version=0.6 delim=comma header=1 rows=3', true],
  ['#@grain: one row per order', true],
  ['#column name=amount type=decimal unit=USD', true],
  ['#%sum: ,,870.50', true],
  ['id,customer,amount', false],
  ['1,Acme Corp,500.00', false],
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="12" fill="#217346"/>
  <rect x="80" y="84" width="92" height="68" rx="10" fill="#217346"/>
  <text x="126" y="134" text-anchor="middle" font-family="${sans}" font-weight="700" font-size="44" fill="#ffffff">Ex</text>
  <text x="188" y="136" font-family="${sans}" font-weight="700" font-size="52" fill="#1a1a1a">CSV</text>
  <text x="80" y="250" font-family="${sans}" font-weight="700" font-size="68" fill="#1a1a1a">CSV, but self-describing</text>
  <text x="80" y="306" font-family="${sans}" font-size="30" fill="#6b7280">Types, units, stats, and SQL travel with the rows.</text>
  <rect x="80" y="350" width="1040" height="216" rx="12" fill="#f5f5f7" stroke="#e5e7eb"/>
  ${code.map(([line, meta], i) => `<text x="108" y="${392 + i * 30}" font-family="${mono}" font-size="23" fill="${meta ? '#217346' : '#1a1a1a'}" xml:space="preserve">${line}</text>`).join('\n  ')}
  <text x="1120" y="134" text-anchor="end" font-family="${sans}" font-weight="500" font-size="28" fill="#6b7280">excsv.dev</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`wrote ${out}`);
