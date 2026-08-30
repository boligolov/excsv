import { inlineToPack, packToInline, readPack, writePack } from './pack';
import { detectInputFormat, parseExcsvText, parseJsonInput } from './parse';
import { isPlainCsvText, parsePlainCsv } from './parse-plain-csv';
import { mergeSidecar, outputBaseName, sidecarBaseName, splitToSidecar } from './sidecar';
import { serializeExcsvJson, serializeExcsvText } from './serialize';
import { isZipBytes, readZipEntries, readZipPlain, writeZipBundle, writeZipPlain } from './zip';
import { strToU8 } from 'fflate';
import type { ConvertInput, ConvertOutput, ConvertWarning, ExcsvDocument, ExcsvFormat, ExcsvInputFormat } from './types';

export function detectFormat(input: ConvertInput): ExcsvInputFormat {
  if (input.format && input.format !== 'auto') return input.format;

  if (input.bytes?.length) {
    if (isZipBytes(input.bytes)) {
      // Peek without full unzip - check filename
      if (input.filename?.includes('.pack.zip')) return 'pack';
      return 'zip';
    }
  }

  const text = input.text ?? '';
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();

  if (trimmed.startsWith('{')) return 'json';

  if (trimmed.startsWith('#!excsv')) {
    const { doc } = parseExcsvText(text);
    if (doc.layout === 'pack') return 'pack';
    if (doc.reference && !doc.data?.length) return 'sidecar';
    return 'plain';
  }

  if (isPlainCsvText(text)) return 'csv';

  if (input.filename && /\.(csv|tsv)$/i.test(input.filename)) return 'csv';

  return 'plain';
}

export async function detectFormatAsync(input: ConvertInput): Promise<ExcsvInputFormat> {
  if (input.format && input.format !== 'auto') return input.format;

  if (input.bytes?.length && isZipBytes(input.bytes)) {
    const files = await readZipEntries(input.bytes);
    if ('_manifest.excsv' in files) return 'pack';
    return 'zip';
  }

  return detectFormat(input);
}

async function loadDocument(input: ConvertInput): Promise<{ doc: ExcsvDocument; warnings: ConvertWarning[] }> {
  const warnings: ConvertWarning[] = [];

  if (input.bytes && isZipBytes(input.bytes)) {
    const files = await readZipEntries(input.bytes);
    if ('_manifest.excsv' in files) {
      const { doc, warnings: w } = await readPack(input.bytes);
      return { doc, warnings: [...warnings, ...w] };
    }
    const { doc, warnings: w } = await readZipPlain(input.bytes, input.filename);
    return { doc, warnings: [...warnings, ...w] };
  }

  if (detectFormat(input) === 'json') {
    const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : '');
    return { doc: parseJsonInput(text), warnings };
  }

  if (detectFormat(input) === 'csv') {
    const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : '');
    const { doc, warnings: w } = parsePlainCsv(text, { filename: input.filename });
    return { doc, warnings: [...warnings, ...w] };
  }

  if (detectFormat(input) === 'sidecar') {
    const text = input.text ?? '';
    if (!input.sidecarData) {
      throw new Error('Sidecar input requires a CSV/TSV data file. Open both files together.');
    }
    const { doc, warnings: w } = mergeSidecar(text, input.sidecarData);
    return { doc, warnings: [...warnings, ...w] };
  }

  const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : '');
  const { doc, warnings: w } = parseExcsvText(text);
  return { doc, warnings: [...warnings, ...w] };
}

function normalizeForTarget(doc: ExcsvDocument, target: ExcsvFormat): ExcsvDocument {
  if (target === 'pack') return inlineToPack(doc);
  if (target === 'plain' && doc.layout === 'pack') return packToInline(doc);
  if (target === 'plain' || target === 'json' || target === 'zip' || target === 'sidecar') {
    if (doc.layout === 'pack') return packToInline(doc);
    if (doc.reference && !doc.data?.length) {
      throw new Error('Sidecar has no data loaded; attach the referenced CSV file.');
    }
    return { ...doc, layout: doc.reference ? 'sidecar' : 'inline' };
  }
  return doc;
}

export async function convertFormat(
  input: ConvertInput,
  target: ExcsvFormat,
): Promise<ConvertOutput> {
  let { doc, warnings } = await loadDocument(input);

  if (target === 'plain') {
    doc = normalizeForTarget(doc, 'plain');
    if (doc.reference) delete doc.reference;
    doc.layout = 'inline';
    const { text, warnings: w } = serializeExcsvText(doc);
    const base = outputBaseName(input.filename);
    return { format: 'plain', text, downloadName: `${base}.excsv`, warnings: [...warnings, ...w] };
  }

  if (target === 'json') {
    if (doc.layout === 'pack' || doc.tables?.length) {
      doc.layout = 'pack';
    } else {
      doc = normalizeForTarget(doc, 'json');
      doc.layout = doc.reference ? 'sidecar' : 'inline';
    }
    const base = outputBaseName(input.filename);
    return {
      format: 'json',
      text: serializeExcsvJson(doc),
      downloadName: `${base}.excsv.json`,
      warnings,
    };
  }

  if (target === 'sidecar') {
    doc = normalizeForTarget(doc, 'plain');
    const base = sidecarBaseName(input.filename);
    const { excsv, csv, excsvName, csvName, warnings: w } = splitToSidecar(doc, base);
    warnings.push(...w);
    const bundle = await writeZipBundle({
      [excsvName]: strToU8(excsv),
      [csvName]: strToU8(csv),
    });
    return {
      format: 'sidecar',
      bytes: bundle,
      files: [
        { name: excsvName, content: excsv },
        { name: csvName, content: csv },
      ],
      downloadName: `${base}.sidecar.zip`,
      warnings,
    };
  }

  if (target === 'zip') {
    doc = normalizeForTarget(doc, 'plain');
    const base = sidecarBaseName(input.filename);
    const { bytes, warnings: w } = await writeZipPlain(doc, base);
    warnings.push(...w);
    return {
      format: 'zip',
      bytes,
      downloadName: `${base}.excsv.zip`,
      warnings,
    };
  }

  if (target === 'pack') {
    doc = inlineToPack(normalizeForTarget(doc, 'plain'));
    const { bytes, warnings: w } = await writePack(doc);
    warnings.push(...w);
    const base = sidecarBaseName(input.filename);
    return {
      format: 'pack',
      bytes,
      downloadName: `${base}.excsv.pack.zip`,
      warnings,
    };
  }

  throw new Error(`Unknown target format: ${target}`);
}

/** Legacy text ↔ json helper */
export function convert(
  input: string,
  direction?: 'text-to-json' | 'json-to-text',
): { output: string; warnings: ConvertWarning[]; direction: 'text-to-json' | 'json-to-text' } {
  const detected =
    direction ?? (detectInputFormat(input) === 'json' ? 'json-to-text' : 'text-to-json');

  if (detected === 'text-to-json') {
    const { doc, warnings } = parseExcsvText(input);
    return { output: serializeExcsvJson(doc), warnings, direction: 'text-to-json' };
  }

  const doc = parseJsonInput(input);
  const { text, warnings } = serializeExcsvText(doc);
  return { output: text, warnings, direction: 'json-to-text' };
}

export function formatLabel(f: ExcsvInputFormat): string {
  const labels: Record<ExcsvInputFormat, string> = {
    csv: 'CSV/TSV',
    plain: 'Plain (.excsv)',
    sidecar: 'Sidecar (.excsv + .csv)',
    zip: 'ZIP (.excsv.zip)',
    pack: 'Pack (.excsv.pack.zip)',
    json: 'JSON (.excsv.json)',
    auto: 'Auto-detect',
  };
  return labels[f];
}
