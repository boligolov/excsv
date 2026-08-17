# File-Level Metadata (`#@`)

Value is raw text to end of line. One optional space after `:` is skipped (for readability). No quoting, no escaping — taken as-is.

Conventional keys (all optional, unknown keys preserved/ignored):

```
source       origin system/table/file
author       creator name/email
comment      free-text description
grain        what a single data row represents (see below)
created      ISO 8601 timestamp
exported     ISO 8601 timestamp
license      license identifier
tool         generating tool/version
tags         comma-separated tags
```

## `grain` — what one row represents

`grain` is free-text describing the unit of one data row, e.g. `one row per order`, `one row per customer per day`, `pre-aggregated monthly totals`. Purely descriptive — carries no validation semantics. It disambiguates how a consumer should interpret and aggregate the table (e.g. whether rows are raw events or already aggregated), instead of forcing it to reverse-engineer the grain from column names.

```
#@grain: one row per order
```

SQL companions (DDL and DQL) MUST be encoded as `#$` lines, not `#@`. See [sql.md](sql.md).

Each `#@` key is unique per file (last-wins on duplicates). Repeatable, ordered statements (like DDL) belong in `#$`.
