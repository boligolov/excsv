# Column Schema

## Column Definition

Column annotations are **OPTIONAL**. A file without any `#column` lines is valid (schema-less mode). Partial coverage is also valid — not every column needs a `#column` line; missing columns have no schema (user's responsibility). If present, each column is described with one `#column` line:

```
#column name=id type=int unique=1
#column name=email type=string required=1 len_max=254
#column name=amount type=decimal format=0.00 unit=USD
```

## Required Fields

| Field | `header=1` | `header=0` |
|---|---|---|
| `name` | **MUST** | MAY |
| `index` | not used | **MUST** |

## Name Rules

- `name` **MUST NOT** contain spaces.
- `name` **SHOULD** match the regex `[A-Za-z_][A-Za-z0-9_-]*`.

## Header Mapping

**When `header=1`:**

- A data header row **MUST** exist as the first row of the data section.
- If `title` is present, the header cell **MUST** match `title`. Otherwise it **MUST** match `name`.
- Missing or extra columns **MUST** be treated as a validation error.

**When `header=0`:**

- Each `#column` **MUST** have `index` (zero-based) to define its position.
- `name` is optional — if omitted, the column is referenced by index only.

## Column Attributes

### Identity

| Field         | Requirement | Description                                                     |
| ------------- | ----------- | --------------------------------------------------------------- |
| `name`        | **MUST** if `header=1`, MAY if `header=0` | Column identifier               |
| `title`       | MAY         | Human-readable display name (MUST be quoted if contains spaces) |
| `description` | MAY         | Free-text description (quoted)                                  |

### Type System

| Field    | Requirement | Description               |
| -------- | ----------- | ------------------------- |
| `type`   | SHOULD      | Data type (see below)     |
| `format` | MAY         | Display/parse format hint |

Allowed types:

| Type       | Description                                               |
| ---------- | --------------------------------------------------------- |
| `string`   | Text in the file's encoding (see `encoding` header field) |
| `int`      | 32-bit signed integer                                     |
| `long`     | 64-bit signed integer                                     |
| `float`    | 32-bit IEEE 754                                           |
| `double`   | 64-bit IEEE 754                                           |
| `decimal`  | Arbitrary-precision decimal                               |
| `boolean`  | Canonical lexical forms: `true`, `false`, `1`, `0`         |
| `date`     | ISO 8601 date (`YYYY-MM-DD`)                              |
| `time`     | ISO 8601 time (`HH:MM:SS`)                                |
| `datetime` | ISO 8601 datetime                                         |
| `uuid`     | Textual UUID representation                               |
| `binary`   | Base64-encoded binary                                     |

### Default / Required

| Field      | Requirement | Description                                             |
| ---------- | ----------- | ------------------------------------------------------- |
| `default`  | MAY         | Schema/DDL default (see below). **Not** applied when reading data. |
| `required` | MAY         | `1` = field must not be null, `0` = nullable. If `default` is also set, the default satisfies the requirement at the schema level |

`default` is a schema attribute, not a read transform. An empty field, or a field equal to the file's `null` marker, reads as **null** regardless of `default`; a parser MUST NOT substitute `default`, so `count_null` and null-based validation see the data as authored.

In generated DDL, `default` emits as `DEFAULT <value>` (with `required=1` → `NOT NULL DEFAULT <value>`) — what the target database fills for missing values on insert.

A column MAY carry `default` while its data still contains nulls; a validator SHOULD warn `default_with_nulls` in that case (advisory, never fatal).

### Constraints

| Field            | Requirement | Description                    |
| ---------------- | ----------- | ------------------------------ |
| `min`            | MAY         | Minimum value (numeric / date) |
| `max`            | MAY         | Maximum value (numeric / date) |
| `len_min`        | MAY         | Minimum string length          |
| `len_max`        | MAY         | Maximum string length          |
| `enum`           | MAY         | Pipe-separated list of allowed non-null values (see [Enumerations](#enumerations)) |
| `pattern`        | MAY         | Regex pattern for validation (default dialect: ECMAScript) |
| `regexp_dialect` | MAY         | Regex dialect for `pattern`: `ecmascript` (default), `pcre`, `posix_ere`, `re2` |

### Keys

| Field    | Requirement | Description                     |
| -------- | ----------- | ------------------------------- |
| `unique` | MAY         | `1` = all values must be unique |

`unique=1` is a descriptive uniqueness hint, not an enforced constraint. ExCSV has no primary-key / foreign-key construct in the descriptive layer: express keys, composite keys, and referential constraints in the SQL layer as ordered `#$ddl` statements (`ALTER TABLE … ADD CONSTRAINT …`). See [SQL companions › Keys & constraints](sql.md#keys--constraints).

### Semantics

| Field       | Requirement | Description                                  |
| ----------- | ----------- | -------------------------------------------- |
| `order`     | MAY         | `none`, `asc`, or `desc`                     |
| `unit`      | MAY         | Unit of measurement (e.g. `USD`, `kg`, `ms`) |
| `separator` | MAY         | Sub-field separator within the value         |
| `role`      | MAY         | Analytical role: `id`, `dimension`, `measure`, `time` (see [Analytical role](#analytical-role)) |
| `agg`       | MAY         | Default aggregation hint for `role=measure`: `sum`, `avg`, `min`, `max`, `none` |

### Positional

| Field   | Requirement            | Description                |
| ------- | ---------------------- | -------------------------- |
| `index` | **MUST** if `header=0` | Zero-based column position |

## Enumerations

`enum` lists the closed set of allowed **non-null** values for a column, pipe-separated (`|`):

```
#column name=status type=string enum=pending|completed|cancelled
```

- Values are interpreted according to the column's `type` (e.g. `type=int enum=1|2|3`), not always as strings.
- `enum` constrains non-null values only. Nullability is governed by `required` and the file's `null` rules — null is allowed in addition to the listed values when the column is nullable.
- Quoting follows the header-line rules. A value containing a space requires quoting the whole attribute: `enum="pending|in progress|done"`. Enum values themselves **MUST NOT** contain `|` (there is no escape mechanism).
- If `separator` is also set (multi-value cell), `enum` applies to each sub-value independently.
- If `pattern` is also set, a value **MUST** satisfy both (logical AND).
- A non-null value outside the listed set is a validation error.

## Analytical role

`role` describes the **analytical** role of a column, independent of `type` (the physical/storage type). It is advisory and not validated.

```
#column name=order_id   type=int      role=id
#column name=status     type=string   role=dimension
#column name=amount     type=decimal  role=measure agg=sum
#column name=balance    type=decimal  role=measure agg=avg
#column name=created_at type=datetime role=time
```

| `role`      | Meaning                                       | Typical operations            |
| ----------- | --------------------------------------------- | ----------------------------- |
| `id`        | Identifier of a row/entity; not for arithmetic | count, distinct, join key     |
| `dimension` | Categorical / grouping attribute               | group by, filter, count distinct |
| `measure`   | Numeric fact to aggregate                      | sum, avg, min, max            |
| `time`      | Temporal axis                                  | group by period, range, trend |

`role` is distinct from `order` (which describes whether the data is sorted) and from `type` (the physical type). Unknown `role` values are treated like any other unknown attribute value.

### Aggregation hint (`agg`)

`agg` is a **hint** (not a constraint) for `role=measure`, declaring how the measure should aggregate (its additivity):

| `agg`       | Additivity                                            | Example                  |
| ----------- | ----------------------------------------------------- | ------------------------ |
| `sum`       | Additive — sums across any dimension                  | revenue, quantity        |
| `avg`       | Semi-additive — must not be summed across time        | balance, price, temperature |
| `min` / `max` | Aggregates only by extremum                         | high/low quotes          |
| `none`      | Non-additive — not aggregated as a number             | ratio, percentage, rating |

The default aggregation for a `measure` without `agg` is `sum`. `agg` carries no validation; it guides a consumer's default aggregation choice — notably to avoid summing semi-additive values across time. `agg` on a non-`measure` column is ignored.

## Unknown Attributes

- Unknown attributes **MUST** be ignored by parsers.
- Custom attributes **SHOULD** use the prefix `x-` (e.g. `x-source=erp`).

## Computed columns (`formula=`)

A `#column` MAY carry `formula=` to declare a **computed column**: a column whose value is derived from other columns rather than stored as independent data. `formula=` is the column's definition and is **never** dropped, whether or not the column is currently materialized.

```
#column name=total     type=decimal formula="price * quantity"
#column name=margin    type=decimal formula="(price - cost) / price"
#column name=full_name type=string  formula="concat(first_name, ' ', last_name)"
```

| Field | Requirement | Description |
| --- | --- | --- |
| `formula` | MAY | Defines a computed column — see [Formula language](#formula-language) |
| `materialized` | MAY | `1` = the computed value is also cached as real, stored data. Absent or `0` = virtual (default) |

### Virtual vs materialized

| | Virtual (`materialized` absent/`0`) | Materialized (`materialized=1`) |
| --- | --- | --- |
| Values in the data | none | present — a real field in each row (or `.col` in [pack](pack.md)) |
| Storage cost | zero | full column, same as any stored column |
| `formula=` | kept | kept |
| Position | none — no header cell, no data field | wherever the materialize operation placed it |
| DDL, freshly generated from `#column` | `GENERATED ALWAYS AS (…) VIRTUAL` (ClickHouse: `ALIAS`) | `GENERATED ALWAYS AS (…) STORED` (ClickHouse: `MATERIALIZED`) — see [SQL § Computed columns in DDL](sql.md#computed-columns-in-ddl) |

A computed column is virtual by default: pure metadata, with no header cell, no field in any data row, and no pack `.col` file. **Materializing** it (`excsv column materialize <name>`) writes its current values into the data as an ordinary physical column and sets `materialized=1`. **Dematerializing** it (`excsv column dematerialize <name>`) removes that physical data and clears `materialized` back to absent/`0`. Both are reversible tooling operations, not something a reader does implicitly — `formula=` is untouched either way, so cutting a materialized column for space never loses the definition of what the column means.

### Position and `header=`

A computed column, virtual or materialized, **MUST NOT** carry `index=` and is always addressed by `name=`, never by position. Consequently `formula=` **MUST** only be used when `header=1`; a `#column` that sets `formula=` while `header=0` **MUST fail** (`formula_requires_header`). When a virtual column is materialized, its physical position in the row is wherever the materialize operation places it (by default, appended after the last existing column; a tool MAY offer a specific position) — the `#column` line's own place in the meta block SHOULD then be updated to match, for readability, but it is never load-bearing the way `index=` is for a stored column under `header=0`.

### Formula language

`formula=` is always written in **one portable expression language** — there is no dialect selector. This is deliberate: `formula=` exists so a tool (`excsv-cli` or any conforming implementation) can actually **evaluate** it against a row's other columns to materialize the result — the whole point of a computed column is that the tool computes it from data already in the file. A language a parser can't evaluate (arbitrary target-SQL syntax, say) couldn't be materialized by anything but a live database, which defeats that purpose — see [SQL companions](sql.md#tooling): "ExCSV tools do not run SQL against a database." So the grammar is fixed and simple enough that every conforming tool implements it:

- Operands: bare stored-column names, number literals, `'string'` literals, `true` / `false`, `null`.
- Operators: `+ - * / %`, unary `-`, comparisons `= <> < <= > >=`, `and or not`, parentheses.
- No `||` — use `concat(...)`.
- Function whitelist: `abs round floor ceil coalesce nullif least greatest length lower upper trim substr concat`.
- `case when … then … [else …] end`.

A vendor-specific `GENERATED` column (a window function, a PostGIS/ClickHouse-only function, anything this grammar can't express) is not a `formula=` at all — write it directly as an ordinary `#$ddl-<dialect>` statement instead. See [SQL § Computed columns in DDL](sql.md#computed-columns-in-ddl).

### Dependencies

A `formula=` **MUST** reference only **stored** columns — plain columns without their own `formula=` — never another computed column (no chaining):

| Condition | Code | Severity |
| --- | --- | --- |
| Formula references another computed column | `formula_references_computed` | FAIL |
| Formula references an unknown column name | `formula_unknown_reference` | FAIL |
| Formula does not parse under the grammar | `formula_parse_error` | FAIL |
| `index=` present on a `formula=` column | `formula_index_forbidden` | FAIL |
| `formula=` column present while `header=0` | `formula_requires_header` | FAIL |
| `materialized=1` without matching physical data, or physical data present while `materialized` is absent/`0` | `computed_materialized_mismatch` | FAIL |
| `default=` or `required=` set on a `formula=` column | `computed_default_ignored` | WARN (ignored either way) |

Full definitions in [Error handling](error-handling.md#computed-columns).

### Arity and aggregation

A **virtual** computed column has no value slot: it is excluded from data-row arity (`data_row_arity_mismatch` counts physical columns only), from `#%` aggregation arity ([Aggregations](aggregations.md)), from a header's declared `columns=` ([Header](header.md#header-fields)), and from pack `columns=` / `.col` files ([Pack](pack.md#manifest-only-meta-lines)). A **materialized** computed column counts as an ordinary physical column everywhere — arity, `#%`, header `columns=`, pack `.col` — exactly like a stored column.

### Staleness

Materialized values are a cache. If a reader can tell the underlying stored columns changed since materialization (e.g. via `checksum=`) without the cached formula output being refreshed, it **SHOULD** warn `computed_stale` — advisory, never fatal, the same posture as `checksum=` itself.

### Materialize / dematerialize by container

`excsv column materialize <name> [FILE] [-o OUT]` and `excsv column dematerialize <name> [FILE] [-o OUT]` are writer operations, not something a reader does implicitly. What they rewrite depends on the shape of `FILE`:

- **Plain, inline** (`.excsv`/`.extsv`, header + data in one file). Rewritten in place (or to `-o`). `materialize` appends the computed values as a new field in every row — by default at the end, or at a position the caller requests — adds the matching header cell if `header=1`, and sets `materialized=1` on the `#column` line. `dematerialize` reverses this: drop the field from every row and the header row, clear `materialized`. Either way `rows=` is unaffected (**MUST** stay accurate throughout, since it's required regardless); if the header declares `columns=`, it **MUST** be incremented (materialize) or decremented (dematerialize) to match the new physical width, or dropped rather than left stale. `checksum=`, if set, **MUST** be recomputed, since the data section changed.
- **Sidecar** (header + meta only, `reference=`). The referenced CSV/TSV **MUST NOT** be modified — that is the sidecar's whole reason to exist, and a sidecar can never itself gain a data section (`sidecar_has_data_section` is a FAIL condition; see [File structure § Sidecar](file-structure.md#sidecar-detached-metadata)). There is no in-place materialize for a sidecar: `materialize` **MUST** write a new **inline** file (`-o` required, or a tool-chosen default name distinct from both the sidecar and its reference) carrying the sidecar's meta lines, the referenced rows, and the new materialized column. `reference=` **MUST NOT** appear in the output (it is now inline, not a sidecar); `rows=` carries over unchanged (same rows, one more field each — still **MUST** be present); a declared `columns=` is bumped the same way as the plain case. `checksum=` **MUST** be recomputed if present — the data section is no longer byte-identical to the sidecar's referenced file, since it now includes the materialized column. The original sidecar and the file it describes are left byte-identical.
- **ZIP, inline primary** (`.excsv.zip`). Unzipped, the inner file is rewritten exactly as the plain inline case (data, header cell, `materialized=1`, `rows=`, `columns=` if declared, `original-size=`, `checksum=`), then re-zipped; the ZIP comment is regenerated from the new header ([ZIP § ZIP Comment](zip.md#zip-comment-summary)).
- **ZIP, sidecar primary**. Same rule as the filesystem sidecar case: the bundled referenced entry is never rewritten. `materialize` produces a new inline artifact (`.excsv` or `.excsv.zip`); it never turns the archive's sidecar entry into an inline one in place.
- **Pack**. `materialize` adds an ordinary `.col` file (one per section, if `section-size=` is set) to the table's directory, sets `materialized=1` on that table's `_header.excsv`, and increments that table's `columns=`; the table's and the manifest's `original-size=` are recomputed as their sums ([Pack § Manifest header fields](pack.md#manifest-header-fields)). `dematerialize` removes the `.col` file(s), decrements `columns=`, clears `materialized`, and recomputes `original-size=` at both levels. Column position follows the same append-by-default rule as plain files.

The invariant that survives every shape: a sidecar's referenced file is never rewritten by a column operation, in or out of a ZIP. Every other shape supports genuine in-place materialize/dematerialize, because none of them carries an "untouchable original" to protect.

### `#$ddl` is not touched

`materialize` and `dematerialize` never edit `#$ddl`. If the file already ships DDL — a `CREATE TABLE` written before the computed column existed, say — that DDL doesn't know about a column added (or removed) by a later materialize/dematerialize, exactly as it wouldn't know about any other manual change to the `#column` set: `#$ddl` is opaque text ([SQL companions](sql.md#tooling)), never structurally validated against `#column`. Keeping it in sync is the author's responsibility. A validator **MAY** warn `ddl_column_mismatch` if it can determine the two disagree — detecting this requires parsing the DDL text, which a conforming parser is **not** required to do, so this is best-effort, never guaranteed. Tooling **SHOULD** at least surface a note at materialize/dematerialize time when the file carries `#$ddl` it didn't touch.
