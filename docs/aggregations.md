# Aggregations (`#%`)

Here's the quiet superpower. A `#%` line carries a pre-computed statistic for the whole dataset — one value per column, laid out like a CSV row so it lines up under the columns it describes:

```
#%count_nonnull: ,98,100
#%sum: ,,154280.50
#%avg: ,,1542.81
```

Read that as: column 2 has 98 non-null values, column 3 has 100; column 3 sums to 154,280.50 and averages 1,542.81. Empty slots mean "no aggregate for this column."

**Why it matters:** the total is now a *fact written in the file*, not something a tool recomputes from whatever rows it happened to load. Paste the first 50 rows of a million-row table into anything, and `#%sum` still tells the truth about the full dataset — the visible slice can't lie to you. That's the difference between "the sum of what I can see" and "the sum of the data."

## The aggregates

**Any type:**

| Name | Meaning |
| --- | --- |
| `count_nonnull` | How many values aren't null |
| `count_null` | How many are null |
| `count_distinct` | How many distinct (non-null) values |

**Numbers** (`int`, `long`, `float`, `double`, `decimal`):

| Name | Meaning |
| --- | --- |
| `sum` | Total |
| `avg` | Mean |
| `min` | Smallest |
| `max` | Largest |

**Strings:**

| Name | Meaning |
| --- | --- |
| `len_min` | Shortest string's length |
| `len_max` | Longest string's length |

## Nulls

Aggregates follow the same rules SQL does: nulls sit out. `sum`, `avg`, `min`, `max`, `len_min`, `len_max` skip them; `count_distinct` counts distinct non-null values; `count_null` counts only the nulls. So the numbers mean what you'd expect from a database.

The values are written in the file's own CSV dialect, and the line order doesn't matter — put `sum` before or after `avg`, it's the same.
