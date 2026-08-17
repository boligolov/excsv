# Pack — LLM reference

Extensions: `.excsv.pack.zip`, `.extsv.pack.zip`. Columnar multi-table ZIP.

## Structure (always manifest + table dirs)

```
_manifest.excsv          # layout=pack, version=0.3, original-size=sum(#table original-size)
<table>/
  _header.excsv         # layout=columnar, rows=N, section-size optional
  00-name.col           # or 00-name/000000.col sections
```

## Manifest header

```
#!excsv version=0.3 layout=pack original-size=<bytes> [single-table=<name>] [table-count=N]
```

- `original-size` = sum of all `#table original-size=` (uncompressed `.col` bytes only; excludes `_header.excsv`). Not the same as row-ZIP `original-size` (whole inner file) — see [header.md](header.md#original-size-scopes).
- `single-table=<name>`: optional default for `--table`; dropped when second table added.
- Manifest-only meta: `#table name= dir= columns= original-size=`, `#fk from=t.c to=t.c` (informational).

## Table header

```
#!excsv version=0.3 layout=columnar rows=N [section-size=10000]
#column ...
```

- `.col`: one value per line; `<idx>-<safe_name>.col` or section folder `<idx>-<name>/<start>.col`.
- `section-size=0` or absent = flat column file.

## Scopes (CLI)

| Scope | Flag | Target |
| --- | --- | --- |
| Pack | (no --table) | _manifest.excsv |
| Table | --table name | _header.excsv + .col |

Pack commands: validate, info, cat, meta list, table list, fk list.
Table: rows, header list, meta list, sql list (reuse row-ZIP subcommands).
Pack-native: col list, col get, col cat.
Authoring: pack create, table add/drop/extract.

## Validation highlights

- Manifest first ZIP entry; version=0.3; layout=pack.
- columns= is the physical column count = non-virtual `#column` count (stored + materialized); virtual computed columns (formula= without materialized=1) have no .col and are excluded. original-size matches .col uncompressed sum.
- Each .col (or section set) line count = rows.
- Auto-discovery: if no #table lines, subdirs with _header.excsv, alphabetical, SHOULD warn.

## Not

DB, query engine, nested packs, or replacement for plain .excsv / row .excsv.zip.

Full spec: [pack.md](../pack.md).
