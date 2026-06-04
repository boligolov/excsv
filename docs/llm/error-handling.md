# Error Handling

```
MUST fail:
  - malformed #!excsv header line (if present)
  - malformed key=value in header
  - column count mismatch in aggregation rows
  - sidecar (`reference=` set) with any data row (sidecar_has_data_section)
  - strict sidecar parse where referenced file does not exist (sidecar_reference_not_found)
  - zipped file with missing `original-size` header field
  - zipped file where inner uncompressed size does not match header `original-size`
  - zipped file where comment is not a valid ExCSV prefix (does not start with #!excsv)
  - #$ line missing the `:` separator
  - #$ line whose payload contains an embedded newline

SHOULD warn:
  - unknown column attributes
  - aggregation type incompatible with column type
  - unknown SQL dialect token
  - #$ verb other than `ddl` or `dql`
  - zip comment disagrees with inner file's #!excsv header (other than truncation marker)
  - no #$ line matches the consumer's target dialect (no DDL/DQL available)
  - family/version mismatch when matching an unversioned line to a versioned target dialect (or vice versa)
  - .extsv file with delim other than tab (sidecar_delim_ext_mismatch)
  - checksum mismatch when validating a sidecar pair (sidecar_checksum_mismatch)
```
