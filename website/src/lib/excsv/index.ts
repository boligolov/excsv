import { convert, convertFormat, detectFormat, detectFormatAsync, formatLabel } from './convert-format';
import { detectInputFormat, parseExcsvText, parseJsonInput } from './parse';
import { isPlainCsvText, parsePlainCsv } from './parse-plain-csv';
import { serializeExcsvJson, serializeExcsvText, serializeDataCsv } from './serialize';
import { mergeSidecar, splitToSidecar } from './sidecar';
import { readPack, writePack, inlineToPack, packToInline } from './pack';
import { readZipPlain, writeZipPlain, isZipBytes, readZipArchiveComment, buildZipArchiveComment } from './zip';

export type {
  Cell,
  Column,
  ExcsvDocument,
  ConvertWarning,
  ExcsvFormat,
  ExcsvInputFormat,
  ConvertInput,
  ConvertOutput,
  ConvertFile,
} from './types';

export {
  convert,
  convertFormat,
  detectFormat,
  detectFormatAsync,
  formatLabel,
  detectInputFormat,
  parseExcsvText,
  parseJsonInput,
  parsePlainCsv,
  isPlainCsvText,
  serializeExcsvJson,
  serializeExcsvText,
  serializeDataCsv,
  mergeSidecar,
  splitToSidecar,
  outputBaseName,
  sidecarBaseName,
  readPack,
  writePack,
  inlineToPack,
  packToInline,
  readZipPlain,
  writeZipPlain,
  isZipBytes,
};

export const SAMPLE_CSV = `id,customer,amount
1,Acme Corp,500.00
2,Globex Inc,250.50
3,Initech,200.00
`;

export const SAMPLE_TEXT = `#!excsv version=0.4 delim=comma header=1
#@source: sales_db.orders
#@grain: one row per order
#column name=order_id type=int role=id
#column name=status type=string role=dimension enum=pending|completed|cancelled
#column name=amount type=decimal unit=USD role=measure agg=sum
#column name=created_at type=datetime role=time
#%sum: ,,1050.50,
#$ddl-postgres: CREATE TABLE orders (order_id INTEGER, status TEXT, amount NUMERIC(10,2), created_at TIMESTAMPTZ)
order_id,status,amount,created_at
1,completed,500.00,2026-01-15T09:30:00Z
2,completed,300.50,2026-02-20T14:00:00Z
3,pending,250.00,2026-03-01T11:45:00Z
`;

export const SAMPLE_JSON = `{
  "excsv": "0.4",
  "layout": "inline",
  "csv": { "delim": "comma", "header": true },
  "meta": { "grain": "one row per order", "source": "sales_db.orders" },
  "columns": [
    { "index": 0, "name": "order_id", "type": "int", "role": "id" },
    { "index": 1, "name": "status", "type": "string", "role": "dimension", "enum": ["pending", "completed", "cancelled"] },
    { "index": 2, "name": "amount", "type": "decimal", "unit": "USD", "role": "measure", "agg": "sum" },
    { "index": 3, "name": "created_at", "type": "datetime", "role": "time" }
  ],
  "aggregates": { "sum": [null, null, "1050.50", null] },
  "rows": 3,
  "data": [
    [1, "completed", "500.00", "2026-01-15T09:30:00Z"],
    [2, "completed", "300.50", "2026-02-20T14:00:00Z"],
    [3, "pending", "250.00", "2026-03-01T11:45:00Z"]
  ]
}
`;

export const FORMATS = ['plain', 'sidecar', 'zip', 'pack', 'json'] as const;
