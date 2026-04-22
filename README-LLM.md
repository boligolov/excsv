# ExCSV v0.1 — LLM Reference

## IDENTITY

ExCSV = Extended CSV. Self-describing, line-oriented tabular format. Backward-compatible with CSV/TSV. File extension: `.excsv, .ecsv`. MIME type: `text/excsv`. Encoding default: UTF-8. License: CC0 1.0.

## FILE STRUCTURE (strict order)

```
LINE 1:       Header line (zero or one, optional)
LINES 2..N:   Meta lines (zero or more, all start with #)
LINES N+1..:  Data section (standard CSV/TSV rows)
```

An ExCSV document MAY omit the header line. If the header line is missing, the document MUST be interpreted as a minimal ExCSV document with default parameters (`delim=comma`, `quote=double`, `header=1`, `encoding=UTF-8`).

Transition rule: first line NOT starting with `#` begins the data section. All meta lines MUST precede data.

Minimal valid file: an empty file, or `#!excsv version=0.1` (header line only).

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
version   REQUIRED  "0.1"
delim     DEFAULT "comma"   delimiter name or literal (see DELIMITERS)
quote     DEFAULT "none"    quote name or literal (see QUOTING)
header    DEFAULT "1"       "1"=first data row is header, "0"=no header row
null      OPTIONAL          additional non-empty string representing null. Empty fields are ALWAYS null by default. Use only when a non-empty value also means null (e.g. null=NA, null=\N). null="" is redundant.
rows      OPTIONAL          integer, total data rows excluding header
checksum  OPTIONAL          "<algorithm>:<hex>" over entire data section, including header row if header=1 (LF-normalized)
csvw      OPTIONAL          "inline-json" | "base64url"
encoding  DEFAULT "UTF-8"   character encoding
schema    DEFAULT "excsv"   "excsv" | "csvw" — which schema source wins
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

All start with `#`. Four recognized kinds by prefix. Unrecognized `#` lines MUST be ignored. Recommended order: `#@` metadata first, then `#column`, then `#csvw`, then `#%` aggregations. Order within each group does not matter. Parsers MUST accept any order.

### 1. File-level metadata: `#@key: value`

Value is raw text to end of line. One optional space after `:` is skipped (for readability). No quoting, no escaping — taken as-is.

Conventional keys (all optional, unknown keys preserved/ignored):

```
source    origin system/table/file
author    creator name/email
comment   free-text description
created   ISO 8601 timestamp
exported  ISO 8601 timestamp
license   license identifier
sql-query SQL or query string (raw text, spaces allowed)
sql-ddl   DDL statement to recreate the table (e.g. CREATE TABLE ...)
tool      generating tool/version
tags      comma-separated tags
```

### 2. Column annotation: `#column key=value [key=value ...]`

Same key=value parsing as header line (split first `=`, quoting rules apply).

### 3. Aggregation: `#%<name>: val1,val2,...,valN`

One optional space after `:` is skipped. The remaining payload MUST be parsed using the file's CSV dialect (delimiter, quote, escapes), as if it were a single CSV row. Values are positional per column. Count MUST equal column count. Empty field = not applicable/not computed.

### 4. CSVW payload: `#csvw <json-or-base64>`

`#csvw` followed by a space and value to end of line. Valid JSON (decode first if `csvw=base64url` in header). Readers MAY ignore entirely.

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

## ERROR HANDLING

```
MUST fail:
  - malformed #!excsv header line (if present)
  - malformed key=value in header
  - column count mismatch in aggregation rows

SHOULD warn:
  - unknown column attributes
  - aggregation type incompatible with column type
```

## PARSING ALGORITHM (pseudocode)

```
1. Read line 1. If starts with "#!excsv": parse space-separated key=value pairs (split on first "="), store as header_fields. If line 1 does NOT start with "#!excsv": use defaults (delim=comma, quote=double, header=1, encoding=UTF-8), rewind line 1 for meta/data parsing.
2. Resolve delimiter: lookup delim in {comma:",", tab:"\t", pipe:"|", semicolon:";"}. If no match, use literal value. If delim absent, default comma.
3. Read subsequent lines while line starts with "#":
   a. "#column " -> parse key=value pairs, store as column definition (ordered list)
   b. "#%" -> extract name after "#%" and before ":", split remainder by delimiter, store as aggregation[name] = values[]
   c. "#csvw " -> store remainder as csvw_payload
   d. "#@" -> extract key (between "#@" and ":"), value (after ": "), store as metadata[key] = value
   e. Other "#" lines -> ignore
4. First non-"#" line begins data section.
5. If header=1: first data line is column names. Validate against #column name attributes if present.
6. Parse remaining lines as CSV using resolved delimiter and quote character.
7. If checksum present: normalize data section newlines to LF, compute digest, compare.
8. If aggregations present: validate value count equals column count.
```

## SERIALIZATION ALGORITHM (pseudocode)

```
1. Write "#!excsv" + header fields in canonical order: version, delim, quote, header, encoding, null, rows, checksum, schema, csvw. Omit fields with default values. Quote values containing spaces.
2. Write file-level metadata as "#@key: value" lines.
3. Write "#column name=X type=Y ..." for each column in order.
4. Write "#%<name>: v1,v2,...,vN" for each aggregation. Use file delimiter. Empty string for non-applicable.
5. If csvw payload: write "#csvw <json>".
6. If header=1: write column names as first data row, delimited.
7. Write data rows, delimited and quoted per CSV rules.
```

## QUICK-REFERENCE EXAMPLES

### Minimal (header only)
```
#!excsv version=0.1
```

### Schema-less (no #column lines)
```
#!excsv version=0.1 delim=comma header=1
name,age,city
Alice,30,NYC
Bob,25,LA
```

### header=0 with index
```
#!excsv version=0.1 delim=tab header=0
#column index=0 name=id type=int
#column index=1 name=value type=decimal
1	99.50
2	200.00
```

### quote=none (no quoting)
```
#!excsv version=0.1 delim=pipe header=1 quote=none
name|score|grade
Alice|95|A
Bob|87|B+
```

### null (default: empty field = null)
```
#!excsv version=0.1 delim=comma header=1
name,email
Alice,
Bob,bob@test.com
  ^ email for Alice is null (empty field is always null by default)
```

### null=NA (non-empty null marker)
```
#!excsv version=0.1 delim=comma header=1 null=NA
name,email
Alice,NA
Bob,bob@test.com
  ^ email for Alice is null (both empty fields and "NA" are null)
```

### Quote doubling (both header and data)
```
#!excsv version=0.1 delim=comma quote=double header=1
#column name=name type=string
#column name=note type=string description="contains ""special"" chars"
  ^ "" in header value produces literal "
name,note
Alice,"She said ""hello"" to everyone"
Bob,"Line1, then more"
  ^ "" in data field produces literal " — same doubling rule everywhere
```

## CANONICAL EXAMPLE (annotated)

```
#!excsv version=0.1 delim=comma quote=double header=1 encoding=UTF-8 rows=4 schema=excsv checksum=sha256:a1b2c3d4e5f6
  ^ header line: version=0.1, delimiter is comma, quote is double ("), first data row is header, empty fields are null (default), 4 data rows, excsv schema wins, checksum provided
#@author: author@example.com
#@source: sales_db.orders
#@comment: Quarterly sales export with all column features demonstrated
#@created: 2026-01-01T00:00:00Z
#@exported: 2026-03-24T12:00:00Z
#@license: CC-BY-4.0
#@sql-query: SELECT * FROM orders WHERE quarter = 'Q1'
#@sql-ddl: CREATE TABLE orders (id INT PRIMARY KEY, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL, amount DECIMAL(8,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', tags TEXT, created_at TIMESTAMP, note TEXT)
#@tool: excsv-cli/0.1.0
#@tags: sales,Q1,2026,demo
  ^ file-level metadata key-value pairs
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

