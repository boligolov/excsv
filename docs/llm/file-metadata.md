# File-Level Metadata (`#@`)

Value is raw text to end of line. One optional space after `:` is skipped (for readability). No quoting, no escaping — taken as-is.

Conventional keys (all optional, unknown keys preserved/ignored):

```
source       origin system/table/file
author       creator name/email
comment      free-text description
created      ISO 8601 timestamp
exported     ISO 8601 timestamp
license      license identifier
tool         generating tool/version
tags         comma-separated tags
```

SQL companions (DDL and DQL) MUST be encoded as `#$` lines, not `#@`. See [sql.md](sql.md).

Each `#@` key is unique per file (last-wins on duplicates). Repeatable, ordered statements (like DDL) belong in `#$`.
