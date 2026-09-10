# ExCSV — Remaining Work (single source)

Still-live reference docs in `plan/` (not backlog):

- `README.md` — repo charter: layout, implementation repos, rules.
- `01-features.md` — abstract capability catalog.
- `02-fixtures.md` — fixture corpus conventions.

When an item lands, tick it here and update the spec/fixtures/reference docs.

Legend: 🔴 blocker · 🟡 should · 🟢 nice-to-have · ✅ done · ↗ deferred (post-v0.5)

**Working rule:** land decisions in the **spec** (`docs/implementation/`) + this file. Fixture corpus is in `fixtures/` and tracks the implementation spec. Further fixture edits only when the spec changes.

---

## 0. Status snapshot

| Area | State |
| --- | --- |
| Spec (`docs/implementation/`) | v0.5; remaining: C10, L1, `#index` (§6) |
| Website | live |
| Feature catalog | draft; version-gating unfinished |
| Fixtures | plain valid 001–070 / invalid 001–039 (FAIL-only); zip/pack via generators |
| Implementation (Go/Python) | full spec (plain + zip + pack), not gated |

---

## 1. Spec loose ends

- 🟢 **C10 — CLI tree wording.** `excsv zip <file>` / `excsv unzip <archive>` are verbs; `peek`/`verify` flat; no `excsv zip <subcmd>` namespace. Reconcile `zip.md` with the Go/Python command tree.

---

## 2. LLM-affordance items

- 🟡 **L1 — "trust aggregates" rule.** When `#%` is present, a consumer MUST trust `#%` over values recomputed from visible/partial rows. `#%` describe the dataset as authored; a slicing/preview tool MUST NOT recompute them for a partial copy. Land in `aggregations.md` (and parser notes). Detection: `rows=` ≠ visible-row count ⇒ `rows_mismatch`. Do **not** add `#@preview`. CLI `head`/`preview` MAY emit an honest slice (real `rows=N`, keep authored `#%`, omit `checksum=`) — tooling, not a format field.
- 🟢 **L6 — second tier.** `example=` on column; lightweight `references=` hint for plain (FK is pack-only today); `#@as-of:` snapshot date; `currency=` split from `unit=`.
- ⛔ **L7 — do NOT add** a task/prompt field to the format. Data ≠ query.

---

## 3. Fixtures — remaining

- ✅ Computed-column fixtures (§5). Done — `plain/valid/068–070`, `plain/invalid/035–039`, `pack/valid/012_compute_no_col`.
- 🟡 `#index` fixtures (§6.5) once the meta line lands in the spec.
- 🟡 CI: regenerate zip/pack via `fixtures/generate/make_*.py` and assert byte-identical to committed.
- 🟢 `plain/valid/NNN_big_100k_rows.excsv` — streaming/perf; **generate on-demand in CI, do not commit**.
- 🟢 `##` round-trip-preservation fixture (if a writer opts in).
- 🟢 `fixtures/fixtures.schema.json` validating `fixtures.yaml`.

---

## 4. Implementation

Go and Python implement the **whole v0.5 spec** in one shot: plain (inline + sidecar), row-ZIP, pack (unsectioned, multi-table, sectioned). No format waves.

Cookbook follows the CLIs. Parity is the shared `fixtures/` tree.

`01-features.md` version-gating (`[v0.5]`/`[later]`) finishes once the command tree is drafted.

---

## 5. Computed (virtual) columns

Spec is the source of truth: `docs/implementation/columns.md` (`formula=`, `materialized=`, materialize/dematerialize per container, the `#$ddl`-not-touched boundary), `sql.md` (DDL generation), `error-handling.md` (codes), `json.md` + `schema/excsv.schema.json` (JSON mapping), guide `docs/columns.md`, website `/spec#computed`.

Remaining:

- ✅ Fixtures — `plain/valid/068_compute_basic.excsv`, `069_compute_materialized.excsv`, `070_compute_case_coalesce.excsv`; `plain/invalid/035_compute_references_computed.excsv`, `036_compute_unknown_ref.excsv`, `037_compute_index_forbidden.excsv`, `038_compute_materialized_mismatch.excsv`, `039_compute_requires_header.excsv`; `pack/valid/012_compute_no_col.excsv.pack.zip` (generated — table has a `formula=` column with no `.col` file). Landed; exercises `D7` in `01-features.md`.
- ✅ Go/Python parser implementation. Done (`column materialize` / `dematerialize` in both).
- 🟡 Go/Python CI hasn't run against these fixtures yet — cross-impl parity on `formula=`/`materialized=` is still unverified until the next upstream sync.

---

## 6. NEW FEATURE — `#index` fenceposts (parallel scan)

**Goal:** Mode A byte offsets so N workers can split a **plain / row-ZIP** file into independent byte-ranges without scanning for newlines.

This is **not** point/range lookup by `id`. Sorted `id` is a different problem (bsearch a value). Parallel scan only needs “where does data-row `k * stride` start in the file?”. The id column MAY be shuffled.

Pack already has this physically: `section-size=` → one ZIP entry per window. Do **not** duplicate `#index` inside a pack.

### 6.1 Syntax

```
#index stride=10000: 0 14280 28512 42800
```

- New meta kind `#index`. Row-family only (plain `.excsv`/`.extsv` and the inner file of `.excsv.zip`).
- `stride=` — data rows per window. Default **10000** (same number as pack `section-size`). Useful values: 2000, 5000, 10000, 20000, 50000.
- Payload: space-separated **absolute byte offsets from start of file** of data-row `0, stride, 2*stride, …` (0-based, **excluding** the header row if `header=1`). Decimal. No ids.
- One line. Ordinary CSV readers ignore `#`.

Worker i seeks to `offset[i]`, reads until `offset[i+1]` (or EOF). Each range starts on a row boundary by construction. Schema comes from `#column` / header fields, not from re-reading the header row.

### 6.2 Budget

- One meta line. ZIP comment hard cap **65535**; the line SHOULD stay **≤ 8 KiB** (editors, git, peek).
- 1M rows × stride 10000 ≈ 100 × u32 ≈ 400 B packed / ~1 KiB ASCII — fine.
- If `ceil(rows/stride)` would blow the budget (e.g. 100M × stride 2000) → writer MUST omit `#index` or increase stride. MUST NOT emit a multi-megabyte one-liner.

### 6.3 Semantics

- Optional. Missing `#index` is valid.
- Advisory, like `checksum=`. Stale or non-boundary offsets → warn `index_stale`, ignore, fall back to linear scan. **Never fail** (C3).
- Mode B writers that rewrite the data section MUST refresh or drop `#index`.
- On pack (`_manifest.excsv` / table `_header.excsv`) → ignore, warn `index_on_pack`. Do **not** reuse `section-size=` on plain (still pack-only → `pack_key_on_plain`).

ZIP comment: include `#index` early (right after `#!excsv`) so `peek` can dispatch workers without extracting.

### 6.4 Catalog

| ID | Feature | RF plain | RF zip | PF | Notes |
| --- | --- | --- | --- | --- | --- |
| G9 | Sparse byte-offset index (`#index stride=`) | ✓ | ✓ | — | PF windows = section ZIP entries |

### 6.5 Fixtures (after spec)

- `plain/valid/NNN_index_stride.excsv` — tiny stride (e.g. 10 on 25 rows), 3 offsets, parse ok.
- `plain/valid/NNN_index_absent.excsv` — no `#index`, still valid.
- `plain/valid/NNN_index_stale.excsv` — parse ok, `warnings: [index_stale]`.
- Zip derived from the valid one (comment carries the line).

### 6.6 Docs to touch

`meta-lines.md`, `data-section.md`, `zip.md` (comment priority), `error-handling.md` (`index_stale`, `index_on_pack`).

---

## 7. NEW FEATURE — `#chart` chart suggestions

**Status:** 🟡 draft / undecided — captured from a design discussion, not yet a spec commitment. Open question: does this belong in the spec at all, or only as a cookbook heuristic derived from existing `role=`/`agg=`/`type=` (see "Open questions" below)? Tension with **L7** ("do NOT add a task/prompt field — Data ≠ query") is real: a chart suggestion is declarative (like `role=`/`agg=`), not imperative (like a query to run), but it's the first meta-line that describes a *relation between columns + a presentation*, not a fact about one column or the dataset as a whole. Land this only after that tension is explicitly resolved.

**Goal:** let a producer (e.g. a data scientist authoring the file) suggest one or more ready-made chart views over already-declared columns, so a consuming tool can render a sensible chart without guessing.

### 7.1 Syntax

Two forms, matching the two existing syntax families in `meta-lines.md`:

**Compact form — `#column`-style (bare `key=value`, no colon):**

```
#chart type=<mark> <channel>=<column> [<channel>=<column> ...] [modifier=value ...]
```

One line per suggested chart (like one `#column` line per column) — multiple `#chart` lines are normal, not conflicting; each is an independent suggestion.

**Escape hatch — `#$`-style (`verb: raw payload to EOL`):**

```
#chart-vega: <raw Vega-Lite unit-spec JSON>
```

For anything the compact vocabulary can't express (facets, layered views, interactive selections) — full Vega-Lite grammar, unrestricted. Same relationship as `#$ddl` (generic) vs `#$ddl-<dialect>` (escape into vendor-specific SQL) — common case stays terse, full power stays available.

### 7.2 Vocabulary (compact form)

**`type=` — mark, vocabulary borrowed from Vega-Lite `mark`:**

| `type=` | Vega-Lite mark | Typical use | Required channels |
| --- | --- | --- | --- |
| `bar` | `bar` | Bar chart | `x`, `y` |
| `line` | `line` | Trend over time | `x`, `y` |
| `area` | `area` | Area under a line | `x`, `y` |
| `point` | `point` | Scatter | `x`, `y` |
| `circle` | `circle` | Filled-dot scatter | `x`, `y` |
| `arc` | `arc` | Pie / donut (via `theta`) | `theta` |
| `rect` | `rect` | Heatmap (`x`+`y`+`color`) | `x`, `y`, `color` |
| `tick` | `tick` | Value comparison on one axis | `x` or `y` |
| `boxplot` | `boxplot` | Distribution | `x` or `y` + value |
| `text` | `text` | Numbers/labels as marks | `x`, `y`, `text` |

**Encoding channels (attributes, each takes a column name):**

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

Channel *type* (nominal/ordinal/quantitative/temporal) is **not** restated here — inferred from the referenced column's `#column type=`/`role=`.

**Chart-level modifiers:**

| Attribute | Value | Meaning |
| --- | --- | --- |
| `title=` | quoted text | Chart title |
| `aggregate=` | `sum`/`avg`/`min`/`max`/`count`/`count_distinct` | Overrides the column's own `agg=` for this chart only |
| `bin=` | `1` or bin count | Bucket a continuous value (histograms) |
| `stack=` | `1`/`0`/`normalize` | Stacking for bar/area with `color=` |
| `sort=` | `asc`/`desc`/column name | Category ordering |
| `limit=` | integer | Top-N cutoff (pairs with `sort=desc`) |
| `hole=` | `0.0`–`1.0` | Donut hole size on `type=arc` |

**Row-count literal:** `count()` is a reserved value (not a column name) usable wherever a channel expects a column, for "number of rows" — e.g. `#chart type=bar x=category y=count()` (bar of row-counts per category) or a histogram's `y=count()`.

### 7.3 Examples

```
#column name=category type=string  role=dimension
#column name=amount   type=decimal role=measure agg=sum unit=USD
#column name=region   type=string  role=dimension
#column name=date     type=date    role=time
#column name=discount type=decimal role=measure agg=avg

#chart type=arc theta=amount color=category title="Spend by category"
#chart type=arc theta=amount color=category hole=0.5
#chart type=bar x=category y=amount sort=desc limit=10
#chart type=bar x=region y=amount color=category stack=1
#chart type=line x=date y=amount
#chart type=point x=amount y=discount color=category
#chart type=bar bin=20 x=amount y=count()
#chart type=rect x=region y=category color=amount aggregate=avg
#chart type=boxplot x=category y=amount

#chart-vega: {"mark":"arc","encoding":{"theta":{"field":"amount","aggregate":"sum","type":"quantitative"},"color":{"field":"category","type":"nominal"}}}
```

### 7.4 Semantics

- Optional, advisory — like `checksum=`/`#index`. A consumer that ignores `#chart` still has a fully valid file (forward-compatible parsing rule, `01-features.md` P7).
- Every column referenced by a channel MUST already have a `#column name=` declaration (chart references by name only — no positional/`index=` form, same restriction as `formula=`).
- `aggregate=`/`sort=`/`limit=`/`bin=`/`stack=`/`hole=` apply only to that one `#chart` line; they never mutate the referenced column's own `#column agg=`.
- Multiple `#chart` lines for the same or overlapping columns are normal — each is an independent suggested view, not a conflict to resolve.
- Mirrors into `.excsv.json` as a `charts: [...]` array, same "every `#` line becomes a key" rule as everything else (see `docs/json.md`).
- Pack (`_manifest.excsv` / table `_header.excsv`): follows the same per-table scoping as `#column`/`#%` — open question, not yet designed (see below).

### 7.5 Open questions

1. **Spec vs cookbook-only.** Does this land as an actual meta-line, or stay a documented heuristic ("dimension + measure(sum) → bar/pie candidate") with zero format changes? Unresolved — see L7 tension above.
2. **Per-channel type override.** Vega-Lite lets you force a field's encoding type per-encoding (e.g. treat an int `year` column as nominal instead of quantitative on an axis). The compact form has no equivalent yet — would need something like `x-type=nominal` if this turns out to matter in practice.
3. **Pack support.** Not designed — does a pack-level `#chart` reference columns across tables (needs `#fk`-style qualification), or stay strictly per-table like `#column`?
4. **Fixtures.** None yet — would need `plain/valid/NNN_chart_*.excsv` (one per mark type, at minimum) and an invalid fixture for "chart references undeclared column" once/if the spec lands.
5. **Docs to touch if it lands:** new `docs/charts.md` (guide) + `docs/implementation/` normative page + `meta-lines.md` (add `#chart` row) + `schema/excsv.schema.json` (`charts` array) + `json.md`.

---

## 8. Deferred / out-of-scope

- F9 pack cross-table DDL ordered by FK; E8 pack cross-table aggregations; M2/M3 pack checksum strategy; L5 per-column `sha256=`; N6 FK-graph viz.
- Sorted-id skip index (id on the fencepost) — not part of §6; add later if we want `WHERE id=` without a scan.
- DuckDB-backed `excsv sql --query`; plugin protocol; encryption; server/daemon; in-process pack query engine.
