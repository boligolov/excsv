# Data Section

- The data section **MUST** follow the CSV dialect defined in the header (`delim`, `quote`, etc.).
- Quoted values **MUST NOT** contain raw newlines. All values are single-line.
- If the first field of the first data row begins with `#` (unquoted), it is ambiguous with meta lines. To avoid this: if quoting is enabled, the value **MUST** be quoted. If quoting is disabled (`quote=none`), the first field **MUST NOT** start with `#`. Note: `#` itself **MAY** be used as the quote character (e.g. `quote=#`), which resolves the ambiguity.
- If `quote=none`, values **MUST NOT** contain delimiter characters.
- A trailing newline after the last data row is **OPTIONAL**. If present, it is included in checksum computation.
