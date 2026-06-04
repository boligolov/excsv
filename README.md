# ExCSV v0.3 — Specification

**Extended Comma-Separated Values (ExCSV)**

| | |
| --- | --- |
| **Version** | 0.3 |
| **Status** | Draft / Experimental |
| **File extensions** | `.excsv`, `.extsv` (plain — inline or sidecar); `.excsv.zip`, `.extsv.zip` (row ZIP); `.excsv.pack.zip`, `.extsv.pack.zip` (columnar pack) |
| **MIME types** | `text/excsv` (plain); `application/excsv+zip` (zipped) |

> **Feeding ExCSV to an LLM?** Use [`README-LLM.md`](README-LLM.md) — condensed tables, pseudocode, translation notes. Raw paste link: `https://raw.githubusercontent.com/boligolov/excsv/main/README-LLM.md`

## What's new in 0.3

- **Pack** — `.excsv.pack.zip` / `.extsv.pack.zip`: manifest + per-table columnar `.col` files. [docs/pack.md](docs/pack.md).

## What's new in 0.2

- Meta line kind `#$` for SQL companions (DDL/DQL) and header field `sql-dialect`.
- ZIP container (`.excsv.zip`, `.extsv.zip`) with `original-size` and in-comment summary; archives **MAY** use a standard ZIP password (tooling supplies the secret — not stored in ExCSV metadata). See [ZIP](docs/zip.md#password-protection).
- Human comment marker `##` (ignored by parsers).
- **Sidecar** profile: plain `.excsv` or `.extsv` with only header+meta and `reference=` → sibling `.csv` or `.tsv`. See [file structure](docs/file-structure.md#sidecar-detached-metadata).

## Quick example

```
#!excsv version=0.3 delim=comma header=1
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
excsv data.excsv validate
excsv data.excsv.zip info
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
| Pack container | [docs/pack.md](docs/pack.md) |
| Data section | [docs/data-section.md](docs/data-section.md) |
| Error handling | [docs/error-handling.md](docs/error-handling.md) |
| Full example | [docs/full-example.md](docs/full-example.md) |
| Prior art | [docs/prior-art.md](docs/prior-art.md) |
| License | [docs/license.md](docs/license.md) |

## License

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — see [docs/license.md](docs/license.md).
