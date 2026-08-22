# Step 2 — Test Fixtures

The shared corpus that drives every implementation's tests. Defined here once, consumed by [excsv-golang](https://github.com/boligolov/excsv-golang), the Python package (separate repo), and the cookbook (separate repo). Implementation-agnostic.

## Purpose

- **Parity check.** Go and Python parsers MUST agree on every fixture's outcome. Divergence = bug in one side or ambiguity in the spec — both are tracked.
- **Spec coverage.** Every normative MUST / SHOULD / MAY in `docs/` has at least one fixture exercising it.
- **Regression net.** Fixtures are stable artifacts. Once added, they're never deleted (only superseded). Renames happen via aliasing in the manifest, not by renaming files.
- **Cookbook source.** Recipes in the cookbook repo reference fixtures by ID so anyone reading the cookbook can re-run the example locally.

## Layout

```
fixtures/
├── plain/
│   ├── valid/
│   │   └── NNN_<slug>.excsv
│   └── invalid/
│       └── NNN_<slug>.excsv
├── zip/
│   ├── valid/
│   └── invalid/
├── pack/
│   ├── valid/
│   └── invalid/
├── generate/              ← scripts that build derived fixtures from plain ones
│   ├── make_zip.sh / .ps1
│   └── make_pack.sh / .ps1
└── fixtures.yaml          ← manifest: per-fixture expected outcome
```

Each implementation's test directory **MUST NOT** duplicate fixtures. Symlink, junction, submodule, or read directly from `fixtures/` in this repo. Both excsv-golang and the Python package point at the same tree.

## Naming

- `NNN_<slug>.excsv` (or `.excsv.zip`, `.excsv.pack.zip`).
- `NNN` is a zero-padded 3-digit serial **per directory**. Once assigned, never reused.
- `<slug>` is short snake_case, describes what the fixture exercises.
- Examples:
  - `plain/valid/001_minimal_header_only.excsv`
  - `plain/valid/NNN_sidecar_csv_sibling.excsv` + `NNN_sidecar_csv_sibling.csv` (pair)
  - `plain/invalid/004_bad_header_no_version.excsv`
  - `zip/valid/002_with_truncated_comment.excsv.zip`
  - `pack/valid/003_two_tables_with_fk.excsv.pack.zip`

If a fixture becomes obsolete: mark it `superseded_by: NNN` in the manifest, do NOT delete the file. Removing files breaks bisecting.

## Manifest (`fixtures.yaml`)

The manifest is the source of truth. Test runners walk it, not the directory.

```yaml
- id: plain/valid/001_minimal_header_only.excsv
  exercises: [A4, A6, B1]              # IDs from 01-features.md
  expect:
    parse: ok
    warnings: []
    header:
      version: "0.3"
    rows: 0
    columns: 0

- id: plain/invalid/004_bad_header_no_version.excsv
  exercises: [B5]
  expect:
    parse: fail
    error_kind: header_missing_version

- id: plain/valid/020_multi_dialect_sql.excsv
  exercises: [F1, F2, F3, F7]
  expect:
    parse: ok
    sql:
      ddl_count: 5
      dql_count: 2
      dialects: [ansi, mysql, postgres, clickhouse]

- id: zip/valid/002_with_truncated_comment.excsv.zip
  exercises: [J3, J5]
  derived_from: plain/valid/050_canonical_full.excsv
  expect:
    parse: ok
    comment:
      starts_with: "#!excsv version=0.3"
      ends_with: "#@comment-truncated: 1"
```

Fields:
- `id` — relative path inside `fixtures/`. Stable identifier.
- `exercises` — list of feature IDs from `01-features.md` (the A1, B2, F7… codes). Lets us spot uncovered features.
- `expect.parse` — `ok` | `fail`.
- `expect.warnings` — list of warning kinds; empty list = parser MUST NOT emit warnings.
- `expect.error_kind` — required when `parse: fail`. Symbolic name from a shared enum (see below).
- `expect.<spot-check>` — optional asserts that a parser MUST produce specific values. Light touch — these aren't full output comparisons, just enough to catch silent miscoding.
- `derived_from` — for zip/pack fixtures generated from a plain source, names the source.
- `data_sibling` — for sidecar pairs, path under `fixtures/` to the CSV/TSV data file (e.g. `plain/valid/037_sidecar_csv_sibling.csv`).
- `profile` (in `expect` or top-level) — how the runner opens the fixture: `stub` (header-only, no `reference=`), `sidecar` (metadata-only + `reference=`, load sibling if present). Missing `reference=` target is warn-only (`sidecar_reference_not_found`); there is no strict-fail profile.
- `expect.verify` — optional. `fail` means `excsv verify` MUST escalate (today only `rows_mismatch`). Omitted = same as parse.
- `expect.sql.apply_target` / `apply_warnings` — MatchKind warnings that fire when applying `#$` for a target dialect, not at parse time.
- `superseded_by` — if set, runners skip this fixture but keep it on disk for historical reference. Retired `NNN` slots are never reused.

A shared **error kind enum** lives in the manifest header and **MUST** match the canonical registry in `docs/implementation/error-handling.md`. WARN codes belong on `expect.warnings` of a `parse: ok` fixture (usually under `valid/`); FAIL codes belong on `expect.error_kind` of a `parse: fail` fixture.

## Source-controlled vs generated

- **Plain `.excsv`**: hand-written, committed as-is. Small, human-readable, the canonical corpus.
- **`.excsv.zip`**: generated by `generate/make_zip_fixtures.py` (`make_zip.ps1` / `.sh`). Do not hand-write these. Invalid cases (bad primary, encrypted flag, unsupported method, size mismatch) are still produced by the generator via byte patches.
- **`.excsv.pack.zip`**: generated by `generate/make_pack_fixtures.py` (`make_pack.ps1` / `.sh`). Do not hand-write these. Corruption tests are generator output, not committed-by-hand blobs.
- Generation scripts MUST be deterministic — same input → same byte output — so generated fixtures can be checked into git without churn. Use fixed timestamps (`#@created: 2026-01-01T00:00:00Z`) and a stable ZIP writer (no per-run randomness).

## Fixture inventory — abstract

What each category needs, organized by feature domain from `01-features.md`. Counts are minimums; add more as edge cases emerge.

### Plain — valid (001–066)

001–039: dialect/header/meta/column/agg/sql/csvw/checksum/sidecar happy path.

Warn-only cases live here (not under `invalid/`):

| ID | Coverage |
| --- | --- |
| 040 | `checksum_mismatch` |
| 041 | `#%` too few values (trailing columns unaggregated — no warn) |
| 042 | `#%` too many values → `agg_arity_mismatch` |
| 043 | `column_title_header_mismatch` |
| 044 | `column_name_header_mismatch` |
| 045 | `sql_unknown_verb` |
| 046 | `encoding_mismatch` (UTF-8 BOM vs declared Latin-1) |
| 047 | `rows_mismatch` (`verify: fail`) |
| 048 | `extsv_delim_mismatch` (`.extsv` + `delim=comma`) |
| 049 | `sidecar_reference_not_found` (parse ok, metadata-only handle) |
| 050 | `sidecar_checksum_mismatch` |
| 051 | `checksum_malformed` |
| 052 | `checksum_unknown_algorithm` |
| 053 | `pack_key_on_plain` |
| 054 | `default_with_nulls` |
| 055 | `column_count_mismatch` (`index=` past physical width) |
| 056 | `unknown_version` |
| 057 | `column_unknown_attribute` |
| 058 | `duplicate_column` |
| 059 | `agg_type_incompatible` |
| 060 | `sql_unknown_dialect` |
| 061 | versioned `#$ddl-postgres[-17|-18]`; `apply_warnings` family + version-mismatch |
| 062 | `sql_no_match` on apply |
| 063 | `original_size_on_plain` |
| 064 | `encoding_unsupported` |
| 065 | `encoding_not_ascii_compatible` |
| 066 | custom `#@` keys |

Still out: `##` round-trip preservation (if a writer opts in); on-demand 100k-row streaming file; computed-column fixtures (spec §5, not yet in implementation docs).

### Plain — invalid (FAIL only)

Retired slots (never reuse): 007, 009, 010, 017, 022, 025, 026, 029, 031, 032 — those are now valid/warn.

| ID | `error_kind` |
| --- | --- |
| 001–004, 018–021 | header FAIL |
| 005, 006, 008 | `#column` FAIL |
| 011, 012 | `#$` FAIL |
| 013–016, 023 | data-section FAIL |
| 019 | `rows=abc` → `header_invalid_value` (not `rows_mismatch`) |
| 024 | `invalid_utf8` |
| 027, 028, 030, 033 | sidecar FAIL (`033` = `sidecar_reference_escapes_dir`) |

### Zip — valid (001–013, generated)

001–010 as before (primary match, `data.excsv`, aux, comment full/truncated, store, bzip2, BOM inner, header=0, zip64).

011–013: comment advisory defects (`zip_comment_not_excsv_prefix`, `zip_comment_not_utf8`, `zip_comment_header_disagree`) — inner file still parses.

### Zip — invalid (generated)

Retired slots 005, 006 (comment defects moved to valid/).

| ID | `error_kind` |
| --- | --- |
| 001 | `zip_missing_original_size` |
| 002 | `zip_original_size_mismatch` |
| 003 | `zip_primary_not_first` |
| 004 | `zip_primary_bad_name` |
| 007 | `zip_unsupported_compression` |
| 008 | `zip_primary_not_first` (no `.excsv`/`.extsv` entry) |
| 009 | `zip_encrypted` |

`row_parser_got_pack` is dispatch, not a zip-file fixture: any `pack/*.excsv.pack.zip` opened with the row parser MUST fail that code.

### Pack — valid (001–011, generated)

| ID | Coverage |
| --- | --- |
| 001 | single-table unsectioned (`single-table=`) |
| 002 | empty pack |
| 003 | two tables, no FKs |
| 004 | two tables + `#fk` |
| 005 | pack-level `#@` provenance |
| 006 | tables with different `#$ddl` dialects |
| 007 | sectioned table |
| 008 | mixed sectioned + unsectioned |
| 009 | auto-discovery: manifest with zero `#table` lines |
| 010 | auto-discovery: no manifest |
| 011 | stale `single-table=` on a two-table pack — ignore, not fatal |

No `mode=`. No per-table `primary=`.

### Pack — invalid (generated)

| ID | `error_kind` |
| --- | --- |
| 001 | `pack_manifest_missing_layout` |
| 002 | `pack_table_dir_missing` |
| 003 | `pack_table_header_missing` |
| 004 | `pack_column_count_mismatch` |
| 005 | `pack_col_line_count_mismatch` |
| 006 | `pack_section_partition_error` |
| 007 | `pack_section_boundary_mismatch` |

Dropped targets: missing `mode=`; two `#table primary=1`; `single-table=` + two tables as FAIL (that's valid/011).

## Sequencing

Fixtures land **in lockstep with format readiness** from `plan/README.md`:

| Wave | Fixtures unlocked |
| --- | --- |
| 1 (plain) | `plain/valid/` and `plain/invalid/` |
| 2 (zip)   | `zip/valid/` and `zip/invalid/` |
| 3 (pack unsectioned, single-table mode) | `pack/valid/` single-table fixtures and `pack/invalid/` for the pack-level invariants that apply |
| 4 (pack multi-table) | remaining `pack/valid/` multi-table fixtures |
| 5 (pack sectioned) | sectioning fixtures (valid + invalid) |

For each wave: **fixtures land before code**. The implementation tracks then pull from a fixed, frozen corpus. Fixture authoring is its own deliverable, reviewed before any Go / Python code that consumes it.

## Rules

- **Fixtures are spec, not test data.** A fixture's expected behaviour is normative. If Go and Python disagree on a fixture, the spec is the tiebreaker — and if the spec doesn't pin the answer, the spec is updated *and* the fixture's manifest entry is updated.
- **Negative fixtures must specify `error_kind`**. Vague "parse failed" assertions are forbidden — they hide regressions where the parser fails for the wrong reason.
- **Smallest viable size.** Every fixture is the minimum file that exercises its feature. Don't ship a 10k-row CSV when 3 rows make the point.
- **One concern per fixture.** A fixture exercising `delim=tab` should not also exercise `sql-dialect=postgres`. Split into two.
- **Deterministic generation.** Derived fixtures (zip / pack) MUST byte-identically reproduce from their plain source. CI should re-run generators and assert no diff.
- **No secrets, no PII.** Fixtures live in version control forever.

## Open questions

1. **Manifest format.** YAML chosen for readability; JSON or TOML are alternatives. Go and Python both have first-class support for all three. **Lean: YAML** for human edit-ability; CI will validate it against a schema.
2. **Schema for the manifest itself.** Should there be a `fixtures.schema.json` that validates `fixtures.yaml`? Yes, but defer authoring until the manifest stabilizes around wave 1.
3. **Per-fixture expected canonical output.** Some fixtures might benefit from a sibling file (`001_minimal.excsv.canonical`) that's the byte-exact output of re-serializing through the canonical writer. Catches writer regressions. Add as wave 1 reveals which fixtures need it.
4. **Big-file fixtures.** Do we ship one or two `>10MB` fixtures for streaming/perf tests, or generate them on-demand in CI? **Lean: generate on-demand** to keep the repo small; commit only their generator scripts and the manifest entry.
5. **Cross-locale fixtures.** Number / date parsing with non-C locales. Defer until locale handling is implemented (probably wave 2 or later).

## Next

This corpus is the input to implementation repos:
- **excsv-golang** — test runner walks `fixtures.yaml`, drives `pkg/excsv` against every fixture, compares actual vs expected.
- **Python** — same corpus, idiomatic test harness.
- **Cookbook** — recipes cite fixtures by ID, so readers can copy-paste.
