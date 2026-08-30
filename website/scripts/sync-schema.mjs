// Copies the canonical ExCSV JSON Schema (repo-root schema/) into the website's
// public/ tree so it is served at the URL declared in the schema's $id:
//   https://excsv.org/schema/excsv-0.4.schema.json
// Runs automatically via the `prebuild` / `predev` npm hooks. Keep the repo-root
// file as the single source of truth; do not edit the generated public copy.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const outDir = resolve(here, '..', 'public', 'schema');

const files = [
  ['schema/excsv.schema.json', 'excsv-0.4.schema.json'],
  ['schema/example.excsv.json', 'example.excsv.json'],
];

mkdirSync(outDir, { recursive: true });
for (const [src, destName] of files) {
  copyFileSync(resolve(repoRoot, src), resolve(outDir, destName));
  console.log(`synced ${src} -> public/schema/${destName}`);
}
