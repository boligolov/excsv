# File-Level Metadata (`#@`)

The value is **raw text** to the end of the line. One optional space after `:` is skipped (for readability). No quoting or escaping is applied — the value is taken as-is.

The following `#@key: value` keys are conventional. Implementations **MAY** use any key; unknown keys **MUST** be preserved or ignored.

| Key        | Description                          | Example                            |
| ---------- | ------------------------------------ | ---------------------------------- |
| `source`   | Origin system, table, or file        | `#@source: sales_db.orders`        |
| `author`   | Creator contact or name              | `#@author: alex@example.com`       |
| `comment`  | Free-text description of the dataset | `#@comment: demo dataset`          |
| `grain`    | What a single data row represents    | `#@grain: one row per order`       |
| `created`  | Creation timestamp (ISO 8601)        | `#@created: 2026-03-24T12:00:00Z`  |
| `exported` | Export timestamp                     | `#@exported: 2026-03-24T14:30:00Z` |
| `license`  | Data license identifier              | `#@license: CC-BY-4.0`             |
| `tool`     | Tool/version that generated the file | `#@tool: excsv-cli/0.2.0`          |
| `tags`     | Comma-separated tags                 | `#@tags: sales,Q1,2026`            |
| `comment-truncated` | ZIP comment only — peek is incomplete | `#@comment-truncated: 1`     |

SQL companions (`ddl`, `dql`) are encoded as `#$` lines, not `#@`. See [SQL](sql.md).

`#@comment-truncated: 1` is written by the zipper into the **archive comment**, not into the inner file, when the 65535-byte ZIP comment budget ran out and some `#` lines were omitted. Readers **MUST** treat it as “peek is incomplete; the inner file is authoritative.” It **MUST NOT** appear on a plain `.excsv` / `.extsv` (or a pack table header); if it does, ignore it. See [ZIP](zip.md#truncation-marker) and [Pack](pack.md#zip-comment-manifest-summary).

Each `#@` key is unique per file (last-wins on duplicates).

## `grain` — what one row represents

`grain` is free-text describing the unit of one data row (for example `one row per order`, `one row per customer per day`, or `pre-aggregated monthly totals`). It is descriptive and carries no validation semantics.

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
