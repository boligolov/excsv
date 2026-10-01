# Changelog

Each version is a superset of the previous one: a file valid under an earlier version stays valid, with the same meaning, under every later one. See [Header § Version compatibility](docs/implementation/header.md#version-compatibility).

## 0.6

**Notes and links.** Human context attached to the data without changing it. Guide: [docs/notes.md](docs/notes.md). Normative: [docs/implementation/notes.md](docs/implementation/notes.md).

- **`#note`** — a remark on a cell (`row=`/`key=` + `col=`), a whole row, a whole column, or the table. Fields: `text=` (required), `author=`, `created=`. Several notes per target, kept in file order; no threads.
- **`key=` anchoring** — address a row by the value of its id column (`role=id`, else `unique=1`) instead of its position, so notes and links survive sorting and slicing.
- **`link=` on `#column`** — URL template: `{$}` (this cell), `{name}` (another column in the row), `{N}` (index, `header=0`), `{{` (literal `{`). Values are percent-encoded, except in a template that is a single placeholder (`link="{$}"` — the value is the URL).
- **`#link`** — a URL on one cell, overriding the column's template.
- **Safety** — only `http`/`https`/`mailto` render as links, checked after substitution; `.xlsx` export writes hyperlink objects, never `=HYPERLINK()`.
- **JSON form** — `notes` and `links` arrays (root and per pack table), `link` on column objects. Schema `$id` is now `https://excsv.org/schema/excsv-0.6.schema.json`.
- **ZIP comment** — the priority list now names `#chart` (after `#$dql`); `#note`/`#link` come last.
- **Error codes** — `note_malformed`, `note_missing_text`, `note_row_and_key`, `note_unresolved`, `note_on_manifest`, `link_malformed`, `link_missing_href`, `link_missing_address`, `link_row_and_key`, `link_unresolved`, `link_duplicate`, `link_on_manifest`, `link_unknown_column`, `link_template_malformed`, `link_unsafe_scheme`.
- **Versioning** — a parser **MUST** read files declaring an earlier version without `unknown_version`.

## Earlier versions

- **0.5 — Computed (virtual) columns.** `#column formula=` derives a column from others instead of storing it; `materialized=1` caches the values as an ordinary column, reversibly (`excsv column materialize` / `dematerialize`). Zero storage cost until you choose to pay for it — biggest payoff in [pack](docs/pack.md), where a virtual column costs zero `.col` files. See [docs/columns.md](docs/columns.md#computed-columns).
- **0.4 — JSON form promoted, CSVW dropped.** The JSON serialization is now a first-class shape with its own extension `.excsv.json` and media type `application/excsv+json` ([docs/json.md](docs/json.md), [schema/excsv.schema.json](schema/excsv.schema.json)). Embedded W3C CSVW (`csvw=`, `schema=`, `#csvw:`) is **removed** — those header keys and the `#csvw` line are now ordinary unknown fields that parsers ignore.
- **0.3 — Pack.** `.excsv.pack.zip` / `.extsv.pack.zip`: manifest + per-table columnar `.col` files. [docs/pack.md](docs/pack.md).
- **0.2 — SQL companions** (`#$` DDL/DQL + `sql-dialect=`), **ZIP container** (`.excsv.zip` with `original-size` + in-comment summary, optional password), **human comments** (`##`), and the **sidecar** profile (`reference=` → sibling `.csv`/`.tsv`).
