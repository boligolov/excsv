// Copies the canonical ExCSV JSON Schema (repo-root schema/) into the website's
// public/ tree so it is served at the URL declared in the schema's own $id.
// Runs automatically via the `prebuild` / `predev` npm hooks. Keep the repo-root
// file as the single source of truth; do not edit the generated public copy.
//
// The destination filename is derived from $id, not hardcoded — bumping the
// spec version means editing $id in schema/excsv.schema.json and nothing here.
// Older versioned files already in public/schema/ (e.g. excsv-0.4.schema.json)
// are historical snapshots of what that URL actually served; this script only
// ever writes the *current* $id's filename, so it never touches them.
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const outDir = resolve(here, '..', 'public', 'schema');

const schemaSrc = resolve(repoRoot, 'schema/excsv.schema.json');
const schema = JSON.parse(readFileSync(schemaSrc, 'utf8'));
const id = schema.$id;
const match = typeof id === 'string' && id.match(/\/([^/]+\.schema\.json)$/);
if (!match) {
  throw new Error(`schema/excsv.schema.json: $id "${id}" doesn't end in .../<name>.schema.json — can't derive a public filename`);
}
const destName = match[1];

const files = [
  ['schema/excsv.schema.json', destName],
  ['schema/example.excsv.json', 'example.excsv.json'],
];

mkdirSync(outDir, { recursive: true });
for (const [src, dest] of files) {
  copyFileSync(resolve(repoRoot, src), resolve(outDir, dest));
  console.log(`synced ${src} -> public/schema/${dest}`);
}
