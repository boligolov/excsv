# Pack container

A **pack** (`.excsv.pack.zip`) is ExCSV for wide tables and multi-table snapshots. Instead of storing rows, it stores each **column** as its own file inside a ZIP, and can hold **several tables** in one archive with the relationships between them.

Why you'd want it:

- **Read a few columns out of many** without decompressing the rest — grab `amount` and `date` from a 200-column export cheaply.
- **Bundle related tables** (orders + customers + products) in one file, with their foreign keys written down.
- **Better compression** — a column of one type squeezes far better than mixed rows.
- **Cheap to append a column** later.

Everything else — types, stats, SQL, checksums — still applies, per table. Plain `.excsv` and row `.excsv.zip` files are untouched by this; pack is just an additional shape.

## What's inside

A manifest at the top, then one folder per table, one `.col` file per column:

```
sales.excsv.pack.zip
├── _manifest.excsv             ← the table of contents
├── orders/
│   ├── _header.excsv           ← the table's schema + stats
│   ├── 00-id.col
│   ├── 01-customer_id.col
│   ├── 02-amount.col
│   └── ...
├── customers/
│   ├── _header.excsv
│   ├── 00-id.col
│   └── ...
└── products/
    └── ...
```

The **manifest** lists the tables and the links between them:

```
#!excsv version=0.3 layout=pack table-count=3 original-size=3123200
#@pack-name: sales-q1-2026
#@author: ops@example.com
#@created: 2026-04-01T00:00:00Z
#@source: warehouse-snapshot
#@comment: Q1 sales pulled for finance review
#table name=orders    dir=orders/    columns=4 original-size=1843200
#table name=customers dir=customers/ columns=2 original-size=512000
#table name=products  dir=products/  columns=3 original-size=768000
#fk from=orders.customer_id to=customers.id
#fk from=orders.product_id  to=products.id
```

- `#table` registers a table directory and its column count.
- `#fk` records a foreign key — a map of how tables relate. It's informational: it documents the relationship, it doesn't enforce it.

Each table's **`_header.excsv`** is exactly the ExCSV metadata you already know — `#column`, `#$ddl`, `#%` — plus a `rows=` count. Different tables can have different schemas.

```
#!excsv version=0.3 layout=columnar rows=237000 sql-dialect=postgres
#@source: sales_db.orders
#column name=id type=int unique=1
#column name=customer_id type=int
#column name=amount type=decimal unit=USD
#column name=note type=string
#$ddl: CREATE TABLE orders (...)
#%count_nonnull: 237000,237000,237000,234810
#%sum: ,,3854720.50,
```

Each **`.col`** file is one value per line, plain text — nothing fancy.

For very large tables, columns can be split into fixed-size **sections** so a tool can jump straight to row *N* without scanning the whole column. That's a performance detail; the shape above is what you interact with.

## Single vs multi-table

A pack is always structured as "manifest + table folders," even with one table. If the manifest sets `single-table=orders`, table-scoped commands default to that table so you don't have to name it every time. Add a second table and that default just drops away — no ceremony.

## Working with a pack

The tooling follows a `excsv PACKFILE <command>` pattern, with `--table` to scope into a table:

```powershell
# whole pack
excsv sales.excsv.pack.zip info
excsv sales.excsv.pack.zip table list
excsv sales.excsv.pack.zip fk list

# one table
excsv sales.excsv.pack.zip rows       --table orders
excsv sales.excsv.pack.zip header list --table orders
excsv sales.excsv.pack.zip sql list    --table orders --verb ddl

# one column
excsv sales.excsv.pack.zip col get amount --table orders

# building and editing
excsv orders.excsv pack create -o sales.excsv.pack.zip
excsv sales.excsv.pack.zip table add products --from products.excsv
excsv sales.excsv.pack.zip table extract customers -o customers.excsv
```

Because the manifest is mirrored into the ZIP comment (like a plain `.excsv.zip`), a quick `info` or `table list` can read the pack's contents without unpacking it. Packs can be password-protected the same way, too.

> The exact archive rules — entry order, sizes, section boundaries, validation — are in [implementation/pack.md](implementation/pack.md).
