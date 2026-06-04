# File Structure

```
LINE 1:       Header line (zero or one, optional)
LINES 2..N:   Meta lines (zero or more, all start with #)
LINES N+1..:  Data section (standard CSV/TSV rows)
```

An ExCSV document MAY omit the header line. If the header line is missing, the document MUST be interpreted as a minimal ExCSV document with default parameters (`delim=comma`, `quote=none`, `header=1`, `encoding=UTF-8`).

Transition rule: first line NOT starting with `#` begins the data section. All meta lines MUST precede data.

Minimal valid file: an empty file, or `#!excsv version=0.3` (header-only stub).

Line endings: files MAY use LF or CRLF. Parsers MUST accept both. Parsers MUST ignore UTF-8 BOM (`U+FEFF`) at start of file.

## Document profiles (plain)

| Profile | Data section | `reference=` | Notes |
| --- | --- | --- | --- |
| **inline** (default) | present | MUST NOT be set | Canonical single-file ExCSV |
| **sidecar** | absent | REQUIRED | Metadata for external CSV/TSV; see below |
| **header-only stub** | absent | absent | Templates, schema exports; not bound to external data |

## Sidecar (detached metadata)

A **sidecar** is a plain ExCSV document that contains ONLY the `#!excsv` header and `#` meta lines — no data section — and describes tabular data stored in a separate CSV or TSV file.

### Pairing convention

| Extension | Typical data sibling (sidecar) | Notes |
| --- | --- | --- |
| `.excsv` | `.csv` | Plain — inline or sidecar |
| `.extsv` | `.tsv` | Plain — inline or sidecar; SHOULD declare `delim=tab` |

Files SHOULD share the same basename (`sales.excsv` + `sales.csv`, or `sales.extsv` + `sales.tsv`).

### Required header field

```
reference=<relative-path>   REQUIRED on sidecars; path to the data file, relative to the sidecar file's directory
```

- The path MUST be relative (MUST NOT be absolute).
- Typical value is a basename only (`sales.csv`). Subpaths (`exports/sales.csv`) MAY be used.
- Inline documents (with a data section) MUST NOT set `reference=`.
- `#@source` is provenance (system/table name), not a load path — do not substitute for `reference=`.

### Sidecar invariants

- After the meta block, the file MUST end (EOF). Any data row while `reference=` is set is a MUST-fail error (`sidecar_has_data_section`).
- A meta-only file without `reference=` is a header-only stub, not a sidecar.
- A meta-only file without `reference=` MUST NOT be validated as a sidecar (`sidecar_missing_reference` applies only when the consumer expects sidecar profile).

### Derived fields on referenced data

When `reference=` is set:

- `rows=`, `checksum=`, and `#%` lines describe the **referenced** data file, not the sidecar bytes.
- Checksum verification requires reading the pair (sidecar + referenced file). Parsing the sidecar alone MAY skip checksum verification.
- Data-section rules (`delim`, `quote`, `header`, `null`) apply when parsing the referenced file.

### Discovery (optional ergonomics)

When opening `sales.csv`, implementations MAY look for `sales.excsv` in the same directory; when opening `sales.tsv`, implementations MAY look for `sales.extsv`. When opening a sidecar, implementations MUST resolve `reference=` to load data (strict parse MUST require the referenced file to exist; lenient MAY warn).

### Prior art: MetaCSV

[MetaCSV](https://github.com/MetaCSV/MetaCSV) is a draft sidecar spec (`.mcsv`): auxiliary CSV with columns `domain,key,value`. Domains: `meta` (version), `file` (encoding, line terminator), `csv` (delimiter, quote), `data` (`col/<n>/type` with locale-aware type parameters). Pairing by basename (`data.csv` + `data.mcsv`). ExCSV sidecar differs: `#` meta lines (not CSV-in-CSV), `reference=` path, name-based `#column` when `header=1`, plus aggregations/SQL/ZIP not in MetaCSV. Map `csv,delimiter` → `delim=`, `data,col/n/type` → `#column index=n type=…`.

### Sidecar example

`sales.excsv` (metadata only):

```
#!excsv version=0.3 delim=comma quote=double header=1 rows=2 reference=sales.csv
#@source: sales_db.orders
#column name=id type=int
#column name=customer type=string
#column name=amount type=decimal
#%sum: ,,750.50
```

`sales.csv` (plain CSV, no `#!excsv`):

```
id,customer,amount
1,Acme Corp,500.00
2,Globex Inc,250.50
```
