import { convertFormat } from '../src/lib/excsv/convert-format.ts';
import { readZipArchiveComment } from '../src/lib/excsv/zip.ts';

const csv = 'id,customer,amount\n1,Acme,500.00\n';
const z = await convertFormat({ text: csv, format: 'csv', filename: 'sales.csv' }, 'zip');
console.log('ZIP comment:\n', readZipArchiveComment(z.bytes));

const p = await convertFormat({ text: csv, format: 'csv', filename: 'sales.csv' }, 'pack');
console.log('PACK comment:\n', readZipArchiveComment(p.bytes));
