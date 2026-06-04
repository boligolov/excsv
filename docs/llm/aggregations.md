# Aggregations (`#%`)

Syntax: `#%<name>: val1,val2,...,valN`

One optional space after `:` is skipped. The remaining payload MUST be parsed using the file's CSV dialect (delimiter, quote, escapes), as if it were a single CSV row. Values are positional per column. Count MUST equal column count. Empty field = not applicable/not computed.

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
