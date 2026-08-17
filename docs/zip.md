# ZIP container

You can ship an ExCSV file inside a normal ZIP with the extension `.excsv.zip` (or `.extsv.zip`). It's still the same file — just compressed. Anything that reads ZIP can open it; the file inside is a regular `.excsv`.

## Preview without unzipping

The neat part: the archive's **comment field** carries a text summary of what's inside — the header, the columns, the SQL, the aggregations. So a tool can show you the schema and stats of a compressed file *without extracting it*. Browsing a folder of zipped exports, you see what each one holds at a glance.

The summary is a copy for convenience; the file inside is the source of truth. If a summary gets long, it's trimmed to fit the ZIP comment's size limit and marked as truncated.

## Passwords

A `.excsv.zip` can use standard ZIP encryption if the data is sensitive. The password is handled by your tooling at read/write time — it's never written into the ExCSV metadata or the comment. (With encryption on, the preview-from-comment trick waits until the archive is unlocked.)

## Compression

Deflate is the usual choice; other standard ZIP methods work too, and large archives (ZIP64) are supported. Nothing exotic — any competent ZIP tool handles it.

## Multi-table archives

For wide tables, database snapshots, or bundling several related tables, there's a columnar variant — the **pack** (`.excsv.pack.zip`), covered in [pack.md](pack.md).
