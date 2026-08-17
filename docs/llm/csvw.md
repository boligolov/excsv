# CSVW (`#csvw`)

`csvw=inline-json` or `csvw=base64url` in header. Payload in `#csvw: ...` meta line (`#csvw:` followed by the value to end of line; one optional leading space after `:` is skipped for readability). Valid JSON (decode first if `csvw=base64url` in header). Readers MAY ignore entirely.

Exactly one `#csvw:` line per file. A duplicate `#csvw:` line is NOT a parse error: warn `duplicate_csvw` and apply **last-wins** (the final line replaces earlier ones), mirroring `#@` / `#column`. The payload MUST fit on a single line (no continuation/multi-line) — for large JSON use `csvw=base64url` to keep it to one line.

Schema precedence controlled by `schema=excsv|csvw` header field (default excsv).
