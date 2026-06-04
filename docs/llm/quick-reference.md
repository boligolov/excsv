# Quick-Reference Examples

## Minimal (header-only stub)

```
#!excsv version=0.3
```

## Sidecar (metadata for external CSV)

```
#!excsv version=0.3 delim=comma header=1 rows=2 reference=sales.csv
#column name=id type=int
#column name=name type=string
```

(sibling `sales.csv` holds data rows; sidecar MUST NOT contain any data lines)

## Schema-less (no #column lines)

```
#!excsv version=0.3 delim=comma header=1
name,age,city
Alice,30,NYC
Bob,25,LA
```

## header=0 with index

```
#!excsv version=0.3 delim=tab header=0
#column index=0 name=id type=int
#column index=1 name=value type=decimal
1	99.50
2	200.00
```

## quote=none (no quoting)

```
#!excsv version=0.3 delim=pipe header=1 quote=none
name|score|grade
Alice|95|A
Bob|87|B+
```

## null (default: empty field = null)

```
#!excsv version=0.3 delim=comma header=1
name,email
Alice,
Bob,bob@test.com
  ^ email for Alice is null (empty field is always null by default)
```

## null=NA (non-empty null marker)

```
#!excsv version=0.3 delim=comma header=1 null=NA
name,email
Alice,NA
Bob,bob@test.com
  ^ email for Alice is null (both empty fields and "NA" are null)
```

## Quote doubling (both header and data)

```
#!excsv version=0.3 delim=comma quote=double header=1
#column name=name type=string
#column name=note type=string description="contains ""special"" chars"
  ^ "" in header value produces literal "
name,note
Alice,"She said ""hello"" to everyone"
Bob,"Line1, then more"
  ^ "" in data field produces literal " — same doubling rule everywhere
```

## SQL section: multi-dialect DDL and DQL

```
#!excsv version=0.3 delim=comma header=1
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

## sql-dialect header (avoid suffixing every line)

```
#!excsv version=0.3 delim=comma header=1 sql-dialect=postgres-15
#$ddl: CREATE TABLE events (id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ, payload JSONB)
#$ddl: CREATE INDEX events_ts_brin ON events USING BRIN(ts)
#$ddl: GRANT SELECT ON events TO readonly
#$dql: SELECT * FROM events WHERE ts >= NOW() - INTERVAL '24 hours'
  ^ all #$ lines have effective dialect = postgres-15 (from header)
id,ts,payload
1,2026-04-01T00:00:00Z,{}
```

## Zipped (.excsv.zip) — inner file header

```
#!excsv version=0.3 delim=comma quote=double header=1 rows=1000 checksum=sha256:e3b0c442... original-size=204800
  ^ original-size is REQUIRED in zipped files; it MUST match the ZIP central dir uncompressed_size.
```
