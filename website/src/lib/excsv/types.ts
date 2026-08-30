export type Cell = string | number | boolean | null;
export type Scalar = Cell;

export interface Column {
  name?: string;
  title?: string;
  description?: string;
  index?: number;
  type?: string;
  format?: string;
  unit?: string;
  role?: string;
  agg?: string;
  order?: string;
  separator?: string;
  enum?: Scalar[];
  pattern?: string;
  regexp_dialect?: string;
  min?: Scalar;
  max?: Scalar;
  len_min?: number;
  len_max?: number;
  unique?: boolean;
  required?: boolean;
  default?: Scalar;
  [key: string]: unknown;
}

export interface SqlStatement {
  dialect?: string;
  version?: string;
  stmt: string;
}

export interface PackTable {
  name: string;
  dir?: string;
  sectionSize?: number;
  meta?: Record<string, unknown>;
  csv?: ExcsvDocument['csv'];
  columns?: Column[];
  aggregates?: Record<string, Cell[]>;
  sql?: { ddl?: SqlStatement[]; dql?: SqlStatement[] };
  checksum?: string;
  rows?: number;
  data?: Cell[][];
}

export interface ExcsvDocument {
  excsv: string;
  layout?: 'inline' | 'sidecar' | 'pack';
  csv?: {
    delim?: string;
    quote?: string;
    header?: boolean;
    encoding?: string;
    null?: string[];
  };
  meta?: Record<string, unknown>;
  columns?: Column[];
  aggregates?: Record<string, Cell[]>;
  sql?: { ddl?: SqlStatement[]; dql?: SqlStatement[] };
  checksum?: string;
  rows?: number;
  reference?: string;
  data?: Cell[][];
  tables?: PackTable[];
  fk?: { from: string; to: string }[];
}

export type ConvertWarning = { code: string; message: string };

export type ExcsvFormat = 'plain' | 'sidecar' | 'zip' | 'pack' | 'json';

/** Input-only — plain CSV/TSV without ExCSV metadata */
export type ExcsvInputFormat = ExcsvFormat | 'csv' | 'auto';

export interface ConvertFile {
  name: string;
  content: Uint8Array | string;
  mime?: string;
}

export interface ConvertInput {
  /** Text content for plain, json, or sidecar metadata */
  text?: string;
  /** Raw bytes for zip / pack archives */
  bytes?: Uint8Array;
  filename?: string;
  /** CSV/TSV payload when reading a sidecar pair */
  sidecarData?: string;
  sidecarDataName?: string;
  format?: ExcsvInputFormat;
}

export interface ConvertOutput {
  format: ExcsvFormat;
  text?: string;
  bytes?: Uint8Array;
  files?: ConvertFile[];
  downloadName?: string;
  warnings: ConvertWarning[];
}
