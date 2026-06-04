# File-Level Metadata (`#@`)

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

SQL companions (`ddl`, `dql`) are encoded as `#$` lines, not `#@`. See [SQL](sql.md).

Each `#@` key is unique per file (last-wins on duplicates).

Example:

```
#!excsv version=0.3 delim=comma header=1
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
