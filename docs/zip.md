# ZIP container

You can ship an ExCSV file inside a normal ZIP with the extension `.excsv.zip` (or `.extsv.zip`). It's still the same file — just compressed. Anything that reads ZIP can open it; the file inside is a regular `.excsv`.

```
sales.excsv.zip
└── sales.excsv          ← ordinary plain file (header + rows)
```

## `original-size`

The inner file's `#!excsv` header carries `original-size=` — the uncompressed byte size of that whole file. It matches the size the ZIP directory records for the entry, so you know how big the extract is before you unzip.

```
#!excsv version=0.3 delim=comma header=1 rows=10000 original-size=204800
```

A mismatch means the archive and the header disagree — the file was rewritten or the archive was rebuilt without updating the header.

## Preview without unzipping

The archive's **comment field** carries a text summary of what's inside — the header (including `original-size=`), the columns, the SQL, the aggregations. A tool can show you the schema and stats of a compressed file *without extracting it*. Browsing a folder of zipped exports, you see what each one holds at a glance.

The comment is a copy for convenience; the file inside is the source of truth.

### When it doesn't all fit

A ZIP comment is limited to **65535 bytes**. Wide tables with many `#column` lines, or a pile of dialect-specific `#$ddl`, can overflow that. The writer fills the comment in priority order (header first, then provenance, columns, DDL, aggregations, …) and stops when the next line wouldn't fit. If anything was left out, the comment **ends with**:

```
#@comment-truncated: 1
```

That line means the peek is incomplete — unzip (or read the inner file) for the rest. Without it, the comment is the full metadata prefix.

## Passwords

A `.excsv.zip` can use standard ZIP encryption if the data is sensitive. The password is handled by your tooling at read/write time — it's never written into the ExCSV metadata or the comment. (With encryption on, the preview-from-comment trick waits until the archive is unlocked.) Inner `original-size=` and `checksum=` refer to the decrypted file.

## Compression

Deflate is the usual choice; other standard ZIP methods work too, and large archives (ZIP64) are supported. Nothing exotic — any competent ZIP tool handles it.

## Multi-table archives

For wide tables, database snapshots, or bundling several related tables, there's a columnar variant — the **pack** (`.excsv.pack.zip`), covered in [pack.md](pack.md).
