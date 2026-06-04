# Header Line

If present, MUST be line 1. MUST start with `#!excsv`. MUST contain `version=`. Format: space-separated `key=value` pairs. Split on FIRST `=` only (values may contain `=`). Unknown keys: ignore.

## Value quoting

- Values without spaces MUST NOT be quoted.
- Values with spaces MUST be wrapped in double quotes (`"`).
- Inside quoted values, double quote MUST be escaped by doubling (`""`).
- No other escape sequences are allowed.

## Header fields

```
version        REQUIRED  "0.2"
delim          DEFAULT "comma"   delimiter name or literal (see DELIMITERS)
quote          DEFAULT "none"    quote name or literal (see QUOTING)
header         DEFAULT "1"       "1"=first data row is header, "0"=no header row
null           OPTIONAL          additional non-empty string representing null. Empty fields are ALWAYS null by default. Use only when a non-empty value also means null (e.g. null=NA, null=\N). null="" is redundant.
rows           OPTIONAL          integer, total data rows excluding header
checksum       OPTIONAL          "<algorithm>:<hex>" over entire data section, including header row if header=1 (LF-normalized)
csvw           OPTIONAL          "inline-json" | "base64url"
encoding       DEFAULT "UTF-8"   character encoding
schema         DEFAULT "excsv"   "excsv" | "csvw" — which schema source wins
sql-dialect    OPTIONAL          default SQL dialect token for unqualified #$ lines (see SQL). E.g. "mysql", "postgres-15", "clickhouse".
original-size  REQUIRED if zipped  uncompressed byte size of the inner `.excsv` file (decimal integer). See ZIP.
reference      REQUIRED if sidecar relative path to CSV/TSV data file (see file-structure). MUST NOT be set on inline documents.
```

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
