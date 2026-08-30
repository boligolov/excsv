import { parseCsvRow, resolveDelim, resolveQuote, splitLines } from './csv';
import { parseKvPairs } from './kv';
import { normalizeDocForJson } from './serialize';
import type { Cell, Column, ConvertWarning, ExcsvDocument, PackTable, SqlStatement } from './types';

const BOOL_ATTRS = new Set(['unique', 'required']);
const INT_ATTRS = new Set(['len_min', 'len_max', 'index']);

export function parseExcsvText(text: string): { doc: ExcsvDocument; warnings: ConvertWarning[] } {
  const warnings: ConvertWarning[] = [];
  const lines = splitLines(text).filter((line, idx, arr) => {
    // keep empty lines only if they're part of data; trim trailing empties at end
    if (line === '' && idx === arr.length - 1) return false;
    return true;
  });

  if (lines.length === 0) {
    throw new Error('Empty input');
  }

  let lineIdx = 0;
  let headerPairs: Record<string, string> = {};

  if (lines[0].startsWith('#!excsv')) {
    headerPairs = parseKvPairs(lines[0].slice('#!excsv'.length));
    lineIdx = 1;
  } else if (lines[0].startsWith('#')) {
    headerPairs = { version: '0.4' };
    warnings.push({ code: 'no_header', message: 'No #!excsv line; assuming version=0.4 defaults.' });
  } else {
    headerPairs = { version: '0.4' };
    warnings.push({ code: 'no_header', message: 'No #!excsv line; treating entire input as CSV data.' });
  }

  const csv = headerToCsv(headerPairs);
  const delim = resolveDelim(csv.delim);
  const quote = resolveQuote(csv.quote);
  const hasHeaderRow = csv.header !== false;
  const nullMarkers = new Set(csv.null ?? []);

  const doc: ExcsvDocument = {
    excsv: headerPairs.version ?? '0.4',
    csv,
  };

  if (headerPairs.rows !== undefined) doc.rows = parseInt(headerPairs.rows, 10);
  if (headerPairs.checksum) doc.checksum = headerPairs.checksum;
  if (headerPairs.reference) {
    doc.reference = headerPairs.reference;
    doc.layout = 'sidecar';
  }
  if (headerPairs.layout === 'pack') doc.layout = 'pack';

  const meta: Record<string, unknown> = {};
  const columns: Column[] = [];
  const aggregates: Record<string, Cell[]> = {};
  const ddl: SqlStatement[] = [];
  const dql: SqlStatement[] = [];
  const tables: PackTable[] = [];
  const fk: { from: string; to: string }[] = [];

  const dataLines: string[] = [];

  for (; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line.startsWith('#')) {
      dataLines.push(...lines.slice(lineIdx));
      break;
    }
    if (line.startsWith('##')) continue;

    if (line.startsWith('#@')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(2, colon).trim();
      const value = line.slice(colon + 1).trimStart();
      meta[key] = parseMetaValue(key, value);
      continue;
    }

    if (line.startsWith('#column')) {
      columns.push(parseColumnLine(line.slice('#column'.length).trim()));
      continue;
    }

    if (line.startsWith('#$')) {
      const stmt = parseSqlLine(line.slice(2));
      if (stmt.verb === 'ddl') ddl.push(stmt.statement);
      else if (stmt.verb === 'dql') dql.push(stmt.statement);
      else warnings.push({ code: 'sql_unknown_verb', message: `Unknown SQL verb: ${stmt.verb}` });
      continue;
    }

    if (line.startsWith('#%')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const name = line.slice(2, colon).trim();
      const raw = line.slice(colon + 1).trimStart();
      aggregates[name] = parseAggregateRow(raw, delim, quote, nullMarkers, columns);
      continue;
    }

    if (line.startsWith('#table')) {
      const attrs = parseKvPairs(line.slice('#table'.length).trim());
      if (attrs.name) {
        const entry: PackTable = { name: attrs.name };
        if (attrs.dir) entry.dir = attrs.dir;
        tables.push(entry);
      }
      if (doc.layout !== 'pack') doc.layout = 'pack';
      continue;
    }

    if (line.startsWith('#fk')) {
      const attrs = parseKvPairs(line.slice('#fk'.length).trim());
      if (attrs.from && attrs.to) fk.push({ from: attrs.from, to: attrs.to });
      if (doc.layout !== 'pack') doc.layout = 'pack';
      continue;
    }
  }

  if (Object.keys(meta).length) doc.meta = meta;
  if (columns.length) doc.columns = assignColumnIndexes(columns);
  if (Object.keys(aggregates).length) doc.aggregates = aggregates;
  if (ddl.length || dql.length) doc.sql = { ...(ddl.length && { ddl }), ...(dql.length && { dql }) };
  if (tables.length) doc.tables = tables;
  if (fk.length) doc.fk = fk;

  if (doc.reference) {
    if (dataLines.length) {
      warnings.push({ code: 'sidecar_has_data', message: 'Sidecar has reference= but also contains data rows; data ignored.' });
    }
    return { doc, warnings };
  }

  if (dataLines.length === 0) {
    if (!doc.layout) doc.layout = columns.length || Object.keys(meta).length ? undefined : undefined;
    return { doc, warnings };
  }

  const parsedRows = dataLines.map((l) => parseCsvRow(l, delim, quote));
  let dataRows = parsedRows;

  if (hasHeaderRow && parsedRows.length > 0) {
    dataRows = parsedRows.slice(1);
  }

  doc.data = dataRows.map((row) =>
    row.map((cell, colIdx) => parseCell(cell, columns[colIdx], nullMarkers)),
  );

  if (doc.rows === undefined) doc.rows = doc.data.length;
  if (!doc.layout && doc.data.length >= 0) doc.layout = 'inline';

  return { doc, warnings };
}

function headerToCsv(pairs: Record<string, string>): NonNullable<ExcsvDocument['csv']> {
  const csv: NonNullable<ExcsvDocument['csv']> = {};
  if (pairs.delim) csv.delim = pairs.delim;
  if (pairs.quote) csv.quote = pairs.quote;
  if (pairs.header !== undefined) csv.header = pairs.header !== '0';
  if (pairs.encoding) csv.encoding = pairs.encoding;
  if (pairs.null) csv.null = [pairs.null];
  return csv;
}

function parseMetaValue(key: string, value: string): unknown {
  if (key === 'tags') {
    return value.includes(',') ? value.split(',').map((t) => t.trim()) : value;
  }
  return value;
}

function assignColumnIndexes(columns: Column[]): Column[] {
  return columns.map((col, i) => ({
    ...col,
    index: col.index ?? i,
  }));
}

function parseColumnLine(body: string): Column {
  const raw = parseKvPairs(body);
  const col: Column = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'enum') {
      col.enum = value.split('|').map((v) => coerceScalar(v, raw.type));
    } else if (BOOL_ATTRS.has(key)) {
      col[key] = value === '1' || value === 'true';
    } else if (INT_ATTRS.has(key)) {
      col[key] = parseInt(value, 10);
    } else if (key === 'min' || key === 'max' || key === 'default') {
      col[key] = coerceScalar(value, raw.type);
    } else {
      col[key] = value;
    }
  }

  return col;
}

function coerceScalar(value: string, type?: string): Cell {
  if (type === 'boolean') return value === '1' || value === 'true';
  if (type === 'int' || type === 'long') {
    if (type === 'long') return value;
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value;
  }
  if (type === 'float' || type === 'double') {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (type === 'decimal') return value;
  return value;
}

function parseSqlLine(body: string): { verb: string; statement: SqlStatement } {
  const colon = body.indexOf(':');
  if (colon === -1) throw new Error(`SQL line missing colon: #${body}`);

  const tag = body.slice(0, colon);
  const stmt = body.slice(colon + 1).trimStart();

  const dash = tag.indexOf('-');
  if (dash === -1) {
    return { verb: tag, statement: { stmt } };
  }

  const verb = tag.slice(0, dash);
  const suffix = tag.slice(dash + 1);
  const lastDash = suffix.lastIndexOf('-');
  let dialect = suffix;
  let version: string | undefined;

  if (lastDash !== -1) {
    const maybeVersion = suffix.slice(lastDash + 1);
    if (/^\d+(\.\d+)*$/.test(maybeVersion) || /^v?\d/.test(maybeVersion)) {
      dialect = suffix.slice(0, lastDash);
      version = maybeVersion;
    }
  }

  const statement: SqlStatement = { stmt, dialect };
  if (version) statement.version = version;
  return { verb, statement };
}

function parseAggregateRow(
  raw: string,
  delim: string,
  quote: string,
  nullMarkers: Set<string>,
  columns: Column[],
): Cell[] {
  const fields = parseCsvRow(raw, delim, quote);
  return fields.map((f, i) => parseCell(f, columns[i], nullMarkers));
}

export function parseCell(raw: string, column: Column | undefined, nullMarkers: Set<string>): Cell {
  if (raw === '' || nullMarkers.has(raw)) return null;

  const type = column?.type;
  if (type === 'boolean') {
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return raw;
  }
  if (type === 'decimal' || type === 'long') return raw;
  if (type === 'int') {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : raw;
  }
  if (type === 'float' || type === 'double') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

export function parseCsvDataSection(text: string, doc: ExcsvDocument): Cell[][] {
  const csv = doc.csv ?? {};
  const delim = resolveDelim(csv.delim);
  const quote = resolveQuote(csv.quote);
  const hasHeaderRow = csv.header !== false;
  const nullMarkers = new Set(csv.null ?? []);
  const lines = splitLines(text).filter((line, idx, arr) => {
    if (line === '' && idx === arr.length - 1) return false;
    return true;
  });
  if (!lines.length) return [];
  let rows = lines.map((l) => parseCsvRow(l, delim, quote));
  if (hasHeaderRow && rows.length > 0) rows = rows.slice(1);
  return rows.map((row) => row.map((cell, i) => parseCell(cell, doc.columns?.[i], nullMarkers)));
}

export function detectInputFormat(text: string): 'text' | 'json' {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'text';
}

export function parseJsonInput(text: string): ExcsvDocument {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON root must be an object');
  }
  const doc = parsed as ExcsvDocument;
  if (typeof doc.excsv !== 'string') {
    throw new Error('Missing required "excsv" field');
  }
  return normalizeDocForJson(doc);
}
