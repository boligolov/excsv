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

## CSVW — W3C CSV on the Web

[CSVW](https://www.w3.org/TR/tabular-data-primer/) standardizes a **detached JSON-LD metadata document** (`metadata.json`) describing a CSV's dialect, per-column schema (`datatype`, `required`, `default`, `lang`), and foreign keys between tables, discoverable via a `Link` header or a well-known convention. Early ExCSV drafts (through 0.3) embedded CSVW directly — a `csvw=`/`schema=` header pair and an inline `#csvw:` line pointing at or inlining that JSON-LD. **0.4 drops this**: those keys are now ordinary unrecognized fields a parser ignores.

Why drop it: CSVW's metadata is JSON-LD by design and lives in its own document/media-type ecosystem — content negotiation, `Link` headers, one `tableSchema` reused across many CSV files. Bolting that onto ExCSV's line-oriented, single-file profile added a second metadata dialect for no real gain once `#column` / `#@` / `.excsv.json` already covered the same ground natively, in ExCSV's own vocabulary.

If you have CSVW `metadata.json`, migrate `tableSchema.columns[].datatype` → `#column type=`, `titles` → `title=`, `dc:*` properties → `#@` keys, `foreignKeys` → `#$ddl … FOREIGN KEY` or pack `#fk`.

## CSVY

[CSVY](https://csvy.org/) (used by R's `rio`/`datapass` packages) prefixes a CSV with a **YAML front-matter block** delimited by `---` lines — file-level metadata plus a `schema.fields[]` list (`name`, `type`, `description`) — followed by plain CSV rows, no `#` prefix. It's the closest single-file sibling to ExCSV's inline profile: same "metadata block on top, rows below" shape, YAML instead of line-oriented `key=value`.

Because the front matter isn't `#`-prefixed, a CSVY file is **not** valid plain CSV to a reader that doesn't know CSVY — the YAML block would be read as garbage data rows. That's the one property ExCSV treats as non-negotiable: every `#` line is safely ignorable by tools that have never heard of ExCSV. CSVY also has no aggregations, SQL companions, checksum, or container forms.

## Frictionless Data — Table Schema & Data Package

[Frictionless Table Schema](https://data.frictionlessdata.io/specification/table-schema/) (Open Knowledge Foundation) is the closest widely-adopted sibling in spirit: a JSON document describing a CSV's fields (`type`, `format`, `constraints.enum` / `minimum` / `maximum` / `pattern`, `constraints.unique`), typically shipped as `resource.json` or bundled with other resources into one `datapackage.json`, with `foreignKeys` linking resources inside the package.

The difference is where the metadata lives: Table Schema is JSON-first and **detached by default** — the CSV itself never carries it. ExCSV is line-oriented and **inline-first**, with JSON (`.excsv.json`) as a lossless secondary form for exactly the cases (APIs, LLM structured output) where JSON is the more natural fit. Table Schema also has no aggregation or SQL-companion concept — same gap as ECSV/MetaCSV.

Mapping: `fields[].type` / `format` → `#column type=` / `format=`; `constraints.*` → `min` / `max` / `len_min` / `len_max` / `enum` / `pattern` / `required` / `unique`; `primaryKey` / `foreignKeys` → `#$ddl` constraints or pack `#fk`; `resources[]` in a Data Package → ExCSV pack `#table`.

## dbt `schema.yml`

[dbt](https://docs.getdbt.com/reference/resource-properties/columns)'s `schema.yml` attaches per-column `description` and declarative tests — `not_null`, `unique`, `accepted_values`, `relationships` — to a model, enforced by running SQL against a warehouse on every build. It's YAML beside SQL/Jinja model files, not a CSV annotation format, but the vocabulary overlaps closely: `not_null` / `unique` ↔ `required` / `unique`, `accepted_values` ↔ `enum`, `relationships` ↔ pack `#fk` / SQL `FOREIGN KEY`.

The difference is enforcement, not vocabulary: dbt tests are queries that run against live data at build time; ExCSV's equivalents are static, advisory hints read straight off the file — there is no query engine and no build step.

## Croissant (MLCommons)

[Croissant](https://mlcommons.org/croissant/) is a JSON-LD vocabulary built on schema.org's `Dataset`, for describing **ML datasets** — file distributions, `RecordSet`s of typed fields, splits, licensing — aimed at dataset discovery and loading (HuggingFace, Kaggle, and Google Dataset Search all recognize it). It overlaps with ExCSV's LLM-facing ambitions (both want a machine-readable schema an AI pipeline can consume) but sits one level up: Croissant describes a dataset's *distribution and record structure*, often spanning several files and formats, not a single CSV's dialect, per-column enums/patterns, aggregates, or SQL companions.

A Croissant `RecordSet`'s fields roughly map to a table's `#column` list (`dataType` → `type=`). The two aren't really competitors — a Croissant document could describe a dataset made of `.excsv` files the same way it describes any other file, with ExCSV supplying the row-level precision Croissant doesn't attempt.

## What ExCSV adds beyond all of the above

- An explicit `#!excsv` header line declaring the CSV dialect **inside** the file (delimiter, quote, encoding, null marker, row count, checksum).
- `#@key: value` provenance lines (source, author, license, tool, tags, created/exported timestamps).
- Pre-computed aggregations as first-class metadata, not just types and defaults — consumers get `sum`, `avg`, `min`, `max`, `count_*` without scanning the data.
- SQL companions (`#$ddl`, `#$dql`) with dialect tagging — ship the schema and the query that produced the data alongside the data itself, in multiple SQL dialects.
- ZIP container (`.excsv.zip`) with `original-size=` on the inner header and a metadata summary in the archive comment (truncated at 65535 bytes with `#@comment-truncated: 1`) — preview schema without unzipping.
- **Sidecar profile** (plain `.excsv` or `.extsv` metadata-only + `reference=`) for legacy CSV/TSV that must stay byte-identical to RFC 4180.
- Unlike CSVY's YAML front matter or CSVW/Frictionless Data's detached-by-default JSON, every ExCSV profile — inline or sidecar — stays valid, byte-compatible plain CSV: metadata rides only as `#`-prefixed lines any CSV reader already skips.

If you already have ECSV files, the metadata translates 1:1 to ExCSV (`datatype` → `#column type=`, `unit` → `#column unit=`, `description` → `#column description=`, the `meta:` block → individual `#@` keys). If you already have Annotated CSV, the `#datatype` row maps to per-column `#column type=` lines and the `#default` row maps to `#column default=`. For MetaCSV sidecars, map `csv,*` and `file,*` rows to `#!excsv` fields, `data,col/n/type` to `#column index=n type=…` (add `name=` when the data file has a header row), and keep the data file unchanged.
