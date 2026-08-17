# SQL companions (`#$`)

A file can carry the SQL that goes with it: the `CREATE TABLE` that recreates the schema, and the `SELECT` that produced the data. Ship the data and the recipe together.

```
#$<verb>[-<dialect>]: <one statement>
```

- **`ddl`** — schema statements: `CREATE TABLE`, `CREATE INDEX`, `ALTER`, `GRANT`, seed `INSERT`. Run in the order they appear, top to bottom.
- **`dql`** — queries (`SELECT`). These are for provenance and examples — a record of how the data was pulled, not something that runs automatically.

One statement per line (no multi-line statements — split them into several `#$ddl` lines). Everything after the colon is raw SQL.

Recreating a table from a CSV usually means retyping the schema by hand. Here it's already written down — and you can pipe it straight into your database:

```bash
excsv sql ddl postgres data.excsv | psql
```

## Dialects

Tag a line with the database it's written for by adding a suffix — `#$ddl-postgres:`, `#$ddl-mysql:`, `#$ddl-clickhouse:`. Untagged lines use whatever `sql-dialect=` the header sets, or plain ANSI SQL. You can even ship the same table for several databases side by side and let each consumer pick theirs.

Common dialect tokens (any lowercase name works):

| Token | Database |
| --- | --- |
| `ansi` | ANSI / ISO standard SQL |
| `mysql` | MySQL |
| `mariadb` | MariaDB |
| `postgres` | PostgreSQL |
| `mssql` | Microsoft SQL Server |
| `sqlite` | SQLite |
| `oracle` | Oracle |
| `db2` | IBM Db2 |
| `clickhouse` | ClickHouse |
| `snowflake` | Snowflake |
| `bigquery` | Google BigQuery |
| `duckdb` | DuckDB |

You can pin a version too — `#$ddl-postgres-18:` — when a statement only makes sense on a specific release. Ask a tool for `postgres` and it gives you all the Postgres lines; ask for `postgres-18` and it prefers the version-specific one.

## Keys and constraints

ExCSV's descriptive layer has no primary-key/foreign-key syntax on purpose — keys are a database concern, so you express them as ordinary DDL: a `CREATE TABLE` followed by `ALTER TABLE … ADD CONSTRAINT …`.

```
#$ddl-postgres: CREATE TABLE orders (order_id BIGINT, line_no INT, customer_id BIGINT, email TEXT)
#$ddl-postgres: ALTER TABLE orders ADD CONSTRAINT pk_orders PRIMARY KEY (order_id, line_no)
#$ddl-postgres: ALTER TABLE orders ADD CONSTRAINT uq_email UNIQUE (email)
#$ddl-postgres: ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
```

(`#column unique=1` is a descriptive hint; the real constraint lives here in the SQL layer.)

## Examples

**One dialect via the header:**

```
#!excsv version=0.3 sql-dialect=mysql
#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL) ENGINE=InnoDB
#$ddl: CREATE UNIQUE INDEX orders_email_uq ON orders(email)
#$dql: SELECT * FROM orders WHERE id > 100
```

**Several dialects side by side:**

```
#!excsv version=0.3
#$ddl: CREATE TABLE orders (id INTEGER PRIMARY KEY, amount DECIMAL(8,2))
#$ddl-mysql: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB
#$ddl-postgres: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))
#$ddl-clickhouse: CREATE TABLE orders (id UInt64, amount Decimal(8,2)) ENGINE = MergeTree() ORDER BY id
```

Tools only print the SQL — they don't touch your database. Pipe the output to `psql`, `mysql`, or whatever you use.
