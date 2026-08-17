# ZIP Container

An ExCSV document MAY be shipped inside a standard ZIP archive with the extension `.excsv.zip` or `.extsv.zip`. This is a **container format**, not a new dialect — the inner file is a valid ExCSV document (`.excsv` or `.extsv`) with the same structure as any other.

## File naming

The archive MUST contain at least one entry whose name ends in `.excsv` or `.extsv`. This is the **primary** file. The primary file MUST be:

- The **first** entry in the central directory, AND
- Named either:
  - The archive's base name with `.zip` stripped (e.g. `sales.excsv.zip` → `sales.excsv`, `sales.extsv.zip` → `sales.extsv`), OR
  - `data.excsv` / `data.extsv` if no such match.

Additional entries (auxiliary data, schemas, attachments) MAY appear after the primary file. Readers MUST locate the primary by the rule above and ignore other entries unless they understand them.

Readers MUST NOT scan forward to find a matching entry: if the FIRST central-directory entry is not a valid primary (wrong name, or not ending in `.excsv`/`.extsv`), the archive MUST fail `zip_primary_not_first`, even if a later entry would match. Determinism > repairability — the primary is the first entry or nothing.

## Compression

The primary entry SHOULD use Deflate (method 8). Store (method 0), Deflate64 (method 9), BZIP2 (method 12), LZMA (method 14), and Zstandard (method 93) MAY be used. Other methods SHOULD be rejected.

ZIP64 extensions MUST be supported by parsers (large files exceeding 4 GiB).

## Password protection

Archive MAY use standard ZIP encryption (PKZIP traditional or AES — writer chooses). Password supplied by tooling at write/read; NOT stored in `#!excsv`, `#@`, or ZIP comment.

- Reader MUST have password before extract/parse inner file.
- Comment fast-path MAY be unavailable until archive unlocked.
- Inner `checksum=` / `original-size=` refer to decrypted payload.

## Required inner header field

The inner `.excsv` or `.extsv` file's `#!excsv` header MUST include:

```
original-size=<bytes>   uncompressed byte size of the entire inner .excsv/.extsv file (decimal integer)
```

Row-ZIP only — not the pack-manifest meaning (see [header.md](header.md#original-size-scopes)). This value MUST match the `uncompressed_size` field recorded in the ZIP central directory entry for the primary file. A mismatch MUST be reported as a validation error.

For semantic content integrity use the `checksum=` header field (see [checksum.md](checksum.md)). It covers the data section and survives re-compression or re-archiving. `checksum=` SHOULD be set for zipped files when semantic integrity matters.

## ZIP comment (summary section)

The ZIP **end-of-central-directory comment** field (max 65535 bytes per ZIP spec) MUST carry a textual summary of the inner ExCSV file, so consumers can read metadata WITHOUT extracting the archive.

The comment MUST be UTF-8 encoded. It MUST be a valid prefix of an ExCSV file — i.e. it MUST begin with `#!excsv ...` and consist solely of header + `#` lines.

### Required content (in this order, MUST fit)

1. `#!excsv` header line — MUST be present, MUST include `original-size=` exactly matching the inner file's header line.

### Recommended content (in priority order, SHOULD fit until budget exhausted)

2. `#@source`, `#@author`, `#@created`, `#@exported`, `#@license`, `#@tool` (concise provenance)
3. All `#column` lines (column schema — essential for schema-aware consumers)
4. All `#$ddl` and `#$ddl-<dialect>` lines (schema-as-SQL, for DB import without extraction). Preserve file order.
5. All `#%` aggregation lines (summary statistics)
6. `#@comment`, `#@tags` (descriptive metadata)
7. Remaining `#@` entries (any custom keys)
8. All `#$dql` and `#$dql-<dialect>` lines (provenance queries)
9. `#csvw` payload (last — usually the largest)

Writers MUST add lines in priority order, stopping when the next line would exceed the 65535-byte budget. The comment MUST end at a complete line boundary.

If any content was omitted, the writer MUST append a final marker line:

```
#@comment-truncated: 1
```

This is the LAST line in the comment when truncation occurred. Its presence signals "the comment is a partial summary; extract the inner file to see everything."

### Comment validation

Readers MUST treat the comment as advisory:

- The comment is for fast preview / indexing without extraction. The authoritative source is always the inner `.excsv` file.
- Invalid comment (not UTF-8, or not a valid ExCSV prefix) MUST NOT block extraction or parsing of the inner file. Implementations SHOULD warn (`zip_comment_not_utf8`, `zip_comment_not_excsv_prefix`).
- If the comment's `#!excsv` line disagrees with the inner file's `#!excsv` line (other than truncation), the inner file wins. Implementations SHOULD warn.

## Reading a `.excsv.zip` (algorithm)

```
1. Open archive. Read central directory.
2. Locate primary entry by naming rule (first entry ending in .excsv/.extsv, name matches archive base or is "data.excsv" / "data.extsv").
3. (Optional fast path) Read end-of-central-directory comment. Parse as ExCSV prefix. Use for metadata-only queries.
4. (Full read) Extract primary entry into memory or stream.
5. Parse extracted content as ExCSV (see parsing.md).
6. Validate: inner #!excsv `original-size` MUST equal ZIP central dir uncompressed size.
```

## Verification (`excsv verify`)

`excsv verify ARCHIVE.excsv.zip` performs a full integrity check on the inner document:

1. **ZIP structure** — primary entry present, first in central directory, name rule satisfied.
2. **`original-size`** — inner `#!excsv` `original-size=` MUST equal the primary entry's `uncompressed_size` in the central directory.
3. **`checksum=`** — if the inner header sets `checksum=`, recompute the digest over the data section (LF-normalized, per [checksum.md](checksum.md)) and compare. Mismatch → warn `checksum_mismatch`; NOT fatal (checksum is advisory — verify warns but does not fail on it).

Structure check (1) and `original-size` (2) are MUST-fail; checksum (3) is warn-only.

Warnings (non-fatal): checksum mismatch; invalid ZIP comment (not UTF-8, not a valid ExCSV prefix); ZIP comment disagrees with inner header (other than `#@comment-truncated: 1`).

`excsv peek ARCHIVE.excsv.zip` reads only the ZIP comment (no extraction). `excsv verify` always extracts and parses the primary entry.

Command names are flat (`excsv peek`, `excsv verify`) — not nested under `excsv zip`.

## Writing a `.excsv.zip` (algorithm)

```
1. Serialize the ExCSV document to bytes (see serialization.md) WITHOUT `original-size` in the header.
2. Compute byte length → set `original-size`. Re-serialize the header line with this field added (rest of file unchanged). Re-measure once: if adding `original-size=<N>` to the header changed the byte count, recompute and re-patch. Two passes converge because the field width is bounded.
3. Create ZIP archive with one entry, name = "<base>.excsv", compression = deflate, store the bytes from step 2.
4. Build the ZIP comment:
   a. Start with the inner file's #!excsv line.
   b. Append #@/#column/#%/etc. lines in the priority order above, one per line, while staying under 65535 bytes.
   c. If anything was omitted, append "#@comment-truncated: 1" as the final line.
5. Write the ZIP with the comment, finalize.
```

## Example

```
sales.excsv.zip
└── sales.excsv          (compressed deflate, 7,432 bytes; uncompressed 18,204 bytes)

ZIP comment (4,128 bytes):
#!excsv version=0.3 delim=comma quote=double header=1 encoding=UTF-8 rows=4 checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924... original-size=18204 sql-dialect=postgres-18
#@source: sales_db.orders
#@author: author@example.com
#@created: 2026-01-01T00:00:00Z
#@exported: 2026-03-24T12:00:00Z
#@license: CC-BY-4.0
#@tool: excsv-cli/0.1.0
#column name=id type=int unique=1
#column name=customer type=string required=1
#column name=email type=string required=1
#column name=amount type=decimal min=0 max=999999.99
#$ddl: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL, amount NUMERIC(8,2))
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#%count_nonnull: 4,4,4,4
#%sum: ,,,1050.50
#@comment-truncated: 1
```

The inner `sales.excsv` (uncompressed):

```
#!excsv version=0.3 delim=comma quote=double header=1 encoding=UTF-8 rows=4 checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924... original-size=18204 sql-dialect=postgres-18
... full file: all #@ / #column / #% / #csvw lines, then data section ...
```
