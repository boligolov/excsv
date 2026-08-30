# JSON form (`.excsv.json`)

Sometimes CSV is the wrong envelope. An API returns JSON, a config file is JSON, a frontend wants an object, an LLM is easier to constrain to a schema than to a `#!excsv` header it has to hand-write. So ExCSV has a **second file format that carries the same document**: `.excsv.json`.

It's not a summary or an export — it's the same vocabulary with the `#` stripped off. Every `#` line becomes a key:

```json
{
  "excsv": "0.4",
  "csv": { "delim": "comma", "quote": "double", "header": true },
  "meta": { "source": "sales_db.orders", "grain": "one row per order" },
  "columns": [
    { "index": 0, "name": "id", "type": "int", "role": "id" },
    { "index": 1, "name": "amount", "type": "decimal", "unit": "USD", "role": "measure", "agg": "sum" }
  ],
  "aggregates": { "sum": [null, "1050.50"] },
  "sql": { "ddl": [{ "dialect": "postgres", "stmt": "CREATE TABLE orders (id INTEGER, amount NUMERIC(10,2))" }] },
  "rows": 2,
  "data": [[1, "500.00"], [2, "550.50"]]
}
```

The same file as text:

```
#!excsv version=0.4 delim=comma quote=double header=1 rows=2
#@source: sales_db.orders
#@grain: one row per order
#column name=id type=int role=id
#column name=amount type=decimal unit=USD role=measure agg=sum
#%sum: ,1050.50
#$ddl-postgres: CREATE TABLE orders (id INTEGER, amount NUMERIC(10,2))
id,amount
1,500.00
2,550.50
```

## What you get

- **Real types.** `required=1` is `true`, `enum=a|b|c` is `["a","b","c"]`, an empty cell is `null`. No parsing `key=value` strings yourself.
- **A schema to validate against.** [`schema/excsv.schema.json`](../schema/excsv.schema.json) (JSON Schema draft 2020-12) — plug it into your editor, your CI, or an LLM's structured-output mode and get the vocabulary enforced for free.
- **Money that survives.** `decimal` and `long` cells are written as JSON strings, so `9007199254740993` and `500.00` don't quietly become floats. The column's `type` tells you how to read them.
- **All three shapes.** Inline (`data`), sidecar (`reference`), and pack (`tables[]` + `fk[]`) all fit in the same object — `layout` says which.

## Round-trip

The CSV text form is still canonical. A tool can go text → JSON → text and get the same document back: same columns, same values, same metadata. Only free-text `##` human comments are dropped, because they carry no structured meaning.

Delimiter, quote character, and encoding live under `csv`. Reading JSON doesn't need them — the cells are already parsed — but they're what lets a writer regenerate the exact CSV text. Omit the whole `csv` object if you're just exchanging data.

## Where to put it

Name it `sales.excsv.json` and serve it as `application/excsv+json`. A worked file is in [`schema/example.excsv.json`](../schema/example.excsv.json).

Validate one with any JSON Schema tool:

```bash
npx ajv-cli@5 validate -s schema/excsv.schema.json -d sales.excsv.json --spec=draft2020 --strict=false
```

---

The exact mapping rules — how each text construct becomes JSON and back — are in [implementation/json.md](implementation/json.md).
