# Charts (`#chart`)

A file **MAY** carry one or more chart suggestions: declarative hints that certain already-declared columns are meant to be viewed together as a specific presentation. `#chart` is **optional and advisory** — like `checksum=` or `#index`, a consumer that ignores it still has a fully valid file (forward-compatible parsing, `01-features.md` P7).

`#chart` is declarative, not imperative: it states a relation between columns that already carry `#column`/`role=`/`agg=` meaning ("`amount` by `category`, as a bar"), the same way `#%` states a precomputed fact about the dataset. It is not a task, query, or prompt for a consumer to execute — see [Columns § Analytical role](columns.md#analytical-role) for `role=`/`agg=`, which every chart channel builds on.

## Syntax

Two forms, matching two existing syntax families in [Meta lines](meta-lines.md):

**Compact form — `#column`-style (bare `key=value`, no colon):**

```
#chart type=<mark> name=<identifier> <channel>=<column> [<channel>=<column> ...] [modifier=value ...]
```

One line per suggested chart, exactly like one `#column` line per column. Multiple `#chart` lines are normal, not conflicting — each is an independent suggestion, even when they reference overlapping columns. `type=` and `name=` are **required** on every compact-form line — see [Required attributes](#required-attributes).

**Escape hatch — verb-style (`#chart-<engine>: <raw payload to EOL>`):**

```
#chart-vega: <raw Vega-Lite unit-spec JSON>
```

For anything the compact vocabulary can't express — facets, layered views (e.g. two measures on independent scales), interactive selections — full Vega-Lite grammar, unrestricted. Same relationship as `#$ddl` (generic) vs `#$ddl-<dialect>` (escape into vendor-specific SQL): the common case stays terse; full power stays available. `vega` is the only defined engine suffix today; an unrecognized `#chart-<engine>:` **MUST** be ignored by parsers that don't implement it (`chart_unknown_type`, WARN — same posture as an unrecognized `type=`).

## Vocabulary (compact form)

### Required attributes

Every compact-form `#chart` line **MUST** carry both:

| Attribute | Meaning | If missing |
| --- | --- | --- |
| `type=` | The mark — see below | `chart_missing_type`, FAIL |
| `name=` | A unique identifier for this `#chart` line, so a consumer (e.g. `excsv chart --name spend_by_category`) can address one suggestion among several without relying on file-order position | `chart_missing_name`, FAIL |

`name=` **MUST** be unique among the `#chart` lines in one file. A duplicate is not fatal — the file still parses — but **MUST** warn (`chart_duplicate_name`); the last line with a given `name=` wins for addressing purposes, the same last-wins rule as `duplicate_column` ([Error handling](error-handling.md#columns)).

### `type=` — mark

Vocabulary borrowed from Vega-Lite `mark`, plus one ASCII-native addition (`sparkline`, which has no Vega-Lite mark of its own — see [Reference renderer](#reference-renderer-asciiterminal) below):

| `type=` | Vega-Lite mark | Typical use | Required channels |
| --- | --- | --- | --- |
| `bar` | `bar` | Bar chart | `x`, `y` |
| `line` | `line` | Trend over time | `x`, `y` |
| `area` | `area` | Area under a line | `x`, `y` |
| `point` | `point` | Scatter (or a one-axis distribution — see [Orientation and variants](#orientation-and-variants)) | `x`, `y` (or `x` alone / `y` alone) |
| `circle` | `circle` | Filled-dot scatter | `x`, `y` |
| `arc` | `arc` | Pie / donut (via `theta`) | `theta` |
| `rect` | `rect` | Heatmap (`x`+`y`+`color`) | `x`, `y`, `color` |
| `tick` | `tick` | Value comparison on one axis | `x` or `y` |
| `boxplot` | `boxplot` | Distribution | `x` or `y` + value |
| `text` | `text` | Numbers/labels as marks | `x`, `y`, `text` |
| `sparkline` | *(none — see below)* | Compact inline trend, no axes | `y` |

A `#chart` line whose mark is missing a channel the table above requires **MUST fail** (`chart_missing_required_channel`). An unrecognized `type=` value **MUST** be ignored by consumers that don't implement it, and **MUST** be preserved on read/write round-trip (`chart_unknown_type`, WARN — same posture as `column_unknown_attribute`).

### Encoding channels

Each channel attribute takes a column **name** — the same restriction as `formula=` ([Columns § Computed columns](columns.md#computed-columns-formula)): reference by name only, never by position or `index=`.

| Channel | Meaning |
| --- | --- |
| `x` / `y` | Primary axes |
| `x2` / `y2` | Second bound of a range (ranged bar, area-between, boxplot whiskers) |
| `color` | Categorical/measure split by color |
| `size` | Point size / stroke width |
| `theta` | Arc angle (pie slice size) — usually a measure |
| `radius` | Arc radius (donut/nightingale, usually paired with `theta`) |
| `shape` | Marker shape (extra category on scatter) |
| `opacity` | Opacity as a channel |
| `column` / `row` | Facet (small multiples) |
| `detail` | Extra grouping with no visual channel (e.g. one line per customer, no color) |
| `order` | Point ordering on line/area (defaults to `x`) |
| `tooltip` | Column(s) to show on hover (comma-separated for several) |
| `text` | Label column for `type=text` |

Channel *type* (nominal/ordinal/quantitative/temporal) is **not** restated here — it is inferred from the referenced column's `#column type=`/`role=`. A per-channel type override (Vega-Lite's ability to force, say, an `int` column to render as nominal instead of quantitative) is **not** part of the compact vocabulary — deferred (`plan/TODO.md` §6, second-tier item); use `#chart-vega` if a forced encoding type is needed today.

**Row-count literal:** `count()` is a reserved value (not a column name) usable wherever a channel expects a column, for "number of rows" — e.g. `#chart type=bar name=rows_by_category x=category y=count()` (bar of row-counts per category) or a histogram's `y=count()`.

### Chart-level modifiers

| Attribute | Value | Meaning |
| --- | --- | --- |
| `title=` | quoted text | Chart title |
| `aggregate=` | `sum`/`avg`/`min`/`max`/`count`/`count_distinct` | Overrides the column's own `agg=` for this chart only |
| `bin=` | `1` or bin count | Bucket a continuous value (histograms) |
| `stack=` | `1`/`0`/`normalize` | Stacking for bar/area with `color=` — see [Orientation and variants](#orientation-and-variants) |
| `sort=` | `asc`/`desc`/column name | Category ordering |
| `limit=` | integer | Top-N cutoff (pairs with `sort=desc`) |
| `hole=` | `0.0`–`1.0` | Donut hole size on `type=arc` |

`aggregate=`/`sort=`/`limit=`/`bin=`/`stack=`/`hole=` apply only to that one `#chart` line; they **MUST NOT** mutate the referenced column's own `#column agg=`.

## Orientation and variants

The compact form has no explicit "horizontal" switch — orientation and variant follow from which channels are set and the referenced columns' inferred types, the same inference Vega-Lite itself uses:

- **Bar orientation.** `x=<dimension> y=<measure>` renders vertical bars; `x=<measure> y=<dimension>` renders horizontal bars. A renderer determines this from the channel/type pairing, not from a dedicated attribute.
- **Grouped vs. stacked bars.** `color=` with `stack=0` (or `stack=` absent) renders grouped (side-by-side) bars, one per `color=` value. `stack=1` renders stacked bars. `stack=normalize` renders a 100%-stacked bar. Without `color=`, `stack=` has no effect.
- **Histogram.** `type=bar bin=<n> x=<measure> y=count()` is a histogram: `bin=` buckets `x`, `y=count()` counts rows per bucket.
- **Scatter vs. one-axis distribution.** `type=point`/`type=circle` with **both** `x` and `y` set is a bivariate scatter. With only **one** of `x`/`y` set, it is a one-axis distribution of that column's values (a dot plot) — a renderer **MAY** lay these out however it needs to (jittered, stacked, binned) since there is no second axis to place them against.

## Examples

```
#column name=category type=string  role=dimension
#column name=amount   type=decimal role=measure agg=sum unit=USD
#column name=region   type=string  role=dimension
#column name=date     type=date    role=time
#column name=discount type=decimal role=measure agg=avg

#chart type=arc name=spend_by_category theta=amount color=category title="Spend by category"
#chart type=arc name=spend_by_category_donut theta=amount color=category hole=0.5
#chart type=bar name=top_categories x=category y=amount sort=desc limit=10
#chart type=bar name=spend_by_region_category x=region y=amount color=category stack=1
#chart type=line name=amount_over_time x=date y=amount
#chart type=point name=amount_vs_discount x=amount y=discount color=category
#chart type=bar name=amount_histogram bin=20 x=amount y=count()
#chart type=rect name=region_category_heatmap x=region y=category color=amount aggregate=avg
#chart type=boxplot name=amount_by_category x=category y=amount
#chart type=sparkline name=amount_trend y=amount title="Amount trend"

#chart-vega: {"mark":"arc","encoding":{"theta":{"field":"amount","aggregate":"sum","type":"quantitative"},"color":{"field":"category","type":"nominal"}}}
```

## Semantics

- Optional, advisory — like `checksum=`/`#index`. A consumer that ignores `#chart` still has a fully valid file.
- Every column referenced by a channel **MUST** already have a `#column name=` declaration in the same table. A channel referencing an undeclared name **MUST fail** (`chart_unknown_column`) — the same restriction as `formula=` (see [Columns § Dependencies](columns.md#dependencies)).
- Multiple `#chart` lines for the same or overlapping columns are normal — each is an independent suggested view, not a conflict to resolve.
- A compact-form line without `type=` or without `name=` **MUST fail** (`chart_missing_type` / `chart_missing_name` — see [Required attributes](#required-attributes)). A duplicate `name=` **MUST warn** (`chart_duplicate_name`), last-wins.

### Pack scoping

`#chart` **MUST NOT** appear on `_manifest.excsv` (`chart_on_manifest`, WARN, ignored) — the same per-table scoping as `#column`: a `#chart` line lives on a table's own `_header.excsv` and its channels resolve only against that table's columns. A pack-level chart spanning multiple tables (which would need `#fk`-style qualification, e.g. `orders.amount`) is **not designed** in this version — deferred alongside the other pack cross-table items in `plan/TODO.md` §7.

## Reference renderer (ASCII/terminal)

`#chart`'s payoff in ExCSV specifically — as opposed to a generic BI-tool hint — is that it is renderable in the exact medium ExCSV already targets: a plain-text terminal, a CI log, a PR diff, an LLM's own context window. No image, no browser, no Vega-Lite runtime required.

A conforming implementation **MAY** provide `excsv chart FILE [--name NAME]` (list all `#chart` lines, or render one) that:

1. Resolves each channel to a column via `#column`, reading already-parsed cell values from the data section.
2. Pre-aggregates per the chart's modifiers (`aggregate=`, `bin=`, `sort=`, `limit=`, `stack=`) exactly as a BI tool building a Vega-Lite spec would.
3. Emits a minimal chart-spec object — `{"chartType": ..., "title": ..., "labels": [...], "series": [{"values": [...]}, ...]}` — and renders it as monospace text.

That spec shape is deliberately compatible with [asciicharts](https://github.com/boligolov/asciicharts) (MIT, Python 3.10+, stdlib-only), usable either as a library (`render_chart(spec)`) or its own CLI (`asciicharts.py spec.json` / stdin), so a conforming `excsv chart` can shell out to or embed it rather than write a terminal chart renderer from scratch. Suggested `type=` → asciicharts `chartType` mapping:

| `#chart type=` | asciicharts `chartType` | Notes |
| --- | --- | --- |
| `bar` | `vbar` / `hbar` | Per the [orientation rule](#orientation-and-variants) above. |
| `bar` with `color=` and `stack=` | `vbar`/`hbar` grouped, stacked, or diverging | asciicharts distinguishes these as rendering modes of the same `hbar`/`vbar` type; diverging follows naturally when values carry mixed sign. |
| `bar` with `bin=` | `histogram` | asciicharts has a dedicated histogram type instead of a generic binned bar. |
| `line` | `line` | |
| `area` | `area` | |
| `point` / `circle` (two channels) | `scatter` | |
| `point` / `circle` (one channel) | `dotplot` | See [one-axis distribution](#orientation-and-variants). |
| `arc` | `pie` | asciicharts' `pie` has no documented donut/`hole=` support — a renderer **MAY** ignore `hole=` and render a plain pie. |
| `rect` | `heatmap` | |
| `boxplot` | `boxplot` | |
| `sparkline` | `sparkline` | The one mark with no Vega-Lite equivalent — added specifically because a dedicated compact-trend primitive is worth having when the target is a single terminal line. |
| `tick` / `text` | *(no direct equivalent)* | Renderer-specific or skipped — see below. |
| two `y`-like channels on independent scales | `dual_axis` | Not expressible in the compact vocabulary; reachable only via a `#chart-vega` layered spec that a renderer chooses to map to `dual_axis`. |

A renderer **MAY** implement only a subset of `type=` values and modifiers. A mark or modifier it doesn't implement **MUST NOT** be treated as a parse error — it is a rendering-capability gap, not a file defect. The renderer **SHOULD** degrade gracefully (e.g. print the chart's `title=` and referenced columns as plain text, or simply skip that `#chart` line) rather than fail the whole file.

## JSON mirror

`#chart` lines mirror into `.excsv.json` as a `charts` array, following the same "every `#` line becomes a key" rule as everything else (see [JSON form](json.md)). A compact-form line becomes a flat object with its `type=` and every channel/modifier as top-level keys; a `#chart-<engine>:` line becomes `{ "vega": <parsed JSON> }` (or the engine-specific key, for a future non-`vega` engine).

## Error conditions

| Condition | Code | Severity |
| --- | --- | --- |
| Compact-form `#chart` line lacks `type=` | `chart_missing_type` | FAIL |
| Compact-form `#chart` line lacks `name=` | `chart_missing_name` | FAIL |
| A channel references a column with no matching `#column name=` in the same table | `chart_unknown_column` | FAIL |
| `type=`'s mark is missing a channel required by that mark (see the [marks table](#type--mark)) | `chart_missing_required_channel` | FAIL |
| `#chart-<engine>:` payload does not parse as valid JSON | `chart_vega_invalid_json` | FAIL |
| Two `#chart` lines share the same `name=` | `chart_duplicate_name` | WARN |
| `#chart` present on a pack manifest (`_manifest.excsv`) | `chart_on_manifest` | WARN |
| Unrecognized `type=` value | `chart_unknown_type` | WARN |
| Unrecognized channel or modifier attribute | `chart_unknown_channel` | WARN |

Full definitions in [Error handling](error-handling.md#charts).
