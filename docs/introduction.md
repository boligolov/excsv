# Introduction

ExCSV is a self-describing, line-oriented tabular data format backward-compatible with plain CSV/TSV.

## A descriptive meta-format (normative)

ExCSV is a **descriptive meta-format layered over CSV/TSV: it describes data, it does not define or alter it.** The data section **MUST** remain byte-for-byte valid CSV/TSV; every `#`-prefixed line only annotates those rows. This principle is load-bearing and has normative consequences:

- **Reading never mutates values.** A parser **MUST NOT** rewrite cells from metadata: `default=` is a schema/DDL attribute and is **not** substituted on read, and `null` markers read as null. The data is presented exactly as authored.
- **Metadata is advisory description.** Integrity and consistency signals — `checksum=`, `rows=` versus the visible row count, `default=` versus actual nulls — describe the data as authored and surface any drift as **warnings, never as access gates**. They flag possible discrepancies; they **MUST NOT** block an expert from reading the file.
- **Description over coercion.** Where a description and a generated artifact diverge (e.g. SQL DDL whose `NOT NULL DEFAULT` disagrees with nulls still present in the data), the file records both and flags the gap; it never silently mutates data to force agreement. Rewriting data (materialization, `null` → default, etc.) is an explicit tooling operation, not a side effect of reading.

The specification is aimed at **data analysts, data scientists, and engineers** who routinely handle **large tabular data**: exports without schema, repeated full-file scans for simple stats, ambiguous column types guessed from a sample, and context that lives in a README, a chat thread, or someone's head instead of in the file. ExCSV puts that context back **in the file** — dialect, column types and units, aggregations, provenance, an integrity checksum, and optional SQL — all as `#`-prefixed lines that any CSV reader already ignores. The data stays plain CSV; it simply stops being anonymous.

It extends CSV with:

- An inline metadata header (`#!excsv`)
- Column schema annotations (`#column` — types, units, `role`/`agg`, enums, patterns)
- Optional aggregation metadata (`#%` — sum/avg/count/… as a trust anchor)
- Optional file metadata and provenance (`#@` — including `#@grain`, `#@source`)
- Optional SQL companions (`#$` — DDL/DQL with dialect tagging)
- Optional embedded [CSVW](https://www.w3.org/TR/tabular-data-primer/) compatibility
- Optional integrity checksum (`checksum=`, advisory)
- Optional ZIP container with the summary carried in the archive comment
- Optional **pack** container: multi-table columnar `.excsv.pack.zip` — see [pack.md](pack.md)

ExCSV is designed for CLI workflows, data interchange, human readability, and minimal parsing complexity.

## Three shapes, one format

The same header and `#column` / `#%` / `#$` / `#@` vocabulary applies to every form; the shapes differ only in **how the data is packaged**. Choose by how your data lives — see [file structure](file-structure.md) and [pack](pack.md) for the normative details.

- **Inline** — metadata rides at the top of the file, above the rows; one artifact that is still a valid CSV. Best for exports you generate, tables you share, and snippets pasted into an LLM. Progressive: add a header, then types, then stats/SQL — every layer optional.
- **Sidecar** — a header-and-meta-only `.excsv`/`.extsv` next to an untouched `data.csv`/`.tsv`, bound with `reference=`; no data rows are copied. The primary way to enrich data that already exists — legacy lakes, vendor dumps, regulated or immutable files — without mutating a single byte.
- **Pack** — `.excsv.pack.zip`: a manifest plus one directory per table, each column stored as its own `.col` entry. Columnar and multi-table: read one column without decompressing the rest, bundle related tables with `#fk`, append columns cheaply. Best for wide tables and database snapshots.

Orthogonal to inline and sidecar, the **ZIP container** (`.excsv.zip`, `.extsv.zip`) Deflate-wraps a single inline or sidecar file and mirrors its schema and stats into the ZIP comment, so tools can preview the header without unzipping. Pack is inherently a columnar ZIP.

## Design Goals (Non-Normative)

- Remain fully backward-compatible with CSV — any CSV reader can consume the data section.
- Support CLI processing with tools like `grep`, `awk`, `cut`, and `head`.
- Avoid mandatory JSON — metadata is line-oriented key-value, not a nested structure.
- Allow progressive enhancement — start with plain CSV, add schema, aggregations, and SQL as needed.
- Make zipped distribution first-class: integrity fields and summary metadata travel inside the archive itself.

## Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).
