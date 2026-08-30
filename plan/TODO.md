# ExCSV — Remaining Work (single source)

Still-live reference docs in `plan/` (not backlog):

- `README.md` — repo charter: layout, implementation repos, rules.
- `01-features.md` — abstract capability catalog.
- `02-fixtures.md` — fixture corpus conventions.

When an item lands, tick it here and update the spec/fixtures/reference docs.

Legend: 🔴 blocker · 🟡 should · 🟢 nice-to-have · ✅ done · ↗ deferred (post-v0.4)

**Working rule:** land decisions in the **spec** (`docs/implementation/`) + this file. Fixture corpus is in `fixtures/` and tracks the implementation spec. Further fixture edits only when the spec changes.

---

## 0. Status snapshot

| Area | State |
| --- | --- |
| Spec (`docs/implementation/`) | v0.4; remaining: C10, L1, computed columns (§5), `#index` (§6) |
| Website | live |
| Feature catalog | draft; version-gating unfinished |
| Fixtures | plain valid 001–066 / invalid FAIL-only; zip/pack via generators |
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

- 🟡 Computed-column fixtures (§5.8) once `formula=` lands in implementation docs.
- 🟡 `#index` fixtures (§6.5) once the meta line lands in the spec.
- 🟡 CI: regenerate zip/pack via `fixtures/generate/make_*.py` and assert byte-identical to committed.
- 🟢 `plain/valid/NNN_big_100k_rows.excsv` — streaming/perf; **generate on-demand in CI, do not commit**.
- 🟢 `##` round-trip-preservation fixture (if a writer opts in).
- 🟢 `fixtures/fixtures.schema.json` validating `fixtures.yaml`.

---

## 4. Implementation

Go and Python implement the **whole v0.4 spec** in one shot: plain (inline + sidecar), row-ZIP, pack (unsectioned, multi-table, sectioned). No format waves.

Cookbook follows the CLIs. Parity is the shared `fixtures/` tree.

`01-features.md` version-gating (`[v0.4]`/`[later]`) finishes once the command tree is drafted.

---

## 5. NEW FEATURE — Computed (virtual) columns

**Goal:** a column that stores a *formula*, not data. Values are derived from other columns on read. Zero stored bytes. Payoff is largest in **pack**: pure metadata, no `.col`.

Not yet in `docs/implementation/` (`formula=` missing from `columns.md` / `error-handling.md`). Spec + fixtures land before parsers.

### 5.1 Syntax — `#column formula=` (DECIDED)

```
#column name=total     type=decimal formula="price * quantity"                  # virtual (no stored data)
#column name=margin     type=decimal formula="(price - cost) / price"
#column name=full_name  type=string  formula="concat(first_name, ' ', last_name)"
#column name=total     type=decimal formula="price * quantity" materialized=1    # values ALSO cached in the data
```

> **DECISION D-1 (owner, resolved):** `formula=` on `#column` marks a computed column; no separate `#compute` kind. Fold into v0.4.

`formula=` is the definition and is never dropped. `formula-dialect=` is optional. A computed column MUST NOT carry `index=`.

`formula=` **(definition) vs** `materialized=` **(cache):**

| | `materialized` absent / `0` (**virtual**) | `materialized=1` |
| --- | --- | --- |
| Values in the data | none | present (header cell + fields / `.col`) |
| Storage cost | zero | full column |
| `formula=` kept | yes | **yes** |
| DDL emitted | `GENERATED … VIRTUAL` (ClickHouse `ALIAS`) | `GENERATED … STORED` (ClickHouse `MATERIALIZED`) |

Materialization is a reversible cache toggle. A materialized computed column still cannot be referenced by other formulas (§5.4).

### 5.2 Placement & arity

- **Virtual** — no header cell, no data field, no pack `.col`. Excluded from data-row / `#%` arity and pack `columns=`.
- **Materialized** — physical slot like any stored column. `materialized=1` without the physical column (or virtual with data present) → MUST-fail `computed_materialized_mismatch`.
- Display order = declaration order; reference by `name`, never `index`.

### 5.3 Formula language — `formula-dialect=core` (default)

Bare stored-column names; number / `'string'` / `true` `false` `null`; `+ - * / %`, unary `-`, `= <> < <= > >=`, `and or not`, `( )`. **No** `||` (use `concat`). Whitelist: `abs round floor ceil coalesce nullif least greatest length lower upper trim substr concat` and `case when … then … [else …] end`. `formula-dialect=sql` is an escape hatch (portability warn `formula_dialect_nonportable`).

### 5.4 Deps — stored columns only (no chaining)

- Other computed → `formula_references_computed`. Unknown name → `formula_unknown_reference`. Parse error → `formula_parse_error`. `index=` on virtual → `formula_index_forbidden`. `default`/`required` on computed → ignore, MAY `computed_default_ignored`.

### 5.5 Interactions

- DDL: PG≥18 / MySQL `GENERATED ALWAYS AS … VIRTUAL|STORED`; PG<18 → `STORED` or comment; ClickHouse `ALIAS` / `MATERIALIZED`.
- `#%` arity excludes virtual; materialized MAY have a slot.
- `excsv column materialize|dematerialize`; unzip MAY `--materialize`. Stale cache → warn `computed_stale` (never fatal).

### 5.6 Catalog (`01-features.md`)

D7 declare; G8 evaluate; H14 materialize/dematerialize; L7 pack zero-byte; F5b DDL `GENERATED`.

### 5.7 Codes

MUST-fail: `formula_references_computed`, `formula_unknown_reference`, `formula_parse_error`, `formula_index_forbidden`, `computed_materialized_mismatch`. SHOULD-warn: `computed_default_ignored`, `formula_dialect_nonportable`, `computed_stale`.

### 5.8 Fixtures (after spec)

`plain/valid/NNN_compute_{basic,materialized,case_coalesce}.excsv`; `plain/invalid/NNN_compute_{references_computed,unknown_ref,index_forbidden,materialized_mismatch}.excsv`; `pack/valid/NNN_compute_no_col.excsv.pack.zip`.

### 5.9 Docs

`columns.md`, `data-section.md`, `pack.md`, `sql.md`, `aggregations.md`, `error-handling.md`.

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

## 7. Deferred / out-of-scope

- F9 pack cross-table DDL ordered by FK; E8 pack cross-table aggregations; M2/M3 pack checksum strategy; L5 per-column `sha256=`; N6 FK-graph viz.
- Sorted-id skip index (id on the fencepost) — not part of §6; add later if we want `WHERE id=` without a scan.
- DuckDB-backed `excsv sql --query`; plugin protocol; encryption; server/daemon; in-process pack query engine.
