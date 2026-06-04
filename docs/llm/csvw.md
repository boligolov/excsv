# CSVW (`#csvw`)

`csvw=inline-json` or `csvw=base64url` in header. Payload in `#csvw ...` meta line (`#csvw` followed by a space and value to end of line). Valid JSON (decode first if `csvw=base64url` in header). Readers MAY ignore entirely.

Schema precedence controlled by `schema=excsv|csvw` header field (default excsv).
