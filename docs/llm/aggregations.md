# Aggregations (`#%`)

Syntax: `#%<name>: val1,val2,...,valN`

One optional space after `:` is skipped. The remaining payload MUST be parsed using the file's CSV dialect (delimiter, quote, escapes), as if it were a single CSV row. Values are positional per column. Count SHOULD equal the PHYSICAL column count (stored + materialized; virtual computed columns have no value slot); fewer → trailing columns carry no aggregate, more → warn agg_arity_mismatch. Advisory, never fatal (description may lag data). Empty field = not applicable/not computed.

## Standard aggregation names

```
UNIVERSAL (any type):
  count_nonnull    count of non-null values
  count_null       count of null values
  count_distinct   count of distinct values

NUMERIC (int, long, float, double, decimal):
  sum              sum
  avg              arithmetic mean
  min              minimum
  max              maximum

STRING (string):
  len_min           shortest string length
  len_max           longest string length
```

Null handling (SQL semantics): `sum`, `avg`, `min`, `max`, `len_min`, `len_max` exclude nulls. `count_nonnull` counts non-nulls. `count_null` counts nulls. `count_distinct` counts distinct non-null values only.

Aggregation line order does not matter. `#%max` may appear before `#%sum`.

Aggregations MUST be parsed using the resolved CSV dialect. If header is absent, default dialect MUST be used.

Type compatibility SHOULD be validated. Invalid combos MAY produce warning.

## Multi-value columns (`separator=`)

All `#%` aggregations operate over the **whole cell value**, even for columns that declare `separator=` (multi-value cells). For example, `count_distinct` on a `separator=|` column counts distinct *cells* (`urgent|retail` is one value), not distinct sub-values. Sub-value (exploded) aggregations are out of scope for v0.3.

## Aggregation name grammar

A standard aggregation name matches `[a-z_][a-z0-9_]*` (lowercase). Custom aggregation names match `x-[a-z0-9-]+`. Names outside the standard set above are unknown:

- Unknown standard-looking names (no `x-` prefix) → ignore, MAY warn.
- Custom aggregations MUST use an `x-` prefix (`#%x-median:`, `#%x-p95:`), mirroring `x-` custom column attributes. Parsers MUST preserve `x-` aggregation lines and MUST NOT fail on them. The `x-` prefix is exempt from being treated as an unknown/invalid name.
