# File Structure

An ExCSV file **MUST** consist of, in order:

```
┌─────────────────────────┐
│  Header Line            │  ← zero or one, optional
├─────────────────────────┤
│  Meta Lines             │  ← zero or more
├─────────────────────────┤
│  Data Section           │  ← standard CSV/TSV rows
└─────────────────────────┘
```

An ExCSV document **MAY** omit the header line. If the header line is missing, the document **MUST** be interpreted as a minimal ExCSV document with default parameters (`delim=comma`, `quote=double`, `header=1`, `encoding=UTF-8`).

The smallest valid ExCSV file is an empty file, or a single header line: `#!excsv version=0.2` (a **header-only stub** with no data and no `reference=`).

## Document profiles (plain)

| Profile | Data section | `reference=` |
| --- | --- | --- |
| **Inline** (default) | present | **MUST NOT** be set |
| **Sidecar** | absent | **REQUIRED** — see [Sidecar](#sidecar-detached-metadata) |
| **Header-only stub** | absent | absent (templates, exports) |

See also the [storage forms overview](https://excsv.org/variants/) on the project website.

## Sidecar (detached metadata)

A **sidecar** is a plain ExCSV file containing only the `#!excsv` header and `#` meta lines — **no data section** — that describes tabular data in a separate CSV or TSV file.

**Pairing:** `sales.excsv` with `sales.csv`, or `sales.extsv` with `sales.tsv`. Same basename; the sidecar extension signals metadata. A `.extsv` file (inline or sidecar) **SHOULD** declare `delim=tab`.

Plain `.excsv` and `.extsv` files **MAY** be **inline** (header + meta + data) or **sidecar** (header + meta only, with `reference=`).

**Required field:** the header **MUST** include `reference=<relative-path>` — path to the data file, relative to the sidecar's directory, **MUST NOT** be absolute. Example: `reference=sales.csv`.

**Invariants:**

- After meta lines, the file **MUST** end. Any data row while `reference=` is set **MUST** fail validation.
- Inline files (with data rows) **MUST NOT** set `reference=`.
- `#@source` is provenance, not a filesystem path — do not use it instead of `reference=`.

**Derived fields:** `rows=`, `checksum=`, and `#%` lines describe the **referenced** data file. Checksum verification requires opening both files.

**Discovery:** when opening `sales.csv`, implementations **MAY** load `sales.excsv` from the same directory; when opening `sales.tsv`, implementations **MAY** load `sales.extsv`. When opening a sidecar, implementations **MUST** resolve `reference=` to obtain data rows.

**Example** — `sales.excsv`:

```
#!excsv version=0.2 delim=comma quote=double header=1 rows=2 reference=sales.csv
#@source: sales_db.orders
#column name=id type=int
#column name=customer type=string
#%sum: ,,750.50
```

`sales.csv` (ordinary CSV, no ExCSV header):

```
id,customer,amount
1,Acme Corp,500.00
2,Globex Inc,250.50
```

Sidecar pairs are **not** combined into `.excsv.zip` or `.extsv.zip` in v0.2; materialize inline or ship two plain files.

## Line Endings and BOM

- Files **MAY** use LF or CRLF line endings. Parsers **MUST** accept both.
- Parsers **MUST** ignore UTF-8 BOM (`U+FEFF`) at start of file.
