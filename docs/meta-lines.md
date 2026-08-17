# Meta Lines

Meta lines appear after the header line and before the data section.

## General Rules

- Meta lines **MUST** start with `#`.
- Meta lines **MUST** precede the data section.
- Parsing of meta lines **MUST** stop at the first non-`#` line.
- Lines starting with `##` are **human comments** — they carry no structured meaning and **MUST** be ignored by parsers. Writers **MUST NOT** emit `##` as part of any structured field; it is reserved for free-form notes ("comment to end of line").
- Other unrecognized `#` lines **MUST** be ignored (forward-compatibility for future meta kinds).
- Recommended order: `#@` metadata first, then `#column`, then `#csvw`, then `#$` SQL, then `#%` aggregations. Order within each group does not matter, except where stated (e.g. `#$ddl` execution order). Parsers **MUST** accept any order. `##` comments **MAY** appear anywhere in the meta block.

## Types of Meta Lines

Five recognized structured kinds plus a human-comment line, by prefix:

| Prefix                       | Purpose             | Example                                  |
| ---------------------------- | ------------------- | ---------------------------------------- |
| `## ...`                     | Human comment (ignored by parsers; comment to end of line) | `## TODO: drop legacy status values` |
| `#@key: value`               | File-level metadata | `#@source: sales_db.orders`              |
| `#column ...`                | Column annotation   | `#column name=id type=int`               |
| `#csvw: ...`                 | CSVW payload        | `#csvw: {"tableSchema": ...}`            |
| `#$<verb>[-<dialect>]: ...`  | SQL companion       | `#$ddl-mysql: CREATE TABLE orders (...)` |
| `#%<name>: ...`              | Aggregation values  | `#%sum: ,, 42.5`                         |

See dedicated pages: [File metadata](file-metadata.md), [Columns](columns.md), [SQL](sql.md), [Aggregations](aggregations.md), [CSVW](csvw.md).

### Pack manifest only

On `_manifest.excsv` inside `.excsv.pack.zip` / `.extsv.pack.zip` only:

| Prefix | Purpose | Example |
| --- | --- | --- |
| `#table ...` | Declares a table directory | `#table name=orders dir=orders/ columns=4 original-size=1843200` |
| `#fk ...` | Informational foreign key | `#fk from=orders.customer_id to=customers.id` |

These **MUST NOT** appear in plain or row-ZIP files or table `_header.excsv`. See [Pack container](pack.md).
