# SQL Companions

A file **MAY** carry SQL statements alongside its data: DDL to recreate the schema, and DQL (SELECT queries) for provenance or example use.

## Syntax

```
#$<verb>[-<dialect>[-<version>]]: <payload>
```

- `<verb>` is one of:
  - **`ddl`** — Data Definition Language. `CREATE TABLE`, `CREATE INDEX`, `ALTER`, `GRANT`, seed `INSERT`, etc. **Repeatable, ordered.** Statements **MUST** be executed in file order, top → bottom.
  - **`dql`** — Data Query Language. `SELECT` and friends. Informational provenance — **NOT** executed automatically. Repeatable, order has no execution meaning.
- `<dialect>` is a lowercase ASCII token, optionally followed by a version suffix (e.g. `mysql-8`, `postgres-15`).
- Payload is **raw text to end of line**, exactly like `#@` values. One optional space after `:` is skipped. **One line = one statement.** Embedded newlines are **NOT** supported; split multi-statement DDL into multiple `#$ddl` lines.

## Well-Known Dialect Tokens

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

## Dialect Resolution

For each `#$` line, the **effective dialect** is determined as:

1. If the key has an explicit suffix (e.g. `#$ddl-mysql`), the effective dialect is that suffix.
2. Else if the header sets `sql-dialect=X`, the effective dialect is `X`.
3. Else the effective dialect is `ansi` (portable SQL).

When applying SQL to a target dialect `D`:

1. **Exact match**: lines whose effective dialect equals `D`.
2. **Family match**: if `D` is versioned (`<family>-<version>`) and the line's effective dialect equals `<family>` (or vice versa), it is a match — implementations **MAY** warn.
3. **No match**: skip the line. If no line matches `D` for a given verb, implementations **MAY** warn.

## DDL Execution Order

When applying DDL to a target dialect `D`:

- Iterate **all `#$ddl` lines in file order**.
- For each line, compute its effective dialect.
- If effective dialect matches `D` → execute the statement.
- Else → skip.

Dialect-specific and portable DDL **MAY** be interleaved in the file. Only matching lines are executed; their relative order is preserved.

## Examples

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
