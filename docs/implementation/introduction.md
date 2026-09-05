# Introduction

ExCSV is a self-describing, line-oriented tabular data format backward-compatible with plain CSV/TSV.

## A descriptive meta-format (normative)

ExCSV is a **descriptive meta-format over CSV/TSV: it describes data, it does not define or alter it.** The data section **MUST** remain byte-for-byte valid CSV/TSV; every `#`-prefixed line only annotates those rows.

- A parser **MUST NOT** rewrite cell values from metadata. `default=` is a schema/DDL attribute and is **not** substituted on read; `null` markers read as null.
- Integrity and consistency signals (`checksum=`, `rows=` vs the visible row count, `default=` vs actual nulls) are advisory: a mismatch is a **warning, never an access gate**, and **MUST NOT** block reading.
- Where a description and a generated artifact diverge (e.g. a DDL `NOT NULL DEFAULT` vs nulls present in the data), the file records both and flags the gap. Rewriting data (materialization, `null` → default) is an explicit tooling operation, never a side effect of reading.

ExCSV puts a table's context back **in the file** — dialect, column types and units, aggregations, provenance, an integrity checksum, and optional SQL — all as `#`-prefixed lines that any CSV reader ignores.

It extends CSV with:

- An inline metadata header (`#!excsv`)
- Column schema annotations (`#column` — types, units, `role`/`agg`, enums, patterns)
- Optional aggregation metadata (`#%` — sum/avg/count/… as a trust anchor)
- Optional file metadata and provenance (`#@` — including `#@grain`, `#@source`)
- Optional SQL companions (`#$` — DDL/DQL with dialect tagging)
- Optional integrity checksum (`checksum=`, advisory)
- Optional ZIP container with the summary carried in the archive comment
- Optional **pack** container: multi-table columnar `.excsv.pack.zip` — see [pack.md](pack.md)
- An equivalent **JSON form**: `.excsv.json` — see [json.md](json.md)

## Four shapes, one format

The same header and `#column` / `#%` / `#$` / `#@` vocabulary applies to every form; the shapes differ only in **how the data is packaged**. See [file structure](file-structure.md), [pack](pack.md), and [JSON form](json.md) for the normative details.

- **Inline** — metadata at the top of the file, above the rows; one artifact that is still a valid CSV.
- **Sidecar** — a header-and-meta-only `.excsv`/`.extsv` next to an untouched `data.csv`/`.tsv`, bound with `reference=`; no data rows are copied.
- **Pack** — `.excsv.pack.zip`: a manifest plus one directory per table, each column stored as its own `.col` entry. Columnar and multi-table.
- **JSON** — `.excsv.json` (`application/excsv+json`): the same document serialized as a JSON object against [`schema/excsv.schema.json`](../../schema/excsv.schema.json). The text form remains canonical; the two are a bijection.

The **ZIP container** (`.excsv.zip`, `.extsv.zip`) Deflate-wraps a single primary ExCSV entry — **inline** or **sidecar**. The inner `#!excsv` header **MUST** carry `original-size=` (uncompressed bytes of that file). The schema and stats are mirrored into the ZIP comment (max 65535 bytes); if the comment does not fit, it **MUST** end with `#@comment-truncated: 1`. A sidecar primary MAY ship its referenced CSV/TSV alongside it as a second entry in the same archive — see [ZIP § Sidecar inside a ZIP archive](zip.md#sidecar-inside-a-zip-archive). Pack is a separate columnar ZIP. See [zip.md](zip.md).

## Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).
