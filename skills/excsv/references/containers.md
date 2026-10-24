# Containers: row ZIP, pack, JSON

The same header and meta vocabulary appears in every shape. Only the packaging differs.

## Row ZIP: `.excsv.zip` / `.extsv.zip`

- The **first** central-directory entry is the primary ExCSV file. It is named like the archive minus `.zip`, or `data.excsv`. Further entries are attachments, or the CSV a sidecar primary references; `reference=` resolves inside the archive first.
- The archive **comment** mirrors the meta block, so `unzip -z FILE` (or Python `zipfile.ZipFile(p).comment.decode()`) shows the schema without extracting.
- The comment keeps lines in this priority order: header, key `#@`, `#column`, `#$ddl`, `#%`, other `#@`, `#$dql`, `#chart`, `#note`/`#link`.
- A comment ending in `#@comment-truncated: 1` is incomplete: the notes and charts go missing first. The inner file is authoritative, so read it: `unzip -p FILE | sed '1s/^\xEF\xBB\xBF//; /^#/!q'`.
- The inner header carries `original-size=`, the uncompressed bytes of the inner file. `checksum=` is the inner data-section digest, the same as for a plain file.
- An archive may be password-protected. The password is never stored in the file; ask the user for it.
- pandas reads a single-entry archive directly: `pd.read_csv("x.excsv.zip", skiprows=n_meta, …)`. Count `n_meta` from `unzip -p`.

## Pack: `.excsv.pack.zip`

A columnar archive with one or more tables:

```
sales.excsv.pack.zip
├── _manifest.excsv            first entry; header has layout=pack
├── orders/
│   ├── _header.excsv          layout=columnar rows=… + #column/#%/#$/#note for this table
│   ├── 00-id.col              one value per line; empty line = null; null= applies
│   ├── 01-customer_id.col
│   └── 02-amount.col
└── customers/ …
```

- **The manifest** lists the tables as `#table name=orders dir=orders/ columns=3 original-size=…` and the relationships as `#fk from=orders.customer_id to=customers.id`. These are join keys, not enforced constraints. `single-table=NAME` names the default table. The ZIP comment usually mirrors the manifest. `unzip -z` shows the table list, and `unzip -p FILE _manifest.excsv` shows the rest.
- **Per table**, `unzip -p FILE orders/_header.excsv` gives that table's meta block. The header has no header row: `#column` order matches the numeric prefix of the `.col` files. Virtual computed columns have no `.col` file and use no index.
- **Read only the columns you need**, which is the point of a pack: `unzip -p FILE orders/02-amount.col`. Line *N* of every `.col` file in a table is row *N*. Paste columns side by side to rebuild rows: `paste -d, <(unzip -p F orders/00-id.col) <(unzip -p F orders/02-amount.col)`.
- **Sectioned tables** (`section-size=K` in `_header.excsv`) store each column as a folder `NN-name/` of `<start>.col` files. Concatenate them in numeric order of `<start>`. Row *N* is in section `floor(N/K)*K`, at line `N - start`.
- If there is no manifest, or it has no `#table` lines, every directory that contains a `_header.excsv` is a table, in alphabetical order.
- `#column`, `#chart`, `#note` and `#link` lines on the manifest are ignored. They belong in a table's `_header.excsv`.

## JSON form: `.excsv.json`

A single JSON object. Readers dispatch on content: an object with an `"excsv"` member is the JSON form.

| Key | Holds |
| --- | --- |
| `excsv` | the version |
| `layout` | `inline` / `sidecar` / `pack` |
| `csv` | the original dialect (`delim`, `quote`, `header`, `null`, `encoding`); needed only to regenerate the text form |
| `meta` | the `#@` keys; `tags` may be an array |
| `columns[]` | `#column` objects with real types: `unique`/`required`/`materialized` are booleans, `enum` is an array. Every physical column has `index`, its position in each `data` row. Virtual computed columns have no `index`. |
| `rows` | the row count |
| `data` | an array of row arrays, **without a header row**: take the names from `columns[].name` by `index`. Nulls are `null`. `decimal` and `long` values are **strings** (to keep precision), `int`/`float`/`double` may be numbers, booleans are `true`/`false`. |
| `aggregates` | `{ "sum": [null, null, "1050.50"], … }`, arrays by physical position, like `#%` |
| `sql` | `{ "ddl": [{ "dialect": "postgres", "version": "18", "stmt": "…" }], "dql": [...] }`, `ddl` in execution order |
| `charts[]`, `notes[]`, `links[]` | the `#chart`/`#note`/`#link` lines as flat objects |
| `checksum` | the `checksum=` value |
| `reference` | sidecar only, instead of `data` |
| `tables[]`, `fk[]` | pack: each table entry mirrors a single-table document (`name`, `columns`, `rows`, `data`, …) |

```python
import json, pandas as pd
doc = json.load(open("x.excsv.json", encoding="utf-8"))
cols = sorted((c for c in doc["columns"] if "index" in c), key=lambda c: c["index"])
df = pd.DataFrame(doc["data"], columns=[c["name"] for c in cols])
```
