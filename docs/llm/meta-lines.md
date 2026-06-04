# Meta Lines

All start with `#`. Five structured kinds by prefix plus a free-form human-comment line (`##`). Unrecognized `#` lines MUST be ignored (forward-compat). Recommended order: `#@` metadata first, then `#column`, then `#csvw`, then `#$` SQL, then `#%` aggregations. Order within each group does not matter except where stated (e.g. `#$ddl` execution order). Parsers MUST accept any order. `##` human comments MAY appear anywhere in the meta block.

## Human comment: `## ...`

Free-form comment to end of line. MUST be ignored by parsers — carries no structured meaning. Writers MUST NOT use `##` to encode any structured field; it is reserved for human notes.

```
## TODO: drop legacy status values before next quarter
## last reviewed by alex@example.com 2026-03-24
#@source: sales_db.orders
```

`##` lines are NOT preserved in canonical re-serialization unless the implementation specifically opts into preserving them (round-trip mode). The default writer MAY drop them.

## Prefix index

| Kind | Prefix | Detail |
| --- | --- | --- |
| File metadata | `#@key: value` | [file-metadata.md](file-metadata.md) |
| Column | `#column ...` | [columns.md](columns.md) |
| Aggregation | `#%<name>: ...` | [aggregations.md](aggregations.md) |
| CSVW | `#csvw ...` | [csvw.md](csvw.md) |
| SQL | `#$<verb>[-<dialect>]: ...` | [sql.md](sql.md) |
| Pack manifest | `#table`, `#fk` | [pack.md](pack.md) — `_manifest.excsv` only, v0.3 |
