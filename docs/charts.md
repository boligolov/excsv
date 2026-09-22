# Charts (`#chart`)

`#column` says what a value *is*. `#chart` says how a few of them are meant to be *looked at* — a bar of `amount` by `category`, a trend line of `amount` over `date`. It's a suggestion, not a command: a tool that ignores `#chart` still has a perfectly valid file, the same way it's fine to ignore `checksum=`.

```
#column name=category type=string  role=dimension
#column name=amount   type=decimal role=measure agg=sum unit=USD

#chart type=bar x=category y=amount sort=desc limit=10 title="Top categories by spend"
```

You can write as many `#chart` lines as you want, even over the same columns — a bar view and a pie view of the same `category`/`amount` pair are two independent suggestions, not a conflict.

## The vocabulary

`type=` is the mark — borrowed straight from Vega-Lite so the vocabulary isn't invented from scratch:

| `type=` | What it draws |
| --- | --- |
| `bar` | Bars (vertical or horizontal — see below) |
| `line` / `area` | A trend, filled or not |
| `point` / `circle` | Scatter — or, with only one axis set, a one-axis distribution |
| `arc` | Pie / donut (`hole=0.5` for a donut) |
| `rect` | Heatmap (`x` + `y` + `color`) |
| `boxplot` | Distribution box-and-whiskers |
| `tick` | One value marked on an axis |
| `text` | Numbers/labels as the marks themselves |
| `sparkline` | A compact inline trend line, no axes — just `y=` |

Every other attribute is a channel that takes a column name — `x`, `y`, `color`, `theta` (pie slice size), `size`, `detail`, `tooltip`, and a few more for facets and ranges. A column referenced this way **must** already have its own `#column name=` line; `#chart` never invents a column.

Orientation isn't a separate switch. `x=category y=amount` (dimension on `x`, measure on `y`) draws vertical bars; swap them and you get horizontal bars — same inference Vega-Lite makes. Add `color=` and `stack=1` to stack the bars, or leave `stack=0` for them side by side.

`count()` is a reserved stand-in for "number of rows" wherever a channel expects a column — handy for `y=count()` on a histogram (`type=bar bin=20 x=amount y=count()`) or a plain row count per category.

A few modifiers tune the view without touching the column's own metadata: `title=`, `name=` (so you can address one chart among several), `aggregate=` (override the column's `agg=` just for this chart), `sort=`/`limit=` (top-N), `bin=`, `stack=`, `hole=`.

## When the vocabulary isn't enough

Facets, layered views, two measures on independent scales — anything past the compact vocabulary — drop into raw Vega-Lite:

```
#chart-vega: {"mark":"arc","encoding":{"theta":{"field":"amount","aggregate":"sum","type":"quantitative"},"color":{"field":"category","type":"nominal"}}}
```

Same idea as `#$ddl` vs `#$ddl-mysql`: the common case stays terse, the escape hatch stays unrestricted.

## Why this is worth having in a plain-text CSV

A chart hint is only really useful if something can act on it without a browser, a BI tool, or an image — which is exactly the situation ExCSV already targets: a terminal, a CI log, a code review, an LLM's context window. That's what makes `#chart` different from "just render it in Vega-Lite" — it's meant to be rendered as **text**.

[asciicharts](https://github.com/boligolov/asciicharts) is a good match for that: MIT-licensed, pure Python standard library, and it renders bars, lines, scatter, pie, heatmaps, boxplots, histograms, and sparklines as monospace ASCII/ANSI art from a small JSON spec — `{"chartType": ..., "labels": [...], "series": [...]}`. A tool reading `#chart type=bar x=category y=amount` already has everything needed to build that spec (resolve the columns, aggregate per the modifiers) and hand it to something like asciicharts to print straight to the terminal:

```
excsv chart sales.excsv
```

No image renderer, no headless browser — the same file you already `grep` and `pandas.read_csv` also draws its own chart, in the same monospace font as everything else in your terminal.

## Full details

The precise grammar, the marks-to-channels requirement table, pack scoping, error conditions, and the asciicharts mapping table live in [implementation/charts.md](implementation/charts.md).
