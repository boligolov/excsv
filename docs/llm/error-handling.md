# Error Handling

Canonical registry (code · severity · verify-override · meaning) lives in [error-handling.md](../error-handling.md); this is the compact index. `fixtures.yaml` `error_kind` enum MUST match those codes.

```
MUST fail:
  - malformed #!excsv header line (if present)
  - malformed key=value in header
  - sidecar (`reference=` set) with any data row (sidecar_has_data_section)
  - reference= is absolute, contains `..`, or resolves outside the sidecar's directory (sidecar_reference_escapes_dir)
  - row-ZIP whose first central-directory entry is not a valid primary (wrong name or not .excsv/.extsv); MUST NOT scan forward (zip_primary_not_first)
  - zipped file with missing `original-size` header field
  - zipped file where inner uncompressed size does not match header `original-size`
  - #$ line missing the `:` separator
  - #$ line whose payload contains an embedded newline
  - pack routed to the row/plain parser (e.g. `layout=pack` but not a pack container; row_parser_got_pack)

SHOULD warn:
  - declared version= not implemented by this parser (older/newer, minor/major); read best-effort, never fail (unknown_version)
  - pack-only key on a plain / row-ZIP file (`layout=`, `section-size=`, `table-count=`, `single-table=`, `#table`, `#fk`); ignored (pack_key_on_plain)
  - sidecar referenced file does not exist on open/load; parse still succeeds, handle degrades to read-only/metadata-only, data ops unavailable (sidecar_reference_not_found); NEVER fatal, including under `excsv verify`
  - unknown column attribute; preserved/ignored (column_unknown_attribute)
  - header-row name disagrees with #column name= (column_name_header_mismatch)
  - aggregation `#%` value count exceeds the physical column count (agg_arity_mismatch); fewer values is fine (trailing columns unaggregated); advisory, never fatal
  - schema contradicts data by count/position: an `index=` ≥ physical width, or more positioned stored/materialized columns than physical width (column_count_mismatch); read proceeds, but structural mutations MUST refuse until reconciled; never fatal. (Name disagreement between the header row and `#column name=` is a separate warn, column_name_header_mismatch.)
  - column has default= but its data contains nulls (empty or `null`-marked); DDL default would eliminate them → describe/schema mismatch until data rewritten (default_with_nulls); advisory, never fatal
  - duplicate #column for same column; last-wins (duplicate_column)
  - duplicate #csvw line; last-wins (duplicate_csvw)
  - rows= disagrees with actual data row count (rows_mismatch; excsv verify: fail)
  - original-size= present on a plain (non-ZIP, non-pack) file; ignored (original_size_on_plain)
  - aggregation type incompatible with column type (agg_type_incompatible)
  - unknown SQL dialect token; preserved as-is (sql_unknown_dialect)
  - #$ verb other than `ddl` or `dql` (sql_unknown_verb)
  - ZIP comment not a valid ExCSV prefix (does not start with #!excsv; zip_comment_not_excsv_prefix)
  - ZIP comment not valid UTF-8 (zip_comment_not_utf8)
  - ZIP comment disagrees with inner file's #!excsv header, other than truncation marker (zip_comment_header_disagree)
  - no #$ line matches the consumer's target dialect (sql_no_match)
  - SQL MatchKind `family` (generic line against versioned target, or versioned line against generic target) (sql_dialect_family)
  - SQL MatchKind `version-mismatch` (same dialect family, different version strings) (sql_version_mismatch)
  - .extsv file (inline or sidecar) with delim other than tab (extsv_delim_mismatch)
  - checksum mismatch, inline or in-ZIP (checksum_mismatch); NEVER fatal, including under `excsv verify` — checksum is advisory (unlike rows=, which verify fails)
  - checksum mismatch when validating a sidecar pair (sidecar_checksum_mismatch); same warn-only rule
  - unknown/unsupported checksum algorithm; skip verification (checksum_unknown_algorithm)
  - malformed checksum digest (wrong length / non-hex / uppercase); skip verification (checksum_malformed)
  - declared encoding is not ASCII-compatible, e.g. UTF-16/UTF-32 (encoding_not_ascii_compatible)
  - unknown/unsupported but ASCII-compatible encoding name; fall back to UTF-8 (encoding_unsupported)
```
