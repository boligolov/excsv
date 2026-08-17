# Error Handling — Canonical Code Registry

The **single normative source** for ExCSV error/warning codes. The `error_kind` enum in `fixtures/fixtures.yaml` and the compact list in [`docs/llm/error-handling.md`](llm/error-handling.md) MUST match the codes here.

**Severity**

- **FAIL** — a conforming reader **MUST** reject the file.
- **WARN** — a conforming reader **MUST NOT** fail; it **SHOULD** surface the code and continue. Only **structural mutations** may be refused (see `column_count_mismatch`).

**Verify column** — behaviour under `excsv verify`:

- `—` — WARN stays WARN, FAIL stays FAIL.
- `→FAIL` — the WARN escalates to a hard failure.
- `never` — stays a WARN even under `excsv verify`.

## Header

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `header_malformed_magic` | FAIL | — | `#!excsv` line present but malformed. |
| `header_missing_version` | FAIL | — | Header present without `version=`. |
| `header_malformed_kv` | FAIL | — | Malformed `key=value` token in the header. |
| `header_unclosed_quote` | FAIL | — | Unterminated quoted value in the header. |
| `header_invalid_value` | FAIL | — | Value invalid for its field (e.g. `header=2`). |
| `unknown_version` | WARN | — | `version=` present but not implemented by this parser; read best-effort. |

## Columns

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `column_missing_name` | FAIL | — | `header=1` but a `#column` lacks `name=`. |
| `column_missing_index` | FAIL | — | `header=0` but a `#column` lacks `index=`. |
| `column_malformed_attribute` | FAIL | — | Malformed `#column` attribute. |
| `column_unknown_attribute` | WARN | — | Unrecognized `#column` attribute; preserved/ignored. |
| `column_name_header_mismatch` | WARN | — | Header-row name disagrees with `#column name=`. |
| `column_title_header_mismatch` | WARN | — | `title=` disagrees with the header-row name. |
| `duplicate_column` | WARN | — | Two `#column` for the same column; last-wins. |
| `column_count_mismatch` | WARN | never | Schema contradicts data by count/position: `index=` ≥ physical width, or more positioned stored/materialized columns than physical width. Read proceeds; **structural mutations MUST refuse** until reconciled. |
| `default_with_nulls` | WARN | never | Column has `default=` but its data contains nulls; the DDL default would eliminate them (describe/schema drift until rewritten). |

## Data section

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `data_row_arity_mismatch` | FAIL | — | A data row's field count differs from the physical column width (fields cannot be mapped to columns). |
| `quote_none_delimiter_in_value` | FAIL | — | `quote=none` but a value contains the delimiter (unescapable). |
| `first_field_hash_unquoted` | FAIL | — | A data row's first field starts with `#` unquoted (ambiguous with meta lines). |
| `quoted_value_raw_newline` | FAIL | — | A quoted value contains a raw newline; ExCSV data rows are single-line. |

## Aggregations

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `agg_arity_mismatch` | WARN | never | `#%` value count exceeds physical column width; fewer values is fine (trailing columns unaggregated). |
| `agg_type_incompatible` | WARN | — | Aggregation type incompatible with the column type. |

## SQL companions (`#$`)

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `sql_missing_colon` | FAIL | — | `#$` line missing the `:` separator. |
| `sql_embedded_newline` | FAIL | — | `#$` payload contains an embedded newline. |
| `sql_unknown_verb` | WARN | — | `#$` verb other than `ddl`/`dql`; preserved. |
| `sql_unknown_dialect` | WARN | — | Unrecognized dialect token; preserved as-is. |
| `sql_dialect_family` | WARN | — | MatchKind `family` (generic ↔ versioned dialect). |
| `sql_version_mismatch` | WARN | — | MatchKind `version-mismatch`; `--strict` skips the line instead. |
| `sql_no_match` | WARN | — | No `#$` line matches the consumer's target dialect. |

## Encoding

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `invalid_utf8` | FAIL | — | Bytes not decodable under the effective encoding. |
| `encoding_mismatch` | WARN | — | Declared encoding disagrees with detected (e.g. BOM). |
| `encoding_not_ascii_compatible` | WARN | — | Declared encoding is not ASCII-compatible (e.g. UTF-16/UTF-32). |
| `encoding_unsupported` | WARN | — | Unknown but ASCII-compatible encoding name; fall back to UTF-8. |

## Checksum (all advisory)

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `checksum_mismatch` | WARN | never | Inline / in-ZIP data-section digest differs. |
| `sidecar_checksum_mismatch` | WARN | never | Sidecar-pair digest differs. |
| `checksum_unknown_algorithm` | WARN | never | Unknown/unsupported algorithm; skip verification. |
| `checksum_malformed` | WARN | never | Malformed digest (wrong length / non-hex / uppercase); skip verification. |

## Sidecar

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `sidecar_has_data_section` | FAIL | — | `reference=` set but the file has data rows. |
| `reference_on_inline` | FAIL | — | `reference=` set on a file that carries data rows. |
| `sidecar_reference_escapes_dir` | FAIL | — | `reference=` is absolute, contains `..`, or resolves outside the sidecar's directory. |
| `sidecar_missing_reference` | FAIL | — | A meta-only file expected as a sidecar has no `reference=`. |
| `sidecar_reference_not_found` | WARN | never | Referenced file missing on open/load; parse succeeds, handle degrades to read-only/metadata-only. |
| `extsv_delim_mismatch` | WARN | — | `.extsv` file (inline or sidecar) declares `delim` other than `tab`. |

## ZIP container (row form)

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `zip_primary_not_first` | FAIL | — | First central-directory entry is not a valid primary (wrong name or not `.excsv`/`.extsv`). Readers **MUST NOT** scan forward. |
| `zip_primary_missing` | FAIL | — | No `.excsv`/`.extsv` entry in the archive. |
| `zip_missing_original_size` | FAIL | — | Inner header lacks `original-size=`. |
| `zip_original_size_mismatch` | FAIL | — | Inner uncompressed size ≠ header `original-size=`. |
| `zip_unsupported_compression` | FAIL | — | Primary entry uses a rejected compression method. |
| `zip_encrypted` | FAIL | — | Archive is encrypted; password required before read (operational, not a data defect). |
| `zip_comment_not_excsv_prefix` | WARN | — | ZIP comment does not begin with `#!excsv`. |
| `zip_comment_not_utf8` | WARN | — | ZIP comment is not valid UTF-8. |
| `zip_comment_header_disagree` | WARN | — | ZIP comment disagrees with the inner `#!excsv` header (other than the truncation marker). |
| `row_parser_got_pack` | FAIL | — | A pack container was routed to the row/plain parser. |
| `pack_key_on_plain` | WARN | — | Pack-only key (`layout=`, `section-size=`, `table-count=`, `single-table=`, `#table`, `#fk`) on a plain / row-ZIP file; ignored. |
| `original_size_on_plain` | WARN | — | `original-size=` on a plain (non-ZIP, non-pack) file; ignored. |
| `rows_mismatch` | WARN | →FAIL | `rows=` disagrees with the actual data-row count. The one WARN that `excsv verify` escalates. |

## Pack container

| Code | Severity | Verify | Meaning |
| --- | --- | --- | --- |
| `pack_manifest_missing_layout` | FAIL | — | `_manifest.excsv` lacks `layout=pack`. |
| `pack_table_dir_missing` | FAIL | — | A `#table dir=` points to a missing directory. |
| `pack_table_header_missing` | FAIL | — | A table directory lacks `_header.excsv`. |
| `pack_column_count_mismatch` | FAIL | — | `columns=` ≠ the number of `.col` entries (non-virtual). |
| `pack_col_line_count_mismatch` | FAIL | — | A `.col` line count ≠ `rows`. |
| `pack_section_partition_error` | FAIL | — | Section partitioning is inconsistent with `section-size=`. |
| `pack_section_boundary_mismatch` | FAIL | — | Section boundaries do not line up across columns. |
