# ExCSV line syntax (v0.6, reading view)

Use this to read a meta block by hand. The normative source is `docs/implementation/` in [boligolov/excsv](https://github.com/boligolov/excsv); this file keeps what a reader needs.

## Layout

```
#!excsv version=0.6 delim=comma quote=double header=1 rows=4 sql-dialect=mysql   ← optional, line 1
#@grain: one row per order                                                        ← meta lines, any order
#column name=id type=int role=id
#%sum: ,,1050.50
id,customer,amount                                                                ← first non-# line: data section
1,Acme,500.00
```

- The meta block ends at the **first line not starting with `#`**. Every `#` line is above the data. A UTF-8 BOM may precede line 1, and lines may end in LF or CRLF.
- Data rows are single-line. A quoted value never contains a raw newline, so one line is one row.
- If the first data field starts with `#`, it is quoted (or the file uses `quote=#`).
- With no `#!excsv` line, the defaults apply: `delim=comma quote=none header=1 encoding=UTF-8`.

## `key=value` tokens

`#!excsv`, `#column`, `#chart`, `#note`, `#link`, `#table` and `#fk` lines share one grammar. Pairs are separated by spaces, and each splits on its first `=`. A value with spaces is double-quoted, and `""` inside quotes is a literal `"`. Nothing else is escaped. Unknown keys are ignored, and custom ones use an `x-` prefix.

`#@key: value`, `#$verb: payload` and `#%name: payload` take raw text to the end of the line. One space after the `:` is optional. `##` starts a human comment, which carries no meaning.

## Header line `#!excsv`

| Field | Meaning |
| --- | --- |
| `version` | Required. Format version. |
| `rows` | Physical data rows, not counting the header row. Required when the header line exists, except on a pack manifest. |
| `delim` | `comma` (default) `tab` `pipe` `semicolon`, or a literal string (`delim=::`). |
| `quote` | `none` (default) `double` `single`, or a literal character. |
| `header` | `1` (default): the first data line is a header row. `0`: no header row, so names come from `#column index=`. |
| `null` | An extra null marker (`NA`, `\N`). An empty field is always null. |
| `encoding` | Default `UTF-8`. |
| `columns` | Physical column count: stored columns plus materialized computed ones. |
| `checksum` | `<algo>:<hex>` over the data section (header row included, LF-normalized). Advisory. |
| `sql-dialect` | The dialect of `#$` lines that have no suffix. Default `ansi`. |
| `reference` | Sidecar only: relative path to the CSV/TSV that holds the rows. |
| `original-size` | ZIP/pack only: uncompressed byte size. |

## Line kinds

| Prefix | Meaning |
| --- | --- |
| `#@key: value` | File metadata. Common keys: `grain`, `source`, `author`, `comment`, `created`, `exported`, `license`, `tool`, `tags` (comma-separated). Last wins on duplicates. |
| `#column k=v …` | Schema of one column (see below). Optional and possibly partial. |
| `#%name: v1,v2,…` | Precomputed aggregate, one value per physical column, parsed in the file's dialect. Empty = not computed. |
| `#$ddl[-dialect[-ver]]: SQL` | DDL, one statement per line. Executed in file order. |
| `#$dql[-dialect[-ver]]: SQL` | The query that produced the data. Informational. |
| `#chart type=… name=… x=… y=…` | Suggested chart over named columns. `#chart-vega: {json}` is raw Vega-Lite. |
| `#note k=v … text="…"` | Remark on a cell, row, column or the table. |
| `#link col=… row=…/key=… href="…"` | URL for one cell. |
| `#table …`, `#fk from=t.c to=t.c` | Pack manifest only (see [containers.md](containers.md)). |
| `## text` | Human comment, ignored. |

## `#column` attributes

| Group | Attributes |
| --- | --- |
| identity | `name` (required with `header=1`), `index` (zero-based, required with `header=0`), `title` (the header cell when set), `description` |
| type | `type`: `string int long float double decimal boolean date time datetime uuid binary`; `format` (display/parse hint, e.g. `0.00`) |
| nulls | `required=1` (must not be null), `default` (DDL only, not applied on read) |
| constraints | `min` `max` `len_min` `len_max` `enum=a\|b\|c` (non-null values only) `pattern` (ECMAScript regex) `unique=1` |
| semantics | `unit` (`USD`, `kg`, `ms`), `role` (`id` `dimension` `measure` `time`), `agg` (`sum` `avg` `min` `max` `none`), `order` (`asc` `desc` `none`: how the data is sorted), `separator` (multi-value cell) |
| computed | `formula="price * quantity"`, `materialized=1` |
| link | `link="https://…/{$}"` URL template |

Matching `#column` lines to physical columns:

- **`header=1`**: by order. The first `#column` line describes the first header cell, the second `#column` the second cell, and so on. Its `title=` (or `name=` when there is no title) must equal that cell. If it doesn't, the file is inconsistent (`column_name_header_mismatch`, a warning): tools still apply the line to the cell at its position, so don't trust that column's type or role, and tell the user. Header cells past the last `#column` line are untyped.
- **`header=0`**: match by `index=`.
- **Virtual computed columns** (`formula=` without `materialized=1`) don't take a position. Skip them when counting.

## Formula grammar (`formula=`)

The operands are stored-column names, numbers, `'strings'`, `true`, `false` and `null`. The operators are `+ - * / %`, unary `-`, `= <> < <= > >=`, `and or not` and parentheses. `case when … then … [else …] end` is supported. The allowed functions are `abs round floor ceil coalesce nullif least greatest length lower upper trim substr concat`. There is no `||`; use `concat`. A formula references stored columns only, never another computed column.

## Notes and links

| Fields present | A `#note` is attached to |
| --- | --- |
| `row`/`key` + `col` | one cell |
| `col` only | a column |
| `row`/`key` only | a row |
| none | the table |

- `row` is a zero-based data row, not counting the header row.
- `key` is the raw text of the id column: the single `role=id` column, else the single `unique=1` column.
- `col` is a name, or an index with `header=0`.
- Other `#note` fields are `author` and `created`.
- Notes keep file order. There are no threads or replies.
- An address that doesn't resolve (unknown column, row past the end, unknown key) is only a warning; the line is kept.

Link templates (`link=` on `#column`):

| Token | Substituted with |
| --- | --- |
| `{$}` | this cell's raw value |
| `{name}` | the raw value of the named column in the same row |
| `{N}` | the raw value of column index `N` (`header=0` only) |
| `{{` | a literal `{` |

- Values are raw text after CSV unquoting. `format=` and `unit=` are not applied.
- Each substituted value is percent-encoded as UTF-8, leaving `A–Z a–z 0–9 - . _ ~` as is. A template that is exactly one placeholder (`{$}`, `{url}`) is not encoded.
- If any placeholder's value is null, the cell has no link.
- `#link` overrides the template for its cell. On duplicates, the last one wins.
- Only `http`, `https` and `mailto` are rendered as links, and the scheme is checked on the final URL. Never fetch a link.

## SQL dialect of a `#$` line

1. If the key has a suffix (`ddl-postgres-17`), that suffix is the dialect, with an optional `-version`.
2. Otherwise the header's `sql-dialect=` applies.
3. Otherwise the dialect is `ansi`.

The aliases `postgresql` and `pg` mean `postgres`; `sqlserver` means `mssql`.

To pick the DDL for target `postgres`, take every `#$ddl` line whose dialect is `postgres` or `postgres-<any version>`, in file order. Keys and constraints are expressed only as DDL (`ALTER TABLE … ADD CONSTRAINT`). `unique=1` is just a hint.

## Severity

A reader rejects a file only for broken structure:

- a malformed header token, or a missing `version=` or `rows=`
- a data row with the wrong number of fields
- an unquoted delimiter under `quote=none`
- an unquoted `#` in the first field of a row
- a quoted raw newline
- invalid UTF-8
- data rows in a sidecar
- `reference=` that escapes its directory
- malformed `#note`/`#link`/`#chart`/`formula=` lines

Everything about **consistency** is only a warning, and reading continues:

- `rows=`, `columns=`, `checksum=` or `#%` disagreeing with the data
- unknown attributes, unknown version, unknown SQL dialect
- unresolved notes or links, a missing referenced file

The full code registry is in `docs/implementation/error-handling.md`.
