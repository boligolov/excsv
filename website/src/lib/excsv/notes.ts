import { physicalColumns } from './computed';
import { serializeKvPairs } from './kv';
import { serializeCell } from './serialize';
import type { Cell, CellLink, Column, ConvertWarning, Note } from './types';

/** Spec: docs/implementation/notes.md */

const ANCHOR_KEYS = ['col', 'row', 'key'] as const;
const NOTE_KEYS = [...ANCHOR_KEYS, 'author', 'created', 'text'];
const LINK_KEYS = [...ANCHOR_KEYS, 'href'];
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/** Strict `key=value` tokenizer: unlike parseKvPairs, rejects unterminated quotes and bare tokens. */
function tokenizeStrict(input: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let i = 0;
  const n = input.length;
  while (i < n) {
    while (i < n && input[i] === ' ') i++;
    if (i >= n) break;
    let j = i;
    while (j < n && input[j] !== '=' && input[j] !== ' ') j++;
    if (j >= n || input[j] !== '=' || j === i) return null;
    const key = input.slice(i, j);
    i = j + 1;
    if (input[i] === '"') {
      i++;
      let val = '';
      let closed = false;
      while (i < n) {
        if (input[i] === '"') {
          if (input[i + 1] === '"') {
            val += '"';
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        val += input[i++];
      }
      if (!closed) return null;
      out[key] = val;
    } else {
      let k = i;
      while (k < n && input[k] !== ' ') k++;
      out[key] = input.slice(i, k);
      i = k;
    }
  }
  return out;
}

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

function readAnchor(attrs: Record<string, string>, kind: 'note' | 'link'): Pick<Note, 'col' | 'row' | 'key'> {
  const anchor: Pick<Note, 'col' | 'row' | 'key'> = {};
  if ('row' in attrs && 'key' in attrs) fail(`${kind}_row_and_key`, `#${kind} sets both row= and key=.`);
  if ('col' in attrs) anchor.col = attrs.col;
  if ('row' in attrs) {
    if (!/^\d+$/.test(attrs.row)) fail(`${kind}_malformed`, `row= must be a non-negative integer, got "${attrs.row}".`);
    anchor.row = Number(attrs.row);
  }
  if ('key' in attrs) anchor.key = attrs.key;
  return anchor;
}

function extras(attrs: Record<string, string>, known: string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('x-') && !known.includes(k)));
}

export function parseNoteLine(body: string): Note {
  const attrs = tokenizeStrict(body);
  if (!attrs) fail('note_malformed', `#note line does not tokenize: ${body}`);
  if (attrs.text === undefined) fail('note_missing_text', '#note lacks text=.');
  const note: Note = { ...readAnchor(attrs, 'note'), text: attrs.text };
  if (attrs.author) note.author = attrs.author;
  if (attrs.created) note.created = attrs.created;
  return { ...note, ...extras(attrs, NOTE_KEYS) };
}

export function parseLinkLine(body: string): CellLink {
  const attrs = tokenizeStrict(body);
  if (!attrs) fail('link_malformed', `#link line does not tokenize: ${body}`);
  if (attrs.href === undefined) fail('link_missing_href', '#link lacks href=.');
  const anchor = readAnchor(attrs, 'link');
  if (anchor.col === undefined || (anchor.row === undefined && anchor.key === undefined)) {
    fail('link_missing_address', '#link needs col= and one of row= / key=.');
  }
  return { ...anchor, col: anchor.col, href: attrs.href, ...extras(attrs, LINK_KEYS) };
}

function anchorPairs(a: { col?: string | number; row?: number; key?: string }): Record<string, string | undefined> {
  return {
    row: a.row !== undefined ? String(a.row) : undefined,
    key: a.key,
    col: a.col !== undefined ? String(a.col) : undefined,
  };
}

export function formatNoteLine(note: Note): string {
  const { col, row, key, text, author, created, ...rest } = note;
  const pairs = { ...anchorPairs({ col, row, key }), author, created, ...stringify(rest) };
  // text= goes last and is always quoted, matching the spec's examples.
  const head = serializeKvPairs(pairs);
  return `#note ${head ? head + ' ' : ''}text="${text.replace(/"/g, '""')}"`;
}

export function formatLinkLine(link: CellLink): string {
  const { col, row, key, href, ...rest } = link;
  const pairs = { ...anchorPairs({ col, row, key }), ...stringify(rest) };
  return `#link ${serializeKvPairs(pairs)} href="${href.replace(/"/g, '""')}"`;
}

function stringify(rest: Record<string, unknown>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === undefined ? undefined : String(v)]));
}

// ---------------------------------------------------------------------------
// Resolution

export interface NotesContext {
  columns: Column[];
  data: Cell[][];
  header0: boolean;
}

/** Index into `physicalColumns` for a col= / placeholder reference, or -1. */
export function resolveCol(ref: string | number | undefined, ctx: NotesContext): number {
  if (ref === undefined) return -1;
  const phys = physicalColumns(ctx.columns);
  const s = String(ref);
  if (ctx.header0 && /^\d+$/.test(s)) {
    const idx = Number(s);
    return idx < Math.max(phys.length, ctx.data[0]?.length ?? 0) ? idx : -1;
  }
  return phys.findIndex((c) => c.name === s);
}

/** The table's id column: the single role=id column, else the single unique=1 column. */
export function idColumn(ctx: NotesContext): number {
  const phys = physicalColumns(ctx.columns);
  const byRole = phys.flatMap((c, i) => (c.role === 'id' ? [i] : []));
  if (byRole.length) return byRole.length === 1 ? byRole[0] : -1;
  const byUnique = phys.flatMap((c, i) => (c.unique ? [i] : []));
  return byUnique.length === 1 ? byUnique[0] : -1;
}

function rawText(cell: Cell, col: Column | undefined): string | null {
  return cell === null || cell === undefined ? null : serializeCell(cell, col, []);
}

/** Resolved data-row index for an anchor, `null` when it has no row part, or -1 when unresolved. */
export function resolveRow(anchor: { row?: number; key?: string }, ctx: NotesContext): number | null {
  if (anchor.row !== undefined) return anchor.row >= 0 && anchor.row < ctx.data.length ? anchor.row : -1;
  if (anchor.key === undefined) return null;
  const id = idColumn(ctx);
  if (id < 0) return -1;
  const col = physicalColumns(ctx.columns)[id];
  return ctx.data.findIndex((row) => rawText(row[id], col) === anchor.key);
}

export type NoteTarget = 'cell' | 'column' | 'row' | 'table';

export function noteTarget(note: Note): NoteTarget {
  const hasRow = note.row !== undefined || note.key !== undefined;
  const hasCol = note.col !== undefined;
  if (hasRow && hasCol) return 'cell';
  if (hasCol) return 'column';
  if (hasRow) return 'row';
  return 'table';
}

export interface ResolvedNote {
  note: Note;
  target: NoteTarget;
  row: number | null;
  col: number | null;
  resolved: boolean;
}

export function resolveNotes(notes: Note[], ctx: NotesContext): ResolvedNote[] {
  return notes.map((note) => {
    const row = resolveRow(note, ctx);
    const col = note.col === undefined ? null : resolveCol(note.col, ctx);
    return { note, target: noteTarget(note), row, col, resolved: row !== -1 && col !== -1 };
  });
}

// ---------------------------------------------------------------------------
// Link templates

type TemplatePart = { lit: string } | { ref: string };

/** Parse a link= template; returns null for an unterminated `{`. */
export function parseTemplate(template: string): TemplatePart[] | null {
  const parts: TemplatePart[] = [];
  let lit = '';
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch !== '{') {
      lit += ch;
      continue;
    }
    if (template[i + 1] === '{') {
      lit += '{';
      i++;
      continue;
    }
    const end = template.indexOf('}', i + 1);
    if (end === -1) return null;
    if (lit) parts.push({ lit });
    lit = '';
    parts.push({ ref: template.slice(i + 1, end) });
    i = end;
  }
  if (lit) parts.push({ lit });
  return parts;
}

/** RFC 3986 percent-encoding of UTF-8 bytes, unreserved characters kept, uppercase hex. */
export function percentEncode(value: string): string {
  return Array.from(new TextEncoder().encode(value), (b) => {
    const ch = String.fromCharCode(b);
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }).join('');
}

export function isSafeUrl(url: string): boolean {
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url.trim());
  return !!m && SAFE_SCHEMES.has(m[1].toLowerCase() + ':');
}

export interface LinkGrid {
  /** links[row][physicalCol] = safe URL, or undefined */
  links: (string | undefined)[][];
  warnings: ConvertWarning[];
}

/** Resolve every cell's link (column templates + #link overrides), applying the scheme check. */
export function resolveLinks(links: CellLink[], ctx: NotesContext): LinkGrid {
  const warnings: ConvertWarning[] = [];
  const phys = physicalColumns(ctx.columns);
  const width = Math.max(phys.length, ctx.data[0]?.length ?? 0);
  const grid: (string | undefined)[][] = ctx.data.map(() => new Array(width).fill(undefined));
  const warned = new Set<string>();
  const warn = (code: string, message: string) => {
    if (warned.has(code + message)) return;
    warned.add(code + message);
    warnings.push({ code, message });
  };
  let unsafe = 0;

  const place = (r: number, c: number, url: string) => {
    if (isSafeUrl(url)) grid[r][c] = url;
    else {
      grid[r][c] = undefined;
      unsafe++;
    }
  };

  phys.forEach((col, c) => {
    if (typeof col.link !== 'string') return;
    const parts = parseTemplate(col.link);
    if (!parts) {
      warn('link_template_malformed', `link= on column ${col.name ?? c} has an unterminated {.`);
      return;
    }
    const names = parts.flatMap((p) => ('ref' in p ? [p.ref] : []));
    const refs = names.map((ref) => (ref === '$' ? c : resolveCol(ref, ctx)));
    const bad = refs.indexOf(-1);
    if (bad !== -1) {
      warn('link_unknown_column', `link= on column ${col.name ?? c} references unknown column {${names[bad]}}.`);
      return;
    }
    const single = parts.length === 1 && 'ref' in parts[0];
    ctx.data.forEach((row, r) => {
      let url = '';
      let k = 0;
      for (const p of parts) {
        if ('lit' in p) {
          url += p.lit;
          continue;
        }
        const ci = refs[k++];
        const raw = rawText(row[ci], phys[ci]);
        if (raw === null) return; // null placeholder → no link for this cell
        url += single ? raw : percentEncode(raw);
      }
      place(r, c, url);
    });
  });

  const seen = new Set<string>();
  for (const link of links) {
    const r = resolveRow(link, ctx);
    const c = resolveCol(link.col, ctx);
    if (r === null || r < 0 || c < 0) {
      warn('link_unresolved', `#link ${link.key !== undefined ? `key=${link.key}` : `row=${link.row}`} col=${link.col} does not resolve.`);
      continue;
    }
    const cellKey = `${r},${c}`;
    if (seen.has(cellKey)) warn('link_duplicate', `Two #link lines on row ${r}, column ${link.col}; the last one wins.`);
    seen.add(cellKey);
    place(r, c, link.href);
  }

  if (unsafe) warn('link_unsafe_scheme', `${unsafe} link(s) use a scheme other than http/https/mailto and are shown as plain text.`);
  return { links: grid, warnings };
}

export function noteWarnings(resolved: ResolvedNote[]): ConvertWarning[] {
  const bad = resolved.filter((r) => !r.resolved);
  if (!bad.length) return [];
  return [{ code: 'note_unresolved', message: `${bad.length} #note line(s) do not resolve to a row/column; kept as-is.` }];
}
