# Identity

ExCSV = Extended CSV. Self-describing, line-oriented tabular format. Spec version: 0.3 (Draft). Backward-compatible with CSV/TSV.

**ExCSV is a descriptive meta-format over CSV/TSV — it describes data, it does not define or alter it.** The data section stays byte-for-byte valid CSV/TSV; metadata annotates it. Consequences (normative): reading never rewrites cell values (`default=` is not substituted, `null` markers read as null); integrity/consistency signals (`checksum=`, `rows=` vs visible rows, `default=` vs actual nulls) describe the data as authored and surface drift as **warnings, never gates**; where a description and a generated artifact (e.g. SQL DDL) diverge, the file records both and flags the gap rather than mutating data to force agreement.

**File extensions:** `.excsv`, `.extsv` (plain); `.excsv.zip`, `.extsv.zip` (row ZIP, [ZIP](zip.md)); `.excsv.pack.zip`, `.extsv.pack.zip` (pack, [pack.md](pack.md)).

**MIME types:** `text/excsv` (plain), `application/excsv+zip` (row ZIP), `application/excsv-pack+zip` (pack). Encoding default: UTF-8. License: CC0 1.0.

Storage forms: inline plain, sidecar (`reference=`), row zip (one inner inline file), pack (manifest + columnar tables).

## Implementations

Reference CLI/library: **excsv-golang** (Go) — https://github.com/boligolov/excsv-golang — `excsv` command; plain + row-ZIP v0.3 (pack not yet in golang).
