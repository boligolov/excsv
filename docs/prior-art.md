# Prior Art

ExCSV stands on the shoulders of prior work that proved a CSV file can carry its own metadata — inline or in a sibling file — without ceasing to be plain CSV for legacy tools.

## ECSV — Enhanced Character-Separated Values (Astropy)

[Astropy's ECSV](https://docs.astropy.org/en/stable/io/ascii/ecsv.html) is the closest spiritual ancestor. It established the core pattern:

- A versioned signature line (`# %ECSV 1.0`).
- A `#`-prefixed metadata block that any CSV reader ignores.
- Per-column descriptors (`name`, `datatype`, `unit`, `format`, `description`).
- Free-form file-level `meta:` block.
- Plain CSV data section that round-trips through every standard tool.

ExCSV adopts the same overall shape but **swaps ECSV's nested YAML header for line-oriented `key=value` pairs**. Each meta line stands on its own — easier to `grep`, `diff`, and hand-write. ExCSV does not carry rich Python-typed objects (masked columns, mixin columns, multidimensional arrays); it is a tabular interchange format, not an in-memory object serializer.

## InfluxDB Annotated CSV

[InfluxDB's Annotated CSV](https://docs.influxdata.com/influxdb/v2/reference/syntax/annotated-csv/) showed the other half of the picture: **annotation rows that carry one value per data column**.

```
#group,false,false,true,true
#datatype,string,long,dateTime:RFC3339,double
#default,mean,,,,
,result,table,_time,_value
```

ExCSV's `#%` aggregation rows are direct descendants of this idea — one row per metric, one value per column, file's CSV dialect for the values. The `#`-as-comment convention and the "any `#` line is safely ignorable by plain CSV readers" guarantee also come from this tradition.

## MetaCSV — sidecar metadata in CSV form

[MetaCSV](https://github.com/MetaCSV/MetaCSV) (J. Férard, draft spec) describes a **detached** metadata file with extension `.mcsv`, stored next to the data CSV. The sidecar is itself a small three-column table (`domain`, `key`, `value`):

| MetaCSV domain | Role | ExCSV analogue |
| --- | --- | --- |
| `meta` | MetaCSV version, creator, target app | `#!excsv version=…`, `#@tool`, … |
| `file` | Encoding, BOM, line terminator | `encoding=`, line-ending rules in [File structure](file-structure.md) |
| `csv` | Delimiter, quote, escape (Python `csv` dialect) | `delim=`, `quote=` on `#!excsv` |
| `data` | Column types as `col/<n>/type` with typed parameters | `#column name=… type=… format=…` |

Column types are **index-based** (`col/0/type`, `col/1/type`, …) with rich, locale-aware parameters (e.g. `date/yyyy-MM-dd`, `boolean/vrai/faux`, `currency/post/€/decimal/,/.`). ExCSV sidecars instead use **line-oriented `#` meta** (same vocabulary as inline ExCSV), optional **name-based** `#column` when `header=1`, and an explicit `reference=` bind to the data file.

Pairing is by convention (`data.csv` + `data.mcsv`); ExCSV uses the same basename pattern (`data.csv` + `data.excsv`, `data.tsv` + `data.extsv`) plus normative `reference=`.

MetaCSV targets **interpretation and typing** for SQL/ODS export; it does not define aggregations, SQL companions, checksums, or ZIP containers. A minimal MetaCSV sidecar may list only non-default keys; ExCSV canonical writers similarly omit default header fields.

## What ExCSV adds beyond all of the above

- An explicit `#!excsv` header line declaring the CSV dialect **inside** the file (delimiter, quote, encoding, null marker, row count, checksum).
- `#@key: value` provenance lines (source, author, license, tool, tags, created/exported timestamps).
- Pre-computed aggregations as first-class metadata, not just types and defaults — consumers get `sum`, `avg`, `min`, `max`, `count_*` without scanning the data.
- SQL companions (`#$ddl`, `#$dql`) with dialect tagging — ship the schema and the query that produced the data alongside the data itself, in multiple SQL dialects.
- ZIP container (`.excsv.zip`) with the metadata summary embedded in the archive's comment field — preview schema without unzipping.
- **Sidecar profile** (plain `.excsv` or `.extsv` metadata-only + `reference=`) for legacy CSV/TSV that must stay byte-identical to RFC 4180.

If you already have ECSV files, the metadata translates 1:1 to ExCSV (`datatype` → `#column type=`, `unit` → `#column unit=`, `description` → `#column description=`, the `meta:` block → individual `#@` keys). If you already have Annotated CSV, the `#datatype` row maps to per-column `#column type=` lines and the `#default` row maps to `#column default=`. For MetaCSV sidecars, map `csv,*` and `file,*` rows to `#!excsv` fields, `data,col/n/type` to `#column index=n type=…` (add `name=` when the data file has a header row), and keep the data file unchanged.
