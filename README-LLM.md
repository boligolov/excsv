# ExCSV v0.2 — LLM Reference

Dense spec for AI assistants. Human-readable split: [docs/](docs/). Topic index below.

**Identity:** ExCSV = self-describing CSV/TSV. Version 0.2 (Draft). Extensions: `.excsv`, `.extsv` (plain — inline or sidecar); `.excsv.zip`, `.extsv.zip`. MIME: `text/excsv`, `application/excsv+zip`. Default encoding UTF-8. CC0 1.0.

**Reference impl:** [excsv-golang](https://github.com/boligolov/excsv-golang) — `excsv` CLI; plain + row-ZIP v0.2.

**File layout:** optional `#!excsv` header → `#` meta lines → CSV/TSV data. First non-`#` line starts data. Missing header → defaults `delim=comma`, `quote=none`, `header=1`, `encoding=UTF-8`.

**Meta prefixes:** `##` human comment (ignore) · `#@` file metadata · `#column` schema · `#csvw` JSON · `#$` SQL · `#%` aggregations.

---

## Specification (by topic)

| Topic | Document |
| --- | --- |
| Identity & implementations | [docs/llm/identity.md](docs/llm/identity.md) |
| File structure & sidecar | [docs/llm/file-structure.md](docs/llm/file-structure.md) |
| Header line | [docs/llm/header.md](docs/llm/header.md) |
| Meta lines (overview) | [docs/llm/meta-lines.md](docs/llm/meta-lines.md) |
| File metadata (`#@`) | [docs/llm/file-metadata.md](docs/llm/file-metadata.md) |
| Column schema | [docs/llm/columns.md](docs/llm/columns.md) |
| SQL (`#$`) | [docs/llm/sql.md](docs/llm/sql.md) |
| Aggregations (`#%`) | [docs/llm/aggregations.md](docs/llm/aggregations.md) |
| CSVW | [docs/llm/csvw.md](docs/llm/csvw.md) |
| Checksum | [docs/llm/checksum.md](docs/llm/checksum.md) |
| ZIP container | [docs/llm/zip.md](docs/llm/zip.md) |
| Data section | [docs/llm/data-section.md](docs/llm/data-section.md) |
| Reserved (future) | [docs/llm/reserved.md](docs/llm/reserved.md) |
| Error handling | [docs/llm/error-handling.md](docs/llm/error-handling.md) |
| Parsing algorithm | [docs/llm/parsing.md](docs/llm/parsing.md) |
| Serialization algorithm | [docs/llm/serialization.md](docs/llm/serialization.md) |
| Quick-reference examples | [docs/llm/quick-reference.md](docs/llm/quick-reference.md) |
| Canonical example | [docs/llm/canonical-example.md](docs/llm/canonical-example.md) |
| License | [docs/llm/license.md](docs/llm/license.md) |

**Raw link for tools:** `https://raw.githubusercontent.com/boligolov/excsv/main/README-LLM.md` (hub only — fetch individual `docs/llm/*.md` for full detail).
