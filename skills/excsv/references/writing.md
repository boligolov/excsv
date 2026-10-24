# Writing and editing ExCSV

Produce files that every CSV tool can still read, and keep every declaration true for the rows below it.

## Pick the shape

| Situation | Shape |
| --- | --- |
| You create the data (an export, a snippet for a person or an LLM) | **inline**: header + meta + rows in one `.excsv` |
| The CSV already exists and must not change (vendor dump, checksummed file, someone else's file) | **sidecar**: a `same-name.excsv` beside `same-name.csv`, with `reference=same-name.csv` and no rows. Never write into the referenced file. |
| The consumer is code (an API, a frontend, a pipeline), or you return the table as a structured response | **JSON form** `.excsv.json`: real types, no quoting or escaping (see [Writing the JSON form](#writing-the-json-form)) |

The plain text form is canonical: the best for storage, for people, and for pasting into a prompt (about half the tokens of the JSON form). The JSON form is the safest to emit, because there is no dialect to get wrong. Neither reference implementation converts JSON back to plain yet, so pick the form the consumer needs.

## A minimal correct inline file

```
#!excsv version=0.6 delim=comma quote=double header=1 rows=2
#@grain: one row per order
#@source: shop_db.orders
#column name=id type=int role=id
#column name=amount type=decimal unit=USD role=measure agg=sum
#%sum: ,750.50
id,amount
1,500.00
2,250.50
```

Rules a writer must follow:

- **Generate rows with code, never type them out.** For more than a handful of rows, write them with a CSV writer (Python `csv.writer(f, lineterminator="\n")` with `quote=double`), and compute `rows=` and `#%` from the same list in the same script.
- **The header line comes first, and `rows=` is required.** `rows=` counts data rows, not the header row, and must equal the real count.
- **Spell out the dialect** (`delim=`, `quote=`, `header=`). If any value contains the delimiter or a quote, use `quote=double` and quote that value, doubling any inner `"`. Every value stays on one line: replace embedded newlines with spaces. If a row's first field starts with `#`, quote it.
- **Use the recommended meta order**: `#@` → `#column` → `#chart` → `#note`/`#link` → `#$` → `#%`. Readers accept any order.
- **Write a `#column name=` for every column, matching the header cell** (or set `title=` to the header cell). Readers bind by name, so any order works; header order reads best. Give it a `type=`, and add `unit=`, `role=` and `agg=` where they apply. Write `#@grain` whenever the row unit isn't obvious. These are the attributes that stop the reader guessing.
- **Names** have no spaces (`[A-Za-z_][A-Za-z0-9_-]*`). Quote any attribute value that contains spaces: `title="Order ID"`. Write `##` only for free-form comments, never inside a structured line.
- **Compute `#%` values from the rows you write**, one value per physical column, with nulls excluded. Leave a position empty when an aggregation doesn't apply (`sum` of a string column). Never estimate a value.
- **`checksum=` is optional.** If you include it, it is the `sha256:` of everything from the header row to the end of the file, with line endings as LF: `tail -n +$((n_meta+1)) f.excsv | tr -d '\r' | sha256sum`.
- **`#$ddl` is one statement per line**, executed in order. Add a dialect suffix (`#$ddl-postgres:`) when the SQL is dialect-specific, or set `sql-dialect=` on the header.
- **`#note`** takes `text="…"` and an optional address. When the table has an id column (`role=id`, else `unique=1`), anchor notes with `key=` rather than `row=`, so they survive sorting. Keep notes few: a per-row status belongs in a column.

## Writing the JSON form

The same document as one JSON object. Only `excsv` is required by the schema, but write the metadata that makes the table useful:

```json
{
  "excsv": "0.6",
  "meta": { "grain": "one row per order", "source": "shop_db.orders" },
  "columns": [
    { "index": 0, "name": "id", "type": "int", "role": "id" },
    { "index": 1, "name": "note", "type": "string" },
    { "index": 2, "name": "amount", "type": "decimal", "unit": "USD", "role": "measure", "agg": "sum" }
  ],
  "aggregates": { "sum": [null, null, "15.75"] },
  "notes": [{ "key": "2", "text": "Refund pending" }],
  "rows": 2,
  "data": [[1, "says \"hi\", ok", "10.50"], [2, null, "5.25"]]
}
```

- **`data` has no header row.** Every physical column has a unique `index`, from 0 up. That index is its position in each row and in each `aggregates` array. A virtual `formula=` column has no `index`.
- **Types are real.** `int`/`float`/`double` are numbers, booleans are `true`/`false`, and null is `null`. `decimal` and `long` values are **strings**, so money never becomes a float.
- **Attribute flags are booleans** (`"unique": true`, `"materialized": true`), and `enum` is an array.
- **`rows` must equal `data.length`.** Compute `aggregates` from `data`, as for `#%`.
- **Validate** against [`https://excsv.dev/schema/excsv-0.6.schema.json`](https://excsv.dev/schema/excsv-0.6.schema.json). When your API supports structured output, constrain the response with this schema.
- Add `"csv": { "delim": "comma", "quote": "double" }` only if the document will be turned back into text.

## Editing an existing file

Every rewrite keeps the declarations true:

- **Rows added or removed** → update `rows=`, recompute each `#%` value, and recompute `checksum=` if one is present.
- **Rows reordered, filtered or sliced** → renumber every `row=` in `#note`/`#link`, and drop lines whose row is gone. `key=` lines need no change.
- **Column renamed** → update the header cell, the `#column name=`, every `formula=`, `#chart` channel and `#note`/`#link` `col=`, and every `{old}` in `link=` templates. Fix `#$` SQL by hand.
- **Column added or removed** → update the header row, every data row, every `#%` line (one value per position), `columns=` if declared, and `checksum=`.
- **Only meta lines changed** (a note, an attribute) → the checksum is unaffected, because it never covers meta lines.
- **Unknown `#` lines and unknown attributes** → keep them unchanged on rewrite.
- **Sidecar** → you may edit the sidecar freely. Never edit its referenced file. To add a materialized column to sidecar data, write a new inline file.
- **Version** → when you add `#note`, `#link` or `link=` to an older file, raise `version=` to `0.6`.

If the [excsv-golang](https://github.com/boligolov/excsv-golang) CLI is installed, use it:

- `excsv FILE fix` recomputes `rows=`, `checksum=` and `#%` in place.
- `excsv FILE validate --with-data` confirms the file afterwards.
- `excsv data.csv convert -o data.excsv` (`--format sidecar` for a sidecar) creates a file from a plain CSV.
