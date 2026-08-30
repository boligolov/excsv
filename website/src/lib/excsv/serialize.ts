import { formatKvValue, serializeKvPairs } from './kv';
import { resolveDelim, resolveQuote, serializeCsvRow } from './csv';
import type { Cell, Column, ConvertWarning, ExcsvDocument, SqlStatement } from './types';

function assignColumnIndexes(columns: Column[]): Column[] {
  return columns.map((col, i) => ({
    ...col,
    index: col.index ?? i,
  }));
}

export function normalizeDocForJson(doc: ExcsvDocument): ExcsvDocument {
  const out: ExcsvDocument = { ...doc };
  if (out.columns?.length) out.columns = assignColumnIndexes(out.columns);
  if (out.tables?.length) {
    out.tables = out.tables.map((table) =>
      table.columns?.length ? { ...table, columns: assignColumnIndexes(table.columns) } : table,
    );
  }
  return out;
}

const DEFAULTS = {
  delim: 'comma',
  quote: 'none',
  header: true,
  encoding: 'UTF-8',
};

export function serializeExcsvText(doc: ExcsvDocument): { text: string; warnings: ConvertWarning[] } {
  const warnings: ConvertWarning[] = [];
  const lines: string[] = [];

  const csv = doc.csv ?? {};
  const headerPairs: Record<string, string | undefined> = {
    version: doc.excsv,
  };

  if (csv.delim && csv.delim !== DEFAULTS.delim) headerPairs.delim = csv.delim;
  if (csv.quote && csv.quote !== DEFAULTS.quote) headerPairs.quote = csv.quote;
  if (csv.header === false) headerPairs.header = '0';
  if (csv.encoding && csv.encoding !== DEFAULTS.encoding) headerPairs.encoding = csv.encoding;
  if (csv.null?.length === 1) headerPairs.null = csv.null[0];
  else if (csv.null && csv.null.length > 1) {
    warnings.push({ code: 'null_multi', message: 'Only the first null marker is written to the header.' });
    headerPairs.null = csv.null[0];
  }

  if (doc.rows !== undefined) headerPairs.rows = String(doc.rows);
  if (doc.checksum) headerPairs.checksum = doc.checksum;
  if (doc.reference) headerPairs.reference = doc.reference;
  if (doc.layout === 'pack') headerPairs.layout = 'pack';

  lines.push(`#!excsv ${serializeKvPairs(headerPairs)}`.trimEnd());

  if (doc.meta) {
    for (const [key, value] of Object.entries(doc.meta)) {
      lines.push(formatMetaLine(key, value));
    }
  }

  if (doc.columns?.length) {
    for (const col of doc.columns) {
      lines.push(formatColumnLine(col, csv.header === false));
    }
  }

  if (doc.sql?.ddl) {
    for (const stmt of doc.sql.ddl) {
      lines.push(formatSqlLine('ddl', stmt));
    }
  }
  if (doc.sql?.dql) {
    for (const stmt of doc.sql.dql) {
      lines.push(formatSqlLine('dql', stmt));
    }
  }

  if (doc.aggregates) {
    const delim = resolveDelim(csv.delim);
    const quote = resolveQuote(csv.quote);
    const nullMarkers = csv.null ?? [];
    for (const [name, values] of Object.entries(doc.aggregates)) {
      const fields = values.map((v) => serializeCell(v, undefined, nullMarkers));
      lines.push(`#%${name}: ${serializeCsvRow(fields, delim, quote)}`);
    }
  }

  if (doc.tables?.length) {
    for (const table of doc.tables) {
      lines.push(`#table name=${formatKvValue(table.name)}`);
    }
  }
  if (doc.fk?.length) {
    for (const link of doc.fk) {
      lines.push(`#fk from=${link.from} to=${link.to}`);
    }
  }

  if (doc.reference) {
    return { text: lines.join('\n') + '\n', warnings };
  }

  if (doc.tables?.length && !doc.data?.length) {
    warnings.push({
      code: 'pack_no_data',
      message: 'Pack manifest written; per-table row data is not embedded in plain text form.',
    });
    return { text: lines.join('\n') + '\n', warnings };
  }

  if (doc.data?.length) {
    const delim = resolveDelim(csv.delim);
    const quote = resolveQuote(csv.quote);
    const nullMarkers = csv.null ?? [];
    const hasHeader = csv.header !== false;

    if (hasHeader) {
      const headerCells = (doc.columns ?? []).map((c) => c.title ?? c.name ?? '');
      if (headerCells.some(Boolean)) {
        lines.push(serializeCsvRow(headerCells, delim, quote));
      }
    }

    for (const row of doc.data) {
      const fields = row.map((cell, i) => serializeCell(cell, doc.columns?.[i], nullMarkers));
      lines.push(serializeCsvRow(fields, delim, quote));
    }
  }

  return { text: lines.join('\n') + '\n', warnings };
}

function formatMetaLine(key: string, value: unknown): string {
  if (key === 'tags' && Array.isArray(value)) {
    return `#@${key}: ${value.join(',')}`;
  }
  return `#@${key}: ${String(value)}`;
}

function formatColumnLine(col: Column, emitIndex: boolean): string {
  const pairs: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(col)) {
    if (value === undefined || value === null) continue;
    if (key === 'index' && !emitIndex) continue;
    if (key === 'enum' && Array.isArray(value)) {
      pairs.enum = value.map(String).join('|');
    } else if (key === 'unique' || key === 'required') {
      pairs[key] = value ? '1' : '0';
    } else if (typeof value === 'boolean') {
      pairs[key] = value ? '1' : '0';
    } else if (typeof value === 'number') {
      pairs[key] = String(value);
    } else {
      pairs[key] = String(value);
    }
  }

  return `#column ${serializeKvPairs(pairs)}`;
}

function formatSqlLine(verb: string, stmt: SqlStatement): string {
  let tag = verb;
  if (stmt.dialect) {
    tag += `-${stmt.dialect}`;
    if (stmt.version) tag += `-${stmt.version}`;
  }
  return `#$${tag}: ${stmt.stmt}`;
}

export function serializeDataCsv(doc: ExcsvDocument): string {
  const csv = doc.csv ?? {};
  const delim = resolveDelim(csv.delim);
  const quote = resolveQuote(csv.quote);
  const nullMarkers = csv.null ?? [];
  const lines: string[] = [];

  if (csv.header !== false && doc.columns?.length) {
    lines.push(
      serializeCsvRow(
        doc.columns.map((c) => c.title ?? c.name ?? ''),
        delim,
        quote,
      ),
    );
  }

  for (const row of doc.data ?? []) {
    const fields = row.map((cell, i) => serializeCell(cell, doc.columns?.[i], nullMarkers));
    lines.push(serializeCsvRow(fields, delim, quote));
  }

  return lines.join('\n') + '\n';
}

export function serializeCell(cell: Cell, column: Column | undefined, _nullMarkers: string[]): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  if (typeof cell === 'boolean') {
    return cell ? 'true' : 'false';
  }
  if (typeof cell === 'number') {
    if (column?.type === 'decimal' || column?.type === 'long') return String(cell);
    return String(cell);
  }
  return String(cell);
}

export function serializeExcsvJson(doc: ExcsvDocument, pretty = true): string {
  return JSON.stringify(normalizeDocForJson(doc), null, pretty ? 2 : 0) + '\n';
}
