import { delimToHeaderValue, parseCsvRow, quoteToHeaderValue, resolveDelim, resolveQuote, splitLines } from './csv';
import { parseCell } from './parse';
import type { Cell, Column, ConvertWarning, ExcsvDocument } from './types';

const CANDIDATE_DELIMS = ['\t', ',', ';', '|'] as const;

export interface PlainCsvOptions {
  filename?: string;
  /** Delimiter name (comma|tab|…) or literal character */
  delim?: string;
  quote?: string;
  /** Default true — first row is column names */
  header?: boolean;
}

function detectQuote(text: string, delim: string): string {
  const firstLine = splitLines(text).find((l) => l.trim().length > 0) ?? '';
  if (/"[^"]*"/.test(firstLine) && firstLine.includes('"')) return '"';
  if (/'[^']*'/.test(firstLine) && firstLine.includes("'")) return "'";
  void delim;
  return '';
}

function scoreDelimiter(lines: string[], delim: string): number {
  const counts = lines.map((l) => parseCsvRow(l, delim, detectQuote(l, delim)).length);
  if (counts.some((c) => c <= 1)) return 0;
  const first = counts[0];
  if (!counts.every((c) => c === first)) return 0;
  return first;
}

export function detectPlainCsvDialect(
  text: string,
  filename?: string,
): { delim: string; delimName: string; quote: string; quoteName?: string } {
  if (filename && /\.tsv$/i.test(filename)) {
    return { delim: '\t', delimName: 'tab', quote: '', quoteName: undefined };
  }

  const lines = splitLines(text)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .slice(0, 8);

  if (!lines.length) {
    return { delim: ',', delimName: 'comma', quote: '', quoteName: undefined };
  }

  let bestDelim = ',';
  let bestScore = 0;
  for (const d of CANDIDATE_DELIMS) {
    const score = scoreDelimiter(lines, d);
    if (score > bestScore) {
      bestScore = score;
      bestDelim = d;
    }
  }

  const quote = detectQuote(text, bestDelim);
  return {
    delim: bestDelim,
    delimName: delimToHeaderValue(bestDelim),
    quote,
    quoteName: quoteToHeaderValue(quote),
  };
}

function sanitizeColumnName(raw: string, index: number): { name: string; title?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { name: `col_${index}` };

  let name = trimmed.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
  if (!name || !/^[A-Za-z_]/.test(name)) {
    return { name: `col_${index}`, title: trimmed };
  }
  if (name !== trimmed && /\s/.test(trimmed)) {
    return { name, title: trimmed };
  }
  return { name };
}

function inferColumnType(values: string[]): string {
  const nonEmpty = values.filter((v) => v !== '');
  if (!nonEmpty.length) return 'string';
  if (nonEmpty.every((v) => /^-?\d+$/.test(v))) return 'int';
  if (nonEmpty.every((v) => /^-?\d+$/.test(v) || /^-?\d+\.\d+$/.test(v))) {
    return nonEmpty.some((v) => v.includes('.')) ? 'decimal' : 'int';
  }
  if (nonEmpty.every((v) => /^(true|false|1|0)$/i.test(v))) return 'boolean';
  return 'string';
}

export function isPlainCsvText(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  if (!trimmed) return false;
  if (trimmed.startsWith('{')) return false;
  if (trimmed.startsWith('#!excsv')) return false;
  if (trimmed.startsWith('#@') || trimmed.startsWith('#column')) return false;
  return true;
}

export function parsePlainCsv(
  text: string,
  options: PlainCsvOptions = {},
): { doc: ExcsvDocument; warnings: ConvertWarning[] } {
  const warnings: ConvertWarning[] = [];
  const lines = splitLines(text).filter((line, idx, arr) => {
    if (line === '' && idx === arr.length - 1) return false;
    return true;
  });

  if (!lines.length) throw new Error('Empty CSV/TSV input');

  const dialect =
    options.delim !== undefined
      ? {
          delim: resolveDelim(options.delim),
          delimName: options.delim,
          quote: resolveQuote(options.quote),
          quoteName: options.quote,
        }
      : detectPlainCsvDialect(text, options.filename);

  const delim = dialect.delim;
  const quote = options.quote !== undefined ? resolveQuote(options.quote) : dialect.quote;
  const hasHeader = options.header !== false;

  const parsedRows = lines.map((l) => parseCsvRow(l, delim, quote));
  if (!parsedRows.length) throw new Error('No rows in CSV/TSV input');

  let headerCells: string[];
  let dataRows: string[][];

  if (hasHeader) {
    headerCells = parsedRows[0];
    dataRows = parsedRows.slice(1);
  } else {
    const width = Math.max(...parsedRows.map((r) => r.length));
    headerCells = Array.from({ length: width }, (_, i) => `col_${i}`);
    dataRows = parsedRows;
    warnings.push({ code: 'csv_no_header', message: 'No header row; using col_0, col_1, …' });
  }

  const width = headerCells.length;
  const columns: Column[] = headerCells.map((cell, i) => {
    const { name, title } = sanitizeColumnName(cell, i);
    const col: Column = { index: i, name, type: 'string' };
    if (title) col.title = title;
    return col;
  });

  const columnSamples = columns.map((_, i) => dataRows.map((row) => row[i] ?? ''));
  for (let i = 0; i < columns.length; i++) {
    columns[i].type = inferColumnType(columnSamples[i]);
  }

  const nullMarkers = new Set<string>();
  const data: Cell[][] = dataRows.map((row) =>
    Array.from({ length: width }, (_, i) => parseCell(row[i] ?? '', columns[i], nullMarkers)),
  );

  const csv: NonNullable<ExcsvDocument['csv']> = {
    delim: dialect.delimName,
    header: hasHeader,
    encoding: 'UTF-8',
  };
  if (dialect.quoteName) csv.quote = dialect.quoteName;
  else if (quote === '"') csv.quote = 'double';
  else if (quote === "'") csv.quote = 'single';

  const doc: ExcsvDocument = {
    excsv: '0.4',
    layout: 'inline',
    csv,
    columns,
    rows: data.length,
    data,
  };

  warnings.push({
    code: 'csv_import',
    message: `Imported plain CSV/TSV (${dialect.delimName} delimiter, ${columns.length} columns, ${data.length} rows).`,
  });

  return { doc, warnings };
}
