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
| `default`  | MAY         | Default value for missing fields                        |
| `required` | MAY         | `1` = field must not be null, `0` = nullable. If `default` is also set, the default satisfies the requirement |

### Constraints

| Field            | Requirement | Description                    |
| ---------------- | ----------- | ------------------------------ |
| `min`            | MAY         | Minimum value (numeric / date) |
| `max`            | MAY         | Maximum value (numeric / date) |
| `len_min`        | MAY         | Minimum string length          |
| `len_max`        | MAY         | Maximum string length          |
| `pattern`        | MAY         | Regex pattern for validation (default dialect: ECMAScript) |
| `regexp_dialect` | MAY         | Regex dialect for `pattern`: `ecmascript` (default), `pcre`, `posix_ere`, `re2` |

### Keys

| Field    | Requirement | Description                     |
| -------- | ----------- | ------------------------------- |
| `unique` | MAY         | `1` = all values must be unique |

### Semantics

| Field       | Requirement | Description                                  |
| ----------- | ----------- | -------------------------------------------- |
| `order`     | MAY         | `none`, `asc`, or `desc`                     |
| `unit`      | MAY         | Unit of measurement (e.g. `USD`, `kg`, `ms`) |
| `separator` | MAY         | Sub-field separator within the value         |

### Positional

| Field   | Requirement            | Description                |
| ------- | ---------------------- | -------------------------- |
| `index` | **MUST** if `header=0` | Zero-based column position |

## Unknown Attributes

- Unknown attributes **MUST** be ignored by parsers.
- Custom attributes **SHOULD** use the prefix `x-` (e.g. `x-source=erp`).
