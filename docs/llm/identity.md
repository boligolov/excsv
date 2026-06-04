# Identity

ExCSV = Extended CSV. Self-describing, line-oriented tabular format. Spec version: 0.3 (Draft). Backward-compatible with CSV/TSV.

**File extensions:** `.excsv`, `.extsv` (plain); `.excsv.zip`, `.extsv.zip` (row ZIP, [ZIP](zip.md)); `.excsv.pack.zip`, `.extsv.pack.zip` (pack, [pack.md](pack.md)).

**MIME types:** `text/excsv` (plain), `application/excsv+zip` (zipped). Encoding default: UTF-8. License: CC0 1.0.

Storage forms: inline plain, sidecar (`reference=`), row zip (one inner inline file), pack (manifest + columnar tables).

## Implementations

Reference CLI/library: **excsv-golang** (Go) — https://github.com/boligolov/excsv-golang — `excsv` command; plain + row-ZIP v0.3 (pack not yet in golang).
