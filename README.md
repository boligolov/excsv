# ExCSV v0.2 — Specification

**Extended Comma-Separated Values (ExCSV)**

| | |
| --- | --- |
| **Version** | 0.2 |
| **Status** | Draft / Experimental |
| **File extensions** | `.excsv`, `.ecsv` (plain inline); `.etsv`, `.extsv` (sidecar for TSV); `.excsv.zip`, `.ecsv.zip` (zipped) |
| **MIME types** | `text/excsv` (plain); `application/excsv+zip` (zipped) |

> **Feeding ExCSV to an LLM?** Use [`README-LLM.md`](README-LLM.md) — condensed tables, pseudocode, translation notes. Raw paste link: `https://raw.githubusercontent.com/boligolov/excsv/main/README-LLM.md`

## What's new in 0.2

- Meta line kind `#$` for SQL companions (DDL/DQL) and header field `sql-dialect`.
- ZIP container (`.excsv.zip`) with `original-size` and in-comment summary.
- Human comment marker `##` (ignored by parsers).
- **Sidecar** profile: metadata-only `.excsv` / `.etsv` / `.extsv` with `reference=` → sibling CSV/TSV. See [file structure](docs/file-structure.md#sidecar-detached-metadata).
- Reserved names for future `.excsv.pack.zip`. See [ZIP → reserved](docs/zip.md#reserved-for-future-use).

## Quick example

```
#!excsv version=0.2 delim=comma header=1
#column name=id type=int
#column name=name type=string
#column name=price type=decimal unit=USD
id,name,price
1,Widget,9.99
2,Gadget,24.50
```

Full-featured sample: [docs/full-example.md](docs/full-example.md).

## Reference implementation

**[excsv-golang](https://github.com/boligolov/excsv-golang)** — validate, inspect, convert, wrap/unwrap archives.

```bash
go install github.com/boligolov/excsv-golang/cmd/excsv@latest
excsv validate data.excsv
excsv info data.excsv.zip
```

More tools: [excsv.org/tools](https://excsv.org/tools/).

---

## Specification (by topic)

| Topic | Document |
| --- | --- |
| Introduction | [docs/introduction.md](docs/introduction.md) |
| File structure & sidecar | [docs/file-structure.md](docs/file-structure.md) |
| Header line (`#!excsv`) | [docs/header.md](docs/header.md) |
| Meta lines (overview) | [docs/meta-lines.md](docs/meta-lines.md) |
| File metadata (`#@`) | [docs/file-metadata.md](docs/file-metadata.md) |
| Column schema (`#column`) | [docs/columns.md](docs/columns.md) |
| SQL companions (`#$`) | [docs/sql.md](docs/sql.md) |
| Aggregations (`#%`) | [docs/aggregations.md](docs/aggregations.md) |
| CSVW (`#csvw`) | [docs/csvw.md](docs/csvw.md) |
| Checksum | [docs/checksum.md](docs/checksum.md) |
| ZIP container | [docs/zip.md](docs/zip.md) |
| Data section | [docs/data-section.md](docs/data-section.md) |
| Error handling | [docs/error-handling.md](docs/error-handling.md) |
| Full example | [docs/full-example.md](docs/full-example.md) |
| Prior art | [docs/prior-art.md](docs/prior-art.md) |
| License | [docs/license.md](docs/license.md) |

## License

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — see [docs/license.md](docs/license.md).
