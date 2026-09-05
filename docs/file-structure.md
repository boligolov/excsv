# File structure

An ExCSV file reads top to bottom in three parts:

```
┌─────────────────────────┐
│  Header line            │  ← one line naming the dialect (optional)
├─────────────────────────┤
│  Meta lines             │  ← the # description lines (optional, any number)
├─────────────────────────┤
│  Data section           │  ← ordinary CSV/TSV rows
└─────────────────────────┘
```

Everything above the data is optional. Drop the header and it's read as plain comma-separated CSV with a header row — i.e. a normal `.csv`. Add just a `#!excsv version=0.4` line and you have the smallest possible ExCSV file (a template with no data yet).

## The three shapes

| Shape | Data lives… | Best for |
| --- | --- | --- |
| **Inline** | in the same file, below the metadata | exports you generate, files you share, snippets you paste somewhere |
| **Sidecar** | in a separate, untouched `.csv`/`.tsv` | data you can't or won't modify — vendor dumps, regulated files, anything with its own checksum |
| **Header-only stub** | nowhere yet | templates and schemas you'll fill in later |

(Packaged forms — `.excsv.zip`, `.excsv.pack.zip` — are on their own pages. If you want the whole document as JSON instead of CSV, that's [`.excsv.json`](json.md).)

## Sidecar — annotate without touching the data

A **sidecar** is an ExCSV file with header and `#` lines but **no rows**. It points at a real data file with `reference=`, and describes it from the outside. The data file stays exactly as it was — same bytes, still opens as plain CSV.

Pair by basename: `sales.excsv` describes `sales.csv`; `sales.extsv` describes `sales.tsv` (tab-separated). The `reference=` path is relative to the sidecar.

`sales.excsv`:

```
#!excsv version=0.4 delim=comma quote=double header=1 rows=2 reference=sales.csv
#@source: sales_db.orders
#column name=id type=int
#column name=customer type=string
#%sum: ,,750.50
```

`sales.csv` — an ordinary CSV, no ExCSV header, never modified:

```
id,customer,amount
1,Acme Corp,500.00
2,Globex Inc,250.50
```

Row count, checksum, and aggregations in the sidecar describe the *referenced* file. You can keep several sidecars describing the same data for different audiences. When you open the plain `sales.csv`, a tool can pick up `sales.excsv` sitting next to it automatically.

Why bother instead of just editing the CSV? Because a lot of data isn't yours to edit — immutable lakes, files under contract, anything with a hash someone else checks. A sidecar lets you layer types, stats, and SQL onto it without changing a byte.

A sidecar zips the same way an inline file does. `sales.excsv.zip` can hold just the sidecar, or the sidecar together with `sales.csv` as a second entry in the same archive — see [ZIP § Sidecar inside a ZIP archive](implementation/zip.md#sidecar-inside-a-zip-archive).

## Line endings and encoding

LF and CRLF both work. A UTF-8 byte-order mark at the start of the file is fine. Encoding defaults to UTF-8; set `encoding=` on the header if it's something else.
