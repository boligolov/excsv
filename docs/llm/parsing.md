# Parsing Algorithm (pseudocode)

```
0. If file is a ZIP container (magic bytes "PK\x03\x04" or .excsv.zip extension):
   a. Locate primary entry per ZIP CONTAINER rules.
   b. Extract bytes.
   c. Continue parsing the extracted bytes as a normal ExCSV file from step 1.
   d. After step 10, verify ZIP central dir uncompressed_size == header `original-size`. Mismatch is a MUST-fail error.
1. Read line 1. If starts with "#!excsv": parse space-separated key=value pairs (split on first "="), store as header_fields. If line 1 does NOT start with "#!excsv": use defaults (delim=comma, quote=double, header=1, encoding=UTF-8), rewind line 1 for meta/data parsing.
2. Resolve delimiter: lookup delim in {comma:",", tab:"\t", pipe:"|", semicolon:";"}. If no match, use literal value. If delim absent, default comma.
3. Read subsequent lines while line starts with "#":
   a. "#column " -> parse key=value pairs, store as column definition (ordered list)
   b. "#%" -> extract name after "#%" and before ":", split remainder by delimiter, store as aggregation[name] = values[]
   c. "#csvw " -> store remainder as csvw_payload
   d. "#$" -> extract key (between "#$" and ":"), value (after ": "). Key is `<verb>[-<dialect>[-<version>]]` where verb ∈ {ddl, dql}. APPEND to an ordered list of SQL entries (preserve file order). Verbs other than ddl/dql MUST be preserved but MAY produce a warning.
   e. "#@" -> extract key (between "#@" and ":"), value (after ": "), store as metadata[key] = value (last-wins on duplicates).
   f. "##" -> human comment, ignore (or attach to round-trip buffer if preservation mode is on).
   g. Other "#" lines -> ignore
4. First non-"#" line begins data section. If EOF before any non-# line:
   a. If reference= present → sidecar profile; data is external (stop; optional pair load).
   b. Else → header-only stub (rows=0).
5. If reference= present and any data row was parsed → MUST fail (sidecar_has_data_section).
6. If header=1: first data line is column names. Validate against #column name attributes if present.
7. Parse remaining lines as CSV using resolved delimiter and quote character (inline data, or referenced file when sidecar pair is loaded).
8. If checksum present: normalize data section newlines to LF, compute digest, compare (on inline bytes or referenced file per sidecar rules).
9. If aggregations present: validate value count equals column count.
10. If file was zipped (step 0): verify `original-size` header field equals the ZIP central directory uncompressed size for the primary entry.
```
