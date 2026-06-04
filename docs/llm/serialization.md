# Serialization Algorithm (pseudocode)

```
1. Write "#!excsv" + header fields in canonical order: version, delim, quote, header, encoding, null, rows, checksum, schema, csvw, sql-dialect, reference, original-size. Omit fields with default values. Omit `original-size` for plain (non-zipped) files. Omit `reference` on inline files. Quote values containing spaces.
2. Write file-level metadata as "#@key: value" lines (one per unique key).
3. Write "#column name=X type=Y ..." for each column in order.
4. Write "#$<verb>[-<dialect>]: <statement>" lines preserving the file's original insertion order. Multiple entries with the same key are allowed and MUST be emitted in order.
5. If csvw payload: write "#csvw <json>".
6. Write "#%<name>: v1,v2,...,vN" for each aggregation. Use file delimiter. Empty string for non-applicable.
7. If header=1: write column names as first data row, delimited.
8. Write data rows, delimited and quoted per CSV rules.
9. (Zipped output only) After steps 1–8 produce the inner bytes:
   a. Compute byte length → set `original-size`. Re-emit the header line with this field included; if adding the field changed the byte count, recompute and re-patch (two passes converge).
   b. Create ZIP archive with the inner file as primary entry.
   c. Build the end-of-central-directory comment per ZIP CONTAINER priority list, staying under 65535 bytes. Append `#@comment-truncated: 1` as a final line if anything was omitted.
```
