# Data section

Below the metadata, it's just CSV. The rows follow the dialect the header declared — the delimiter, the quote character, the encoding — and nothing more. No ExCSV-specific syntax lives down here; this is the part `grep`, `awk`, pandas, and Excel read without knowing ExCSV exists.

Each value is on a single line (values don't span line breaks), and a trailing newline at the end of the file is optional. That's the whole contract: your data stays ordinary CSV, and everything that makes it *self-describing* sits in the `#` lines above.
