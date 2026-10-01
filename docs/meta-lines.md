# Meta lines

Between the header and the data sit the **meta lines** — the `#` lines that describe the table. Each kind is told apart by its prefix, so once you know the prefixes you can read any ExCSV file at a glance.

| Prefix | What it is | Example |
| --- | --- | --- |
| `#@key: value` | File-level metadata — where it came from, who made it, what a row means | `#@source: sales_db.orders` |
| `#column ...` | One column's schema — type, unit, format, role, allowed values | `#column name=id type=int` |
| `#chart ...` | A suggested chart over columns you've described | `#chart type=bar name=by_category x=category y=amount` |
| `#note ...` | A remark on a cell, row, column, or the whole table | `#note row=2 col=amount text="Refund pending"` |
| `#link ...` | A link on one cell | `#link row=2 col=invoice href="https://example.com/inv/77"` |
| `#$verb: ...` | A SQL statement that ships with the data — DDL or a query | `#$ddl: CREATE TABLE orders (...)` |
| `#%name: ...` | A pre-computed aggregate — sum, avg, count, one value per column | `#%sum: ,, 42.5` |
| `## ...` | A plain human comment — free text, ignored by tools | `## TODO: drop legacy status values` |

A few conveniences:

- **Order is up to you.** A common, readable order is `#@` first, then `#column`, `#chart`, `#note`/`#link`, then `#$`, and `#%` — but tools accept any order. (The one place order carries meaning is a sequence of `#$ddl` statements, which run top to bottom.)
- **`##` comments** are free text for humans — put them anywhere in the meta block. They're never parsed as data. When a remark belongs to a specific cell, row, or column, use [`#note`](notes.md) instead: tools understand it and it survives conversion to JSON.
- **Unknown `#` lines** are simply skipped, so you can sprinkle in your own without breaking anything.

Each kind has its own page: [File metadata](file-metadata.md), [Columns](columns.md), [Charts](charts.md), [Notes and links](notes.md), [SQL](sql.md), [Aggregations](aggregations.md).

> Packs add two manifest-only lines, `#table` and `#fk`, that only appear inside `.excsv.pack.zip`. See [Pack container](pack.md).
