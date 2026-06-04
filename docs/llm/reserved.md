# Reserved for Future Use

The identifiers below are **reserved in v0.2** for a planned column-oriented multi-table archive format (`.excsv.pack.zip`). They are NOT defined by v0.2 and writers conforming to v0.2 MUST NOT emit them. Reservation prevents conflicting use of these names in third-party extensions before the format ships.

Readers conforming to v0.2 MUST follow the existing forward-compat rules when encountering them: unknown header keys → ignored (per [header.md](header.md)), unknown `#`-prefixed meta lines → ignored (per [meta-lines.md](meta-lines.md)). No special handling is required.

## Reserved file extensions

```
.excsv.pack.zip     planned multi-table columnar archive (CSV dialect)
.extsv.pack.zip     planned multi-table columnar archive (TSV dialect)
```

## Reserved header keys

```
layout       planned values: "row" (current implicit), "columnar" (per-table inside a pack), "pack" (manifest)
mode         planned values: "multi-table", "single-table" (manifest of a pack only)
section-size planned integer, row chunk size for columnar tables
table-count  planned integer, informational, manifest of a pack only
```

## Reserved meta-line kinds

```
#table  planned, manifest-only: declares a table inside a pack
#fk     planned, manifest-only: informational foreign-key declaration between tables in a pack
```

Behavior, syntax, and full semantics of the above will be defined in a future spec revision. Until then they have no meaning under v0.2.
