# Header Line

If present, MUST be line 1. MUST start with `#!excsv`. MUST contain `version=`. Format: space-separated `key=value` pairs. Split on FIRST `=` only (values may contain `=`). Unknown keys: ignore.

## Value quoting

- A value MUST be wrapped in double quotes (`"`) if it contains a space OR a double quote.
- A value containing neither a space nor a double quote MUST NOT be quoted.
- Inside quoted values, a double quote MUST be escaped by doubling (`""`). This is the only way to express a `"` in a value, so any value containing `"` must be quoted (e.g. `title="Order ""A"""`).
- No other escape sequences are allowed.

These rules apply uniformly to all key=value parsing: the header line, `#column`, `#%` names, `#@`, and any other meta line that uses key=value pairs.

## Header fields

```
version        REQUIRED  "0.3"
delim          DEFAULT "comma"   delimiter name or literal (see DELIMITERS)
quote          DEFAULT "none"    quote name or literal (see QUOTING)
header         DEFAULT "1"       "1"=first data row is header, "0"=no header row
null           OPTIONAL          additional non-empty string representing null. Empty fields are ALWAYS null by default. Use only when a non-empty value also means null (e.g. null=NA, null=\N). null="" is redundant.
rows           OPTIONAL          integer, total data rows excluding header
checksum       OPTIONAL          "<algorithm>:<hex>" over data-section bytes, including header row if header=1 (byte-level CRLF→LF; see checksum.md)
csvw           OPTIONAL          "inline-json" | "base64url"
encoding       DEFAULT "UTF-8"   data-section character encoding; MUST be an ASCII superset (UTF-16/UTF-32 forbidden). See encoding.md
schema         DEFAULT "excsv"   "excsv" | "csvw" — which schema source wins
sql-dialect    OPTIONAL          default SQL dialect token for unqualified #$ lines (see SQL). E.g. "mysql", "postgres-18", "clickhouse".
original-size  REQUIRED in row-ZIP and pack manifest  meaning depends on container (see below). Omit on plain files.
reference      REQUIRED if sidecar relative path to CSV/TSV data file (see file-structure). MUST NOT be set on inline documents.
```

## `version` policy

`version=` is REQUIRED when a header line is present. A parser MUST NOT fail solely because the declared version differs from the one it implements — ExCSV aims for backward/forward compatibility via "ignore unknown keys/lines".

- A version this parser does not implement (older or newer, minor or major bump) → warn `unknown_version` and continue parsing best-effort, ignoring unrecognized keys and meta lines.
- The version string is informational for the consumer; it never triggers a parse failure on its own.

## `rows` validation

`rows=` is the total data rows excluding the header row. It is OPTIONAL; when present it MUST equal the actual number of data rows in the (inline or referenced) data.

- On a normal parse, a mismatch is NOT fatal: warn `rows_mismatch` (the count of actual rows wins for downstream use). This keeps slices/previews and hand-edited files readable.
- Under `excsv verify`, a mismatch is a failure (the file is asserted whole and exact).
- For a sidecar (`reference=` set), `rows=` describes the referenced file; it can only be checked when the pair is loaded. Parsing the sidecar alone does not validate it.

`original-size=` on a plain file (no row-ZIP, no pack) is not meaningful: ignore it and warn `original_size_on_plain` (writers MUST omit it on plain files; see `original-size` scopes below).

## `original-size` scopes

The same field name applies in different containers; do not mix semantics:

| Container | Required? | Measures |
| --- | --- | --- |
| Plain `.excsv` / `.extsv` | omit | — |
| Row-ZIP inner file (`.excsv.zip`) | REQUIRED | Uncompressed bytes of the **entire** inner `.excsv`/`.extsv` (header + meta + data). MUST match ZIP central dir `uncompressed_size`. See [zip.md](zip.md). |
| Pack `_manifest.excsv` | REQUIRED | Sum of all `#table original-size=` (uncompressed `.col` payload only; excludes table `_header.excsv`). See [pack.md](pack.md). |

Table `_header.excsv` inside a pack does **not** carry header `original-size=`.

## DELIMITERS

Well-known names (check FIRST, then treat as literal):

```
comma     -> ,
tab       -> \t
pipe      -> |
semicolon -> ;
```

If value is not a well-known name, it is used as the literal delimiter.

## QUOTING

Well-known names (check FIRST, then treat as literal):

```
double    -> "   (double quote)
single    -> '   (single quote)
none      -> no quoting (DEFAULT)
```

If value is not a well-known name, treat as the literal quote character. Example: `quote=double` uses `"`, `quote='` uses `'` literally.
