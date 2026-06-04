# Checksum

Header field: `checksum=<algorithm>:<hex-digest>`. Scope: entire data section (after last meta line), including the header row if `header=1` and the trailing newline if present. Normalize newlines to LF before computing.
