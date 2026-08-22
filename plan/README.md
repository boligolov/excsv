# ExCSV — Implementation Plan

Shared planning for ExCSV tooling. This repository holds the **spec**, the abstract feature catalog, and the **fixture corpus** that all implementations consume. Per-language implementation plans and cookbooks live in their own repositories.

Replaces the old `golang/features.md`, which is implemented but **obsolete**: it predates the `#$` SQL section, the `.excsv.zip` container, and the pack format. Treat that file as historical reference only.

## What lives here

| Path | Purpose |
| --- | --- |
| `README.md`, `docs/` | Normative spec (v0.3) |
| `plan/01-features.md` | Abstract feature catalog — **source of truth for capabilities** |
| `plan/02-fixtures.md` | Fixture naming, manifest rules, generation |
| `fixtures/` | Shared test corpus (`fixtures.yaml` + `plain/`, `zip/`, `pack/`) |
| `plan/TODO.md` | Consolidated backlog — remaining spec/fixture/impl work + new features |

## Implementation repositories

| Track | Repository | Role |
| --- | --- | --- |
| **Go** | [excsv-golang](https://github.com/boligolov/excsv-golang) | Primary CLI/library. Reference behaviour and performance. |
| **Python** | separate repo (TBD) | Idiomatic API; parity-tested against Go on `fixtures/`. |
| **Cookbook** | separate repo (TBD) | Copy-paste CLI recipes by user goal; cites fixture IDs. |

Each implementation repo owns its own plan: package layout, command tree, API surface. They **read** `plan/01-features.md` and **test against** `fixtures/` — symlink, junction, submodule, or vendored copy; no duplication of fixture files inside impl repos.

## Sequencing

The spec is implemented as a whole. Go and Python cover plain, sidecar, row-ZIP, and pack (including sectioned) against the same fixture corpus. Cookbook tracks the CLIs, not a format subset.

## Documents (this repo)

| File | Status | Purpose |
| --- | --- | --- |
| `01-features.md` | **draft** | Format-agnostic capability map with feature IDs (A1…P8). |
| `02-fixtures.md` | **draft** | Fixture corpus rules; shared by Go, Python, and cookbook. |

## Rules

- **Spec first, code second.** If a feature isn't in `README.md` / `docs/`, it doesn't get implemented. If we need behaviour the spec doesn't pin down, update the spec here first.
- **One fixture tree.** Implementations MUST NOT fork fixtures; they point at `fixtures/` in this repo.
- **Reserved names stay reserved.** Row/plain readers ignore pack-only keys `layout=`, `section-size=`, `table-count=`, `single-table=`, `#table`, `#fk` (warn `pack_key_on_plain`). Don't accidentally implement pack semantics on row-form readers.
- **Pack tooling lives in its own namespace.** No automatic detection trickery; the CLI surface for packs is explicit (`excsv pack ...`, file extension `.excsv.pack.zip`).
