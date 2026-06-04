# Error Handling

Implementations **MUST** fail on:

- Malformed `#!excsv` header line (if present)
- Malformed `key=value` pairs in the header
- Column count mismatch in aggregation rows
- Sidecar (`reference=` set) containing any data row
- Strict sidecar parse where the referenced file does not exist
- Zipped file with missing `original-size` header field
- Zipped file where inner uncompressed size does not match header `original-size`
- Zipped file where comment is not a valid ExCSV prefix
- `#$` line missing the `:` separator
- `#$` line whose payload contains an embedded newline

Implementations **SHOULD** warn on:

- Unknown attributes in column definitions
- Aggregation types incompatible with column types
- Unknown SQL dialect token
- `#$` verb other than `ddl` or `dql`
- ZIP comment disagrees with inner file's `#!excsv` header (other than truncation marker)
- No `#$` line matches the consumer's target dialect
- `.extsv` file with `delim` other than `tab`
- Checksum mismatch when validating a sidecar pair
