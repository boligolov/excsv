# ExCSV v0.2 — Specification

**Extended Comma-Separated Values (ExCSV)**


|                    |                                                              |
| ------------------ | ------------------------------------------------------------ |
| **Version**        | 0.2                                                          |
| **Status**         | Draft / Experimental                                         |
| **File extensions**| `.excsv`, `.ecsv` (plain); `.excsv.zip`, `.ecsv.zip` (zipped) |
| **MIME types**     | `text/excsv` (plain); `application/excsv+zip` (zipped)       |


> **Feeding ExCSV to an LLM?** Use [`README-LLM.md`](README-LLM.md) — a condensed, structured rewrite of this entire specification optimized for AI assistants (no marketing prose, denser tables, explicit pseudocode for parsing/serialization, translation tables for ECSV and Annotated CSV).
>
> Direct raw link to paste into your AI tool of choice:
> `https://raw.githubusercontent.com/boligolov/excsv/main/README-LLM.md`

### What's new in 0.2

- New meta line kind `#$` for SQL companions (DDL and DQL).
- New header field `sql-dialect` setting a default SQL dialect for `#$` lines.
- ZIP container format (`.excsv.zip`) with required `original-size` header field and an in-comment summary for unzipped inspection.

### Quick Example

```
#!excsv version=0.2 delim=comma header=1
#column name=id type=int
#column name=name type=string
#column name=price type=decimal unit=USD
id,name,price
1,Widget,9.99
2,Gadget,24.50
```

It's just CSV with a self-describing header. See the [full example](#13-full-example) for schema, metadata, SQL, and aggregations.

---

## 1. Introduction

ExCSV is a self-describing, line-oriented tabular data format backward-compatible with plain CSV/TSV.

It extends CSV with:

- An inline metadata header
- Column schema annotations
- Optional aggregation metadata
- Optional SQL companions (DDL/DQL with dialect tagging)
- Optional embedded [CSVW](https://www.w3.org/TR/tabular-data-primer/) compatibility
- Optional ZIP container with summary in the archive comment

ExCSV is designed for CLI workflows, data interchange, human readability, and minimal parsing complexity.

### 1.1 Design Goals (Non-Normative)

- Remain fully backward-compatible with CSV — any CSV reader can consume the data section.
- Support CLI processing with tools like `grep`, `awk`, `cut`, and `head`.
- Avoid mandatory JSON — metadata is line-oriented key-value, not a nested structure.
- Allow progressive enhancement — start with plain CSV, add schema, aggregations, and SQL as needed.
- Make zipped distribution first-class: integrity fields and summary metadata travel inside the archive itself.

### 1.2 Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

---

## 2. File Structure

An ExCSV file **MUST** consist of, in order:

```
┌─────────────────────────┐
│  Header Line            │  ← zero or one, optional
├─────────────────────────┤
│  Meta Lines             │  ← zero or more
├─────────────────────────┤
│  Data Section           │  ← standard CSV/TSV rows
└─────────────────────────┘
```

An ExCSV document **MAY** omit the header line. If the header line is missing, the document **MUST** be interpreted as a minimal ExCSV document with default parameters (`delim=comma`, `quote=double`, `header=1`, `encoding=UTF-8`).

The smallest valid ExCSV file is an empty file, or a single header line: `#!excsv version=0.2`.

### 2.1 Line Endings and BOM

- Files **MAY** use LF or CRLF line endings. Parsers **MUST** accept both.
- Parsers **MUST** ignore UTF-8 BOM (`U+FEFF`) at start of file.

---

## 3. Header Line

### 3.1 Syntax

If present, the header line **MUST** be line 1, **MUST** begin with `#!excsv`, and **MUST** contain at least the `version` field.

```
#!excsv version=0.2 delim=comma header=1
```

### 3.2 Key-Value Pairs

- Header fields **MUST** be encoded as `key=value`.
- Pairs **MUST** be separated by one or more spaces.
- Parsing **MUST** split on the **first** `=` character (values may contain `=`).
- Unknown keys **MUST** be ignored by conforming parsers.

### 3.3 Value Rules

- Values without spaces **MUST NOT** be quoted.
- Values with spaces **MUST** be wrapped in double quotes (`"`).
- Inside quoted values, double quote **MUST** be escaped by doubling (`""`).
- No other escape sequences are allowed.

### 3.4 Header Fields


| Field           | Requirement                | Description                                                                                                                          |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `version`       | **MUST**                   | Format version (`0.2`)                                                                                                               |
| `delim`         | SHOULD                     | Delimiter — a known name **or** a literal character/sequence (see below). Default: `comma`                                            |
| `quote`         | SHOULD                     | Quote — a known name **or** a literal character (see below). Default: `none`                                                          |
| `header`        | SHOULD                     | `1` if the first data row is a header row, `0` otherwise. Default: `1`                                                                |
| `null`          | MAY                        | Additional non-empty string representing null. Empty fields are **always** null by default. Use only when a non-empty value also means null (e.g. `null=NA`, `null=\N`). `null=""` is redundant. |
| `rows`          | MAY                        | Total number of data rows (excluding header)                                                                                         |
| `checksum`      | MAY                        | Checksum of the data section (see [Section 8](#8-checksum))                                                                          |
| `csvw`          | MAY                        | CSVW embedding mode (see [Section 9](#9-csvw-compatibility))                                                                         |
| `encoding`      | MAY                        | Character encoding (default `UTF-8`)                                                                                                 |
| `schema`        | MAY                        | Schema precedence: `excsv` (default) or `csvw`                                                                                       |
| `sql-dialect`   | MAY                        | Default SQL dialect for unqualified `#$` lines (see [Section 5](#5-sql-companions))                                                  |
| `original-size` | **MUST** if zipped         | Uncompressed byte size of the inner `.excsv` file (decimal integer). Must match the ZIP central directory `uncompressed_size`. See [Section 10](#10-zip-container). |


#### Delimiter Values

The `delim` field accepts either a **well-known name** or a **literal character/sequence**.

**Well-known names:**


| Name        | Character         |
| ----------- | ----------------- |
| `comma`     | `,`               |
| `tab`       | `\t`              |
| `pipe`      | `\|`              |
| `semicolon` | `;`               |


**Literal delimiters:**

Any value that is not a well-known name **MUST** be treated as the literal delimiter string.


| Example      | Delimiter used              |
| ------------ | --------------------------- |
| `delim=,`    | `,`                         |
| `delim=tab`  | Tab character (well-known)  |
| `delim=::`   | Two-colon sequence `::`     |
| `delim=|`    | `|` (literal pipe)          |


- If the value is not a well-known name, it is used as the literal delimiter.
- Parsers **MUST** first check against the well-known name table; if no match, treat the value as a literal.

#### Quote Values

The `quote` field accepts either a **well-known name** or a **literal character**.

**Well-known names:**

| Name | Character |
|---|---|
| `none` | No quoting (default) |
| `double` | `"` (double quote) |
| `single` | `'` (single quote) |

Any value that is not a well-known name **MUST** be treated as the literal quote character.

- Parsers **MUST** first check against the well-known name table; if no match, treat the value as a literal.

---

## 4. Meta Lines

Meta lines appear after the header line and before the data section.

### 4.1 General Rules

- Meta lines **MUST** start with `#`.
- Meta lines **MUST** precede the data section.
- Parsing of meta lines **MUST** stop at the first non-`#` line.
- Unrecognized `#` lines **MUST** be ignored.
- Recommended order: `#@` metadata first, then `#column`, then `#csvw`, then `#$` SQL, then `#%` aggregations. Order within each group does not matter, except where stated (e.g. `#$ddl` execution order). Parsers **MUST** accept any order.

### 4.2 Types of Meta Lines

Five recognized kinds, by prefix:


| Prefix                       | Purpose             | Example                                  |
| ---------------------------- | ------------------- | ---------------------------------------- |
| `#@key: value`               | File-level metadata | `#@source: sales_db.orders`              |
| `#column ...`                | Column annotation   | `#column name=id type=int`               |
| `#csvw ...`                  | CSVW payload        | `#csvw {"tableSchema": ...}`             |
| `#$<verb>[-<dialect>]: ...`  | SQL companion       | `#$ddl-mysql: CREATE TABLE orders (...)` |
| `#%<name>: ...`              | Aggregation values  | `#%sum: ,, 42.5`                         |


### 4.3 File-Level Metadata Values

The value is **raw text** to the end of the line. One optional space after `:` is skipped (for readability). No quoting or escaping is applied — the value is taken as-is.

The following `#@key: value` keys are conventional. Implementations **MAY** use any key; unknown keys **MUST** be preserved or ignored.


| Key        | Description                          | Example                            |
| ---------- | ------------------------------------ | ---------------------------------- |
| `source`   | Origin system, table, or file        | `#@source: sales_db.orders`        |
| `author`   | Creator contact or name              | `#@author: alex@example.com`       |
| `comment`  | Free-text description of the dataset | `#@comment: demo dataset`          |
| `created`  | Creation timestamp (ISO 8601)        | `#@created: 2026-03-24T12:00:00Z`  |
| `exported` | Export timestamp                     | `#@exported: 2026-03-24T14:30:00Z` |
| `license`  | Data license identifier              | `#@license: CC-BY-4.0`             |
| `tool`     | Tool/version that generated the file | `#@tool: excsv-cli/0.2.0`          |
| `tags`     | Comma-separated tags                 | `#@tags: sales,Q1,2026`            |


SQL companions (`ddl`, `dql`) are encoded as `#$` lines, not `#@`. See [Section 5](#5-sql-companions).

Each `#@` key is unique per file (last-wins on duplicates).

Example:

```
#!excsv version=0.2 delim=comma header=1
#@author: alex@example.com
#@comment: demo dataset for onboarding docs
#@source: analytics_db.page_views
#@created: 2026-03-24T10:00:00Z
#@tags: demo,analytics
#column name=page type=string
#column name=views type=int
page,views
/home,14200
/pricing,8700
```

---

## 5. SQL Companions

A file **MAY** carry SQL statements alongside its data: DDL to recreate the schema, and DQL (SELECT queries) for provenance or example use.

### 5.1 Syntax

```
#$<verb>[-<dialect>[-<version>]]: <payload>
```

- `<verb>` is one of:
  - **`ddl`** — Data Definition Language. `CREATE TABLE`, `CREATE INDEX`, `ALTER`, `GRANT`, seed `INSERT`, etc. **Repeatable, ordered.** Statements **MUST** be executed in file order, top → bottom.
  - **`dql`** — Data Query Language. `SELECT` and friends. Informational provenance — **NOT** executed automatically. Repeatable, order has no execution meaning.
- `<dialect>` is a lowercase ASCII token, optionally followed by a version suffix (e.g. `mysql-8`, `postgres-15`).
- Payload is **raw text to end of line**, exactly like `#@` values. One optional space after `:` is skipped. **One line = one statement.** Embedded newlines are **NOT** supported; split multi-statement DDL into multiple `#$ddl` lines.

### 5.2 Well-Known Dialect Tokens

Parsers **SHOULD** recognize these; any other lowercase ASCII identifier **MUST** be accepted as-is.


| Token         | Database                              |
| ------------- | ------------------------------------- |
| `ansi`        | ANSI / ISO standard SQL (default)     |
| `mysql`       | MySQL                                 |
| `mariadb`     | MariaDB                               |
| `postgres`    | PostgreSQL (read alias: `postgresql`, `pg`) |
| `mssql`       | Microsoft SQL Server (read alias: `sqlserver`) |
| `sqlite`      | SQLite                                |
| `oracle`      | Oracle Database                       |
| `db2`         | IBM Db2                               |
| `clickhouse`  | ClickHouse                            |
| `snowflake`   | Snowflake                             |
| `bigquery`    | Google BigQuery                       |
| `duckdb`      | DuckDB                                |


Anything else (e.g. `redshift`, `trino`, `cockroachdb`, `bigquery-standard`, your in-house engine) is **also valid** — parsers **MUST** accept any lowercase ASCII identifier as a dialect token. The list above is only the set parsers **SHOULD** recognize by name for nicer warnings; it isn't a closed enumeration.

Writers **SHOULD** emit the canonical token (left column) when one exists. Readers **MUST** treat aliases as equivalent but **SHOULD NOT** emit aliases.

### 5.3 Dialect Resolution

For each `#$` line, the **effective dialect** is determined as:

1. If the key has an explicit suffix (e.g. `#$ddl-mysql`), the effective dialect is that suffix.
2. Else if the header sets `sql-dialect=X`, the effective dialect is `X`.
3. Else the effective dialect is `ansi` (portable SQL).

When applying SQL to a target dialect `D`:

1. **Exact match**: lines whose effective dialect equals `D`.
2. **Family match**: if `D` is versioned (`<family>-<version>`) and the line's effective dialect equals `<family>` (or vice versa), it is a match — implementations **MAY** warn.
3. **No match**: skip the line. If no line matches `D` for a given verb, implementations **MAY** warn.

### 5.4 DDL Execution Order

When applying DDL to a target dialect `D`:

- Iterate **all `#$ddl` lines in file order**.
- For each line, compute its effective dialect.
- If effective dialect matches `D` → execute the statement.
- Else → skip.

Dialect-specific and portable DDL **MAY** be interleaved in the file. Only matching lines are executed; their relative order is preserved.

### 5.5 Examples

**Single dialect via header:**

```
#!excsv version=0.2 sql-dialect=mysql
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: GRANT SELECT ON orders TO readonly
#$dql: SELECT * FROM orders WHERE id > 100
```

**Multi-dialect side-by-side:**

```
#!excsv version=0.2
#$ddl: CREATE TABLE orders (id INTEGER PRIMARY KEY, amount DECIMAL(8,2))
#$ddl-mysql: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))
#$ddl-clickhouse: CREATE TABLE orders (id UInt64, amount Decimal(8,2)) ENGINE = MergeTree() ORDER BY id
#$dql-postgres: WITH base AS (SELECT * FROM orders WHERE amount > 0) SELECT * FROM base
```

---

## 6. Column Schema

### 6.1 Column Definition

Column annotations are **OPTIONAL**. A file without any `#column` lines is valid (schema-less mode). Partial coverage is also valid — not every column needs a `#column` line; missing columns have no schema (user's responsibility). If present, each column is described with one `#column` line:

```
#column name=id type=int unique=1
#column name=email type=string required=1 len_max=254
#column name=amount type=decimal format=0.00 unit=USD
```

### 6.2 Required Fields

| Field | `header=1` | `header=0` |
|---|---|---|
| `name` | **MUST** | MAY |
| `index` | not used | **MUST** |

### 6.3 Name Rules

- `name` **MUST NOT** contain spaces.
- `name` **SHOULD** match the regex `[A-Za-z_][A-Za-z0-9_-]*`.

### 6.4 Header Mapping

**When `header=1`:**

- A data header row **MUST** exist as the first row of the data section.
- If `title` is present, the header cell **MUST** match `title`. Otherwise it **MUST** match `name`.
- Missing or extra columns **MUST** be treated as a validation error.

**When `header=0`:**

- Each `#column` **MUST** have `index` (zero-based) to define its position.
- `name` is optional — if omitted, the column is referenced by index only.

### 6.5 Column Attributes

#### Identity


| Field         | Requirement | Description                                                     |
| ------------- | ----------- | --------------------------------------------------------------- |
| `name`        | **MUST** if `header=1`, MAY if `header=0` | Column identifier               |
| `title`       | MAY         | Human-readable display name (MUST be quoted if contains spaces) |
| `description` | MAY         | Free-text description (quoted)                                  |


#### Type System


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


#### Default / Required


| Field      | Requirement | Description                                             |
| ---------- | ----------- | ------------------------------------------------------- |
| `default`  | MAY         | Default value for missing fields                        |
| `required` | MAY         | `1` = field must not be null, `0` = nullable. If `default` is also set, the default satisfies the requirement |


#### Constraints


| Field            | Requirement | Description                    |
| ---------------- | ----------- | ------------------------------ |
| `min`            | MAY         | Minimum value (numeric / date) |
| `max`            | MAY         | Maximum value (numeric / date) |
| `len_min`        | MAY         | Minimum string length          |
| `len_max`        | MAY         | Maximum string length          |
| `pattern`        | MAY         | Regex pattern for validation (default dialect: ECMAScript) |
| `regexp_dialect` | MAY         | Regex dialect for `pattern`: `ecmascript` (default), `pcre`, `posix_ere`, `re2` |


#### Keys


| Field    | Requirement | Description                     |
| -------- | ----------- | ------------------------------- |
| `unique` | MAY         | `1` = all values must be unique |


#### Semantics


| Field       | Requirement | Description                                  |
| ----------- | ----------- | -------------------------------------------- |
| `order`     | MAY         | `none`, `asc`, or `desc`                     |
| `unit`      | MAY         | Unit of measurement (e.g. `USD`, `kg`, `ms`) |
| `separator` | MAY         | Sub-field separator within the value         |


#### Positional


| Field   | Requirement            | Description                |
| ------- | ---------------------- | -------------------------- |
| `index` | **MUST** if `header=0` | Zero-based column position |


### 6.6 Unknown Attributes

- Unknown attributes **MUST** be ignored by parsers.
- Custom attributes **SHOULD** use the prefix `x-` (e.g. `x-source=erp`).

---

## 7. Aggregations

### 7.1 Aggregation Values

```
#%count_nonnull: ,98,100
#%sum: ,,154280.50
#%avg: ,,1542.81
```

- `<name>` **MUST** be a well-known aggregation name (see Section 7.2).
- One optional space after `:` is skipped. The remaining payload **MUST** be parsed using the file's CSV dialect (delimiter, quote character, escapes), as if it were a single CSV row.
- Value count **MUST** equal the number of columns.
- Aggregation line order does not matter. Parsers **MUST** accept any order.
- Aggregations **MUST** be parsed using the resolved CSV dialect. If the header is absent, the default dialect **MUST** be used.

### 7.2 Standard Aggregations

**Universal** (any type):


| Name             | Description              |
| ---------------- | ------------------------ |
| `count_nonnull`  | Count of non-null values |
| `count_null`     | Count of null values     |
| `count_distinct` | Count of distinct values |


**Numeric** (`int`, `long`, `float`, `double`, `decimal`):


| Name  | Description     |
| ----- | --------------- |
| `sum` | Sum of values   |
| `avg` | Arithmetic mean |
| `min` | Minimum value   |
| `max` | Maximum value   |


**String** (`string`):


| Name     | Description               |
| -------- | ------------------------- |
| `len_min` | Length of shortest string |
| `len_max` | Length of longest string  |


### 7.3 Null Handling

Aggregations follow SQL semantics: null values are **excluded** from computation.

- `sum`, `avg`, `min`, `max`, `len_min`, `len_max` — nulls are skipped.
- `count_nonnull` — counts non-null values only.
- `count_null` — counts null values only.
- `count_distinct` — counts distinct **non-null** values only.

### 7.4 Type Compatibility

- Implementations **SHOULD** validate aggregation compatibility with the column type.
- Implementations **MAY** ignore invalid combinations with a warning.

### 7.5 Missing Values

An empty field in an aggregation row **MUST** mean "not applicable" or "not computed."

---

## 8. Checksum

If present in the header line:

```
checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924...
```

- The checksum **MUST** apply to the **entire data section** (everything after the last meta line), including the header row if `header=1` and the trailing newline if present.
- Newlines **MUST** be normalized to `\n` (LF) before computing.
- Format: `<algorithm>:<hex-digest>`.
- This is **semantic** content integrity, covering the data section regardless of how the file is packaged or transported.

---

## 9. CSVW Compatibility

### 9.1 Declaration

The header line **MAY** include one of:


| Value              | Meaning                                 |
| ------------------ | --------------------------------------- |
| `csvw=inline-json` | CSVW metadata is inline JSON            |
| `csvw=base64url`   | CSVW metadata is Base64URL-encoded JSON |


### 9.2 Payload

```
#csvw {"tableSchema": {"columns": [...]}}
```

`#csvw` followed by a space and value to end of line.

- The payload **MUST** be valid JSON (after decoding if `base64url`).
- Readers **MAY** ignore CSVW metadata entirely.

### 9.3 Schema Precedence


| `schema` value    | Behavior                                    |
| ----------------- | ------------------------------------------- |
| `excsv` (default) | ExCSV `#column` annotations take precedence |
| `csvw`            | CSVW `tableSchema` takes precedence         |


---

## 10. ZIP Container

An ExCSV document **MAY** be shipped inside a standard ZIP archive with the extension `.excsv.zip` (or `.ecsv.zip`). This is a **container format**, not a new dialect — the inner file is a regular ExCSV document.

### 10.1 Archive Layout

The archive **MUST** contain at least one entry whose name ends in `.excsv` or `.ecsv`. The **primary** entry **MUST** be:

- The **first** entry in the central directory, AND
- Named either the archive's base name with `.zip` stripped (`sales.excsv.zip` → `sales.excsv`), OR named `data.excsv` if no such match.

Additional entries (auxiliary data, attachments) **MAY** follow.

### 10.2 Compression

The primary entry **SHOULD** use Deflate (method 8). Store, Deflate64, BZIP2, LZMA, and Zstandard **MAY** be used. ZIP64 extensions **MUST** be supported. Encrypted archives are **NOT** specified in v0.2.

### 10.3 Required Inner Header Field

The inner `.excsv` file's `#!excsv` header **MUST** include:

```
original-size=<bytes>   uncompressed byte size of the inner .excsv file
```

This value **MUST** match the `uncompressed_size` recorded in the ZIP central directory entry for the primary file. A mismatch **MUST** be reported as a validation error.

For semantic content integrity, use the `checksum=` field (Section 8) — it covers the data section and survives re-compression or re-archiving.

### 10.4 ZIP Comment (Summary)

The ZIP end-of-central-directory comment field (max 65535 bytes) **MUST** carry a textual summary of the inner ExCSV file. This lets consumers read metadata **WITHOUT** extracting the archive.

The comment **MUST** be UTF-8 encoded and **MUST** be a valid prefix of an ExCSV file (begins with `#!excsv ...`, then `#` lines only).

#### Priority Order

Writers **MUST** include lines in this priority order, stopping when the next line would exceed the 65535-byte budget:

1. `#!excsv` header line (**MUST** be present, **MUST** include `original-size=`).
2. `#@source`, `#@author`, `#@created`, `#@exported`, `#@license`, `#@tool`.
3. All `#column` lines.
4. All `#$ddl` and `#$ddl-<dialect>` lines (preserving file order).
5. All `#%` aggregation lines.
6. `#@comment`, `#@tags`.
7. Remaining `#@` entries.
8. All `#$dql` and `#$dql-<dialect>` lines.
9. `#csvw` payload.

#### Truncation Marker

If any content was omitted, the comment **MUST** end with:

```
#@comment-truncated: 1
```

Readers **MUST** treat the comment as **advisory**: the authoritative source is the inner file. If they disagree (beyond truncation), the inner file wins.

---

## 11. Data Section

- The data section **MUST** follow the CSV dialect defined in the header (`delim`, `quote`, etc.).
- Quoted values **MUST NOT** contain raw newlines. All values are single-line.
- If the first field of the first data row begins with `#` (unquoted), it is ambiguous with meta lines. To avoid this: if quoting is enabled, the value **MUST** be quoted. If quoting is disabled (`quote=none`), the first field **MUST NOT** start with `#`. Note: `#` itself **MAY** be used as the quote character (e.g. `quote=#`), which resolves the ambiguity.
- If `quote=none`, values **MUST NOT** contain delimiter characters.
- A trailing newline after the last data row is **OPTIONAL**. If present, it is included in checksum computation.

---

## 12. Error Handling

Implementations **MUST** fail on:

- Malformed `#!excsv` header line (if present)
- Malformed `key=value` pairs in the header
- Column count mismatch in aggregation rows
- Zipped file with missing `original-size` header field
- Zipped file where inner uncompressed size does not match header `original-size`
- Zipped file where comment is not a valid ExCSV prefix
- `#$` line missing the `:` separator
- `#$` line whose payload contains an embedded newline

Implementations **SHOULD** warn on:

- Unknown attributes in column definitions
- Aggregation types incompatible with column types
- Unknown SQL dialect token
- `#$` verb other than `ddl` or `dql`
- ZIP comment disagrees with inner file's `#!excsv` header (other than truncation marker)
- No `#$` line matches the consumer's target dialect

---

## 13. Full Example

```
#!excsv version=0.2 delim=comma quote=double header=1 encoding=UTF-8 rows=4 schema=excsv checksum=sha256:a1b2c3d4e5f6 sql-dialect=mysql
#@author: author@example.com
#@source: sales_db.orders
#@comment: Quarterly sales export with all column features demonstrated
#@created: 2026-01-01T00:00:00Z
#@exported: 2026-03-24T12:00:00Z
#@license: CC-BY-4.0
#@tool: excsv-cli/0.2.0
#@tags: sales,Q1,2026,demo
#column name=id type=int unique=1 title="Order ID" description="Auto-incremented order identifier"
#column name=customer type=string required=1 len_min=1 len_max=100 title="Customer Name"
#column name=email type=string required=1 len_max=254 pattern=^[^@]+@[^@]+$
#column name=amount type=decimal format=0.00 unit=USD min=0 max=999999.99 default=0.00 order=desc
#column name=status type=string default=pending
#column name=tags type=string separator=| title="Order Tags"
#column name=created_at type=datetime title="Created At" description="UTC timestamp of order creation"
#column name=note type=string x-ui-widget=textarea
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL, amount DECIMAL(8,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', tags TEXT, created_at TIMESTAMP, note TEXT) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: CREATE INDEX orders_status_idx ON orders(status)
#$ddl: GRANT SELECT ON orders TO readonly
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, customer VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, amount NUMERIC(8,2) DEFAULT 0.00, status VARCHAR(20) DEFAULT 'pending', tags TEXT, created_at TIMESTAMPTZ, note TEXT)
#$dql: SELECT * FROM orders WHERE quarter = 'Q1'
#%count_nonnull: 4,4,4,4,4,3,4,2
#%count_null: 0,0,0,0,0,1,0,2
#%count_distinct: 4,3,3,4,2,3,4,2
#%sum: ,,,1050.50,,,,
#%avg: ,,,262.625,,,,
#%min: ,,,50.00,,,,
#%max: ,,,500.00,,,,
#%len_min: ,,15,,,6,,20
#%len_max: ,,18,,,16,,21
id,customer,email,amount,status,tags,created_at,note
1,Acme Corp,acme@example.com,500.00,completed,urgent|wholesale,2026-01-15T09:30:00Z,Large wholesale order
2,Globex Inc,globex@example.com,300.50,completed,retail,2026-02-20T14:00:00Z,"Paid in full, net-30"
3,Initech,info@initech.io,200.00,pending,urgent|retail,2026-03-01T11:45:00Z,
4,Acme Corp,acme@example.com,50.00,pending,,2026-03-10T16:20:00Z,
```

---

## Prior Art

ExCSV stands on the shoulders of two prior formats that proved a CSV file can carry its own metadata without ceasing to be a CSV file.

### ECSV — Enhanced Character-Separated Values (Astropy)

[Astropy's ECSV](https://docs.astropy.org/en/stable/io/ascii/ecsv.html) is the closest spiritual ancestor. It established the core pattern:

- A versioned signature line (`# %ECSV 1.0`).
- A `#`-prefixed metadata block that any CSV reader ignores.
- Per-column descriptors (`name`, `datatype`, `unit`, `format`, `description`).
- Free-form file-level `meta:` block.
- Plain CSV data section that round-trips through every standard tool.

ExCSV adopts the same overall shape but **swaps ECSV's nested YAML header for line-oriented `key=value` pairs**. Each meta line stands on its own — easier to `grep`, easier to `diff`, easier to write by hand. The tradeoff: ExCSV doesn't try to carry rich Python-typed objects (masked columns, mixin columns, multidimensional arrays). That's deliberate — ExCSV is a tabular interchange format, not an in-memory object serializer.

### InfluxDB Annotated CSV

[InfluxDB's Annotated CSV](https://docs.influxdata.com/influxdb/v2/reference/syntax/annotated-csv/) showed the other half of the picture: **annotation rows that carry one value per data column**.

```
#group,false,false,true,true
#datatype,string,long,dateTime:RFC3339,double
#default,mean,,,,
,result,table,_time,_value
```

ExCSV's `#%` aggregation rows are direct descendants of this idea — one row per metric, one value per column, file's CSV dialect for the values. The `#`-as-comment convention and the "any `#` line is safely ignorable by plain CSV readers" guarantee also come from this tradition.

### What ExCSV adds beyond both

- An explicit `#!excsv` header line declaring the CSV dialect **inside** the file (delimiter, quote, encoding, null marker, row count, checksum).
- `#@key: value` provenance lines (source, author, license, tool, tags, created/exported timestamps).
- Pre-computed aggregations as first-class metadata, not just types and defaults — consumers get `sum`, `avg`, `min`, `max`, `count_*` without scanning the data.
- SQL companions (`#$ddl`, `#$dql`) with dialect tagging — ship the schema and the query that produced the data alongside the data itself, in multiple SQL dialects.
- ZIP container (`.excsv.zip`) with the metadata summary embedded in the archive's comment field — preview schema without unzipping.

If you already have ECSV files, the metadata translates 1:1 to ExCSV (`datatype` → `#column type=`, `unit` → `#column unit=`, `description` → `#column description=`, the `meta:` block → individual `#@` keys). If you already have Annotated CSV, the `#datatype` row maps to per-column `#column type=` lines and the `#default` row maps to `#column default=`.

---

## License

This specification is released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
