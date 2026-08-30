# ExCSV v0.4 — Specification

**Extended Comma-Separated Values — CSV that describes itself.**

You open a CSV export and lose the afternoon: which column is the amount, is `01720` a ZIP code or a number, is `2026-01-02` Jan-2 or Feb-1, are these *all* the rows or just the first thousand your tool showed you — and what's the total? The context that answers this lived in a README, a Slack thread, or someone's head. Never in the file. ExCSV puts it back **in the file**: dialect, column types and units, summary stats, SQL to recreate the table, and an integrity checksum — all as `#` comment lines that every existing CSV reader already ignores. Your data stays plain CSV; it just stops being anonymous.

| | |
| --- | --- |
| **Version** | 0.4 |
| **Status** | Draft / Experimental |
| **File extensions** | `.excsv`, `.extsv` (plain — inline or sidecar); `.excsv.json` (JSON form); `.excsv.zip`, `.extsv.zip` (row ZIP); `.excsv.pack.zip`, `.extsv.pack.zip` (columnar pack) |
| **MIME types** | `text/excsv` (plain); `application/excsv+json` (JSON); `application/excsv+zip` (row ZIP); `application/excsv-pack+zip` (pack) |

## Why data scientists care

- **Stop guessing types.** `#column type=… unit=USD format=…` — no inferring dates, ZIP codes, or decimals from a 5-row sample that lies.
- **Trust the totals.** `#%sum / avg / count / count_distinct` ride along — answer aggregate questions (and sanity-check your own math) without scanning the file.
- **Know the grain.** `#@grain: one row per order` plus `role=` / `agg=` tell a human *or an LLM* what a row means and which operations are valid (never sum an id).
- **Recreate the schema anywhere.** `#$ddl` ships MySQL / Postgres / ClickHouse DDL inside the file: `excsv sql ddl postgres data.excsv | psql`.
- **It's still just a CSV.** `grep`, `awk`, `cut`, pandas, Excel keep working — every metadata line starts with `#`.

## Four shapes, one format

Same `#!excsv` header and `#column` / `#%` / `#$` / `#@` vocabulary everywhere — the shapes differ only in **how the data is packaged**. Pick by how your data lives.

### 1. Inline — self-describing CSV

Metadata rides at the top of the file, above the rows. One artifact, still a valid CSV.

```
#!excsv version=0.4 header=1 sql-dialect=postgres
#@grain: one row per order
#column name=id type=int role=id
#column name=amount type=decimal unit=USD role=measure agg=sum
#%sum: ,1050.50
id,amount
1,500.00
2,550.50
```

- **Best for:** exports you generate, tables you share, snippets you paste into an LLM.
- **Wins:** zero extra files; progressive — add a header, then types, then stats/SQL, every layer optional; opens everywhere.
- **Zip it** (`.excsv.zip`): the file is Deflate-wrapped and its schema + stats are mirrored into the ZIP **comment**, so tools preview the header *without unzipping*. Archives MAY carry a standard ZIP password.

### 2. Sidecar — annotate data you won't touch

Leave `data.csv` byte-for-byte. Drop a `data.excsv` beside it: header + meta only, plus `reference=data.csv`. No rows are copied.

```
#!excsv version=0.4 header=1 reference=data.csv
#@source: vendor-nightly-dump
#column name=customer_id type=long role=id
#column name=revenue type=decimal unit=USD role=measure agg=sum
```

- **Best for:** existing lakes and vendor dumps, regulated or immutable files, anything with a checksum or contract you must not break. **This is the primary way to enrich data that already exists.**
- **Wins:** the original is never mutated; layer schema/types/stats/SQL onto legacy CSVs; keep several sidecars describing the same file for different consumers.
- **Zip it:** the sidecar (and its referenced file) can travel zipped too.

### 3. Pack — multi-table columnar archive

`.excsv.pack.zip`: a manifest plus one directory per table, each column stored as its own `.col` entry. Columnar and multi-table.

```
sales.excsv.pack.zip
├── _manifest.excsv        # layout=pack, #table / #fk lines
├── orders/    _header.excsv + 00-id.col 01-amount.col …
└── customers/ _header.excsv + 00-id.col 01-name.col …
```

- **Best for:** wide tables, database snapshots, analytical delivery where you read a few columns out of many.
- **Wins:** read **one column** without decompressing the rest; bundle related tables with `#fk`; cheap append-column; better compression on homogeneous typed columns. Everything else — schema, stats, SQL, checksum — applies per table.
- This is where all the pieces intersect: the columnar payoff layered on the same metadata model.

### 4. JSON — the same document, JSON-native

`.excsv.json`: every `#` line becomes a key. Same vocabulary, real types, one JSON Schema you can validate against or constrain a model to.

```json
{
  "excsv": "0.4",
  "meta": { "grain": "one row per order" },
  "columns": [
    { "index": 0, "name": "id", "type": "int", "role": "id" },
    { "index": 1, "name": "amount", "type": "decimal", "unit": "USD", "role": "measure", "agg": "sum" }
  ],
  "aggregates": { "sum": [null, "1050.50"] },
  "data": [[1, "500.00"], [2, "550.50"]]
}
```

- **Best for:** APIs and config, JS/TS frontends, and LLM structured output — a model emits JSON against the schema instead of hand-writing `#!excsv` text.
- **Wins:** real types instead of stringly-typed cells (money stays a string so it never becomes a float); a single [JSON Schema](schema/excsv.schema.json) for validation; inline, sidecar, and pack all fit in the same object.
- The CSV text form stays **canonical**: text → JSON → text is a lossless round-trip. [docs/json.md](docs/json.md).

### Which shape?

| | Inline | Sidecar | Pack | JSON |
| --- | --- | --- | --- | --- |
| Original CSV untouched | — | ✓ | — | ✓ (as a sidecar) |
| Reads as plain CSV | ✓ | ✓ (the referenced file) | — | — |
| Single artifact | ✓ | — (pair) | ✓ (archive) | ✓ |
| Zip option | `.excsv.zip` | zip the pair | inherent | — |
| Selective single-column read | — | — | ✓ | — |
| Multi-table + foreign keys | — | — | ✓ | ✓ (`tables[]`) |
| Best fit | new exports, LLM paste | existing / immutable data | wide, multi-table snapshots | APIs, config, LLM structured output |

Full-featured sample: [docs/full-example.md](docs/full-example.md).

## Reference implementation

**[excsv-golang](https://github.com/boligolov/excsv-golang)** — validate, inspect, convert, wrap/unwrap archives.

```bash
go install github.com/boligolov/excsv-golang/cmd/excsv@latest
excsv data.excsv validate
excsv data.excsv.zip info
```

More tools: [excsv.org/tools](https://excsv.org/tools/).

## What's new

- **0.4 — JSON form promoted, CSVW dropped.** The JSON serialization is now a first-class shape with its own extension `.excsv.json` and media type `application/excsv+json` ([docs/json.md](docs/json.md), [schema/excsv.schema.json](schema/excsv.schema.json)). Embedded W3C CSVW (`csvw=`, `schema=`, `#csvw:`) is **removed** — those header keys and the `#csvw` line are now ordinary unknown fields that parsers ignore.
- **0.3 — Pack.** `.excsv.pack.zip` / `.extsv.pack.zip`: manifest + per-table columnar `.col` files. [docs/pack.md](docs/pack.md).
- **0.2 — SQL companions** (`#$` DDL/DQL + `sql-dialect=`), **ZIP container** (`.excsv.zip` with `original-size` + in-comment summary, optional password), **human comments** (`##`), and the **sidecar** profile (`reference=` → sibling `.csv`/`.tsv`).

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
| Checksum | [docs/checksum.md](docs/checksum.md) |
| ZIP container | [docs/zip.md](docs/zip.md) |
| Pack container | [docs/pack.md](docs/pack.md) |
| JSON form (`.excsv.json`) | [docs/json.md](docs/json.md) |
| Data section | [docs/data-section.md](docs/data-section.md) |
| Full example | [docs/full-example.md](docs/full-example.md) |
| Prior art | [docs/prior-art.md](docs/prior-art.md) |
| License | [docs/license.md](docs/license.md) |

The docs above are written for people who work with tables. **Building a tool or parser?** The normative spec — parser rules, validation, and the error-code registry — lives in [docs/implementation/](docs/implementation/).

## License

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — see [docs/license.md](docs/license.md).
