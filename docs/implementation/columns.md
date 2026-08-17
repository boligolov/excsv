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
