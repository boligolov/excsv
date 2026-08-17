# SQL Companions

A file **MAY** carry SQL statements alongside its data: DDL to recreate the schema, and DQL (SELECT queries) for provenance or example use.

## Syntax

```
#$<verb>[-<dialect-suffix>]: <payload>
```

- `<verb>` is one of:
  - **`ddl`** — Data Definition Language. `CREATE TABLE`, `CREATE INDEX`, `ALTER`, `GRANT`, seed `INSERT`, etc. **Repeatable, ordered.** Statements **MUST** be executed in file order, top → bottom.
  - **`dql`** — Data Query Language. `SELECT` and friends. Informational provenance — **NOT** executed automatically. Repeatable, order has no execution meaning.
- `<dialect-suffix>` is optional: a lowercase ASCII dialect token, optionally followed by `-<version>` (e.g. `mysql`, `postgres-17`, `mysql-9`). Version comparison is **string equality**, not semver.
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

Writers **SHOULD** emit the canonical token when one exists. Readers **MUST** treat aliases as equivalent but **SHOULD NOT** emit aliases.

## Effective dialect

For each `#$` line:

1. If the key has an explicit suffix (e.g. `#$ddl-mysql-9`), parse it into `(dialect, version)` and form effective token `L` = `dialect` or `dialect-version`.
2. Else if the header sets `sql-dialect=X`, parse `X` the same way → `L`.
3. Else `L = ansi`.

Parse suffixes by matching the longest well-known dialect prefix; a trailing `-<version>` is optional. Unknown prefixes are preserved as the whole suffix (MAY warn).

## Dialect matching

When applying or filtering for target `D`, classify each line's `L` with **MatchKind**:

| Target `D` | Line `L` | MatchKind | Default |
| --- | --- | --- | --- |
| `postgres` | `postgres` | `exact` | include |
| `postgres` | `postgres-18` | `family` | include; warn |
| `postgres-18` | `postgres` | `family` | include; warn |
| `postgres-18` | `postgres-18` | `exact` | include |
| `postgres-18` | `postgres-17` | `version-mismatch` | include; warn |
| `postgres-18` | `mysql` / `mysql-9` | `none` | skip |

- **exact** — same dialect and same version (or both unversioned).
- **family** — same dialect, exactly one side unversioned.
- **version-mismatch** — same dialect, both versioned, versions differ (string compare).
- **none** — different dialect families.

`--strict` on apply: `version-mismatch` → skip instead of warn+include.

`excsv sql ddl postgres` includes generic `postgres` and all `postgres-<version>` lines (family-down). `excsv sql ddl postgres-18` includes `postgres-18` (exact) and generic `postgres` (family-up). All matching lines run in file order.

## DDL execution order

Iterate all `#$ddl` lines in file order; include lines whose MatchKind is `exact`, `family`, or `version-mismatch` (unless `--strict` skips version-mismatch). Skip `none`.

## Keys & constraints

ExCSV has **no dedicated key/foreign-key construct**. Keys are enforcement, which belongs to the SQL layer, not to the descriptive schema. Express them as ordinary `#$ddl` statements in whatever dialect you target — typically a `CREATE TABLE` followed by `ALTER TABLE … ADD CONSTRAINT …`:

```
#$ddl-postgres-18: CREATE TABLE orders (order_id BIGINT, line_no INT, customer_id BIGINT, email TEXT)
#$ddl-postgres-18: ALTER TABLE orders ADD CONSTRAINT pk_orders PRIMARY KEY (order_id, line_no)
#$ddl-postgres-18: ALTER TABLE orders ADD CONSTRAINT uq_email UNIQUE (email)
#$ddl-postgres-18: ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
```

`#$ddl` is repeatable and executed in file order, so the sequence is the author's responsibility. The descriptive layer stays separate: `#column unique=1` is a uniqueness *hint* about the data (for the parser and analyst), not a DB constraint; in pack, `#fk` is an informational relationship map for the bundle. See [Columns](columns.md#keys) and [Pack](pack.md).

## Tooling

ExCSV tools **do not** run SQL against a database. `excsv sql apply --dialect=D` prints matching statements to **stdout** in file order; warnings go to **stderr**. Pipe to `psql`, `mysql`, etc.

## Examples

**Single dialect via header:**

```
#!excsv version=0.3 sql-dialect=mysql
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$dql: SELECT * FROM orders WHERE id > 100
```

**Multi-dialect side-by-side:**

```
#!excsv version=0.3
#$ddl: CREATE TABLE orders (id INTEGER PRIMARY KEY, amount DECIMAL(8,2))
#$ddl-mysql: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))
#$ddl-clickhouse: CREATE TABLE orders (id UInt64, amount Decimal(8,2)) ENGINE = MergeTree() ORDER BY id
```

**Versioned suffixes:**

```
#$ddl-postgres: CREATE TABLE t (id SERIAL PRIMARY KEY)
#$ddl-postgres-17: CREATE TABLE t (id BIGSERIAL PRIMARY KEY)
#$ddl-postgres-18: CREATE TABLE t (id BIGSERIAL PRIMARY KEY) INCLUDE (id)
```

`excsv sql ddl postgres-18` → line 1 (family warn), line 2 (version-mismatch warn), line 3 (exact). `--strict` → only line 3.
