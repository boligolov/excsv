# Aggregations

## Aggregation Values

```
#%count_nonnull: ,98,100
#%sum: ,,154280.50
#%avg: ,,1542.81
```

- `<name>` **MUST** be a well-known aggregation name (see below).
- One optional space after `:` is skipped. The remaining payload **MUST** be parsed using the file's CSV dialect (delimiter, quote character, escapes), as if it were a single CSV row.
- Value count **MUST** equal the number of columns.
- Aggregation line order does not matter. Parsers **MUST** accept any order.
- Aggregations **MUST** be parsed using the resolved CSV dialect. If the header is absent, the default dialect **MUST** be used.

## Standard Aggregations

**Universal** (any type):

| Name             | Description              |
| ---------------- | ------------------------ |
| `count_nonnull`  | Count of non-null values |
| `count_null`     | Count of null values     |
| `count_distinct` | Count of distinct values |

**Numeric** (`int`, `long`, `float`, `double`, `decimal`):

| Name  | Description     |
| ----- | --------------- |
| `sum` | Sum of values   |
| `avg` | Arithmetic mean |
| `min` | Minimum value   |
| `max` | Maximum value   |

**String** (`string`):

| Name     | Description               |
| -------- | ------------------------- |
| `len_min` | Length of shortest string |
| `len_max` | Length of longest string  |

## Null Handling

Aggregations follow SQL semantics: null values are **excluded** from computation.

- `sum`, `avg`, `min`, `max`, `len_min`, `len_max` — nulls are skipped.
- `count_nonnull` — counts non-null values only.
- `count_null` — counts null values only.
- `count_distinct` — counts distinct **non-null** values only.

## Type Compatibility

- Implementations **SHOULD** validate aggregation compatibility with the column type.
- Implementations **MAY** ignore invalid combinations with a warning.

## Missing Values

An empty field in an aggregation row **MUST** mean "not applicable" or "not computed."
