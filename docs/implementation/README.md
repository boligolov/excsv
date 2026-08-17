# ExCSV v0.3 — Implementation spec (normative)

The precise, normative specification for people **building ExCSV tools** — parsers, writers, validators. Uses RFC 2119 keywords (**MUST** / **SHOULD** / **MAY**), pins parser behaviour, and defines the canonical error-code registry.

For a readable, benefits-first tour of the format, see the [guide in `docs/`](../README.md). This folder is the source of truth when the two ever differ.

| Topic | Document |
| --- | --- |
| Introduction | [introduction.md](introduction.md) |
| File structure & sidecar | [file-structure.md](file-structure.md) |
| Header line (`#!excsv`) | [header.md](header.md) |
| Meta lines (overview) | [meta-lines.md](meta-lines.md) |
| File metadata (`#@`) | [file-metadata.md](file-metadata.md) |
| Column schema (`#column`) | [columns.md](columns.md) |
| SQL companions (`#$`) | [sql.md](sql.md) |
| Aggregations (`#%`) | [aggregations.md](aggregations.md) |
| CSVW (`#csvw`) | [csvw.md](csvw.md) |
| Checksum | [checksum.md](checksum.md) |
| ZIP container | [zip.md](zip.md) |
| Pack container | [pack.md](pack.md) |
| Data section | [data-section.md](data-section.md) |
| Error handling (code registry) | [error-handling.md](error-handling.md) |
| Full example | [full-example.md](full-example.md) |
| Prior art | [prior-art.md](prior-art.md) |
| License | [license.md](license.md) |
