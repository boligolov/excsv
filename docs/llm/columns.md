# Column Schema (`#column`)

Column annotations are OPTIONAL. A file without any `#column` lines is valid (schema-less mode). If present, at most one `#column` line per column. Partial coverage is valid — not every column needs a `#column` line. Missing columns have no schema (user's responsibility).

Same key=value parsing as header line (split first `=`, quoting rules apply).

## Required attributes

- `header=1`: `name` is REQUIRED. If `title` is present, header cell MUST match `title`. Otherwise MUST match `name`.
- `header=0`: `index` is REQUIRED (zero-based position). `name` is OPTIONAL.

## ALL attributes

```
IDENTITY:
  name         MUST if header=1, MAY if header=0    column identifier, no spaces, regex [A-Za-z_][A-Za-z0-9_-]*
  title        MAY       human-readable name (quote if spaces)
  description  MAY       free-text (quoted)

TYPE:
  type         SHOULD    one of: string int long float double decimal boolean date time datetime uuid binary
  format       MAY       display/parse format hint

DEFAULT/REQUIRED:
  default      MAY       default value for missing fields
  required     MAY       "1"=not null, "0"=nullable; if default is also set, the default satisfies the requirement

CONSTRAINTS:
  min          MAY       minimum value (numeric/date)
  max          MAY       maximum value (numeric/date)
  len_min      MAY       minimum string length
  len_max      MAY       maximum string length
  pattern      MAY       regex for validation (default dialect: ECMAScript)
  regexp_dialect MAY      regex dialect for pattern: "ecmascript" (default), "pcre", "posix_ere", "re2"

KEYS:
  unique       MAY       "1"=all values must be unique

SEMANTICS:
  order        MAY       "none" | "asc" | "desc"
  unit         MAY       unit of measurement (USD, kg, ms, ...)
  separator    MAY       sub-field separator within cell value

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

## header=1 vs header=0

- header=1: first data row is column names. If `title` is present, header cell MUST match `title`. Otherwise MUST match `name`. Mismatch = validation error.
- header=0: no header row in data. Each `#column` MUST have `index=N` (zero-based) to define position. `name` is optional — if omitted, column is referenced by index only.
