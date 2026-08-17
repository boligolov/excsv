# Checksum

If present in the header line:

```
checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924...
```

- The checksum **MUST** apply to the **entire data section** (everything after the last meta line), including the header row if `header=1` and the trailing newline if present.
- Newlines **MUST** be normalized to `\n` (LF) before computing.
- Format: `<algorithm>:<hex-digest>`.
- This is **semantic** content integrity, covering the data section regardless of how the file is packaged or transported.
- **A checksum mismatch is always a warning, never a failure — including under `excsv verify`.** The tool warns loudly but does not block; `checksum=` is an advisory integrity signal, not an access gate. An unknown algorithm or malformed digest → warn and skip verification. (`rows=` and `original-size=` have their own, stricter rules.)
