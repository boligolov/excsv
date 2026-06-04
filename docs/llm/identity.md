# Identity

ExCSV = Extended CSV. Self-describing, line-oriented tabular format. Spec version: 0.2 (Draft). Backward-compatible with CSV/TSV.

**File extensions:** `.excsv`, `.extsv` (plain — inline or sidecar); `.excsv.zip`, `.extsv.zip` (zipped container, see [ZIP](zip.md)).

**MIME types:** `text/excsv` (plain), `application/excsv+zip` (zipped). Encoding default: UTF-8. License: CC0 1.0.

Storage forms (non-normative overview): inline plain (header+meta+data), sidecar (header+meta only, `reference=` points at CSV/TSV), zip (one inner inline file), pack (reserved, see [Reserved](reserved.md)).

## Implementations

Reference CLI/library: **excsv-golang** (Go) — https://github.com/boligolov/excsv-golang — `excsv` command; plain + row-ZIP v0.2.
