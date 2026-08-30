import { strFromU8, strToU8 } from 'fflate';
import { parseCell, parseExcsvText } from './parse';
import { parseKvPairs } from './kv';
import { serializeExcsvText } from './serialize';
import { readZipEntries, writeZipBundle, buildZipArchiveComment } from './zip';
import type { Cell, Column, ConvertWarning, ExcsvDocument, PackTable } from './types';

function colPayload(values: string[]): Uint8Array {
  return strToU8(values.join('\n') + (values.length ? '\n' : ''));
}

function safeColName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '') || 'col';
}

function readColLines(text: string, columns: Column[] | undefined, colIdx: number, nullMarkers: Set<string>): Cell[] {
  const lines = text.replace(/\n$/, '').split('\n');
  return lines.map((line) => parseCell(line, columns?.[colIdx], nullMarkers));
}

function columnsToRows(columns: Cell[][]): Cell[][] {
  const n = columns[0]?.length ?? 0;
  const rows: Cell[][] = [];
  for (let r = 0; r < n; r++) {
    rows.push(columns.map((col) => col[r]));
  }
  return rows;
}

function readFlatColumns(
  files: Record<string, Uint8Array>,
  tableDir: string,
  columns: Column[] | undefined,
  nullMarkers: Set<string>,
): Cell[][] {
  const prefix = tableDir.endsWith('/') ? tableDir : `${tableDir}/`;
  const found: { idx: number; values: Cell[] }[] = [];

  for (const [path, data] of Object.entries(files)) {
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    if (rel.includes('/') || !rel.endsWith('.col')) continue;
    const m = rel.match(/^(\d+)(?:-[^.]+)?\.col$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    found.push({
      idx,
      values: readColLines(strFromU8(data), columns, idx, nullMarkers),
    });
  }

  found.sort((a, b) => a.idx - b.idx);
  return found.map((f) => f.values);
}

function readSectionedColumns(
  files: Record<string, Uint8Array>,
  tableDir: string,
  columns: Column[] | undefined,
  nullMarkers: Set<string>,
): Cell[][] {
  const prefix = tableDir.endsWith('/') ? tableDir : `${tableDir}/`;
  const folders = new Map<number, string>();

  for (const path of Object.keys(files)) {
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    const m = rel.match(/^(\d+)-[^/]+\/(\d+)\.col$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (!folders.has(idx)) folders.set(idx, `${prefix}${rel.split('/')[0]}/`);
  }

  const result: Cell[][] = [];
  const indices = [...folders.keys()].sort((a, b) => a - b);
  for (const idx of indices) {
    const folder = folders.get(idx)!;
    const parts: { start: number; values: Cell[] }[] = [];
    for (const [path, data] of Object.entries(files)) {
      if (!path.startsWith(folder) || !path.endsWith('.col')) continue;
      const start = parseInt(path.slice(folder.length).replace('.col', ''), 10);
      parts.push({
        start,
        values: readColLines(strFromU8(data), columns, idx, nullMarkers),
      });
    }
    parts.sort((a, b) => a.start - b.start);
    result.push(parts.flatMap((p) => p.values));
  }
  return result;
}

function parseManifestTables(manifestText: string): { name: string; dir: string }[] {
  const tables: { name: string; dir: string }[] = [];
  for (const line of manifestText.split('\n')) {
    if (!line.startsWith('#table')) continue;
    const attrs = parseKvPairs(line.slice('#table'.length).trim());
    if (attrs.name && attrs.dir) {
      tables.push({ name: attrs.name, dir: attrs.dir.replace(/\/$/, '') + '/' });
    } else if (attrs.name) {
      tables.push({ name: attrs.name, dir: `${attrs.name}/` });
    }
  }
  return tables;
}

function discoverTables(files: Record<string, Uint8Array>): { name: string; dir: string }[] {
  const dirs = new Set<string>();
  for (const path of Object.keys(files)) {
    const m = path.match(/^([^/]+)\/_header\.excsv$/);
    if (m) dirs.add(`${m[1]}/`);
  }
  return [...dirs].sort().map((dir) => ({ name: dir.replace(/\/$/, ''), dir }));
}

async function readTableFromZip(
  files: Record<string, Uint8Array>,
  tableDir: string,
  tableName: string,
  warnings: ConvertWarning[],
): Promise<PackTable> {
  const headerPath = `${tableDir}_header.excsv`;
  const headerBytes = files[headerPath];
  if (!headerBytes) throw new Error(`Missing ${headerPath} in pack.`);

  const { doc: headerDoc, warnings: hw } = parseExcsvText(strFromU8(headerBytes));
  warnings.push(...hw);

  const nullMarkers = new Set(headerDoc.csv?.null ?? []);
  let colArrays = readFlatColumns(files, tableDir, headerDoc.columns, nullMarkers);
  if (!colArrays.length) {
    colArrays = readSectionedColumns(files, tableDir, headerDoc.columns, nullMarkers);
  }

  const data = columnsToRows(colArrays);

  return {
    name: tableName,
    dir: tableDir,
    meta: headerDoc.meta,
    csv: headerDoc.csv,
    columns: headerDoc.columns,
    aggregates: headerDoc.aggregates,
    sql: headerDoc.sql,
    checksum: headerDoc.checksum,
    rows: headerDoc.rows ?? data.length,
    data,
  };
}

export async function readPack(
  bytes: Uint8Array,
): Promise<{ doc: ExcsvDocument; warnings: ConvertWarning[] }> {
  const warnings: ConvertWarning[] = [];
  const files = await readZipEntries(bytes);

  const manifestBytes = files['_manifest.excsv'];
  if (!manifestBytes) throw new Error('Pack archive missing _manifest.excsv.');

  const manifestText = strFromU8(manifestBytes);
  const { doc: manifest, warnings: mw } = parseExcsvText(manifestText);
  warnings.push(...mw);
  manifest.layout = 'pack';

  let tableSpecs = parseManifestTables(manifestText);
  if (!tableSpecs.length) {
    tableSpecs = discoverTables(files);
    warnings.push({
      code: 'pack_autodiscover',
      message: 'Manifest had no #table lines; discovered tables from directories.',
    });
  }

  const tables: PackTable[] = [];
  for (const spec of tableSpecs) {
    tables.push(await readTableFromZip(files, spec.dir, spec.name, warnings));
  }

  manifest.tables = tables;
  delete manifest.columns;
  delete manifest.data;
  delete manifest.aggregates;
  delete manifest.sql;
  delete manifest.reference;

  return { doc: manifest, warnings };
}

function tableHeaderText(table: PackTable): string {
  const rows = table.data?.length ?? table.rows ?? 0;
  const headerParts = ['#!excsv version=0.4 layout=columnar', `rows=${rows}`];
  if (table.sectionSize) headerParts.push(`section-size=${table.sectionSize}`);
  if (table.csv?.delim && table.csv.delim !== 'comma') headerParts.push(`delim=${table.csv.delim}`);
  if (table.csv?.quote && table.csv.quote !== 'none') headerParts.push(`quote=${table.csv.quote}`);
  if (table.csv?.header === false) headerParts.push('header=0');
  if (table.csv?.encoding && table.csv.encoding !== 'UTF-8') headerParts.push(`encoding=${table.csv.encoding}`);
  if (table.csv?.null?.length === 1) headerParts.push(`null=${table.csv.null[0]}`);

  const subDoc: ExcsvDocument = {
    excsv: '0.4',
    csv: table.csv,
    meta: table.meta,
    columns: table.columns,
    aggregates: table.aggregates,
    sql: table.sql,
    checksum: table.checksum,
    rows,
  };
  const { text } = serializeExcsvText(subDoc);
  const metaLines = text
    .split('\n')
    .filter((l) => l.startsWith('#') && !l.startsWith('#!'))
    .join('\n');
  return headerParts.join(' ') + (metaLines ? '\n' + metaLines : '') + '\n';
}

function tableZipEntries(table: PackTable): { entries: [string, Uint8Array][]; payloadSize: number } {
  const dir = table.dir ?? `${table.name}/`;
  const entries: [string, Uint8Array][] = [];
  let payloadSize = 0;

  const header = tableHeaderText(table);
  entries.push([`${dir}_header.excsv`, strToU8(header)]);

  if (!table.data?.length || !table.columns?.length) return { entries, payloadSize };

  const colCount = table.columns.length;
  for (let i = 0; i < colCount; i++) {
    const col = table.columns[i];
    const name = col.name ?? `col${i}`;
    const values = table.data.map((row) => {
      const cell = row[i];
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'boolean') return cell ? 'true' : 'false';
      return String(cell);
    });
    const path = `${dir}${String(i).padStart(2, '0')}-${safeColName(name)}.col`;
    const payload = colPayload(values);
    entries.push([path, payload]);
    payloadSize += payload.length;
  }

  return { entries, payloadSize };
}

function manifestText(doc: ExcsvDocument, payloadSizes: number[]): string {
  const tables = doc.tables ?? [];
  const originalSize = payloadSizes.reduce((a, b) => a + b, 0);
  const parts = [
    `#!excsv version=${doc.excsv} layout=pack`,
    `table-count=${tables.length}`,
    `original-size=${originalSize}`,
  ];
  if (tables.length === 1) parts.splice(2, 0, `single-table=${tables[0].name}`);

  const lines = [parts.join(' ')];
  if (doc.meta) {
    for (const [k, v] of Object.entries(doc.meta)) {
      if (k === 'tags' && Array.isArray(v)) lines.push(`#@tags: ${v.join(',')}`);
      else lines.push(`#@${k}: ${String(v)}`);
    }
  }
  tables.forEach((t, i) => {
    const dir = t.dir ?? `${t.name}/`;
    const cols = t.columns?.length ?? 0;
    lines.push(`#table name=${t.name} dir=${dir} columns=${cols} original-size=${payloadSizes[i] ?? 0}`);
  });
  if (doc.fk) {
    for (const link of doc.fk) {
      lines.push(`#fk from=${link.from} to=${link.to}`);
    }
  }
  return lines.join('\n') + '\n';
}

export async function writePack(
  doc: ExcsvDocument,
): Promise<{ bytes: Uint8Array; warnings: ConvertWarning[] }> {
  const warnings: ConvertWarning[] = [];
  if (!doc.tables?.length) throw new Error('Pack output requires tables[] with at least one table.');

  const allEntries: Record<string, Uint8Array> = {};
  const payloadSizes: number[] = [];

  for (const table of doc.tables) {
    if (!table.data?.length) {
      warnings.push({
        code: 'pack_table_empty',
        message: `Table "${table.name}" has no data; writing header only.`,
      });
    }
    const { entries, payloadSize } = tableZipEntries(table);
    payloadSizes.push(payloadSize);
    for (const [path, data] of entries) allEntries[path] = data;
  }

  const manifest = manifestText(doc, payloadSizes);
  allEntries['_manifest.excsv'] = strToU8(manifest);

  const comment = buildZipArchiveComment(manifest);
  const ordered: Record<string, Uint8Array> = { '_manifest.excsv': allEntries['_manifest.excsv'] };
  for (const [path, data] of Object.entries(allEntries)) {
    if (path !== '_manifest.excsv') ordered[path] = data;
  }

  const bytes = await writeZipBundle(ordered, comment);
  return { bytes, warnings };
}

export function inlineToPack(doc: ExcsvDocument, tableName = 'data'): ExcsvDocument {
  if (doc.layout === 'pack' && doc.tables?.length) return doc;
  return {
    excsv: doc.excsv,
    layout: 'pack',
    meta: doc.meta,
    fk: doc.fk,
    tables: [
      {
        name: tableName,
        dir: `${tableName}/`,
        meta: doc.meta,
        csv: doc.csv,
        columns: doc.columns,
        aggregates: doc.aggregates,
        sql: doc.sql,
        checksum: doc.checksum,
        rows: doc.rows,
        data: doc.data,
      },
    ],
  };
}

export function packToInline(doc: ExcsvDocument): ExcsvDocument {
  if (!doc.tables?.length) throw new Error('Pack document has no tables.');
  if (doc.tables.length > 1) {
    throw new Error('Pack has multiple tables; convert to JSON or pick a single table first.');
  }
  const t = doc.tables[0];
  return {
    excsv: doc.excsv,
    layout: 'inline',
    meta: { ...doc.meta, ...t.meta },
    csv: t.csv,
    columns: t.columns,
    aggregates: t.aggregates,
    sql: t.sql,
    checksum: t.checksum,
    rows: t.rows,
    data: t.data,
  };
}
