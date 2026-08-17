# Column Schema (`#column`)

Column annotations are OPTIONAL. A file without any `#column` lines is valid (schema-less mode). Partial coverage is valid — not every column needs a `#column` line. Missing columns have no schema (user's responsibility).

A column SHOULD have at most one `#column` line. Duplicate `#column` lines for the same column (same `name`, or same `index` when `header=0`) are NOT a parse error: the parser MUST warn (`duplicate_column`) and apply **last-wins** — the final `#column` line for that column fully replaces earlier ones (no per-attribute merge). This mirrors `#@` duplicate handling.

Same key=value parsing as header line (split first `=`, quoting rules apply).

## Required attributes

- `header=1`: `name` is REQUIRED. Header cell MUST match `name`. `title` is display-only metadata and does NOT participate in header validation.
- `header=0`: `index` is REQUIRED (zero-based position). `name` is OPTIONAL.

## ALL attributes

```
IDENTITY:
  name         MUST if header=1, MAY if header=0    column identifier, no spaces, regex [A-Za-z_][A-Za-z0-9_-]*
  title        MAY       human-readable display name (quote if spaces); display-only, not validated against header cell
  description  MAY       free-text (quoted)

TYPE:
  type         SHOULD    one of: string int long float double decimal boolean date time datetime uuid binary
  format       MAY       display/parse format hint

DEFAULT/REQUIRED:
  default      MAY       schema/DDL default; NOT applied on read (see below)
  required     MAY       "1"=not null, "0"=nullable; if default is also set, the default satisfies the requirement (schema level)

`default` is a SCHEMA attribute, not a read transform. Reading describes data verbatim: an empty field, or a field equal to the file's `null` marker, is null regardless of `default`. Parsers MUST NOT substitute `default`; `count_null` / null checks see data as authored (default never lowers the null count). In DDL, `default` emits as `DEFAULT <value>` (with required=1 → `NOT NULL DEFAULT <value>`) — what the target DB fills on insert, not the current bytes. A column may both hold nulls AND carry `default` (we describe pre-existing files); the generated schema then has no nulls there. Allowed, but SHOULD warn `default_with_nulls` when a `default` column's data contains any null (empty or `null`-marked); resolves once a writer rewrites the null cells to the default. Advisory, never fatal.

CONSTRAINTS:
  min          MAY       minimum value (numeric/date)
  max          MAY       maximum value (numeric/date)
  len_min      MAY       minimum string length
  len_max      MAY       maximum string length
  enum         MAY       pipe-separated list of allowed non-null values (see ENUM)
  pattern      MAY       regex for validation (default dialect: ECMAScript)
  regexp_dialect MAY      regex dialect for pattern: "ecmascript" (default), "pcre", "posix_ere", "re2"

KEYS:
  unique       MAY       "1"=all values must be unique (DESCRIPTIVE hint about the data, not a DB constraint)

No primary-key / foreign-key construct in the descriptive layer. Express keys, composite keys, and FKs in the SQL layer as ordered `#$ddl` (`ALTER TABLE … ADD CONSTRAINT …`). See sql.md "Keys & constraints".

SEMANTICS:
  order        MAY       "none" | "asc" | "desc"
  unit         MAY       unit of measurement (USD, kg, ms, ...)
  separator    MAY       sub-field separator within cell value
  role         MAY       analytical role: "id" | "dimension" | "measure" | "time" (see ROLE)
  agg          MAY       default aggregation hint for role=measure: "sum" | "avg" | "min" | "max" | "none"

POSITIONAL:
  index        MUST if header=0    zero-based column position

CUSTOM:
  x-*          MAY       custom attributes prefixed with x-
```

Unknown attributes: MUST be ignored by parsers.

## Type details

```
string    text in file encoding
int       32-bit signed integer
long      64-bit signed integer
float     32-bit IEEE 754
double    64-bit IEEE 754
decimal   arbitrary-precision decimal
boolean   canonical forms: true, false, 1, 0
date      YYYY-MM-DD (ISO 8601)
time      HH:MM:SS (ISO 8601)
datetime  ISO 8601 datetime
uuid      textual UUID representation
binary    base64-encoded
```

## ENUM

`enum` lists the closed set of allowed **non-null** values for a column, pipe-separated (`|`):

```
#column name=status type=string enum=pending|completed|cancelled
```

- Values are interpreted per the column's `type` (e.g. `type=int enum=1|2|3`), not always as strings.
- `enum` constrains non-null values only. Nullability is governed by `required` / the file's `null` rules — null is allowed in addition to the listed values when the column is nullable.
- Quoting follows the header-line rules (split first `=`, quote whole value if it contains spaces). A value containing a space requires quoting the entire attribute: `enum="pending|in progress|done"`. Enum values themselves MUST NOT contain `|` (no escape mechanism).
- If `separator` is also set (multi-value cell), `enum` applies to each sub-value independently.
- If `pattern` is also set, a value MUST satisfy **both** (logical AND).
- A non-null value outside the listed set is a validation error, consistent with other `#column` constraints.

## ROLE

`role` describes the **analytical** role of a column, orthogonal to `type` (the physical/storage type). It lets a consumer pick correct operations without guessing from column names — e.g. group by dimensions, aggregate measures, never sum identifiers. Purely advisory: no validation.

```
#column name=order_id   type=int      role=id
#column name=status     type=string   role=dimension
#column name=amount     type=decimal  role=measure agg=sum
#column name=balance    type=decimal  role=measure agg=avg
#column name=created_at type=datetime role=time
```

| `role` | Meaning | Typical ops |
| --- | --- | --- |
| `id` | identifier of a row/entity; not for arithmetic | count, distinct, join key |
| `dimension` | categorical / grouping attribute | group by, filter, count_distinct |
| `measure` | numeric fact to aggregate | sum, avg, min, max |
| `time` | temporal axis | group by period, range, trend |

- `role` is orthogonal to `type`: a `measure` is usually numeric but the spec does not bind them.
- `role` is distinct from `order` (`order` = sortedness of the data; `role` = semantics of the column).
- Unknown `role` values are treated as unknown attribute values (ignore, MAY warn).

## `agg` — aggregation hint

`agg` is a **hint** (not a constraint) for `role=measure`, declaring how the measure should aggregate (additivity):

| `agg` | Additivity | Example |
| --- | --- | --- |
| `sum` | additive — sums across any dimension | revenue, quantity |
| `avg` | semi-additive — must not sum across time, may average | balance, price, temperature |
| `min` / `max` | aggregates only by extremum | high/low quotes |
| `none` | non-additive — not aggregated as a number | ratio, percentage, rating |

Default for a `measure` without `agg` is `sum`. `agg` carries no validation; it guides a consumer's default aggregation choice (notably to avoid summing semi-additive values across time). `agg` on a non-`measure` column is ignored (MAY warn).

## header=1 vs header=0

- header=1: first data row is column names. Header cell MUST match `name` (mismatch = validation error). `title` is display-only metadata and is NOT compared against the header cell.
- header=0: no header row in data. Each `#column` MUST have `index=N` (zero-based) to define position. `name` is optional — if omitted, column is referenced by index only.
