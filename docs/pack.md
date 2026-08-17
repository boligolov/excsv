# Pack container

Column-oriented multi-table archive: **`.excsv.pack.zip`** / **`.extsv.pack.zip`**. Standard ZIP container; each table is stored in its own subdirectory, one `.col` file per column (optionally sectioned).

Plain `.excsv` / `.extsv` and row-form `.excsv.zip` / `.extsv.zip` are unchanged; pack is additive.

## Structure

A pack is always structurally plural: even a single-table pack uses a manifest plus one table directory.

**Single-table vs multi-table** (manifest header only):

- **`single-table=<name>` absent** — multi-table. Table-scoped commands require `--table` (or an explicit table name).
- **`single-table=<name>` present** — default table for table-scoped commands. Adding another table drops `single-table=` from the manifest; not an error.

`single-table=` is optional metadata, not a lock.

## Top-level layout

```
mybundle.excsv.pack.zip
├── _manifest.excsv             ← required, first entry
├── orders/
│   ├── _header.excsv
│   ├── 00-id.col
│   ├── 01-customer_id.col
│   ├── 02-amount.col
│   └── ...
├── customers/
│   ├── _header.excsv
│   ├── 00-id.col
│   ├── 01-name.col
│   └── ...
└── products/
    ├── _header.excsv
    └── ...
```

- `_manifest.excsv` MUST be the first ZIP central-directory entry. Header MUST include `original-size=` — sum of every `#table` line's `original-size=` (total uncompressed column payload in the pack).
- ZIP comment SHOULD duplicate the manifest (see [ZIP comment](#zip-comment-manifest-summary)).
- Each table is a subdirectory; schemas and `section-size` may differ per table.
- Manifest `#table` order is canonical; ZIP entry order need not match.

## `_manifest.excsv`

Header-only ExCSV (`#!excsv ... layout=pack`). Reuses ExCSV meta grammar; pack-specific kinds below.

```
#!excsv version=0.3 layout=pack table-count=3 original-size=3123200
#@pack-name: sales-q1-2026
#@author: ops@example.com
#@created: 2026-04-01T00:00:00Z
#@source: warehouse-snapshot
#@comment: Q1 sales pulled for finance review
#table name=orders    dir=orders/    columns=4 original-size=1843200
#table name=customers dir=customers/ columns=2 original-size=512000
#table name=products  dir=products/  columns=3 original-size=768000
#fk from=orders.customer_id to=customers.id
#fk from=orders.product_id  to=products.id
```

Single-table example:

```
#!excsv version=0.3 layout=pack single-table=orders table-count=1 original-size=1843200
#@pack-name: orders-only-export
#table name=orders dir=orders/ columns=4 original-size=1843200
```

### Manifest-only meta lines

| Kind | Syntax | Purpose |
| --- | --- | --- |
| `#table` | `#table name=<n> dir=<path>/ columns=<N> original-size=<bytes>` | Table registry |
| `#fk` | `#fk from=<t>.<col> to=<t>.<col>` | Informational FK (no enforcement) |

- `dir` — ZIP path prefix with trailing `/`.
- `columns` — physical column count = non-virtual `#column` lines in that table's `_header.excsv` (stored + `materialized=1`). Virtual computed columns (`formula=` without `materialized=1`) have no `.col` and are excluded.
- `original-size` — uncompressed sum of `.col` / section `.col` bytes under `dir/` (excludes `_header.excsv`).

Never use `#table` / `#fk` in table `_header.excsv` or plain / row-ZIP files.

### Manifest header fields

| Field | Requirement | Description |
| --- | --- | --- |
| `layout` | **MUST** | `pack` |
| `version` | **MUST** | `0.3` for pack archives |
| `original-size` | **MUST** | Sum of all `#table` `original-size=` values |
| `single-table` | MAY | Default table name while one `#table` exists |
| `table-count` | MAY | Must equal `#table` count if present |

Writers SHOULD finalize `columns=` / per-table `original-size=`, then set manifest `original-size=` to their sum.

### ZIP comment (manifest summary)

Writers **SHOULD** mirror `_manifest.excsv` (or a prefix) in the ZIP end-of-central-directory comment:

- UTF-8, valid ExCSV prefix (`#!excsv` + `#` lines only).
- Priority: header (`layout=pack`, `original-size=`, `single-table=`, `table-count=`) → key `#@` → `#table` → `#fk` → remaining `#@`.
- Truncate at 65535 bytes; append `#@comment-truncated: 1` if needed.
- Comment is advisory; inner manifest wins.

Fast path: `excsv PACKFILE info` / `table list` without `--table` MAY use comment only.

### Auto-discovery fallback

If manifest is missing or has no `#table` lines, readers MUST treat each subdirectory with `_header.excsv` as a table (alphabetical). Tools SHOULD warn. Writers MUST emit a full manifest.

## Table layout

Per table directory:

- **`_header.excsv`** — header + meta, no data rows (`layout=columnar`).
- **Column payloads** — one `.col` per column, or section folders.

```
#!excsv version=0.3 layout=columnar rows=237000 section-size=10000 sql-dialect=postgres
#@source: sales_db.orders
#column name=id type=int unique=1
#column name=customer_id type=int
#column name=amount type=decimal unit=USD
#column name=note type=string
#$ddl: CREATE TABLE orders (...)
#%count_nonnull: 237000,237000,237000,234810
#%sum: ,,3854720.50,
```

| Field | Requirement | Description |
| --- | --- | --- |
| `layout` | **MUST** | `columnar` |
| `rows` | **MUST** | Authoritative row count |
| `section-size` | MAY | Rows per section; absent or `0` = single flat `.col` per column |

### Column files

- Name: `<index>-<safe_name>.col` (zero-padded index; `header=0` → `<index>.col`).
- Contents: one value per line, plain text; empty line = empty field; `null=` from header applies.
- `wc -l` on a column file MUST equal `rows` (per section, section lines sum to `rows`).

### Sectioning

When `section-size=N`, each column is a folder `<index>-<name>/` with files `<start>.col` (zero-padded start row).

- All columns share section boundaries.
- Random access: `section_start = (N / section_size) * section_size`, read line `N - section_start` in that section file.
- Recommended default: `section-size=10000`.

| `section-size` | Pro | Con |
| --- | --- | --- |
| Unset / 0 | Simplest | O(rows) cell read |
| 10,000 | Recommended | — |
| 100,000+ | Fewer entries | Slow in-section scan |

Tables in one pack MAY differ in `section-size`, `#$ddl`, `null=`, etc.

## CLI ergonomics

Pattern (see [excsv-golang](https://github.com/boligolov/excsv-golang)): `excsv [flags] PACKFILE <command>`. Pack adds `--table <name>`.

| Scope | Selector | Target |
| --- | --- | --- |
| Pack | (no `--table`) | `_manifest.excsv` |
| Table | `--table <name>` | `dir/_header.excsv` + `.col` files |

`info` without `--table` shows pack summary only, not rows.

### Pack commands

```powershell
excsv sales.excsv.pack.zip validate
excsv sales.excsv.pack.zip info
excsv sales.excsv.pack.zip cat
excsv sales.excsv.pack.zip meta list
excsv sales.excsv.pack.zip table list
excsv sales.excsv.pack.zip fk list
```

### Table commands

```powershell
excsv sales.excsv.pack.zip rows --table orders
excsv sales.excsv.pack.zip header list --table orders
excsv sales.excsv.pack.zip meta list --table orders
excsv sales.excsv.pack.zip sql list --table orders --verb ddl
```

With `single-table=orders`, `--table` MAY be omitted.

### Column commands

```powershell
excsv sales.excsv.pack.zip col list --table orders
excsv sales.excsv.pack.zip col get amount --table orders
```

### Authoring

```powershell
excsv orders.excsv pack create -o sales.excsv.pack.zip
excsv sales.excsv.pack.zip table add products --from products.excsv
excsv sales.excsv.pack.zip table drop legacy
excsv sales.excsv.pack.zip table extract customers -o customers.excsv
```

### Password-protected archives

Archives **MAY** use standard ZIP encryption. Password via tooling (`--password`); not stored in ExCSV metadata. See [ZIP password protection](zip.md#password-protection).

## Validation

### Pack-level

- Extension `.excsv.pack.zip` or `.extsv.pack.zip`.
- `_manifest.excsv` first in central directory; `layout=pack`, `version=0.3`, `original-size=` = sum of `#table` `original-size=`.
- Each `#table dir=` exists; `columns=` / `original-size=` SHOULD match reality.
- `single-table=` stale if multiple `#table` lines → ignore, MAY warn.
- Table names unique; SHOULD match `[a-z_][a-z0-9_]*`.
- ZIP comment, if present, valid ExCSV prefix.

### Table-level

- `_header.excsv`: `layout=columnar`, `rows=`.
- Column file count matches `#column` count; indices align.
- Unsectioned: each `.col` has `rows` lines.
- Sectioned: sections partition `[0, rows)`; line counts sum to `rows`.
