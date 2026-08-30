# ExCSV — the guide

CSV that describes itself. These pages are for anyone who works with tables — analysts, data scientists, anyone who opens a `.csv` and wishes it came with a note explaining what's inside. They cover **what you can put in a file, what it means, and why it's worth it**. Start at the [root README](../README.md) for the pitch and quick links.

| Topic | What it gives you |
| --- | --- |
| [Introduction](introduction.md) | The idea in two minutes: context that travels with the data |
| [File structure & sidecar](file-structure.md) | How a file is laid out — inline, sidecar, header-only stub — and when to use each |
| [Header line (`#!excsv`)](header.md) | The one line that names the dialect: delimiter, quote, encoding, row count |
| [Meta lines (overview)](meta-lines.md) | A map of every `#` line kind so you know what you're looking at |
| [File metadata (`#@`)](file-metadata.md) | Provenance: source, author, grain, license, tags |
| [Column schema (`#column`)](columns.md) | Types, units, formats, enums, roles — stop guessing what a column is |
| [SQL companions (`#$`)](sql.md) | Ship the `CREATE TABLE` (and the query) that made the data |
| [Aggregations (`#%`)](aggregations.md) | Sums, averages, counts that ride along — trustworthy totals without scanning |
| [Checksum](checksum.md) | An integrity fingerprint of the data |
| [ZIP container](zip.md) | Zip a file and preview its schema without unzipping |
| [Pack container](pack.md) | Columnar, multi-table archives for wide tables and snapshots |
| [JSON form (`.excsv.json`)](json.md) | The same file as JSON, for APIs, config, and LLM output |
| [Data section](data-section.md) | It's still plain CSV rows down here |
| [Full example](full-example.md) | One file showing every feature at once |
| [Prior art](prior-art.md) | What ExCSV borrows from ECSV, Annotated CSV, MetaCSV |
| [License](license.md) | CC0 |

Prefer JSON? The same content has an [exact JSON form](json.md) — `.excsv.json` — that round-trips with the CSV form.

---

**Building a tool, parser, or validator?** The precise rules — required fields, edge cases, validation, and the full error-code registry — live in [implementation/](implementation/). This guide deliberately leaves them out so it stays readable.
