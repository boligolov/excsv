# Checksum

If present in the header line:

```
checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924...
```

- The checksum **MUST** apply to the **entire data section** (everything after the last meta line), including the header row if `header=1` and the trailing newline if present.
- Newlines **MUST** be normalized to `\n` (LF) before computing.
- Format: `<algorithm>:<hex-digest>`.
- Covers semantic content integrity of the data section regardless of packaging or transport.
- `checksum=` is advisory. A mismatch is always a **warning, never a failure — including under `excsv verify`**. An unknown algorithm or malformed digest → warn and skip verification. (`rows=` and `original-size=` have their own, stricter rules.)
