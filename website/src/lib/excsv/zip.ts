import { strFromU8, strToU8, unzip, zip } from 'fflate';
import { parseExcsvText } from './parse';
import { serializeExcsvText } from './serialize';
import type { ConvertWarning, ExcsvDocument } from './types';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const EOCD_SIG = 0x06054b50;
const MAX_ZIP_COMMENT_BYTES = 65535;

type CommentBucket =
  | 'header'
  | 'meta_priority'
  | 'column'
  | 'ddl'
  | 'agg'
  | 'meta_comment_tags'
  | 'meta_other'
  | 'dql'
  | 'other';

const COMMENT_PRIORITY: CommentBucket[] = [
  'header',
  'meta_priority',
  'column',
  'ddl',
  'agg',
  'meta_comment_tags',
  'meta_other',
  'dql',
  'other',
];

const PRIORITY_META_KEYS = new Set(['source', 'author', 'created', 'exported', 'license', 'tool']);

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });
}

/** Read the ZIP end-of-central-directory archive comment (UTF-8). */
export function readZipArchiveComment(bytes: Uint8Array): string | undefined {
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      const len = bytes[i + 20] | (bytes[i + 21] << 8);
      if (len === 0) return undefined;
      return new TextDecoder().decode(bytes.subarray(i + 22, i + 22 + len));
    }
  }
  return undefined;
}

/**
 * fflate only supports per-entry comments, not the EOCD archive comment.
 * Append the ExCSV metadata prefix to the ZIP trailer per spec (zip.md / pack.md).
 */
export function appendZipArchiveComment(zipBytes: Uint8Array, comment: string): Uint8Array {
  const commentBytes = new TextEncoder().encode(comment);
  if (commentBytes.length > MAX_ZIP_COMMENT_BYTES) {
    throw new Error(`ZIP archive comment exceeds ${MAX_ZIP_COMMENT_BYTES} bytes.`);
  }

  let eocdOffset = -1;
  for (let i = zipBytes.length - 22; i >= 0; i--) {
    const sig = zipBytes[i] | (zipBytes[i + 1] << 8) | (zipBytes[i + 2] << 16) | (zipBytes[i + 3] << 24);
    if (sig === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('ZIP end-of-central-directory record not found.');

  const eocd = zipBytes.subarray(eocdOffset, eocdOffset + 22);
  const newEocd = new Uint8Array(22 + commentBytes.length);
  newEocd.set(eocd.subarray(0, 20));
  newEocd[20] = commentBytes.length & 0xff;
  newEocd[21] = (commentBytes.length >> 8) & 0xff;
  newEocd.set(commentBytes, 22);

  const out = new Uint8Array(eocdOffset + newEocd.length);
  out.set(zipBytes.subarray(0, eocdOffset));
  out.set(newEocd, eocdOffset);
  return out;
}

function zipRawAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, {}, (err, out) => (err ? reject(err) : resolve(out)));
  });
}

async function zipWithArchiveComment(
  files: Record<string, Uint8Array>,
  archiveComment?: string,
): Promise<Uint8Array> {
  const raw = await zipRawAsync(files);
  if (!archiveComment) return raw;
  return appendZipArchiveComment(raw, archiveComment);
}

function primaryEntryName(archiveName: string | undefined, entries: string[]): string {
  if (archiveName) {
    const base = archiveName.replace(/\.(excsv|extsv)(\.(zip|pack\.zip))?$/i, '');
    const candidate = entries.find((e) => e === `${base}.excsv` || e === `${base}.extsv`);
    if (candidate) return candidate;
  }
  const first = entries.find((e) => e.endsWith('.excsv') || e.endsWith('.extsv'));
  if (first) return first;
  throw new Error('ZIP archive has no .excsv/.extsv primary entry.');
}

export function isPackArchive(files: Record<string, Uint8Array>): boolean {
  return '_manifest.excsv' in files || Object.keys(files).some((k) => k.endsWith('.pack.zip'));
}

export async function readZipPlain(
  bytes: Uint8Array,
  filename?: string,
): Promise<{ doc: ExcsvDocument; innerName: string; warnings: ConvertWarning[] }> {
  const warnings: ConvertWarning[] = [];
  const files = await unzipAsync(bytes);

  if ('_manifest.excsv' in files) {
    throw new Error('This is a pack archive (.excsv.pack.zip), not a row ZIP.');
  }

  const comment = readZipArchiveComment(bytes);
  if (comment && !comment.trimStart().startsWith('#!excsv')) {
    warnings.push({
      code: 'zip_comment_not_excsv_prefix',
      message: 'ZIP archive comment does not begin with #!excsv.',
    });
  }

  const names = Object.keys(files).sort();
  const innerName = primaryEntryName(filename, names);
  const innerText = strFromU8(files[innerName]);
  const { doc, warnings: parseWarn } = parseExcsvText(innerText);
  warnings.push(...parseWarn);

  if (doc.reference) {
    warnings.push({
      code: 'zip_sidecar_inner',
      message: 'Sidecar has reference=; load the referenced CSV separately for full data.',
    });
  }

  return { doc, innerName, warnings };
}

function classifyMetaLine(line: string): CommentBucket {
  if (line.startsWith('#!excsv')) return 'header';
  if (line.startsWith('#column')) return 'column';
  if (line.startsWith('#$ddl')) return 'ddl';
  if (line.startsWith('#$dql')) return 'dql';
  if (line.startsWith('#%')) return 'agg';
  if (line.startsWith('#@')) {
    const key = line.slice(2).split(':')[0]?.trim() ?? '';
    if (PRIORITY_META_KEYS.has(key)) return 'meta_priority';
    if (key === 'comment' || key === 'tags') return 'meta_comment_tags';
    return 'meta_other';
  }
  return 'other';
}

/** Extract `#` meta lines from an ExCSV text prefix (stops at first data row). */
export function extractMetaLines(text: string): string[] {
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    if (line.startsWith('#')) {
      lines.push(line);
      continue;
    }
    break;
  }
  return lines;
}

/**
 * Build the ZIP EOCD comment — UTF-8 ExCSV prefix with spec priority order and truncation.
 * @see docs/implementation/zip.md#priority-order
 */
export function buildZipArchiveComment(innerText: string, maxBytes = MAX_ZIP_COMMENT_BYTES): string {
  const lines = extractMetaLines(innerText);
  const buckets = new Map<CommentBucket, string[]>();
  for (const key of COMMENT_PRIORITY) buckets.set(key, []);

  for (const line of lines) {
    const bucket = classifyMetaLine(line);
    buckets.get(bucket)!.push(line);
  }

  const ordered = COMMENT_PRIORITY.flatMap((key) => buckets.get(key) ?? []);
  const enc = new TextEncoder();
  const truncMarker = '#@comment-truncated: 1';

  const kept: string[] = [];
  let used = 0;
  let truncated = false;

  for (const line of ordered) {
    const lineBytes = enc.encode(line).length;
    const add = lineBytes + (kept.length ? 1 : 0);
    if (used + add > maxBytes) {
      truncated = true;
      continue;
    }
    kept.push(line);
    used += add;
  }

  if (truncated) {
    const markerBytes = enc.encode(truncMarker).length;
    while (kept.length && used + markerBytes + 1 > maxBytes) {
      const removed = kept.pop()!;
      used -= enc.encode(removed).length + (kept.length ? 1 : 0);
    }
    kept.push(truncMarker);
  }

  return kept.join('\n');
}

/** @deprecated Use buildZipArchiveComment */
export function zipCommentFromInner(text: string, maxBytes = MAX_ZIP_COMMENT_BYTES): string {
  return buildZipArchiveComment(text, maxBytes);
}

export function withOriginalSize(text: string): string {
  const normalized = text.endsWith('\n') ? text : text + '\n';
  const lines = normalized.split('\n');
  const headerBase = lines[0].replace(/\s+original-size=\d+/g, '').trim();
  const tail = lines.slice(1);

  let n = 0;
  for (let i = 0; i < 8; i++) {
    const header = `${headerBase} original-size=${n}`;
    const body = [header, ...tail].join('\n');
    const bytes = new TextEncoder().encode(body);
    if (bytes.length === n) return body;
    n = bytes.length;
  }
  return normalized;
}

export async function writeZipPlain(
  doc: ExcsvDocument,
  archiveBase = 'data',
): Promise<{ bytes: Uint8Array; innerName: string; warnings: ConvertWarning[] }> {
  const warnings: ConvertWarning[] = [];
  const { text, warnings: serWarn } = serializeExcsvText(doc);
  warnings.push(...serWarn);

  const innerName = `${archiveBase}.excsv`;
  const inner = withOriginalSize(text);
  const comment = buildZipArchiveComment(inner);
  const files: Record<string, Uint8Array> = {
    [innerName]: strToU8(inner),
  };
  const bytes = await zipWithArchiveComment(files, comment);
  return { bytes, innerName, warnings };
}

export async function readZipEntries(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return unzipAsync(bytes);
}

export async function writeZipBundle(
  files: Record<string, Uint8Array>,
  comment?: string,
): Promise<Uint8Array> {
  return zipWithArchiveComment(files, comment);
}
