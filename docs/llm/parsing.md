# Parsing Algorithm (pseudocode)

```
0. Dispatch by container (magic bytes "PK\x03\x04" or .zip extension → ZIP; else plain text):
   a. ZIP whose first entry is `_manifest.excsv` with `layout=pack` (or extension .excsv.pack.zip / .extsv.pack.zip) → PACK. Parse per pack.md and stop this algorithm. A pack routed here in error (row parser handed a pack, e.g. `layout=pack` seen but structure is not a pack) → MUST-fail row_parser_got_pack.
   b. Other ZIP → ROW-ZIP. Locate primary entry per ZIP CONTAINER rules, extract bytes, continue from step 1. After step 10, verify ZIP central dir uncompressed_size == header `original-size`. Mismatch is a MUST-fail error.
   c. Plain text → continue from step 1.
1. Read line 1. If starts with "#!excsv": parse space-separated key=value pairs (split on first "="), store as header_fields. If version= is not the implemented version (older/newer) → warn unknown_version, continue best-effort (never fail on version). If line 1 does NOT start with "#!excsv": use defaults (delim=comma, quote=none, header=1, encoding=UTF-8), rewind line 1 for meta/data parsing. Pack-only header keys (`layout=`, `section-size=`, `table-count=`, `single-table=`) on a plain / row-ZIP file → warn pack_key_on_plain and ignore.
2. Resolve delimiter: lookup delim in {comma:",", tab:"\t", pipe:"|", semicolon:";"}. If no match, use literal value. If delim absent, default comma.
3. Read subsequent lines while line starts with "#":
   a. "#column " -> parse key=value pairs, store as column definition (ordered list). On duplicate (same name, or same index when header=0): warn duplicate_column, last-wins (replace prior definition, preserve original position).
   b. "#%" -> extract name after "#%" and before ":"; take remainder after ":", strip one leading space if present, parse as one CSV row using the resolved dialect (delimiter, quote, escapes), store as aggregation[name] = values[]
   c. "#csvw" -> take remainder after ":", strip one leading space if present, store as csvw_payload. On duplicate: warn duplicate_csvw, last-wins.
   d. "#$" -> extract key (between "#$" and ":"); value = remainder after ":", strip one leading space if present. Key is `<verb>[-<dialect-suffix>]` where verb ∈ {ddl, dql}. Parse dialect-suffix into (dialect, version) per sql.md. APPEND to an ordered list of SQL entries (preserve file order). Verbs other than ddl/dql MUST be preserved but MAY produce a warning.
   e. "#@" -> extract key (between "#@" and ":"); value = remainder after ":", strip one leading space if present, store as metadata[key] = value (last-wins on duplicates).
   f. "##" -> human comment, ignore (or attach to round-trip buffer if preservation mode is on).
   g. Other "#" lines -> ignore. Pack-only meta (`#table`, `#fk`) on a plain / row-ZIP file -> warn pack_key_on_plain, ignore.
4. First non-"#" line begins data section. If EOF before any non-# line:
   a. If reference= present → sidecar profile; data is external (stop; optional pair load).
   b. Else → header-only stub (rows=0).
5. If reference= present and any data row was parsed → MUST fail (sidecar_has_data_section).
6. If header=1: first data line is column names. Validate against #column name attributes if present.
7. Parse remaining lines as CSV using resolved delimiter and quote character (inline data, or referenced file when sidecar pair is loaded). Decode data-section bytes using resolved `encoding=` (header and meta lines are always ASCII; see encoding.md). A declared non-ASCII-compatible encoding (e.g. UTF-16) → warn encoding_not_ascii_compatible.
8. If checksum present: over the raw data-section bytes, normalize CRLF (0x0D 0x0A) to LF (0x0A) at the byte level, compute digest, compare (on inline bytes or referenced file per sidecar rules). Unknown/unsupported algorithm or malformed digest → warn (checksum_unknown_algorithm / checksum_malformed) + skip. Any mismatch → warn checksum_mismatch (sidecar pair: sidecar_checksum_mismatch); NEVER fatal, in any mode including `excsv verify`. See checksum.md.
8b. Column counts — two metrics (the format is descriptive, so the schema MAY lag the data):
   - PHYSICAL columns = field count of the first present row (the header row if header=1, else the first data row). Counts stored + materialized (`materialized=1`) columns; EXCLUDES virtual (`formula=` without `materialized=1`) columns. If no row is available (sidecar not loaded per C4, header-only stub, or header=0 with no data) → PHYSICAL is UNKNOWN: defer all arity checks (step 9 and index-bound checks) and read the file as-is (no error).
   - DECLARED columns = number of `#column` lines (stored + materialized + virtual).
   - Consistent file: DECLARED = PHYSICAL + (virtual count), and every stored/materialized column's `index=` is in [0, PHYSICAL). Fewer `#column` lines than PHYSICAL (unannotated trailing columns) is normal — NOT a mismatch.
   - CONTRADICTION (an `index=` ≥ PHYSICAL; more positioned stored/materialized columns than PHYSICAL; header-row names disagree with `#column name=`) → warn column_count_mismatch. NEVER fatal.
   - Drift guard (write side): while a contradiction stands, structural mutations (drop/rename/reorder a column, materialize/dematerialize, edit-through) MUST refuse — reconcile data and schema first. Read/parse always proceeds.
9. If aggregations present and PHYSICAL is known: `#%` value count SHOULD equal PHYSICAL. Fewer values → trailing columns simply carry no aggregate (ok); more values → warn agg_arity_mismatch. Never fatal. If PHYSICAL is unknown → defer.
9b. If rows= present: compare to actual data row count. Mismatch → warn rows_mismatch (excsv verify: fail). For sidecars, only checkable when the referenced file is loaded. If original-size= present on a plain file → warn original_size_on_plain and ignore it.
10. If file was zipped (step 0): verify `original-size` header field equals the ZIP central directory uncompressed size for the primary entry.
```
