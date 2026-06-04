# Canonical Example (annotated)

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
