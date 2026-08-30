/**
 * Quick smoke test for convertFormat — run: node --import tsx scripts/smoke-convert.mjs
 * Or: npx tsx scripts/smoke-convert.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

const { convertFormat } = await import('../src/lib/excsv/convert-format.ts');
const { mergeSidecar } = await import('../src/lib/excsv/sidecar.ts');

const plain = readFileSync(resolve(repo, 'fixtures/plain/valid/020_canonical_full_small.excsv'), 'utf8');

async function round(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}:`, e.message);
    process.exitCode = 1;
  }
}

await round('plain → json', async () => {
  const out = await convertFormat({ text: plain }, 'json');
  if (!out.text?.includes('"excsv"')) throw new Error('no json');
});

await round('plain → json → plain', async () => {
  const j = await convertFormat({ text: plain }, 'json');
  const back = await convertFormat({ text: j.text }, 'plain');
  if (!back.text?.startsWith('#!excsv')) throw new Error('not excsv');
});

await round('plain → zip → plain', async () => {
  const z = await convertFormat({ text: plain, filename: 'test.excsv' }, 'zip');
  if (!z.bytes?.length) throw new Error('no zip bytes');
  const back = await convertFormat({ bytes: z.bytes, filename: 'test.excsv.zip' }, 'plain');
  if (!back.text?.includes('#column')) throw new Error('missing columns');
});

await round('plain → sidecar merge', async () => {
  const sidecar = readFileSync(
    resolve(repo, 'fixtures/plain/valid/037_sidecar_csv_sibling.excsv'),
    'utf8',
  );
  const csv = readFileSync(
    resolve(repo, 'fixtures/plain/valid/037_sidecar_csv_sibling.csv'),
    'utf8',
  );
  const { doc } = mergeSidecar(sidecar, csv);
  if (doc.data?.length !== 2) throw new Error(`expected 2 rows, got ${doc.data?.length}`);
  const j = await convertFormat({ text: sidecar, sidecarData: csv }, 'json');
  if (!j.text?.includes('"data"')) throw new Error('no data in json');
});

await round('plain → pack → json', async () => {
  const p = await convertFormat({ text: plain, filename: 'test.excsv' }, 'pack');
  if (!p.bytes?.length) throw new Error('no pack bytes');
  const j = await convertFormat({ bytes: p.bytes, filename: 'test.excsv.pack.zip' }, 'json');
  if (!j.text?.includes('"tables"')) throw new Error('no tables in pack json');
});

await round('csv → plain', async () => {
  const csv = 'id,name\n1,Alice\n2,Bob\n';
  const out = await convertFormat({ text: csv, format: 'csv' }, 'plain');
  if (!out.text?.startsWith('#!excsv')) throw new Error('not excsv');
  if (!out.text?.includes('#column name=id')) throw new Error('missing id column');
});

await round('csv → json', async () => {
  const csv = 'amount\n500.00\n250.50\n';
  const out = await convertFormat({ text: csv, format: 'csv', filename: 'sales.csv' }, 'json');
  if (!out.text?.includes('"index": 0')) throw new Error('missing column index');
  if (!out.text?.includes('"type": "decimal"')) throw new Error('type not inferred');
});

await round('zip/pack archive comments', async () => {
  const { readZipArchiveComment } = await import('../src/lib/excsv/zip.ts');
  const csv = 'id,amount\n1,500.00\n2,250.50\n';
  const z = await convertFormat({ text: csv, format: 'csv', filename: 'sales.csv' }, 'zip');
  const zc = readZipArchiveComment(z.bytes);
  if (!zc?.startsWith('#!excsv')) throw new Error('zip comment missing #!excsv');
  if (!zc.includes('#column')) throw new Error('zip comment missing columns');
  const p = await convertFormat({ text: csv, format: 'csv', filename: 'sales.csv' }, 'pack');
  const pc = readZipArchiveComment(p.bytes);
  if (!pc?.startsWith('#!excsv')) throw new Error('pack comment missing #!excsv');
  if (!pc.includes('#table')) throw new Error('pack comment missing #table');
});

console.log('done');
