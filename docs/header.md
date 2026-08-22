# Header line

The first line, when present, names the CSV dialect and a few facts about the file. It starts with `#!excsv` and always carries `version`:

```
#!excsv version=0.3 delim=comma header=1
```

Everything else is `key=value`, separated by spaces. Values with spaces go in double quotes (`"like this"`); a literal double quote inside is written `""`. Leave out any field you don't need — sensible defaults fill in.

## Fields

| Field | Usual? | What it says |
| --- | --- | --- |
| `version` | always | Format version (`0.3`) |
| `delim` | common | The delimiter. A name (`comma`, `tab`, `pipe`, `semicolon`) or a literal like `::`. Default: `comma` |
| `quote` | common | The quote character. `none`, `double`, `single`, or a literal. Default: `none` |
| `header` | common | `1` if the first data row is a header row, `0` if not. Default: `1` |
| `null` | optional | An extra string that also means null (e.g. `null=NA`, `null=\N`). Empty fields are always null already |
| `rows` | optional | How many data rows there are (excluding the header) |
| `checksum` | optional | Integrity fingerprint of the data — see [Checksum](checksum.md) |
| `encoding` | optional | Character encoding. Default: `UTF-8` |
| `sql-dialect` | optional | Default SQL dialect for `#$` lines that don't name one — see [SQL](sql.md) |
| `csvw` | optional | How CSVW metadata is embedded, if any — see [CSVW](csvw.md) |
| `schema` | optional | Which schema wins if both ExCSV and CSVW are present: `excsv` (default) or `csvw` |
| `reference` | sidecar only | Relative path to the data file this sidecar describes — see [File structure](file-structure.md#sidecar--annotate-without-touching-the-data) |
| `original-size` | ZIP/pack only | Uncompressed byte size. On a file inside `.excsv.zip`, the size of that inner `.excsv`. On a pack manifest, the sum of the tables' column payloads. See [ZIP](zip.md) and [Pack](pack.md) |

## Delimiter values

Use a friendly name, or just the character itself:

| Name | Character |
| --- | --- |
| `comma` | `,` |
| `tab` | tab |
| `pipe` | `\|` |
| `semicolon` | `;` |

Anything that isn't one of those names is taken literally: `delim=::` means a two-character `::` delimiter, `delim=|` a literal pipe.

## Quote values

| Name | Character |
| --- | --- |
| `none` | no quoting (default) |
| `double` | `"` |
| `single` | `'` |

As with `delim`, any other value is used as the literal quote character.

## Extra keys

You can add your own keys — a tool that doesn't recognize them just leaves them alone. If you invent one, prefix it with `x-` (e.g. `x-team=analytics`) so it never collides with a future standard field.
