# SQL (`#$`)

A file MAY carry SQL companions to its data: definitional statements that recreate the table/schema (DDL), and informational queries that produced the data (DQL). These are encoded as a dedicated meta kind with the prefix `#$`.

`#$` was chosen because it is a single character (compact) and visually telegraphs "SQL" (`$` evokes shell/query). It is a peer of `#@`, `#column`, `#%`, and `#csvw` — not a sub-namespace of `#@`.

## Key syntax

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

## Dialect resolution

For each `#$` line, the **effective dialect** is determined as:

1. If the key has an explicit suffix (e.g. `#$ddl-mysql`), the effective dialect is that suffix.
2. Else if the `#!excsv` header sets `sql-dialect=X`, the effective dialect is `X`.
3. Else the effective dialect is `ansi` (portable SQL).

When a consumer wants to apply SQL for a target dialect `D` (e.g. setting up a MySQL database from the file):

1. **Exact match**: lines whose effective dialect equals `D`.
2. **Family match**: if `D` is versioned (`<family>-<version>`) and the line's effective dialect equals `<family>` (or vice versa), it is a match (with a warning is permitted).
3. **No match**: skip the line. If NO line matches `D` for a given verb, implementations MAY warn ("no DDL available for target dialect").

## `#$ddl` execution order

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

## `#$dql` semantics

DQL lines are informational provenance: they document the query that produced the data, or example queries against the recreated schema. They are NOT executed automatically by ExCSV tools. Consumers MAY display them, copy them to clipboard, or pass them to a SQL client.

Multiple `#$dql` lines MAY appear; all are preserved. Order has no execution meaning. Dialect resolution works the same as for `ddl`.

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
  ^ effective dialect = ansi (no header, no suffix)
#$ddl-mysql: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))
#$ddl-clickhouse: CREATE TABLE orders (id UInt64, amount Decimal(8,2)) ENGINE = MergeTree() ORDER BY id
#$dql-postgres: WITH base AS (SELECT * FROM orders WHERE amount > 0) SELECT * FROM base
```

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
