import { parseCsvDataSection, parseExcsvText } from './parse';
import { serializeDataCsv, serializeExcsvText } from './serialize';
import type { ConvertWarning, ExcsvDocument } from './types';

export function mergeSidecar(
  excsvText: string,
  csvText: string,
): { doc: ExcsvDocument; warnings: ConvertWarning[] } {
  const { doc, warnings } = parseExcsvText(excsvText);
  if (!doc.reference) {
    warnings.push({
      code: 'sidecar_no_reference',
      message: 'Sidecar file has no reference=; CSV data merged anyway.',
    });
  }
  doc.data = parseCsvDataSection(csvText, doc);
  doc.rows = doc.data.length;
  doc.layout = 'inline';
  delete doc.reference;
  return { doc, warnings };
}

export function splitToSidecar(
  doc: ExcsvDocument,
  baseName = 'data',
): { excsv: string; csv: string; excsvName: string; csvName: string; warnings: ConvertWarning[] } {
  const warnings: ConvertWarning[] = [];
  if (!doc.data?.length) {
    throw new Error('Document has no data rows for sidecar output.');
  }

  const csvName = `${baseName}.csv`;
  const excsvName = `${baseName}.excsv`;
  const sidecarDoc: ExcsvDocument = {
    ...doc,
    layout: 'sidecar',
    reference: csvName,
    rows: doc.data.length,
  };
  delete sidecarDoc.data;

  const { text: excsv, warnings: serWarn } = serializeExcsvText(sidecarDoc);
  warnings.push(...serWarn);
  const csv = serializeDataCsv(doc);

  return { excsv, csv, excsvName, csvName, warnings };
}

const STRIP_EXT =
  /\.(excsv\.json|excsv\.pack\.zip|excsv\.zip|sidecar\.zip|excsv|extsv|csv|tsv|json|zip)$/i;

/** Base name for output files derived from an input filename. */
export function outputBaseName(filename?: string): string {
  if (!filename) return 'converted';
  const base = filename.replace(STRIP_EXT, '');
  return base || 'converted';
}

export function sidecarBaseName(filename?: string): string {
  return outputBaseName(filename);
}
