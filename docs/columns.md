# Column schema (`#column`)

This is where guessing ends. One `#column` line per column tells anyone — a person or a tool — exactly what it holds: the type, the unit, the display format, the allowed values, what the column is *for*.

```
#column name=id type=int unique=1
#column name=email type=string len_max=254
#column name=amount type=decimal format=0.00 unit=USD
```

Columns are optional and you can annotate as few or as many as you like. No `#column` lines at all is a perfectly valid file — you just get plain CSV with no schema. Describe the three columns that matter and skip the rest; that's fine too.

You identify a column by `name` (matched to the header row) when the file has a header, or by `index` (zero-based position) when it doesn't.

## The attributes

### Identity

| Field | Meaning |
| --- | --- |
| `name` | Column identifier (matches the header cell). No spaces |
| `title` | Human-readable display name (quote it if it has spaces) |
| `description` | Free-text note about the column (quoted) |

### Type and format

| Field | Meaning |
| --- | --- |
| `type` | The data type — see the table below |
| `format` | A display/parse hint, e.g. `format=0.00` for money |

| Type | What it is |
| --- | --- |
| `string` | Text |
| `int` | 32-bit integer |
| `long` | 64-bit integer |
| `float` | 32-bit floating point |
| `double` | 64-bit floating point |
| `decimal` | Exact decimal (money — no float rounding) |
| `boolean` | `true`/`false` (also `1`/`0`) |
| `date` | `YYYY-MM-DD` |
| `time` | `HH:MM:SS` |
| `datetime` | ISO 8601 date-time |
| `uuid` | A UUID |
| `binary` | Base64-encoded bytes |

This is the answer to "is `01720` a number or a ZIP code" and "is that a float or exact money" — you write it down once and no one guesses again.

### Units and semantics

| Field | Meaning |
| --- | --- |
| `unit` | Unit of measurement — `USD`, `kg`, `ms`, … |
| `role` | What the column is *for* analytically: `id`, `dimension`, `measure`, `time` |
| `agg` | For a measure, how it should be aggregated: `sum`, `avg`, `min`, `max`, `none` |
| `order` | Whether the data is sorted: `none`, `asc`, `desc` |
| `separator` | If a cell packs several values, the character between them |

### Allowed values and shape

| Field | Meaning |
| --- | --- |
| `enum` | A closed set of allowed values, pipe-separated |
| `pattern` | A regex the values match |
| `regexp_dialect` | Which regex flavor `pattern` uses: `ecmascript` (default), `pcre`, `posix_ere`, `re2` |
| `min` / `max` | Value bounds (numeric or date) |
| `len_min` / `len_max` | String length bounds |

### Keys and defaults

| Field | Meaning |
| --- | --- |
| `unique` | `1` = values are meant to be unique (a hint) |
| `required` | `1` = not nullable, `0` = nullable |
| `default` | The default the *database* would use on insert — a schema fact, not applied when reading |

A note on `default`: it describes what a target database fills in for a missing value (it shows up as `DEFAULT …` in generated DDL). It is **not** applied when you read the file — an empty cell reads as null, always, so your counts and stats reflect the data as it actually is. Describe reality; don't quietly patch it.

## Enumerations

`enum` lists the allowed non-null values, separated by `|`:

```
#column name=status type=string enum=pending|completed|cancelled
```

- Values are read according to the column's `type` (so `type=int enum=1|2|3` means the integers 1, 2, 3).
- Null is still allowed on top of the list unless the column is `required=1`.
- If a value contains a space, quote the whole attribute: `enum="pending|in progress|done"`. (Enum values can't themselves contain `|`.)
- If both `enum` and `pattern` are set, a value fits both.

## Analytical role

`role` says what a column *means* for analysis, separately from its storage `type`. It's the difference between a number you sum and a number you never sum (an id).

```
#column name=order_id   type=int      role=id
#column name=status     type=string   role=dimension
#column name=amount     type=decimal  role=measure agg=sum
#column name=balance    type=decimal  role=measure agg=avg
#column name=created_at type=datetime role=time
```

| `role` | What it is | What you do with it |
| --- | --- | --- |
| `id` | Identifies a row/entity | count, distinct, join — **never** sum |
| `dimension` | A category to group or filter by | group by, filter, count distinct |
| `measure` | A number to aggregate | sum, avg, min, max |
| `time` | A time axis | group by period, trend, range |

### The `agg` hint

For a measure, `agg` says how it's meant to combine — its *additivity*. This is the guardrail against the classic mistake of summing something you shouldn't:

| `agg` | Behavior | Examples |
| --- | --- | --- |
| `sum` | Add it up across anything | revenue, quantity |
| `avg` | Don't sum across time | balance, price, temperature |
| `min` / `max` | Combine only by extremum | high/low quotes |
| `none` | Not a number to aggregate | ratio, percentage, rating |

A measure with no `agg` defaults to `sum`. `agg` is a hint that steers the *default* choice — notably away from summing a balance across months.
