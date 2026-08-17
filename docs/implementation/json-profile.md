# JSON profile

ExCSV has a secondary, **JSON serialization** for contexts that are already JSON-native — REST payloads, config, JS/TS frontends, and LLM structured output (a model can be constrained to the JSON Schema instead of hand-writing `#!excsv` text). The CSV text form stays **canonical**; the JSON profile is a lossless mirror of the same vocabulary.

- JSON Schema (draft 2020-12): [`schema/excsv.schema.json`](../../schema/excsv.schema.json)
- Example: [`schema/example.excsv.json`](../../schema/example.excsv.json)

The two forms are a **bijection**: any conforming ExCSV text document maps to exactly one JSON document and back, with no loss. Tools SHOULD round-trip text → JSON → text and reproduce the original semantics (byte-identical CSV data section, same metadata).

## Root object

| Key | Text-form origin | Notes |
| --- | --- | --- |
| `excsv` | `#!excsv version=` | Required. |
| `layout` | document shape | `inline` / `sidecar` / `pack`. Optional; inferable from `data` vs `reference` vs `tables`. |
| `csv` | `#!excsv` dialect fields | Round-trip hint: `delim`, `quote`, `header`, `encoding`, `null`. See [Dialect round-trip](#dialect-round-trip). |
| `meta` | `#@key: value` | Object; known keys + any custom. |
| `columns` | `#column` lines | Array; position = physical order. |
| `aggregates` | `#%name:` lines | Object: name → per-column array. |
| `sql` | `#$ddl` / `#$dql` | `{ ddl: [...], dql: [...] }`. |
| `csvw` | `#csvw:` payload | Decoded JSON object (never the base64 form). |
| `schema` | `schema=` | `excsv` (default) or `csvw`. |
| `checksum` | `checksum=` | `"<algo>:<hex>"`. |
| `rows` | `rows=` | For inline data SHOULD equal `data.length`. |
| `reference` | `reference=` | Sidecar only; mutually exclusive with `data`. |
| `data` | data section | Array of row-arrays; **no header row** (names live in `columns`). |
| `tables` | pack tables | Multi-table only; see [Pack](#pack-multi-table). |
| `fk` | `#fk` lines | Pack only. |

A document MUST NOT combine `data` + `reference`, `tables` + `data`, or `tables` + `reference` (enforced by the schema).

## Bijection rules

The text form is line-oriented and stringly-typed; JSON has real types and structure. The mapping resolves each difference deterministically:

| Concern | Text form | JSON form | Round-trip rule |
| --- | --- | --- | --- |
| **Null** | empty field, or a `null=` marker | JSON `null` | An empty/`null`-marked cell ↔ JSON `null`. Extra text markers are listed in `csv.null` so text output can be reproduced. |
| **Numbers / decimal / long** | bare text (`500.00`, `9007199254740993`) | **string** in `data` | Encode numeric cells whose `type` is `decimal`, `long`, or any value that would lose precision as JSON **strings**. `int`/`float`/`double` MAY be JSON numbers when they fit IEEE-754 exactly. The column `type` is authoritative; the JSON scalar kind is not. |
| **Booleans** | `true`/`false`/`1`/`0` per `type=boolean` | JSON `true`/`false` | Canonicalize to JSON booleans; original lexical form is not preserved (it is not semantically meaningful). |
| **Column order** | `#column` order / `index=` | array index | Array position is the physical order. `index` MAY be set explicitly and MUST agree with position. |
| **`enum`** | pipe-joined string `a\|b\|c` | array `["a","b","c"]`, typed per `type` | Split/join on `\|`. Values keep the column's type in JSON. |
| **`unique` / `required`** | `1` / `0` | JSON `true` / `false` | `1` ↔ `true`, `0` ↔ `false`. |
| **`#%` arity** | one value per physical column | array of same length | `null` entry ↔ empty CSV field ("not applicable"). Array length SHOULD equal the physical column count. |
| **SQL dialect** | key suffix `#$ddl-postgres-18:` | `{ "dialect": "postgres", "version": "18", "stmt": "…" }` | Split the suffix into `dialect` + optional `version`. No suffix ↔ omitted `dialect`. |
| **DDL order** | file order | `sql.ddl[]` order | Preserve array order; it is executable order. |
| **`#@` values** | raw text to end of line | string (or typed where obvious) | `tags` MAY be an array; timestamps stay ISO-8601 strings. Unknown `#@` keys pass through. |
| **`##` comments** | human comments | *(dropped)* | Free-text `##` lines carry no structured meaning and are **not** represented in JSON. This is the one intentional non-round-trip. |
| **CSVW** | `#csvw:` (inline or base64url) | decoded JSON in `csvw` | Always store decoded JSON; on text output, re-encode per `csv`/header `csvw=` mode. |

### Dialect round-trip

`data` in JSON is dialect-independent — the cells are already parsed values, so `delim`/`quote`/`encoding` are irrelevant to *reading* the JSON. They matter only to **regenerate the canonical CSV text**. Keep them in `csv` when a faithful text reproduction is required; omit for a pure data exchange.

`csv.header` records whether the text form had a header row. Column **names** always live in `columns`, never as a `data` row.

## Pack (multi-table)

A pack maps to `layout: "pack"` with a `tables` array; root-level `columns`/`data`/`sql`/`aggregates`/`reference` are unused. Each entry mirrors a single-table document (`columns`, `aggregates`, `sql`, `rows`, `data`, plus `name`). `#fk` lines become the root `fk` array.

```json
{
  "excsv": "0.3",
  "layout": "pack",
  "meta": { "source": "warehouse-snapshot" },
  "tables": [
    { "name": "orders",    "columns": [ ... ], "rows": 237000, "data": [ ... ] },
    { "name": "customers", "columns": [ ... ], "rows": 2,      "data": [ ... ] }
  ],
  "fk": [ { "from": "orders.customer_id", "to": "customers.id" } ]
}
```

Columnar layout, sectioning, and ZIP packaging are text/binary-container concerns; the JSON profile is the logical view (rows), not the on-disk columnar encoding. A pack ⇄ JSON round-trip preserves table names, schemas, FKs, and row values, not the physical `.col`/section split.

## Validation

```bash
npx ajv-cli@5 validate -s schema/excsv.schema.json -d your.excsv.json --spec=draft2020 --strict=false
```

Two things the JSON Schema **cannot** check (leave to tooling):

1. `aggregates[*]` and `#%` array lengths equal the physical column count.
2. Numeric precision — that a `decimal`/`long` cell was actually encoded as a string.
