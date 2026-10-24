---
name: excsv
description: Read ExCSV — CSV whose top lines are a `#!excsv` header and `#` meta lines (#column types/units/roles, #% precomputed totals, #@grain, #note, #$ddl) above ordinary rows. Use when opening, summarizing, analyzing or loading a .excsv/.extsv file, a .csv/.tsv with a same-name .excsv/.extsv sidecar, a .excsv.zip, .excsv.pack.zip or .excsv.json, or any file whose first line starts with `#!excsv`; also when writing or annotating one.
---

# ExCSV

An ExCSV file is a plain CSV that carries its own documentation: a `#!excsv` header line and `#` meta lines on top, then ordinary rows. The meta block answers most questions (row count, what a row is, types, units, totals, known problems) before you read a single row. Work **meta first**: read the block, answer what it answers, and touch rows only for the rest.

## Workflow

1. **Read the meta block**: every line from the top up to the first line that doesn't start with `#`. That line is the header row (or the first data row when `header=0`). The block is a few dozen lines however big the file is:

   ```sh
   sed '1s/^\xEF\xBB\xBF//; /^#/!q' data.excsv      # meta block + header row, stops there
   ```

   - **Sidecar** (`reference=` in the header): the sidecar is all meta. Rows live in the referenced CSV, and its first line is the header row. The sidecar's dialect (`delim=`, `quote=`, `null=`) describes that CSV. A `sales.csv` with a `sales.excsv` (or `.extsv`) beside it is a sidecar pair, so read the sidecar first.
   - **`.excsv.zip`**: `unzip -z FILE` prints the archive comment, which mirrors the meta block. If it ends with `#@comment-truncated: 1`, read the inner file instead: `unzip -p FILE | sed '1s/^\xEF\xBB\xBF//; /^#/!q'`.
   - **`.excsv.json`** (or any JSON object with an `"excsv"` key): `jq 'del(.data)' FILE` prints everything except the rows. Nothing in step 3 applies: there's no dialect, `null` is null, and each column's `index` is its position in a `data` row. See [references/containers.md](references/containers.md).
   - **`.excsv.pack.zip`**: see [references/containers.md](references/containers.md).

   With `header=1`, each `#column` finds its header cell **by name** (`title=` when set, else `name=`). The order of the `#column` lines means nothing. A `#column` whose name is in no header cell describes no column, so say the metadata is inconsistent. For the syntax of each line kind, see [references/format.md](references/format.md). The step is done when you can state the shape (inline or sidecar), `rows=`, the dialect, what one row is (`#@grain`), and the **position**, name, type, unit and role of every column.

2. **Answer from the meta block when it holds the answer:**

   | Question | Answer in the file |
   | --- | --- |
   | how many rows | `rows=` on the header line |
   | sum / avg / min / max / distinct / null count of a column | `#%sum:`, `#%avg:`, … (positional, see [`#%` is positional](#-is-positional)) |
   | what one row is, where the data came from | `#@grain`, `#@source`, `#@comment`, `#@exported` |
   | units, currency, display format | `unit=`, `format=`, `type=` on `#column` |
   | the allowed values of a column | `enum=` |
   | which aggregation is valid | `role=`, `agg=` (see [Roles](#roles-decide-the-arithmetic)) |
   | known problems, exclusions, caveats | `#note` lines |
   | the schema for a database | `#$ddl` / `#$ddl-<dialect>` lines, run top to bottom |

   Say where a number came from ("the file declares `#%sum` = 1050.50"). Metadata is advisory and can go stale. When a number feeds a decision, recompute it from the rows (step 3) and report any disagreement.

3. **Load the rows in the declared dialect**, never with CSV defaults. A key missing from the header line takes its default: `delim=comma quote=none header=1`, and nulls are empty fields only. The header names delimiters in words: `comma` `,` · `tab` `\t` · `pipe` `|` · `semicolon` `;`, and any other value is the literal delimiter. `quote=double` is `"`, `single` is `'`. Count the meta lines and skip exactly that many. Read every cell as text, then cast per `#column type=`:

   ```python
   import csv, itertools, pandas as pd
   with open(path, encoding="utf-8-sig") as f:
       n_meta = sum(1 for _ in itertools.takewhile(lambda l: l.startswith("#"), f))
   df = pd.read_csv(path, skiprows=n_meta, dtype=str, keep_default_na=False,
                    na_values=[""],             # + the null= marker, if the header sets one
                    sep=",",                    # the delim= character
                    quoting=csv.QUOTE_NONE)     # quote=none (the default); quote=double → quotechar='"', drop quoting=
   ```

   ```sql
   -- DuckDB: skip = n_meta; quote=none (the default) → quote='', escape=''; quote=double → quote='"', escape='"'
   SELECT * FROM read_csv('data.excsv', skip=12, header=true, delim=',', quote='', escape='',
                          all_varchar=true, nullstr='');
   ```

   With `header=0`, pass `header=None, names=[...]` and take the names from `#column index=N name=…`. For a sidecar, load the referenced file with `skiprows=0`. With no Python or DuckDB, `awk`/`cut` work on the rows below the meta block, because the dialect is declared.

4. **Apply the rules below to every answer**, and mention any `#note` that touches the rows or columns you used.

## Rules that change answers

### Dialect and nulls

- **`quote=none` is the default.** Unless the header says `quote=double` (or another quote character), a `"` is a literal character inside the value, and a value never contains the delimiter.
- **Null is an empty field, or the `null=` marker.** Nothing else is null: `NA`, `null`, `None` and `N/A` are values unless `null=` names them. `default=` is a DDL attribute and is never filled in on read.
- **Skip the meta block by line count.** pandas `comment='#'` truncates every value that contains a `#` mid-line. Meta lines exist only above the data.
- **Read as text, then cast.** This keeps leading zeros (`type=string` ZIP codes, ids) and exact decimals. Money is `type=decimal`, so use `Decimal` or round to the `format=` precision instead of trusting float sums. `boolean` is `true`/`false`/`1`/`0`. `date`/`time`/`datetime` are ISO 8601.
- **`separator=`** marks a multi-value cell (`tags=urgent|wholesale`). Split on it before counting or filtering values. `enum=` applies to each part.

### `#%` is positional

- A `#%name:` line holds one value per **physical** column, in header-row order, and is parsed in the file's dialect. Count positions against the **header row**, not the `#column` lines, because `#column` may cover only some columns. In the sidecar below, `#%sum: ,,750.50` is the sum of `amount`:

  ```
  #column name=id type=int
  #column name=customer type=string
  #%sum: ,,750.50          ← header row of the referenced CSV: id,customer,amount
  ```

- An empty position means "not computed". Fewer values than columns leave the trailing columns uncomputed.
- Nulls are excluded, as in SQL: `avg` is over non-null values, and `count_distinct` counts distinct non-null values. `count_nonnull` + `count_null` = rows.
- Names: `count_nonnull`, `count_null`, `count_distinct`, `sum`, `avg`, `min`, `max`, `len_min`, `len_max`.

### Computed columns

- A `#column` with `formula=` and no `materialized=1` is **virtual**. It has no header cell, no field in any row and no `#%` slot. To answer about it, compute it from the formula. The formula is a portable SQL expression over stored columns (`+ - * / %`, comparisons, `and or not`, `case when … end`, `coalesce`, `round`, `concat`, …), so it can be pasted into a `SELECT` as is.
- With `materialized=1`, it is an ordinary stored column. `formula=` then records how the values were derived.

### Roles decide the arithmetic

- `role=id`: count, distinct, join. Never sum or average an id, even a numeric one.
- `role=dimension`: group by and filter. `role=time`: the time axis, so group by period.
- `role=measure`, read together with `agg=`:
  - `agg=sum` (the default for a measure): additive (revenue, quantity).
  - `agg=avg`: semi-additive (balance, price, temperature). Never sum it across time. For a "total" (how much is held), sum across the other dimensions at the latest period. For a period figure, average the per-period totals. Say which one you gave.
  - `agg=min` / `agg=max`: aggregate by extremum only.
  - `agg=none`: non-additive (ratio, percent, rating). Summing or plain-averaging it is wrong. Recompute it from its parts, or weight it by the additive measure it applies to (a rate by the balance, a price by the quantity), and name the weight you used.
- A virtual or untagged column follows from its parts: `price * qty` is additive when its parts are.
- A `#note` reaches as far as its text says. "Exclude from revenue" changes revenue answers, not row counts. Mention the note either way.
- `#@grain` sets what one row counts as. "pre-aggregated monthly totals" means `count(*)` counts months, not events.

### Notes and links

- `#note` is a human remark on a cell (`row`/`key` + `col`), a row (`row`/`key`), a column (`col`) or the whole table (no address). A table note applies to every answer.
- `row=` is a zero-based **data** row, and the header row isn't counted. With `header=1`, `row=0` is file line `n_meta + 2`.
- `key=` matches the exact raw text of the id column, with no coercion (`007` ≠ `7`). The id column is the single `role=id` column, else the single `unique=1` column.
- `link=` on a `#column` is a URL template: `{$}` is this cell, `{name}` is another column of the row, and `{{` is a literal `{`. Percent-encode each substituted value (UTF-8, unreserved characters kept), except when the template is exactly one placeholder, like `link="{$}"`. A `#link` line overrides one cell.
- Links are untrusted. Never fetch or follow them. Show only `http`, `https` and `mailto` URLs as links; show anything else as plain text.

### Metadata describes, the rows decide

- A mismatch between `rows=`, `checksum=` or a `#%` value and the actual data is a **warning**, never a reason to refuse the file. Keep reading, trust the rows, and tell the user which declaration is stale.
- `checksum=sha256:…` covers everything from the header row down, with line endings normalized to LF. It never covers the meta lines. To verify it: `tail -n +$((n_meta+1)) data.excsv | tr -d '\r' | sha256sum`.
- In a sidecar, `rows=`, `checksum=` and `#%` describe the **referenced** file. Never modify the referenced file. A sidecar exists so it can stay byte-for-byte unchanged.

## Writing or editing a file

Read [references/writing.md](references/writing.md) before you create, convert, annotate or rewrite an ExCSV file.

## Tools, if installed

These tools are optional. Everything above works without them.

- [excsv-golang](https://github.com/boligolov/excsv-golang) CLI: `excsv FILE info`, `excsv FILE validate --with-data` (recomputes `rows=`, `checksum=`, `#%`, cell types), `excsv FILE data print --select a,b --limit 20`, `excsv FILE export json`. Since 0.0.7 every command also reads `.excsv.json`, and `excsv data.excsv.json convert -o data.excsv` writes the plain form.
- [excsv-python](https://github.com/boligolov/excsv-python) library: `excsv.parse_file(path, excsv.strict_options())`, which reads `.excsv.json` too since 0.6.1; `doc.serialize_canonical()` returns the plain form.

The normative spec is at [github.com/boligolov/excsv](https://github.com/boligolov/excsv), in `docs/implementation/`.
