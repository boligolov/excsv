// Publishes the agent skill (repo-root skills/excsv/) on the website:
//   public/skills/excsv.zip  — the skill folder, unzips to excsv/SKILL.md, excsv/references/…
//   public/skills/excsv/…    — the same files unzipped, for agents that fetch them one by one
// Runs automatically via the `prebuild` / `predev` npm hooks. Keep skills/excsv/
// as the single source of truth; do not edit the generated public copy.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const skillDir = resolve(repoRoot, 'skills', 'excsv');
const outDir = resolve(here, '..', 'public', 'skills');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const files = walk(skillDir).sort();
if (!files.some((f) => relative(skillDir, f) === 'SKILL.md')) {
  throw new Error(`${skillDir}: no SKILL.md`);
}

rmSync(outDir, { recursive: true, force: true });
const entries = {};
// Fixed mtime so the archive only changes when the skill does.
const mtime = new Date('2026-01-01T00:00:00Z');
for (const file of files) {
  const rel = relative(skillDir, file).split('\\').join('/');
  const data = readFileSync(file);
  entries[`excsv/${rel}`] = [data, { mtime }];
  const dest = resolve(outDir, 'excsv', rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, data);
  console.log(`synced skills/excsv/${rel} -> public/skills/excsv/${rel}`);
}
writeFileSync(resolve(outDir, 'excsv.zip'), zipSync(entries, { level: 9 }));
console.log(`wrote public/skills/excsv.zip (${files.length} files)`);
