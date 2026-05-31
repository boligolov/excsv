# ExCSV — Implementation Plan

Working plan for building tooling around the ExCSV v0.2 spec and the future pack format. Replaces the old `golang/features.md`, which is implemented but **obsolete**: it predates the `#$` SQL section, the `.excsv.zip` container, and the pack format. Treat that file as historical reference only.

## Tracks

1. **Go (`excsv-cli`)** — primary implementation. Reference behaviour and performance target.
2. **Python (`excsv` package)** — second implementation. Same spec, idiomatic Python API, parity-tested against Go.
3. **CLI cookbook** — console recipes (one-liners, pipelines, common workflows). Not scripts to maintain — just a reference of what good usage looks like. Cookbook drives feature priorities ("what would a user type?") and doubles as integration tests.

## Sequencing

Work proceeds across all three tracks roughly in lockstep, gated by **format readiness**:

| Wave | Format scope | Tracks |
| --- | --- | --- |
| 1 | row plain (`.excsv`) | Go → Python → cookbook |
| 2 | row zipped (`.excsv.zip`) | Go → Python → cookbook |
| 3 | pack unsectioned (`.excsv.pack.zip`, single-table mode) | Go → Python → cookbook |
| 4 | pack multi-table | Go → Python → cookbook |
| 5 | pack sectioned (chunked columns) | Go → Python → cookbook |

Each wave is "done" only when all three tracks land it.

## Documents

| File | Status | Purpose |
| --- | --- | --- |
| `01-features.md` | **draft** | Abstract feature catalog. Format-agnostic capability map. **Source of truth for what we're building.** |
| `02-fixtures.md` | **draft** | Test-fixture corpus: per-feature success + failure cases, naming, manifest, generation rules. Shared by Go and Python tracks. |
| `03-golang.md` | todo | Per-feature Go implementation plan: package layout, types, command tree, sequencing. Consumes the fixtures from step 2. |
| `04-python.md` | todo | Per-feature Python implementation plan: package layout, API, parity tests against the same fixture corpus. |
| `05-cookbook.md` | todo | CLI recipes. Real terminal sessions, copy-pasteable. Organised by user goal, not by command. Recipes cite fixtures by ID. |

## Rules

- **Spec first, code second.** If a feature isn't in `README-LLM.md`, it doesn't get implemented. If we need behaviour the spec doesn't pin down, we update the spec.
- **No partial waves.** Don't start wave N+1 until wave N is fully green on all three tracks.
- **Reserved names stay reserved.** v0.2 readers ignore `layout=`, `mode=`, `section-size=`, `#table`, `#fk`. Don't accidentally implement pack semantics on row-form readers.
- **Pack tooling lives in its own namespace.** No automatic detection trickery; the CLI surface for packs is explicit (`excsv pack ...`, file extension `.excsv.pack.zip`).
