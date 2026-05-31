# Step 1 — Abstract Feature Catalog

Format-agnostic capability map. Independent of Go / Python / CLI surface. Each feature lists its semantic intent and its support across the three storage forms.

## Storage forms

| Short name | Extension(s) | Layout | Notes |
| --- | --- | --- | --- |
| **plain** | `.excsv`, `.ecsv` | row-oriented text | Backward-compatible with CSV/TSV. The canonical form. |
| **zip** | `.excsv.zip`, `.ecsv.zip` | row-oriented text, Deflate-wrapped | Container of exactly one plain file. ZIP comment summary. |
| **pack** | `.excsv.pack.zip`, `.ecsv.pack.zip` | columnar, multi-table (or single-table mode) | ZIP archive of `_manifest.excsv` + per-table directories of `.col` files. Reserved in v0.2; promotes to spec post-v0.3. |

`plain` and `zip` are the **row family** (RF). `pack` is the **pack family** (PF).

## Operating modes (apply to both families)

- **Mode A — metadata-only.** Touches only the `#` section. No data scan. Fast, safe, stream-friendly.
- **Mode B — data-aware.** Reads (and possibly rewrites) the data section. Auto-syncs derived fields (`rows=`, `checksum=`, `#%`, `#@exported`).

Mode A on a pack still touches `_manifest.excsv` and each table's `_header.excsv`; "metadata-only" generalises cleanly.

## Support legend

- `✓` native and direct
- `≈` supported but with format-specific semantics (notes column)
- `⊕` pack-only by nature (multi-table, columnar)
- `—` not applicable / explicitly out of scope
- `↗` planned but later (post-v0.3 in this catalog's case)

---

## A. Document I/O

Core lifecycle: open, parse, materialize, serialize, stream.

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | Open from path | ✓ | ✓ | ✓ | Magic-byte sniff (`PK\x03\x04` → ZIP family) optional. Extension is authoritative. |
| A2 | Open from stdin | ✓ | ≈ | ≈ | Zipped streams require seekable buffer or temp-file fallback. |
| A3 | Open from URL / bytes | ✓ | ✓ | ✓ | Library API concern; CLI just shells through stdin/path. |
| A4 | Parse strict (fail on any spec violation) | ✓ | ✓ | ✓ | |
| A5 | Parse lenient (collect warnings, continue) | ✓ | ✓ | ✓ | |
| A6 | Serialize to canonical bytes | ✓ | ✓ | ✓ | Canonical = sorted header fields, recommended meta order, LF endings. |
| A7 | Round-trip equality (parse → serialize → parse) | ✓ | ✓ | ✓ | `##` human comments are NOT preserved unless opt-in. |
| A8 | Streaming row reader | ✓ | ✓ | ≈ | PF: streams rows by reading one section across all `.col` files; degrades to per-row file seeks if unsectioned. |
| A9 | Streaming row writer | ✓ | ✓ | ⊕ | PF: collect rows until section boundary, flush section to all `.col` entries simultaneously. |
| A10 | Stream-passthrough mode (data bytes preserved verbatim) | ✓ | ≈ | — | RF: untouched bytes for Mode A commands. PF has no equivalent — any write touches multiple files. |

## B. Header line (`#!excsv`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| B1 | Read all fields | ✓ | ✓ | ≈ | PF: manifest header and each table header are addressable separately. |
| B2 | Read one field | ✓ | ✓ | ≈ | Path notation: `header.version`, `tables.orders.header.version`. |
| B3 | Set field (Mode A) | ✓ | ✓ | ✓ | PF: scope = pack-manifest OR a specific table header. |
| B4 | Remove field (Mode A) | ✓ | ✓ | ✓ | |
| B5 | Validate field values (types, well-known tokens) | ✓ | ✓ | ✓ | |
| B6 | Detect missing-header default minimum file | ✓ | — | — | RF only. |

## C. File-level metadata (`#@`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | List keys | ✓ | ✓ | ≈ | PF: per-table AND pack-level. |
| C2 | Read one key | ✓ | ✓ | ≈ | Path notation as B2. |
| C3 | Set / remove / clear (Mode A) | ✓ | ✓ | ✓ | |
| C4 | Bulk import (key=value file) | ✓ | ✓ | ✓ | |
| C5 | Canonical-order sort | ✓ | ✓ | ✓ | Stable rule across all `_header.excsv` instances. |
| C6 | Auto-touch (`#@exported = now()`) | ✓ | ✓ | ✓ | Triggered by Mode B writes when key present. |
| C7 | Sign helper (set author / tool / exported in one step) | ✓ | ✓ | ✓ | |

## D. Column schema (`#column`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| D1 | List columns with attributes | ✓ | ✓ | ✓ | |
| D2 | Show one column | ✓ | ✓ | ✓ | |
| D3 | Add / remove / rename / modify declaration (Mode A) | ✓ | ✓ | ≈ | PF rename also renames the `.col` entry (or section folder). Single-pass ZIP rewrite, no re-deflate; cost ≈ bytes after the renamed entry. Bounded and offline, not hot-path. |
| D4 | Infer types and constraints from data (Mode B) | ✓ | ✓ | ✓ | PF: cheaper per-column thanks to columnar layout. |
| D5 | Reorder declarations (Mode A) | ✓ | ✓ | ≈ | PF: renumbers the `<index>-` prefix on every shifted column entry. Same single-pass ZIP rewrite cost as D3, multiplied by the number of shifted columns. |
| D6 | Validate header row matches `#column name=` | ✓ | ✓ | — | RF only; PF has no in-data header row. |

## E. Aggregations (`#%`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| E1 | Read aggregations | ✓ | ✓ | ✓ | |
| E2 | Set explicit values (Mode A) | ✓ | ✓ | ✓ | |
| E3 | Compute from data (Mode B) | ✓ | ✓ | ✓ | PF: parallelizable per column. |
| E4 | Verify against recomputed values | ✓ | ✓ | ✓ | |
| E5 | Remove / clear | ✓ | ✓ | ✓ | |
| E6 | Mark stale on data mutation | ✓ | ✓ | ✓ | |
| E7 | Canonical-order sort | ✓ | ✓ | ✓ | |
| E8 | Pack-level cross-table aggregations | — | — | ↗ | Open question; deferred. |

## F. SQL companions (`#$`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| F1 | Read SQL statements (preserving order) | ✓ | ✓ | ✓ | |
| F2 | List by verb (`ddl`/`dql`) | ✓ | ✓ | ✓ | |
| F3 | Filter by target dialect (exact / family / version) | ✓ | ✓ | ✓ | |
| F4 | Append statement (Mode A) | ✓ | ✓ | ✓ | |
| F5 | Generate DDL from `#column` lines | ✓ | ✓ | ✓ | |
| F6 | Apply DDL (emit ordered SQL for target dialect) | ✓ | ✓ | ✓ | |
| F7 | Resolve effective dialect (header default, line suffix, ANSI fallback) | ✓ | ✓ | ✓ | |
| F8 | Warn on unknown dialect / verb / no-match | ✓ | ✓ | ✓ | |
| F9 | Pack-level DDL across tables (ordered by FK) | — | — | ↗ | Open question; deferred. |

## G. Data reading

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| G1 | Count rows | ✓ | ✓ | ✓ | `rows=` authoritative; verify on demand. |
| G2 | Extract single column (all values) | ≈ | ≈ | ✓ | RF: full data-section scan. PF: one ZIP entry. Killer feature. |
| G3 | Extract single row (by index) | ≈ | ≈ | ≈ | RF: linear scan. PF unsectioned: linear scan per column. PF sectioned: O(section-size). |
| G4 | Head / tail / slice | ✓ | ✓ | ✓ | PF tail: requires `rows=` to locate last section. |
| G5 | Random-access cell read | ≈ | ≈ | ✓ | PF sectioned: O(section-size). RF: linear. |
| G6 | Full table iteration | ✓ | ✓ | ✓ | |
| G7 | Multi-column projection | ≈ | ≈ | ✓ | PF: reads only N entries. RF: full row decode then drop. |

## H. Data transformation

All Mode B. Output is a new document; in-place rewrites are an I/O concern. PF column splitting means transforms either operate per-table or scope to one named table.

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| H1 | Filter by predicate | ✓ | ✓ | ≈ | PF: operates on one named table at a time. Multi-table filter is a loop. |
| H2 | Sort | ✓ | ✓ | ≈ | PF: must materialize rows; sort; rewrite columns. No columnar shortcut. |
| H3 | Dedupe | ✓ | ✓ | ≈ | As H2. |
| H4 | Select / drop columns | ✓ | ✓ | ✓ | PF: dropping = delete the `.col` entry. Trivial. |
| H5 | Reorder columns | ✓ | ✓ | ✓ | PF: rename / re-index `.col` entries. |
| H6 | Vertical concat (append rows) | ✓ | ✓ | ≈ | PF: requires matching schemas; appends rows into existing column files (or new section if sectioned). |
| H7 | Split (by predicate / column value) | ✓ | ✓ | ≈ | PF result is N packs OR N tables inside one pack. Tooling choice. |
| H8 | Join (SQL-style) | ✓ | ✓ | ≈ | PF: same — materialize both sides, output a new table or pack. |
| H9 | Groupby + aggregate | ✓ | ✓ | ≈ | Output is a new table; same shape for both families. |
| H10 | Pivot / unpivot | ✓ | ✓ | ≈ | |
| H11 | Add data column (constant / expression) | ✓ | ✓ | ✓ | PF: new `.col` entry. Cheap if expression touches one column. |
| H12 | Drop data column | ✓ | ✓ | ✓ | PF: delete `.col` entry; rewrite `_header.excsv`. Cheap. |
| H13 | Rename column (everywhere) | ✓ | ✓ | ✓ | PF: rename `.col` files; update declaration. |

## I. Conversion (in / out of ExCSV)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| I1 | CSV / TSV → ExCSV | ✓ | ✓ | ≈ | PF: produces a single-table pack. |
| I2 | ExCSV → CSV / TSV (strip `#` lines) | ✓ | ✓ | ≈ | PF: per table; pack as a whole emits a TAR of CSVs or multiple files. |
| I3 | Change dialect / encoding / null marker | ✓ | ✓ | ✓ | PF: rewrites every column file. |
| I4 | Add `header=0` / `header=1` toggle | ✓ | ✓ | ≈ | PF has no in-data header row; toggle is moot. |
| I5 | JSON / JSONL ↔ ExCSV | ✓ | ✓ | ≈ | PF: per table. |
| I6 | XLSX ↔ ExCSV | ✓ | ✓ | ≈ | PF: multi-sheet XLSX maps naturally to multi-table pack. |
| I7 | Parquet ↔ ExCSV | ✓ | ✓ | ≈ | PF: per table; Parquet's row-group / column metadata aligns with section / `#%`. |
| I8 | Markdown / HTML output | ✓ | ✓ | ≈ | PF: per table. |
| I9 | Fixed-width output | ✓ | ✓ | ≈ | PF: per table. |
| I10 | SQL `CREATE TABLE` → ExCSV header (template) | ✓ | ✓ | ✓ | Parses `#$ddl` or ad-hoc input. |

## J. Container — row zip (`.excsv.zip`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| J1 | Wrap plain → zip | ✓ | ✓ | — | Computes `original-size=`, builds comment. |
| J2 | Unwrap zip → plain | — | ✓ | — | |
| J3 | Peek (read ZIP comment, no extraction) | — | ✓ | — | Fast metadata preview. |
| J4 | Refresh comment | — | ✓ | — | Rebuild summary after inner-file mutation. |
| J5 | Verify `original-size` matches central-directory size | — | ✓ | — | |
| J6 | Transparent open (zip handled like plain for read APIs) | — | ✓ | — | CLI flag `-` works on stdin even when zipped (buffered). |

## K. Container — pack (`.excsv.pack.zip`)

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| K1 | Create empty pack (manifest only) | — | — | ⊕ | Specify `mode=multi-table` (default) or `mode=single-table`. |
| K2 | List tables | — | — | ⊕ | From manifest; fallback to alphabetical subdir scan. |
| K3 | Add table from `.excsv` | — | — | ⊕ | Refuses in single-table mode if a table already exists. |
| K4 | Drop table | — | — | ⊕ | Rewrites manifest. |
| K5 | Extract table → standalone `.excsv` | — | — | ⊕ | Reverses K3. |
| K6 | Rename table | — | — | ⊕ | Rewrites manifest + subdir name. |
| K7 | Convert mode (`multi-table` ↔ `single-table`) | — | — | ⊕ | Validates current table count. |
| K8 | Read pack-level metadata (manifest `#@`) | — | — | ⊕ | |
| K9 | Add / list foreign-key declarations (`#fk`) | — | — | ⊕ | Informational only. |
| K10 | Manifest-only peek (no per-table reads) | — | — | ⊕ | Counterpart to J3. |
| K11 | Auto-discovery fallback when manifest missing/empty | — | — | ⊕ | Reader-side concession; tools warn. |
| K12 | Validate pack invariants (manifest ↔ on-disk layout) | — | — | ⊕ | |

## L. Container — pack column / section internals

These are pack-only by nature, and the main reason the pack exists.

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| L1 | Selective decompression — read one column without touching others | — | — | ⊕ | |
| L2 | Append column to existing table | — | — | ⊕ | Add `.col` entry + update `_header.excsv`. No data rewrite of other columns. |
| L3 | Append rows to existing table | — | — | ⊕ | Appends to each `.col` (or new section if sectioned). |
| L4 | Section-aware random access | — | — | ⊕ | Requires `section-size=` set on the table. |
| L5 | Per-column hash / integrity check | — | — | ↗ | Open question — `sha256=` attribute on `#column`. |
| L6 | Set / change section size on a table | — | — | ⊕ | Requires rewriting that table's column files. |

## M. Integrity & validation

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| M1 | Validate (full conformance check) | ✓ | ✓ | ✓ | Returns ERROR / WARN lists. |
| M2 | Compute / write `checksum=` | ✓ | ✓ | ↗ | PF: open question whether to use `checksum=` (global), per-column, or per-table hashes. |
| M3 | Verify `checksum=` | ✓ | ✓ | ↗ | |
| M4 | Verify `rows=` | ✓ | ✓ | ✓ | |
| M5 | Verify `#%` against recomputation | ✓ | ✓ | ✓ | |
| M6 | Freeze (one-shot finalize: infer + agg + checksum + sign + validate) | ✓ | ✓ | ✓ | PF: applied per table or pack-wide. |
| M7 | Diff (two documents, structured output) | ✓ | ✓ | ≈ | PF: per-table diff plus manifest diff. |
| M8 | Schema-only diff | ✓ | ✓ | ✓ | |

## N. Inspection & exploration

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| N1 | Compact human-friendly summary | ✓ | ✓ | ✓ | PF: lists tables, their sizes, FKs. |
| N2 | Per-column profile (counts, min/max, distribution, top-N) | ✓ | ✓ | ✓ | PF: cheaper. |
| N3 | Tabular preview (ASCII / Markdown / HTML) | ✓ | ✓ | ≈ | PF: per table. |
| N4 | Schema-only export | ✓ | ✓ | ✓ | PF: emits manifest + each table's header-only file. |
| N5 | Template generation (column list → empty file) | ✓ | — | ≈ | PF: empty pack with one or more empty tables. |
| N6 | FK graph visualisation | — | — | ⊕ | |

## O. Cleanup & repair

| # | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| O1 | Normalize line endings (LF) and BOM strip | ✓ | ✓ | ✓ | |
| O2 | Reorder header fields to canonical order | ✓ | ✓ | ✓ | |
| O3 | Dedupe duplicate `#column` / `#@` lines | ✓ | ✓ | ✓ | |
| O4 | Sort `#@` / `#%` / `#$` in canonical order | ✓ | ✓ | ✓ | |
| O5 | Re-quote header values where needed | ✓ | ✓ | ✓ | |
| O6 | Fix row-length anomalies (pad short / truncate long) | ✓ | ✓ | ≈ | PF: detects misaligned `.col` line counts. |
| O7 | Strip whitespace / NFC normalize / strip control chars | ✓ | ✓ | ✓ | Mode B. |
| O8 | One-shot tidy (repair + sort + format) | ✓ | ✓ | ✓ | |

## P. Cross-cutting / library concerns

Not user-visible features per se; they shape the implementation contracts.

| # | Concern | Applies to | Notes |
| --- | --- | --- | --- |
| P1 | Atomic in-place writes (temp + fsync + rename) | RF plain, RF zip, PF | Never leave a half-written file. |
| P2 | Pipeline-friendly I/O (stdin / stdout / `-`) | All | Zipped streams need a seekable temp buffer. |
| P3 | Machine-readable output (`--json` everywhere it makes sense) | All | Structured error / warning lists. |
| P4 | Locale-aware number / date parsing (opt-in) | All | Default: C locale. |
| P5 | Encoding fidelity (read non-UTF-8 sources) | All | Re-emit as UTF-8 by default. |
| P6 | Auto-sync of derived fields after Mode B writes | All | `rows=`, `checksum=`, `#%`, `#@exported`. |
| P7 | Forward-compatible parsing (unknown header keys / `#` lines ignored) | All | Required for reserved-name compatibility. |
| P8 | Reserved-name awareness | RF plain, RF zip | Recognise but don't act on `layout=`, `mode=`, `section-size=`, `#table`, `#fk`. |

---

## Roll-up by family

Counts of `✓` (native), `≈` (format-specific), `⊕` (pack-only) for quick triage:

- **RF plain**: native everything in A–I, M–O minus J/K/L. Largest feature surface.
- **RF zip**: everything RF plain does, plus J. Streaming and stdin behaviour slightly degraded.
- **PF**: everything RF plain does (per-table), plus K and L. Wins on column-selective reads, multi-table delivery, append-column / append-rows. Loses on awk-style pipelines and on operations that fundamentally need a row stream (sort, dedupe, join).

## What's intentionally NOT in this catalog

- **SQL execution.** Tools generate / filter / emit `#$ddl` statements; piping them to a real DB is the user's job (`excsv sql ddl postgres my.excsv | psql ...`). No embedded engine. (DuckDB-backed `excsv sql --query` is on the wishlist but tracked separately.)
- **Plugin protocol.** Out of scope here; will be its own document.
- **Encryption.** Not in v0.2.
- **Versioning / diff-as-history.** Deltas between two files belong in `excsv diff`; full version control belongs in git.
- **Server / daemon mode.** Out of scope.
- **In-process query engine over packs.** Future; depends on pack format being stable.

## Open questions surfaced by this catalog

1. **PF stdin behaviour.** Pack reads are random-access; how much of "pipeline-friendly" survives? Probably: PF accepts stdin by buffering to a temp file, with a warning. Streaming writes to stdout work only when the consumer can accept a complete ZIP at end-of-stream.
2. **PF integrity model.** `checksum=` semantics for packs are still open (M2/M3). Lean per-column `sha256=` attribute.
3. **Transform output format.** Should `excsv sort row.excsv` always emit row form, or can it auto-promote to PF if the input is PF? Default rule: **output family matches input family** unless the user passes a flag.
4. **Cross-family in-place edits.** Should `excsv column drop --in-place pack.zip orders/email` rewrite the whole archive, or only the affected entries? Lean: only affected entries, using a smart ZIP rewriter.
5. **Pack-level data ops semantics.** `excsv filter pack.zip --where ...` — which table(s)? Default: error, require explicit `table=` argument. Loop convenience comes later via `--all`.

6. **PF column naming scheme.** Current zip.md design uses human-friendly `<index>-<name>.col` filenames. This means rename / reorder (D3, D5) require a bounded ZIP rewrite (single-pass, no re-deflate, but touches every byte after the renamed entry). An alternative is opaque IDs (UUID or content-hash) per column, with the human name living only in `_header.excsv` — that promotes D3/D5 to true Mode A (one header-file edit, no ZIP shuffle) at the cost of killing the `unzip -p pack.zip orders/02-amount.col | head` demo. Lean: **keep human-friendly names** because rename/reorder are rare batch operations in real workflows. Revisit if rename-heavy use cases emerge (e.g. automated schema sync from a renaming database).

## Next steps

This catalog feeds the downstream plans:

- **`02-fixtures.md`** (next) — define the shared test-fixture corpus: every feature above gets at least one success and (where applicable) one failure fixture. Drives parity between Go and Python.
- **`03-golang.md`** — map each feature to packages / commands; sequence per the waves in `README.md`; tests walk the fixture corpus.
- **`04-python.md`** — mirror of the Go plan; parity tests run against the **same** fixture corpus.
- **`05-cookbook.md`** — 30–50 most common user workflows as terminal recipes; each cites the fixture it uses so readers can reproduce locally.
