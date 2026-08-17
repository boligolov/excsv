# SQL (`#$`)

A file MAY carry SQL companions to its data: definitional statements that recreate the table/schema (DDL), and informational queries that produced the data (DQL). These are encoded as a dedicated meta kind with the prefix `#$`.

`#$` was chosen because it is a single character (compact) and visually telegraphs "SQL" (`$` evokes shell/query). It is a peer of `#@`, `#column`, `#%`, and `#csvw` — not a sub-namespace of `#@`.

## Key syntax

```
#$<verb>[-<dialect-suffix>]: <payload>
```

- `<verb>` is one of:
  - `ddl` — Data Definition Language. Statements that build the schema: `CREATE TABLE`, `CREATE INDEX`, `CREATE VIEW`, `ALTER TABLE`, `GRANT`, seed `INSERT`, etc. **REPEATABLE**. Statements MUST be executed in file order, top → bottom.
  - `dql` — Data Query Language. SELECT statements (typically the query that produced this dataset, or example queries against the recreated schema). **REPEATABLE** but order has no execution semantics — purely informational/provenance.
- `<dialect-suffix>` is optional. When present, it is a lowercase ASCII dialect token, optionally followed by `-<version>`. Examples: `mysql`, `postgres`, `postgres-17`, `mysql-9`, `clickhouse-25`. Unknown tokens MUST be preserved by parsers.
- `<version>` (when present) is arbitrary ASCII made of alphanumerics and `.` (e.g. `16`, `8`, `2022`, `24.3`). Comparison is **string equality**, not semver. `16` ≠ `16.2`. Writers SHOULD pick the coarsest version suffix that actually matters.

Payload format matches `#@`: raw text to end of line, no quoting, no escaping, exactly one optional space skipped after `:`. **A single line carries exactly one statement.** Embedded newlines are NOT supported — splitting on `;` is error-prone (semicolons appear in string literals, comments, dollar-quoted blocks). Use multiple `#$ddl` lines for multi-statement schemas.

If no dialect suffix is present, the key is **unqualified**. Its effective dialect is resolved from the `sql-dialect` header field if set, otherwise it is treated as **ANSI / portable SQL**.

Equivalent spellings:

```
#$ddl-postgres-18: ...     ← dialect=postgres, version=16
#$ddl-mysql-9: ...         ← dialect=mysql, version=8
#$ddl-postgres: ...        ← dialect=postgres, no version
```

## Well-known dialect tokens

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

## Suffix parsing

Parsers MUST split a dialect suffix into `(dialect, version)`:

1. Match the longest leading prefix against well-known dialect tokens and read aliases (e.g. `postgresql` → `postgres`).
2. If the remainder starts with `-` and the rest is non-empty, that rest is `version`; otherwise `version` is empty.
3. If no well-known prefix matches, the entire suffix is `dialect` and `version` is empty (unknown dialect — preserve, MAY warn).

The **effective dialect token** used for matching is:

- `dialect` when `version` is empty
- `dialect-version` (one hyphen) when `version` is present

The `sql-dialect` header field and CLI `--dialect=` targets use the same token form (`postgres`, `postgres-17`, `mysql-9`, …). Parse them with the same rules.

## Dialect matching

When a consumer filters or applies SQL for a target `D` (e.g. `excsv sql ddl postgres-18`):

1. Parse `D` into `(target_dialect, target_version)` using the suffix rules above.
2. For each `#$` line, compute effective dialect `L` from the line suffix, or from `sql-dialect` / `ansi` for unqualified lines.
3. Parse `L` into `(line_dialect, line_version)`.
4. Classify the pair with `MatchKind`:

| Target `D` | Line `L` | MatchKind | Default behaviour |
| --- | --- | --- | --- |
| `postgres` | `postgres` | `exact` | include |
| `postgres` | `postgres-18` | `family` | include; SHOULD warn (line more specific than target) |
| `postgres-18` | `postgres` | `family` | include; SHOULD warn (line generic, may not work on this version) |
| `postgres-18` | `postgres-18` | `exact` | include |
| `postgres-18` | `postgres-17` | `version-mismatch` | include; SHOULD warn (same family, different version) |
| `postgres-18` | `mysql` / `mysql-9` | `none` | skip |

Rules:

- **exact** — `target_dialect == line_dialect` AND (`target_version == line_version`, or both versions empty).
- **family** — same `target_dialect` and `line_dialect`, and exactly one side has an empty version.
- **version-mismatch** — same `target_dialect` and `line_dialect`, both sides have a non-empty version, and versions differ (string compare).
- **none** — different dialect families, or no rule above applies.

`--strict` on `excsv sql apply` / `excsv sql ddl`: upgrade `version-mismatch` from warn+include to **skip** (treat as `none`). `family` matches still include with a warning.

### CLI target ergonomics

- `excsv sql ddl postgres-18` — target `postgres-18`: include `exact` + `family` lines where the line is generic (`postgres`) or exact (`postgres-18`). Exclude `postgres-17` unless default (warn) or `--strict` (skip).
- `excsv sql ddl postgres` — target `postgres`: include `exact` (`postgres`) + `family-down` (any `postgres-<version>`). SHOULD warn on versioned lines.

When multiple lines match, emit/execute **all** of them in file order. When one target matches several lines at the same specificity, run every matching line — do not deduplicate.

## `#$ddl` execution order

When applying DDL to a target dialect `D`:

- Iterate **all `#$ddl` lines in file order**.
- For each line, compute `MatchKind` against `D`.
- If `MatchKind` is `exact`, `family`, or `version-mismatch` (and not `--strict`-skipped) → emit/execute the statement.
- Else → skip.

Dialect-specific and portable DDL can be interleaved in the file; only matching lines run, but their relative order is preserved.

Example: in a file with `sql-dialect=mysql`:

```
#$ddl: CREATE TABLE foo (id INT PRIMARY KEY)         -- effective L = mysql
#$ddl-postgres: CREATE TABLE foo (id BIGSERIAL PK)   -- effective L = postgres
#$ddl: CREATE INDEX foo_idx ON foo(id)               -- effective L = mysql
#$ddl-mysql: ALTER TABLE foo ROW_FORMAT=DYNAMIC      -- effective L = mysql
```

Applying to MySQL executes lines 1, 3, 4 (in that order). Applying to Postgres executes only line 2. Applying to ClickHouse executes nothing (no matching lines; MAY warn).

## `#$dql` semantics

DQL lines are informational provenance: they document the query that produced the data, or example queries against the recreated schema. They are NOT executed automatically by ExCSV tools. Consumers MAY display them, copy them to clipboard, or pass them to a SQL client.

Multiple `#$dql` lines MAY appear; all are preserved. Order has no execution meaning. Dialect matching for filter/list commands uses the same `MatchKind` rules as `ddl`.

## Keys & constraints (no dedicated construct)

ExCSV has NO key/foreign-key construct — keys are enforcement (SQL layer), not description. Express primary/unique/foreign keys as ordinary ordered `#$ddl` statements (`CREATE TABLE …` then `ALTER TABLE … ADD CONSTRAINT …`); `#$ddl` is repeatable + file-ordered, so sequencing is the author's responsibility.

```
#$ddl-postgres-18: CREATE TABLE orders (order_id BIGINT, line_no INT, customer_id BIGINT, email TEXT)
#$ddl-postgres-18: ALTER TABLE orders ADD CONSTRAINT pk_orders PRIMARY KEY (order_id, line_no)
#$ddl-postgres-18: ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
```

Descriptive layer is separate: `#column unique=1` is a uniqueness hint about the data (not a DB constraint); pack `#fk` is an informational bundle relationship map. See columns.md, pack.md.

## Tooling: `excsv sql apply`

ExCSV tools do **not** embed a SQL engine. `excsv sql apply --dialect=D` (and `excsv sql ddl D`) **MUST** print matching statements to **stdout**, one per line, in file order. The user pipes to a client (`psql`, `mysql`, etc.). No subprocess spawn in v0.3.

Warnings (`family`, `version-mismatch`, unknown dialect, no matches) go to **stderr**.

## Examples

Single-dialect DDL with `sql-dialect` header:

```
#!excsv version=0.3 sql-dialect=mysql
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: GRANT SELECT ON orders TO readonly
#$dql: SELECT * FROM orders WHERE amount > 100
```

Multi-dialect DDL side-by-side:

```
#!excsv version=0.3
#$ddl: CREATE TABLE orders (id INTEGER PRIMARY KEY, amount DECIMAL(8,2))
  ^ effective L = ansi (no header, no suffix)
#$ddl-mysql: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))
#$ddl-clickhouse: CREATE TABLE orders (id UInt64, amount Decimal(8,2)) ENGINE = MergeTree() ORDER BY id
#$dql-postgres: WITH base AS (SELECT * FROM orders WHERE amount > 0) SELECT * FROM base
```

Versioned dialect suffixes:

```
#!excsv version=0.3
#$ddl-postgres: CREATE TABLE t (id SERIAL PRIMARY KEY)
#$ddl-postgres-17: CREATE TABLE t (id BIGSERIAL PRIMARY KEY)
#$ddl-postgres-18: CREATE TABLE t (id BIGSERIAL PRIMARY KEY) INCLUDE (id)
```

`excsv sql ddl postgres-18` → lines 1 (family warn), 2 (version-mismatch warn), 3 (exact). With `--strict` → only line 3.

Multi-statement DDL execution order:

```
#!excsv version=0.3 sql-dialect=postgres
#$ddl: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, email VARCHAR(254) NOT NULL)
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$ddl: CREATE INDEX orders_email_lower ON orders(LOWER(email))
#$ddl: GRANT SELECT ON orders TO readonly
#$ddl-postgres: ALTER TABLE orders SET (autovacuum_enabled = false)
  ^ apply to postgres: execute all 5 statements in order
  ^ apply to mysql:    execute nothing (no matching lines; warn)
```
