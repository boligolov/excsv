# Header Line

## Syntax

If present, the header line **MUST** be line 1, **MUST** begin with `#!excsv`, and **MUST** contain at least the `version` field.

```
#!excsv version=0.3 delim=comma header=1
```

## Key-Value Pairs

- Header fields **MUST** be encoded as `key=value`.
- Pairs **MUST** be separated by one or more spaces.
- Parsing **MUST** split on the **first** `=` character (values may contain `=`).
- Unknown keys **MUST** be ignored by conforming parsers.

## Value Rules

- Values without spaces **MUST NOT** be quoted.
- Values with spaces **MUST** be wrapped in double quotes (`"`).
- Inside quoted values, double quote **MUST** be escaped by doubling (`""`).
- No other escape sequences are allowed.

## Header Fields

| Field           | Requirement                | Description                                                                                                                          |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `version`       | **MUST**                   | Format version (`0.3`)                                                                                                               |
| `delim`         | SHOULD                     | Delimiter — a known name **or** a literal character/sequence (see below). Default: `comma`                                            |
| `quote`         | SHOULD                     | Quote — a known name **or** a literal character (see below). Default: `none`                                                          |
| `header`        | SHOULD                     | `1` if the first data row is a header row, `0` otherwise. Default: `1`                                                                |
| `null`          | MAY                        | Additional non-empty string representing null. Empty fields are **always** null by default. Use only when a non-empty value also means null (e.g. `null=NA`, `null=\N`). `null=""` is redundant. |
| `rows`          | MAY                        | Total number of data rows (excluding header)                                                                                         |
| `checksum`      | MAY                        | Checksum of the data section (see [Checksum](checksum.md))                                                                          |
| `csvw`          | MAY                        | CSVW embedding mode (see [CSVW](csvw.md))                                                                         |
| `encoding`      | MAY                        | Character encoding (default `UTF-8`)                                                                                                 |
| `schema`        | MAY                        | Schema precedence: `excsv` (default) or `csvw`                                                                                       |
| `sql-dialect`   | MAY                        | Default SQL dialect for unqualified `#$` lines (see [SQL](sql.md))                                                  |
| `original-size` | **MUST** in row-ZIP and pack manifest | Meaning depends on container: row-ZIP inner file = uncompressed bytes of the entire inner `.excsv`/`.extsv`; pack `_manifest.excsv` = sum of `#table original-size=` (column payload only). Omit on plain files. See [ZIP](zip.md) and [Pack](pack.md). |
| `reference`     | **MUST** if sidecar        | Relative path to the CSV/TSV data file. See [File structure](file-structure.md#sidecar-detached-metadata). **MUST NOT** be set on inline documents. |

### Delimiter Values

The `delim` field accepts either a **well-known name** or a **literal character/sequence**.

**Well-known names:**

| Name        | Character         |
| ----------- | ----------------- |
| `comma`     | `,`               |
| `tab`       | `\t`              |
| `pipe`      | `\|`              |
| `semicolon` | `;`               |

**Literal delimiters:**

Any value that is not a well-known name **MUST** be treated as the literal delimiter string.

| Example      | Delimiter used              |
| ------------ | --------------------------- |
| `delim=,`    | `,`                         |
| `delim=tab`  | Tab character (well-known)  |
| `delim=::`   | Two-colon sequence `::`     |
| `delim=|`    | `\|` (literal pipe)          |

- If the value is not a well-known name, it is used as the literal delimiter.
- Parsers **MUST** first check against the well-known name table; if no match, treat the value as a literal.

### Quote Values

The `quote` field accepts either a **well-known name** or a **literal character**.

**Well-known names:**

| Name | Character |
|---|---|
| `none` | No quoting (default) |
| `double` | `"` (double quote) |
| `single` | `'` (single quote) |

Any value that is not a well-known name **MUST** be treated as the literal quote character.

- Parsers **MUST** first check against the well-known name table; if no match, treat the value as a literal.
