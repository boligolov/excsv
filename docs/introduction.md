# Introduction

You open a CSV someone sent you. Which column is the amount? Is `01720` a ZIP code or the number 1720? Is `2026-01-02` the 2nd of January or the 1st of February? Are these *all* the rows, or just the first thousand your viewer loaded? And what's the total — do you trust it, or re-add the column yourself?

The answers used to live somewhere else: a README, a Slack thread, someone's memory. **ExCSV puts them back in the file.** Column types and units, a one-line description of what a row means, pre-computed totals, where the data came from, even the `CREATE TABLE` that would recreate it — all written as `#` comment lines that every CSV reader already skips.

Your file stays plain CSV. `grep`, `awk`, `cut`, pandas, Excel keep working exactly as before. It just stops being anonymous.

## It describes; it never changes your data

ExCSV is a layer of description on top of CSV. The rows themselves stay byte-for-byte the same CSV they always were — ExCSV only *annotates* them. Reading an ExCSV file never rewrites a value, never fills in a blank, never "corrects" anything. What you see in the data section is what's there. That's the whole point: you can trust the file to describe reality, not reshape it.

## What you can add

Every piece is optional. Add a header, then types, then stats, then SQL — each layer stands on its own, and you stop wherever it's useful enough.

- **A header line** (`#!excsv`) — declares the dialect: delimiter, quote, encoding, whether row one is a header, how many rows there are.
- **Column schema** (`#column`) — types, units, display formats, allowed values (enums), and analytical roles like *id* / *measure* / *time*.
- **Aggregations** (`#%`) — sum / avg / min / max / counts, pre-computed, so a total is a fact in the file, not something a preview tool guesses.
- **File metadata** (`#@`) — source, author, license, tags, and `#@grain` ("one row per order") that says what a single row *is*.
- **SQL companions** (`#$`) — DDL to recreate the schema and DQL queries for provenance, tagged by dialect (MySQL / Postgres / ClickHouse / …).
- **A checksum** — an integrity fingerprint of the data.

## Four shapes, one vocabulary

The same header and `#column` / `#%` / `#$` / `#@` vocabulary works everywhere; the shapes differ only in **how the data is packaged**. See [file structure](file-structure.md), [pack](pack.md), and [JSON](json.md).

- **Inline** — metadata at the top, rows below, one file that's still valid CSV.
- **Sidecar** — a metadata-only `.excsv`/`.extsv` next to an untouched `data.csv`, bound with `reference=`. Nothing is copied; the original never changes. This is how you annotate data you're not allowed to touch.
- **Pack** — `.excsv.pack.zip`: a columnar, multi-table archive — read a few columns out of many without unpacking the rest.
- **JSON** — `.excsv.json`: the same document as a JSON object, for when JSON is the natural envelope.

You can also **zip** an inline or sidecar file (`.excsv.zip`) — a sidecar can travel alone or bundled with the CSV/TSV it describes as a second entry in the same archive — and its schema is mirrored into the archive comment, so tools preview the metadata without unzipping.

## The JSON form

When you're already working in JSON — a web app, an API response, feeding a table to an AI model — the very same content (columns, types, aggregates, SQL, provenance) has a JSON file format of its own: `.excsv.json`. It's an exact mirror of the CSV form, so a file can go CSV → JSON → CSV without losing anything, and there's a JSON Schema you can validate against or point a model at. You don't need it to use ExCSV; it's there for when JSON is simply more convenient. See [JSON form](json.md).

---

Want the exact rules a tool must follow — required fields, validation, error codes? Those live in [implementation/](implementation/).
