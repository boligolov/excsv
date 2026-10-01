/**
 * Runs the website's ExCSV library against the #note / link= / #link fixtures
 * (features D9, D10 in fixtures/fixtures.yaml) and checks warnings, error kinds,
 * note resolution and per-cell links.
 *
 * Run: npx tsx scripts/check-notes-fixtures.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '..', '..', 'fixtures');

const { parseExcsvText } = await import('../src/lib/excsv/parse.ts');
const { mergeSidecar } = await import('../src/lib/excsv/sidecar.ts');
const { readPack } = await import('../src/lib/excsv/pack.ts');
const { readZipArchiveComment } = await import('../src/lib/excsv/zip.ts');
const { resolveNotes, resolveLinks } = await import('../src/lib/excsv/notes.ts');

const ANNOTATION_CODE = /^(note|link)_/;
const [, entries] = yaml.loadAll(readFileSync(resolve(fixtures, 'fixtures.yaml'), 'utf8'));
const targets = entries.filter((e) => e.exercises?.some((x) => x === 'D9' || x === 'D10') || e.id.includes('version_0_5'));

let failures = 0;
const check = (cond, id, msg) => {
  if (!cond) {
    failures++;
    console.error(`FAIL ${id}: ${msg}`);
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function load(entry) {
  const path = resolve(fixtures, entry.id);
  if (entry.id.endsWith('.pack.zip')) {
    const { doc, warnings } = await readPack(new Uint8Array(readFileSync(path)));
    const t = doc.tables[0];
    return { doc: { ...t, excsv: doc.excsv }, warnings };
  }
  if (entry.id.endsWith('.zip')) {
    return { doc: null, warnings: [], comment: readZipArchiveComment(new Uint8Array(readFileSync(path))) };
  }
  const text = readFileSync(path, 'utf8');
  if (entry.data_sibling) return mergeSidecar(text, readFileSync(resolve(fixtures, entry.data_sibling), 'utf8'));
  return parseExcsvText(text);
}

for (const entry of targets) {
  const { id, expect: x } = entry;
  let result;
  try {
    result = await load(entry);
  } catch (err) {
    if (x.parse === 'fail') {
      check(String(err.message).startsWith(`${x.error_kind}:`), id, `expected ${x.error_kind}, got "${err.message}"`);
    } else {
      check(false, id, `unexpected failure: ${err.message}`);
    }
    continue;
  }
  if (x.parse === 'fail') {
    check(false, id, `expected failure ${x.error_kind}, parsed ok`);
    continue;
  }

  if (result.comment !== undefined) {
    if (x.comment?.ends_with) check(result.comment.endsWith(x.comment.ends_with), id, `comment does not end with ${x.comment.ends_with}`);
    continue;
  }

  const { doc, warnings } = result;
  // Only annotation codes are asserted here; other codes belong to other features' checks.
  const got = [...new Set(warnings.map((w) => w.code).filter((c) => ANNOTATION_CODE.test(c)))].sort();
  const want = [...new Set((x.warnings ?? []).filter((c) => ANNOTATION_CODE.test(c)))].sort();
  check(same(got, want), id, `warnings ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
  if (x.header?.version) check(doc.excsv === x.header.version, id, `version ${doc.excsv} != ${x.header.version}`);
  if (id.includes('version_0_5')) check(!warnings.some((w) => w.code === 'unknown_version'), id, 'unknown_version on 0.5');

  const ctx = { columns: doc.columns ?? [], data: doc.data ?? [], header0: doc.csv?.header === false };
  if (x.notes) {
    const resolved = resolveNotes(doc.notes ?? [], ctx);
    check(resolved.length === x.notes.count, id, `notes.count ${resolved.length} != ${x.notes.count}`);
    if (x.notes.targets) check(same(resolved.map((r) => r.target), x.notes.targets), id, `targets ${resolved.map((r) => r.target)}`);
    if (x.notes.resolved_rows) {
      const rows = resolved.map((r) => (r.resolved && r.row !== null ? r.row : null));
      check(same(rows, x.notes.resolved_rows), id, `resolved_rows ${JSON.stringify(rows)}`);
    }
    if (x.notes.texts) check(same(resolved.map((r) => r.note.text), x.notes.texts), id, 'texts differ');
  }
  if (x.links?.count !== undefined) check((doc.links ?? []).length === x.links.count, id, `links.count ${(doc.links ?? []).length}`);
  if (x.cell_links) {
    const { links } = resolveLinks(doc.links ?? [], ctx);
    const names = (doc.columns ?? []).filter((c) => c.index !== undefined).map((c) => c.name);
    for (const [cell, url] of Object.entries(x.cell_links)) {
      const [r, colRef] = cell.split(',');
      const c = /^\d+$/.test(colRef) && ctx.header0 ? Number(colRef) : names.indexOf(colRef);
      const actual = links[Number(r)]?.[c] ?? null;
      check(actual === url, id, `cell ${cell}: ${actual} != ${url}`);
    }
  }
}

// JSON round-trip keeps notes and links.
{
  const { serializeExcsvJson, serializeExcsvText } = await import('../src/lib/excsv/serialize.ts');
  const { parseJsonInput } = await import('../src/lib/excsv/parse.ts');
  for (const name of ['079_note_key_anchor', '088_link_cell_override', '083_note_header0_index']) {
    const id = `plain/valid/${name}.excsv`;
    const { doc } = parseExcsvText(readFileSync(resolve(fixtures, id), 'utf8'));
    const back = parseExcsvText(serializeExcsvText(parseJsonInput(serializeExcsvJson(doc))).text).doc;
    check(same(back.notes, doc.notes) && same(back.links, doc.links), id, 'text → JSON → text lost notes/links');
  }
}

console.log(`${targets.length} fixtures checked, ${failures} failure(s)`);
process.exitCode = failures ? 1 : 0;
