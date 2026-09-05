# ZIP Container

An ExCSV document **MAY** be shipped inside a standard ZIP archive with the extension `.excsv.zip` or `.extsv.zip`. This is a **container format**, not a new dialect — the inner file is a regular ExCSV document (`.excsv` or `.extsv` respectively).

## Archive Layout

The archive **MUST** contain at least one entry whose name ends in `.excsv` or `.extsv`. The **primary** entry **MUST** be:

- The **first** entry in the central directory, AND
- Named either the archive's base name with `.zip` stripped (`sales.excsv.zip` → `sales.excsv`, `sales.extsv.zip` → `sales.extsv`), OR named `data.excsv` / `data.extsv` if no such match.

Additional entries (a sidecar's referenced CSV/TSV, auxiliary data, attachments) **MAY** follow.

Readers **MUST NOT** scan past the first entry to find a matching name. If the first central-directory entry is not a valid primary (wrong name, or not `.excsv`/`.extsv`), the archive **MUST** fail with `zip_primary_not_first`, even if a later entry would satisfy the name rule.

## Sidecar inside a ZIP archive

The primary entry MAY be a **sidecar** (header + meta only, `reference=` set, no data rows) instead of an inline file. A sidecar primary follows the same naming and position rules as [Archive Layout](#archive-layout) above.

- **Sidecar alone.** The archive MAY contain only the sidecar entry, with no referenced file bundled. `original-size=` still refers to the sidecar entry itself (the metadata-only `.excsv`/`.extsv`), not to the data it describes. The ZIP comment mirrors the sidecar's meta lines exactly as it would for an inline primary.
- **Sidecar + referenced file, bundled.** The archive MAY additionally contain the file named by `reference=` as a second entry, so the pair travels as one artifact. `reference=` resolves **within the archive**: the path is relative to the sidecar entry's directory inside the ZIP, and the same constraints as the filesystem case apply — it **MUST NOT** be absolute and **MUST NOT** escape the archive (`sidecar_reference_escapes_dir`).
- **Resolution order.** When an entry matching `reference=` is present in the archive, readers **MUST** resolve against it and **MUST NOT** fall back to a filesystem file of the same name. If no matching entry exists in the archive, readers **MAY** fall back to a filesystem lookup next to the extracted/opened archive; if that also fails, treat it as `sidecar_reference_not_found` — parsing the sidecar still succeeds, and the handle degrades to read-only/metadata-only (see [File structure § Sidecar](file-structure.md#sidecar-detached-metadata)).
- **Discovery.** Given any archive entry whose name ends in `.csv`/`.tsv`, implementations MAY look for a same-basename `.excsv`/`.extsv` entry elsewhere in the same archive and load it as that entry's sidecar — the in-archive analogue of the filesystem discovery rule in [File structure](file-structure.md#sidecar-detached-metadata).

Example — `sales.excsv.zip` carrying both halves of the pair:

```
sales.excsv.zip
├── sales.excsv          ← primary entry: sidecar (header + meta, reference=sales.csv)
└── sales.csv            ← referenced data, byte-identical to the unzipped original
```

Primary-entry naming and position, `original-size=`, ZIP comment priority and truncation, compression, and password protection are otherwise unchanged from the inline case.

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
