# ExCSV v0.2 — LLM Reference

## IDENTITY

ExCSV = Extended CSV. Self-describing, line-oriented tabular format. Spec version: 0.2 (Draft). Backward-compatible with CSV/TSV. File extensions: `.excsv`, `.ecsv` (plain); `.excsv.zip`, `.ecsv.zip` (zipped container, see ZIP CONTAINER). MIME types: `text/excsv` (plain), `application/excsv+zip` (zipped). Encoding default: UTF-8. License: CC0 1.0.

## FILE STRUCTURE (strict order)

```
LINE 1:       Header line (zero or one, optional)
LINES 2..N:   Meta lines (zero or more, all start with #)
LINES N+1..:  Data section (standard CSV/TSV rows)
```

An ExCSV document MAY omit the header line. If the header line is missing, the document MUST be interpreted as a minimal ExCSV document with default parameters (`delim=comma`, `quote=none`, `header=1`, `encoding=UTF-8`).

Transition rule: first line NOT starting with `#` begins the data section. All meta lines MUST precede data.

Minimal valid file: an empty file, or `#!excsv version=0.2` (header line only).

Line endings: files MAY use LF or CRLF. Parsers MUST accept both. Parsers MUST ignore UTF-8 BOM (`U+FEFF`) at start of file.

## HEADER LINE

If present, MUST be line 1. MUST start with `#!excsv`. MUST contain `version=`. Format: space-separated `key=value` pairs. Split on FIRST `=` only (values may contain `=`). Unknown keys: ignore.

### Value quoting

- Values without spaces MUST NOT be quoted.
- Values with spaces MUST be wrapped in double quotes (`"`).
- Inside quoted values, double quote MUST be escaped by doubling (`""`).
- No other escape sequences are allowed.

### Header fields

```
version        REQUIRED  "0.1"
delim          DEFAULT "comma"   delimiter name or literal (see DELIMITERS)
quote          DEFAULT "none"    quote name or literal (see QUOTING)
header         DEFAULT "1"       "1"=first data row is header, "0"=no header row
null           OPTIONAL          additional non-empty string representing null. Empty fields are ALWAYS null by default. Use only when a non-empty value also means null (e.g. null=NA, null=\N). null="" is redundant.
rows           OPTIONAL          integer, total data rows excluding header
checksum       OPTIONAL          "<algorithm>:<hex>" over entire data section, including header row if header=1 (LF-normalized)
csvw           OPTIONAL          "inline-json" | "base64url"
encoding       DEFAULT "UTF-8"   character encoding
schema         DEFAULT "excsv"   "excsv" | "csvw" — which schema source wins
sql-dialect    OPTIONAL          default SQL dialect token for unqualified `sql-*` meta keys (see SQL META KEYS). E.g. "mysql", "postgres-15", "clickhouse".
original-size  REQUIRED if zipped  uncompressed byte size of the inner `.excsv` file (decimal integer). See ZIP CONTAINER.
```

### DELIMITERS

Well-known names (check FIRST, then treat as literal):

```
comma     -> ,
tab       -> \t
pipe      -> |
semicolon -> ;
```

If value is not a well-known name, it is used as the literal delimiter.

### QUOTING

Well-known names (check FIRST, then treat as literal):

```
double    -> "   (double quote)
single    -> '   (single quote)
none      -> no quoting (DEFAULT)
```

If value is not a well-known name, treat as the literal quote character. Example: `quote=double` uses `"`, `quote='` uses `'` literally.

## META LINES

All start with `#`. Five recognized kinds by prefix. Unrecognized `#` lines MUST be ignored. Recommended order: `#@` metadata first, then `#column`, then `#csvw`, then `#$` SQL, then `#%` aggregations. Order within each group does not matter except where stated (e.g. `#$ddl` execution order). Parsers MUST accept any order.

### 1. File-level metadata: `#@key: value`

Value is raw text to end of line. One optional space after `:` is skipped (for readability). No quoting, no escaping — taken as-is.

Conventional keys (all optional, unknown keys preserved/ignored):

```
source       origin system/table/file
author       creator name/email
comment      free-text description
created      ISO 8601 timestamp
exported     ISO 8601 timestamp
license      license identifier
tool         generating tool/version
tags         comma-separated tags
```

SQL companions (DDL and DQL) MUST be encoded as `#$` lines, not `#@`. See SQL SECTION.

Each `#@` key is unique per file (last-wins on duplicates). Repeatable, ordered statements (like DDL) belong in `#$`.

### 2. Column annotation: `#column key=value [key=value ...]`

Same key=value parsing as header line (split first `=`, quoting rules apply).

### 3. Aggregation: `#%<name>: val1,val2,...,valN`

One optional space after `:` is skipped. The remaining payload MUST be parsed using the file's CSV dialect (delimiter, quote, escapes), as if it were a single CSV row. Values are positional per column. Count MUST equal column count. Empty field = not applicable/not computed.

### 4. CSVW payload: `#csvw <json-or-base64>`

`#csvw` followed by a space and value to end of line. Valid JSON (decode first if `csvw=base64url` in header). Readers MAY ignore entirely.

### 5. SQL statement: `#$<verb>[-<dialect>[-<version>]]: <payload>`

See SQL SECTION below for full semantics.

## SQL SECTION

A file MAY carry SQL companions to its data: definitional statements that recreate the table/schema (DDL), and informational queries that produced the data (DQL). These are encoded as a dedicated meta kind with the prefix `#$`.

`#$` was chosen because it is a single character (compact) and visually telegraphs "SQL" (`$` evokes shell/query). It is a peer of `#@`, `#column`, `#%`, and `#csvw` — not a sub-namespace of `#@`.

### Key syntax

```
#$<verb>[-<dialect>[-<version>]]: <payload>
```

- `<verb>` is one of:
  - `ddl` — Data Definition Language. Statements that build the schema: `CREATE TABLE`, `CREATE INDEX`, `CREATE VIEW`, `ALTER TABLE`, `GRANT`, seed `INSERT`, etc. **REPEATABLE**. Statements MUST be executed in file order, top → bottom.
  - `dql` — Data Query Language. SELECT statements (typically the query that produced this dataset, or example queries against the recreated schema). **REPEATABLE** but order has no execution semantics — purely informational/provenance.
- `<dialect>` is a lowercase ASCII token from the well-known list below, OR any other lowercase ASCII identifier. Unknown dialects MUST be preserved by parsers.
- `<version>` is a free-form alphanumeric suffix, e.g. `mysql-8`, `postgres-15`, `mssql-2022`, `clickhouse-24`.

Payload format matches `#@`: raw text to end of line, no quoting, no escaping, exactly one optional space skipped after `:`. **A single line carries exactly one statement.** Embedded newlines are NOT supported — splitting on `;` is error-prone (semicolons appear in string literals, comments, dollar-quoted blocks). Use multiple `#$ddl` lines for multi-statement schemas.

If no dialect suffix is present, the key is **unqualified**. Its effective dialect is resolved from the `sql-dialect` header field if set, otherwise it is treated as **ANSI / portable SQL**.

### Well-known dialect tokens

Parsers SHOULD recognize these tokens; other lowercase ASCII tokens MUST be accepted as-is.

```
ansi          ANSI / ISO standard SQL (default for unqualified, no sql-dialect)
mysql         MySQL
mariadb       MariaDB
postgres      PostgreSQL  (alias accepted on read: postgresql, pg)
mssql         Microsoft SQL Server  (alias accepted on read: sqlserver)
sqlite        SQLite
oracle        Oracle Database
db2           IBM Db2
clickhouse    ClickHouse
snowflake     Snowflake
bigquery      Google BigQuery
duckdb        DuckDB
```

The list above is the set parsers SHOULD recognize by name. Any other lowercase ASCII identifier (e.g. `redshift`, `trino`, `cockroachdb`, `bigquery-standard`, in-house engine names) MUST also be accepted as a dialect token — the list is NOT a closed enumeration.

Writers SHOULD use the canonical token (left column) when one exists. Readers MUST treat aliases as equivalent but SHOULD NOT emit aliases.

### Dialect resolution

For each `#$` line, the **effective dialect** is determined as:

1. If the key has an explicit suffix (e.g. `#$ddl-mysql`), the effective dialect is that suffix.
2. Else if the `#!excsv` header sets `sql-dialect=X`, the effective dialect is `X`.
3. Else the effective dialect is `ansi` (portable SQL).

When a consumer wants to apply SQL for a target dialect `D` (e.g. setting up a MySQL database from the file):

1. **Exact match**: lines whose effective dialect equals `D`.
2. **Family match**: if `D` is versioned (`<family>-<version>`) and the line's effective dialect equals `<family>` (or vice versa), it is a match (with a warning is permitted).
3. **No match**: skip the line. If NO line matches `D` for a given verb, implementations MAY warn ("no DDL available for target dialect").

### `#$ddl` execution order

When applying DDL to a target dialect `D`:

- Iterate **all `#$ddl` lines in file order**.
- For each line, compute its effective dialect (rules above).
- If effective dialect matches `D` → execute the statement.
- Else → skip.

This means dialect-specific and portable DDL can be interleaved in the file; only the lines whose effective dialect matches the target are executed, but their relative order is preserved.

Example: in a file with `sql-dialect=mysql`:

```
#$ddl: CREATE TABLE foo (id INT PRIMARY KEY)         -- effective dialect = mysql
#$ddl-postgres: CREATE TABLE foo (id BIGSERIAL PK)   -- effective dialect = postgres
#$ddl: CREATE INDEX foo_idx ON foo(id)               -- effective dialect = mysql
#$ddl-mysql: ALTER TABLE foo ROW_FORMAT=DYNAMIC      -- effective dialect = mysql
```

Applying to MySQL executes lines 1, 3, 4 (in that order). Applying to Postgres executes only line 2. Applying to ClickHouse executes nothing (no matching lines).

### `#$dql` semantics

DQL lines are informational provenance: they document the query that produced the data, or example queries against the recreated schema. They are NOT executed automatically by ExCSV tools. Consumers MAY display them, copy them to clipboard, or pass them to a SQL client.

Multiple `#$dql` lines MAY appear; all are preserved. Order has no execution meaning. Dialect resolution works the same as for `ddl`.

### Examples

Single-dialect DDL with `sql-dialect` header:

```
#!excsv version=0.2 sql-dialect=mysql
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: GRANT SELECT ON orders TO readonly
#$dql: SELECT * FROM orders WHERE amount > 100
```

Multi-dialect DDL side-by-side:

```
#!excsv version=0.2
#$ddl: CREATE TABLE orders (id INTEGER PRIMARY KEY, amount DECIMAL(8,2))
  ^ effective dialect = ansi (no header, no suffix)
#$ddl-mysql: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))
#$ddl-clickhouse: CREATE TABLE orders (id UInt64, amount Decimal(8,2)) ENGINE = MergeTree() ORDER BY id
#$dql-postgres: WITH base AS (SELECT * FROM orders WHERE amount > 0) SELECT * FROM base
```

Multi-statement DDL execution order:

```
#!excsv version=0.2 sql-dialect=postgres
#$ddl: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, email VARCHAR(254) NOT NULL)
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: CREATE INDEX orders_email_lower ON orders(LOWER(email))
#$ddl: GRANT SELECT ON orders TO readonly
#$ddl-postgres: ALTER TABLE orders SET (autovacuum_enabled = false)
  ^ apply to postgres: execute all 5 statements in order
  ^ apply to mysql:    execute nothing (no matching lines; warn)
```

## COLUMN SCHEMA

Column annotations are OPTIONAL. A file without any `#column` lines is valid (schema-less mode). If present, at most one `#column` line per column. Partial coverage is valid — not every column needs a `#column` line. Missing columns have no schema (user's responsibility).

### Required attributes

- `header=1`: `name` is REQUIRED. If `title` is present, header cell MUST match `title`. Otherwise MUST match `name`.
- `header=0`: `index` is REQUIRED (zero-based position). `name` is OPTIONAL.

### ALL attributes

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

### Type details

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

### header=1 vs header=0

- header=1: first data row is column names. If `title` is present, header cell MUST match `title`. Otherwise MUST match `name`. Mismatch = validation error.
- header=0: no header row in data. Each `#column` MUST have `index=N` (zero-based) to define position. `name` is optional — if omitted, column is referenced by index only.

## AGGREGATIONS

Standard aggregation names:

```
UNIVERSAL (any type):
  count_nonnull    count of non-null values
  count_null       count of null values
  count_distinct   count of distinct values

NUMERIC (int, long, float, double, decimal):
  sum              sum
  avg              arithmetic mean
  min              minimum
  max              maximum

STRING (string):
  len_min           shortest string length
  len_max           longest string length
```

Null handling (SQL semantics): `sum`, `avg`, `min`, `max`, `len_min`, `len_max` exclude nulls. `count_nonnull` counts non-nulls. `count_null` counts nulls. `count_distinct` counts distinct non-null values only.

Aggregation line order does not matter. `#%max` may appear before `#%sum`.

Aggregations MUST be parsed using the resolved CSV dialect. If header is absent, default dialect MUST be used.

Type compatibility SHOULD be validated. Invalid combos MAY produce warning.

## DATA SECTION

- Data rows follow the CSV dialect defined in the header (`delim`, `quote`).
- Quoted values MUST NOT contain raw newlines. All values are single-line.
- If the first field of the first data row begins with `#` (unquoted), it is ambiguous with meta lines. To avoid this: if quoting is enabled, the value MUST be quoted. If quoting is disabled (`quote=none`), the first field MUST NOT start with `#`. Note: `#` itself MAY be used as the quote character (e.g. `quote=#`), which resolves the ambiguity.
- If `quote=none`, values MUST NOT contain delimiter characters.
- Trailing newline after the last data row is OPTIONAL. If present, it is included in checksum computation.

## CHECKSUM

Header field: `checksum=<algorithm>:<hex-digest>`. Scope: entire data section (after last meta line), including the header row if `header=1` and the trailing newline if present. Normalize newlines to LF before computing.

## CSVW

`csvw=inline-json` or `csvw=base64url` in header. Payload in `#csvw ...` meta line. Schema precedence controlled by `schema=excsv|csvw` header field (default excsv).

## ZIP CONTAINER

An ExCSV document MAY be shipped inside a standard ZIP archive with the extension `.excsv.zip` (or `.ecsv.zip`). This is a **container format**, not a new dialect — the inner file is a valid ExCSV document with the same structure as any other.

### File naming

The archive MUST contain at least one entry whose name ends in `.excsv` or `.ecsv`. This is the **primary** ExCSV file. The primary file MUST be:

- The **first** entry in the central directory, AND
- Named either:
  - The archive's base name with `.zip` stripped (e.g. `sales.excsv.zip` → `sales.excsv`), OR
  - `data.excsv` if no such match.

Additional entries (auxiliary data, schemas, attachments) MAY appear after the primary file. Readers MUST locate the primary by the rule above and ignore other entries unless they understand them.

### Compression

The primary entry SHOULD use Deflate (method 8). Store (method 0), Deflate64 (method 9), BZIP2 (method 12), LZMA (method 14), and Zstandard (method 93) MAY be used. Other methods SHOULD be rejected. Encrypted archives are NOT specified in v0.2.

ZIP64 extensions MUST be supported by parsers (large files exceeding 4 GiB).

### Required inner header field

The inner `.excsv` file's `#!excsv` header MUST include:

```
original-size=<bytes>   uncompressed byte size of the inner .excsv file (decimal integer)
```

This value MUST match the `uncompressed_size` field recorded in the ZIP central directory entry for the primary file. A mismatch MUST be reported as a validation error.

For semantic content integrity use the `checksum=` header field (see CHECKSUM). It covers the data section and survives re-compression or re-archiving. `checksum=` SHOULD be set for zipped files when semantic integrity matters.

### ZIP comment (summary section)

The ZIP **end-of-central-directory comment** field (max 65535 bytes per ZIP spec) MUST carry a textual summary of the inner ExCSV file, so consumers can read metadata WITHOUT extracting the archive.

The comment MUST be UTF-8 encoded. It MUST be a valid prefix of an ExCSV file — i.e. it MUST begin with `#!excsv ...` and consist solely of header + `#` lines.

#### Required content (in this order, MUST fit)

1. `#!excsv` header line — MUST be present, MUST include `original-size=` exactly matching the inner file's header line.

#### Recommended content (in priority order, SHOULD fit until budget exhausted)

2. `#@source`, `#@author`, `#@created`, `#@exported`, `#@license`, `#@tool` (concise provenance)
3. All `#column` lines (column schema — essential for schema-aware consumers)
4. All `#$ddl` and `#$ddl-<dialect>` lines (schema-as-SQL, for DB import without extraction). Preserve file order.
5. All `#%` aggregation lines (summary statistics)
6. `#@comment`, `#@tags` (descriptive metadata)
7. Remaining `#@` entries (any custom keys)
8. All `#$dql` and `#$dql-<dialect>` lines (provenance queries)
9. `#csvw` payload (last — usually the largest)

Writers MUST add lines in priority order, stopping when the next line would exceed the 65535-byte budget. The comment MUST end at a complete line boundary.

If any content was omitted, the writer MUST append a final marker line:

```
#@comment-truncated: 1
```

This is the LAST line in the comment when truncation occurred. Its presence signals "the comment is a partial summary; extract the inner file to see everything."

#### Comment validation

Readers MUST treat the comment as advisory:

- The comment is for fast preview / indexing without extraction. The authoritative source is always the inner `.excsv` file.
- If the comment's `#!excsv` line disagrees with the inner file's `#!excsv` line (other than truncation), the inner file wins. Implementations MAY warn.

### Reading a `.excsv.zip` (algorithm)

```
1. Open archive. Read central directory.
2. Locate primary entry by naming rule (first entry ending in .excsv/.ecsv, name matches archive base or is "data.excsv").
3. (Optional fast path) Read end-of-central-directory comment. Parse as ExCSV prefix. Use for metadata-only queries.
4. (Full read) Extract primary entry into memory or stream.
5. Parse extracted content as ExCSV (PARSING ALGORITHM).
6. Validate: inner #!excsv `original-size` MUST equal ZIP central dir uncompressed size.
```

### Writing a `.excsv.zip` (algorithm)

```
1. Serialize the ExCSV document to bytes (SERIALIZATION ALGORITHM) WITHOUT `original-size` in the header.
2. Compute byte length → set `original-size`. Re-serialize the header line with this field added (rest of file unchanged). Re-measure once: if adding `original-size=<N>` to the header changed the byte count, recompute and re-patch. Two passes converge because the field width is bounded.
3. Create ZIP archive with one entry, name = "<base>.excsv", compression = deflate, store the bytes from step 2.
4. Build the ZIP comment:
   a. Start with the inner file's #!excsv line.
   b. Append #@/#column/#%/etc. lines in the priority order above, one per line, while staying under 65535 bytes.
   c. If anything was omitted, append "#@comment-truncated: 1" as the final line.
5. Write the ZIP with the comment, finalize.
```

### Example

```
sales.excsv.zip
└── sales.excsv          (compressed deflate, 7,432 bytes; uncompressed 18,204 bytes)

ZIP comment (4,128 bytes):
#!excsv version=0.2 delim=comma quote=double header=1 encoding=UTF-8 rows=4 schema=excsv checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924... original-size=18204 sql-dialect=postgres-15
#@source: sales_db.orders
#@author: author@example.com
#@created: 2026-01-01T00:00:00Z
#@exported: 2026-03-24T12:00:00Z
#@license: CC-BY-4.0
#@tool: excsv-cli/0.1.0
#column name=id type=int unique=1
#column name=customer type=string required=1
#column name=email type=string required=1
#column name=amount type=decimal min=0 max=999999.99
#$ddl: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL, amount NUMERIC(8,2))
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#%count_nonnull: 4,4,4,4
#%sum: ,,,1050.50
#@comment-truncated: 1
```

The inner `sales.excsv` (uncompressed):

```
#!excsv version=0.2 delim=comma quote=double header=1 encoding=UTF-8 rows=4 schema=excsv checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924... original-size=18204 sql-dialect=postgres-15
... full file: all #@ / #column / #% / #csvw lines, then data section ...
```

## ERROR HANDLING

```
MUST fail:
  - malformed #!excsv header line (if present)
  - malformed key=value in header
  - column count mismatch in aggregation rows
  - zipped file with missing `original-size` header field
  - zipped file where inner uncompressed size does not match header `original-size`
  - zipped file where comment is not a valid ExCSV prefix (does not start with #!excsv)
  - #$ line missing the `:` separator
  - #$ line whose payload contains an embedded newline

SHOULD warn:
  - unknown column attributes
  - aggregation type incompatible with column type
  - unknown SQL dialect token
  - #$ verb other than `ddl` or `dql`
  - zip comment disagrees with inner file's #!excsv header (other than truncation marker)
  - no #$ line matches the consumer's target dialect (no DDL/DQL available)
  - family/version mismatch when matching an unversioned line to a versioned target dialect (or vice versa)
```

## PARSING ALGORITHM (pseudocode)

```
0. If file is a ZIP container (magic bytes "PK\x03\x04" or .excsv.zip extension):
   a. Locate primary entry per ZIP CONTAINER rules.
   b. Extract bytes.
   c. Continue parsing the extracted bytes as a normal ExCSV file from step 1.
   d. After step 9, verify ZIP central dir uncompressed_size == header `original-size`. Mismatch is a MUST-fail error.
1. Read line 1. If starts with "#!excsv": parse space-separated key=value pairs (split on first "="), store as header_fields. If line 1 does NOT start with "#!excsv": use defaults (delim=comma, quote=double, header=1, encoding=UTF-8), rewind line 1 for meta/data parsing.
2. Resolve delimiter: lookup delim in {comma:",", tab:"\t", pipe:"|", semicolon:";"}. If no match, use literal value. If delim absent, default comma.
3. Read subsequent lines while line starts with "#":
   a. "#column " -> parse key=value pairs, store as column definition (ordered list)
   b. "#%" -> extract name after "#%" and before ":", split remainder by delimiter, store as aggregation[name] = values[]
   c. "#csvw " -> store remainder as csvw_payload
   d. "#$" -> extract key (between "#$" and ":"), value (after ": "). Key is `<verb>[-<dialect>[-<version>]]` where verb ∈ {ddl, dql}. APPEND to an ordered list of SQL entries (preserve file order). Verbs other than ddl/dql MUST be preserved but MAY produce a warning.
   e. "#@" -> extract key (between "#@" and ":"), value (after ": "), store as metadata[key] = value (last-wins on duplicates).
   f. Other "#" lines -> ignore
4. First non-"#" line begins data section.
5. If header=1: first data line is column names. Validate against #column name attributes if present.
6. Parse remaining lines as CSV using resolved delimiter and quote character.
7. If checksum present: normalize data section newlines to LF, compute digest, compare.
8. If aggregations present: validate value count equals column count.
9. If file was zipped (step 0): verify `original-size` header field equals the ZIP central directory uncompressed size for the primary entry.
```

## SERIALIZATION ALGORITHM (pseudocode)

```
1. Write "#!excsv" + header fields in canonical order: version, delim, quote, header, encoding, null, rows, checksum, schema, csvw, sql-dialect, original-size. Omit fields with default values. Omit `original-size` for plain (non-zipped) files. Quote values containing spaces.
2. Write file-level metadata as "#@key: value" lines (one per unique key).
3. Write "#column name=X type=Y ..." for each column in order.
4. Write "#$<verb>[-<dialect>]: <statement>" lines preserving the file's original insertion order. Multiple entries with the same key are allowed and MUST be emitted in order.
5. If csvw payload: write "#csvw <json>".
6. Write "#%<name>: v1,v2,...,vN" for each aggregation. Use file delimiter. Empty string for non-applicable.
7. If header=1: write column names as first data row, delimited.
8. Write data rows, delimited and quoted per CSV rules.
9. (Zipped output only) After steps 1–8 produce the inner bytes:
   a. Compute byte length → set `original-size`. Re-emit the header line with this field included; if adding the field changed the byte count, recompute and re-patch (two passes converge).
   b. Create ZIP archive with the inner file as primary entry.
   c. Build the end-of-central-directory comment per ZIP CONTAINER priority list, staying under 65535 bytes. Append `#@comment-truncated: 1` as a final line if anything was omitted.
```

## QUICK-REFERENCE EXAMPLES

### Minimal (header only)
```
#!excsv version=0.2
```

### Schema-less (no #column lines)
```
#!excsv version=0.2 delim=comma header=1
name,age,city
Alice,30,NYC
Bob,25,LA
```

### header=0 with index
```
#!excsv version=0.2 delim=tab header=0
#column index=0 name=id type=int
#column index=1 name=value type=decimal
1	99.50
2	200.00
```

### quote=none (no quoting)
```
#!excsv version=0.2 delim=pipe header=1 quote=none
name|score|grade
Alice|95|A
Bob|87|B+
```

### null (default: empty field = null)
```
#!excsv version=0.2 delim=comma header=1
name,email
Alice,
Bob,bob@test.com
  ^ email for Alice is null (empty field is always null by default)
```

### null=NA (non-empty null marker)
```
#!excsv version=0.2 delim=comma header=1 null=NA
name,email
Alice,NA
Bob,bob@test.com
  ^ email for Alice is null (both empty fields and "NA" are null)
```

### Quote doubling (both header and data)
```
#!excsv version=0.2 delim=comma quote=double header=1
#column name=name type=string
#column name=note type=string description="contains ""special"" chars"
  ^ "" in header value produces literal "
name,note
Alice,"She said ""hello"" to everyone"
Bob,"Line1, then more"
  ^ "" in data field produces literal " — same doubling rule everywhere
```

### SQL section: multi-dialect DDL and DQL
```
#!excsv version=0.2 delim=comma header=1
#$ddl: CREATE TABLE products (id INTEGER PRIMARY KEY, name VARCHAR(100), price DECIMAL(8,2))
  ^ unqualified → effective dialect = ansi (no sql-dialect header)
#$ddl-mysql: CREATE TABLE products (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100), price DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-mysql: CREATE INDEX products_name_idx ON products(name)
#$ddl-mysql: ALTER TABLE products ROW_FORMAT=DYNAMIC
  ^ three statements; execute in order when target = mysql
#$ddl-clickhouse: CREATE TABLE products (id UInt64, name String, price Decimal(8,2)) ENGINE=MergeTree() ORDER BY id
#$dql: SELECT * FROM products WHERE price > 10
#$dql-postgres: WITH base AS (SELECT * FROM products WHERE price > 0) SELECT * FROM base
id,name,price
1,Widget,9.99
2,Gadget,19.95
```

### sql-dialect header (avoid suffixing every line)
```
#!excsv version=0.2 delim=comma header=1 sql-dialect=postgres-15
#$ddl: CREATE TABLE events (id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ, payload JSONB)
#$ddl: CREATE INDEX events_ts_brin ON events USING BRIN(ts)
#$ddl: GRANT SELECT ON events TO readonly
#$dql: SELECT * FROM events WHERE ts >= NOW() - INTERVAL '24 hours'
  ^ all #$ lines have effective dialect = postgres-15 (from header)
id,ts,payload
1,2026-04-01T00:00:00Z,{}
```

### Zipped (.excsv.zip) — inner file header
```
#!excsv version=0.2 delim=comma quote=double header=1 rows=1000 checksum=sha256:e3b0c442... original-size=204800
  ^ original-size is REQUIRED in zipped files; it MUST match the ZIP central dir uncompressed_size.
```

## CANONICAL EXAMPLE (annotated)

```
#!excsv version=0.2 delim=comma quote=double header=1 encoding=UTF-8 rows=4 schema=excsv checksum=sha256:a1b2c3d4e5f6 sql-dialect=mysql
  ^ header line: version=0.2, delimiter is comma, quote is double ("), first data row is header, empty fields are null (default), 4 data rows, excsv schema wins, checksum provided, default SQL dialect = mysql
#@author: author@example.com
#@source: sales_db.orders
#@comment: Quarterly sales export with all column features demonstrated
#@created: 2026-01-01T00:00:00Z
#@exported: 2026-03-24T12:00:00Z
#@license: CC-BY-4.0
#@tool: excsv-cli/0.1.0
#@tags: sales,Q1,2026,demo
  ^ file-level metadata key-value pairs
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL, amount DECIMAL(8,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', tags TEXT, created_at TIMESTAMP, note TEXT) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: CREATE INDEX orders_status_idx ON orders(status)
#$ddl: GRANT SELECT ON orders TO readonly
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, amount NUMERIC(8,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', tags TEXT, created_at TIMESTAMPTZ, note TEXT)
#$dql: SELECT * FROM orders WHERE quarter = 'Q1'
  ^ SQL companions: 4 mysql DDL statements (execute in order), 1 postgres alternative DDL, 1 informational query
#column name=id type=int unique=1 title="Order ID" description="Auto-incremented order identifier"
#column name=customer type=string required=1 len_min=1 len_max=100 title="Customer Name"
#column name=email type=string required=1 len_max=254 pattern=^[^@]+@[^@]+$
#column name=amount type=decimal format=0.00 unit=USD min=0 max=999999.99 default=0.00 order=desc
#column name=status type=string default=pending
#column name=tags type=string separator=| title="Order Tags"
#column name=created_at type=datetime title="Created At" description="UTC timestamp of order creation"
#column name=note type=string x-ui-widget=textarea
  ^ 8 column definitions in order
#%count_nonnull: 4,4,4,4,4,3,4,2
#%count_null: 0,0,0,0,0,1,0,2
#%count_distinct: 4,3,3,4,2,3,4,2
#%sum: ,,,1050.50,,,,
#%avg: ,,,262.625,,,,
#%min: ,,,50.00,,,,
#%max: ,,,500.00,,,,
#%len_min: ,,15,,,6,,20
#%len_max: ,,18,,,16,,21
  ^ aggregation rows, positional per column, empty=not applicable
id,customer,email,amount,status,tags,created_at,note
  ^ data header row (header=1)
1,Acme Corp,acme@example.com,500.00,completed,urgent|wholesale,2026-01-15T09:30:00Z,Large wholesale order
2,Globex Inc,globex@example.com,300.50,completed,retail,2026-02-20T14:00:00Z,"Paid in full, net-30"
3,Initech,info@initech.io,200.00,pending,urgent|retail,2026-03-01T11:45:00Z,
4,Acme Corp,acme@example.com,50.00,pending,,2026-03-10T16:20:00Z,
  ^ 4 data rows
```

PRIOR ART
=========

ExCSV draws directly from two prior self-describing-CSV formats. Translation hints below for LLMs that encounter either format and want to map fields to ExCSV.

ECSV (Astropy Enhanced Character-Separated Values)
- Spec: https://docs.astropy.org/en/stable/io/ascii/ecsv.html
- Signature line: `# %ECSV 1.0` (ExCSV equivalent: `#!excsv version=0.2`).
- Metadata block: YAML inside `#` comments, with `datatype:` list and `meta:` block (ExCSV: line-oriented `#column ...` and `#@key: value`).
- Translation:
  - ECSV `{name: x, datatype: float32, unit: m, format: .2f, description: foo}`
    → ExCSV `#column name=x type=float unit=m format=.2f description="foo"`
  - ECSV `meta: {author: alice, date: 2026-01-01}`
    → ExCSV `#@author: alice` + `#@created: 2026-01-01`
  - ECSV `schema: astropy-2.0` → no direct ExCSV equivalent (Astropy-specific class hints; preserve via `x-` attributes if needed).
- ExCSV intentionally does NOT carry masked-column, mixin-column, or multidimensional-column metadata. These are out of scope for v0.2.

InfluxDB Annotated CSV
- Spec: https://docs.influxdata.com/influxdb/v2/reference/syntax/annotated-csv/
- Annotation rows: `#datatype,...`, `#group,...`, `#default,...` — one value per data column (ExCSV equivalent: `#%<name>: ...` aggregation rows use the same per-column positional layout).
- Translation:
  - `#datatype,string,long,dateTime:RFC3339,double` → per-column `#column type=` lines (one per column).
  - `#default,mean,,,` → per-column `default=` attribute on each `#column`.
  - `#group,false,false,true,true` → no direct ExCSV equivalent; map via `x-influx-group=1` custom attribute on relevant `#column` lines.
  - Multiple tables separated by blank rows → not supported in ExCSV v0.2; split into separate files.

ExCSV's distinguishing additions over both: explicit CSV-dialect header (`delim`, `quote`, `encoding`, `null`, `rows`, `checksum`), provenance via `#@`, pre-computed aggregations via `#%`, SQL companions via `#$`, ZIP container with summary in archive comment.

LICENSE
=======

This specification is released under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/

