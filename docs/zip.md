# ZIP Container

An ExCSV document **MAY** be shipped inside a standard ZIP archive with the extension `.excsv.zip` (or `.ecsv.zip`). This is a **container format**, not a new dialect — the inner file is a regular ExCSV document.

## Archive Layout

The archive **MUST** contain at least one entry whose name ends in `.excsv` or `.ecsv`. The **primary** entry **MUST** be:

- The **first** entry in the central directory, AND
- Named either the archive's base name with `.zip` stripped (`sales.excsv.zip` → `sales.excsv`), OR named `data.excsv` if no such match.

Additional entries (auxiliary data, attachments) **MAY** follow.

## Compression

The primary entry **SHOULD** use Deflate (method 8). Store, Deflate64, BZIP2, LZMA, and Zstandard **MAY** be used. ZIP64 extensions **MUST** be supported. Encrypted archives are **NOT** specified in v0.2.

## Required Inner Header Field

The inner `.excsv` file's `#!excsv` header **MUST** include:

```
original-size=<bytes>   uncompressed byte size of the inner .excsv file
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

Readers **MUST** treat the comment as **advisory**: the authoritative source is the inner file. If they disagree (beyond truncation), the inner file wins.

## Reserved for future use

The names below are **reserved in v0.2** for a planned column-oriented multi-table archive format (`.excsv.pack.zip`). They are not defined by v0.2. Writers conforming to v0.2 **MUST NOT** emit them. Reservation exists so third-party extensions don't claim conflicting meanings before the format is shipped.

When readers encounter any of them on a v0.2 file, they follow the existing forward-compatibility rules: unknown header keys are ignored, unknown `#`-prefixed meta lines are ignored. Nothing else is required.

| Reserved | Kind | Planned use |
| --- | --- | --- |
| `.excsv.pack.zip` / `.ecsv.pack.zip` | file extension | multi-table columnar archive |
| `layout=` | header key | values `row` / `columnar` / `pack` to distinguish the storage form |
| `mode=` | header key (manifest only) | `multi-table` (default) vs `single-table` for packs |
| `section-size=` | header key | row chunk size for columnar tables |
| `table-count=` | header key (manifest only) | informational table count |
| `#table` | meta line (manifest only) | declares a table inside a pack |
| `#fk` | meta line (manifest only) | informational foreign-key declaration between tables in a pack |

Behavior, syntax, and full semantics of the above will be defined in a future spec revision. Until then they have no meaning under v0.2.
