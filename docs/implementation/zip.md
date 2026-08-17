# ZIP Container

An ExCSV document **MAY** be shipped inside a standard ZIP archive with the extension `.excsv.zip` or `.extsv.zip`. This is a **container format**, not a new dialect — the inner file is a regular ExCSV document (`.excsv` or `.extsv` respectively).

## Archive Layout

The archive **MUST** contain at least one entry whose name ends in `.excsv` or `.extsv`. The **primary** entry **MUST** be:

- The **first** entry in the central directory, AND
- Named either the archive's base name with `.zip` stripped (`sales.excsv.zip` → `sales.excsv`, `sales.extsv.zip` → `sales.extsv`), OR named `data.excsv` / `data.extsv` if no such match.

Additional entries (auxiliary data, attachments) **MAY** follow.

Readers **MUST NOT** scan past the first entry to find a matching name. If the first central-directory entry is not a valid primary (wrong name, or not `.excsv`/`.extsv`), the archive **MUST** fail with `zip_primary_not_first`, even if a later entry would satisfy the name rule.

## Compression

The primary entry **SHOULD** use Deflate (method 8). Store, Deflate64, BZIP2, LZMA, and Zstandard **MAY** be used. ZIP64 extensions **MUST** be supported.

## Password protection

Archives **MAY** use standard ZIP encryption (PKZIP traditional or AES — the writer chooses). The password is supplied by tooling at write/read time and **MUST NOT** be stored in the `#!excsv` header, `#@` metadata, or ZIP comment.

- Readers **MUST** have the password before extracting or parsing the inner file.
- The comment fast path **MAY** be unavailable until the archive is unlocked.
- Inner `checksum=` and `original-size=` refer to the decrypted payload.

## Required Inner Header Field

The inner `.excsv` or `.extsv` file's `#!excsv` header **MUST** include:

```
original-size=<bytes>   uncompressed byte size of the inner file
```

This value **MUST** match the `uncompressed_size` recorded in the ZIP central directory entry for the primary file. A mismatch **MUST** be reported as a validation error.

For semantic content integrity, use the `checksum=` field ([Checksum](checksum.md)) — it covers the data section and survives re-compression or re-archiving.

## ZIP Comment (Summary)

The ZIP end-of-central-directory comment field (max 65535 bytes) **MUST** carry a textual summary of the inner ExCSV file. This lets consumers read metadata **WITHOUT** extracting the archive.

The comment **MUST** be UTF-8 encoded and **MUST** be a valid prefix of an ExCSV file (begins with `#!excsv ...`, then `#` lines only).

### Priority Order

Writers **MUST** include lines in this priority order, stopping when the next line would exceed the 65535-byte budget:

1. `#!excsv` header line (**MUST** be present, **MUST** include `original-size=`).
2. `#@source`, `#@author`, `#@created`, `#@exported`, `#@license`, `#@tool`.
3. All `#column` lines.
4. All `#$ddl` and `#$ddl-<dialect>` lines (preserving file order).
5. All `#%` aggregation lines.
6. `#@comment`, `#@tags`.
7. Remaining `#@` entries.
8. All `#$dql` and `#$dql-<dialect>` lines.
9. `#csvw` payload.

### Truncation Marker

If any content was omitted, the comment **MUST** end with:

```
#@comment-truncated: 1
```

Readers **MUST** treat the comment as **advisory**: the authoritative source is the inner file. Invalid comment (not UTF-8, or not a valid ExCSV prefix) **MUST NOT** block extraction or parsing of the inner file — **SHOULD** warn. If comment and inner header disagree (beyond truncation), the inner file wins — **SHOULD** warn.

## Verification (`excsv verify`)

`excsv verify ARCHIVE.excsv.zip` checks:

1. Primary entry layout (first in central directory, correct name).
2. Inner `original-size=` matches the primary entry's `uncompressed_size`.
3. If `checksum=` is set, recomputed data-section digest matches (see [Checksum](checksum.md)).

Mismatch on (2) **MUST** fail. A checksum mismatch (3) **SHOULD** warn but **MUST NOT** fail — checksum is advisory (see [Checksum](checksum.md)). Invalid comment or comment vs inner header disagreements **SHOULD** warn.

`excsv peek` reads only the ZIP comment. Commands are flat (`excsv peek`, `excsv verify`), not `excsv zip peek`.

## Pack container

Multi-table columnar archives (`.excsv.pack.zip`, `.extsv.pack.zip`) are specified in **[pack.md](pack.md)**. They use `layout=pack` on the manifest and `layout=columnar` on each table's `_header.excsv`.

Plain and row-oriented ZIP files **MUST NOT** use pack-only keys. Reserved on row/plain (ignore, not fatal): header fields `layout=`, `section-size=`, `table-count=`; meta lines `#table`, `#fk`.
